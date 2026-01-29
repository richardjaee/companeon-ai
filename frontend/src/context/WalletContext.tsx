
'use client';

import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { usePathname } from 'next/navigation';
import { ethers } from 'ethers';
import { MetaMaskProvider } from '@/lib/wallets/metamask';
import { CoinbaseProvider } from '@/lib/wallets/coinbase';
import { TrustWalletProvider } from '@/lib/wallets/trust';
import { BraveWalletProvider } from '@/lib/wallets/brave';
import { RabbyProvider } from '@/lib/wallets/rabby';
import { WalletConnectProvider } from '@/lib/wallets/walletconnect';
import { Web3AuthProvider } from '@/lib/wallets/web3auth';
import type { BaseWalletProvider } from '@/lib/wallets/baseWalletProvider';
import * as Sentry from '@sentry/nextjs';
import { STORAGE_KEYS, getStorageItem, setStorageItem, removeStorageItem, clearWalletStorage } from '@/lib/constants/storage';
import { requestEIP6963Providers, getCachedEIP6963Providers } from '@/lib/wallets/eip6963';
import { getChainConfig, getChainType } from '@/lib/config';

export type EthereumWalletType = 'metamask' | 'coinbase' | 'trust' | 'brave' | 'rabby' | 'walletconnect' | 'web3auth';
export type WalletType = EthereumWalletType | null;
export type ChainType = 'ethereum' | null;

function detectAddressType(address: string): ChainType {
  if (!address) return null;
  
  if (address.startsWith('0x') && address.length === 42) {
    return 'ethereum';
  }
  return null;
}

interface WalletContextType {
  walletType: WalletType;
  chainType: ChainType;
  address: string | null;
  isConnected: boolean;
  connectWallet: (type: WalletType) => Promise<string | null>;
  disconnectWallet: () => Promise<void>;
  signMessage: (message: string, options?: { isSessionRefresh?: boolean }) => Promise<string>;
  error: string | null;
  isInitializing: boolean;
  isConnecting: boolean;
  provider: BaseWalletProvider | null;
}

const WalletContext = createContext<WalletContextType>({
  walletType: null,
  chainType: null,
  address: null,
  isConnected: false,
  connectWallet: async () => null,
  disconnectWallet: async () => {},
  signMessage: async () => '',
  error: null,
  isInitializing: false,
  isConnecting: false,
  provider: null,
});

