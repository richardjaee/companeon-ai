import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';
import { MetaMaskSDK } from '@metamask/sdk';

export class MetaMaskProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private connecting: boolean = false;
  private rawProvider: any = null;
  private metaMaskSDK: MetaMaskSDK | null = null;
  private sdkProvider: any = null;
  private isMobileSDK: boolean = false;
  private lastErrorTime: number = 0;
  private lastConnectionAttempt: number = 0;

  private reportErrorToSentry(error: any, minInterval: number = 5000): void {
    const now = Date.now();
    if (now - this.lastErrorTime > minInterval) {
      this.lastErrorTime = now;
      Sentry.captureException(error);
    }
  }

  getMetaMaskProvider() {

    if (this.sdkProvider) {
      return this.sdkProvider;
    }

    const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    
    const isInsideMetaMaskBrowser = typeof window !== 'undefined' && window.ethereum?.isMetaMask && isMobile;
    
    if (isInsideMetaMaskBrowser && window.ethereum) {
      this.sdkProvider = window.ethereum;
      return this.sdkProvider;
    }
    
    if (isMobile && !this.metaMaskSDK && !isInsideMetaMaskBrowser) {
      try {

        this.metaMaskSDK = new MetaMaskSDK({
          dappMetadata: {
            name: "Companeon",
            url: typeof window !== 'undefined' ? window.location.origin : '',
          },
          shouldShimWeb3: false,
          checkInstallationImmediately: false,
          preferDesktop: false,
          openDeeplink: (link: string) => {
            if (typeof window !== 'undefined') {
              window.location.href = link;
            }
          },
          communicationServerUrl: 'https://metamask-sdk-socket.metafi.codefi.network/',
        });
        
        this.sdkProvider = this.metaMaskSDK.getProvider();
        this.isMobileSDK = true;
        return this.sdkProvider;
      } catch (error) {
        this.reportErrorToSentry(error);

      }
    }

    if ((window.ethereum as any)?.providers) {

      return (window.ethereum as any).providers.find(
        (p: any) => p.isMetaMask && !p.isCoinbaseWallet
      );
    }

    if (window.ethereum?.isMetaMask && !window.ethereum?.isCoinbaseWallet) {
      return window.ethereum;
    }

    return null;
  }

  async silentConnect(): Promise<string | null> {
    try {
      const metamaskProvider = this.getMetaMaskProvider();
      if (!metamaskProvider) {
        return null;
      }
      
      this.rawProvider = metamaskProvider;
      
      const accounts = await this.rawProvider.request({
        method: 'eth_accounts'
      });
      
      if (!accounts || accounts.length === 0) {
        return null;
      }
      
      this.provider = new BrowserProvider(this.rawProvider);
      
      try {
        this.signer = await this.provider.getSigner();
      } catch (signerError) {
      }
      
      return accounts[0];
    } catch (err) {
      return null;
    }
  }

  async connect(): Promise<string> {

    const now = Date.now();
    if (this.connecting || (now - this.lastConnectionAttempt) < 2000) {

      const message = this.connecting 
        ? 'Connection already in progress. Please check MetaMask.'
        : 'Connection attempt too soon. Please wait a moment before trying again.';
      throw new Error(message);
    }

    try {
      this.connecting = true;
      this.lastConnectionAttempt = now;

      if (typeof window === 'undefined') {
        throw new Error('MetaMask connection can only be initiated in a browser');
      }

      const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isInsideMetaMaskBrowser = window.ethereum?.isMetaMask && isMobile;
      
      try {
        if (isInsideMetaMaskBrowser) {
          sessionStorage.setItem('companeon_inside_metamask_browser', 'true');
        }
      } catch (e) {

      }

      try {
        if (window.ethereum?.isMetaMask) {

          const pendingFlag = sessionStorage.getItem('companeon_metamask_pending');
          const pendingTimestamp = sessionStorage.getItem('companeon_metamask_pending_timestamp');
          
          const connectInProgress = sessionStorage.getItem('companeon_wallet_connect_in_progress') === 'true';
          
          if (pendingFlag === 'true' || connectInProgress) {
            
            if (pendingTimestamp) {
              const now = Date.now();
              const pendingTime = parseInt(pendingTimestamp, 10);
              const timeDiff = now - pendingTime;
              
              if (timeDiff > 30000) {

                sessionStorage.removeItem('companeon_metamask_pending');
                sessionStorage.removeItem('companeon_metamask_pending_timestamp');
                sessionStorage.removeItem('companeon_wallet_connect_in_progress');
                
                await new Promise(resolve => setTimeout(resolve, 500));
              } else {

                throw new Error('A MetaMask request is already pending. Please check your MetaMask extension and complete or reject the request, then try again.');
              }
            } else if (connectInProgress) {

              throw new Error('A wallet connection is already in progress. Please complete that process first or refresh the page to start over.');
            } else {

              sessionStorage.removeItem('companeon_metamask_pending');
              sessionStorage.removeItem('companeon_wallet_connect_in_progress');
              
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }
          
          sessionStorage.setItem('companeon_metamask_pending', 'true');
          sessionStorage.setItem('companeon_metamask_pending_timestamp', Date.now().toString());
          sessionStorage.setItem('companeon_wallet_connect_in_progress', 'true');
        }
      } catch (e) {
        this.reportErrorToSentry(e);

      }

      const metamaskProvider = this.getMetaMaskProvider();
      if (!metamaskProvider) {
        if (isMobile && !isInsideMetaMaskBrowser) {
          const dappUrl = encodeURIComponent(window.location.href);
          const metamaskAppLink = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
          
          window.location.href = metamaskAppLink;
          
          await new Promise(resolve => setTimeout(resolve, 2000));
          throw new Error('Redirecting to MetaMask app...');
        }
        throw new Error('MetaMask extension not found');
      }

      this.rawProvider = metamaskProvider;

      if (isInsideMetaMaskBrowser) {
        
        try {

          const accounts = await (window.ethereum as any)?.request({
            method: 'eth_requestAccounts',
            params: []
          });

          if (!accounts || accounts.length === 0) {
            throw new Error('No accounts returned from MetaMask');
          }
          
          this.provider = new BrowserProvider(window.ethereum as any);
          try {
            const signer = await this.provider.getSigner();
            this.signer = signer || null;
          } catch (signerError) {
          }
          
          try {
            sessionStorage.setItem('metamask_in_app_connect_success', 'true');
          } catch (e) {

          }
          
          return accounts[0];
        } catch (directError) {
          this.reportErrorToSentry(directError);
          throw directError;
        }
      }

      try {

        try {
          await metamaskProvider.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (revokeError) {

          }
        
        const accounts = await metamaskProvider.request({
          method: 'eth_requestAccounts',
        });
        if (!accounts || accounts.length === 0) {
          throw new Error('User did not connect MetaMask or no accounts found');
        }

        this.provider = new BrowserProvider(metamaskProvider);
        
        try {
          const signer = await this.provider.getSigner();
          this.signer = signer || null;
        } catch (signerError) {
          this.reportErrorToSentry(signerError);
        }

        try {

          const verifyAccounts = await metamaskProvider.request({
            method: 'eth_accounts',
          });
          
          if (!verifyAccounts || verifyAccounts.length === 0) {
            throw new Error('MetaMask connection issue - please try connecting again');
          }
          
          return accounts[0];
        } catch (verifyError) {
          this.reportErrorToSentry(verifyError);
          throw new Error('Could not verify MetaMask connection. Please try again.');
        }
      } catch (err: any) {
        if (err?.code === -32002) {
          throw new Error(
            'A connection request is already pending in your MetaMask wallet. ' +
            'Please open MetaMask and approve or reject the connection.'
          );
        }
        throw err;
      }
    } catch (error: any) {

      this.connecting = false;
      
      try {
        sessionStorage.removeItem('companeon_metamask_pending');
        sessionStorage.removeItem('companeon_metamask_pending_timestamp');
        sessionStorage.removeItem('companeon_wallet_connect_in_progress');
      } catch (e) {

      }
      
      if (error?.code === 4001 || 
          (error?.message && (
            error.message.includes('User rejected') ||
            error.message.includes('User denied') ||
            error.message.includes('user rejected')
          ))
      ) {
        throw new Error('Connection rejected by user.');
      }
      
      if (error?.code === -32002 || 
          (error?.message && error.message.includes('already pending'))
      ) {

        throw new Error('MetaMask has a pending request. Please open MetaMask and check for pending actions.');
      }
      
      throw error;
    } finally {
      this.connecting = false;
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
    
      if (!this.provider) {
        await this.connect();
      }
      
      try {
        const signer = await this.provider?.getSigner();
        this.signer = signer || null;
      } catch (error) {

        await this.connect();
        const signer = await this.provider?.getSigner();
        this.signer = signer || null;
      }
        
      if (!this.signer) {
        throw new Error('Failed to get signer from provider');
      }
      
      try {
        sessionStorage.setItem('companeon_metamask_signature_pending', 'true');
        sessionStorage.setItem('companeon_metamask_signature_timestamp', Date.now().toString());
      } catch (e) {

      }
      
      try {

        const signature = await this.signer.signMessage(message);
        
        try {
          sessionStorage.removeItem('companeon_metamask_signature_pending');
          sessionStorage.removeItem('companeon_metamask_signature_timestamp');
        } catch (e) {

        }
        
        return signature;
      } catch (error: any) {

        try {
          sessionStorage.removeItem('companeon_metamask_signature_pending');
          sessionStorage.removeItem('companeon_metamask_signature_timestamp');
        } catch (e) {

        }
        
        if (error?.code === 4001 || 
            (error?.message && (
              error.message.includes('User rejected') ||
              error.message.includes('User denied') ||
              error.message.includes('user rejected')
            ))
        ) {
          throw new Error('Signature rejected by user.');
        }
        
        if (error?.code === -32002 || 
            (error?.message && error.message.includes('already pending'))
        ) {
          throw new Error('MetaMask has a pending signing request. Please open MetaMask and check for pending actions.');
        }
        
        throw error;
      }
    } catch (error) {

      try {
        const accounts = await this.rawProvider.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
        
          const reconnectAccounts = await this.rawProvider.request({ method: 'eth_requestAccounts' });
          if (!reconnectAccounts || reconnectAccounts.length === 0) {
            throw new Error('MetaMask is not connected or no accounts available. Please reconnect your wallet.');
          }
        }
      
        const signature = await this.rawProvider.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });
      
        return signature;
      } catch (directError: any) {
        this.reportErrorToSentry(directError);
      
        if (directError.code === 4001 || 
            (directError.message && 
             (directError.message.includes('user rejected') || 
              directError.message.includes('User rejected') || 
              directError.message.includes('user denied')))) {
          throw new Error('User rejected the signature request');
        }
      
        if (!this.provider) {
          throw new Error('MetaMaskProvider not connected');
        }
      
        if (!this.signer) {
          try {
            const signer = await this.provider.getSigner();
            this.signer = signer || null;
          } catch (signerError) {
            this.reportErrorToSentry(signerError);
            throw new Error('Failed to access your MetaMask. Please reconnect.');
          }
        }
      
        try {
          return await this.signer.signMessage(message);
        } catch (signerSignError: any) {
          this.reportErrorToSentry(signerSignError);
        
          if (signerSignError.code === 4001 || 
              (signerSignError.message && 
               (signerSignError.message.includes('user rejected') || 
                signerSignError.message.includes('User rejected') || 
                signerSignError.message.includes('user denied')))) {
            throw new Error('User rejected the signature request');
          }
        
          throw new Error('Failed to sign message with MetaMask. Please try again.');
        }
      }
    }
  }

  async disconnect(): Promise<void> {

    if (this.isMobileSDK && this.metaMaskSDK) {
      try {

        if (typeof this.metaMaskSDK.terminate === 'function') {
          await this.metaMaskSDK.terminate();
        }
      } catch (sdkError) {
        this.reportErrorToSentry(sdkError);
      }
      
      this.sdkProvider = null;
    }

    const metamaskProvider = this.rawProvider || this.getMetaMaskProvider();

    if (typeof window !== 'undefined' && metamaskProvider) {
      try {

        if (typeof metamaskProvider.removeAllListeners === 'function') {
          metamaskProvider.removeAllListeners();
        }

        const events = ['connect', 'disconnect', 'accountsChanged', 'chainChanged'];
        events.forEach(event => {
          if (typeof metamaskProvider.removeListener === 'function') {
            metamaskProvider.removeListener(event, () => {});
          }
        });

        try {
          await metamaskProvider.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (error) {
          this.reportErrorToSentry(error);
        }
      } catch (error) {
        this.reportErrorToSentry(error);
      }
    }

    this.provider = null;
    this.signer = null;
    this.rawProvider = null;
    this.connecting = false;
  }
}
