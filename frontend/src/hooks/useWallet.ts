'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { ethers } from 'ethers';
import * as Sentry from '@sentry/nextjs';

interface EthereumProvider {
  on(event: string, callback: (...args: any[]) => void): void;
  removeListener(event: string, callback: (...args: any[]) => void): void;
  request(args: { method: string; params?: any[] }): Promise<any>;
  isTrust?: boolean;
  isTrustWallet?: boolean;
  isTrustProvider?: boolean;
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
}

declare global {
  interface Window {
    ethereum?: any;
    trustwallet?: any;
  }
}

class WalletEventManager {
  private static instance: WalletEventManager;
  private listeners: Set<() => void> = new Set();
  private provider: EthereumProvider | null = null;
  private boundHandler: () => void;

  private constructor() {
    this.boundHandler = this.handleEvent.bind(this);
  }

  static getInstance(): WalletEventManager {
    if (!WalletEventManager.instance) {
      WalletEventManager.instance = new WalletEventManager();
    }
    return WalletEventManager.instance;
  }

  private lastKnownAddress: string | null = null;
  private eventDebounceTimer: NodeJS.Timeout | null = null;
  private isHandlingEvent: boolean = false;

  private handleEvent() {
    // Debounce to prevent Flask's spam of accountsChanged events
    if (this.eventDebounceTimer) {
      clearTimeout(this.eventDebounceTimer);
    }

    // Prevent re-entry during event handling
    if (this.isHandlingEvent) {
      return;
    }

    this.eventDebounceTimer = setTimeout(() => {
      this.isHandlingEvent = true;

      try {
        // Only clear cache if address actually changed (not on initial connect)
        if (typeof window !== 'undefined') {
          const currentAddress = window.localStorage.getItem('wallet_current_address');

          // If we have a previous address and it's different, clear cache
          if (this.lastKnownAddress && currentAddress &&
              this.lastKnownAddress.toLowerCase() !== currentAddress.toLowerCase()) {
            
            window.localStorage.removeItem('wallet_current_address');
            window.localStorage.removeItem('current_auth_address');
            window.localStorage.removeItem('auth_token');
            this.lastKnownAddress = null;
          } else if (currentAddress) {
            // Update last known address
            this.lastKnownAddress = currentAddress;
          }
        }

        this.listeners.forEach(listener => listener());
      } finally {
        this.isHandlingEvent = false;
      }
    }, 500); // 500ms debounce to handle Flask's event spam
  }

  getProviderForType(type: string | null): EthereumProvider | null {
    if (typeof window === 'undefined') return null;

    if (type === 'trust') {

      if (window.trustwallet) return window.trustwallet;

      if ((window.ethereum as any)?.providers) {
        const trustProvider = (window.ethereum as any).providers.find(
          (p: any) => p.isTrust || p.isTrustWallet || p.isTrustProvider ||
          (p.constructor?.name === 'TrustWeb3Provider') ||
          (typeof p.getTrustWalletVersion === 'function')
        );
        if (trustProvider) return trustProvider;
      }

      if (window.ethereum?.isTrust || 
          window.ethereum?.isTrustWallet || 
          window.ethereum?.isTrustProvider ||
          window.ethereum?.constructor?.name === 'TrustWeb3Provider' ||
          typeof (window.ethereum as any)?.getTrustWalletVersion === 'function') {
        return window.ethereum || null;
      }
    }

    if (type === 'walletconnect' && (window as any).companeonEthereumProvider) {
      return (window as any).companeonEthereumProvider as EthereumProvider;
    }

    return window.ethereum || (window as any).companeonEthereumProvider || null;
  }

