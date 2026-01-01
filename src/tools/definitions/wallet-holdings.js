/**
 * wallet-holdings.js - Tools for reading wallet holdings directly
 *
 * Direct wallet automation via ERC-7715 delegation
 * - Query the user's wallet directly via RPC
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import axios from 'axios';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';

// ERC20 ABI for balance queries
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
];

// Get provider for current chain context
function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

/**
 * Format wei to human readable
 */
function formatUnits(value, decimals = 18) {
  return ethers.formatUnits(value, decimals);
}

/**
 * Get list of tokens to check for a given chain
 */
function getTokensToCheck(chainId = null) {
  const config = getChainConfig(chainId);
  const tokens = [];
  
  // Core tokens to always check
  const coreSymbols = ['USDC', 'WETH', 'DAI', 'USDT'];
  
  for (const symbol of coreSymbols) {
    if (config.tokens[symbol]) {
      tokens.push({
        symbol,
        address: config.tokens[symbol],
        decimals: symbol === 'USDC' || symbol === 'USDT' ? 6 : 18
      });
    }
  }
  
  return tokens;
}

/**
 * Fetch USD prices for tokens from CoinMarketCap
 */
async function fetchUsdPrices(symbols) {
  if (!symbols || symbols.length === 0) return {};
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) return {};

  const uniqueSymbols = [...new Set(symbols.map(s => s.toUpperCase()).filter(Boolean))];
  if (!uniqueSymbols.length) return {};

  try {
    const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
    const resp = await axios.get(url, {
      headers: { 'X-CMC_PRO_API_KEY': apiKey },
      params: {
        symbol: uniqueSymbols.join(','),
        convert: 'USD'
      },
      timeout: 10000
    });

    const data = resp.data?.data || {};
    const prices = {};
    for (const symbol of uniqueSymbols) {
      const quote = data[symbol]?.quote?.USD;
      if (quote?.price != null) {
        prices[symbol] = quote.price;
      }
    }
    return prices;
  } catch {
    return {};
  }
}

export const walletHoldingsTools = [
  {
    name: 'get_holdings',
    description: 'Get the current holdings (balances) of the connected wallet. Returns ETH balance and all token balances with their USD values.',
    parameters: z.object({
      walletAddress: z.string().optional().describe('Wallet address to check (defaults to connected wallet from context)')
    }),
    tags: ['free', 'read-only'],
    handler: async ({ walletAddress }, context) => {
      // Use provided address or fall back to context
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }
      
      const chainId = context?.chainId;
      const config = getChainConfig(chainId);
      const provider = getProvider(chainId);

      const holdings = [];

      // Get ETH balance
      const ethBalanceWei = await provider.getBalance(address);
      const ethFormatted = formatUnits(ethBalanceWei.toString(), 18);
      holdings.push({
        symbol: 'ETH',
        address: '0x0000000000000000000000000000000000000000',
        balance: ethBalanceWei.toString(),
        balanceFormatted: ethFormatted,
        decimals: 18
      });

      // Check token balances
      const tokensToCheck = getTokensToCheck(chainId);
      
      for (const token of tokensToCheck) {
        try {
          const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
          const balance = await contract.balanceOf(address);
          
          if (balance > 0n) {
            holdings.push({
              symbol: token.symbol,
              address: token.address,
              balance: balance.toString(),
              balanceFormatted: formatUnits(balance.toString(), token.decimals),
              decimals: token.decimals
            });
          }
        } catch (e) {
          // Skip tokens that fail (might not exist on this chain)
          context?.logger?.debug?.('token_balance_check_failed', { token: token.symbol, error: e.message });
        }
      }

      // Fetch USD prices
      const symbolsForPricing = holdings.map(h => h.symbol?.toUpperCase()).filter(Boolean);
      const usdPrices = await fetchUsdPrices(symbolsForPricing);

      let portfolioUsd = 0;
      for (const asset of holdings) {
        const symbol = asset.symbol?.toUpperCase();
        const price = symbol ? usdPrices[symbol] : null;
        if (price != null) {
          const balanceNum = Number(asset.balanceFormatted);
          if (!Number.isNaN(balanceNum)) {
            const usdValue = balanceNum * price;
            portfolioUsd += usdValue;
            asset.usdPrice = price;
            asset.usdValue = usdValue;
            asset.usdValueFormatted = usdValue.toFixed(2);
          }
        }
      }

      const response = {
        walletAddress: address,
        chain: config.name,
        chainId: config.chainId,
        holdings,
        portfolioUsd: portfolioUsd ? portfolioUsd.toFixed(2) : null
      };

      // Save to memory for context
      if (context?.remember) {
        context.remember('walletAddress', address);
        context.remember('lastHoldings', holdings);
        context.remember('lastHoldingsUpdatedAt', new Date().toISOString());
        if (portfolioUsd) {
          context.remember('lastHoldingsPortfolioUsd', portfolioUsd.toFixed(2));
        }
        // Create summary for quick reference
        const summary = holdings
          .slice(0, 3)
          .map(h => {
            const usdLine = h.usdValue != null ? ` (~$${Number(h.usdValue).toFixed(2)})` : '';
            return `${h.symbol || h.address}: ${h.balanceFormatted}${usdLine}`;
          })
          .join(', ');
        if (summary) {
          context.remember('lastHoldingsSummary', summary);
        }
      }

      return response;
    }
  },

  {
    name: 'get_token_balance',
    description: 'Get the balance of a specific token in the wallet. Use this for tokens not in the default check list.',
    parameters: z.object({
      tokenAddress: z.string().describe('The token contract address (0x...)'),
      walletAddress: z.string().optional().describe('Wallet address to check (defaults to connected wallet)')
    }),
    tags: ['free', 'read-only'],
    handler: async ({ tokenAddress, walletAddress }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required');
      }
      
      const chainId = context?.chainId;
      const provider = getProvider(chainId);
      
      const contract = new ethers.Contract(tokenAddress, ERC20_ABI, provider);
      
      const [balance, symbol, decimals] = await Promise.all([
        contract.balanceOf(address),
        contract.symbol().catch(() => 'UNKNOWN'),
        contract.decimals().catch(() => 18)
      ]);
      
      const balanceFormatted = formatUnits(balance.toString(), Number(decimals));
      
      // Try to get USD price
      const prices = await fetchUsdPrices([symbol]);
      const price = prices[symbol.toUpperCase()];
      
      return {
        walletAddress: address,
        tokenAddress,
        symbol,
        decimals: Number(decimals),
        balance: balance.toString(),
        balanceFormatted,
        usdPrice: price || null,
        usdValue: price ? (Number(balanceFormatted) * price).toFixed(2) : null
      };
    }
  }
  // Note: get_delegation_status is now in delegation.js with more features
];
