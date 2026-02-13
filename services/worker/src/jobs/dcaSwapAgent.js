/**
 * DCA Swap Agent Job
 *
 * Background worker that executes due DCA (dollar-cost averaging)
 * swap schedules using chained delegation (ERC-7710) and 0x API.
 *
 * The agent wallet submits redeemDelegations() on-chain with the
 * chained context [sub-delegation, parent-delegation] to execute
 * swaps from the user's smart wallet.
 *
 * Safety guarantees:
 * - Wallet isolation via compound sub-delegation key (walletAddress_scheduleId)
 * - Execution locking (status: 'executing') prevents double-execution
 * - Per-schedule error isolation
 * - Expiration and max-execution enforcement
 * - Fresh 0x quotes per execution (no stale pricing)
 */

import { ethers } from 'ethers';

const DCA_SCHEDULE_COLLECTION = 'DCASchedules';
const SUBDELEGATION_COLLECTION = 'SubDelegations';

const ZEROX_API_BASE = 'https://api.0x.org';
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

const DELEGATION_MANAGER_ABI = [
  'function redeemDelegations(bytes[] delegations, bytes32[] modes, bytes[] executions) returns (bool)'
];

const EXECUTION_MODE_SINGLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const RPC_URLS = {
  1: process.env.ETH_RPC_URL || process.env.ALCHEMY_RPC_URL || 'https://ethereum.publicnode.com',
  8453: process.env.BASE_RPC_URL || 'https://base.publicnode.com',
  11155111: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
  84532: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
};

const TOKEN_ADDRESSES = {
  1: {
    ETH: NATIVE_TOKEN_ADDRESS,
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedC7A0D6Ec9839',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  8453: {
    ETH: NATIVE_TOKEN_ADDRESS,
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    DAI: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
  },
  11155111: {
    ETH: NATIVE_TOKEN_ADDRESS,
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D5741',
  }
};

const TOKEN_DECIMALS = {
  ETH: 18, WETH: 18,
  USDC: 6, USDT: 6, USDbC: 6,
  DAI: 18, WBTC: 8,
};

const EXPLORERS = {
  1: 'https://etherscan.io',
  8453: 'https://basescan.org',
  11155111: 'https://sepolia.etherscan.io',
  84532: 'https://sepolia.basescan.org'
};

function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'hourly': return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'test': return new Date(now.getTime() + 2 * 60 * 1000);
    default: return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

function resolveToken(symbol, chainId) {
  const upper = symbol.toUpperCase();
  if (upper === 'ETH') return { address: NATIVE_TOKEN_ADDRESS, decimals: 18 };
  const chainTokens = TOKEN_ADDRESSES[chainId];
  if (chainTokens && chainTokens[upper]) {
    return { address: chainTokens[upper], decimals: TOKEN_DECIMALS[upper] || 18 };
  }
  return null;
}

function encodeExecution(target, value, callData) {
  return ethers.solidityPacked(
    ['address', 'uint256', 'bytes'],
    [target, value, callData || '0x']
  );
}

