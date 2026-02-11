'use client';

import { Dialog, Transition } from '@headlessui/react';
import { Fragment, useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { useUnifiedWallet, UnifiedWalletType } from '@/hooks/useUnifiedWallet';
import * as Sentry from '@sentry/nextjs';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect?: (wallet: string) => Promise<void>;
}

export default function WalletConnectModal({
  isOpen,
  onClose,
  onConnect,
}: WalletConnectModalProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | React.ReactElement | null>(null);
  const [isMetaMaskAvailable, setIsMetaMaskAvailable] = useState(false);

  const { connectWallet, disconnectWallet } = useUnifiedWallet();

  useEffect(() => {
    if (!isOpen) {
      setIsConnecting(false);
      setError(null);

      try {
        sessionStorage.removeItem('companeon_wallet_connect_in_progress');
        sessionStorage.removeItem('companeon_metamask_pending');
        sessionStorage.removeItem('companeon_metamask_pending_timestamp');
        sessionStorage.removeItem('auth_current_wallet');
      } catch (err) {
        // Ignore storage errors
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const detected =
      !!window.ethereum?.isMetaMask ||
      !!(window.ethereum as any)?.providers?.some((p: any) => p.isMetaMask);
    setIsMetaMaskAvailable(detected);
  }, []);

  const connect = async () => {
    setError(null);
    setIsConnecting(true);

    const timeoutId = setTimeout(() => {
      if (isConnecting) {
        setIsConnecting(false);
        setError('Connection attempt timed out. Please try again.');
        try {
          window.dispatchEvent(new CustomEvent('wallet:reset'));
        } catch {}
      }
    }, 15000);

    try {
      await new Promise(resolve => setTimeout(resolve, 100));

      if (onConnect) {
        await onConnect('metamask');
      } else {
        const res = await connectWallet('metamask' as UnifiedWalletType);
        if (!res) {
          throw new Error('Wallet connection did not complete');
        }
      }

      try {
        window.dispatchEvent(new CustomEvent('wallet:connected', {
          detail: { authenticated: true }
        }));
      } catch (e) {
        // Ignore dispatch errors
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
        setError('A connection request is already pending in your MetaMask wallet. Please open the wallet and approve or reject the connection.');
      } else if (err?.message?.includes('not found') || err?.message?.includes('not installed')) {
        setError('MetaMask extension not installed. Please install it to continue.');
      } else if (err?.message?.includes('user rejected') || err?.message?.includes('User denied') || err?.code === 4001) {
        setError('You declined the connection request. Please try again.');
      } else if (err?.message?.includes('timed out') || err?.message?.includes('timeout')) {
        setError('Connection attempt timed out. If you have ad/tracker blockers, disable them for this site and try again.');
      } else if (err?.message?.includes('Failed to fetch') || err?.message?.includes('network')) {
        setError('Network error. Please check your internet connection and try again.');
      } else {
        setError(err.message || 'Failed to connect wallet. Please try again.');
      }

      setIsConnecting(false);
      try {
        window.dispatchEvent(new CustomEvent('wallet:reset'));
      } catch {}
    }
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

        if (walletType === 'metamask') {
          setTimeout(() => {
            connect();
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

              <div className="mt-4 space-y-3 sm:space-y-4">
                {isMetaMaskAvailable ? (
                  <button
                    onClick={connect}
                    disabled={isConnecting}
                    className="w-full p-3 sm:p-4 flex items-center rounded-lg border transition-colors hover:bg-gray-50 border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <div className="mr-3 sm:mr-4 relative w-10 h-10 flex-shrink-0">
                      <Image
                        src="/logos/metamask-logo.png"
                        alt="MetaMask"
                        fill
                        sizes="40px"
                        className="object-contain"
                      />
                    </div>
                    <span className="text-lg sm:text-xl font-medium">
                      {isConnecting ? 'Connecting...' : 'MetaMask'}
                    </span>
                  </button>
                ) : (
                  <div className="text-center py-8">
                    <div className="mx-auto mb-4 relative w-16 h-16">
                      <Image
                        src="/logos/metamask-logo.png"
                        alt="MetaMask"
                        fill
                        sizes="64px"
                        className="object-contain"
                      />
                    </div>
                    <p className="text-gray-700 font-medium mb-2">MetaMask Required</p>
                    <p className="text-gray-500 text-sm mb-4">
                      Companeon uses ERC-7715 delegated permissions, which require MetaMask.
                    </p>
                    <a
                      href="https://metamask.io/download/"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block px-6 py-2 bg-[#F6851B] text-white rounded-lg font-medium hover:bg-[#E2761B] transition-colors"
                    >
                      Install MetaMask
                    </a>
                  </div>
                )}
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
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}
