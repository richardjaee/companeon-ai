'use client';

import React, { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { WalletProvider } from "@/context/WalletContext";
import Navbar from "@/components/Navbar/Navbar";
import { TokenProvider } from '@/context/TokenContext';
import { NFTProvider } from '@/context/NFTContext';
import ErrorBoundary from '@/components/ErrorBoundary/ErrorBoundary';
import ErrorHandlingWrapper from '@/components/ErrorHandlingWrapper';

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [isClient, setIsClient] = useState(false);

  // Check for both old /dashboard and new /[chain]/dashboard routes
  const isDashboardPage = pathname?.startsWith('/dashboard') ||
                         pathname?.match(/^\/(base|mainnet|sepolia)\/dashboard/);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  const shouldShowNavbar = !isDashboardPage;

  return (
    <>
      <ErrorHandlingWrapper>
        <ErrorBoundary>
          <TokenProvider>
            <NFTProvider>
              <WalletProvider>
                {shouldShowNavbar && <Navbar />}
                <main>
                  {children}
                </main>
              </WalletProvider>
            </NFTProvider>
          </TokenProvider>
        </ErrorBoundary>
      </ErrorHandlingWrapper>
    </>
  );
}
