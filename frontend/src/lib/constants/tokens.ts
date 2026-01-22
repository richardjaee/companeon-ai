import { ethers } from 'ethers';
import * as Sentry from '@sentry/nextjs';

import { ChainType } from '@/lib/config';
import { BASE_TOKENS } from './tokens.base';
import { MAINNET_TOKENS } from './tokens.mainnet';
import { SEPOLIA_TOKENS } from './tokens.sepolia';

export type TokenCategory =
  | 'stablecoins'
  | 'memecoins'
  | 'defi-protocols'
  | 'liquid-staking'
  | 'layer1-blockchains'
  | 'layer2-scaling'
  | 'gaming-metaverse'
  | 'ai-data'
  | 'exchange-tokens'
  | 'infrastructure'
  | 'nft-ecosystem'
  | 'privacy'
  | 'real-world-assets'
  | 'social-content'
  | 'prediction-markets'
  | 'derivatives'
  | 'dao-governance'
  | 'payments'
  | 'renewable-energy'
  | 'web3'
  | 'utility'
  | 'gaming'
  | 'exchange'
  | 'knowledge'
  | 'defi'
  | 'governance'
  | 'bitcoin'
  | 'yield-farming'
  | 'lending'
  | 'leverage'
  | 'rwa'
  | 'stablecoin'
  | 'reserve-currency'
  | 'dex'
  | 'cross-chain'
  | 'sports'
  | 'fan-tokens'
  | 'ai'
  | 'analytics'
  | 'bridge'
  | 'cdn'
  | 'cloud-computing'
  | 'community'
  | 'data'
  | 'enterprise'
  | 'entertainment'
  | 'fintech'
  | 'gambling'
  | 'identity'
  | 'interoperability'
  | 'iot'
  | 'launchpad'
  | 'layer-1'
  | 'layer-2'
  | 'location'
  | 'logistics'
  | 'media'
  | 'meme'
  | 'messaging'
  | 'metaverse'
  | 'mixing'
  | 'mobile'
  | 'modular'
  | 'nft'
  | 'oracle'
  | 'play-to-earn'
  | 'scaling'
  | 'security'
  | 'social'
  | 'strategy'
  | 'streaming'
  | 'supply-chain'
  | 'telecommunications'
  | 'vpn'
  | 'wallet'
  | 'p2p'
  | 'base-ecosystem'
  | 'automation';

export interface TokenData {
  symbol: string;
  name: string;
  decimals: number;
  categories?: TokenCategory[];
  description?: string;
}

/**
 * Get token contracts for a specific chain
 * @param chain - 'base', 'mainnet', or 'sepolia'
 * @returns Token contracts for the specified chain
 */
export function getTokensForChain(chain: ChainType): Record<string, TokenData> {
  if (chain === 'mainnet') return MAINNET_TOKENS;
  if (chain === 'sepolia') return SEPOLIA_TOKENS;
  return BASE_TOKENS;
}

/**
 * Default token contracts (Base network for backwards compatibility)
 * For chain-specific tokens, use getTokensForChain(chain)
 */
