import { ethers } from 'ethers';
import * as Sentry from '@sentry/nextjs';

import { ChainType } from '@/lib/config';
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
 * @param chain - 'mainnet' or 'sepolia'
 * @returns Token contracts for the specified chain
 */
export function getTokensForChain(chain: ChainType): Record<string, TokenData> {
  if (chain === 'sepolia') return SEPOLIA_TOKENS;
  return MAINNET_TOKENS;
}

/**
 * Default token contracts (Ethereum Mainnet)
 * For chain-specific tokens, use getTokensForChain(chain)
 */
export const TOKEN_CONTRACTS: Record<string, TokenData> = MAINNET_TOKENS;

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
