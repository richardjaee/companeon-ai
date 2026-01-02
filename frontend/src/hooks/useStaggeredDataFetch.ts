import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Industry-standard hook to stagger initial data fetching to handle cold starts
 * Implements progressive loading pattern
 */
export function useStaggeredDataFetch(isConnected: boolean, address: string | null) {
  const [enableTokenData, setEnableTokenData] = useState(false);
  const [enableNFTData, setEnableNFTData] = useState(false);
  const [enableCompaneonData, setEnableCompaneonData] = useState(false);
  const queryClient = useQueryClient();
  const previousAddressRef = useRef<string | null>(null);

  useEffect(() => {
    const previousAddress = previousAddressRef.current;

    if (!address || !isConnected) {
      if (previousAddress) {
        queryClient.removeQueries({ queryKey: ['tokenData', previousAddress], exact: true });
        queryClient.removeQueries({ queryKey: ['nftData', previousAddress], exact: true });
        queryClient.removeQueries({ queryKey: ['companeonNftData', previousAddress], exact: true });
      }

      previousAddressRef.current = address ?? null;
      return;
    }

    if (previousAddress === address) {
      return;
    }

    if (previousAddress) {
      queryClient.removeQueries({ queryKey: ['tokenData', previousAddress], exact: true });
      queryClient.removeQueries({ queryKey: ['nftData', previousAddress], exact: true });
      queryClient.removeQueries({ queryKey: ['companeonNftData', previousAddress], exact: true });
    }

    queryClient.invalidateQueries({ queryKey: ['tokenData', address], exact: true });
    queryClient.invalidateQueries({ queryKey: ['nftData', address], exact: true });
    queryClient.invalidateQueries({ queryKey: ['companeonNftData', address], exact: true });

    previousAddressRef.current = address;
  }, [address, isConnected, queryClient]);

  useEffect(() => {
    if (!isConnected || !address) {
      setEnableTokenData(false);
      setEnableNFTData(false);
      setEnableCompaneonData(false);
      return;
    }

    const timers: NodeJS.Timeout[] = [];

    setEnableTokenData(true);

    timers.push(
      setTimeout(() => {
        setEnableNFTData(true);
      }, 500)
    );

    timers.push(
      setTimeout(() => {
        setEnableCompaneonData(true);
      }, 1000)
    );

    return () => {
      timers.forEach(timer => clearTimeout(timer));
    };
  }, [isConnected, address]);

  return {
    enableTokenData,
    enableNFTData,
    enableCompaneonData
  };
}
