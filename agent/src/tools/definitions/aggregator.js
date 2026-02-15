/**
 * aggregator.js - DEX aggregator tools via 0x API
 *
 * Uses 0x API to find optimal swap paths across multiple DEXs.
 * Supports cross-chain queries - ask about any chain regardless of where you're connected.
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';

// 0x API v2 uses single endpoint with chainId parameter
const ZEROX_API_BASE = 'https://api.0x.org';

// Uniswap token list cache
let uniswapTokenCache = null;
let uniswapCacheTime = 0;
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

async function getUniswapTokenList() {
  const now = Date.now();
  if (uniswapTokenCache && (now - uniswapCacheTime) < CACHE_TTL) {
    return uniswapTokenCache;
  }

  const resp = await fetch('https://tokens.uniswap.org');
  const data = await resp.json();
  uniswapTokenCache = data.tokens;
  uniswapCacheTime = now;
  return uniswapTokenCache;
}

async function lookupTokenFromUniswap(symbol, chainId) {
  const tokens = await getUniswapTokenList();
  const upperSymbol = symbol.toUpperCase();

  const match = tokens.find(t =>
    t.chainId === chainId &&
    t.symbol.toUpperCase() === upperSymbol
  );

  return match || null;
}

// Chains supported by 0x
const SUPPORTED_CHAINS = {
  1: { name: 'Ethereum' },
  8453: { name: 'Base' },
  42161: { name: 'Arbitrum' },
  10: { name: 'Optimism' },
  137: { name: 'Polygon' },
  43114: { name: 'Avalanche' },
  56: { name: 'BSC' }
};

// Native token representation
const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE';

// Token addresses by chain
const TOKEN_ADDRESSES = {
  1: {
    ETH: NATIVE_TOKEN_ADDRESS,
    WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    DAI: '0x6B175474E89094C44Da98b954EedC7A0D6Ec9839',
    WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
    // Popular DeFi tokens
    UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
    LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
    AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    MKR: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2',
    SNX: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F',
    CRV: '0xD533a949740bb3306d119CC777fa900bA034cd52',
    LDO: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32',
    // Staking tokens
    STETH: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84',
    WSTETH: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
    RETH: '0xae78736Cd615f374D3085123A210448E74Fc6393',
    CBETH: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704',
    // Meme/popular
    PEPE: '0x6982508145454Ce325dDbE47a25d4ec3d2311933',
    SHIB: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE',
  },
  8453: {
    ETH: NATIVE_TOKEN_ADDRESS,
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913',
    USDT: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
    USDbC: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
    DAI: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb',
    cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
  },
  42161: {
    ETH: NATIVE_TOKEN_ADDRESS,
    WETH: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    USDC: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    USDT: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  10: {
    ETH: NATIVE_TOKEN_ADDRESS,
    WETH: '0x4200000000000000000000000000000000000006',
    USDC: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    USDT: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    DAI: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1',
  },
  137: {
    MATIC: NATIVE_TOKEN_ADDRESS,
    WMATIC: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270',
    USDC: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    USDT: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    DAI: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063',
    WETH: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
  }
};

// Token decimals
const TOKEN_DECIMALS = {
  ETH: 18, WETH: 18, MATIC: 18, WMATIC: 18,
  USDC: 6, USDbC: 6, USDT: 6, DAI: 18, WBTC: 8,
  // DeFi tokens (all 18 decimals)
  UNI: 18, LINK: 18, AAVE: 18, MKR: 18, SNX: 18, CRV: 18, LDO: 18,
  STETH: 18, WSTETH: 18, RETH: 18, CBETH: 18,
  PEPE: 18, SHIB: 18
};

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

/**
 * Resolve token symbol to address for a given chain
 * Automatically looks up from Uniswap token list if not in hardcoded list
 */