export function WalletProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [walletType, setWalletType] = useState<WalletType>(null);
  const [chainType, setChainType] = useState<ChainType>(null);
  const [address, setAddress] = useState<string | null>(null);
  const [provider, setProvider] = useState<BaseWalletProvider | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isConnecting, setIsConnecting] = useState(false);

  const accountsChangedHandlerRef = useRef<((accounts: string[]) => void) | null>(null);

  const connectWalletRef = useRef<(type: WalletType) => Promise<string | null>>(async () => null);

  const setupAccountChangeListenerRef = useRef<((ethereum: any) => void) | null>(null);
  const manualDisconnectRef = useRef(false);

  /**
 * Ensure wallet is on the correct network based on current route
 * Detects chain from URL pathname (/base/* or /mainnet/*)
 */
  const ensureCorrectNetwork = useCallback(async () => {
    if (typeof window === 'undefined') return;

    // Detect chain from URL
    const chainMatch = pathname?.match(/^\/(base|mainnet)\//);
    const currentChain = chainMatch ? chainMatch[1] : 'base';
    const chainConfig = getChainConfig(getChainType(currentChain));

    const anyWindow = window as any;
    const reqProvider: any =
      (anyWindow.companeonEthereumProvider && typeof anyWindow.companeonEthereumProvider.request === 'function'
        ? anyWindow.companeonEthereumProvider
        : (anyWindow.ethereum && typeof anyWindow.ethereum.request === 'function' ? anyWindow.ethereum : null));

    if (!reqProvider) {
      throw new Error('Wallet provider not available');
    }

    const currentChainId = await reqProvider.request({ method: 'eth_chainId' });
    if (currentChainId === chainConfig.chainIdHex) return;

    try {
      await reqProvider.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainConfig.chainIdHex }],
      });
    } catch (switchError: any) {
      if (switchError?.code === 4902) {
        try {
          await reqProvider.request({
            method: 'wallet_addEthereumChain',
            params: [{
              chainId: chainConfig.chainIdHex,
              chainName: chainConfig.name,
              nativeCurrency: chainConfig.nativeCurrency,
              rpcUrls: [chainConfig.rpcUrl],
              blockExplorerUrls: [chainConfig.blockExplorer],
            }],
          });
        } catch {
          throw new Error(`Please switch your wallet to the ${chainConfig.name} network`);
        }
      } else {
        throw new Error(`Please switch your wallet to the ${chainConfig.name} network`);
      }
    }
  }, [pathname]);

  const updateAddressAndChain = useCallback((newAddress: string | null) => {
    const oldAddress = address;
    setAddress(newAddress);
    const detectedChainType = newAddress ? detectAddressType(newAddress) : null;
    setChainType(detectedChainType);
    
    if (newAddress) {
      setStorageItem(STORAGE_KEYS.WALLET.ADDRESS, newAddress);
      setStorageItem('wallet_chain_type', detectedChainType || '');
    } else {
      removeStorageItem(STORAGE_KEYS.WALLET.ADDRESS);
      removeStorageItem('wallet_chain_type');
    }

    if (oldAddress !== newAddress) {
      window.dispatchEvent(new CustomEvent('wallet:address:changed', {
        detail: { oldAddress, newAddress }
      }));
    }
  }, [address]);

  const cleanupProvider = useCallback((providerInstance: BaseWalletProvider | null) => {
    if (!providerInstance) return;

    try {

      const ethersProvider = ('provider' in providerInstance) ? providerInstance.provider as ethers.JsonRpcProvider | null : null;

      if (ethersProvider) {

        if (typeof ethersProvider.destroy === 'function') {
          ethersProvider.destroy();
        } else {

          if ((ethersProvider as any)._networkPromise) (ethersProvider as any)._networkPromise = null;
          if ((ethersProvider as any)._network) (ethersProvider as any)._network = null;
          if ((ethersProvider as any)._poller) {
            clearInterval((ethersProvider as any)._poller);
            (ethersProvider as any)._poller = null;
          }
        }

        if ('provider' in providerInstance) {
          providerInstance.provider = null;
        }
      }
    } catch (err) {
      Sentry.captureException(err);
    }
  }, []);

  const createProvider = useCallback((type: WalletType): BaseWalletProvider | null => {
    if (!type) return null;
    
    try {

      switch (type) {
        case 'metamask':
          return new MetaMaskProvider();
        case 'coinbase':
          return new CoinbaseProvider();
        case 'trust':
          return new TrustWalletProvider();
        case 'brave':
          return new BraveWalletProvider();
        case 'rabby':
          return new RabbyProvider();
        case 'walletconnect':
          return new WalletConnectProvider();
        case 'web3auth':
          return new Web3AuthProvider();
        default:
          return null;
      }
    } catch (err) {
      Sentry.captureException(err);
      return null;
    }
  }, []);

  const checkForExternalReturn = useCallback(() => {
    if (typeof window === 'undefined') return false;
    
    try {
      const isRedirectPending = getStorageItem(STORAGE_KEYS.NAVIGATION.REDIRECT_PENDING) === 'true';
      
      if (isRedirectPending) {

        removeStorageItem(STORAGE_KEYS.NAVIGATION.REDIRECT_PENDING);
        
        removeStorageItem(STORAGE_KEYS.LEGACY.PREVENT_AUTO_CONNECT);
        removeStorageItem(STORAGE_KEYS.LEGACY.USER_DISCONNECTED);
        
        return true;
      }
    } catch (e) {
      Sentry.captureException(e);
    }
    
    return false;
  }, []);

  const clearAllWalletStorage = useCallback((clearAuthTokens = false) => {
    try {

      const localStorageKeys = Object.keys(localStorage);
      const sessionStorageKeys = Object.keys(sessionStorage);
      
      const localKeysToRemove = [
        'walletChoice',
        'current_wallet_type',
        'wallet_current_address',
        'wallet_is_connected',
        'last_reconnect_attempt',
        'companeon_user_disconnected',
        'companeon_prevent_auto_connect',
        'user_disconnected',
        'prevent_auto_connect',
        'companeon_block_dashboard_redirect',
        'wallet_current_address',
        'current_auth_address',
        'companeon_wallet_address',
        'wallet_address',
        'eth_address',
        'solana_address',
        'connected_address'
      ];
      
      localKeysToRemove.forEach(key => {
        localStorage.removeItem(key);
      });
      
      const sessionKeysToRemove = [
        'current_auth_address',
        'auth_current_wallet',
        'companeon_user_disconnected',
        'companeon_prevent_auto_connect',
        'companeon_wallet_connect_in_progress',
        'companeon_metamask_pending',
        'companeon_metamask_pending_timestamp',
        'companeon_metamask_signature_pending',
        'companeon_metamask_signature_timestamp',
        'companeon_cb_connected_account',
        'companeon_cb_debug_info',
        'companeon_cb_device_info',
        'companeon_user_initiated_connect',
        'auth_declined',
        'auth_modal_closed',
        'companeon_session_naturally_expired',
        'auth_from_session_expired',
        'current_wallet_type',
        'user_disconnected',
        'prevent_auto_connect',
        'companeon_wallet_address',
        'wallet_address',
        'eth_address',
        'solana_address',
        'connected_address'
      ];
      
      sessionKeysToRemove.forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      localStorageKeys.filter(key => key.startsWith('walletlink:') || key.startsWith('-walletlink:')).forEach(key => {
        localStorage.removeItem(key);
      });
      
      sessionStorageKeys.filter(key => key.startsWith('walletlink:') || key.startsWith('-walletlink:')).forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      localStorageKeys.filter(key => key.includes('coinbase') || key.includes('cb_')).forEach(key => {
        localStorage.removeItem(key);
      });
      
      sessionStorageKeys.filter(key => key.includes('coinbase') || key.includes('cb_')).forEach(key => {
        sessionStorage.removeItem(key);
      });
      
      localStorageKeys.filter(key => key.includes('metamask')).forEach(key => {
        localStorage.removeItem(key);
      });
      
      sessionStorageKeys.filter(key => key.includes('metamask')).forEach(key => {
        sessionStorage.removeItem(key);
      });
      
    } catch (err) {
      Sentry.captureException(err);
    }
  }, []);

  const disconnectWallet = useCallback(async () => {

    manualDisconnectRef.current = true;
    setIsConnected(false);
    updateAddressAndChain(null);
    setWalletType(null);
    setChainType(null);
    setError(null);
    
    const currentProvider = provider;
    
    setProvider(null);
    
    try {

      clearAllWalletStorage(true);
      
      if (window.ethereum) {
        try {
          delete (window.ethereum as any)._companeonUserDisconnected;
        } catch (err) {
          Sentry.captureException(err);
        }
      }
      
       if (typeof window !== 'undefined') {

         try {
           const allLocalKeys = Object.keys(localStorage);
           const allSessionKeys = Object.keys(sessionStorage);
           
           allLocalKeys.forEach(key => {
             if (key.includes('wallet') || key.includes('companeon') || key.includes('metamask') || 
                 key.includes('coinbase') || key.includes('auth') || key.includes('connect') ||
                 key.includes('brave') || key.includes('trust') || key.startsWith('walletlink') ||
                 key.startsWith('-walletlink')) {
               localStorage.removeItem(key);
             }
           });
           
           allSessionKeys.forEach(key => {
             if (key.includes('wallet') || key.includes('companeon') || key.includes('metamask') || 
                 key.includes('coinbase') || key.includes('auth') || key.includes('connect') ||
                 key.includes('brave') || key.includes('trust') || key.startsWith('walletlink') ||
                 key.startsWith('-walletlink')) {
               sessionStorage.removeItem(key);
             }
           });
         } catch (err) {
           Sentry.captureException(err);
         }
       }
      
    } catch (err) {
      Sentry.captureException(err);
    }
    
    if (currentProvider) {
      try {
        await cleanupProvider(currentProvider);
      } catch (err) {
        Sentry.captureException(err);
      }
    }
    
    window.dispatchEvent(new CustomEvent('wallet:disconnected'));
    
    window.dispatchEvent(new CustomEvent('wallet:reset'));
    
  }, [provider, cleanupProvider, clearAllWalletStorage]);

  const syncAddressFromProviders = useCallback(async () => {
    if (typeof window === 'undefined') {
      return null;
    }

    if (manualDisconnectRef.current) {
      return null;
    }

    // Respect persisted disconnect flags across page refreshes
    try {
      const userDisconnected = localStorage.getItem('companeon_user_disconnected') === 'true' ||
        sessionStorage.getItem('companeon_user_disconnected') === 'true';
      const preventAutoConnect = localStorage.getItem('companeon_prevent_auto_connect') === 'true' ||
        sessionStorage.getItem('companeon_prevent_auto_connect') === 'true';
      if (userDisconnected || preventAutoConnect) {
        return null;
      }
    } catch (_) {}


    if (chainType && chainType !== 'ethereum') {
      return null;
    }

    const potentialProviders: any[] = [];
    const anyWindow = window as any;

    if (anyWindow.companeonEthereumProvider) {
      potentialProviders.push(anyWindow.companeonEthereumProvider);
    }

    if (anyWindow.ethereum) {
      const { ethereum } = anyWindow;

      if (Array.isArray(ethereum.providers) && ethereum.providers.length > 0) {
        ethereum.providers.forEach((providerInstance: any) => {
          if (providerInstance) {
            potentialProviders.push(providerInstance);
          }
        });
      } else {
        potentialProviders.push(ethereum);
      }
    }

    // Include any EIP-6963 discovered providers
    try {
      await requestEIP6963Providers(200);
      const discovered = getCachedEIP6963Providers();
      for (const d of discovered) {
        if (d?.provider) {
          potentialProviders.push(d.provider);
        }
      }
    } catch (_) {}

    const providersToCheck = potentialProviders
      .filter(Boolean)
      .filter((providerInstance, index, array) => array.indexOf(providerInstance) === index);

    if (providersToCheck.length === 0) {
      return null;
    }

    for (const providerInstance of providersToCheck) {
      if (typeof providerInstance?.request !== 'function') {
        continue;
      }

      try {
        const accounts = await providerInstance.request({ method: 'eth_accounts' }) as string[] | undefined;

        if (accounts && accounts.length > 0) {
          const nextAddress = accounts[0];
          const normalizedNext = nextAddress?.toLowerCase();
          const normalizedCurrent = address?.toLowerCase();

          if (!normalizedCurrent || normalizedCurrent !== normalizedNext) {
            updateAddressAndChain(nextAddress);
          }

          if (!isConnected) {
            setIsConnected(true);
            setStorageItem(STORAGE_KEYS.WALLET.IS_CONNECTED, 'true');
          }

          return nextAddress;
        }
      } catch (err) {
        // Provider might not support eth_accounts without an active session; ignore and continue.
      }
    }

    if (isConnected || address) {
      await disconnectWallet();
    }

    return null;
  }, [address, chainType, disconnectWallet, isConnected, updateAddressAndChain, walletType]);

  // Debounce timer for Flask's event spam
  const accountsChangedDebounceRef = useRef<NodeJS.Timeout | null>(null);
  const isHandlingAccountsChangedRef = useRef(false);

  const setupAccountChangeListener = useCallback((ethereum: any) => {

    if (accountsChangedHandlerRef.current) {
      try {
        ethereum.removeListener('accountsChanged', accountsChangedHandlerRef.current);
      } catch (err) {
        Sentry.captureException(err);
      }
    }

    const handleAccountsChanged = async (accounts: string[]) => {
      // Debounce to prevent Flask's spam of accountsChanged events
      if (accountsChangedDebounceRef.current) {
        clearTimeout(accountsChangedDebounceRef.current);
      }

      // Prevent re-entry during event handling
      if (isHandlingAccountsChangedRef.current) {
        return;
      }

      accountsChangedDebounceRef.current = setTimeout(async () => {
        isHandlingAccountsChangedRef.current = true;

        try {
          if (!accounts || accounts.length === 0) {
            await disconnectWallet();
            return;
          }

          const newAddress = accounts[0];
          const normalizedNext = newAddress?.toLowerCase();
          const normalizedCurrent = address?.toLowerCase();

          if (!normalizedCurrent || normalizedCurrent !== normalizedNext) {
            updateAddressAndChain(newAddress);
          }

          setIsConnected(prevConnected => {
            if (!prevConnected) {
              setStorageItem(STORAGE_KEYS.WALLET.IS_CONNECTED, 'true');
              return true;
            }
            return prevConnected;
          });

          await syncAddressFromProviders();
        } finally {
          isHandlingAccountsChangedRef.current = false;
        }
      }, 500); // 500ms debounce to handle Flask's event spam
    };

    accountsChangedHandlerRef.current = handleAccountsChanged;

    try {

      if (typeof ethereum.setMaxListeners === 'function') {

        ethereum.setMaxListeners(100);
      }
    } catch (err) {
      Sentry.captureException(err);
    }

    ethereum.on('accountsChanged', handleAccountsChanged);
  }, [address, disconnectWallet, syncAddressFromProviders, updateAddressAndChain]);

  useEffect(() => {
    setupAccountChangeListenerRef.current = setupAccountChangeListener;
  }, [setupAccountChangeListener]);

  const connectWallet = useCallback(
    async (type: WalletType): Promise<string | null> => {

      if (isConnecting) {
        return null;
      }

      setError(null);
      setIsConnecting(true);

      try {

        if (isConnected || provider) {
          try {

            if (provider) {
              await cleanupProvider(provider);
            }
            setProvider(null);
            setAddress(null);
            setWalletType(null);
            setIsConnected(false);
            
            clearAllWalletStorage(false);
          } catch (err) {
            Sentry.captureException(err);

          }
        }

        clearAllWalletStorage(false);
        setAddress(null);
        updateAddressAndChain(null);

        if (typeof window !== 'undefined') {
          removeStorageItem(STORAGE_KEYS.LEGACY.USER_DISCONNECTED);
          removeStorageItem(STORAGE_KEYS.LEGACY.PREVENT_AUTO_CONNECT);
          removeStorageItem('user_disconnected');
        }

        manualDisconnectRef.current = false;

        const walletProvider = createProvider(type);
        
        if (!walletProvider) {
          throw new Error(`Could not initialize ${type} wallet provider`);
        }

        setProvider(walletProvider);
        
        setWalletType(type);
        
        const result: any = await walletProvider.connect();

        let walletAddress: string | null = null;
        
        if (typeof result === 'string') {
          walletAddress = result;
        } else if (result && 'success' in result) {
          if (!result.success) {
            throw new Error(result.error?.message || 'Failed to connect wallet');
          }
          walletAddress = result.address || null;
        } else {
          throw new Error('Invalid response from wallet connection');
        }

        if (!walletAddress) {
          throw new Error('No wallet address returned from connection');
        }

        // Enforce Base network for EVM wal before finalizing connection
        if (type) {
          await ensureCorrectNetwork();
        }

        updateAddressAndChain(walletAddress);
        setIsConnected(true);

        if (typeof window !== 'undefined') {

          setStorageItem(STORAGE_KEYS.WALLET.CHOICE, type || '');
          setStorageItem(STORAGE_KEYS.WALLET.ADDRESS, walletAddress);
          setStorageItem(STORAGE_KEYS.WALLET.IS_CONNECTED, 'true');
          
          setStorageItem('current_wallet_type', type || '');
          setStorageItem(STORAGE_KEYS.LEGACY.CURRENT_AUTH_ADDRESS, walletAddress);
          
          setStorageItem('auth_current_wallet', type || '');
        }

        if (setupAccountChangeListenerRef.current) {
          const wc = (window as any).companeonEthereumProvider;
          if (wc) {
            setupAccountChangeListenerRef.current(wc);
          } else if (window.ethereum) {
            setupAccountChangeListenerRef.current(window.ethereum);
          }
        }
        
        window.dispatchEvent(new CustomEvent('wallet:connected'));

        return walletAddress;
      } catch (err: any) {
        Sentry.captureException(err);
        
        if (provider) {
          cleanupProvider(provider);
          setProvider(null);
        }
        
        updateAddressAndChain(null);
        setWalletType(null);
        setChainType(null);
        setIsConnected(false);
        setError(err.message || 'Failed to connect wallet');
        
        return null;
      } finally {
        setIsConnecting(false);
      }
    },
    [provider, cleanupProvider, createProvider, isConnected, clearAllWalletStorage, isConnecting]
  );
  
  useEffect(() => {
    connectWalletRef.current = connectWallet;
  }, [connectWallet]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    syncAddressFromProviders();
  }, [syncAddressFromProviders]);

  useEffect(() => {
    if (!isConnected) {
      return;
    }

    if (chainType && chainType !== 'ethereum') {
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    let isSyncing = false;

    const runSync = async () => {
      if (isSyncing) {
        return;
      }
      isSyncing = true;
      try {
        await syncAddressFromProviders();
      } finally {
        isSyncing = false;
      }
    };

    const intervalId = window.setInterval(runSync, 4000);
    runSync();

    const handleFocus = () => {
      runSync();
    };

    window.addEventListener('focus', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [chainType, isConnected, syncAddressFromProviders, walletType]);

  const attemptAutoConnect = useCallback(async () => {
    setIsInitializing(true);
    setError(null);
    
    try {

      const returnedFromExternal = checkForExternalReturn();
      
      const hasUserDisconnected = 
        (getStorageItem(STORAGE_KEYS.LEGACY.USER_DISCONNECTED) === 'true' || 
         getStorageItem('companeon_user_disconnected') === 'true') && 
        !returnedFromExternal;
      
      const preventAutoConnect = 
        getStorageItem(STORAGE_KEYS.LEGACY.PREVENT_AUTO_CONNECT) === 'true' || 
        getStorageItem('companeon_prevent_auto_connect') === 'true';
      
      if (hasUserDisconnected || preventAutoConnect) {
        setIsInitializing(false);
        return false;
      }

      const savedWalletType = getStorageItem(STORAGE_KEYS.WALLET.CHOICE) as WalletType || 
                             getStorageItem('current_wallet_type') as WalletType;
      
      const savedWalletAddress = getStorageItem(STORAGE_KEYS.WALLET.ADDRESS) || 
                                getStorageItem('wallet_current_address') ||
                                getStorageItem(STORAGE_KEYS.LEGACY.CURRENT_AUTH_ADDRESS);
      
      const isWalletConnected = getStorageItem(STORAGE_KEYS.WALLET.IS_CONNECTED) === 'true' || 
                               getStorageItem('wallet_is_connected') === 'true';
      
      if (!savedWalletType || !savedWalletAddress) {
        setIsInitializing(false);
        return false;
      }

      if (returnedFromExternal) {
        try {
          await connectWalletRef.current(savedWalletType as WalletType);

          window.dispatchEvent(new CustomEvent('wallet:connected'));
        } catch (err) {
          Sentry.captureException(err);
        }
      } else {

        try {
          const walletProvider = createProvider(savedWalletType as WalletType);
          if (walletProvider) {
            let connectedAddress: string | null = null;
            
            if ('silentConnect' in walletProvider && typeof walletProvider.silentConnect === 'function') {
              const result = await walletProvider.silentConnect();
              connectedAddress = typeof result === 'string' ? result : result?.address || null;
            }
            
            if (connectedAddress) {
              // Enforce Base network for EVM wal before restoring connection
              if (savedWalletType) {
                await ensureCorrectNetwork();
              }
              setProvider(walletProvider);
              setWalletType(savedWalletType);
              updateAddressAndChain(connectedAddress);
              setIsConnected(true);
              
              if (setupAccountChangeListenerRef.current) {
                const wc = (window as any).companeonEthereumProvider;
                if (wc) {
                  setupAccountChangeListenerRef.current(wc);
                } else if (window.ethereum) {
                  setupAccountChangeListenerRef.current(window.ethereum);
                }
              }
            } else {
              setIsConnected(false);
              updateAddressAndChain(null);
              setWalletType(null);
              setChainType(null);
              setProvider(null);
              
              removeStorageItem(STORAGE_KEYS.WALLET.CHOICE);
              removeStorageItem(STORAGE_KEYS.WALLET.ADDRESS);
              removeStorageItem(STORAGE_KEYS.WALLET.IS_CONNECTED);
            }
          }
        } catch (err) {
          Sentry.captureException(err);

          setIsConnected(false);
          updateAddressAndChain(null);
          setWalletType(null);
          setChainType(null);
          setProvider(null);
        }
      }
      
      setIsInitializing(false);
      return true;
    } catch (err: any) {
      Sentry.captureException(err);
      setError(err.message || 'Failed to auto-connect wallet');
      setIsInitializing(false);
      return false;
    }
  }, [checkForExternalReturn, createProvider]);

  const signMessage = useCallback(
    async (message: string, options?: { isSessionRefresh?: boolean }): Promise<string> => {
      const isSessionRefresh = options?.isSessionRefresh || false;
      
      if ((!provider || provider === null) && address && isConnected && isSessionRefresh) {
        
        try {

          const savedWalletChoice = typeof window !== 'undefined' ? 
            getStorageItem(STORAGE_KEYS.WALLET.CHOICE) as WalletType | null : 
            null;
            
          if (savedWalletChoice) {
            
            let tempProvider: BaseWalletProvider;
            switch (savedWalletChoice) {
              case 'metamask':
                tempProvider = new MetaMaskProvider();
                break;
              case 'coinbase':
                tempProvider = new CoinbaseProvider();
                break;
              case 'trust':
                tempProvider = new TrustWalletProvider();
                break;
              case 'brave':
                tempProvider = new BraveWalletProvider();
                break;
              case 'rabby':
                tempProvider = new RabbyProvider();
                break;
              default:

                tempProvider = new MetaMaskProvider();
            }
            
            try {

              await tempProvider.connect();
              return await tempProvider.signMessage(message);
            } catch (tempProviderError) {
              Sentry.captureException(tempProviderError);

            }
          }
        } catch (recoveryError) {
          Sentry.captureException(recoveryError);

        }
      }
      
      if (!provider || !address) {
        Sentry.captureException({ 
          hasProvider: !!provider, 
          address,
          isSessionRefresh
        });
        
        if (address && !provider && isConnected) {
          
          if (!isSessionRefresh) {

            setIsConnected(false);
            setWalletType(null);
          }
        }
        
        throw new Error('Wallet not connected');
      }
      
      try {

        return await provider.signMessage(message);
      } catch (error: any) {
        Sentry.captureException(error);
        
        if (error.message?.includes('provider') || 
            error.message?.includes('network') || 
            error.message?.includes('disconnected') ||
            error.message?.includes('not connected')) {
          
          if (!isSessionRefresh) {

            setIsConnected(false);
            setProvider(null);
          }
        }
        
        throw error;
      }
    },
    [provider, address, walletType, isConnected]
  );

  useEffect(() => {
    return () => {
      try {

        if (typeof window !== 'undefined') {
          removeStorageItem('user_disconnected');
        }
      } catch (err) {
        Sentry.captureException(err);
      }
    };
  }, []);

  useEffect(() => {

    if (typeof window !== 'undefined') {
      attemptAutoConnect();
    } else {
      setIsInitializing(false);
    }
  }, [attemptAutoConnect]);

  useEffect(() => {
    return () => {
      // Clean up debounce timer
      if (accountsChangedDebounceRef.current) {
        clearTimeout(accountsChangedDebounceRef.current);
      }

      if (window.ethereum) {
        try {

          if (accountsChangedHandlerRef.current) {
            (window.ethereum as any).removeListener('accountsChanged', accountsChangedHandlerRef.current);
            accountsChangedHandlerRef.current = null;
          }

          if (typeof window.ethereum.removeAllListeners === 'function') {

            window.ethereum.removeAllListeners('accountsChanged');
            window.ethereum.removeAllListeners('chainChanged');
            window.ethereum.removeAllListeners('disconnect');
          }
        } catch (err) {
          Sentry.captureException(err);
        }
      }

      if (provider) {
        cleanupProvider(provider);
      }
    };
  }, [cleanupProvider, provider]);

  return (
    <WalletContext.Provider
      value={{
        walletType,
        chainType,
        address,
        isConnected,
        connectWallet,
        disconnectWallet,
        signMessage,
        error,
        isInitializing,
        isConnecting,
        provider,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (!context) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