export const TOKEN_CONTRACTS: Record<string, TokenData> = {
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": {
    "symbol": "USDT",
    "name": "Tether USDt",
    "decimals": 6,
    "categories": ["stablecoins"],
    "description": "USD-pegged stablecoin widely used for trading and settlement."
  },
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": {
    "symbol": "USDC",
    "name": "USDC",
    "decimals": 6,
    "categories": ["stablecoins"],
    "description": "Fully reserved dollar stablecoin issued by Circle."
  },
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": {
    "symbol": "DAI",
    "name": "Dai",
    "decimals": 18,
    "categories": ["stablecoins","defi-protocols"],
    "description": "Decentralized, overcollateralized USD stablecoin governed by MakerDAO."
  },
  // WETH (Base canonical WETH)
  "0x4200000000000000000000000000000000000006": {
    "symbol": "WETH",
    "name": "Wrapped Ether",
    "decimals": 18,
    "categories": ["layer1-blockchains","base-ecosystem"],
    "description": "Wrapped Ether on Base used for routing and liquidity."
  },
  // UNI (Base deployment)
  "0xc3de830ea07524a0761646a6a4e4be0e114a3c83": {
    "symbol": "UNI",
    "name": "Uniswap",
    "decimals": 18,
    "categories": ["defi-protocols","dao-governance","base-ecosystem"],
    "description": "Uniswap governance token on Base."
  },
  // AAVE (Base deployment)
  "0x63706e401c06ac8513145b7687a14804d17f814b": {
    "symbol": "AAVE",
    "name": "Aave",
    "decimals": 18,
    "categories": ["defi-protocols","dao-governance","base-ecosystem"],
    "description": "Aave governance token on Base."
  },
  "0xbaa5cc21fd487b8fcc2f632f3f4e8d37262a0842": {
    "symbol": "MORPHO",
    "name": "Morpho",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Governance token for Morpho lending optimization protocol."
  },
  "0x8ee73c484a26e0a5df2ee2a4960b789967dd0415": {
    "symbol": "CRV",
    "name": "Curve DAO Token",
    "decimals": 18,
    "categories": ["defi-protocols","dao-governance"],
    "description": "Governance token for Curve Finance stablecoin AMM."
  },
  "0x2da56acb9ea78330f947bd57c54119debda7af71": {
    "symbol": "MOG",
    "name": "Mog Coin",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Community-driven memecoin."
  },
  "0x3992b27da26848c2b19cea6fd25ad5568b68ab98": {
    "symbol": "OM",
    "name": "MANTRA",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for MANTRA ecosystem focused on staking and DeFi."
  },
  "0xbcbaf311cec8a4eac0430193a528d9ff27ae38c1": {
    "symbol": "IOTX",
    "name": "IoTeX",
    "decimals": 18,
    "categories": ["layer1-blockchains"],
    "description": "Token of the IoTeX network focused on IoT and machine economy."
  },
  "0xb008bdcf9cdff9da684a190941dc3dca8c2cdd44": {
    "symbol": "FLUX",
    "name": "Flux",
    "decimals": 8,
    "categories": ["defi-protocols"],
    "description": "Token associated with decentralized compute and infrastructure services."
  },
  "0xf5dbaa3dfc5e81405c7306039fb037a3dcd57ce2": {
    "symbol": "BICO",
    "name": "Biconomy",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Biconomy multi-chain relayer and account abstraction infrastructure."
  },
  "0x2a06a17cbc6d0032cac2c6696da90f29d39a1a29": {
    "symbol": "BITCOIN",
    "name": "HarryPotterObamaSonic10Inu (ERC-20)",
    "decimals": 8,
    "categories": ["memecoins"],
    "description": "Parody memecoin inspired by internet culture."
  },
  "0xe0cd4cacddcbf4f36e845407ce53e87717b6601d": {
    "symbol": "ICNT",
    "name": "Impossible Cloud Network",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token linked to decentralized cloud and storage services."
  },
  "0x259fac10c5cbfefe3e710e1d9467f70a76138d45": {
    "symbol": "CTSI",
    "name": "Cartesi",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Cartesi’s verifiable compute and rollup ecosystem."
  },
  "0x3792dbdd07e87413247df995e692806aa13d3299": {
    "symbol": "OMI",
    "name": "ECOMI",
    "decimals": 18,
    "categories": ["nft","gaming"],
    "description": "Utility token for ECOMI and VeVe NFT ecosystem."
  },
  "0x2c24497d4086490e7ead87cc12597fb50c2e6ed6": {
    "symbol": "F",
    "name": "SynFutures",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for SynFutures decentralized derivatives protocol."
  },
  "0x54330d28ca3357f294334bdc454a032e7f353416": {
    "symbol": "OLAS",
    "name": "Autonolas",
    "decimals": 18,
    "categories": ["infrastructure"],
    "description": "Token for Autonolas network of autonomous agents and services."
  },
  "0xb20a4bd059f5914a2f8b9c18881c637f79efb7df": {
    "symbol": "ADS",
    "name": "Alkimi",
    "decimals": 11,
    "categories": ["defi-protocols"]
  },
  "0x97c806e7665d3afd84a8fe1837921403d59f3dcc": {
    "symbol": "ALI",
    "name": "Artificial Liquid Intelligence",
    "decimals": 18,
    "categories": ["ai-data"],
    "description": "Token for Alethea AI’s AI agent and synthetic media ecosystem."
  },
  "0xa7d68d155d17cb30e311367c2ef1e82ab6022b67": {
    "symbol": "BTRST",
    "name": "Braintrust",
    "decimals": 18,
    "categories": ["dao-governance"],
    "description": "Governance token for Braintrust decentralized talent network."
  },
  "0x7002458b1df59eccb57387bc79ffc7c29e22e6f7": {
    "symbol": "OGN",
    "name": "Origin Protocol",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Origin Protocol’s commerce and DeFi products."
  },
  "0x37f0c2915cecc7e977183b8543fc0864d03e064c": {
    "symbol": "HUNT",
    "name": "Hunt Town",
    "decimals": 18,
    "categories": ["gaming"]
  },
  "0x7588310a7abf34dc608ac98a1c4432f85e194df5": {
    "symbol": "FORT",
    "name": "Forta",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Forta network security and real-time threat monitoring."
  },
  "0x24fcfc492c1393274b6bcd568ac9e225bec93584": {
    "symbol": "MAVIA",
    "name": "Heroes of Mavia",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Gaming token for Heroes of Mavia strategy game."
  },
  "0xf732a566121fa6362e9e0fbdd6d66e5c8c925e49": {
    "symbol": "LITKEY",
    "name": "Lit Protocol",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Token associated with Lit Protocol’s decentralized key and access control."
  },
  "0xcd2f22236dd9dfe2356d7c543161d4d260fd9bcb": {
    "symbol": "GHST",
    "name": "Aavegotchi",
    "decimals": 18,
    "categories": ["gaming","nft"],
    "description": "Utility/governance token for Aavegotchi NFT gaming ecosystem."
  },
  "0x6fbf03efa4363ca0afe0c9c3906f7d610890b683": {
    "symbol": "GAIA",
    "name": "GAIA",
    "decimals": 18,
    "categories": ["gaming"]
  },
  "0xc48823ec67720a04a9dfd8c7d109b2c3d6622094": {
    "symbol": "MCADE",
    "name": "Metacade",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Community gaming and metaverse hub token."
  },
  "0x570b1533f6daa82814b25b62b5c7c4c55eb83947": {
    "symbol": "BOBO",
    "name": "BOBO",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Community-driven memecoin."
  },
  "0xb1e1f3cc2b6fe4420c1ac82022b457018eb628ff": {
    "symbol": "CXT",
    "name": "Covalent X Token",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token linked to Covalent data and indexing ecosystem."
  },
  "0xddb293bb5c5258f7484a94a0fbd5c8b2f6e4e376": {
    "symbol": "BKN",
    "name": "Brickken",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Tokenization platform for businesses and real-world assets."
  },
  "0x5eaa326fb2fc97facce6a79a304876dad0f2e96c": {
    "symbol": "DIMO",
    "name": "DIMO",
    "decimals": 18,
    "categories": ["analytics"],
    "description": "Mobility data protocol enabling vehicle data ownership and monetization."
  },
  "0xdae49c25fad3a62a8e8bfb6da12c46be611f9f7a": {
    "symbol": "KRL",
    "name": "Kryll",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Kryll automated trading strategies platform."
  },
  "0xbb22ff867f8ca3d5f2251b4084f6ec86d4666e14": {
    "symbol": "CTX",
    "name": "Cryptex Finance",
    "decimals": 18,
    "categories": ["defi-protocols"],
    "description": "Token for Cryptex Finance synthetic crypto index products."
  },
  "0x2192607c3cba9ec3d490206d10d831e68e5f3c97": {
    "symbol": "BOSON",
    "name": "Boson Protocol",
    "decimals": 18,
    "categories": ["metaverse"],
    "description": "Commerce protocol connecting physical products to on-chain commerce."
  },
  "0xc7dcca0a3e69bd762c8db257f868f76be36c8514": {
    "symbol": "KIBSHI",
    "name": "KiboShib",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Community memecoin."
  },
  "0x681a09a902d9c7445b3b1ab282c38d60c72f1f09": {
    "symbol": "AIKEK",
    "name": "Alphakek AI",
    "decimals": 18,
    "categories": ["memecoins"],
    "description": "Memecoin with AI-themed branding."
  },
  "0x27e3bc3a66e24cad043ac3d93a12a8070e3897ba": {
    "symbol": "OVR",
    "name": "OVR",
    "decimals": 18,
    "categories": ["metaverse"],
    "description": "Token for Over the Reality AR/metaverse platform."
  },
  "0x321725ee44cb4bfa544cf45a5a585b925d30a58c": {
    "symbol": "GROW",
    "name": "ValleyDAO",
    "decimals": 18,
    "categories": ["dao-governance"],
    "description": "ValleyDAO token for decentralized biotech and climate research funding."
  },
  "0xb676f87a6e701f0de8de5ab91b56b66109766db1": {
    "symbol": "LRDS",
    "name": "BLOCKLORDS",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Gaming token for BLOCKLORDS strategy game ecosystem."
  },
  "0xd85eff20288ca72ea9eecffb428f89ee5066ca5c": {
    "symbol": "ISK",
    "name": "ISKRA Token",
    "decimals": 18,
    "categories": ["gaming"],
    "description": "Token for ISKRA Web3 gaming platform."
  },
  "0x18bc5bcc660cf2b9ce3cd51a404afe1a0cbd3c22": {
    "symbol": "IDRX",
    "name": "IDRX",
    "decimals": 2,
    "categories": ["stablecoins"],
    "description": "Fiat-pegged stablecoin."
  }
};

