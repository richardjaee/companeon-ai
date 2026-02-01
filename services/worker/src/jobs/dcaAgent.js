/**
 * Transfer Agent Job
 *
 * Background worker that executes due recurring transfer schedules
 * using chained delegation (Agent-to-Agent, ERC-7710).
 *
 * The Transfer Agent wallet submits redeemDelegations() on-chain
 * with the chained context [sub-delegation, parent-delegation].
 *
 * Safety guarantees:
 * - Wallet isolation via compound sub-delegation key (walletAddress_scheduleId)
 * - Execution locking (status: 'executing') prevents double-execution
 * - Per-schedule error isolation
 * - Expiration and max-execution enforcement
 */

import { ethers } from 'ethers';

const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';
const SUBDELEGATION_COLLECTION = 'SubDelegations';

const DELEGATION_MANAGER_ABI = [
  'function redeemDelegations(bytes[] delegations, bytes32[] modes, bytes[] executions) returns (bool)'
];

const EXECUTION_MODE_SINGLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

const RPC_URLS = {
  8453: process.env.BASE_RPC_URL || 'https://base.publicnode.com',
  11155111: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
  1: process.env.MAINNET_RPC_URL || 'https://ethereum.publicnode.com',
  84532: process.env.BASE_SEPOLIA_RPC_URL || 'https://sepolia.base.org'
};

// Token addresses per chain for ERC-20 execution
const CHAIN_TOKENS = {
  11155111: {
    USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0',
    DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D5741'
  },
  8453: {
    USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    USDT: '0xfde4C96c8593536e31F229EA8f37b2ADa2699bb2',
    DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb'
  }
};

