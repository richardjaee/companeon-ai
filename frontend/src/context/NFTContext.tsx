'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';

interface NFTMetadata {
  name: string | null;
  description: string | null;
  image: string | null;
  attributes: Array<{
    value: string;
    trait_type: string;
  }>;
}

interface NFT {
  contract: string;
  tokenId: string;
  type: string;
  metadata: NFTMetadata;
}

interface NFTData {
  nfts: NFT[];
  tokenIdAndImages: any[];
  needs2FASetup?: boolean;
}

interface NFTContextType {
  nftData: NFTData | null;
  isLoading: boolean;
  error: Error | null;
  setNFTData: (data: NFTData | ((prevData: NFTData | null) => NFTData | null)) => void;
}

const NFTContext = createContext<NFTContextType | undefined>(undefined);

export function NFTProvider({ children }: { children: React.ReactNode }) {
  const [nftData, setNFTData] = useState<NFTData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { address, walletType } = useWallet();

  useEffect(() => {
    setNFTData(null);
    setError(null);
  }, [address, walletType]);

  return (
    <NFTContext.Provider value={{ nftData, isLoading, error, setNFTData }}>
      {children}
    </NFTContext.Provider>
  );
}

export function useNFTs() {
  const context = useContext(NFTContext);
  if (context === undefined) {
    throw new Error('useNFTs must be used within a NFTProvider');
  }
  return context;
}