export const ETH_TOKEN_DATA: TokenData = {
  symbol: 'ETH',
  name: 'Ethereum',
  decimals: 18,
  categories: ['layer1-blockchains'],
  description: 'Native cryptocurrency of the Ethereum blockchain network'
};

export const TOKEN_CATEGORY_LABELS: Record<TokenCategory, string> = {
  'stablecoins': 'Stablecoins',
  'memecoins': 'Meme Coins',
  'defi-protocols': 'DeFi Protocols',
  'liquid-staking': 'Liquid Staking',
  'layer1-blockchains': 'Layer 1 Blockchains',
  'layer2-scaling': 'Layer 2 & Scaling',
  'gaming-metaverse': 'Gaming & Metaverse',
  'ai-data': 'AI & Data',
  'exchange-tokens': 'Exchange Tokens',
  'infrastructure': 'Infrastructure',
  'nft-ecosystem': 'NFT Ecosystem',
  'privacy': 'Privacy',
  'real-world-assets': 'Real World Assets',
  'social-content': 'Social & Content',
  'prediction-markets': 'Prediction Markets',
  'derivatives': 'Derivatives',
  'dao-governance': 'DAO & Governance',
  'payments': 'Payments',
  'renewable-energy': 'Renewable Energy',
  'web3': 'Web3',
  'utility': 'Utility',
  'gaming': 'Gaming',
  'exchange': 'Exchange',
  'knowledge': 'Knowledge',
  'defi': 'DeFi',
  'governance': 'Governance',
  'bitcoin': 'Bitcoin',
  'yield-farming': 'Yield Farming',
  'lending': 'Lending',
  'leverage': 'Leverage',
  'rwa': 'Real World Assets',
  'stablecoin': 'Stablecoin',
  'reserve-currency': 'Reserve Currency',
  'dex': 'DEX',
  'cross-chain': 'Cross-Chain',
  'sports': 'Sports',
  'fan-tokens': 'Fan Tokens',
  'ai': 'AI',
  'analytics': 'Analytics',
  'bridge': 'Bridge',
  'cdn': 'CDN',
  'cloud-computing': 'Cloud Computing',
  'community': 'Community',
  'data': 'Data',
  'enterprise': 'Enterprise',
  'entertainment': 'Entertainment',
  'fintech': 'Fintech',
  'gambling': 'Gambling',
  'identity': 'Identity',
  'interoperability': 'Interoperability',
  'iot': 'IoT',
  'launchpad': 'Launchpad',
  'layer-1': 'Layer 1',
  'layer-2': 'Layer 2',
  'location': 'Location',
  'logistics': 'Logistics',
  'media': 'Media',
  'meme': 'Meme',
  'messaging': 'Messaging',
  'metaverse': 'Metaverse',
  'mixing': 'Mixing',
  'mobile': 'Mobile',
  'modular': 'Modular',
  'nft': 'NFT',
  'oracle': 'Oracle',
  'play-to-earn': 'Play to Earn',
  'scaling': 'Scaling',
  'security': 'Security',
  'social': 'Social',
  'strategy': 'Strategy',
  'streaming': 'Streaming',
  'supply-chain': 'Supply Chain',
  'telecommunications': 'Telecommunications',
  'vpn': 'VPN',
  'wallet': 'Wallet',
  'p2p': 'P2P',
  'base-ecosystem': 'Base Ecosystem',
  'automation': 'Automation'
};