async function resolveTokenAddress(tokenSymbolOrAddress, chainId) {
  if (tokenSymbolOrAddress.startsWith('0x')) {
    return { address: tokenSymbolOrAddress, decimals: null, source: 'address' };
  }

  const upper = tokenSymbolOrAddress.toUpperCase();

  // Check hardcoded list first (fast)
  const chainTokens = TOKEN_ADDRESSES[chainId];
  if (chainTokens && chainTokens[upper]) {
    return {
      address: chainTokens[upper],
      decimals: TOKEN_DECIMALS[upper] || 18,
      source: 'builtin'
    };
  }

  // Handle native ETH
  if (upper === 'ETH') {
    return { address: NATIVE_TOKEN_ADDRESS, decimals: 18, source: 'builtin' };
  }

  // Fallback to Uniswap token list
  const uniToken = await lookupTokenFromUniswap(tokenSymbolOrAddress, chainId);
  if (uniToken) {
    return {
      address: uniToken.address,
      decimals: uniToken.decimals,
      name: uniToken.name,
      source: 'uniswap'
    };
  }

  throw new Error(`Token "${tokenSymbolOrAddress}" not found on chain ${chainId}. Provide contract address (0x...).`);
}

/**
 * Get token decimals
 */
async function getTokenDecimals(symbolOrAddress, chainId = null) {
  const upper = typeof symbolOrAddress === 'string' ? symbolOrAddress.toUpperCase() : '';
  if (TOKEN_DECIMALS[upper]) {
    return TOKEN_DECIMALS[upper];
  }

  if (symbolOrAddress.startsWith('0x') && chainId) {
    try {
      const provider = getProvider(chainId);
      const contract = new ethers.Contract(
        symbolOrAddress,
        ['function decimals() view returns (uint8)'],
        provider
      );
      const decimals = await contract.decimals();
      return Number(decimals);
    } catch {
      // Fall back to 18
    }
  }

  return 18;
}

/**
 * Fetch price quote from 0x API
 */
async function fetch0xPrice(chainId, fromToken, toToken, amount) {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    throw new Error('0x API key not configured. Add ZEROX_API_KEY to environment.');
  }

  if (!SUPPORTED_CHAINS[chainId]) {
    throw new Error(`0x does not support chain ${chainId}`);
  }

  const params = new URLSearchParams({
    chainId: chainId.toString(),
    sellToken: fromToken,
    buyToken: toToken,
    sellAmount: amount
  });

  const url = `${ZEROX_API_BASE}/swap/allowance-holder/price?${params}`;

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
 * Fetch swap quote with transaction data from 0x API
 */
