/**
 * chainConfig.js - Multi-chain configuration
 * 
 * Supports: Base (8453), Ethereum Mainnet (1)
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

  // Base Sepolia Testnet (x402 supported!)
  84532: {
    name: 'Base Sepolia',
    chainId: 84532,
    tokens: {
      ETH: '0x0000000000000000000000000000000000000000',
      WETH: '0x4200000000000000000000000000000000000006',
      USDC: '0x036CbD53842c5426634e7929541eC2318f3dCF7e', // Circle's test USDC on Base Sepolia
      // Add more test tokens as needed
    },
    routers: {
      UNIVERSAL_ROUTER: '0x050E797f3625EC8785265e1d9BDd4799b97528A1', // Uniswap on Base Sepolia
      V3_ROUTER: '0x94cC0AaC535CCDB3C01d6787D6413C739ae12bc4',
    },
    quoter: '0xC5290058841028F1614F3A6F0F5816cAd0df5E27', // QuoterV2 on Base Sepolia
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    explorer: 'https://sepolia.basescan.org',
    rpcEnvKey: 'BASE_SEPOLIA_RPC_URL',
    rpcDefault: 'https://sepolia.base.org',
    x402Supported: true,
    x402Network: 'eip155:84532', // CAIP-2 format for x402
    erc7715Supported: false, // Base Sepolia doesn't have ERC-7715 yet
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
  },

  // Base Mainnet
  8453: {
    name: 'Base',
    chainId: 8453,
    tokens: {
      ETH: '0x0000000000000000000000000000000000000000',
      WETH: '0x4200000000000000000000000000000000000006',
      USDC: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      USDT: '0xfde4C96c8593536e31F229EA8f37b2ADa2699bb2',
      DAI: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb',
      WBTC: '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c',
      UNI: '0xc3De830EA07524a0761646a6a4e4be0e114a3C83',
      LINK: '0x88Fb150BDc53A65fe94Dea0c9BA0a6dAf8C6e196',
      AAVE: '0x0c9d8c7e486e822C29488bF1E4966eFC5c718856',
      cbETH: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
      rETH: '0xB6fe221Fe9EeF5aBa221c348bA20A1Bf5e73624c',
      TOSHI: '0xAC1Bd2486aAf3B5C0fc3Fd868558b082a531B2B4',
      DEGEN: '0x4ed4E862860beD51a9570b96d89aF5E1B0Efefed',
      BRETT: '0x532f27101965dd16442E59d40670FaF5eBB142E4',
      VIRTUAL: '0x0b3e328455c4059EEb9e3f84b5543F74E24e7E1b',
      MORPHO: '0xBAa5CC21fd487B8Fcc2F632f3F4E8D37262a0842',
      MOG: '0x2Da56AcB9Ea78330f947bD57C54119Debda7AF71',
      HIGHER: '0x0578d8A44db98B23BF096A382e016e29a5Ce0ffe',
      WELL: '0xA88594D404727625A9437C3f886C7643872296AE',
      SPEC: '0x96419929d7949D6A801A6909c145C8EEf6A40431',
      KEYCAT: '0x9a26F5433671751C3276a065f57e5a02D2817973',
      SPX: '0x50dA645f148798F68EF2d7dB7C1CB22A6819bb2C',
      AERO: '0x940181a94A35A4569E4529A3CDfB74e38FD98631',
      AIXBT: '0x4F9Fd6Be4a90f2620860d680c0d4d5Fb53d1A825',
    },
    routers: {
      UNIVERSAL_ROUTER: '0x6ff5693b99212da76ad316178a184ab56d299b43',
      V3_ROUTER: '0x2626664c2603336E57B271c5C0b26F421741e481',
      // Additional routers allowed by AgentController
      ONEINCH: '0x111111125421cA6dc452d289314280a0f8842A65',
      ZEROX: '0xDef1C0ded9bec7F1a1670819833240f027b25EfF',
      PARASWAP: '0xDEF171Fe48CF0115B1d80b88dc8eAB59176FEe57',
      COWSWAP: '0x9008D19f58AAbD9eD0D60971565AA8510560ab41',
    },
    quoter: '0x3d4e44Eb1374240CE5F1B871ab261CD16335B76a', // QuoterV2 on Base
    permit2: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    explorer: 'https://basescan.org',
    rpcEnvKey: 'BASE_RPC_URL', // Environment variable for RPC
    rpcDefault: 'https://mainnet.base.org',
    x402Supported: true,
    x402Network: 'eip155:8453', // EIP-155 chain ID format for x402
  }
};

// Default chain from environment
const DEFAULT_CHAIN_ID = parseInt(process.env.CHAIN_ID || '8453', 10);

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
    console.warn(`Unknown chain ${effectiveChainId}, falling back to Base`);
    return CHAINS[8453];
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

