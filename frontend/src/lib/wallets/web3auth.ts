import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';

let Web3AuthModule: any = null;
let WEB3AUTH_NETWORK: any = null;
let WalletServicesPlugin: any = null;

export class Web3AuthProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private web3auth: any = null;
  private web3authProvider: any = null;
  private walletServicesPlugin: any = null;
  private connecting: boolean = false;
  private initialized: boolean = false;

  private async loadWeb3AuthModules() {
    if (!Web3AuthModule) {
      const [modalModule, walletServicesModule] = await Promise.all([
        import('@web3auth/modal'),
        import('@web3auth/wallet-services-plugin')
      ]);
      
      Web3AuthModule = modalModule.Web3Auth;
      WEB3AUTH_NETWORK = modalModule.WEB3AUTH_NETWORK;
      WalletServicesPlugin = walletServicesModule.WalletServicesPlugin;
    }
  }

  private async initializeWeb3Auth(forceReinit: boolean = false) {
    if (this.web3auth) {
      try {
        if (this.web3auth.connected) {
          await this.web3auth.logout({ cleanup: true });
        }
      } catch (e) {
        }
      
      this.web3auth = null;
      this.initialized = false;
      this.web3authProvider = null;
      this.provider = null;
      this.signer = null;
    }

    if (typeof window === 'undefined') {
      throw new Error('Web3Auth must be initialized in the browser');
    }

    try {
      await this.loadWeb3AuthModules();

      const isProduction = typeof window !== 'undefined' && 
        (window.location.hostname === 'companeon.io' || 
         window.location.hostname === 'www.companeon.io' ||
         window.location.hostname.includes('run.app')); // Google Cloud Run domains
      
      const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID || 
        (isProduction 
          ? 'BH0kpsQj0ArlC0BiEArPRtN4U20UBDj9tcQSdwpW9ur1JrBm5HMbhKogDE6-yezBGnSuglx6HJUeOFaY2LUq_GQ' // Production
          : 'BEk4Aio5-ENFJ5fr1iVFBueKAvJNLkLCy0yGISQbTdEXxVyyoyPM84_t-sxPZpYtdYLzW4LnNRZvy4ipUxdoatk'); // Dev
      
      if (!clientId) {
        throw new Error('Web3Auth client ID not configured');
      }

      if (typeof window !== 'undefined') {
        const keysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('Web3Auth') || key.includes('openlogin') || 
                     key.includes('w3a') || key.includes('torus') || 
                     key.includes('metamask') || key === 'Web3Auth-cachedAdapter')) {
            keysToRemove.push(key);
          }
        }
        
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes('Web3Auth') || key.includes('openlogin') || 
                     key.includes('w3a') || key.includes('torus'))) {
            sessionStorage.removeItem(key);
            }
        }
        
        keysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
      }
      
      const web3AuthNetwork = isProduction 
        ? (WEB3AUTH_NETWORK?.SAPPHIRE_MAINNET || 'sapphire_mainnet')
        : (WEB3AUTH_NETWORK?.SAPPHIRE_DEVNET || 'sapphire_devnet');
      
      this.web3auth = new Web3AuthModule({
        clientId,
        web3AuthNetwork,
        uiConfig: {
        appName: 'Companeon',
          logoLight: 'https://web3auth.io/images/web3auth-logo.svg',
          logoDark: 'https://web3auth.io/images/web3auth-logo---Dark.svg'
        }
      });

      try {
        this.walletServicesPlugin = new WalletServicesPlugin();
        this.web3auth.addPlugin(this.walletServicesPlugin);
      } catch (pluginError) {
        }

      await this.web3auth.init();
      
      this.initialized = true;
      
      return this.web3auth;
    } catch (error) {
      Sentry.captureException(error);
      throw new Error(`Failed to initialize Web3Auth: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  async connect(): Promise<string> {
    if (this.connecting) {
      throw new Error('Connection already in progress');
    }

    try {
      this.connecting = true;
      if (typeof window === 'undefined') {
        throw new Error('Web3Auth can only be used in a browser');
      }

      const needsReinit = this.web3auth?.connected || false;
      await this.initializeWeb3Auth(needsReinit);

      if (!this.web3auth) {
        throw new Error('Web3Auth initialization failed');
      }
      
      if (this.web3auth.connected) {
        try {
          await this.web3auth.logout({ cleanup: true });
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (e) {
          }
      }
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const web3authProvider = await this.web3auth.connect();
      if (!web3authProvider) {
        throw new Error('User closed the modal or connection was cancelled');
      }

      this.web3authProvider = web3authProvider;
      this.provider = new BrowserProvider(web3authProvider as any);
      
      const signer = await this.provider.getSigner();
      this.signer = signer;
      
      const address = await signer.getAddress();
      try {
        const userInfo = await this.web3auth.getUserInfo();
        if (userInfo && typeof window !== 'undefined') {
          sessionStorage.setItem('web3auth_user_info', JSON.stringify(userInfo));
          }
      } catch (e) {
      }
      
      return address;
    } catch (error: any) {
      Sentry.captureException(error);
      
      if (error?.code === 4001 || error?.code === 'ACTION_REJECTED' || error?.message?.includes('User denied') || error?.message?.includes('User rejected') || error?.message?.includes('closed the modal')) {
        throw new Error('Connection cancelled by user');
      }
      
      if (error?.message?.includes('popup')) {
        throw new Error('Popup was blocked. Please allow popups for this site and try again.');
      }

      if (error?.message?.includes('already initialized')) {
        this.initialized = false;
        this.web3auth = null;
        throw new Error('Please try connecting again');
      }
      
      throw new Error(error?.message || 'Failed to connect with Web3Auth');
    } finally {
      this.connecting = false;
    }
  }

  async signMessage(message: string): Promise<string> {
    try {
      if (!this.provider || !this.signer) {
        await this.connect();
      }
      
      if (!this.signer) {
        throw new Error('No signer available');
      }
      
      const signature = await this.signer.signMessage(message);
      return signature;
    } catch (error: any) {
      Sentry.captureException(error);
      
      if (error?.code === 4001 || error?.message?.includes('User denied') || error?.message?.includes('User rejected')) {
        throw new Error('Signature rejected by user');
      }
      
      throw new Error('Failed to sign message with Web3Auth');
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.web3auth) {
        if (this.web3auth.connected) {
          try {
            await this.web3auth.logout({ cleanup: true });
            } catch (logoutError) {
          }
        }
      }
      
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('web3auth_user_info');
        
        const localKeysToRemove: string[] = [];
        const sessionKeysToRemove: string[] = [];
        
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.includes('Web3Auth') || key.includes('openlogin') || key.includes('w3a') || 
                     key.includes('torus') || key.includes('OpenLogin') || key.includes('session'))) {
            localKeysToRemove.push(key);
          }
        }
        localKeysToRemove.forEach(key => {
          localStorage.removeItem(key);
        });
        
        for (let i = 0; i < sessionStorage.length; i++) {
          const key = sessionStorage.key(i);
          if (key && (key.includes('Web3Auth') || key.includes('openlogin') || key.includes('w3a') || 
                     key.includes('torus') || key.includes('OpenLogin'))) {
            sessionKeysToRemove.push(key);
          }
        }
        sessionKeysToRemove.forEach(key => {
          sessionStorage.removeItem(key);
        });
        
        document.cookie.split(";").forEach(function(c) { 
          if (c.includes('openlogin') || c.includes('web3auth')) {
            document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
          }
        });
      }
      
      this.provider = null;
      this.signer = null;
      this.web3authProvider = null;
      this.connecting = false;
      this.initialized = false;
      this.web3auth = null;
      
      } catch (error) {
      Sentry.captureException(error);
      this.provider = null;
      this.signer = null;
      this.web3authProvider = null;
      this.connecting = false;
      this.initialized = false;
      this.web3auth = null;
    }
  }

  async isConnected(): Promise<boolean> {
    if (!this.web3auth) {
      return false;
    }
    
    return this.web3auth.connected;
  }

  async getChainId(): Promise<string> {
    if (!this.provider) {
      throw new Error('Provider not initialized');
    }
    
    const network = await this.provider.getNetwork();
    return `0x${network.chainId.toString(16)}`;
  }

  async switchChain(chainId: string): Promise<void> {
    if (!this.web3authProvider) {
      throw new Error('Web3Auth provider not initialized');
    }
    
    try {
      await (this.web3authProvider as any).request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId }],
      });
    } catch (error: any) {
      if (error.code === 4902) {
        throw new Error('Please add this network to your wallet first');
      }
      throw error;
    }
  }

  getProvider(): any {
    return this.web3authProvider;
  }

  async showCheckout(): Promise<void> {
    if (!this.walletServicesPlugin) {
      throw new Error('Wallet Services Plugin not initialized');
    }
    
    if (!this.web3auth?.connected) {
      throw new Error('Web3Auth not connected');
    }
    
    try {
      await this.walletServicesPlugin.showCheckout();
    } catch (error) {
      throw error;
    }
  }

  async showWalletUI(): Promise<void> {
    if (!this.walletServicesPlugin) {
      throw new Error('Wallet Services Plugin not initialized');
    }
    
    if (!this.web3auth?.connected) {
      throw new Error('Web3Auth not connected');
    }
    
    try {
      await this.walletServicesPlugin.showWalletUi();
    } catch (error) {
      throw error;
    }
  }
}
