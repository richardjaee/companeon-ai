import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';

declare global {
  interface Window {
    ethereum?: any;
    trustwallet?: any;
    isBraveWallet?: boolean;
  }
}

/**
 * Provider for Brave Wallet
 * The native wallet built into Brave browser
 */
export class BraveWalletProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private connecting: boolean = false;
  private rawProvider: any = null;

  getBraveProvider() {

    if ((window.ethereum as any)?.providers) {

      return (window.ethereum as any).providers.find(
        (p: any) => p.isBraveWallet
      );
    }

    if (window.ethereum?.isBraveWallet) {
      return window.ethereum;
    }

    return null;
  }

  async connect(): Promise<string> {
    if (this.connecting) {
      throw new Error('Connection already in progress. Please check Brave Wallet.');
    }

    try {
      this.connecting = true;

      if (typeof window === 'undefined') {
        throw new Error('Brave Wallet connection can only be initiated in a browser');
      }

      const braveProvider = this.getBraveProvider();
      if (!braveProvider) {
        throw new Error('Brave Wallet not found. Please ensure you are using Brave Browser with Wallet enabled.');
      }

      this.rawProvider = braveProvider;

      try {

        const accounts = await braveProvider.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('User did not connect Brave Wallet or no accounts found');
        }

        this.provider = new BrowserProvider(braveProvider);
        
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {
          Sentry.captureException(signerError);
          throw new Error('Could not get Brave Wallet signer immediately, will try again when needed:');
        }

        try {

          const verifyAccounts = await braveProvider.request({
            method: 'eth_accounts',
          });
          
          if (!verifyAccounts || verifyAccounts.length === 0) {
            throw new Error('Brave Wallet connection issue - please try connecting again');
          }
          
          return accounts[0];
        } catch (verifyError) {
          Sentry.captureException(verifyError);
          throw new Error('Could not verify Brave Wallet connection. Please try again.');
        }
      } catch (err: any) {
        if (err?.code === -32002) {
          throw new Error(
            'A connection request is already pending in your Brave Wallet. ' +
            'Please check your Brave Wallet notification and approve or reject the connection.'
          );
        }
        throw err;
      }
    } finally {
      this.connecting = false;
    }
  }

  async signMessage(message: string): Promise<string> {
    
    if (!this.rawProvider) {
      throw new Error('BraveWalletProvider not connected - no raw provider');
    }
    
    try {
      const accounts = await this.rawProvider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        
        const reconnectAccounts = await this.rawProvider.request({ method: 'eth_requestAccounts' });
        if (!reconnectAccounts || reconnectAccounts.length === 0) {
          throw new Error('Brave Wallet is not connected or no accounts available. Please reconnect your wallet.');
        }
      }
      
      const signature = await this.rawProvider.request({
        method: 'personal_sign',
        params: [message, accounts[0]],
      });
      
      return signature;
    } catch (directError: any) {
      Sentry.captureException(directError);
      
      if (directError.code === 4001 || 
          (directError.message && 
           (directError.message.includes('user rejected') || 
            directError.message.includes('User rejected') || 
            directError.message.includes('user denied')))) {
        throw new Error('User rejected the signature request');
      }
      
      if (!this.provider) {
        throw new Error('BraveWalletProvider not connected');
      }
      
      if (!this.signer) {
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {
          Sentry.captureException(signerError);
          throw new Error('Failed to access your Brave Wallet. Please reconnect.');
        }
      }
      
      try {
        return await this.signer.signMessage(message);
      } catch (signerSignError: any) {
        Sentry.captureException(signerSignError);
        
        if (signerSignError.code === 4001 || 
            (signerSignError.message && 
             (signerSignError.message.includes('user rejected') || 
              signerSignError.message.includes('User rejected') || 
              signerSignError.message.includes('user denied')))) {
          throw new Error('User rejected the signature request');
        }
        
        throw new Error('Failed to sign message with Brave Wallet. Please try again.');
      }
    }
  }

  async disconnect(): Promise<void> {
    const braveProvider = this.rawProvider || this.getBraveProvider();

    if (typeof window !== 'undefined' && braveProvider) {
      try {

        if (typeof braveProvider.removeAllListeners === 'function') {
          braveProvider.removeAllListeners();
        }

        const events = ['connect', 'disconnect', 'accountsChanged', 'chainChanged'];
        events.forEach(event => {
          if (typeof braveProvider.removeListener === 'function') {
            braveProvider.removeListener(event, () => {});
          }
        });

        try {
          await braveProvider.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (error) { 
          Sentry.captureException(error);
        }

        if (this.provider) {
          try {
            if (typeof (this.provider as any).destroy === 'function') {
              (this.provider as any).destroy();
            }
          } catch (err) {
            Sentry.captureException(err);
          }
        }

        this.provider = null;
        this.signer = null;
        this.rawProvider = null;
        this.connecting = false;
      } catch (error) {
        Sentry.captureException(error);
      }
    }
  }
}
