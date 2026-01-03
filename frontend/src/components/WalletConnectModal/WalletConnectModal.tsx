'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUnifiedWallet, UnifiedWalletType } from '@/hooks/useUnifiedWallet';
import * as Sentry from '@sentry/nextjs';
import { requestEIP6963Providers, findProviderByWalletId } from '@/lib/wallets/eip6963';
import dynamic from 'next/dynamic';

const CDPAuth = dynamic(() => import('./CDPAuth'), { ssr: false });

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (wallet: string) => Promise<void>; // Made optional since we'll handle it internally
}

interface WalletProvider {
  id: string;
  name: string;
  logo: string;
  isAvailable: boolean;
  chain: 'ethereum' | 'solana';
}

type SupportedChain = 'ethereum' | 'solana';

export default function WalletConnectModal({
  isOpen,
  onClose,
  onConnect,
}: WalletConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [selectedWalletId, setSelectedWalletId] = useState<string | null>(null);
  const [error, setError] = useState<string | React.ReactElement | null>(null);
  const [showCDPAuth, setShowCDPAuth] = useState(false);
  const [providers, setProviders] = useState<WalletProvider[]>([
    {
      id: 'cdp',
      name: 'Email / Social Login',
      logo: '/logos/coinbase-wallet-logo.png',
      isAvailable: true,
      chain: 'ethereum'
    },
    {
      id: 'metamask',
      name: 'MetaMask',
      logo: '/logos/metamask-logo.png',
      isAvailable: false,
      chain: 'ethereum'
    },
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      logo: '/logos/coinbase-wallet-logo.png',
      isAvailable: false,
      chain: 'ethereum'
    },
    {
      id: 'brave',
      name: 'Brave Wallet',
      logo: '/logos/brave-wallet-logo.png',
      isAvailable: false,
      chain: 'ethereum'
    },
    {
      id: 'rabby',
      name: 'Rabby',
      logo: '/icons/rabby-logo.svg',
      isAvailable: false,
      chain: 'ethereum'
    },
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      logo: '/icons/walletconnect.png',
      isAvailable: true,
      chain: 'ethereum'
    },
  ]);

  const { connectWallet, disconnectWallet } = useUnifiedWallet();

  useEffect(() => {
    if (!isOpen) {

      setIsConnecting(false);
      setSelectedWalletId(null);
      setError(null);
      setShowCDPAuth(false);

      try {
        sessionStorage.removeItem('companeon_wallet_connect_in_progress');
        sessionStorage.removeItem('companeon_metamask_pending');
        sessionStorage.removeItem('companeon_metamask_pending_timestamp');
        sessionStorage.removeItem('auth_current_wallet');

        sessionStorage.removeItem('companeon_cb_detection_info');
        sessionStorage.removeItem('companeon_cb_device_info');
      } catch (err) {

      }
    }
  }, [isOpen]);

  useEffect(() => {
    const checkWalletAvailability = async () => {
      const isMobile = /iPhone|iPad|iPod|Android/i.test(
        typeof navigator !== 'undefined' ? navigator.userAgent : ''
      );

      // Try EIP-6963 discovery first
      let discovered: any[] = [];
      try {
        discovered = await requestEIP6963Providers(250);
      } catch (_) {}

      const updatedProviders = await Promise.all(providers.map(async (provider) => {
        let isAvailable = false;

        if (isMobile) {
          switch (provider.id) {
            case 'cdp':
              isAvailable = true; // CDP Embedded Wallets work everywhere
              break;
            case 'metamask':
            case 'coinbase':
              isAvailable = true;
              break;
            case 'brave':
              isAvailable = typeof navigator !== 'undefined' && (navigator as any).brave !== undefined;
              break;
            case 'rabby':
              isAvailable = true; // Rabby works on mobile via browser
              break;
            case 'walletconnect':
              isAvailable = true; // WC QR/deeplink works on mobile
              break;
            case 'web3auth':
              isAvailable = true; // Web3Auth works on mobile
              break;
          }
        } else {
          switch (provider.id) {
            case 'cdp':
              isAvailable = true; // CDP Embedded Wallets work everywhere
              break;
            case 'metamask':
              isAvailable = !!findProviderByWalletId('metamask', discovered) || (
                typeof window !== 'undefined' &&
                (window.ethereum?.isMetaMask || (window.ethereum as any)?.providers?.some((p: any) => p.isMetaMask))
              );
              break;

            case 'coinbase':
              isAvailable = !!findProviderByWalletId('coinbase', discovered) || (
                typeof window !== 'undefined' &&
                (window.ethereum?.isCoinbaseWallet || (window.ethereum as any)?.providers?.some((p: any) => p.isCoinbaseWallet))
              );
              break;

            case 'brave':
              isAvailable = !!findProviderByWalletId('brave', discovered) || (
                typeof window !== 'undefined' && (
                  (window.ethereum as any)?.isBraveWallet ||
                  (window.ethereum as any)?.providers?.some((p: any) => p.isBraveWallet)
                )
              );
              break;
            case 'rabby':
              isAvailable = !!findProviderByWalletId('rabby', discovered) || (
                typeof window !== 'undefined' && (
                  window.ethereum?.isRabby || (window.ethereum as any)?.providers?.some((p: any) => p.isRabby)
                )
              );
              break;
            case 'walletconnect':
              isAvailable = true; // WC QR works on desktop too
              break;
            case 'web3auth':
              isAvailable = true; // Web3Auth works on desktop too
              break;
          }
        }

        return { ...provider, isAvailable };
      }));

      setProviders(updatedProviders);
    };

    checkWalletAvailability();
  }, []);

  useEffect(() => {
    if (!isOpen) {
      
      setIsConnecting(false);
      setSelectedWalletId(null);
      setError(null);
    } else {
    }
  }, [isOpen]);

  const handleCDPSuccess = async (address: string) => {
    try {
      // Store CDP address and close modal
      
      // Trigger wallet connected event
      window.dispatchEvent(new CustomEvent('wallet:connected', {
        detail: { authenticated: true, address }
      }));

      onClose();

      // Redirect to dashboard
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/dashboard')) {
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      }
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err?.message || 'Failed to complete CDP authentication');
    }
  };

  const handleCDPError = (error: string) => {
    setError(error);
    setShowCDPAuth(false);
  };

  const connect = async (wallet: string) => {
    setError(null);
    setIsConnecting(true);
    setSelectedWalletId(wallet);

    // Handle CDP auth separately with React components
    if (wallet === 'cdp') {
      setShowCDPAuth(true);
      setIsConnecting(false);
      return;
    }

    // Keep the modal open while attempting WalletConnect/Web3Auth so
    // we can display errors if initialization fails.

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (wallet === 'coinbase' && isMobile) {
      const isInsideCoinbaseWallet = /\bCoinbase(Wallet)?\b/i.test(navigator.userAgent) ||
        /\bCBWallet\b/i.test(navigator.userAgent) ||
        (window.ethereum?.isCoinbaseWallet === true);
      
      if (!isInsideCoinbaseWallet) {
        const dappUrl = encodeURIComponent(window.location.href);
        const coinbaseWalletLink = `https://go.cb-w.com/dapp?cb_url=${dappUrl}`;
        
        try {
          window.open(coinbaseWalletLink, '_self');
          return;
        } catch (e) {
          window.location.href = coinbaseWalletLink;
          return;
        }
      }
    }

    const timeoutId = setTimeout(() => {
      if (isConnecting) {
        setIsConnecting(false);
        setSelectedWalletId(null);
        setError('Connection attempt timed out. Please try again.');
        try {
          window.dispatchEvent(new CustomEvent('wallet:reset'));
        } catch {}
      }
    }, 15000); // 15 second timeout
    
    try {
      if (!(wallet === 'coinbase' && isMobile)) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (onConnect) {
        await onConnect(wallet);
      } else {
        const res = await connectWallet(wallet as UnifiedWalletType);
        if (!res) {
          throw new Error('Wallet connection did not complete');
        }
      }
      
      try {
        window.dispatchEvent(new CustomEvent('wallet:connected', {
          detail: { authenticated: true }
        }));
      } catch (e) {

      }
      
      clearTimeout(timeoutId);
      onClose();
      
      if (typeof window !== 'undefined' && !window.location.pathname.includes('/dashboard')) {
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
      }
      
      return;
    } catch (err: any) {
     
      Sentry.captureException(err);
      
      clearTimeout(timeoutId);
      
      if (err?.message?.includes('already pending')) {
        setError(err.message);
      } else if (err?.code === -32002) {
        const walletNames: { [key: string]: string } = {
          metamask: 'MetaMask',
          coinbase: 'Coinbase',
          brave: 'Brave',
          rabby: 'Rabby'
        };
        setError(`A connection request is already pending in your ${walletNames[wallet] || wallet} wallet. Please open the wallet and approve or reject the connection.`);
      } else if (err?.message?.includes('not found') || err?.message?.includes('not installed')) {
        const walletNames: { [key: string]: string } = {
          metamask: 'MetaMask',
          coinbase: 'Coinbase Wallet',
          brave: 'Brave Wallet',
          rabby: 'Rabby'
        };
        if (isMobile && (wallet === 'metamask' || wallet === 'coinbase')) {
          setError(`${walletNames[wallet]} app not installed. Please install it from your app store to continue.`);
        } else {
          setError(`${walletNames[wallet] || wallet} extension not installed. Please install it to continue.`);
        }
      } else if (err?.message?.includes('Redirecting to')) {
        setError('Redirecting to wallet app. If the app doesn\'t open, please install it from your app store.');
        setTimeout(() => {
          setError(null);
          setIsConnecting(false);
          setSelectedWalletId(null);
        }, 3000);
      } else if (err?.message?.includes('user rejected') || err?.message?.includes('User denied') || err?.code === 4001) {
        setError('You declined the connection request. Please try again.');
      } else if (wallet === 'cdp' && (err?.message?.includes('CDP') || err?.message?.includes('Project ID'))) {
        setError(err.message || 'CDP authentication failed. Please check your configuration.');
      } else if (wallet === 'walletconnect' && (err?.message?.includes('Project ID') || err?.message?.includes('project_id'))) {
        setError('WalletConnect Project ID missing/invalid. Ensure the project allows this domain in WalletConnect Cloud.');
      } else if (err?.message?.includes('timed out') || err?.message?.includes('timeout')) {
        setError('Connection attempt timed out. If you have ad/tracker blockers, disable them for this site and try again.');
      } else if (err?.message?.includes('Failed to fetch') || err?.message?.includes('network')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to connect wallet. Please try again.');
      }
      
      setIsConnecting(false);
      setSelectedWalletId(null);
      try {
        window.dispatchEvent(new CustomEvent('wallet:reset'));
      } catch {}
    }
  };

  const getCallbackUrl = () => {

    const baseUrl = typeof window !== 'undefined' 
      ? `${window.location.origin}${window.location.pathname}` 
      : '';
    
    return `${baseUrl}?wallet_callback=true&wallet_type=${encodeURIComponent(selectedWalletId || '')}`;
  };

  const checkWalletCallback = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    const params = new URLSearchParams(window.location.search);
    return params.get('wallet_callback') === 'true';
  }, []);

  useEffect(() => {
    const handleWalletCallback = async () => {
      if (checkWalletCallback()) {
        const params = new URLSearchParams(window.location.search);
        const walletType = params.get('wallet_type') || '';
        
        if (typeof window !== 'undefined' && window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
        
        if (walletType) {
          setSelectedWalletId(walletType);

          setTimeout(() => {
            connect(walletType);
          }, 500);
        }
      }
    };
    
    handleWalletCallback();
  }, [checkWalletCallback]);

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog
        open={isOpen}
        onClose={() => {
          setIsConnecting(false);
          setSelectedWalletId(null);
          setError(null);
          onClose();
          try {
            window.dispatchEvent(new CustomEvent('wallet:reset'));
          } catch {}
        }}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto rounded-lg bg-white shadow-xl w-full max-w-[500px] min-h-[400px] sm:min-h-[500px]">
            <div className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <Dialog.Title className="text-xl sm:text-2xl font-bold text-center flex-grow font-space-grotesk">
                  Connect wallet
                </Dialog.Title>
                <button
                  onClick={() => {
                    setIsConnecting(false);
                    setSelectedWalletId(null);
                    setError(null);
                    onClose();
                    try {
                      window.dispatchEvent(new CustomEvent('wallet:reset'));
                    } catch {}
                  }}
                  className="text-gray-400 hover:text-gray-500 p-1"
                >
                  <XMarkIcon className="h-6 w-6" />
                </button>
              </div>
              
              {error && (
                <div className="mb-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm sm:text-base">
                  {error}
                </div>
              )}

              {showCDPAuth ? (
                <div className="mt-4">
                  <button
                    onClick={() => setShowCDPAuth(false)}
                    className="mb-4 text-sm text-gray-600 hover:text-gray-800 flex items-center"
                  >
                    ← Back to wallet options
                  </button>
                  <CDPAuth onSuccess={handleCDPSuccess} onError={handleCDPError} />
                </div>
              ) : (
                <>
                  <div className="mt-4 space-y-3 sm:space-y-4">
                    {providers.map((provider) => (
                      <button
                        key={provider.id}
                        onClick={() => connect(provider.id)}
                        disabled={isConnecting || !provider.isAvailable}
                        className={`w-full p-3 sm:p-4 flex items-center rounded-lg border transition-colors relative
                          ${provider.isAvailable
                            ? 'hover:bg-gray-50 border-gray-200'
                            : 'border-gray-100 bg-gray-50 cursor-not-allowed opacity-60'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                      >
                        {(() => {
                          const sizeClass = 'w-10 h-10';
                          return (
                            <div className={`mr-3 sm:mr-4 relative ${sizeClass} flex-shrink-0`}>
                              <Image
                                src={provider.logo}
                                alt={provider.name}
                                fill
                                sizes="40px"
                                className="object-contain"
                              />
                            </div>
                          );
                        })()}
                        <span className="text-lg sm:text-xl font-medium">
                          {isConnecting && selectedWalletId === provider.id ? 'Connecting...' : provider.name}
                        </span>
                        {!provider.isAvailable && (
                          <span className="absolute right-3 sm:right-4 text-xs sm:text-sm text-gray-500">
                            Not detected
                          </span>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="mt-6 sm:mt-8 text-center text-xs sm:text-sm text-gray-500">
                    <a
                      href="https://ethereum.org/en/wallets/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-500 hover:text-blue-600 hover:underline"
                    >
                      What are Ethereum wallets? Learn about Self custody →
                    </a>
                  </div>
                </>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}