async function fetch0xQuote(chainId, fromToken, toToken, amount, takerAddress, slippageBps = 50) {
  const apiKey = process.env.ZEROX_API_KEY;
  if (!apiKey) {
    throw new Error('0x API key not configured. Add ZEROX_API_KEY to environment.');
  }

  if (!SUPPORTED_CHAINS[chainId]) {
    throw new Error(`0x does not support chain ${chainId}`);
  }

  const params = new URLSearchParams({
    chainId: chainId.toString(),
    sellToken: fromToken,
    buyToken: toToken,
    sellAmount: amount,
    taker: takerAddress,
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
 * Parse 0x route sources for display
 */
function formatRouting(route) {
  if (!route || !route.fills || !Array.isArray(route.fills)) {
    return 'Direct swap';
  }

  const sources = {};
  for (const fill of route.fills) {
    const source = fill.source || 'Unknown';
    if (!sources[source]) sources[source] = 0;
    sources[source] += 1;
  }

  const total = Object.values(sources).reduce((a, b) => a + b, 0);
  return Object.entries(sources)
    .map(([name, count]) => `${Math.round(count / total * 100)}% ${name}`)
    .join(' + ');
}

export { resolveTokenAddress, fetch0xQuote, TOKEN_ADDRESSES, TOKEN_DECIMALS, NATIVE_TOKEN_ADDRESS };

export const aggregatorTools = [
  {
    name: 'get_aggregated_quote',
    description: `Get the best swap quote by searching across multiple DEXs via 0x aggregator.
Use this when user asks for a swap quote, wants to know how much they'll get, or asks "what's the best rate".

Returns quote with routing breakdown showing which DEXs are used.
Can query ANY chain regardless of where user is connected - useful for price checks.

Supported chains: Ethereum (1), Base (8453), Arbitrum (42161), Optimism (10), Polygon (137)
If user doesn't specify chain, defaults to Ethereum mainnet.

Examples:
- "How much USDC for 1 ETH?" → use this tool
- "Get me a quote on Base" → chainId: 8453
- "What's the best rate for swapping ETH to USDC?" → use this tool

Comparing chains: If user asks to compare rates across chains (e.g., "compare ETH to USDC on mainnet vs Base"), call this tool multiple times in parallel with different chainId values. Then compare the results.

Follow-up handling - users may ask to adjust parameters after getting a quote:
- "use 1% slippage" or "make slippage 1%" → re-run with slippageBps: 100
- "check on Base" or "what about Base?" → re-run with chainId: 8453
- "what about 2 ETH?" or "try with 0.5 ETH" → re-run with updated amount
- "swap to DAI instead" → re-run with toToken: "DAI"
- "use higher slippage" → re-run with slippageBps: 100 or 200
Keep other parameters the same when user only changes one thing.`,
    parameters: z.object({
      fromToken: z.string().describe('Token to sell (symbol like "ETH" or address)'),
      toToken: z.string().describe('Token to buy (symbol like "USDC" or address)'),
      amount: z.string().describe('Amount to swap (e.g., "1.5")'),
      chainId: z.number().optional().describe('Chain to query (1=Ethereum, 8453=Base, etc). Defaults to Ethereum mainnet.'),
      slippageBps: z.number().default(50).describe('Slippage tolerance in basis points (default 50 = 0.5%)')
    }),
    tags: ['free', 'read-only', 'aggregator'],
    handler: async ({ fromToken, toToken, amount, chainId: requestedChainId, slippageBps = 50 }, context) => {
      const chainId = requestedChainId || 1;
      const chainInfo = SUPPORTED_CHAINS[chainId];

      if (!chainInfo) {
        return {
          error: true,
          message: `Chain ${chainId} not supported. Supported: ${Object.entries(SUPPORTED_CHAINS).map(([id, c]) => `${c.name} (${id})`).join(', ')}`
        };
      }

      const fromResolved = await resolveTokenAddress(fromToken, chainId);
      const toResolved = await resolveTokenAddress(toToken, chainId);

      const fromAddress = fromResolved.address;
      const toAddress = toResolved.address;
      const fromDecimals = fromResolved.decimals || await getTokenDecimals(fromToken, chainId);
      const toDecimals = toResolved.decimals || await getTokenDecimals(toToken, chainId);
      const amountWei = ethers.parseUnits(amount, fromDecimals).toString();

      const quote = await fetch0xPrice(chainId, fromAddress, toAddress, amountWei);

      const outputAmount = ethers.formatUnits(quote.buyAmount, toDecimals);
      const rate = parseFloat(outputAmount) / parseFloat(amount);
      const routing = formatRouting(quote.route);

      // Calculate minimum output with slippage
      const minOutWei = (BigInt(quote.buyAmount) * BigInt(10000 - slippageBps) / 10000n).toString();
      const minOutput = ethers.formatUnits(minOutWei, toDecimals);

      // Calculate gas estimate using 0x's gasPrice
      let gasEstimateEth = null;
      let gasEstimateUsd = null;
      let gasPriceGwei = null;
      if (quote.gas) {
        const gasPrice = quote.gasPrice ? BigInt(quote.gasPrice) : null;
        if (gasPrice) {
          const gasCostWei = BigInt(quote.gas) * gasPrice;
          gasEstimateEth = parseFloat(ethers.formatEther(gasCostWei)).toFixed(6);
          gasPriceGwei = parseFloat(ethers.formatUnits(gasPrice, 'gwei')).toFixed(4);

          // Calculate USD cost using the rate if swapping from ETH to USD-stable
          const isFromEth = fromToken.toUpperCase() === 'ETH' || fromToken.toUpperCase() === 'WETH';
          const isToUsdStable = ['USDC', 'USDT', 'DAI', 'USDC'].includes(toToken.toUpperCase());
          if (isFromEth && isToUsdStable) {
            // We know 1 ETH = rate USDC, so gas cost in USD = gasEstimateEth * rate
            gasEstimateUsd = (parseFloat(gasEstimateEth) * rate).toFixed(2);
          } else {
            // Try to fetch ETH price from CMC
            try {
              const cmcKey = process.env.CMC_API_KEY;
              if (cmcKey) {
                const resp = await fetch(
                  'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=ETH&convert=USD',
                  { headers: { 'X-CMC_PRO_API_KEY': cmcKey } }
                );
                const data = await resp.json();
                const ethPrice = data?.data?.ETH?.quote?.USD?.price;
                if (ethPrice) {
                  gasEstimateUsd = (parseFloat(gasEstimateEth) * ethPrice).toFixed(2);
                }
              }
            } catch (e) {
              // Ignore - USD estimate will be null
            }
          }
        }
      }

      // Return structured data - let LLM format the display
      return {
        // Aggregator info
        aggregator: '0x',

        // Chain info
        chain: chainInfo.name,
        chainId: chainId,

        // Input
        inputToken: fromToken.toUpperCase(),
        inputAmount: amount,
        inputAmountWei: amountWei,

        // Output
        outputToken: toToken.toUpperCase(),
        outputAmount: parseFloat(outputAmount).toFixed(6),
        outputAmountWei: quote.buyAmount,

        // Minimum output (after slippage)
        minOutputAmount: parseFloat(minOutput).toFixed(6),
        minOutputAmountWei: minOutWei,

        // Slippage
        slippageBps: slippageBps,
        slippagePercent: (slippageBps / 100).toFixed(2) + '%',

        // Exchange rate
        rate: rate.toFixed(6),
        rateDisplay: `1 ${fromToken.toUpperCase()} = ${rate.toFixed(6)} ${toToken.toUpperCase()}`,

        // Routing - shows which DEXs are used
        routing: routing,
        routingSources: quote.route?.fills?.map(f => f.source) || [],

        // Gas
        gasUnits: quote.gas || null,
        gasPriceGwei: gasPriceGwei,
        gasEstimateEth: gasEstimateEth,
        gasEstimateUsd: gasEstimateUsd ? `$${gasEstimateUsd}` : null,

        // Formatting guidance for LLM
        _format: `Present this swap quote in a clean, scannable format:

**Swap Quote** - {chain}

| Field | Value |
|-------|-------|
| **You Pay** | {inputAmount} {inputToken} |
| **You Get** | ~{outputAmount} {outputToken} |
| **Minimum** | {minOutputAmount} {outputToken} |
| **Rate** | {rateDisplay} |
| **Slippage** | {slippagePercent} |
| **Route** | {routing} |
| **Est. Gas** | {gasEstimateEth} ETH ({gasEstimateUsd}) |

End with a brief, natural prompt like "Want me to execute this?" or "Ready to swap?"`
      };
    }
  },

  {
    name: 'execute_aggregated_swap',
    description: `Execute a token swap using 0x aggregator via ERC-7715 delegation.
Use this when user confirms they want to swap, says "do it", "execute", "swap now", or "yes".

IMPORTANT: Executes on the chain user is connected to. Cannot execute cross-chain.
Always simulate first (default) to show expected output before executing.

Examples:
- "Swap 1 ETH to USDC" → simulate first, then execute if confirmed
- "Execute the swap" → simulate: false (after prior simulation)
- "do it" or "yes" after seeing simulation → execute with simulate: false

Follow-up handling:
- "use 1% slippage" before executing → re-simulate with slippageBps: 100
- "actually make it 0.5 ETH" → re-simulate with updated amount
- "go ahead" or "execute" after simulation → set simulate: false`,
    parameters: z.object({
      fromToken: z.string().describe('Token to sell'),
      toToken: z.string().describe('Token to buy'),
      amount: z.string().describe('Amount to swap'),
      slippageBps: z.number().default(50).describe('Slippage tolerance in basis points (default 50 = 0.5%)'),
      walletAddress: z.string().optional().describe('Wallet to swap from'),
      simulate: z.boolean().default(true).describe('If true, only simulate')
    }),
    tags: ['tx', 'write', 'aggregator'],
    handler: async ({ fromToken, toToken, amount, slippageBps = 50, walletAddress, simulate = true }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - connect your wallet first');
      }

      const chainId = context?.chainId;
      const chainInfo = SUPPORTED_CHAINS[chainId];

      if (!chainInfo) {
        throw new Error(
          `0x aggregator doesn't support chain ${chainId}. ` +
          `Supported: ${Object.entries(SUPPORTED_CHAINS).map(([id, c]) => `${c.name} (${id})`).join(', ')}`
        );
      }

      const fromResolved = await resolveTokenAddress(fromToken, chainId);
      const toResolved = await resolveTokenAddress(toToken, chainId);

      const fromAddress = fromResolved.address;
      const toAddress = toResolved.address;
      const fromDecimals = fromResolved.decimals || await getTokenDecimals(fromToken, chainId);
      const toDecimals = toResolved.decimals || await getTokenDecimals(toToken, chainId);
      const amountWei = ethers.parseUnits(amount, fromDecimals).toString();

      const quote = await fetch0xQuote(chainId, fromAddress, toAddress, amountWei, address, slippageBps);

      const outputAmount = ethers.formatUnits(quote.buyAmount, toDecimals);
      const minOutput = ethers.formatUnits(quote.minBuyAmount, toDecimals);
      const routing = formatRouting(quote.route);

      if (simulate) {
        return {
          simulation: true,

          // Wallet
          walletAddress: address,

          // Chain
          chain: chainInfo.name,
          chainId: chainId,

          // Input
          inputToken: fromToken.toUpperCase(),
          inputAmount: amount,

          // Output
          outputToken: toToken.toUpperCase(),
          expectedOutput: outputAmount,

          // Minimum with slippage
          minOutput: minOutput,
          slippageBps: slippageBps,
          slippagePercent: `${slippageBps / 100}%`,

          // Routing
          routing: routing,

          // Gas
          gasUnits: quote.gas,

          _format: `Present simulation results cleanly:

**Swap Preview** - {chain}

| | |
|---|---|
| **Selling** | {inputAmount} {inputToken} |
| **Receiving** | ~{expectedOutput} {outputToken} |
| **Minimum** | {minOutput} (after {slippagePercent} slippage) |
| **Route** | {routing} |

Ask naturally: "Look good? Say 'do it' to execute."`
        };
      }

      // Execute via delegation
      const provider = getProvider(chainId);
      const { SignerDriver } = await import('../../lib/signer.js');
      const { ensureGas } = await import('../../lib/gasSponsor.js');

      const driver = new SignerDriver({ provider, logger: context?.logger });
      const signer = await driver.getSignerForWallet(address);

      const signerAddress = await signer.getAddress();
      const gasResult = await ensureGas(signerAddress, provider, context?.logger);
      if (gasResult.sponsored) {
        context?.logger?.info?.('gas_sponsored', gasResult);
      }

      // Token approval if needed
      const isNativeToken = fromAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
      if (!isNativeToken && quote.issues?.allowance) {
        const ERC20_ABI = [
          'function approve(address,uint256) returns (bool)'
        ];

        context?.logger?.info?.('approving_token', { token: fromToken, spender: quote.issues.allowance.spender });

        const tokenContract = new ethers.Contract(fromAddress, ERC20_ABI, provider);
        const approveData = tokenContract.interface.encodeFunctionData('approve', [
          quote.issues.allowance.spender,
          ethers.MaxUint256
        ]);

        await signer.sendTransactionWithDelegation({
          to: fromAddress,
          data: approveData,
          value: 0n
        }, { tokenAddress: fromAddress });
      }

      // Execute swap
      context?.logger?.info?.('executing_0x_swap', {
        from: fromToken,
        to: toToken,
        amount
      });

      const receipt = await signer.sendTransactionWithDelegation({
        to: quote.transaction.to,
        data: quote.transaction.data,
        value: BigInt(quote.transaction.value || 0),
        gas: quote.transaction.gas
      });

      if (context?.remember) {
        context.remember('pendingSwapIntent', null);
      }

      return {
        success: true,

        // Transaction
        txHash: receipt.hash || receipt.transactionHash,
        blockNumber: receipt.blockNumber,

        // Wallet
        walletAddress: address,

        // Chain
        chain: chainInfo.name,
        chainId: chainId,

        // Swap details
        inputToken: fromToken.toUpperCase(),
        inputAmount: amount,
        outputToken: toToken.toUpperCase(),
        expectedOutput: outputAmount,
        routing: routing,

        _hint: 'Swap executed successfully. Show transaction hash, chain, input/output amounts, and routing used.'
      };
    }
  },

  {
    name: 'get_supported_chains',
    description: `Get list of chains supported by the 0x aggregator.
Use when user asks "what chains are supported", "can I swap on X chain", or to check availability.`,
    parameters: z.object({}),
    tags: ['free', 'read-only', 'aggregator'],
    handler: async (_, context) => {
      const currentChain = context?.chainId;

      const chains = Object.entries(SUPPORTED_CHAINS).map(([id, info]) => ({
        chainId: parseInt(id),
        name: info.name,
        isCurrent: parseInt(id) === currentChain
      }));

      const currentSupported = SUPPORTED_CHAINS[currentChain];

      return {
        chains,
        currentChainId: currentChain,
        currentChainSupported: !!currentSupported,
        note: currentSupported
          ? `You're on ${currentSupported.name} - aggregator available.`
          : `You're on a testnet/unsupported chain. You can still query mainnet prices.`
      };
    }
  },

  {
    name: 'lookup_token',
    description: `Look up a token's contract address by symbol using Uniswap's token list.
Use this when you need to find a token address for swapping and the symbol isn't recognized.

Returns the token's contract address, decimals, and name.
Supports tokens on Ethereum (1), Base (8453), Arbitrum (42161), Optimism (10), Polygon (137).

Examples:
- User says "swap COMP to ETH" but COMP isn't in our list → call this to get COMP's address
- "What's the address for BLUR?" → use this tool
- After getting the address, use it in get_aggregated_quote or execute_aggregated_swap`,
    parameters: z.object({
      symbol: z.string().describe('Token symbol to look up (e.g., "COMP", "BLUR", "APE")'),
      chainId: z.number().optional().describe('Chain ID (1=Ethereum, 8453=Base, etc). Defaults to Ethereum.')
    }),
    tags: ['free', 'read-only', 'aggregator'],
    handler: async ({ symbol, chainId: requestedChainId }, context) => {
      const chainId = requestedChainId || 1;
      const chainInfo = SUPPORTED_CHAINS[chainId];

      // First check our hardcoded list
      const upper = symbol.toUpperCase();
      if (TOKEN_ADDRESSES[chainId]?.[upper]) {
        return {
          found: true,
          symbol: upper,
          address: TOKEN_ADDRESSES[chainId][upper],
          decimals: TOKEN_DECIMALS[upper] || 18,
          chain: chainInfo?.name || `Chain ${chainId}`,
          source: 'builtin',
          _hint: 'Token found. You can now use this address in swap tools.'
        };
      }

      // Look up from Uniswap
      const match = await lookupTokenFromUniswap(symbol, chainId);

      if (match) {
        return {
          found: true,
          symbol: match.symbol,
          name: match.name,
          address: match.address,
          decimals: match.decimals,
          chain: chainInfo?.name || `Chain ${chainId}`,
          chainId: chainId,
          source: 'uniswap',
          logoURI: match.logoURI,
          _hint: 'Token found in Uniswap list. Use the address for swap tools.'
        };
      }

      // Not found
      return {
        found: false,
        symbol: upper,
        chainId: chainId,
        chain: chainInfo?.name || `Chain ${chainId}`,
        message: `Token "${symbol}" not found on ${chainInfo?.name || `chain ${chainId}`}. User may need to provide the contract address directly (0x...).`,
        suggestion: 'Ask user for the contract address, or check if the symbol is correct.'
      };
    }
  }
];
