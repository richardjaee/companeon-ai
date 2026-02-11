import { ChainConfig, ChainType } from '../types';

const CHAINS: Record<ChainType, ChainConfig> = {
  mainnet: {
    name: 'Ethereum',
    shortName: 'mainnet',
    chainId: 1,
    chainIdHex: '0x1',
    rpcUrl: 'https://rpc.ankr.com/eth',
    blockExplorer: 'https://etherscan.io',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  },
  sepolia: {
    name: 'Sepolia',
    shortName: 'sepolia',
    chainId: 11155111,
    chainIdHex: '0xaa36a7',
    rpcUrl: 'https://rpc.sepolia.org',
    blockExplorer: 'https://sepolia.etherscan.io',
    nativeCurrency: { name: 'Sepolia Ether', symbol: 'ETH', decimals: 18 },
  },
};

export function getChainType(input?: string, fallback: ChainType = 'mainnet'): ChainType {
  if (!input) return fallback;
  const key = input.toLowerCase();
  if (key === 'mainnet' || key === 'sepolia') return key as ChainType;
  return fallback;
}

export function getChainConfig(chain: ChainType): ChainConfig {
  return CHAINS[chain];
}

export function isValidChain(input?: string): boolean {
  if (!input) return false;
  const key = input.toLowerCase();
  return key === 'mainnet' || key === 'sepolia';
}

export { CHAINS };
