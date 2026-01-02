import { BrowserProvider, JsonRpcSigner } from 'ethers';
import { BaseWalletProvider } from './baseWalletProvider';
import * as Sentry from '@sentry/nextjs';

export class TrustWalletProvider implements BaseWalletProvider {
  public provider: BrowserProvider | null = null;
  private signer: JsonRpcSigner | null = null;
  private connecting: boolean = false;
  private rawProvider: any = null;

  getTrustWalletProvider() {

    if (typeof window !== 'undefined' && window.trustwallet) {
      return window.trustwallet;
    }

    if ((window.ethereum as any)?.providers) {

      return (window.ethereum as any)!.providers.find(
        (p: any) => p.isTrust || p.isTrustWallet || p.isTrustProvider || 
                    (p.constructor?.name === 'TrustWeb3Provider') ||
                    (typeof p.getTrustWalletVersion === 'function')
      );
    }

    if (window.ethereum?.isTrust || 
        window.ethereum?.isTrustWallet || 
        window.ethereum?.isTrustProvider ||
        window.ethereum?.constructor?.name === 'TrustWeb3Provider' ||
        typeof (window.ethereum as any)?.getTrustWalletVersion === 'function') {
      return window.ethereum;
    }

    return null;
  }

  async connect(): Promise<string> {
    if (this.connecting) {
      throw new Error('Connection already in progress. Please check Trust Wallet.');
    }

    try {
      this.connecting = true;

      if (typeof window === 'undefined') {
        throw new Error('Trust Wallet connection can only be initiated in a browser');
      }

      const trustProvider = this.getTrustWalletProvider();
      if (!trustProvider) {
        throw new Error('Trust Wallet extension not found. Please install it from trustwallet.com');
      }

      this.rawProvider = trustProvider;

      try {

        const accounts = await trustProvider.request({
          method: 'eth_requestAccounts',
        });

        if (!accounts || accounts.length === 0) {
          throw new Error('User did not connect Trust Wallet or no accounts found');
        }

        this.provider = new BrowserProvider(trustProvider);
        
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {
          Sentry.captureException(signerError);
        }

        try {

          const verifyAccounts = await trustProvider.request({
            method: 'eth_accounts',
          });
          
          if (!verifyAccounts || verifyAccounts.length === 0) {
            throw new Error('Trust Wallet connection issue - please try connecting again');
          }
          
          return accounts[0];
        } catch (verifyError) {
          Sentry.captureException(verifyError);
          throw new Error('Could not verify Trust Wallet connection. Please try again.');
        }
      } catch (err: any) {
        if (err?.code === -32002) {
          throw new Error(
            'A connection request is already pending in your Trust Wallet. ' +
            'Please open Trust Wallet and approve or reject the connection.'
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
      throw new Error('TrustWalletProvider not connected - no raw provider');
    }
    
    try {
      const accounts = await this.rawProvider.request({ method: 'eth_accounts' });
      if (!accounts || accounts.length === 0) {
        
        const reconnectAccounts = await this.rawProvider.request({ method: 'eth_requestAccounts' });
        if (!reconnectAccounts || reconnectAccounts.length === 0) {
          throw new Error('Trust Wallet is not connected or no accounts available. Please reconnect your wallet.');
        }
      }
      
      try {

        const signature = await this.rawProvider.request({
          method: 'personal_sign',
          params: [message, accounts[0]],
        });
        
        return signature;
      } catch (firstAttemptError: any) {

        if (firstAttemptError?.code === 4001 || 
            (firstAttemptError?.message && firstAttemptError.message.includes('rejected'))) {
          
          await new Promise(resolve => setTimeout(resolve, 500));
          
          try {
            const signature = await this.rawProvider.request({
              method: 'personal_sign',
              params: [message, accounts[0]],
            });
            
            return signature;
          } catch (secondAttemptError: any) {

            if (secondAttemptError?.code === 4001 || 
                (secondAttemptError?.message && secondAttemptError.message.includes('rejected'))) {
              throw new Error('You declined the signature request in Trust Wallet.');
            }
            
            throw secondAttemptError;
          }
        } else {

          throw firstAttemptError;
        }
      }
    } catch (directError) {
      Sentry.captureException(directError);
      
      if (!this.provider) {
        throw new Error('TrustWalletProvider not connected');
      }
      
      if (!this.signer) {
        try {
          this.signer = await this.provider.getSigner();
        } catch (signerError) {
          Sentry.captureException(signerError);
          throw new Error('Failed to access your Trust Wallet. Please reconnect.');
        }
      }
      
      try {
        return await this.signer.signMessage(message);
      } catch (signerSignError) {
        Sentry.captureException(signerSignError);
        throw new Error('Failed to sign message with Trust Wallet. Please try again.');
      }
    }
  }

  async disconnect(): Promise<void> {
    const trustProvider = this.rawProvider || this.getTrustWalletProvider();

    if (typeof window !== 'undefined' && trustProvider) {
      try {

        if (typeof trustProvider.removeAllListeners === 'function') {
          trustProvider.removeAllListeners();
        }

        const events = ['connect', 'disconnect', 'accountsChanged', 'chainChanged'];
        events.forEach(event => {
          if (typeof trustProvider.removeListener === 'function') {
            trustProvider.removeListener(event, () => {});
          }
        });

        try {
          await trustProvider.request({
            method: 'wallet_revokePermissions',
            params: [{ eth_accounts: {} }],
          });
        } catch (error) {
          Sentry.captureException(error);
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
