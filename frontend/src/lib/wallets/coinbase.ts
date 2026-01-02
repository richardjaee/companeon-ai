
import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';
import CoinbaseWalletSDK from "@coinbase/wallet-sdk";

type CoinbaseWalletOption = 'all' | 'smartWalletOnly' | 'eoaOnly';

interface CoinbaseAttribution {
  auto: boolean;
  dataSuffix?: `0x${string}`;
}

interface CoinbasePreference {
  options: CoinbaseWalletOption;
  attribution?: CoinbaseAttribution;
  keysUrl?: string;
}

export class CoinbaseProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  public signer: JsonRpcSigner | null = null;
  private connecting: boolean = false;
  private rawProvider: any = null;
  private connectedAccount: string | null = null;
  private coinbaseWalletSDK: CoinbaseWalletSDK | null = null;
  private coinbaseProvider: any = null;
  private isMobileSDK: boolean = false;
  private storagePrefix: string = 'companeon_cb_';
  private smartWalletMode: boolean = false;

  initializeSmartWallet() {
    
    try {

      this.coinbaseWalletSDK = new CoinbaseWalletSDK({
        appName: "Companeon",
        appLogoUrl: typeof window !== 'undefined' ? `${window.location.origin}/logo.png` : undefined,
        enableMobileWalletLink: true,
      } as any);
      
      this.coinbaseProvider = this.coinbaseWalletSDK.makeWeb3Provider();
      
      if (this.coinbaseProvider && typeof this.coinbaseProvider.setAppInfo === 'function') {
        try {

          (this.coinbaseProvider as any).setPreferredAccountType?.('all');
        } catch (e) {
        }
      }
      
      this.rawProvider = this.coinbaseProvider;
      this.smartWalletMode = true;
      
      try {
        localStorage.setItem(`${this.storagePrefix}smart_wallet_mode`, 'true');
        localStorage.setItem(`${this.storagePrefix}use_smart_wallet`, 'true');
      } catch (e) { /* Ignore */ }
      
      return this.coinbaseProvider;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error('Failed to initialize Coinbase Smart Wallet');
    }
  }

  private isInsideCoinbaseWalletBrowser(): boolean {

    if (typeof window === 'undefined' || typeof navigator === 'undefined') {
      return false;
    }

    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (!isMobile) {
      return false;
    }

    const userAgent = navigator.userAgent || '';
    
    const userAgentPatterns = [
      /\bCoinbase(Wallet)?\b/i,
      /\bCBWallet\b/i,
      /\bcbwallet\b/i,
      /\bcoinbasewallet\b/i,

      /\bCoinbase-iOS\b/i,
      /\bCoinbase-Android\b/i
    ];
    
    const hasCoinbaseUserAgent = userAgentPatterns.some(pattern => pattern.test(userAgent));
    
    const hasEthereum = typeof window.ethereum !== 'undefined';
    
    const hasCoinbaseFlag = hasEthereum && (
      window.ethereum?.isCoinbaseWallet === true || 
      window.ethereum?.isCoinbase === true
    );
    
    const hasCoinbaseExtension = !!(window as any)?.coinbaseWalletExtension || 
                                 !!(window as any)?.walletLinkExtension;
    
    const hasWalletSDK = !!(window as any)?.walletSDK;
    
    const hasCoinbaseMethods = hasEthereum && (
      typeof (window.ethereum as any)?.getSelectedProvider === 'function' ||
      typeof (window.ethereum as any)?.qrUrl === 'string'
    );
    
    const hasCoinbaseMetaTag = typeof document !== 'undefined' && 
                               !!document.querySelector('meta[name="coinbase-app"]');
                               
    const hasNewCoinbaseProperties = hasEthereum && (
      (window.ethereum as any)?.isCoinbaseWalletMobile === true ||
      (window.ethereum as any)?.isCoinbaseBrowser === true
    );
    
    const detectionInfo = {
      isMobile,
      userAgent,
      hasCoinbaseUserAgent,
      hasEthereum,
      hasCoinbaseFlag,
      hasCoinbaseExtension,
      hasWalletSDK,
      hasCoinbaseMethods,
      hasCoinbaseMetaTag,
      hasNewCoinbaseProperties,
      timestamp: new Date().toISOString()
    };
    
    try {
      sessionStorage.setItem(`${this.storagePrefix}detection_info`, JSON.stringify(detectionInfo));
    } catch (e) { /* Ignore storage errors */ }
        
    return hasCoinbaseUserAgent || hasCoinbaseFlag || hasCoinbaseExtension || 
           hasWalletSDK || hasCoinbaseMethods || hasCoinbaseMetaTag || hasNewCoinbaseProperties;
  }

  getCoinbaseProvider(forceRefresh = false) {

    if (this.coinbaseProvider && !forceRefresh) {
      return this.coinbaseProvider;
    }

    try {

      const useSmartWallet = localStorage.getItem(`${this.storagePrefix}use_smart_wallet`) === 'true';
      if (useSmartWallet) {
        return this.initializeSmartWallet();
      }

      const storeDebugInfo = (info: any) => {
        try {
          localStorage.setItem(`${this.storagePrefix}debug_info`, JSON.stringify({
            ...info,
            timestamp: new Date().toISOString()
          }));
          sessionStorage.setItem(`${this.storagePrefix}debug_info`, JSON.stringify({
            ...info,
            timestamp: new Date().toISOString()
          }));
        } catch (e) { /* Ignore */ }
      };

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
      const isInsideCoinbaseWallet = this.isInsideCoinbaseWalletBrowser();
      
      const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : '';
      const hasInjectedProvider = typeof window !== 'undefined' && !!window.ethereum;
      const hasInjectedCoinbaseFlag = typeof window !== 'undefined' && (
        window.ethereum?.isCoinbaseWallet === true || 
        window.ethereum?.isCoinbase === true
      );
      const hasCoinbaseExtension = typeof window !== 'undefined' && (
        !!(window as any)?.coinbaseWalletExtension ||
        !!(window as any)?.walletLinkExtension
      );
      const hasWalletSDK = typeof window !== 'undefined' && !!(window as any)?.walletSDK;
      
      const debugInfo = {
        isMobile,
        isInsideCoinbaseWallet,
        userAgent,
        hasInjectedProvider,
        hasInjectedCoinbaseFlag,
        hasCoinbaseExtension,
        hasWalletSDK,
        windowEthereumProps: hasInjectedProvider ? Object.keys((window.ethereum as any) || {}) : [],
        timestamp: new Date().toISOString()
      };
      
      storeDebugInfo(debugInfo);
      
      if (isInsideCoinbaseWallet && hasInjectedProvider) {
        
        try { 
          localStorage.setItem(`${this.storagePrefix}in_app_browser`, 'true');
          sessionStorage.setItem(`${this.storagePrefix}in_app_browser`, 'true');
        } catch (e) { /* Ignore */ }
        
        this.coinbaseProvider = window.ethereum;
        this.isMobileSDK = false;
        this.coinbaseWalletSDK = null;
        
        const originalRequest = this.coinbaseProvider.request;
        this.coinbaseProvider.request = async function(...args: any[]) {

          await new Promise(resolve => setTimeout(resolve, 100));
          return originalRequest.apply(this, args);
        };
        
        return this.coinbaseProvider;
      }
      
      if (!isMobile && hasInjectedProvider) {

        if ((window.ethereum as any)?.providers?.length > 0) {
          const foundProvider = (window.ethereum as any).providers.find(
            (p: any) => p.isCoinbaseWallet || p.isCoinbase
          );
          
          if (foundProvider) {
            this.coinbaseProvider = foundProvider;
            this.rawProvider = foundProvider;
            this.isMobileSDK = false;
            this.coinbaseWalletSDK = null;
            return foundProvider;
          }
        }
        
        if (window.ethereum?.isCoinbaseWallet || window.ethereum?.isCoinbase) {
          this.coinbaseProvider = window.ethereum;
          this.rawProvider = window.ethereum;
          this.isMobileSDK = false;
          this.coinbaseWalletSDK = null;
          return window.ethereum;
        }
        
        if (hasCoinbaseExtension && !hasInjectedCoinbaseFlag) {

          const ethereum = window.ethereum as any;
          
          if (ethereum?.providerMap) {
            const coinbaseProvider = ethereum.providerMap.get('CoinbaseWallet') || 
                                   ethereum.providerMap.get('coinbaseWallet') ||
                                   ethereum.providerMap.get('Coinbase');
            if (coinbaseProvider) {
              this.coinbaseProvider = coinbaseProvider;
              this.rawProvider = coinbaseProvider;
              this.isMobileSDK = false;
              this.coinbaseWalletSDK = null;
              return coinbaseProvider;
            }
          }
          
          if (ethereum?.providers && Array.isArray(ethereum.providers)) {
            const coinbaseProvider = ethereum.providers.find((provider: any) => {

              return provider && (
                typeof provider.isCoinbaseWallet !== 'undefined' ||
                typeof provider.isCoinbase !== 'undefined' ||
                typeof provider.close === 'function' ||
                provider.constructor?.name?.includes('Coinbase')
              );
            });
            
            if (coinbaseProvider) {
              this.coinbaseProvider = coinbaseProvider;
              this.rawProvider = coinbaseProvider;
              this.isMobileSDK = false;
              this.coinbaseWalletSDK = null;
              return coinbaseProvider;
            }
          }
        }
      }
      
      if (isMobile && !isInsideCoinbaseWallet) {

        if (hasInjectedProvider) {

          const hasCoinbaseIndicator = 
            window.ethereum?.isCoinbaseWallet || 
            window.ethereum?.isCoinbase ||
            (window.ethereum as any)?.isCoinbaseWalletMobile ||
            (window.ethereum as any)?.isCoinbaseBrowser;
            
          if (hasCoinbaseIndicator) {

            this.coinbaseProvider = window.ethereum;
            this.isMobileSDK = false;
            this.coinbaseWalletSDK = null;
            return window.ethereum;
          }
        }
        
        try {
          const provider = this.initializeSmartWallet();

          try {
            sessionStorage.setItem(`${this.storagePrefix}smart_wallet_initialized`, 'true');
            sessionStorage.setItem(`${this.storagePrefix}initialization_time`, new Date().toISOString());
          } catch (e) { /* Ignore */ }
          return provider;
        } catch (initError) {

          Sentry.captureException({
            error: initError,
            message: 'Failed to initialize Smart Wallet for mobile',
            context: { isMobile, userAgent }
          });

          return this.coinbaseProvider || window.ethereum || null;
        }
      }
      
      if (!isMobile) {

        if (!hasCoinbaseExtension) {
          return this.initializeSmartWallet();
        } else {

          return this.initializeSmartWallet();
        }
      }
      
      return this.initializeSmartWallet();
      
    } catch (e) {
      Sentry.captureException(e);
      return null;
    }
  }

  async silentConnect(): Promise<string | null> {
    try {
      const rawEip1193Provider = this.getCoinbaseProvider(false);
      if (!rawEip1193Provider) {
        return null;
      }
      
      this.rawProvider = rawEip1193Provider;
      
      const accounts = await this.rawProvider.request({
        method: 'eth_accounts'
      });
      
      if (!accounts || accounts.length === 0) {
        return null;
      }
      
      this.connectedAccount = accounts[0];
      this.provider = new BrowserProvider(this.rawProvider);
      
      try {
        this.signer = await this.provider.getSigner();
      } catch (signerError) {
      }
      
      return this.connectedAccount;
    } catch (err) {
      return null;
    }
  }

  async connect(): Promise<string> {
    if (this.connecting) {
      throw new Error('Connection already in progress. Please check Coinbase Wallet.');
    }

    try {
      this.connecting = true;

      if (typeof window === 'undefined') {
        throw new Error('Coinbase Wallet connection can only be initiated in a browser');
      }
      
      try {
        const preventAutoConnect = sessionStorage.getItem(`${this.storagePrefix}prevent_auto_connect`);
        if (preventAutoConnect === 'true') {
          throw new Error('Auto wallet connection prevented on this page');
        }
      } catch (e) { /* Ignore */ }

      const isInsideCoinbaseWallet = this.isInsideCoinbaseWalletBrowser();
      const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

      try {
        const detectionInfo = {
          isMobile,
          isInsideCoinbaseWallet,
          userAgent: navigator.userAgent,
          timestamp: new Date().toISOString()
        };
        
        localStorage.setItem(`${this.storagePrefix}device_info`, JSON.stringify(detectionInfo));
        sessionStorage.setItem(`${this.storagePrefix}device_info`, JSON.stringify(detectionInfo));
      } catch (e) { /* Ignore */ }

      const rawEip1193Provider = this.getCoinbaseProvider(true);
      if (!rawEip1193Provider) {
        if (isMobile && !isInsideCoinbaseWallet) {
          const dappUrl = encodeURIComponent(window.location.href);
          
          const coinbaseWalletLink = `https://go.cb-w.com/dapp?cb_url=${dappUrl}`;
          
          try {
            sessionStorage.setItem(`${this.storagePrefix}redirect_url`, window.location.href);
          } catch (e) { /* Ignore */ }
          
          try {
            window.open(coinbaseWalletLink, '_self');
          } catch (e) {
            window.location.href = coinbaseWalletLink;
          }
          
          throw new Error('Redirecting to Coinbase Wallet app...');
        }
        throw new Error('Coinbase Wallet provider not found. Please make sure the Coinbase Wallet extension is installed, or visit this site from the Coinbase Wallet app.');
      }
      
      this.rawProvider = rawEip1193Provider;
      
      if (typeof this.rawProvider.on === 'function') {
        try {

          if (typeof this.rawProvider.removeAllListeners === 'function') {
            this.rawProvider.removeAllListeners();
          }
          
          this.rawProvider.on('connect', (info: any) => {
          });
          
          this.rawProvider.on('disconnect', (error: any) => {

          });
          
          this.rawProvider.on('accountsChanged', (accounts: string[]) => {
            if (accounts.length > 0) {
              this.connectedAccount = accounts[0];
            } else {

              this.connectedAccount = null;
            }
          });
          
          this.rawProvider.on('chainChanged', (chainId: string) => {
          });
        } catch (e) {
        }
      }

      if (isInsideCoinbaseWallet) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      let accounts: string[] = [];
      
      try {

        try {
          const existingAccounts = await this.rawProvider.request({
            method: 'eth_accounts'
        });
        
        if (existingAccounts && existingAccounts.length > 0) {
            accounts = existingAccounts;
          } else {
          }
        } catch (accountsError) {

        }
        
        if (!accounts || accounts.length === 0) {

          const requestWithTimeout = async (timeout: number) => {
            return Promise.race([
              this.rawProvider.request({
                method: 'eth_requestAccounts'
              }),
              new Promise<string[]>((_, reject) => 
                setTimeout(() => reject(new Error('Request timed out')), timeout)
              )
            ]);
          };
          
          try {

            accounts = await requestWithTimeout(15000);
          } catch (timeoutError: any) {

            if (timeoutError?.code === 4001 || 
                (timeoutError?.message && typeof timeoutError.message === 'string' && 
                 timeoutError.message.toLowerCase().includes('reject'))) {

              throw timeoutError;
            }
            
            if (timeoutError?.message && timeoutError.message.includes('Request timed out')) {

              await new Promise(resolve => setTimeout(resolve, 1000));
              accounts = await this.rawProvider.request({
                method: 'eth_requestAccounts'
              });
            } else {

              throw timeoutError;
            }
          }
        }

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found in Coinbase Wallet. Please create an account first.');
        }

        this.connectedAccount = accounts[0];
        
        try {
          localStorage.setItem(`${this.storagePrefix}connected_account`, this.connectedAccount);
          sessionStorage.setItem(`${this.storagePrefix}connected_account`, this.connectedAccount);

          localStorage.setItem('current_wallet_type', 'coinbase');
        } catch (e) { /* Ignore storage errors */ }
        
        this.provider = new BrowserProvider(this.rawProvider);
        
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {

        }
        
        return this.connectedAccount;
      } catch (err: any) {
        
        if (err?.code === -32002) {
          throw new Error('A connection request is already pending in your Coinbase Wallet. Please check the wallet app for pending requests.');
        } else if (err?.code === 4001 || 
                  (err?.message && typeof err.message === 'string' && err.message.toLowerCase().includes('reject'))) {
         
          throw new Error('Connection request rejected. Please approve the connection request in Coinbase Wallet to continue.');
        } else if (err?.message && err.message.includes('could not be found')) {
          throw new Error('Coinbase Wallet extension not detected. Please install the extension or open this site from the Coinbase Wallet app.');
        } else if (err?.message && err.message.includes('timeout')) {

          const detailedError = {
            userAgent: navigator.userAgent,
            isInsideCoinbaseWallet: this.isInsideCoinbaseWalletBrowser(),
            isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
            originalError: err.message,
            hasEthereum: typeof window.ethereum !== 'undefined',
            timestamp: new Date().toISOString()
          };
          
          try {

            sessionStorage.setItem(`${this.storagePrefix}connection_error`, JSON.stringify(detailedError));
          } catch (e) { /* Ignore */ }
          
          Sentry.captureException({
            error: err,
            context: 'Coinbase Wallet connection timeout',
            details: detailedError
          });
          
          throw new Error('Connection to Coinbase Wallet timed out. Please try again or use a different wallet.');
        }
        
        try {
          const errorDetails = {
            code: err?.code,
            name: err?.name,
            message: err?.message,
            stack: err?.stack,
            hasProvider: !!this.rawProvider,
            isSmartWalletMode: this.smartWalletMode,
            isMobileSDK: this.isMobileSDK,
            timestamp: new Date().toISOString()
          };
          
          sessionStorage.setItem(`${this.storagePrefix}last_error`, JSON.stringify(errorDetails));
        } catch (e) { /* Ignore storage errors */ }
        
        Sentry.captureException(err);
        throw new Error(`Failed to connect to Coinbase Wallet: ${err.message || 'Unknown error'}`);
      }
    } finally {
      this.connecting = false;
    }
  }

  async signMessage(message: string): Promise<string> {
    try {

      if (this.rawProvider && this.connectedAccount) {

        await new Promise(resolve => setTimeout(resolve, 300));
        
        try {

          const accounts = await this.rawProvider.request({ 
            method: 'eth_accounts' 
          });
          
          let accountToUse = this.connectedAccount;
          
          if (!accounts || accounts.length === 0 || accounts[0].toLowerCase() !== this.connectedAccount.toLowerCase()) {
            try {

              const newAccounts = await this.rawProvider.request({ 
                method: 'eth_requestAccounts' 
              });
              
              if (newAccounts && newAccounts.length > 0) {
                accountToUse = newAccounts[0];
                this.connectedAccount = accountToUse;
              } else {
                throw new Error('No accounts available after eth_requestAccounts');
              }
            } catch (requestError: any) {
              throw new Error('Unable to get your Coinbase Wallet account. Please reconnect.');
        }
      } else {
            }

          let signature: string;
          
          signature = await this.rawProvider.request({
        method: 'personal_sign',
            params: [message, accountToUse]
      });
      
          return signature;
          
        } catch (err: any) {

          if (err?.code === 4001 || 
              (err?.message && typeof err.message === 'string' && err.message.toLowerCase().includes('reject'))) {
            throw new Error('You declined to sign the message in Coinbase Wallet');
          }
          
          throw new Error(`Signing failed: ${err.message || 'Unknown error'}`);
        }
      }
      
      try {
        await this.connect();
        
        if (!this.rawProvider || !this.connectedAccount) {
          throw new Error('Failed to reconnect');
        }
        
        return await this.signMessage(message);
        
      } catch (reconnectError) {
        throw new Error('Connection to Coinbase Wallet lost. Please reconnect your wallet.');
      }
      
    } catch (err: any) {
      Sentry.captureException(err);
      
      if (err?.message) {
        throw err;
      } else {
        throw new Error('Failed to sign message with Coinbase Wallet. Please try again.');
      }
    }
  }

  async disconnect(): Promise<void> {
    
    try {

      if (this.rawProvider) {
        try {
          if (typeof this.rawProvider.removeAllListeners === 'function') {
            this.rawProvider.removeAllListeners();
          } else if (typeof this.rawProvider.off === 'function') {

            this.rawProvider.off('connect');
            this.rawProvider.off('disconnect');
            this.rawProvider.off('accountsChanged');
            this.rawProvider.off('chainChanged');
            this.rawProvider.off('message');
          }
        } catch (listenerError) {
        }
      }
      
      if (this.coinbaseWalletSDK && this.coinbaseProvider) {
        try {
          if (typeof this.coinbaseProvider.disconnect === 'function') {
            await this.coinbaseProvider.disconnect();
          } else if (typeof this.coinbaseProvider.close === 'function') {
            await this.coinbaseProvider.close();
          }
        } catch (sdkError) {

        }
      }
      
      this.provider = null;
      this.signer = null;
      this.rawProvider = null;
      this.connectedAccount = null;
      this.coinbaseProvider = null;
      this.coinbaseWalletSDK = null;
      this.isMobileSDK = false;
      this.smartWalletMode = false;
      
      try {

        localStorage.removeItem(`${this.storagePrefix}connected_account`);
        sessionStorage.removeItem(`${this.storagePrefix}connected_account`);
        localStorage.removeItem(`${this.storagePrefix}in_app_browser`);
        sessionStorage.removeItem(`${this.storagePrefix}in_app_browser`);
        
        localStorage.removeItem(`${this.storagePrefix}smart_wallet_mode`);
        localStorage.removeItem(`${this.storagePrefix}use_smart_wallet`);
        sessionStorage.removeItem(`${this.storagePrefix}smart_wallet_initialized`);
        sessionStorage.removeItem(`${this.storagePrefix}initialization_time`);
        
        localStorage.removeItem(`${this.storagePrefix}debug_info`);
        sessionStorage.removeItem(`${this.storagePrefix}debug_info`);
        localStorage.removeItem(`${this.storagePrefix}device_info`);
        sessionStorage.removeItem(`${this.storagePrefix}device_info`);
        localStorage.removeItem(`${this.storagePrefix}detection_info`);
        sessionStorage.removeItem(`${this.storagePrefix}detection_info`);
        
        sessionStorage.setItem(`${this.storagePrefix}prevent_auto_connect`, 'true');
        
        localStorage.removeItem('current_wallet_type');
        sessionStorage.removeItem('current_wallet_type');
        sessionStorage.removeItem('auth_current_wallet');
        
        sessionStorage.removeItem(`${this.storagePrefix}last_error`);
        sessionStorage.removeItem(`${this.storagePrefix}connection_error`);
        
      } catch (e) {
      }
      
    } catch (error) {

    }
  }
}