  updateProvider(walletType: string | null) {

    if (this.provider) {
      this.provider.removeListener('accountsChanged', this.boundHandler);
      this.provider.removeListener('chainChanged', this.boundHandler);
      this.provider.removeListener('connect', this.boundHandler);
      this.provider.removeListener('disconnect', this.boundHandler);
    }

    this.provider = this.getProviderForType(walletType);

    if (this.provider) {
      this.provider.on('accountsChanged', this.boundHandler);
      this.provider.on('chainChanged', this.boundHandler);
      this.provider.on('connect', this.boundHandler);
      this.provider.on('disconnect', this.boundHandler);
    }
  }

  addListener(callback: () => void, walletType: string | null) {
    if (this.listeners.size === 0) {
      this.updateProvider(walletType);
    }
    this.listeners.add(callback);
  }

  removeListener(callback: () => void) {
    this.listeners.delete(callback);
    if (this.listeners.size === 0 && this.provider) {
      this.provider.removeListener('accountsChanged', this.boundHandler);
      this.provider.removeListener('chainChanged', this.boundHandler);
      this.provider.removeListener('connect', this.boundHandler);
      this.provider.removeListener('disconnect', this.boundHandler);
      this.provider = null;
    }
  }

  notifyDisconnect() {
    this.listeners.forEach(listener => listener());
  }
}

const getAuthenticatedAddress = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const normalizeAddress = (address: string): string => {

    if (address.startsWith('0x')) {
      return address.toLowerCase();
    }

    return address;
  };
  
  const sessionAuthAddress = window.sessionStorage.getItem('current_auth_address');
  if (sessionAuthAddress) {
    return normalizeAddress(sessionAuthAddress);
  }
  
  const localAuthAddress = window.localStorage.getItem('current_auth_address');
  if (localAuthAddress) {
    return normalizeAddress(localAuthAddress);
  }
  
  const walletCurrentAddress = window.localStorage.getItem('wallet_current_address');
  if (walletCurrentAddress) {
    return normalizeAddress(walletCurrentAddress);
  }
  
  return null;
};

const updateAuthenticatedAddress = (address: string | null): void => {
  if (typeof window === 'undefined') return;
  
  window.sessionStorage.removeItem('current_auth_address');
  window.localStorage.removeItem('current_auth_address');
  
  if (address) {

    const normalizeAddress = (addr: string): string => {

      if (addr.startsWith('0x')) {
        return addr.toLowerCase();
      }

      return addr;
    };
    
    const normalizedAddress = normalizeAddress(address);
    window.sessionStorage.setItem('current_auth_address', normalizedAddress);
    window.localStorage.setItem('wallet_current_address', normalizedAddress);
  }
};

