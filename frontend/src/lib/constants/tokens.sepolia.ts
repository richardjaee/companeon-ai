import { TokenData } from './tokens';

/**
 * Sepolia Testnet Token Addresses
 * Chain ID: 11155111
 */
export const SEPOLIA_TOKENS: Record<string, TokenData> = {
  '0x1c7d4b196cb0c7b01d743fbc6116a902379c7238': {
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    categories: ['stablecoins'],
    description: 'USD-pegged stablecoin for Sepolia testnet'
  },
  '0xfff9976782d46cc05630d1f6ebab18b2324d6b14': {
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    categories: ['layer1-blockchains'],
    description: 'Wrapped Ether on Sepolia testnet'
  }
};
