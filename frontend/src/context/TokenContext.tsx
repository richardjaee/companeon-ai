'use client';

import { createContext, useContext, useState, useEffect } from 'react';
import { useWallet } from '@/hooks/useWallet';

interface TokenData {
  eth: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
  };
  tokens: Array<{
    contract?: string;
    symbol: string;
    name: string;
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
  }>;
}

interface TokenContextType {
  tokenData: TokenData | null;
  isLoading: boolean;
  error: Error | null;
  setTokenData: (data: TokenData | null) => void;
}

const TokenContext = createContext<TokenContextType | undefined>(undefined);

export function TokenProvider({ children }: { children: React.ReactNode }) {
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const { address, walletType } = useWallet();

  useEffect(() => {
    setTokenData(null);
    setError(null);
  }, [address, walletType]);

  const value = {
    tokenData,
    isLoading,
    error,
    setTokenData
  };

  return (
    <TokenContext.Provider value={value}>
      {children}
    </TokenContext.Provider>
  );
}

export function useTokens() {
  const context = useContext(TokenContext);
  if (context === undefined) {
    throw new Error('useTokens must be used within a TokenProvider');
  }
  return context;
}
