import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';

export class RabbyProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private connecting: boolean = false;
  private rawProvider: any = null;
  private lastErrorTime: number = 0;

  private reportErrorToSentry(error: any, minInterval: number = 5000): void {
    const now = Date.now();
    if (now - this.lastErrorTime > minInterval) {
      this.lastErrorTime = now;
      Sentry.captureException(error);
    }
  }

  getRabbyProvider() {
    if (typeof window === 'undefined') {
      return null;
    }

    // Check if Rabby is available
    if (window.ethereum?.isRabby) {
      return window.ethereum;
    }

    // Check in providers array if multiple wal are installed
    if ((window.ethereum as any)?.providers) {
      return (window.ethereum as any).providers.find(
        (p: any) => p.isRabby
      );
    }

    return null;
  }

  async silentConnect(): Promise<string | null> {
    try {
      const rabbyProvider = this.getRabbyProvider();
      if (!rabbyProvider) {
        return null;
      }
      
      this.rawProvider = rabbyProvider;
      
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
        // Silent fail for signer
      }
      
      return accounts[0];
    } catch (err) {
      return null;
    }
  }

  async connect(): Promise<string> {
    if (this.connecting) {
      throw new Error('Connection already in progress. Please check Rabby wallet.');
    }

    try {
      this.connecting = true;

      if (typeof window === 'undefined') {
        throw new Error('Rabby wallet connection can only be initiated in a browser');
      }

      const rabbyProvider = this.getRabbyProvider();
      if (!rabbyProvider) {
        throw new Error('Rabby wallet not found. Please install the Rabby wallet extension.');
      }

      this.rawProvider = rabbyProvider;

      try {
        const accounts = await rabbyProvider.request({
          method: 'eth_requestAccounts',
        });
        
        if (!accounts || accounts.length === 0) {
          throw new Error('User did not connect Rabby wallet or no accounts found');
        }

        this.provider = new BrowserProvider(rabbyProvider);
        
        try {
          const signer = await this.provider.getSigner();
          this.signer = signer || null;
        } catch (signerError) {
          this.reportErrorToSentry(signerError);
        }

        // Verify the connection
        try {
          const verifyAccounts = await rabbyProvider.request({
            method: 'eth_accounts',
          });
          
          if (!verifyAccounts || verifyAccounts.length === 0) {
            throw new Error('Rabby wallet connection issue - please try connecting again');
          }
          
          return accounts[0];
        } catch (verifyError) {
          this.reportErrorToSentry(verifyError);
          throw new Error('Could not verify Rabby wallet connection. Please try again.');
        }
      } catch (err: any) {
        if (err?.code === -32002) {
          throw new Error(
            'A connection request is already pending in your Rabby wallet. ' +
            'Please open Rabby and approve or reject the connection.'
          );
        }
        throw err;
      }
    } catch (error: any) {
      this.connecting = false;
      
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
        throw new Error('Rabby wallet has a pending request. Please open Rabby and check for pending actions.');
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
        const signature = await this.signer.signMessage(message);
        return signature;
      } catch (error: any) {
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
          throw new Error('Rabby wallet has a pending signing request. Please open Rabby and check for pending actions.');
        }
        
        throw error;
      }
    } catch (error) {
      // Fallback to direct provider signing
      try {
        const accounts = await this.rawProvider.request({ method: 'eth_accounts' });
        if (!accounts || accounts.length === 0) {
          const reconnectAccounts = await this.rawProvider.request({ method: 'eth_requestAccounts' });
          if (!reconnectAccounts || reconnectAccounts.length === 0) {
            throw new Error('Rabby wallet is not connected or no accounts available. Please reconnect your wallet.');
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
          throw new Error('Rabby wallet not connected');
        }
      
        if (!this.signer) {
          try {
            const signer = await this.provider.getSigner();
            this.signer = signer || null;
          } catch (signerError) {
            this.reportErrorToSentry(signerError);
            throw new Error('Failed to access your Rabby wallet. Please reconnect.');
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
        
          throw new Error('Failed to sign message with Rabby wallet. Please try again.');
        }
      }
    }
  }

  async disconnect(): Promise<void> {
    const rabbyProvider = this.rawProvider || this.getRabbyProvider();

    if (typeof window !== 'undefined' && rabbyProvider) {
      try {
        if (typeof rabbyProvider.removeAllListeners === 'function') {
          rabbyProvider.removeAllListeners();
        }

        const events = ['connect', 'disconnect', 'accountsChanged', 'chainChanged'];
        events.forEach(event => {
          if (typeof rabbyProvider.removeListener === 'function') {
            rabbyProvider.removeListener(event, () => {});
          }
        });
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