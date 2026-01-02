/**
 * Chain Configuration System
 * Central export for all chain-related configurations
 */

export type { ChainType, ChainConfig, ChainContextValue } from './types';
export { getChainType, getChainConfig, isValidChain, CHAINS } from './chains';