export const TOKEN_CATEGORY_DESCRIPTIONS: Record<TokenCategory, string> = {
  'stablecoins': 'Cryptocurrencies pegged to stable assets like USD',
  'memecoins': 'Community-driven tokens inspired by internet memes',
  'defi-protocols': 'Tokens powering decentralized finance applications',
  'liquid-staking': 'Tokens representing staked assets with liquidity',
  'layer1-blockchains': 'Native tokens of independent blockchain networks',
  'layer2-scaling': 'Tokens for Ethereum scaling solutions',
  'gaming-metaverse': 'Tokens for gaming and virtual world platforms',
  'ai-data': 'Tokens for artificial intelligence and data services',
  'exchange-tokens': 'Utility tokens from centralized exchanges',
  'infrastructure': 'Tokens supporting blockchain infrastructure',
  'nft-ecosystem': 'Tokens related to NFT marketplaces and creation',
  'privacy': 'Tokens focused on privacy and anonymity',
  'real-world-assets': 'Tokens backed by physical assets like gold',
  'social-content': 'Tokens for social networks and content creation',
  'prediction-markets': 'Tokens for forecasting and betting platforms',
  'derivatives': 'Tokens representing financial derivatives',
  'dao-governance': 'Tokens for decentralized autonomous organizations',
  'payments': 'Tokens optimized for payment and money transfer',
  'renewable-energy': 'Tokens focused on sustainable and renewable energy solutions',
  'web3': 'Tokens for Web3 platforms and decentralized applications',
  'utility': 'Tokens providing utility within specific platforms or ecosystems',
  'gaming': 'Tokens for gaming platforms and virtual worlds',
  'exchange': 'Tokens from cryptocurrency exchanges and trading platforms',
  'knowledge': 'Tokens for knowledge sharing and educational platforms',
  'defi': 'Decentralized finance tokens',
  'governance': 'Governance tokens for protocol decision making',
  'bitcoin': 'Bitcoin-related tokens and assets',
  'yield-farming': 'Tokens for yield farming and liquidity mining',
  'lending': 'Tokens for decentralized lending protocols',
  'leverage': 'Tokens for leveraged trading and margin platforms',
  'rwa': 'Real world asset backed tokens',
  'stablecoin': 'Stablecoin tokens pegged to external assets',
  'reserve-currency': 'Reserve currency protocol tokens',
  'dex': 'Decentralized exchange tokens',
  'cross-chain': 'Cross-chain and bridge protocol tokens',
  'sports': 'Sports and athletics related tokens',
  'fan-tokens': 'Fan engagement tokens for sports teams and entertainment',
  'ai': 'Artificial intelligence tokens',
  'analytics': 'Analytics and data analysis tokens',
  'bridge': 'Cross-chain bridge tokens',
  'cdn': 'Content delivery network tokens',
  'cloud-computing': 'Cloud computing service tokens',
  'community': 'Community-driven tokens',
  'data': 'Data management and storage tokens',
  'enterprise': 'Enterprise blockchain solutions',
  'entertainment': 'Entertainment and media tokens',
  'fintech': 'Financial technology tokens',
  'gambling': 'Gambling and betting tokens',
  'identity': 'Digital identity tokens',
  'interoperability': 'Blockchain interoperability tokens',
  'iot': 'Internet of Things tokens',
  'launchpad': 'Token launchpad platforms',
  'layer-1': 'Layer 1 blockchain tokens',
  'layer-2': 'Layer 2 scaling tokens',
  'location': 'Location-based service tokens',
  'logistics': 'Logistics and supply chain tokens',
  'media': 'Media and content tokens',
  'meme': 'Meme-based tokens',
  'messaging': 'Messaging and communication tokens',
  'metaverse': 'Metaverse and virtual world tokens',
  'mixing': 'Privacy mixing tokens',
  'mobile': 'Mobile platform tokens',
  'modular': 'Modular blockchain tokens',
  'nft': 'Non-fungible token related',
  'oracle': 'Oracle service tokens',
  'play-to-earn': 'Play-to-earn gaming tokens',
  'scaling': 'Blockchain scaling solutions',
  'security': 'Security and privacy tokens',
  'social': 'Social platform tokens',
  'strategy': 'Strategy and investment tokens',
  'streaming': 'Streaming service tokens',
  'supply-chain': 'Supply chain management tokens',
  'telecommunications': 'Telecommunications tokens',
  'vpn': 'VPN and privacy tokens',
  'wallet': 'Wallet service tokens',
  'p2p': 'Peer-to-peer network tokens',
  'base-ecosystem': 'Tokens native to or core to the Base ecosystem',
  'automation': 'Automation and agent-based protocol tokens'
};

