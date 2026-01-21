import { useQuery } from '@tanstack/react-query';
import { nftApi } from '@/lib/api/nft';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useChain } from './useChain';

interface SolanaProgramData {
  ownerAddress: string;
  programIds: {
    mainProgram: string;
    sbtProgram: string;
  };
  pdaDerivation: {
    programSeeds: {
      prefix: string;
      owner: string;
    };
    sbtStateSeeds: {
      prefix: string;
    };
  };
  standardPrograms: {
    tokenProgram: string;
    associatedTokenProgram: string;
    systemProgram: string;
    rent: string;
  };
}

interface TokenData {
  eth?: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
  };
  sol?: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    logo?: string;
    solana?: SolanaProgramData;
  };
  tokens: Array<{
    contract: string;
    symbol: string;
    name: string;
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    logo?: string;
    decimals?: number;
    userTokenAccount?: string;
  }>;
  addressType?: 'ethereum' | 'solana';
}

export function useTokenData(enabled: boolean = true): { data: TokenData | null; isLoading: boolean; error: any } {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  const result = useQuery({
    queryKey: ['tokenData', address, config.chainId],
    queryFn: async () => {
      if (!address) throw new Error('No address provided');

      const response = await nftApi.getTokens(address, config.chainId);
      
      if (!response) {
        return {
          eth: { balance: '0', priceInUSD: 0, totalValueInUSD: '0' },
          tokens: [],
          addressType: undefined
        };
      }

      return response as TokenData;
    },
    enabled: !!address && isConnected && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  return {
    data: result.data || null,
    isLoading: result.isLoading,
    error: result.error
  };
} 
