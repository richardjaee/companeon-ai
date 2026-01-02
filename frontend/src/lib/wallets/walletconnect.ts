import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';
export class WalletConnectProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private connecting: boolean = false;
  private rawProvider: any = null;

  async connect(): Promise<string> {
    if (this.connecting) {
      throw new Error('Connection already in progress. Please check WalletConnect.');
    }

    try {
      this.connecting = true;

      if (typeof window === 'undefined') {
        throw new Error('WalletConnect connection can only be initiated in a browser');
      }

      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');

      try {

        if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
          throw new Error('WalletConnect Project ID is required. Please set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in your environment variables.');
        }

        // Try primary relay, then fallback relay if connection fails
        const initProvider = async (relayUrl?: string) => {
          return await EthereumProvider.init({
            projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
            chains: [8453],
            optionalChains: [84532],
            showQrModal: true,
            ...(relayUrl ? { relayUrl } : {}),
            qrModalOptions: {
              themeMode: 'dark',
              enableExplorer: true,
            },
            metadata: {
              name: 'Companeon Marketplace',
              description: 'Companeon Marketplace',
              url: window.location.origin,
              icons: [`${window.location.origin}/logo.png`],
            },
          });
        };

        let wcProvider = await initProvider('wss://relay.walletconnect.com');

        this.rawProvider = wcProvider;

        try {
          (window as any).companeonEthereumProvider = wcProvider;
        } catch (_) { /* ignore */ }

        try {
          wcProvider.on?.('display_uri', (_uri: string) => {});
          wcProvider.on?.('connect', () => {});
          wcProvider.on?.('disconnect', (_payload: any) => {});
        } catch (_) { /* ignore */ }

        const attemptConnect = async () => {
          const connectPromise = wcProvider.connect();
          const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('WalletConnect connection timed out')), 30000)
          );
          await Promise.race([connectPromise, timeoutPromise]);
        };

        try {
          await attemptConnect();
        } catch (firstErr: any) {
          // Try fallback relay on timeout or network errors
          const msg = String(firstErr?.message || '');
          if (msg.includes('timed out') || msg.includes('Network') || msg.includes('network')) {
            try {
              // Clean up previous provider listeners to avoid leaks
              (wcProvider as any).removeAllListeners?.();
            } catch (_) {}
            wcProvider = await initProvider('wss://relay.walletconnect.org');
            this.rawProvider = wcProvider;
            try { (window as any).companeonEthereumProvider = wcProvider; } catch (_) {}
            await attemptConnect();
          } else {
            throw firstErr;
          }
        }
        
        const accounts = await wcProvider.request({
          method: 'eth_accounts',
        }) as string[];

        if (!accounts || accounts.length === 0) {
          throw new Error('No accounts found after WalletConnect connection');
        }

        this.provider = new BrowserProvider(wcProvider);
        
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {
          Sentry.captureException(signerError);
        }

        try {
          const verifyAccounts = await wcProvider.request({
            method: 'eth_accounts',
          }) as string[];
          
          if (!verifyAccounts || verifyAccounts.length === 0) {
            throw new Error('WalletConnect connection issue - please try connecting again');
          }
          
          try { window.dispatchEvent(new CustomEvent('wallet:connected')); } catch (_) {}
          return accounts[0];
        } catch (verifyError) {
          Sentry.captureException(verifyError);
          throw new Error('Could not verify WalletConnect connection. Please try again.');
        }
      } catch (err: any) {
        const msg = String(err?.message || '');
        if (msg.toLowerCase().includes('rejected') || msg.toLowerCase().includes('user closed')) {
          throw new Error('Connection rejected by user');
        }
        if (msg.includes('project id') || msg.toLowerCase().includes('project_id')) {
          throw new Error('WalletConnect Project ID missing/invalid. Set NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID.');
        }
        if (msg.includes('timed out')) {
          throw new Error('WalletConnect timed out. Check network/ad blockers and try again.');
        }
        throw err;
      }
    } finally {
      this.connecting = false;
    }
  }

  async signMessage(message: string): Promise<string> {
    
    if (!this.rawProvider) {
      throw new Error('WalletConnectProvider not connected - no raw provider');
    }
    
    try {
      const accounts = await this.rawProvider.request({ method: 'eth_accounts' }) as string[];
      if (!accounts || accounts.length === 0) {
        throw new Error('WalletConnect is not connected or no accounts available. Please reconnect your wallet.');
      }
      
      const signature = await this.rawProvider.request({
        method: 'personal_sign',
        params: [message, accounts[0]],
      });
      
      return signature;
    } catch (directError) {
      Sentry.captureException(directError);
      
      if (!this.provider) {
        throw new Error('WalletConnectProvider not connected');
      }
      
      if (!this.signer) {
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {
          Sentry.captureException(signerError);
          throw new Error('Failed to access your WalletConnect wallet. Please reconnect.');
        }
      }
      
      try {
        return await this.signer.signMessage(message);
      } catch (signerSignError) {
        Sentry.captureException(signerSignError);
        throw new Error('Failed to sign message with WalletConnect. Please try again.');
      }
    }
  }

  async silentConnect(): Promise<string | null> {
    try {
      if (typeof window === 'undefined') {
        return null;
      }

      const { EthereumProvider } = await import('@walletconnect/ethereum-provider');
      
      if (!process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID) {
        return null;
      }

      const wcProvider = await EthereumProvider.init({
        projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID,
        chains: [8453],
        optionalChains: [84532],
        showQrModal: false,
        relayUrl: 'wss://relay.walletconnect.com',
        metadata: {
          name: 'Companeon Marketplace',
          description: 'Companeon Marketplace',
          url: window.location.origin,
          icons: [`${window.location.origin}/logo.png`],
        },
      });

      this.rawProvider = wcProvider;
      
      try {
        (window as any).companeonEthereumProvider = wcProvider;
      } catch (_) { /* ignore */ }

      const session = wcProvider.session;
      
      if (!session) {
        this.rawProvider = null;
        try {
          delete (window as any).companeonEthereumProvider;
        } catch (_) { /* ignore */ }
        return null;
      }

      const accounts = await wcProvider.request({
        method: 'eth_accounts',
      }) as string[];

      if (!accounts || accounts.length === 0) {
        this.rawProvider = null;
        try {
          delete (window as any).companeonEthereumProvider;
        } catch (_) { /* ignore */ }
        return null;
      }

      this.provider = new BrowserProvider(wcProvider);
      
      try {
        this.signer = await this.provider.getSigner();
      } catch (signerError) {
        Sentry.captureException(signerError);
      }

      return accounts[0];
    } catch (error) {
      Sentry.captureException(error);
      return null;
    }
  }

  async disconnect(): Promise<void> {
    try {
      if (this.rawProvider) {

        await this.rawProvider.disconnect();
        
        this.rawProvider.removeAllListeners?.();
        try {
          if ((window as any).companeonEthereumProvider === this.rawProvider) {
            delete (window as any).companeonEthereumProvider;
          }
        } catch (_) { /* ignore */ }
      }
    } catch (error) {
      Sentry.captureException(error);
    } finally {

      this.provider = null;
      this.signer = null;
      this.rawProvider = null;
      this.connecting = false;
    }
  }
} 
