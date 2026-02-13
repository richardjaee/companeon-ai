/**
 * Rebalancing Agent Job
 *
 * Background worker that checks portfolio allocations and executes
 * swaps to maintain target percentages via delegation + 0x API.
 *
 * Flow per schedule:
 * 1. Check balances (ETH via provider.getBalance, ERC-20 via balanceOf)
 * 2. Get USD prices via CMC API
 * 3. Calculate current allocations vs targets
 * 4. If any token deviates beyond threshold, calculate and execute swaps
 * 5. Update schedule state
 */

import { ethers } from 'ethers';

const REBALANCING_COLLECTION = 'RebalancingSchedules';
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
 * Fetch USD prices for a list of token symbols from CoinMarketCap.
 */
async function fetchPrices(symbols) {
  const cmcKey = process.env.CMC_API_KEY;
  if (!cmcKey) throw new Error('CMC_API_KEY not configured');

  const response = await fetch(
    `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbols.join(',')}&convert=USD`,
    { headers: { 'X-CMC_PRO_API_KEY': cmcKey } }
  );

  if (!response.ok) {
    throw new Error(`CMC API error: ${response.status}`);
  }

  const json = await response.json();
  const prices = {};

  for (const sym of symbols) {
    const data = json.data?.[sym];
    if (data) {
      const quote = Array.isArray(data) ? data[0]?.quote?.USD : data.quote?.USD;
      if (quote) {
        prices[sym] = quote.price;
      }
    }
  }

  return prices;
}

/**
 * Get token balances for a wallet address.
 */
async function getBalances(walletAddress, tokens, chainId, provider) {
  const balances = {};
  const erc20Abi = ['function balanceOf(address) view returns (uint256)'];

  for (const symbol of tokens) {
    const upper = symbol.toUpperCase();
    const resolved = resolveToken(upper, chainId);
    if (!resolved) {
      console.warn(`[Rebalancing] Token ${upper} not found on chain ${chainId}`);
      continue;
    }

    try {
      if (upper === 'ETH') {
        const balance = await provider.getBalance(walletAddress);
        balances[upper] = {
          raw: balance,
          formatted: parseFloat(ethers.formatEther(balance)),
          decimals: 18,
          address: NATIVE_TOKEN_ADDRESS
        };
      } else {
        const contract = new ethers.Contract(resolved.address, erc20Abi, provider);
        const balance = await contract.balanceOf(walletAddress);
        balances[upper] = {
          raw: balance,
          formatted: parseFloat(ethers.formatUnits(balance, resolved.decimals)),
          decimals: resolved.decimals,
          address: resolved.address
        };
      }
    } catch (err) {
      console.error(`[Rebalancing] Failed to get balance for ${upper}:`, err.message);
    }
  }

  return balances;
}

/**
 * Calculate swaps needed to rebalance from current allocations to targets.
 * Returns an array of { sellToken, buyToken, sellAmount, sellAmountWei } objects.
 */
