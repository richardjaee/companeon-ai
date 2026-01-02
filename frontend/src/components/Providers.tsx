'use client';

import { WalletProvider } from '@/context/WalletContext';
import { TokenProvider } from '@/context/TokenContext';
import { NFTProvider } from '@/context/NFTContext';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        gcTime: 10 * 60 * 1000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <WalletProvider>
        <TokenProvider>
          <NFTProvider>
            {children}
          </NFTProvider>
        </TokenProvider>
      </WalletProvider>
    </QueryClientProvider>
  );
}
