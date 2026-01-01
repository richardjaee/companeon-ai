/**
 * gas.js - Gas price and estimation tools
 * 
 * Provides tools for:
 * - Checking current gas prices with speed tiers
 * - Estimating gas costs for specific transaction types
 * - Helping users choose optimal gas settings
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';

// Gas speed tiers with multipliers (no emojis per user preference)
export const GAS_TIERS = {
  slow: {
    name: 'Slow',
    priorityMultiplier: 0.8,
    description: 'Cheapest, may take 1-5 minutes',
    confirmationTime: '1-5 min'
  },
  standard: {
    name: 'Standard',
    priorityMultiplier: 1.0,
    description: 'Balanced price and speed',
    confirmationTime: '30s-1 min'
  },
  fast: {
    name: 'Fast',
    priorityMultiplier: 1.5,
    description: 'Fastest confirmation',
    confirmationTime: '<30s'
  }
};

// Typical gas limits for different transaction types
export const GAS_LIMITS = {
  ethTransfer: 21000n,
  erc20Transfer: 65000n,
  erc20Approve: 50000n,
  swapSimple: 150000n,
  swapComplex: 300000n,
  delegationRedeem: 200000n,
  x402Payment: 100000n
};

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

/**
 * Get current fee data from the network
 */
export async function getFeeData(chainId = null) {
  const provider = getProvider(chainId);
  const feeData = await provider.getFeeData();
  
  return {
    gasPrice: feeData.gasPrice,
    maxFeePerGas: feeData.maxFeePerGas,
    maxPriorityFeePerGas: feeData.maxPriorityFeePerGas,
    // For EIP-1559 chains
    baseFee: feeData.maxFeePerGas && feeData.maxPriorityFeePerGas
      ? feeData.maxFeePerGas - feeData.maxPriorityFeePerGas
      : null
  };
}

/**
 * Format gas price in human-readable units
 */
function formatGasPrice(weiValue) {
  if (!weiValue) return 'unknown';
  
  const gwei = Number(ethers.formatUnits(weiValue, 'gwei'));
  
  if (gwei < 0.001) {
    return `${(gwei * 1000000).toFixed(2)} microGwei`;
  } else if (gwei < 1) {
    return `${gwei.toFixed(4)} gwei`;
  } else if (gwei < 100) {
    return `${gwei.toFixed(2)} gwei`;
  } else {
    return `${gwei.toFixed(0)} gwei`;
  }
}

/**
 * Calculate gas cost in ETH and USD
 */
export async function calculateGasCost(gasLimit, gasPrice, chainId = null, ethPriceUsd = null) {
  const gasCostWei = BigInt(gasLimit) * BigInt(gasPrice);
  const gasCostEth = ethers.formatEther(gasCostWei);
  
  // Get ETH price if not provided
  let usdCost = null;
  if (ethPriceUsd) {
    usdCost = Number(gasCostEth) * ethPriceUsd;
  } else {
    // Try to get ETH price from CMC
    try {
      const apiKey = process.env.CMC_API_KEY;
      if (apiKey) {
        const response = await fetch(
          'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH&convert=USD',
          { headers: { 'X-CMC_PRO_API_KEY': apiKey }, timeout: 5000 }
        );
        const data = await response.json();
        ethPriceUsd = data?.data?.ETH?.quote?.USD?.price;
        if (ethPriceUsd) {
          usdCost = Number(gasCostEth) * ethPriceUsd;
        }
      }
    } catch (e) {
      // Ignore price fetch errors
    }
  }
  
  return {
    gasLimit: gasLimit.toString(),
    gasPriceWei: gasPrice.toString(),
    gasPriceFormatted: formatGasPrice(gasPrice),
    gasCostWei: gasCostWei.toString(),
    gasCostEth: gasCostEth,
    gasCostEthFormatted: Number(gasCostEth) < 0.0001 
      ? `<0.0001 ETH` 
      : `${Number(gasCostEth).toFixed(6)} ETH`,
    usdCost: usdCost ? usdCost.toFixed(4) : null,
    usdCostFormatted: usdCost 
      ? (usdCost < 0.01 ? '<$0.01' : `$${usdCost.toFixed(2)}`)
      : null
  };
}

/**
 * Get gas prices for all tiers
 */