function calculateSwaps(balances, prices, targetAllocations) {
  // Calculate total portfolio value
  let totalValueUsd = 0;
  const tokenValues = {};

  for (const [symbol, balance] of Object.entries(balances)) {
    const price = prices[symbol] || 0;
    const value = balance.formatted * price;
    tokenValues[symbol] = value;
    totalValueUsd += value;
  }

  if (totalValueUsd === 0) return [];

  // Calculate deviations
  const deviations = {};
  for (const [symbol, targetPct] of Object.entries(targetAllocations)) {
    const currentValue = tokenValues[symbol] || 0;
    const currentPct = (currentValue / totalValueUsd) * 100;
    deviations[symbol] = {
      currentPct,
      targetPct,
      deviationPct: currentPct - targetPct,
      targetValueUsd: (targetPct / 100) * totalValueUsd,
      currentValueUsd: currentValue,
      diffUsd: currentValue - ((targetPct / 100) * totalValueUsd)
    };
  }

  // Sort: most overweight first (sell), most underweight last (buy)
  const sorted = Object.entries(deviations)
    .sort(([, a], [, b]) => b.diffUsd - a.diffUsd);

  const swaps = [];
  let sellIdx = 0;
  let buyIdx = sorted.length - 1;

  // Track remaining sell/buy amounts
  const remaining = {};
  for (const [symbol, dev] of sorted) {
    remaining[symbol] = dev.diffUsd;
  }

  // Match overweight tokens with underweight tokens
  while (sellIdx < buyIdx) {
    const [sellSymbol] = sorted[sellIdx];
    const [buySymbol] = sorted[buyIdx];

    const sellRemaining = remaining[sellSymbol];
    const buyRemaining = -remaining[buySymbol];

    if (sellRemaining <= 0) { sellIdx++; continue; }
    if (buyRemaining <= 0) { buyIdx--; continue; }

    const swapValueUsd = Math.min(sellRemaining, buyRemaining);
    if (swapValueUsd < 0.01) { sellIdx++; continue; } // Skip dust

    const sellPrice = prices[sellSymbol] || 1;
    const sellAmount = swapValueUsd / sellPrice;
    const sellBalance = balances[sellSymbol];

    if (sellBalance) {
      swaps.push({
        sellToken: sellSymbol,
        buyToken: buySymbol,
        sellAmount: sellAmount.toFixed(sellBalance.decimals > 8 ? 8 : sellBalance.decimals),
        sellAmountWei: ethers.parseUnits(
          sellAmount.toFixed(sellBalance.decimals > 8 ? 8 : sellBalance.decimals),
          sellBalance.decimals
        ).toString(),
        sellAddress: sellBalance.address,
        buyAddress: (balances[buySymbol]?.address) || null,
        valueUsd: swapValueUsd
      });
    }

    remaining[sellSymbol] -= swapValueUsd;
    remaining[buySymbol] += swapValueUsd;

    if (remaining[sellSymbol] <= 0.01) sellIdx++;
    if (-remaining[buySymbol] <= 0.01) buyIdx--;
  }

  return swaps;
}

/**
 * Execute a single rebalancing schedule.
 */