const EXPLORERS = {
  11155111: 'https://sepolia.etherscan.io',
  8453: 'https://basescan.org',
  1: 'https://etherscan.io',
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

function getTokenAddress(token, chainId) {
  const chainTokens = CHAIN_TOKENS[chainId];
  if (!chainTokens) return null;
  return chainTokens[token.toUpperCase()] || null;
}

function getTokenDecimals(token) {
  const upper = token.toUpperCase();
  if (upper === 'USDC' || upper === 'USDT') return 6;
  if (upper === 'WBTC') return 8;
  return 18;
}

function encodeExecution(target, value, callData) {
  return ethers.solidityPacked(
    ['address', 'uint256', 'bytes'],
    [target, value, callData || '0x']
  );
}

/**
 * Execute a single recurring transfer schedule on-chain.
 */
async function executeRecurringTransfer(firestore, schedule) {
  const { scheduleId, walletAddress, recipient, token, amount, chainId } = schedule;

  const agentKey = process.env.TRANSFER_AGENT_PRIVATE_KEY;
  if (!agentKey) {
    throw new Error('TRANSFER_AGENT_PRIVATE_KEY not configured');
  }

  // Fetch sub-delegation (keyed by walletAddress_scheduleId for isolation)
  const subDelDoc = await firestore.collection(SUBDELEGATION_COLLECTION)
    .doc(`${walletAddress.toLowerCase()}_${scheduleId}`)
    .get();

  if (!subDelDoc.exists) {
    throw new Error('Sub-delegation not found');
  }

  const subDel = subDelDoc.data();
  if (!subDel.chainedPermissionsContext) {
    throw new Error('No chained permissions context in sub-delegation');
  }

  const rpcUrl = RPC_URLS[chainId] || RPC_URLS[8453];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const agentWallet = new ethers.Wallet(agentKey, provider);

  // Build execution calldata
  const isNative = !token || token.toUpperCase() === 'ETH';
  let execution;

  if (isNative) {
    const valueWei = ethers.parseEther(amount);
    execution = encodeExecution(recipient, valueWei, '0x');
  } else {
    // ERC-20 transfer
    const tokenAddress = schedule.tokenAddress || getTokenAddress(token, chainId);
    if (!tokenAddress) {
      throw new Error(`Token ${token} address not found on chain ${chainId}`);
    }
    const decimals = getTokenDecimals(token);
    const amountUnits = ethers.parseUnits(amount, decimals);
    const iface = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    const calldata = iface.encodeFunctionData('transfer', [recipient, amountUnits]);
    execution = encodeExecution(tokenAddress, 0n, calldata);
  }

  // Submit via DelegationManager with chained delegation context
  const delegationManager = new ethers.Contract(
    subDel.delegationManager,
    DELEGATION_MANAGER_ABI,
    agentWallet
  );

  const tx = await delegationManager.redeemDelegations(
    [subDel.chainedPermissionsContext],
    [EXECUTION_MODE_SINGLE],
    [execution]
  );

  console.log(`[Transfer Agent] TX sent: ${tx.hash} for ${scheduleId}`);
  const receipt = await tx.wait();

  return {
    success: true,
    txHash: tx.hash,
    gasUsed: receipt.gasUsed.toString(),
    agentAddress: agentWallet.address
  };
}

/**
 * Main transfer agent job. Called by worker scheduler.
 *
 * Queries all due active schedules across all wallets, processes each
 * with per-schedule error isolation and execution locking.
 */
export async function runTransferAgent(firestore) {
  console.log('[Transfer Agent] Starting scheduled run...');

  const agentKey = process.env.TRANSFER_AGENT_PRIVATE_KEY;
  if (!agentKey) {
    console.warn('[Transfer Agent] TRANSFER_AGENT_PRIVATE_KEY not set, skipping');
    return { skipped: true, reason: 'No agent key configured' };
  }

  const now = Date.now();
  const results = [];

  try {
    // Query due active schedules (Firestore Timestamp comparison)
    const dueSchedules = await firestore.collection(TRANSFER_SCHEDULE_COLLECTION)
      .where('status', '==', 'active')
      .where('nextRunAt', '<=', new Date(now))
      .limit(50)
      .get();

    console.log(`[Transfer Agent] Found ${dueSchedules.size} schedule(s) due`);

    if (dueSchedules.size === 0) {
      return { success: true, processed: 0, results: [] };
    }

    for (const doc of dueSchedules.docs) {
      const schedule = doc.data();
      const sid = schedule.scheduleId;

      try {
        // Check expiration
        if (schedule.expiresAt && schedule.expiresAt < Math.floor(now / 1000)) {
          console.log(`[Transfer Agent] ${sid}: expired, marking completed`);
          await doc.ref.update({
            status: 'completed',
            updatedAt: now
          });
          results.push({ scheduleId: sid, success: false, reason: 'expired' });
          continue;
        }

        // Check max executions
        if (schedule.maxExecutions && (schedule.executionCount || 0) >= schedule.maxExecutions) {
          console.log(`[Transfer Agent] ${sid}: max executions reached, marking completed`);
          await doc.ref.update({
            status: 'completed',
            updatedAt: now
          });
          results.push({ scheduleId: sid, success: false, reason: 'max_executions' });
          continue;
        }

        // Execution lock: set status to 'executing' to prevent concurrent runs
        await doc.ref.update({ status: 'executing', updatedAt: now });

        const result = await executeRecurringTransfer(firestore, schedule);

        // Update schedule state on success
        const newCount = (schedule.executionCount || 0) + 1;
        const shouldComplete = schedule.maxExecutions && newCount >= schedule.maxExecutions;
        const nextRun = calculateNextRun(schedule.frequency);

        const executionRecord = {
          success: true,
          txHash: result.txHash,
          gasUsed: result.gasUsed,
          executedAt: new Date().toISOString(),
          executionNumber: newCount
        };

        const chainId = schedule.chainId || 11155111;
        const explorer = EXPLORERS[chainId] || EXPLORERS[11155111];

        await doc.ref.update({
          executionCount: newCount,
          lastExecutionAt: now,
          lastExecutionResult: executionRecord,
          nextRunAt: shouldComplete ? null : nextRun,
          status: shouldComplete ? 'completed' : 'active',
          executionHistory: appendToArray(schedule.executionHistory, executionRecord),
          updatedAt: now
        });

        console.log(`[Transfer Agent] ${sid}: executed (run #${newCount}), tx: ${result.txHash}`);

        results.push({
          scheduleId: sid,
          success: true,
          txHash: result.txHash,
          explorerUrl: `${explorer}/tx/${result.txHash}`,
          executionNumber: newCount,
          nextRun: shouldComplete ? null : nextRun.toISOString()
        });

      } catch (error) {
        console.error(`[Transfer Agent] ${sid}: execution failed:`, error.message);

        const executionRecord = {
          success: false,
          error: error.message,
          executedAt: new Date().toISOString()
        };

        // Revert status back to active so it can retry next cycle
        try {
          await doc.ref.update({
            status: 'active',
            lastExecutionResult: executionRecord,
            executionHistory: appendToArray(
              (schedule.executionHistory || []),
              executionRecord
            ),
            updatedAt: now
          });
        } catch (updateErr) {
          console.error(`[Transfer Agent] ${sid}: failed to update after error:`, updateErr.message);
        }

        results.push({ scheduleId: sid, success: false, error: error.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`[Transfer Agent] Completed. ${succeeded} succeeded, ${failed} failed out of ${results.length}`);

    return { success: true, processed: results.length, succeeded, failed, results };

  } catch (error) {
    console.error('[Transfer Agent] Job error:', error);
    throw error;
  }
}

/**
 * Append to array without Firestore FieldValue (worker uses @google-cloud/firestore directly).
 */
function appendToArray(existingArray, newItem) {
  const arr = Array.isArray(existingArray) ? [...existingArray] : [];
  arr.push(newItem);
  return arr;
}