export async function getGasPricesForTiers(chainId = null) {
  const feeData = await getFeeData(chainId);
  const config = getChainConfig(chainId);
  
  const basePriority = feeData.maxPriorityFeePerGas || feeData.gasPrice || 1000000000n; // 1 gwei default
  const baseFee = feeData.baseFee || 0n;
  
  const tiers = {};
  
  for (const [tierKey, tierInfo] of Object.entries(GAS_TIERS)) {
    const priorityFee = BigInt(Math.floor(Number(basePriority) * tierInfo.priorityMultiplier));
    const totalGasPrice = baseFee + priorityFee;
    
    tiers[tierKey] = {
      ...tierInfo,
      priorityFeeWei: priorityFee.toString(),
      priorityFeeFormatted: formatGasPrice(priorityFee),
      totalGasPriceWei: totalGasPrice.toString(),
      totalGasPriceFormatted: formatGasPrice(totalGasPrice)
    };
  }
  
  return {
    chain: config.name,
    chainId: config.chainId,
    baseFeeWei: baseFee.toString(),
    baseFeeFormatted: formatGasPrice(baseFee),
    tiers,
    timestamp: new Date().toISOString()
  };
}

/**
 * Estimate gas cost for a transaction type at all tiers
 */
export async function estimateGasForTransaction(txType, chainId = null, ethPriceUsd = null) {
  const gasLimit = GAS_LIMITS[txType] || GAS_LIMITS.swapSimple;
  const tierPrices = await getGasPricesForTiers(chainId);
  
  const estimates = {};
  
  for (const [tierKey, tierInfo] of Object.entries(tierPrices.tiers)) {
    const cost = await calculateGasCost(
      gasLimit, 
      BigInt(tierInfo.totalGasPriceWei),
      chainId,
      ethPriceUsd
    );
    
    estimates[tierKey] = {
      tier: tierKey,
      tierName: tierInfo.name,
      confirmationTime: tierInfo.confirmationTime,
      ...cost
    };
  }
  
  return {
    txType,
    gasLimit: gasLimit.toString(),
    chain: tierPrices.chain,
    estimates,
    recommended: 'standard',
    timestamp: tierPrices.timestamp
  };
}

/**
 * Get the gas price for a specific tier
 */
export async function getGasPriceForTier(tier = 'standard', chainId = null) {
  const tierPrices = await getGasPricesForTiers(chainId);
  const tierData = tierPrices.tiers[tier] || tierPrices.tiers.standard;
  
  return {
    tier,
    maxPriorityFeePerGas: BigInt(tierData.priorityFeeWei),
    maxFeePerGas: BigInt(tierData.totalGasPriceWei) * 2n, // 2x buffer for fee spikes
    gasPrice: BigInt(tierData.totalGasPriceWei)
  };
}