export const DEFAULT_TOKEN_DECIMALS = 18;

export interface TokenInfo {
  contractAddress: string;
  symbol: string;
  name: string;
  decimals: number;
  logoPath?: string;
  priceInUSD?: number;
}

export interface TokenDisplay extends TokenInfo {
  balance: string;
  priceInUSD: number;
  totalValueInUSD: string;
}

export const TOKEN_LOGO_BASE_PATH = '/logos';

export const getTokenDataByAddress = (contractAddress: string): TokenData | null => {

  if (!contractAddress || contractAddress.toLowerCase() === 'native') {
    return ETH_TOKEN_DATA;
  }
  
  const normalizedAddress = contractAddress.toLowerCase();
  const tokenData = Object.entries(TOKEN_CONTRACTS).find(
    ([address]) => address.toLowerCase() === normalizedAddress
  );
  
  if (tokenData) {
    return tokenData[1];
  }
  
  return null;
};

export const getTokenLogoByAddress = (contractAddress: string, alchemyLogoUrl?: string): string => {
  // If alchemy provides a logo URL, use that (most reliable)
  if (alchemyLogoUrl) {
    return alchemyLogoUrl;
  }

  if (!contractAddress) {
    return '/placeholder.png';
  }

  // Handle native ETH
  if (contractAddress.toLowerCase() === 'native' || contractAddress.toLowerCase() === 'eth') {
    return '/logos/eth-logo.png';
  }

  // For contract addresses, look up the symbol
  const tokenData = getTokenDataByAddress(contractAddress);
  if (tokenData?.symbol) {
    const normalizedSymbol = tokenData.symbol.toLowerCase();
    // Only return local path for tokens we know we have logos for
    const knownLogos = ['eth', 'usdc', 'usdt', 'dai', 'weth', 'wbtc', 'link', 'uni', 'aave'];
    if (knownLogos.includes(normalizedSymbol)) {
      return `/logos/${normalizedSymbol}-logo.png`;
    }
  }

  // Default placeholder for unknown tokens
  return '/placeholder.png';
};

