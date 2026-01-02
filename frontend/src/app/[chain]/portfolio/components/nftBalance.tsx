'use client';

import { useState, useMemo, useEffect } from 'react';
import { useUnifiedWallet } from '@/hooks/useUnifiedWallet';
import NFTCards from '@/components/NFTCards/NFTCards';


interface NFTBalanceProps {
  nftContractData: any;
  nftData: Record<string, any>;
  isNFTLoading?: boolean;
  isSelectionMode?: boolean;
  onNFTSelect?: (nft: any) => void;
  selectedNFTs?: Set<string>;
  sortBy?: 'recent' | 'name' | 'value' | 'original';
  sortDirection?: 'asc' | 'desc';
  isNFTSelected?: (nft: any) => boolean;
  filterContractAddress?: string | null;
  isSelectionLimitReached?: boolean;
  isStandalone?: boolean;
  onStartSelection?: (nft: any) => void;
  disabledSelection?: boolean;
  addressTypeOverride?: 'ethereum' | 'solana';
}

export default function NFTBalance({ 
  nftContractData, 
  nftData, 
  isNFTLoading = false,
  isSelectionMode = false,
  onNFTSelect,
  selectedNFTs = new Set(),
  sortBy = 'original',
  sortDirection = 'desc',
  filterContractAddress = null,
  isSelectionLimitReached = false,
  isStandalone = false,
  onStartSelection,
  disabledSelection = false,
  addressTypeOverride
}: NFTBalanceProps) {
  const { chainType: walletChainType } = useUnifiedWallet();
  const chainType = addressTypeOverride || walletChainType;
  const [allNFTs, setAllNFTs] = useState<any[]>([]);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const isInitialLoading = isNFTLoading;

  useEffect(() => {
    let mounted = true;
    
    setAllNFTs([]);
    setIsLoadingMore(false);
    
    if (nftContractData && nftContractData.nfts) {
      setAllNFTs(nftContractData.nfts);
    } else {
      setAllNFTs([]);
    }
    
    return () => {
      mounted = false;
    };
  }, [nftContractData]);

  const filteredNFTs = useMemo(() => {
    if (!allNFTs.length) return [];
    
    const uniqueNFTs = new Map();
    
    let filtered = allNFTs.filter((nft: any) => {
      if (!nft.contract || !nft.tokenId) return false;
      
      if (chainType === 'ethereum') {

        if (filterContractAddress) {
          const isFiltered = nft.contract?.toLowerCase() === filterContractAddress.toLowerCase();
          if (isFiltered) return false;
        }
        
        const nftKey = `${nft.contract.toLowerCase()}-${nft.tokenId}`;
        
        if (uniqueNFTs.has(nftKey)) {
          return false;
        }
        
        uniqueNFTs.set(nftKey, true);
        return true;
      } else if (chainType === 'solana') {

        const nftKey = `${nft.contract.toLowerCase()}`;
        
        if (uniqueNFTs.has(nftKey)) {
          return false;
        }
        
        uniqueNFTs.set(nftKey, true);
        return true;
      }
      
      return false;
    });

    if (sortBy !== 'original') {
      filtered = filtered.sort((a: any, b: any) => {
        const direction = sortDirection === 'asc' ? 1 : -1;
        
        switch (sortBy) {
          case 'name':
            const nameA = a.metadata?.name || '';
            const nameB = b.metadata?.name || '';
            return direction * nameA.localeCompare(nameB);
            
          case 'value':
            const valueA = a.estimatedValueUSD || 0;
            const valueB = b.estimatedValueUSD || 0;
            return direction * (valueB - valueA);
            
          case 'recent':
            if (chainType === 'ethereum') {
              const tokenIdA = parseInt(a.tokenId);
              const tokenIdB = parseInt(b.tokenId);
              return direction * (tokenIdB - tokenIdA);
            } else {

              return 0;
            }
            
          default:
            return 0;
        }
      });
    }

    return filtered;
  }, [allNFTs, filterContractAddress, sortBy, sortDirection, chainType]);

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto">
        <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 justify-items-center ${isStandalone ? 'pt-1' : 'pt-4'}`}>
          {isInitialLoading ? (

            [...Array(6)].map((_, index) => (
              <div key={`skeleton-${index}`} className="relative w-full max-w-[240px] aspect-[1/1.4] bg-white rounded-lg p-3 flex flex-col animate-pulse">
                <div className="w-full aspect-square bg-gray-200 rounded-lg mb-3"></div>
                <div className="space-y-2">
                  <div className="h-4 w-3/4 bg-gray-200 rounded"></div>
                  <div className="h-4 w-1/2 bg-gray-200 rounded"></div>
                  <div className="mt-1">
                    <div className="h-4 bg-gray-200 rounded w-1/3 animate-pulse mb-1" />
                    <div className="h-4 bg-gray-200 rounded w-2/3 animate-pulse" />
                  </div>
                </div>
              </div>
            ))
          ) : filteredNFTs.length === 0 || (!nftContractData || !allNFTs.length) ? (

            <div className="col-span-1 sm:col-span-2 xl:col-span-4 flex items-center justify-center h-[300px]">
              <p className="text-gray-500 text-lg">No compatible assets found</p>
            </div>
          ) : (
            filteredNFTs.map((nft: any) => {

              const nftKey = `${nft.contract?.toLowerCase() || 'no-contract'}-${nft.tokenId || 'no-id'}`;
              
              return (
                <div
                  key={nftKey}
                  className="w-full max-w-[240px] p-1 rounded-lg transition-shadow duration-200"
                >
                  <NFTCards
                    asset={nft}
                    enableHover={true}
                    isLoading={false}
                    isSelectionMode={isSelectionMode}
                    onSelect={onNFTSelect}
                    isSelected={selectedNFTs?.has(nft.contract && nft.tokenId ? `${nft.contract.toLowerCase()}-${nft.tokenId}` : nft.tokenId)}
                    isSpecialSection={false}
                    filterContractAddress={filterContractAddress}
                    isSelectionLimitReached={isSelectionLimitReached}
                    onStartSelection={onStartSelection}
                    disabledSelection={disabledSelection}
                  />
                </div>
              )
            })
          )}
        </div>
      </div>
    </div>
  );
}
