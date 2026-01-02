import { useQuery } from '@tanstack/react-query';
import { nftApi } from '@/lib/api/nft';
import { useUnifiedWallet } from './useUnifiedWallet';
import { useChain } from './useChain';

export function useNFTData(enabled: boolean = true) {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  return useQuery({
    queryKey: ['nftData', address, config.chainId],
    queryFn: async () => {
      if (!address) throw new Error('No address provided');

      const response = await nftApi.getNFTs(address, config.chainId);
      
      if (!response || !response.nfts) {
        return { nfts: [] };
      }

      const uniqueNFTs = new Map();
      const deduplicatedNFTs = response.nfts.filter((nft: any) => {
        if (!nft.contract || !nft.tokenId) return false;
        
        const key = `${nft.contract.toLowerCase()}-${nft.tokenId}`;
        if (uniqueNFTs.has(key)) {
          return false;
        }
        uniqueNFTs.set(key, true);
        return true;
      });
      
      return {
        ...response,
        nfts: deduplicatedNFTs
      };
    },
    enabled: !!address && isConnected && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
}

export function useCompaneonNFTData(enabled: boolean = true) {
  const { address, isConnected } = useUnifiedWallet();
  const { config } = useChain();

  return useQuery({
    queryKey: ['companeonNftData', address, config.chainId],
    queryFn: async () => {
      if (!address) throw new Error('No address provided');
      
      const response = await nftApi.getNFTs(address, config.chainId);
      if (!response || !response.nfts) {
        return { nfts: [] };
      }

      return response;
    },
    enabled: !!address && isConnected && enabled,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });
} 
