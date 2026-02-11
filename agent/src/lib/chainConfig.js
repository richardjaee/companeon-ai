/**
 * chainConfig.js - Multi-chain configuration
 * 
 * Supports: Ethereum Mainnet (1), Sepolia (11155111)
 * Set CHAIN_ID env var to switch chains
 */

// Chain configurations
const CHAINS = {
  // Ethereum Sepolia (for ERC-7715 Advanced Permissions testing)
  11155111: {
    name: 'Ethereum Sepolia',
    chainId: 11155111,
    tokens: {
      ETH: '0x0000000000000000000000000000000000000000',
      WETH: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14',
      USDC: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // Circle's test USDC
      USDT: '0xaA8E23Fb1079EA71e0a56F48a2aA51851D8433D0', // Tether test USDT
      DAI: '0x68194a729C2450ad26072b3D33ADaCbcef39D5741', // MakerDAO test DAI
      WBTC: '0xFF82bb860F4c5f9b5836E4b5e7c9E9e8c6a1b8c', // Wrapped BTC test
      UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', // Same as mainnet
      LINK: '0x779877A7B0D9E8603169DdbD7836e478b4624789', // Chainlink test LINK
    },
    routers: {
      UNIVERSAL_ROUTER: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD', // Same as mainnet
      V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564', // Same as mainnet
      V3_ROUTER_02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45', // Same as mainnet
    },
    quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // Same as mainnet
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    explorer: 'https://sepolia.etherscan.io',
    rpcEnvKey: 'SEPOLIA_RPC_URL',
    rpcDefault: 'https://rpc.sepolia.org',
    // x402 works on Sepolia via Circle's test USDC (EIP-3009 supported)
    // Payment settles on Sepolia, then Perplexity API is called (same as mainnet)
    x402Supported: true,
    x402Network: 'eip155:11155111', // EIP-155 chain ID format for x402
    // ERC-7715 Advanced Permissions are ONLY on Sepolia for testing!
    erc7715Supported: true,
    delegationManager: '0x0', // Will be set when MetaMask releases testnet contracts
  },

  // Ethereum Mainnet
  1: {
    name: 'Ethereum Mainnet',
    chainId: 1,
    tokens: {
      ETH: '0x0000000000000000000000000000000000000000',
      WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      USDC: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
      DAI: '0x6B175474E89094C44Da98b954EesC803Edec7A0',
      WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984',
      LINK: '0x514910771AF9Ca656af840dff83E8264EcF986CA',
      AAVE: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9',
    },
    routers: {
      UNIVERSAL_ROUTER: '0x3fC91A3afd70395Cd496C647d5a6CC9D4B2b7FAD',
      V3_ROUTER: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      V3_ROUTER_02: '0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45',
    },
    quoter: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e', // QuoterV2
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    explorer: 'https://etherscan.io',
    rpcEnvKey: 'ETH_RPC_URL', // Environment variable for RPC
    rpcDefault: 'https://eth-mainnet.g.alchemy.com/v2/',
    // x402 is chain-agnostic! Works on Ethereum mainnet via eip155:1
    x402Supported: true,
    x402Network: 'eip155:1', // EIP-155 chain ID format for x402
    erc7715Supported: true,
  },
};

// Default chain from environment
const DEFAULT_CHAIN_ID = parseInt(process.env.CHAIN_ID || '1', 10);

// Thread-local storage for per-request chain ID
let _requestChainId = null;

/**
 * Set the chain ID for the current request context
 * Call this at the start of each request handler
 */
export function setRequestChainId(chainId) {
  _requestChainId = chainId ? parseInt(chainId, 10) : null;
}

/**
 * Clear the request chain ID (call at end of request)
 */
export function clearRequestChainId() {
  _requestChainId = null;
}

/**
 * Get current chain ID (request-specific or default)
 */
export function getChainId(overrideChainId = null) {
  // Priority: explicit override > request context > env default
  if (overrideChainId) {
    const parsed = parseInt(overrideChainId, 10);
    if (CHAINS[parsed]) return parsed;
  }
  if (_requestChainId && CHAINS[_requestChainId]) {
    return _requestChainId;
  }
  return DEFAULT_CHAIN_ID;
}

/**
 * Get chain config for a specific chain or current context
 */
export function getChainConfig(chainId = null) {
  const effectiveChainId = getChainId(chainId);
  const config = CHAINS[effectiveChainId];
  if (!config) {
    
    return CHAINS[1];
  }
  return config;
}

/**
 * Get RPC URL for current chain
 */
export function getRpcUrl(chainId = null) {
  const config = getChainConfig(chainId);
  // Check for chain-specific env var first
  if (config.rpcEnvKey && process.env[config.rpcEnvKey]) {
    return process.env[config.rpcEnvKey];
  }
  // Fall back to generic RPC_URL or ALCHEMY_RPC_URL
  return process.env.ALCHEMY_RPC_URL || process.env.RPC_URL || config.rpcDefault;
}

/**
 * Get specific token address
 */
export function getTokenAddress(symbol, chainId = null) {
  const config = getChainConfig(chainId);
  const addr = config.tokens[symbol.toUpperCase()];
  if (!addr) {
    throw new Error(`Token ${symbol} not found on ${config.name}`);
  }
  return addr;
}

// Get router address
export function getRouterAddress(routerName = 'UNIVERSAL_ROUTER') {
  const config = getChainConfig();
  return config.routers[routerName];
}

// Get quoter address
export function getQuoterAddress() {
  return getChainConfig().quoter;
}

// Check if x402 is supported on current chain
export function isX402Supported() {
  return getChainConfig().x402Supported;
}

// Get x402 network identifier (eip155:chainId format)
export function getX402Network() {
  return getChainConfig().x402Network;
}

// Get all token metadata for current chain
export function getTokenMetadata() {
  const config = getChainConfig();
  const metadata = {};
  for (const [symbol, address] of Object.entries(config.tokens)) {
    // Determine decimals based on token type
    let decimals = 18;
    if (['USDC', 'USDT'].includes(symbol)) decimals = 6;
    if (symbol === 'WBTC') decimals = 8;
    
    metadata[symbol] = { symbol, address, decimals };
  }
  return metadata;
}

// Get explorer URL for transaction
export function getExplorerTxUrl(txHash) {
  const config = getChainConfig();
  return `${config.explorer}/tx/${txHash}`;
}

// Export for direct access
export const CURRENT_CHAIN = getChainConfig();
export const CHAIN_ID = getChainId();

export default {
  getChainConfig,
  getTokenAddress,
  getRouterAddress,
  getQuoterAddress,
  isX402Supported,
  getTokenMetadata,
  getExplorerTxUrl,
  CURRENT_CHAIN,
  CHAIN_ID,
};