export const getTokenLogo = (contractAddress: string, alchemyLogoUrl?: string): string => {
  return getTokenLogoByAddress(contractAddress, alchemyLogoUrl);
};

export const needsWhiteBackground = (contractAddress: string): boolean => {
  const tokenData = getTokenDataByAddress(contractAddress);
  const symbol = tokenData?.symbol?.toLowerCase() || '';
  
  const tokensNeedingWhiteBackground = ['usdc', 'usdt', 'dai', 'busd'];
  return tokensNeedingWhiteBackground.includes(symbol);
};

/**
 * Get token price from price cache with consistent lookups
 * Tries multiple strategies: uppercase symbol, original symbol, uppercase address
 */
export const getTokenPrice = (tokenSymbol: string, tokenAddress: string, priceCache: Record<string, any>): number => {
  if (!priceCache || !tokenSymbol) return 0;
  
  const upperSymbol = tokenSymbol.toUpperCase();
  let price = priceCache[upperSymbol]?.price || priceCache[upperSymbol];
  if (price && typeof price === 'number' && price > 0) return price;
  
  price = priceCache[tokenSymbol]?.price || priceCache[tokenSymbol];
  if (price && typeof price === 'number' && price > 0) return price;
  
  if (tokenAddress) {
    const upperAddress = tokenAddress.toUpperCase();
    price = priceCache[upperAddress]?.price || priceCache[upperAddress];
    if (price && typeof price === 'number' && price > 0) return price;
    
    price = priceCache[tokenAddress]?.price || priceCache[tokenAddress];
    if (price && typeof price === 'number' && price > 0) return price;
  }
  
  return 0;
};

