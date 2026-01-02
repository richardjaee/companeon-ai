export type ChainType = 'base' | 'mainnet' | 'sepolia';

export interface ChainConfig {
  name: string;
  shortName: string;
  chainId: number;
  chainIdHex: string;
  rpcUrl: string;
  blockExplorer: string;
  nativeCurrency: { name: string; symbol: string; decimals: number };
}

export interface ChainContextValue {
  chain: ChainType;
  config: ChainConfig;
  switchChain: (newChain: ChainType) => void;
}
