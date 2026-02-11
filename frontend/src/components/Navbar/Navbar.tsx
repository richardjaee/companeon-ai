'use client';

import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { useState, useRef, useEffect, useCallback } from 'react';
import Container from '../Layout/Container';
import WalletConnectModal from '../WalletConnectModal/WalletConnectModal';
import AuthModal from '@/components/Auth/AuthModal';
import DisconnectConfirmModal from '@/components/Auth/DisconnectConfirmModal';
import * as Sentry from '@sentry/nextjs';
import Image from 'next/image';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

type ConnectWalletType = 'metamask';

interface NFTMetadata {
  name: string | null;
  description: string | null;
  image: string | null;
  attributes: Array<{
    value: string;
    trait_type: string;
  }>;
}

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname() || '/';
  const { address, isConnected, connectWallet, disconnectWallet, error: walletError } = useWallet();
  const [isLoading, setIsLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hasDeclinedAuth, setHasDeclinedAuth] = useState(false);
  const [showDisconnectModal, setShowDisconnectModal] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const dropdownTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const [localConnectedAddress, setLocalConnectedAddress] = useState<string | null>(null);

  const [lastConnectionAttempt, setLastConnectionAttempt] = useState<number>(0);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const shortenAddress = (address: string | null) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const checkAuthStatus = () => {

    const isAuthenticated = isConnected && !!address;

    setIsAuthenticated(isAuthenticated);

    return isAuthenticated;
  };

  const getChainPath = async (): Promise<string> => {
    try {
      if (typeof window === 'undefined' || !window.ethereum) return 'mainnet';

      const chainId = await window.ethereum.request({ method: 'eth_chainId' });
      const chainIdDecimal = parseInt(chainId as string, 16);

      if (chainIdDecimal === 11155111) return 'sepolia';

      return 'mainnet';
    } catch (error) {
      return 'mainnet';
    }
  };

  useEffect(() => {

    const checkAuth = () => {

      const hasValidConnection = isConnected && !!address;
      
      if (hasValidConnection !== isAuthenticated) {
        setIsAuthenticated(hasValidConnection);
      }
    };
    
    checkAuth();
    const interval = setInterval(checkAuth, 2000);
    
    return () => clearInterval(interval);
  }, [isAuthenticated, isConnected, address]);

  useEffect(() => {
    if (address && isConnected) {

      setIsAuthenticated(true);
    } else {
      setIsAuthenticated(false);
    }
  }, [address, isConnected]);

  // Listen for network changes in MetaMask and update URL accordingly
  useEffect(() => {
    if (typeof window === 'undefined' || !window.ethereum || !isConnected) return;

    const handleChainChanged = async (chainIdHex: string) => {
      try {
        const newChainId = parseInt(chainIdHex, 16);

        let newChainPath: string;
        if (newChainId === 11155111) {
          newChainPath = 'sepolia';
        } else {
          newChainPath = 'mainnet';
        }

        const currentPath = window.location.pathname;
        const isOnMainnetRoute = currentPath.includes('/mainnet/');
        const isOnSepoliaRoute = currentPath.includes('/sepolia/');

        if ((newChainPath === 'mainnet' && !isOnMainnetRoute) ||
            (newChainPath === 'sepolia' && !isOnSepoliaRoute)) {
          router.push(`/${newChainPath}/dashboard`);

          setTimeout(() => {
            window.location.reload();
          }, 100);
        }
      } catch (error) {
        Sentry.captureException(error);
      }
    };

    // Add the event listener
    window.ethereum.on('chainChanged', handleChainChanged);

    // Cleanup
    return () => {
      if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('chainChanged', handleChainChanged);
      }
    };
  }, [isConnected, router]);

  const debouncedConnectWallet = useCallback(async (walletType: ConnectWalletType) => {
    const now = Date.now();
    
    if (isConnecting || (now - lastConnectionAttempt) < 3000) {
      return;
    }
    
    try {
      setIsConnecting(true);
      setLastConnectionAttempt(now);
      await connectWallet(walletType);
    } catch (err) {
      Sentry.captureException(err);
    } finally {
      setIsConnecting(false);
    }
  }, [connectWallet, isConnecting, lastConnectionAttempt]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    
    const handleWalletDisconnected = () => {

      setIsAuthenticated(false);
      setLocalConnectedAddress(null);
      setHasDeclinedAuth(false);
      setShowDropdown(false);
      setIsLoading(false);

      setShowAuthModal(false);
    };
    
    const handleWalletReset = () => {

      setIsAuthenticated(false);
      setLocalConnectedAddress(null);
      setHasDeclinedAuth(false);
      setShowDropdown(false);
      setIsLoading(false);

      setShowAuthModal(false);
      setShowDisconnectModal(false);
    };

    const handleEmbeddedWalletCancelled = () => {
      setShowConnectModal(true);
    };

    const handleScroll = () => {
      const scrollTop = window.scrollY;
      setIsScrolled(scrollTop > 0);
    };
    
    window.addEventListener('wallet:disconnected', handleWalletDisconnected);
    window.addEventListener('wallet:reset', handleWalletReset);
    window.addEventListener('embedded-wallet:cancelled', handleEmbeddedWalletCancelled);
    window.addEventListener('scroll', handleScroll);
    
    return () => {
      window.removeEventListener('wallet:disconnected', handleWalletDisconnected);
      window.removeEventListener('wallet:reset', handleWalletReset);
      window.removeEventListener('embedded-wallet:cancelled', handleEmbeddedWalletCancelled);
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  useEffect(() => {
    if (address && isConnected) {
      setLocalConnectedAddress(address);
    } else {

      setLocalConnectedAddress(null);
    }
  }, [address, isConnected]);

  const handleConnectWalletClick = () => {

    try {
      sessionStorage.setItem('companeon_user_initiated_connect', 'true');
      
      setTimeout(() => {
        sessionStorage.removeItem('companeon_user_initiated_connect');
      }, 5000);
    } catch (e) {

    }
    
    setShowConnectModal(true);
  };

  const handleConnectWallet = async (wallet: string) => {
    try {
      setIsLoading(true);
      
      const isOnSessionExpiredPage = typeof window !== 'undefined' && window.location.pathname === '/session-expired';
      
      try {
        sessionStorage.setItem('companeon_user_initiated_connect', 'true');
        
        if (isOnSessionExpiredPage) {
          sessionStorage.removeItem('companeon_prevent_auto_connect');
          sessionStorage.removeItem('companeon_session_naturally_expired');
          sessionStorage.setItem('auth_from_session_expired', 'true');
        }
      } catch (e) {

      }
      
      const result = await connectWallet(wallet as ConnectWalletType);

      if (result) {
        setShowConnectModal(false);

        setTimeout(async () => {

          const hasValidSession = checkAuthStatus();

          if (!hasValidSession && !hasDeclinedAuth) {
            setShowAuthModal(true);
          } else {

            if (hasValidSession) {
              const chain = await getChainPath();
              router.push(`/${chain}/dashboard`);
            }
          }
        }, 500);
      } else {
        const message = walletError || 'Connection cancelled or failed';
        // Surface the most recent wallet error so the modal shows a helpful reason
        throw new Error(message);
      }
    } catch (error) {
      Sentry.captureException(error);

      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {

    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }
    
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
        if (dropdownTimeoutRef.current) {
          clearTimeout(dropdownTimeoutRef.current);
          dropdownTimeoutRef.current = null;
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (dropdownTimeoutRef.current) {
        clearTimeout(dropdownTimeoutRef.current);
        dropdownTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (isConnected && address && !isAuthenticated) {
      try {
        const hasDeclined = sessionStorage.getItem('auth_declined') === 'true';
        if (hasDeclined) {
          setHasDeclinedAuth(true);
        }
      } catch (e) {

      }
    } else if (!isConnected || !address) {

      setHasDeclinedAuth(false);
      try {
        sessionStorage.removeItem('auth_declined');
      } catch (e) {

      }
    }
  }, [isConnected, address, isAuthenticated]);

  useEffect(() => {
    
    const isOnSessionExpiredPage = typeof window !== 'undefined' && window.location.pathname === '/session-expired';
    const wasRecentlyExpired = sessionStorage.getItem('companeon_session_naturally_expired') === 'true';
    
    const isUserInitiated = sessionStorage.getItem('companeon_user_initiated_connect') === 'true';
    
  }, [isConnected, address, isAuthenticated, showAuthModal, hasDeclinedAuth]);

  const handleAuthSuccess = () => {
    setShowAuthModal(false);
    setIsAuthenticated(true);
    checkAuthStatus();
    
    if (address) {
      setLocalConnectedAddress(address);
    }
    
    window.dispatchEvent(new CustomEvent('wallet:connected'));
  };

  const handleAuthDeclined = () => {
    setShowAuthModal(false);
    setHasDeclinedAuth(true);
    try {
      sessionStorage.setItem('auth_declined', 'true');
    } catch (e) {

    }
  };

  const handleDropdownMouseEnter = () => {
    if (dropdownTimeoutRef.current) {
      clearTimeout(dropdownTimeoutRef.current);
      dropdownTimeoutRef.current = null;
    }
    setShowDropdown(true);
  };

  const handleDropdownMouseLeave = () => {
    dropdownTimeoutRef.current = setTimeout(() => {
      setShowDropdown(false);
    }, 150);
  };

  const handlePortfolioNavigation = async () => {

    setIsMobileMenuOpen(false);

    if (isConnected && address) {

      const chain = await getChainPath();
      router.push(`/${chain}/dashboard`);
    } else {

      setShowConnectModal(true);
    }
  };

  const handleDashboardNavigation = async () => {

    setIsMobileMenuOpen(false);

    if (isConnected && address) {

      const chain = await getChainPath();
      router.push(`/${chain}/dashboard`);
    } else {

      setShowConnectModal(true);
    }
  };

  const isHomePage = pathname === '/';
  const NavContainer = ({ children }: { children: React.ReactNode }) => {
    return <Container>{children}</Container>;
  };

  const WalletButton = () => {

    const userDisconnectedFlag = typeof window !== 'undefined' && (
      localStorage.getItem('companeon_user_disconnected') === 'true' ||
      sessionStorage.getItem('companeon_user_disconnected') === 'true'
    );
    const preventAutoConnectFlag = typeof window !== 'undefined' && (
      localStorage.getItem('companeon_prevent_auto_connect') === 'true' ||
      sessionStorage.getItem('companeon_prevent_auto_connect') === 'true'
    );
    const hasEthereumDisconnectFlag = typeof window !== 'undefined' && 
      window.ethereum && (window.ethereum as any)._companeonUserDisconnected === true;

    if (userDisconnectedFlag || preventAutoConnectFlag || hasEthereumDisconnectFlag) {
      return (
        <button
          onClick={handleConnectWalletClick}
          disabled={isLoading}
          className={`flex items-center gap-2 max-w-[200px] relative pl-0.5 pr-4 py-2 rounded-[20px] transition-all group`}
        >
          <span className={`text-lg transition-colors ${isHomePage ? 'text-white group-hover:opacity-75' : 'text-black group-hover:opacity-75'}`}>
            {isLoading ? 'Connecting...' : 'Connect wallet'}
          </span>
        </button>
      );
    }

    const isWalletConnected = !!address && isConnected;
    
     if (isWalletConnected) {

       const directAuthCheck = isConnected && !!address;
       
       return (
         <div 
          className="relative" 
          ref={dropdownRef}
          onMouseEnter={handleDropdownMouseEnter}
          onMouseLeave={handleDropdownMouseLeave}
        >
           <button
             className="flex items-center gap-2 relative px-4 py-2 rounded-[20px]"
           >
             <Image 
               src="/icons/wallet-address-icon.png" 
               alt="Wallet Address" 
               className={`w-6 h-6 ${isHomePage ? 'filter invert' : ''}`} 
               width={24}
               height={24}
             />
             <span className={isHomePage ? 'text-white' : 'text-black'}>{shortenAddress(address)}</span>
            <svg
              className={`w-4 h-4 transition-transform duration-200 ${showDropdown ? 'rotate-180' : ''} ${isHomePage ? 'stroke-white' : 'stroke-black'}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <div 
            className={`absolute right-0 top-[calc(100%+0.25rem)] w-[180px] bg-white rounded shadow-[0_0_10px_rgba(0,0,0,0.1)] z-50 py-3 overflow-hidden transition-opacity duration-150 ${
              showDropdown ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
            }`}
          >
            {directAuthCheck ? (
              <>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (dropdownTimeoutRef.current) {
                      clearTimeout(dropdownTimeoutRef.current);
                      dropdownTimeoutRef.current = null;
                    }
                    handleDashboardNavigation();
                  }}
                  className="w-full text-left px-6 py-2 text-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0a2 2 0 012-2h12a2 2 0 012 2v0M9 22v-4h6v4" />
                  </svg>
                  Dashboard
                </button>
                <button
                  onClick={() => {
                    setShowDisconnectModal(true);
                    setShowDropdown(false);
                    if (dropdownTimeoutRef.current) {
                      clearTimeout(dropdownTimeoutRef.current);
                      dropdownTimeoutRef.current = null;
                    }
                  }}
                  className="w-full text-left px-6 py-2 text-lg text-red-600 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span>Disconnect</span>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => {
                    setShowDropdown(false);
                    if (dropdownTimeoutRef.current) {
                      clearTimeout(dropdownTimeoutRef.current);
                      dropdownTimeoutRef.current = null;
                    }
                    try {
                      sessionStorage.removeItem('auth_modal_closed');
                      sessionStorage.removeItem('auth_declined');
                    } catch (e) {

                    }
                    setShowAuthModal(true);
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-left px-6 py-2 text-lg text-gray-700 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  Authenticate
                </button>
                <button
                  onClick={() => {
                    setShowDisconnectModal(true);
                    setShowDropdown(false);
                    if (dropdownTimeoutRef.current) {
                      clearTimeout(dropdownTimeoutRef.current);
                      dropdownTimeoutRef.current = null;
                    }
                  }}
                  className="w-full text-left px-6 py-2 text-lg text-red-600 hover:bg-gray-100 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 ml-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  <span className="-ml-1">Disconnect</span>
                </button>
              </>
            )}
          </div>
        </div>
      );
    } else {

      return (
        <button
          onClick={handleConnectWalletClick}
          disabled={isLoading}
          className={`flex items-center gap-2 max-w-[200px] relative pl-0.5 pr-4 py-2 rounded-[20px] transition-all group`}
        >
          <span className={`text-lg transition-colors ${isHomePage ? 'text-white group-hover:opacity-75' : 'text-black group-hover:opacity-75'}`}>
            {isLoading
              ? 'Connecting...'
              : address
              ? shortenAddress(address)
              : 'Connect wallet'}
          </span>
        </button>
      );
    }
  };

  return (
    <nav className={`w-full sticky top-0 z-40`} style={{ backgroundColor: isHomePage ? '#1A1A1A' : 'white' }}>
      <NavContainer>
        <div className="flex justify-between items-center py-5">
          <Link href="/" className="no-underline flex items-center gap-2">
            <Image
              src={isHomePage ? "/companeon_symbol_white.png" : "/companeon_symbol_square.png"}
              alt="Companeon"
              width={36}
              height={36}
              className="h-9 w-9 object-contain"
            />
            <span className={`text-xl font-medium font-[family-name:var(--font-space-grotesk)] ${isHomePage ? 'text-white' : 'text-black'}`}>
              Companeon
            </span>
          </Link>
          
          {/* Desktop Navigation */}
          <div className={`hidden min-[950px]:flex items-center gap-6`}>
            {isHomePage && (
              <>
                <button
                  onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-lg transition-colors text-white hover:opacity-75 bg-transparent border-none cursor-pointer"
                >
                  How it works
                </button>
                <button
                  onClick={() => document.getElementById('faqs')?.scrollIntoView({ behavior: 'smooth' })}
                  className="text-lg transition-colors text-white hover:opacity-75 bg-transparent border-none cursor-pointer"
                >
                  FAQs
                </button>
              </>
            )}
            <a
              href="https://github.com/richardjaee/companeon-ai"
              target="_blank"
              rel="noopener noreferrer"
              className={`text-lg transition-colors ${isHomePage ? 'text-white hover:opacity-75' : 'text-black hover:opacity-75'}`}
            >
              GitHub
            </a>
            {isConnected && address ? (
              <WalletButton />
            ) : (
              <Link
                href="/mainnet/dashboard"
                className={`text-lg transition-colors ${isHomePage ? 'text-white hover:opacity-75' : 'text-black hover:opacity-75'}`}
              >
                Launch app
              </Link>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="min-[950px]:hidden flex items-center gap-3">
            <button
              className={`p-2 ${isHomePage ? 'text-white' : 'text-black'}`}
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label="Toggle mobile menu"
            >
              <svg
                className="w-6 h-6"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.5}
                viewBox="0 0 24 24"
              >
                {isMobileMenuOpen ? (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                ) : (
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                )}
              </svg>
            </button>
          </div>
        </div>
      </NavContainer>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="min-[950px]:hidden fixed inset-0 bg-white z-50">
          <NavContainer>
            {/* Header with close button */}
            <div className="flex justify-between items-center py-5 border-b border-gray-200">
              <Link href="/" className="no-underline flex items-center gap-2">
                <Image
                  src="/companeon_symbol_square.png"
                  alt="Companeon"
                  width={32}
                  height={32}
                  className="h-8 w-8 object-contain"
                />
                <span className="text-lg font-medium font-[family-name:var(--font-space-grotesk)] text-black">
                  Companeon
                </span>
              </Link>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                className="p-2"
                aria-label="Close menu"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={1.5}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            {/* Menu Content */}
            <div className="pt-4 pb-8">
              <div className="space-y-1">
                {isHomePage && (
                  <>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setTimeout(() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' }), 100);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3 text-lg"
                    >
                      How it works
                    </button>
                    <button
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        setTimeout(() => document.getElementById('faqs')?.scrollIntoView({ behavior: 'smooth' }), 100);
                      }}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3 text-lg"
                    >
                      FAQs
                    </button>
                  </>
                )}
                <a
                  href="https://github.com/richardjaee/companeon-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3 text-lg"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/>
                  </svg>
                  GitHub
                </a>
                <Link
                  href="/mainnet/dashboard"
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3 text-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Launch app
                </Link>
              </div>

              {isConnected && address && (
                <div className="border-t border-gray-200 mt-4 pt-4">
                  <div className="space-y-1">
                    <button
                      onClick={handleDashboardNavigation}
                      className="w-full text-left px-4 py-3 text-gray-700 hover:bg-gray-50 flex items-center gap-3 text-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2V7zm0 0a2 2 0 012-2h12a2 2 0 012 2v0M9 22v-4h6v4" />
                      </svg>
                      Dashboard
                    </button>
                    <button
                      onClick={() => {
                        setShowDisconnectModal(true);
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full text-left px-4 py-3 text-red-600 hover:bg-gray-50 flex items-center gap-3 text-lg"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                      </svg>
                      <span className="-ml-1">Disconnect</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </NavContainer>
        </div>
      )}
      
      {/* Thin line separator */}
      <div className={`border-b ${isHomePage ? 'border-gray-600' : 'border-gray-200'}`}></div>
      
      <WalletConnectModal
        isOpen={showConnectModal}
        onClose={() => setShowConnectModal(false)}
        onConnect={handleConnectWallet}
      />
      
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
        onCancel={handleAuthDeclined}
        refreshOnSuccess={true}
      />
      
      <DisconnectConfirmModal
        isOpen={showDisconnectModal}
        onClose={() => setShowDisconnectModal(false)}
      />
    </nav>
  );
}