async function executeRebalancing(firestore, schedule) {
  const { scheduleId, walletAddress, targetAllocations, chainId, slippageBps = 100, thresholdPercent = 5 } = schedule;

  const agentKey = process.env.BACKEND_SUBDELEGATION_KEY;
  if (!agentKey) throw new Error('BACKEND_SUBDELEGATION_KEY not configured');

  const rpcUrl = RPC_URLS[chainId] || RPC_URLS[8453];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const agentWallet = new ethers.Wallet(agentKey, provider);

  const tokens = Object.keys(targetAllocations);

  // Get current balances
  const balances = await getBalances(walletAddress, tokens, chainId, provider);
  if (Object.keys(balances).length === 0) {
    return { success: true, skipped: true, reason: 'no_balances' };
  }

  // Fetch USD prices
  const prices = await fetchPrices(tokens);
  if (Object.keys(prices).length === 0) {
    throw new Error('Failed to fetch prices for portfolio tokens');
  }

  // Check if any token deviates beyond threshold
  let totalValueUsd = 0;
  for (const symbol of tokens) {
    const balance = balances[symbol];
    const price = prices[symbol] || 0;
    if (balance) totalValueUsd += balance.formatted * price;
  }

  if (totalValueUsd === 0) {
    return { success: true, skipped: true, reason: 'zero_portfolio_value' };
  }

  let maxDeviation = 0;
  for (const [symbol, targetPct] of Object.entries(targetAllocations)) {
    const balance = balances[symbol];
    const price = prices[symbol] || 0;
    const currentPct = balance ? (balance.formatted * price / totalValueUsd) * 100 : 0;
    const deviation = Math.abs(currentPct - targetPct);
    if (deviation > maxDeviation) maxDeviation = deviation;
  }

  if (maxDeviation < thresholdPercent) {
    console.log(`[Rebalancing] ${scheduleId}: portfolio within bounds (max deviation: ${maxDeviation.toFixed(2)}%)`);
    return { success: true, skipped: true, reason: 'within_threshold', maxDeviation };
  }

  // Calculate required swaps
  const swaps = calculateSwaps(balances, prices, targetAllocations);
  if (swaps.length === 0) {
    return { success: true, skipped: true, reason: 'no_swaps_needed' };
  }

  console.log(`[Rebalancing] ${scheduleId}: executing ${swaps.length} swap(s), max deviation: ${maxDeviation.toFixed(2)}%`);

  const executedSwaps = [];

  for (const swap of swaps) {
    const sellSymbol = swap.sellToken;

    // Fetch sub-delegation for the sell token
    const subDelDoc = await firestore.collection(SUBDELEGATION_COLLECTION)
      .doc(`${walletAddress.toLowerCase()}_${scheduleId}_${sellSymbol}`)
      .get();

    if (!subDelDoc.exists) {
      console.error(`[Rebalancing] ${scheduleId}: no sub-delegation for ${sellSymbol}`);
      continue;
    }

    const subDel = subDelDoc.data();
    if (!subDel.chainedPermissionsContext) {
      console.error(`[Rebalancing] ${scheduleId}: no chained context for ${sellSymbol}`);
      continue;
    }

    const delegationManager = new ethers.Contract(
      subDel.delegationManager,
      DELEGATION_MANAGER_ABI,
      agentWallet
    );

    // Resolve token addresses for 0x
    const sellResolved = resolveToken(sellSymbol, chainId);
    const buyResolved = resolveToken(swap.buyToken, chainId);
    if (!sellResolved || !buyResolved) {
      console.error(`[Rebalancing] ${scheduleId}: can't resolve ${sellSymbol} or ${swap.buyToken}`);
      continue;
    }

    try {
      // Fetch 0x quote
      let quote = await fetch0xQuote(
        chainId,
        sellResolved.address,
        buyResolved.address,
        swap.sellAmountWei,
        walletAddress,
        slippageBps
      );

      // Handle ERC-20 approval if needed
      const isNative = sellSymbol === 'ETH';
      if (!isNative && quote.issues?.allowance) {
        console.log(`[Rebalancing] ${scheduleId}: approving ${sellSymbol} for swap`);

        const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
        const approveData = iface.encodeFunctionData('approve', [
          quote.issues.allowance.spender,
          ethers.MaxUint256
        ]);
        const approveExecution = encodeExecution(sellResolved.address, 0n, approveData);

        const approveTx = await delegationManager.redeemDelegations(
          [subDel.chainedPermissionsContext],
          [EXECUTION_MODE_SINGLE],
          [approveExecution]
        );
        await approveTx.wait();
        console.log(`[Rebalancing] ${scheduleId}: approval confirmed for ${sellSymbol}`);

        // Re-fetch quote with fresh pricing
        quote = await fetch0xQuote(
          chainId,
          sellResolved.address,
          buyResolved.address,
          swap.sellAmountWei,
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

      const receipt = await tx.wait();
      console.log(`[Rebalancing] ${scheduleId}: swapped ${swap.sellAmount} ${sellSymbol} -> ${swap.buyToken}, tx: ${tx.hash}`);

      executedSwaps.push({
        sellToken: sellSymbol,
        buyToken: swap.buyToken,
        sellAmount: swap.sellAmount,
        valueUsd: swap.valueUsd,
        txHash: tx.hash,
        gasUsed: receipt.gasUsed.toString()
      });

    } catch (swapErr) {
      console.error(`[Rebalancing] ${scheduleId}: swap ${sellSymbol}->${swap.buyToken} failed:`, swapErr.message);
      executedSwaps.push({
        sellToken: sellSymbol,
        buyToken: swap.buyToken,
        sellAmount: swap.sellAmount,
        error: swapErr.message
      });
    }
  }

  return {
    success: executedSwaps.some(s => s.txHash),
    maxDeviation,
    totalValueUsd,
    swaps: executedSwaps,
    agentAddress: agentWallet.address
  };
}

/**
 * Main rebalancing agent job. Called by worker scheduler.
 */
export async function runRebalancingAgent(firestore) {
  console.log('[Rebalancing] Starting scheduled run...');

  const agentKey = process.env.BACKEND_SUBDELEGATION_KEY;
  if (!agentKey) {
    console.warn('[Rebalancing] BACKEND_SUBDELEGATION_KEY not set, skipping');
    return { skipped: true, reason: 'No agent key configured' };
  }

  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    console.warn('[Rebalancing] ZEROX_API_KEY not set, skipping');
    return { skipped: true, reason: 'No 0x API key configured' };
  }

  const cmcKey = process.env.CMC_API_KEY;
  if (!cmcKey) {
    console.warn('[Rebalancing] CMC_API_KEY not set, skipping');
    return { skipped: true, reason: 'No CMC API key configured' };
  }

  const now = Date.now();
  const results = [];

  try {
    const dueSchedules = await firestore.collection(REBALANCING_COLLECTION)
      .where('status', '==', 'active')
      .where('nextRunAt', '<=', new Date(now))
      .limit(50)
      .get();

    console.log(`[Rebalancing] Found ${dueSchedules.size} schedule(s) due`);

    if (dueSchedules.size === 0) {
      return { success: true, processed: 0, results: [] };
    }

    for (const doc of dueSchedules.docs) {
      const schedule = doc.data();
      const sid = schedule.scheduleId;

      try {
        // Check expiration
        if (schedule.expiresAt && schedule.expiresAt < Math.floor(now / 1000)) {
          console.log(`[Rebalancing] ${sid}: expired, marking completed`);
          await doc.ref.update({ status: 'completed', updatedAt: now });
          results.push({ scheduleId: sid, success: false, reason: 'expired' });
          continue;
        }

        // Check max executions
        if (schedule.maxExecutions && (schedule.executionCount || 0) >= schedule.maxExecutions) {
          console.log(`[Rebalancing] ${sid}: max executions reached, marking completed`);
          await doc.ref.update({ status: 'completed', updatedAt: now });
          results.push({ scheduleId: sid, success: false, reason: 'max_executions' });
          continue;
        }

        // Execution lock
        await doc.ref.update({ status: 'executing', updatedAt: now });

        const result = await executeRebalancing(firestore, schedule);

        // Update schedule on completion
        const newCount = result.skipped ? (schedule.executionCount || 0) : (schedule.executionCount || 0) + 1;
        const shouldComplete = schedule.maxExecutions && newCount >= schedule.maxExecutions;
        const nextRun = calculateNextRun(schedule.frequency);

        const executionRecord = {
          success: result.success,
          skipped: result.skipped || false,
          reason: result.reason || null,
          maxDeviation: result.maxDeviation || null,
          swaps: result.swaps || [],
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

        if (result.skipped) {
          console.log(`[Rebalancing] ${sid}: skipped (${result.reason})`);
        } else {
          const swapCount = (result.swaps || []).filter(s => s.txHash).length;
          console.log(`[Rebalancing] ${sid}: executed ${swapCount} swap(s)`);
        }

        results.push({
          scheduleId: sid,
          success: result.success,
          skipped: result.skipped,
          reason: result.reason,
          swaps: (result.swaps || []).map(s => ({
            ...s,
            explorerUrl: s.txHash ? `${explorer}/tx/${s.txHash}` : null
          })),
          nextRun: shouldComplete ? null : nextRun.toISOString()
        });

      } catch (error) {
        console.error(`[Rebalancing] ${sid}: execution failed:`, error.message);

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
          console.error(`[Rebalancing] ${sid}: failed to update after error:`, updateErr.message);
        }

        results.push({ scheduleId: sid, success: false, error: error.message });
      }
    }

    const succeeded = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    console.log(`[Rebalancing] Completed. ${succeeded} succeeded, ${failed} failed out of ${results.length}`);

    return { success: true, processed: results.length, succeeded, failed, results };

  } catch (error) {
    console.error('[Rebalancing] Job error:', error);
    throw error;
  }
}

function appendToArray(existingArray, newItem) {
  const arr = Array.isArray(existingArray) ? [...existingArray] : [];
  arr.push(newItem);
  return arr;
}