export const getSupportedTokens = (): TokenInfo[] => {
  const tokens: TokenInfo[] = Object.entries(TOKEN_CONTRACTS).map(([address, data]) => ({
    contractAddress: address,
    symbol: data.symbol,
    name: data.name,
    decimals: data.decimals,
    logoPath: getTokenLogoByAddress(address)
  }));
  
  tokens.unshift({
    contractAddress: 'native',
    symbol: ETH_TOKEN_DATA.symbol,
    name: ETH_TOKEN_DATA.name,
    decimals: ETH_TOKEN_DATA.decimals,
    logoPath: getTokenLogoByAddress('native')
  });
  
  return tokens;
};

export const isTokenSupported = (contractAddress: string, chain?: ChainType): boolean => {
  if (contractAddress.toLowerCase() === 'native') return true;

  // If chain is specified, check that chain's tokens
  if (chain) {
    const chainTokens = getTokensForChain(chain);
    const tokenAddresses = Object.keys(chainTokens);
    const isSupported = tokenAddresses.some(
      address => address.toLowerCase() === contractAddress.toLowerCase()
    );

    return isSupported;
  }

  // Fallback to default TOKEN_CONTRACTS
  return Object.keys(TOKEN_CONTRACTS).some(
    address => address.toLowerCase() === contractAddress.toLowerCase()
  );
};

export const getTokensByCategory = (category: TokenCategory): TokenInfo[] => {
  const allTokens = getSupportedTokens();
  return allTokens.filter(token => {
    const tokenData = getTokenDataByAddress(token.contractAddress);
    return tokenData?.categories?.includes(category);
  });
};

export const getTokenCategories = (contractAddress: string): TokenCategory[] => {
  const tokenData = getTokenDataByAddress(contractAddress);
  return tokenData?.categories || [];
};

export const getAllTokenCategories = (): TokenCategory[] => {
  const categories = new Set<TokenCategory>();
  
  ETH_TOKEN_DATA.categories?.forEach(cat => categories.add(cat));
  
  Object.values(TOKEN_CONTRACTS).forEach(token => {
    token.categories?.forEach(cat => categories.add(cat));
  });
  
  return Array.from(categories).sort();
};

export const getCategoryStats = (): Record<TokenCategory, number> => {
  const stats: Partial<Record<TokenCategory, number>> = {};
  
  ETH_TOKEN_DATA.categories?.forEach(cat => {
    stats[cat] = (stats[cat] || 0) + 1;
  });
  
  Object.values(TOKEN_CONTRACTS).forEach(token => {
    token.categories?.forEach(cat => {
      stats[cat] = (stats[cat] || 0) + 1;
    });
  });
  
  return stats as Record<TokenCategory, number>;
};

// Removed legacy value calculator

export const getAssetDetails = (contractAddress: string): { name: string; address: string } => {
  if (!contractAddress || contractAddress.toLowerCase() === 'native') {
    return {
      name: 'Ethereum',
      address: 'Native'
    };
  }

  const tokenData = getTokenDataByAddress(contractAddress);
  
  return {
    name: tokenData?.name || 'Unknown Token',
    address: contractAddress
  };
};
