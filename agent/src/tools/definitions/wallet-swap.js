/**
 * wallet-swap.js - Tools for executing token swaps directly from wallet
 *
 * Swaps execute on Uniswap via ERC-7715 delegation.
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import { getChainConfig, getRpcUrl } from '../../lib/chainConfig.js';
import { formatGasForOutput, getGasPriceForTier } from './gas.js';

// Get chain-specific addresses
function getAddressesForChain(chainId = null) {
  const config = getChainConfig(chainId);
  return {
    UNIVERSAL_ROUTER: config.routers.UNIVERSAL_ROUTER,
    V3_ROUTER: config.routers.V3_ROUTER,
    QUOTER_V2: config.quoter,
    PERMIT2: config.permit2,
    ETH: '0x0000000000000000000000000000000000000000',
    WETH: config.tokens.WETH,
    USDC: config.tokens.USDC
  };
}

// Token metadata by chain

// Ethereum Mainnet (chainId: 1)
const ETH_MAINNET_TOKEN_METADATA = {
  'ETH': { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  'WETH': { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
  'USDC': { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
  'USDT': { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
  'DAI': { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedC7A0D6Ec9839', decimals: 18 },
  'WBTC': { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
  'UNI': { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', decimals: 18 },
  'LINK': { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', decimals: 18 },
  'AAVE': { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9', decimals: 18 },
  'MKR': { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2', decimals: 18 },
  'SNX': { symbol: 'SNX', address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F', decimals: 18 },
  'CRV': { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52', decimals: 18 },
  'LDO': { symbol: 'LDO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32', decimals: 18 },
  'PEPE': { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933', decimals: 18 },
  'SHIB': { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE', decimals: 18 },
  'ARB': { symbol: 'ARB', address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', decimals: 18 },
  'OP': { symbol: 'OP', address: '0x4200000000000000000000000000000000000042', decimals: 18 },
  'stETH': { symbol: 'stETH', address: '0xae7ab96520DE3A18E5e111B5EaAb095312D7fE84', decimals: 18 },
  'wstETH': { symbol: 'wstETH', address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', decimals: 18 },
  'rETH': { symbol: 'rETH', address: '0xae78736Cd615f374D3085123A210448E74Fc6393', decimals: 18 },
  'cbETH': { symbol: 'cbETH', address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', decimals: 18 },
  'RNDR': { symbol: 'RNDR', address: '0x6De037ef9aD2725EB40118Bb1702EBb27e4Aeb24', decimals: 18 },
  'FET': { symbol: 'FET', address: '0xaea46A60368A7bD060eec7df8CBa43b7EF41Ad85', decimals: 18 },
  'GRT': { symbol: 'GRT', address: '0xc944E90C64B2c07662A292be6244BDf05Cda44a7', decimals: 18 },
  'ENS': { symbol: 'ENS', address: '0xC18360217D8F7Ab5e7c516566761Ea12Ce7F9D72', decimals: 18 },
};

// Base Mainnet (chainId: 8453)
const BASE_TOKEN_METADATA = {
  'ETH': { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  'WETH': { symbol: 'WETH', address: '0x4200000000000000000000000000000000000006', decimals: 18 },
  'USDC': { symbol: 'USDC', address: '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', decimals: 6 },
  'USDT': { symbol: 'USDT', address: '0xfde4c96c8593536e31f229ea8f37b2ada2699bb2', decimals: 6 },
  'DAI': { symbol: 'DAI', address: '0x50c5725949a6f0c72e6c4a641f24049a917db0cb', decimals: 18 },
  'WBTC': { symbol: 'WBTC', address: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', decimals: 8 },
  'cbETH': { symbol: 'cbETH', address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18 },
  'rETH': { symbol: 'rETH', address: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c', decimals: 18 },
  'UNI': { symbol: 'UNI', address: '0xc3De830EA07524a0761646a6a4e4be0e114a3C83', decimals: 18 },
  'LINK': { symbol: 'LINK', address: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196', decimals: 18 },
  'AAVE': { symbol: 'AAVE', address: '0x0c9d8c7e486e822C29488bF1E4966eFC5c718856', decimals: 18 },
  'AERO': { symbol: 'AERO', address: '0x940181a94A35A4569E4529A3CDfB74e38FD98631', decimals: 18 },
  'DEGEN': { symbol: 'DEGEN', address: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed', decimals: 18 },
  'BRETT': { symbol: 'BRETT', address: '0x532f27101965dd16442E59d40670FaF5eBB142E4', decimals: 18 },
  'TOSHI': { symbol: 'TOSHI', address: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4', decimals: 18 },
  'VIRTUAL': { symbol: 'VIRTUAL', address: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b', decimals: 18 },
  'MORPHO': { symbol: 'MORPHO', address: '0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842', decimals: 18 },
  'HIGHER': { symbol: 'HIGHER', address: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe', decimals: 18 },
  'AIXBT': { symbol: 'AIXBT', address: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825', decimals: 18 },
  'SPX': { symbol: 'SPX', address: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C', decimals: 8 },
};

// Sepolia Testnet (chainId: 11155111)
const SEPOLIA_TOKEN_METADATA = {
  'ETH': { symbol: 'ETH', address: '0x0000000000000000000000000000000000000000', decimals: 18 },
  'WETH': { symbol: 'WETH', address: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', decimals: 18 },
  'USDC': { symbol: 'USDC', address: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', decimals: 6 },
};

function getTokenMetadataForChain(chainId = null, options = {}) {
  const config = getChainConfig(chainId);
  
  // For Sepolia quotes, use mainnet metadata since quotes come from mainnet
  if (config.chainId === 11155111 && options.forQuote) {
    return ETH_MAINNET_TOKEN_METADATA;
  }
  
  if (config.chainId === 1) return ETH_MAINNET_TOKEN_METADATA;
  if (config.chainId === 11155111) return SEPOLIA_TOKEN_METADATA;
  if (config.chainId === 8453) return BASE_TOKEN_METADATA;
  return BASE_TOKEN_METADATA; // Default fallback
}

// Quoter V2 ABI
const QUOTER_ABI = [
  {
    inputs: [{ components: [
      { name: 'tokenIn', type: 'address' },
      { name: 'tokenOut', type: 'address' },
      { name: 'amountIn', type: 'uint256' },
      { name: 'fee', type: 'uint24' },
      { name: 'sqrtPriceLimitX96', type: 'uint160' }
    ], name: 'params', type: 'tuple' }],
    name: 'quoteExactInputSingle',
    outputs: [
      { name: 'amountOut', type: 'uint256' },
      { name: 'sqrtPriceX96After', type: 'uint160' },
      { name: 'initializedTicksCrossed', type: 'uint32' },
      { name: 'gasEstimate', type: 'uint256' }
    ],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

// ERC20 ABI for approvals
const ERC20_ABI = [
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'symbol', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'string' }] },
  { name: 'decimals', type: 'function', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint8' }] }
];

// Universal Router command encoding
const COMMANDS = {
  WRAP_ETH: 0x0b,
  UNWRAP_WETH: 0x0c,
  V3_SWAP_EXACT_IN: 0x00
};

// Fee tiers to check
const FEE_TIERS = [500, 3000, 10000, 100];

function getProvider(chainId = null) {
  const rpc = getRpcUrl(chainId);
  if (!rpc) throw new Error('RPC_URL not configured');
  return new ethers.JsonRpcProvider(rpc);
}

function isHexAddress(value) {
  return typeof value === 'string' && value.startsWith('0x') && value.length === 42;
}

function checksumAddress(address) {
  if (!address || address === '0x0000000000000000000000000000000000000000') return address;
  try { return ethers.getAddress(address); } catch { return address; }
}

function normalizeAmountString(amount, decimals) {
  if (amount == null) throw new Error('Amount is required');
  let text = String(amount).trim().replace(/,/g, '').replace(/_/g, '');
  if (text.startsWith('+')) text = text.slice(1);
  if (text.startsWith('-')) throw new Error('Amount must be positive');
  if (!/^((\d+\.?\d*)|(\.\d+))$/.test(text)) throw new Error('Amount must be a numeric string');
  
  if (!text.includes('.')) return text;
  const [whole, frac = ''] = text.split('.');
  const safeFrac = frac.slice(0, decimals);
  return safeFrac ? `${whole || '0'}.${safeFrac}` : (whole || '0');
}

async function getTokenInfo(symbolOrAddress, chainId = null, options = {}) {
  if (!symbolOrAddress) throw new Error('Token symbol or address required');
  
  const config = getChainConfig(chainId);
  const TOKEN_METADATA = getTokenMetadataForChain(chainId, options);
  
  // For Sepolia quotes, also check mainnet metadata as fallback
  const FALLBACK_METADATA = config.chainId === 11155111 ? ETH_MAINNET_TOKEN_METADATA : null;
  
  if (isHexAddress(symbolOrAddress)) {
    const lower = symbolOrAddress.toLowerCase();
    const known = Object.values(TOKEN_METADATA).find(m => m.address.toLowerCase() === lower);
    if (known) return { ...known, address: checksumAddress(known.address) };
    
    // Check fallback for Sepolia
    if (FALLBACK_METADATA) {
      const fallbackKnown = Object.values(FALLBACK_METADATA).find(m => m.address.toLowerCase() === lower);
      if (fallbackKnown) return { ...fallbackKnown, address: checksumAddress(fallbackKnown.address), isMainnetToken: true };
    }
    
    // Fetch from chain
    const provider = getProvider(chainId);
    const contract = new ethers.Contract(symbolOrAddress, ERC20_ABI, provider);
    const [symbol, decimals] = await Promise.all([
      contract.symbol().catch(() => 'UNKNOWN'),
      contract.decimals().catch(() => 18)
    ]);
    return { symbol, address: checksumAddress(symbolOrAddress), decimals: Number(decimals) };
  }
  
  const upper = symbolOrAddress.toUpperCase();
  const meta = TOKEN_METADATA[upper];
  if (meta) return { ...meta, address: checksumAddress(meta.address) };
  
  // Check fallback for Sepolia - use mainnet token info for quotes
  if (FALLBACK_METADATA) {
    const fallbackMeta = FALLBACK_METADATA[upper];
    if (fallbackMeta) {
      return { ...fallbackMeta, address: checksumAddress(fallbackMeta.address), isMainnetToken: true };
    }
  }
  
  throw new Error(`Unknown token: ${symbolOrAddress} on ${config.name}. Use contract address (0x...) for unlisted tokens.`);
}

async function getQuoteForTier(quoter, tokenIn, tokenOut, amountIn, fee) {
  try {
    const result = await quoter.quoteExactInputSingle.staticCall({
      tokenIn, tokenOut, amountIn, fee, sqrtPriceLimitX96: 0
    });
    return { amountOut: result.amountOut, gasEstimate: result.gasEstimate, feeTier: fee };
  } catch { return null; }
}

async function getQuote(tokenIn, tokenOut, amountIn, chainId = null, options = {}) {
  const config = getChainConfig(chainId);
  const ADDRESSES = getAddressesForChain(chainId);
  
  // For Sepolia: Go directly to mainnet for quotes (skip local quoter)
  if (config.chainId === 11155111) {
    const mainnetAddresses = getAddressesForChain(1);
    const mainnetProvider = new ethers.JsonRpcProvider(process.env.ETH_MAINNET_RPC_URL || 'https://eth.llamarpc.com');
    const mainnetQuoter = new ethers.Contract(mainnetAddresses.QUOTER_V2, QUOTER_ABI, mainnetProvider);
    
    // Token addresses should already be mainnet addresses (from getTokenInfo with forQuote: true)
    // Just need to handle ETH -> WETH conversion for mainnet
    const mainnetTokenIn = tokenIn === '0x0000000000000000000000000000000000000000' 
      ? mainnetAddresses.WETH 
      : tokenIn;
    const mainnetTokenOut = tokenOut === '0x0000000000000000000000000000000000000000'
      ? mainnetAddresses.WETH
      : tokenOut;
    
    const mainnetQuotes = await Promise.all(
      FEE_TIERS.map(fee => getQuoteForTier(mainnetQuoter, mainnetTokenIn, mainnetTokenOut, amountIn, fee))
    );
    
    const validMainnetQuotes = mainnetQuotes.filter(q => q !== null);
    if (validMainnetQuotes.length > 0) {
      const best = validMainnetQuotes.reduce((b, c) => c.amountOut > b.amountOut ? c : b);
      return { ...best, isMainnetQuote: true, note: 'Quote from mainnet (Sepolia has no liquidity)' };
    }
    
    throw new Error(`No liquidity pool found for this pair on mainnet. Try a different token pair.`);
  }
  
  // Normal flow for mainnet/Base
  const provider = getProvider(chainId);
  const quoter = new ethers.Contract(ADDRESSES.QUOTER_V2, QUOTER_ABI, provider);

  const actualTokenIn = tokenIn === ADDRESSES.ETH ? ADDRESSES.WETH : tokenIn;
  const actualTokenOut = tokenOut === ADDRESSES.ETH ? ADDRESSES.WETH : tokenOut;

  const quotes = await Promise.all(
    FEE_TIERS.map(fee => getQuoteForTier(quoter, actualTokenIn, actualTokenOut, amountIn, fee))
  );

  const validQuotes = quotes.filter(q => q !== null);
  
  if (validQuotes.length === 0) {
    throw new Error(`No liquidity pool found for this pair on ${config.name}.`);
  }

  return validQuotes.reduce((best, curr) => curr.amountOut > best.amountOut ? curr : best);
}

function encodePath(tokens, fees) {
  let path = tokens[0];
  for (let i = 0; i < fees.length; i++) {
    path += fees[i].toString(16).padStart(6, '0') + tokens[i + 1].slice(2);
  }
  return path;
}

function encodeSwapData(fromInfo, toInfo, amountWei, minOut, recipient, deadline, feeTier, chainId) {
  const ADDRESSES = getAddressesForChain(chainId);
  const abiCoder = new ethers.AbiCoder();
  const fromIsEth = fromInfo.address === ADDRESSES.ETH;
  const toIsEth = toInfo.address === ADDRESSES.ETH;
  
  const routerInterface = new ethers.Interface([
    'function execute(bytes commands, bytes[] inputs, uint256 deadline) payable'
  ]);
  
  if (fromIsEth) {
    // ETH -> Token
    const commands = new Uint8Array([COMMANDS.WRAP_ETH, COMMANDS.V3_SWAP_EXACT_IN]);
    const wrapInput = abiCoder.encode(['address', 'uint256'], [ADDRESSES.UNIVERSAL_ROUTER, amountWei]);
    const path = encodePath([ADDRESSES.WETH, toInfo.address], [feeTier]);
    const swapInput = abiCoder.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [recipient, amountWei, minOut, path, false]
    );
    return {
      data: routerInterface.encodeFunctionData('execute', [commands, [wrapInput, swapInput], deadline]),
      value: amountWei
    };
  }
  
  if (toIsEth) {
    // Token -> ETH
    const commands = new Uint8Array([COMMANDS.V3_SWAP_EXACT_IN, COMMANDS.UNWRAP_WETH]);
    const path = encodePath([fromInfo.address, ADDRESSES.WETH], [feeTier]);
    const swapInput = abiCoder.encode(
      ['address', 'uint256', 'uint256', 'bytes', 'bool'],
      [ADDRESSES.UNIVERSAL_ROUTER, amountWei, 0, path, true]
    );
    const unwrapInput = abiCoder.encode(['address', 'uint256'], [recipient, minOut]);
    return {
      data: routerInterface.encodeFunctionData('execute', [commands, [swapInput, unwrapInput], deadline]),
      value: 0n
    };
  }
  
  // Token -> Token via WETH
  const commands = new Uint8Array([COMMANDS.V3_SWAP_EXACT_IN]);
  const path = encodePath([fromInfo.address, ADDRESSES.WETH, toInfo.address], [feeTier, feeTier]);
  const swapInput = abiCoder.encode(
    ['address', 'uint256', 'uint256', 'bytes', 'bool'],
    [recipient, amountWei, minOut, path, true]
  );
  return {
    data: routerInterface.encodeFunctionData('execute', [commands, [swapInput], deadline]),
    value: 0n
  };
}

export const walletSwapTools = [
  {
    name: 'get_swap_quote',
    description: `Get a quote for swapping tokens. Automatically finds the best fee tier. Returns expected output amount and gas estimates.

Gas tiers available:
- slow: Cheapest, 1-5 min confirmation
- standard: Balanced (default)
- fast: Fastest, higher cost

You can query other chains for informational purposes using queryChainId:
- 1 = Ethereum Mainnet
- 8453 = Base
- 11155111 = Sepolia (testnet)

Example: "Get a quote for ETH to USDC on Ethereum mainnet" → use queryChainId: 1`,
    parameters: z.object({
      fromToken: z.string().describe('Token to sell (symbol like "ETH" or address)'),
      toToken: z.string().describe('Token to buy (symbol like "USDC" or address)'),
      amount: z.string().describe('Amount to swap (e.g., "0.5" for 0.5 ETH)'),
      slippageBps: z.number().default(50).describe('Slippage tolerance in basis points (default 50 = 0.5%)'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Gas speed tier for cost estimate'),
      queryChainId: z.number().optional()
        .describe('Optional: Query a different chain (1=Ethereum, 8453=Base, 11155111=Sepolia). Useful for informational queries.')
    }),
    tags: ['free', 'read-only'],
    handler: async ({ fromToken, toToken, amount, slippageBps = 50, gasTier = 'standard', queryChainId }, context) => {
      // Use queryChainId if provided, otherwise fall back to context chainId
      const chainId = queryChainId || context?.chainId;
      const config = getChainConfig(chainId);
      const ADDRESSES = getAddressesForChain(chainId);
      
      // For Sepolia, use mainnet token info since quotes come from mainnet
      const tokenOptions = config.chainId === 11155111 ? { forQuote: true } : {};
      
      const [fromInfo, toInfo] = await Promise.all([
        getTokenInfo(fromToken, chainId, tokenOptions),
        getTokenInfo(toToken, chainId, tokenOptions)
      ]);

      const normalizedAmount = normalizeAmountString(amount, fromInfo.decimals);
      const amountWei = ethers.parseUnits(normalizedAmount, fromInfo.decimals).toString();
      const quote = await getQuote(fromInfo.address, toInfo.address, amountWei, chainId);

      const minOut = (BigInt(quote.amountOut) * BigInt(10000 - slippageBps) / 10000n).toString();
      const amountOutFormatted = ethers.formatUnits(quote.amountOut, toInfo.decimals);
      const minOutFormatted = ethers.formatUnits(minOut, toInfo.decimals);

      const rate = parseFloat(normalizedAmount) === 0 ? 0 : parseFloat(amountOutFormatted) / parseFloat(normalizedAmount);

      // Get gas estimate with tier
      const gasEstimate = await formatGasForOutput('swapSimple', gasTier, chainId);
      
      // Build summary with mainnet fallback note if applicable
      let summary = `${normalizedAmount} ${fromInfo.symbol} → ${amountOutFormatted} ${toInfo.symbol} (min ${minOutFormatted}). Gas: ${gasEstimate.formatted}`;
      if (quote.isMainnetQuote) {
        summary += ` [Quote from mainnet - testnet has no liquidity]`;
      }

      // Build formatted gas breakdown like transfers
      const gasBreakdown = Array.isArray(gasEstimate.allTiers) && gasEstimate.allTiers.length > 0
        ? gasEstimate.allTiers.map(t => `- ${t.name}: ${t.costEth} ETH (~${t.costUsd}, ${t.time})`).join('\n')
        : `- Standard: ${gasEstimate.gasCostEth || '<0.0001'} ETH (~${gasEstimate.gasCostUsd || '<$0.01'})`;
      
      // Build showToUser for consistent formatting
      const testnetNote = quote.isMainnetQuote ? '\n\n**Note:** Quote from mainnet (Sepolia has no liquidity pools)' : '';
      const showToUser = `**Swap Quote**

**From:** ${normalizedAmount} ${fromInfo.symbol}
**To:** ${amountOutFormatted} ${toInfo.symbol}
**Minimum Output:** ${minOutFormatted} ${toInfo.symbol} (${(slippageBps / 100).toFixed(2)}% slippage)
**Rate:** 1 ${fromInfo.symbol} = ${rate.toFixed(6)} ${toInfo.symbol}
**Pool Fee:** ${(quote.feeTier / 10000).toFixed(2)}%
**Router:** Uniswap Universal Router

**Estimated Gas:**
${gasBreakdown}${testnetNote}

Ready to swap?`;

      return {
        fromToken: fromInfo.symbol,
        toToken: toInfo.symbol,
        amountIn: normalizedAmount,
        amountInWei: amountWei,
        amountOut: amountOutFormatted,
        amountOutWei: quote.amountOut.toString(),
        minOut: minOutFormatted,
        minOutWei: minOut,
        slippageBps,
        slippagePercent: (slippageBps / 100).toFixed(2) + '%',
        poolFeeTier: quote.feeTier,
        poolFeePercent: (quote.feeTier / 10000).toFixed(2) + '%',
        router: 'Uniswap Universal Router',
        routerAddress: ADDRESSES.UNIVERSAL_ROUTER,
        exchangeRate: `1 ${fromInfo.symbol} = ${rate.toFixed(6)} ${toInfo.symbol}`,
        
        // Gas info (real on-chain estimate)
        gas: {
          tier: gasTier,
          tierName: gasEstimate.gasTierName,
          costEth: gasEstimate.gasCostEth,
          costUsd: gasEstimate.gasCostUsd,
          confirmationTime: gasEstimate.confirmationTime,
          allTiers: gasEstimate.allTiers
        },
        
        // Helpful summary
        summary,
        
        // Formatted output for display
        showToUser,
        
        // Chain info (helpful when querying other chains)
        chain: config.name,
        chainId: chainId,
        isRemoteQuery: queryChainId ? true : false,
        
        // Testnet fallback info
        isMainnetQuote: quote.isMainnetQuote || false,
        quoteNote: quote.note || null
      };
    }
  },

  {
    name: 'execute_swap',
    description: `Execute a token swap from the wallet. Uses ERC-7715 delegation to swap directly. First call get_swap_quote to see expected output.

Gas tiers available:
- slow: Cheapest, 1-5 min confirmation
- standard: Balanced (default)
- fast: Fastest, higher cost

User can say "use faster gas" or "use slow gas" to change tier.`,
    parameters: z.object({
      fromToken: z.string().describe('Token to sell (symbol or address)'),
      toToken: z.string().describe('Token to buy (symbol or address)'),
      amount: z.string().describe('Amount to swap (e.g., "0.5" for 0.5 ETH)'),
      slippageBps: z.number().default(50).describe('Slippage tolerance in basis points'),
      walletAddress: z.string().optional().describe('Wallet to swap from (defaults to connected wallet)'),
      simulate: z.boolean().default(true).describe('If true, only simulate without executing'),
      gasTier: z.enum(['slow', 'standard', 'fast']).default('standard')
        .describe('Gas speed tier: slow (cheapest), standard (balanced), fast (fastest)')
    }),
    tags: ['tx', 'write'],
    handler: async ({ fromToken, toToken, amount, slippageBps = 50, walletAddress, simulate = true, gasTier = 'standard' }, context) => {
      const address = walletAddress || context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!address) {
        throw new Error('walletAddress is required - please connect your wallet first');
      }
      
      const chainId = context?.chainId;
      const ADDRESSES = getAddressesForChain(chainId);
      const provider = getProvider(chainId);
      
      const [fromInfo, toInfo] = await Promise.all([
        getTokenInfo(fromToken, chainId),
        getTokenInfo(toToken, chainId)
      ]);

      const normalizedAmount = normalizeAmountString(amount, fromInfo.decimals);
      const amountWei = ethers.parseUnits(normalizedAmount, fromInfo.decimals).toString();
      
      // Get quote for min out
      const quote = await getQuote(fromInfo.address, toInfo.address, amountWei, chainId);
      
      // Check if we're on testnet with mainnet fallback quote - can't actually execute
      const config = getChainConfig(chainId);
      if (quote.isMainnetQuote) {
        throw new Error(
          `TESTNET_NO_LIQUIDITY: Cannot execute swap on ${config.name}. ` +
          `No liquidity pools exist for ${fromInfo.symbol}/${toInfo.symbol} on this testnet. ` +
          `The quote was from mainnet for demonstration purposes only. ` +
          `Swaps require mainnet or Base where real liquidity pools exist. ` +
          `For testing on Sepolia, try transfers instead.`
        );
      }
      
      const minOut = (BigInt(quote.amountOut) * BigInt(10000 - slippageBps) / 10000n).toString();
      const feeTier = quote.feeTier || 3000;
      
      const deadline = Math.floor(Date.now() / 1000) + 900; // 15 minutes
      
      // Encode swap data - recipient is the wallet itself
      const swapEncoded = encodeSwapData(fromInfo, toInfo, amountWei, minOut, address, deadline, feeTier, chainId);
      
      // Get gas estimate
      const gasEstimate = await formatGasForOutput('swapSimple', gasTier, chainId);
      
      if (simulate) {
        return {
          simulation: true,
          walletAddress: address,
          fromToken: fromInfo.symbol,
          toToken: toInfo.symbol,
          amountIn: normalizedAmount,
          amountInWei: amountWei,
          expectedOut: ethers.formatUnits(quote.amountOut, toInfo.decimals),
          minOut: ethers.formatUnits(minOut, toInfo.decimals),
          poolFeeTier: feeTier,
          router: ADDRESSES.UNIVERSAL_ROUTER,
          
          // Gas info (real on-chain estimate)
          gas: {
            tier: gasTier,
            tierName: gasEstimate.gasTierName,
            costEth: gasEstimate.gasCostEth,
            costUsd: gasEstimate.gasCostUsd,
            confirmationTime: gasEstimate.confirmationTime,
            allTiers: gasEstimate.allTiers
          },
          
          message: `Swap simulation successful. Gas: ${gasEstimate.formatted}. Set simulate=false to execute.`,
          tip: 'Say "use faster gas" or "use slow gas" to change speed tier.'
        };
      }
      
      // Execute via delegation
      const { SignerDriver, executeWithDelegationSupport } = await import('../../lib/signer.js');
      const { ensureGas } = await import('../../lib/gasSponsor.js');
      
      const driver = new SignerDriver({ provider, logger: context?.logger });
      const signer = await driver.getSignerForWallet(address);
      
      // Sponsor gas if backend wallet is low
      const signerAddress = await signer.getAddress();
      const gasResult = await ensureGas(signerAddress, provider, context?.logger);
      if (gasResult.sponsored) {
        context?.logger?.info?.('gas_sponsored_for_swap', gasResult);
      }
      
      // If swapping FROM a token (not ETH), we need to approve the router first
      const fromIsEth = fromInfo.address === ADDRESSES.ETH;
      if (!fromIsEth) {
        context?.logger?.info?.('checking_token_approval', { token: fromInfo.symbol });
        
        // Check current allowance
        const tokenContract = new ethers.Contract(fromInfo.address, ERC20_ABI, provider);
        const currentAllowance = await tokenContract.allowance(address, ADDRESSES.UNIVERSAL_ROUTER);
        
        if (currentAllowance < BigInt(amountWei)) {
          context?.logger?.info?.('approving_token', { token: fromInfo.symbol, amount: amountWei });
          
          // Build approval transaction
          const approveData = tokenContract.interface.encodeFunctionData('approve', [
            ADDRESSES.UNIVERSAL_ROUTER,
            ethers.MaxUint256 // Approve max for future swaps
          ]);
          
          // Execute approval via delegation - pass tokenAddress for correct context!
          await signer.sendTransactionWithDelegation({
            to: fromInfo.address,
            data: approveData,
            value: 0n
          }, { tokenAddress: fromInfo.address });
          
          context?.logger?.info?.('token_approved', { token: fromInfo.symbol });
        }
      }
      
      // Get gas settings for the selected tier
      const gasSettings = await getGasPriceForTier(gasTier, chainId);
      
      // Execute the swap via delegation
      context?.logger?.info?.('executing_swap', { 
        from: fromInfo.symbol, 
        to: toInfo.symbol, 
        amount: normalizedAmount,
        gasTier
      });
      
      const receipt = await signer.sendTransactionWithDelegation({
        to: ADDRESSES.UNIVERSAL_ROUTER,
        data: swapEncoded.data,
        value: swapEncoded.value,
        maxPriorityFeePerGas: gasSettings.maxPriorityFeePerGas,
        maxFeePerGas: gasSettings.maxFeePerGas
      });
      
      // Clear pending swap from memory
      if (context?.remember) {
        context.remember('pendingSwapIntent', null);
      }
      
      // Get actual gas used for reporting
      const gasUsed = receipt.gasUsed ? receipt.gasUsed.toString() : 'unknown';
      const effectiveGasPrice = receipt.effectiveGasPrice 
        ? ethers.formatUnits(receipt.effectiveGasPrice, 'gwei') + ' gwei'
        : 'unknown';
      
      return {
        success: true,
        txHash: receipt.hash || receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        walletAddress: address,
        fromToken: fromInfo.symbol,
        toToken: toInfo.symbol,
        amountIn: normalizedAmount,
        amountInWei: amountWei,
        minOut: ethers.formatUnits(minOut, toInfo.decimals),
        
        // Gas info
        gas: {
          tier: gasTier,
          gasUsed,
          effectiveGasPrice
        },
        
        message: `Successfully swapped ${normalizedAmount} ${fromInfo.symbol} to ${toInfo.symbol}`
      };
    }
  },

  {
    name: 'check_pool_liquidity',
    description: `Check available Uniswap V3 liquidity pools for a token pair. Shows which fee tiers exist and which gives best rate.

You can query other chains using queryChainId:
- 1 = Ethereum Mainnet
- 8453 = Base  
- 11155111 = Sepolia (testnet)`,
    parameters: z.object({
      fromToken: z.string().describe('Token to sell'),
      toToken: z.string().describe('Token to buy'),
      amount: z.string().describe('Amount to swap (to compare rates)'),
      queryChainId: z.number().optional()
        .describe('Optional: Query a different chain (1=Ethereum, 8453=Base, 11155111=Sepolia)')
    }),
    tags: ['free', 'read-only'],
    handler: async ({ fromToken, toToken, amount, queryChainId }, context) => {
      // Use queryChainId if provided, otherwise fall back to context chainId
      const chainId = queryChainId || context?.chainId;
      const ADDRESSES = getAddressesForChain(chainId);
      
      const [fromInfo, toInfo] = await Promise.all([
        getTokenInfo(fromToken, chainId),
        getTokenInfo(toToken, chainId)
      ]);

      const normalizedAmount = normalizeAmountString(amount, fromInfo.decimals);
      const amountWei = ethers.parseUnits(normalizedAmount, fromInfo.decimals).toString();

      const provider = getProvider(chainId);
      const quoter = new ethers.Contract(ADDRESSES.QUOTER_V2, QUOTER_ABI, provider);
      
      const actualTokenIn = fromInfo.address === ADDRESSES.ETH ? ADDRESSES.WETH : fromInfo.address;
      const actualTokenOut = toInfo.address === ADDRESSES.ETH ? ADDRESSES.WETH : toInfo.address;

      const tierResults = await Promise.all(
        FEE_TIERS.map(async (fee) => {
          try {
            const result = await quoter.quoteExactInputSingle.staticCall({
              tokenIn: actualTokenIn, tokenOut: actualTokenOut, amountIn: amountWei, fee, sqrtPriceLimitX96: 0
            });
            return {
              feeTier: fee,
              feePercent: (fee / 10000).toFixed(2) + '%',
              exists: true,
              amountOut: ethers.formatUnits(result.amountOut, toInfo.decimals)
            };
          } catch {
            return { feeTier: fee, feePercent: (fee / 10000).toFixed(2) + '%', exists: false };
          }
        })
      );

      const available = tierResults.filter(r => r.exists);
      const best = available.length > 0 
        ? available.reduce((a, b) => parseFloat(b.amountOut) > parseFloat(a.amountOut) ? b : a)
        : null;

      const config = getChainConfig(chainId);
      return {
        fromToken: fromInfo.symbol,
        toToken: toInfo.symbol,
        amountIn: normalizedAmount,
        poolsAvailable: available.length,
        allPools: tierResults,
        bestPool: best,
        recommendation: best 
          ? `Best rate at ${best.feePercent} pool: ${normalizedAmount} ${fromInfo.symbol} → ${best.amountOut} ${toInfo.symbol}`
          : `No liquidity pools found for ${fromInfo.symbol}/${toInfo.symbol}`,
        
        // Chain info (helpful when querying other chains)
        chain: config.name,
        chainId: chainId,
        isRemoteQuery: queryChainId ? true : false
      };
    }
  }
];