async function fetch0xQuote(chainId, sellToken, buyToken, sellAmount, taker, slippageBps) {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) throw new Error('ZEROX_API_KEY not configured');

  const params = new URLSearchParams({
    chainId: chainId.toString(),
    sellToken,
    buyToken,
    sellAmount,
    taker,
    slippageBps: slippageBps.toString()
  });

  const url = `${ZEROX_API_BASE}/swap/allowance-holder/quote?${params}`;
  const response = await fetch(url, {
    headers: {
      'Accept': 'application/json',
      '0x-api-key': apiKey,
      '0x-version': 'v2'
    }
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`0x API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Execute a single DCA swap schedule on-chain via delegation + 0x.
 */
async function executeDCASwap(firestore, schedule) {
  const { scheduleId, walletAddress, fromToken, toToken, amount, chainId, slippageBps = 100 } = schedule;

  const agentKey = process.env.BACKEND_SUBDELEGATION_KEY;
  if (!agentKey) throw new Error('BACKEND_SUBDELEGATION_KEY not configured');

  // Fetch sub-delegation
  const subDelDoc = await firestore.collection(SUBDELEGATION_COLLECTION)
    .doc(`${walletAddress.toLowerCase()}_${scheduleId}`)
    .get();

  if (!subDelDoc.exists) throw new Error('Sub-delegation not found');

  const subDel = subDelDoc.data();
  if (!subDel.chainedPermissionsContext) {
    throw new Error('No chained permissions context in sub-delegation');
  }

  // Resolve token addresses
  const fromResolved = resolveToken(fromToken, chainId);
  const toResolved = resolveToken(toToken, chainId);

  if (!fromResolved) throw new Error(`Token ${fromToken} not found on chain ${chainId}`);
  if (!toResolved) throw new Error(`Token ${toToken} not found on chain ${chainId}`);

  // Parse amount to smallest units
  const sellAmountWei = ethers.parseUnits(amount, fromResolved.decimals).toString();

  const rpcUrl = RPC_URLS[chainId] || RPC_URLS[8453];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const agentWallet = new ethers.Wallet(agentKey, provider);

  const delegationManager = new ethers.Contract(
    subDel.delegationManager,
    DELEGATION_MANAGER_ABI,
    agentWallet
  );

  // Fetch 0x quote with user's wallet as taker
  let quote = await fetch0xQuote(
    chainId,
    fromResolved.address,
    toResolved.address,
    sellAmountWei,
    walletAddress,
    slippageBps
  );

  // Handle ERC-20 approval if needed
  const isNative = fromToken.toUpperCase() === 'ETH';
  if (!isNative && quote.issues?.allowance) {
    console.log(`[DCA Agent] ${scheduleId}: approving AllowanceHolder for ${fromToken}`);

    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    const approveData = iface.encodeFunctionData('approve', [
      quote.issues.allowance.spender,
      ethers.MaxUint256
    ]);
    const approveExecution = encodeExecution(fromResolved.address, 0n, approveData);

    const approveTx = await delegationManager.redeemDelegations(
      [subDel.chainedPermissionsContext],
      [EXECUTION_MODE_SINGLE],
      [approveExecution]
    );
    await approveTx.wait();
    console.log(`[DCA Agent] ${scheduleId}: approval confirmed, tx: ${approveTx.hash}`);

    // Re-fetch quote with fresh pricing after approval
    quote = await fetch0xQuote(
      chainId,
      fromResolved.address,
      toResolved.address,
      sellAmountWei,
      walletAddress,
      slippageBps
    );
  }

  // Execute swap via delegation
  const swapExecution = encodeExecution(
    quote.transaction.to,
    BigInt(quote.transaction.value || 0),
    quote.transaction.data
  );

  const tx = await delegationManager.redeemDelegations(
    [subDel.chainedPermissionsContext],
    [EXECUTION_MODE_SINGLE],
    [swapExecution]
  );

  console.log(`[DCA Agent] ${scheduleId}: swap TX sent: ${tx.hash}`);
  const receipt = await tx.wait();

  return {
    success: true,
    txHash: tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    agentAddress: agentWallet.address,
    buyAmount: quote.buyAmount,
    buyToken: toToken
  };
}

/**
 * Main DCA swap agent job. Called by worker scheduler.
 *
 * Queries all due active DCA schedules, processes each with
 * per-schedule error isolation and execution locking.
 */
export async function runDCASwapAgent(firestore) {
  console.log('[DCA Agent] Starting scheduled run...');

  const agentKey = process.env.BACKEND_SUBDELEGATION_KEY;
  if (!agentKey) {
    console.warn('[DCA Agent] BACKEND_SUBDELEGATION_KEY not set, skipping');
    return { skipped: true, reason: 'No agent key configured' };
  }

  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    console.warn('[DCA Agent] ZEROX_API_KEY not set, skipping');
    return { skipped: true, reason: 'No 0x API key configured' };
  }

  const now = Date.now();
  const results = [];

  try {
    const dueSchedules = await firestore.collection(DCA_SCHEDULE_COLLECTION)
      .where('status', '==', 'active')
      .where('nextRunAt', '<=', new Date(now))
      .limit(50)
      .get();

    console.log(`[DCA Agent] Found ${dueSchedules.size} schedule(s) due`);

    if (dueSchedules.size === 0) {
      return { success: true, processed: 0, results: [] };
    }

    for (const doc of dueSchedules.docs) {
      const schedule = doc.data();
      const sid = schedule.scheduleId;

      try {
        // Check expiration
        if (schedule.expiresAt && schedule.expiresAt < Math.floor(now / 1000)) {
          console.log(`[DCA Agent] ${sid}: expired, marking completed`);
          await doc.ref.update({ status: 'completed', updatedAt: now });
          results.push({ scheduleId: sid, success: false, reason: 'expired' });
          continue;
        }

        // Check max executions
        if (schedule.maxExecutions && (schedule.executionCount || 0) >= schedule.maxExecutions) {
          console.log(`[DCA Agent] ${sid}: max executions reached, marking completed`);
          await doc.ref.update({ status: 'completed', updatedAt: now });
          results.push({ scheduleId: sid, success: false, reason: 'max_executions' });
          continue;
        }

        // Execution lock
        await doc.ref.update({ status: 'executing', updatedAt: now });

        const result = await executeDCASwap(firestore, schedule);

        // Update schedule on success
        const newCount = (schedule.executionCount || 0) + 1;
        const shouldComplete = schedule.maxExecutions && newCount >= schedule.maxExecutions;
        const nextRun = calculateNextRun(schedule.frequency);

        const executionRecord = {
          success: true,
          txHash: result.txHash,
          gasUsed: result.gasUsed,
          buyAmount: result.buyAmount,
          executedAt: new Date().toISOString(),
          executionNumber: newCount
        };

        const chainId = schedule.chainId || 8453;
        const explorer = EXPLORERS[chainId] || EXPLORERS[8453];

        await doc.ref.update({
          executionCount: newCount,
          lastExecutionAt: now,
          lastExecutionResult: executionRecord,
          nextRunAt: shouldComplete ? null : nextRun,
          status: shouldComplete ? 'completed' : 'active',
          executionHistory: appendToArray(schedule.executionHistory, executionRecord),
          updatedAt: now
        });

        console.log(`[DCA Agent] ${sid}: executed (run #${newCount}), tx: ${result.txHash}`);

        results.push({
          scheduleId: sid,
          success: true,
          txHash: result.txHash,
          explorerUrl: `${explorer}/tx/${result.txHash}`,
          executionNumber: newCount,
          nextRun: shouldComplete ? null : nextRun.toISOString()
        });

      } catch (error) {
        console.error(`[DCA Agent] ${sid}: execution failed:`, error.message);

        const executionRecord = {
          success: false,
          error: error.message,
          executedAt: new Date().toISOString()
        };

        try {
          await doc.ref.update({
            status: 'active',
            lastExecutionResult: executionRecord,
            executionHistory: appendToArray(schedule.executionHistory || [], executionRecord),
            updatedAt: now
          });
        } catch (updateErr) {
          console.error(`[DCA Agent] ${sid}: failed to update after error:`, updateErr.message);
        }

        results.push({ scheduleId: sid, success: false, error: error.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`[DCA Agent] Completed. ${succeeded} succeeded, ${failed} failed out of ${results.length}`);

    return { success: true, processed: results.length, succeeded, failed, results };

  } catch (error) {
    console.error('[DCA Agent] Job error:', error);
    throw error;
  }
}

function appendToArray(existingArray, newItem) {
  const arr = Array.isArray(existingArray) ? [...existingArray] : [];
  arr.push(newItem);
  return arr;
}