export { getAuthenticatedAddress, updateAuthenticatedAddress };

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [walletType, setWalletType] = useState<string | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [ethereum, setEthereum] = useState<EthereumProvider | null>(null);

  const mountedRef = useRef(true);
  const checkTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  const updateWalletType = (type: string | null) => {
    if (typeof window === 'undefined') return;
    
    window.localStorage.removeItem('walletChoice');
    window.sessionStorage.removeItem('current_wallet_type');
    
    if (type) {
      window.localStorage.setItem('walletChoice', type);
      window.sessionStorage.setItem('current_wallet_type', type);
      setWalletType(type);
      
      WalletEventManager.getInstance().updateProvider(type);
    }
  };

  const checkConnection = useCallback(async () => {
    if (!mountedRef.current) return;

    try {

      const authAddress = getAuthenticatedAddress();
      
      const provider = WalletEventManager.getInstance().getProviderForType(walletType);
      if (!provider) {
        if (ethereum !== null) {
          setEthereum(null);
        }
        
        if (authAddress) {
          setAddress(authAddress);
          setIsConnected(true);
        } else {
          setAddress(null);
          setIsConnected(false);
        }
        
        if (!isInitialized) {
          setIsInitialized(true);
        }
        return;
      }

      if (ethereum !== provider) {
        setEthereum(provider);
      }

      if (authAddress) {
        if (address !== authAddress) {
          setAddress(authAddress);
        }
        setIsConnected(true);
        if (!isInitialized) {
          setIsInitialized(true);
        }
        return;
      }

      const ethersProvider = new ethers.BrowserProvider(provider);
      const accounts = await ethersProvider.send("eth_accounts", []);
      
      const newAddress = accounts.length > 0 ? accounts[0].toLowerCase() : null;
      const newIsConnected = accounts.length > 0;

      if (mountedRef.current) {
        if (address !== newAddress) {
          setAddress(newAddress);
        }
        if (isConnected !== newIsConnected) {
          setIsConnected(newIsConnected);
        }
        if (!isInitialized) {
          setIsInitialized(true);
        }
      }
    } catch (error) {
      Sentry.captureException(error);

      const authAddress = getAuthenticatedAddress();
      if (authAddress) {
        setAddress(authAddress);
        setIsConnected(true);
      } else {
        setAddress(null);
        setIsConnected(false);
      }
      setEthereum(null);
      if (!isInitialized) {
        setIsInitialized(true);
      }
    }
  }, [address, ethereum, isConnected, isInitialized, walletType]);

  const debouncedCheck = useCallback(() => {
    if (checkTimeoutRef.current) {
      clearTimeout(checkTimeoutRef.current);
    }
    
    checkTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        checkConnection();
      }
    }, 100);
  }, [checkConnection]);

  useEffect(() => {
    mountedRef.current = true;
    
    debouncedCheck();

    const eventManager = WalletEventManager.getInstance();
    eventManager.addListener(debouncedCheck, walletType);

    return () => {
      mountedRef.current = false;
      
      if (checkTimeoutRef.current) {
        clearTimeout(checkTimeoutRef.current);
      }

      eventManager.removeListener(debouncedCheck);
    };
  }, [debouncedCheck, walletType]);

  useEffect(() => {
    if (typeof window !== 'undefined' && !walletType) {
      const storedWalletType = window.localStorage.getItem('walletChoice') || 
                              window.sessionStorage.getItem('current_wallet_type');
      if (storedWalletType) {
        setWalletType(storedWalletType);
      }
    }
  }, [walletType]);

  const connectWallet = async (specificWalletType?: string | null) => {
    try {

      const authAddress = getAuthenticatedAddress();
      
      if (specificWalletType) {
        updateWalletType(specificWalletType);
      }
      
      const effectiveWalletType = specificWalletType || walletType;
      
      if (authAddress && effectiveWalletType) {
        setAddress(authAddress);
        setIsConnected(true);
        return authAddress;
      }
      
      const provider = WalletEventManager.getInstance().getProviderForType(effectiveWalletType);
      if (provider) {

        if (!effectiveWalletType) {
          if (provider.isMetaMask) {
            updateWalletType('metamask');
          } else if (provider.isCoinbaseWallet) {
            updateWalletType('coinbase');
          } else if (provider.isTrust || provider.isTrustWallet) {
            updateWalletType('trust');
          }
        }
        
        const ethersProvider = new ethers.BrowserProvider(provider);
        const accounts = await ethersProvider.send("eth_requestAccounts", []);
        
        if (accounts.length > 0) {
          const connectedAddress = accounts[0].toLowerCase();
          setAddress(connectedAddress);
          setIsConnected(true);

          updateAuthenticatedAddress(connectedAddress);
          return connectedAddress;
        }
      }
    } catch (error) {
      Sentry.captureException(error);
      setIsConnected(false);
      
      const authAddress = getAuthenticatedAddress();
      if (authAddress) {
        setAddress(authAddress);
        setIsConnected(true);
        return authAddress;
      }
      setAddress(null);
    }
    return null;
  };

  const signMessage = async (message: string) => {
    try {

      let selectedProvider: any = null;
      
      if (typeof window !== 'undefined' && window.ethereum?.providers?.length > 0) {
        if (walletType === 'metamask') {

          selectedProvider = window.ethereum.providers.find((p: any) => p.isMetaMask && !p.isCoinbaseWallet);
        } else if (walletType === 'coinbase') {

          selectedProvider = window.ethereum.providers.find((p: any) => p.isCoinbaseWallet);
        } else {

          selectedProvider = WalletEventManager.getInstance().getProviderForType(walletType);
        }
      } else {

        selectedProvider = WalletEventManager.getInstance().getProviderForType(walletType);
      }
      
      if (!selectedProvider || !address) {
        return null;
      }
      
      if (!isConnected && address) {
        try {
          await connectWallet(walletType);
        } catch (reconnectError) {
          }
      }
      
      const ethersProvider = new ethers.BrowserProvider(selectedProvider);
      const signer = await ethersProvider.getSigner();
      
      const signerAddress = await signer.getAddress();
      if (signerAddress.toLowerCase() !== address.toLowerCase()) {
        throw new Error('Signer address mismatch');
      }
      
      const signature = await signer.signMessage(message);
      return signature;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  };

  const disconnectWallet = () => {
    if (typeof window !== 'undefined') {

      window.localStorage.removeItem('auth_token');
      window.localStorage.removeItem('wallet_current_address');
      window.localStorage.removeItem('current_auth_address');
      window.localStorage.removeItem('walletChoice');
      window.localStorage.removeItem('wallet_is_connected');
      window.localStorage.removeItem('current_wallet_type');
      window.localStorage.removeItem('auth_current_wallet');
      window.localStorage.removeItem('auth_expiry');
      window.sessionStorage.removeItem('auth_token_backup');
      window.sessionStorage.removeItem('current_auth_address');
      window.sessionStorage.removeItem('auth_in_progress');
      window.sessionStorage.removeItem('current_wallet_type');
      window.sessionStorage.removeItem('wallet_current_address');
      window.sessionStorage.removeItem('wallet_is_connected');
      window.sessionStorage.removeItem('auth_current_wallet');
      
      const coinbasePatterns = [
        '-walletlink:', 'coinbase', 'walletlink', 'cb_', 'CoinbaseWalletSDK',
        'WalletLink', 'walletlink'
      ];
      
      const clearLocalStorageKeys = (patterns: string[]) => {
        const keys = Object.keys(window.localStorage);
        keys.forEach(key => {
          if (patterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
            try { window.localStorage.removeItem(key); } catch (e) {}
          }
        });
      };
      
      const clearSessionStorageKeys = (patterns: string[]) => {
        const keys = Object.keys(window.sessionStorage);
        keys.forEach(key => {
          if (patterns.some(pattern => key.toLowerCase().includes(pattern.toLowerCase()))) {
            try { window.sessionStorage.removeItem(key); } catch (e) {}
          }
        });
      };
      
      clearLocalStorageKeys(coinbasePatterns);
      clearSessionStorageKeys(coinbasePatterns);
      
      const metamaskKeys = Object.keys(window.localStorage)
        .filter(key => key.startsWith('metamask') || key.includes('metamask'));
      
      metamaskKeys.forEach(key => {
        window.localStorage.removeItem(key);
      });
      
      try {
        if (window.ethereum && (window.ethereum as any)._events) {

          (window.ethereum as any)._events = {};
        }
        
        if (window.ethereum && window.ethereum.providers) {

          window.ethereum.providers.forEach((provider: any) => {
            if (provider._events) {
              provider._events = {};
            }
          });
        }
      } catch (e) {

      }
      
      setAddress(null);
      setIsConnected(false);
      setWalletType(null);
      
      WalletEventManager.getInstance().notifyDisconnect();
    }
  };

  return {
    address,
    isConnected,
    ethereum: ethereum || (typeof window !== 'undefined' && window.ethereum ? window.ethereum : null),
    isInitialized,
    walletType,
    connectWallet,
    signMessage,
    disconnectWallet,
    updateWalletType,
  };
}
