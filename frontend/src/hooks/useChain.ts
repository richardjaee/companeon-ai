'use client';

import { useParams, usePathname, useRouter } from 'next/navigation';
import { useMemo } from 'react';
import { ChainType, ChainConfig, getChainConfig, getChainType } from '@/lib/config';

/**
 * Hook to access current chain configuration based on URL
 *
 * Usage:
 * const { chain, config, switchChain } = useChain();
 *
 * @returns Chain type, configuration, and switch function
 */
export function useChain() {
  const params = useParams();
  const pathname = usePathname();
  const router = useRouter();

  // Extract chain from URL params
  const chainParam = params?.chain as string | undefined;

  // Determine current chain
  const chain: ChainType = useMemo(() => {
    return getChainType(chainParam, 'base');
  }, [chainParam]);

  // Get chain configuration
  const config: ChainConfig = useMemo(() => {
    return getChainConfig(chain);
  }, [chain]);

  // Function to switch chains
  const switchChain = (newChain: ChainType) => {
    if (newChain === chain) return;
    if (!pathname) return;

    // Replace current chain in pathname
    const newPathname = pathname.replace(`/${chain}/`, `/${newChain}/`);
    router.push(newPathname);
  };

  return {
    chain,
    config,
    switchChain,
  };
}

/**
 * Hook to just get chain config without other utilities
 * Useful for server components
 */
export function useChainConfig() {
  const params = useParams();
  const chainParam = params?.chain as string | undefined;
  const chain = getChainType(chainParam, 'base');
  return getChainConfig(chain);
}