// Tools for the agent
export const gasTools = [
  {
    name: 'get_gas_price',
    description: `Get current gas prices with speed tiers (slow, standard, fast).
    
Shows:
- Current base fee on the network
- Priority fees for each speed tier
- Estimated confirmation times
- Example costs for common transactions

Use this when user asks about gas prices or before showing transaction quotes.`,
    parameters: z.object({
      showExamples: z.boolean().default(true)
        .describe('Include example costs for transfers and swaps')
    }),
    tags: ['free', 'read', 'gas'],
    handler: async ({ showExamples = true }, context) => {
      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      
      const tierPrices = await getGasPricesForTiers(chainId);
      
      // Get ETH price for USD estimates
      let ethPriceUsd = null;
      try {
        const apiKey = process.env.CMC_API_KEY;
        if (apiKey) {
          const response = await fetch(
            'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH&convert=USD',
            { headers: { 'X-CMC_PRO_API_KEY': apiKey } }
          );
          const data = await response.json();
          ethPriceUsd = data?.data?.ETH?.quote?.USD?.price;
        }
      } catch (e) {
        // Ignore
      }
      
      const result = {
        chain: tierPrices.chain,
        chainId: tierPrices.chainId,
        baseFee: tierPrices.baseFeeFormatted,
        tiers: {}
      };
      
      // Format each tier
      for (const [tierKey, tierInfo] of Object.entries(tierPrices.tiers)) {
        result.tiers[tierKey] = {
          name: tierInfo.name,
          priorityFee: tierInfo.priorityFeeFormatted,
          totalGasPrice: tierInfo.totalGasPriceFormatted,
          confirmationTime: tierInfo.confirmationTime,
          description: tierInfo.description
        };
      }
      
      // Add example costs if requested
      if (showExamples) {
        result.examples = {};
        
        const txTypes = [
          { key: 'ethTransfer', name: 'ETH Transfer' },
          { key: 'erc20Transfer', name: 'Token Transfer' },
          { key: 'swapSimple', name: 'Simple Swap' }
        ];
        
        for (const txType of txTypes) {
          const estimates = await estimateGasForTransaction(txType.key, chainId, ethPriceUsd);
          result.examples[txType.name] = {
            gasLimit: estimates.gasLimit,
            costs: {
              slow: estimates.estimates.slow.usdCostFormatted || estimates.estimates.slow.gasCostEthFormatted,
              standard: estimates.estimates.standard.usdCostFormatted || estimates.estimates.standard.gasCostEthFormatted,
              fast: estimates.estimates.fast.usdCostFormatted || estimates.estimates.fast.gasCostEthFormatted
            }
          };
        }
      }
      
      // Add summary message
      const standardTier = tierPrices.tiers.standard;
      result.summary = `Gas on ${tierPrices.chain}: Base ${tierPrices.baseFeeFormatted} + ${standardTier.priorityFeeFormatted} priority (standard)`;
      
      return result;
    }
  },
  
  {
    name: 'estimate_gas_cost',
    description: `Estimate gas cost for a specific transaction type.
    
Transaction types:
- ethTransfer: Simple ETH transfer (~21,000 gas)
- erc20Transfer: Token transfer (~65,000 gas)
- swapSimple: Basic swap (~150,000 gas)
- swapComplex: Multi-hop swap (~300,000 gas)
- x402Payment: x402 protocol payment (~100,000 gas)

Returns cost estimates for all speed tiers.`,
    parameters: z.object({
      txType: z.enum(['ethTransfer', 'erc20Transfer', 'swapSimple', 'swapComplex', 'x402Payment'])
        .describe('Type of transaction to estimate'),
      tier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Which speed tier to highlight')
    }),
    tags: ['free', 'read', 'gas'],
    handler: async ({ txType, tier = 'standard' }, context) => {
      const chainId = context?.chainId;
      const estimates = await estimateGasForTransaction(txType, chainId);
      
      const selectedTier = estimates.estimates[tier];
      
      return {
        txType,
        gasLimit: estimates.gasLimit,
        chain: estimates.chain,
        
        // Highlighted tier
        recommended: {
          tier: selectedTier.tierName,
          gasCostEth: selectedTier.gasCostEthFormatted,
          gasCostUsd: selectedTier.usdCostFormatted || 'price unavailable',
          confirmationTime: selectedTier.confirmationTime
        },
        
        // All tiers for comparison
        allTiers: Object.values(estimates.estimates).map(e => ({
          tier: e.tierName,
          costEth: e.gasCostEthFormatted,
          costUsd: e.usdCostFormatted || null,
          time: e.confirmationTime
        })),
        
        summary: `${txType} on ${estimates.chain}: ~${selectedTier.usdCostFormatted || selectedTier.gasCostEthFormatted} (${selectedTier.tierName})`
      };
    }
  }
];

/**
 * Helper to format gas info for inclusion in transaction outputs
 * Call this from swap/transfer tools to include gas estimates
 */
export async function formatGasForOutput(txType, tier = 'standard', chainId = null) {
  try {
    const estimates = await estimateGasForTransaction(txType, chainId);
    const selectedTier = estimates.estimates[tier];
    
    return {
      gasLimit: estimates.gasLimit,
      gasTier: tier,
      gasTierName: selectedTier.tierName,
      gasCostEth: selectedTier.gasCostEthFormatted,
      gasCostUsd: selectedTier.usdCostFormatted,
      confirmationTime: selectedTier.confirmationTime,
      formatted: selectedTier.usdCostFormatted 
        ? `${selectedTier.usdCostFormatted} (${selectedTier.tierName}, ${selectedTier.confirmationTime})`
        : `${selectedTier.gasCostEthFormatted} (${selectedTier.tierName})`,
      
      // Include all tiers for user to choose
      allTiers: {
        slow: {
          costEth: estimates.estimates.slow.gasCostEthFormatted,
          costUsd: estimates.estimates.slow.usdCostFormatted,
          time: estimates.estimates.slow.confirmationTime
        },
        standard: {
          costEth: estimates.estimates.standard.gasCostEthFormatted,
          costUsd: estimates.estimates.standard.usdCostFormatted,
          time: estimates.estimates.standard.confirmationTime
        },
        fast: {
          costEth: estimates.estimates.fast.gasCostEthFormatted,
          costUsd: estimates.estimates.fast.usdCostFormatted,
          time: estimates.estimates.fast.confirmationTime
        }
      }
    };
  } catch (e) {
    // Return minimal info on error
    return {
      gasLimit: GAS_LIMITS[txType]?.toString() || '200000',
      gasTier: tier,
      formatted: 'Gas estimate unavailable',
      error: e.message
    };
  }
}

/**
 * Apply gas tier settings to a transaction
 */
export async function applyGasTierToTx(tx, tier = 'standard', chainId = null) {
  const gasSettings = await getGasPriceForTier(tier, chainId);
  
  return {
    ...tx,
    maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
    maxFeePerGas: gasSettings.maxFeePerGas
  };
}

