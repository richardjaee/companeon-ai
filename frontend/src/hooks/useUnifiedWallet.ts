import { useWallet } from '@/context/WalletContext';

export type UnifiedWalletType = 'metamask' | null;
export type UnifiedChainType = 'ethereum' | null;

interface UnifiedWalletContextType {

  walletType: UnifiedWalletType;
  chainType: UnifiedChainType;
  address: string | null;
  isConnected: boolean;

  connectWallet: (type: UnifiedWalletType) => Promise<string | null>;
  disconnectWallet: () => Promise<void>;
  signMessage: (message: string, options?: { isSessionRefresh?: boolean }) => Promise<string>;

  error: string | null;
  isInitializing: boolean;
  isConnecting: boolean;
}

// Ethereum-only unified wallet

export function useUnifiedWallet(): UnifiedWalletContextType {
  const ethereumWallet = useWallet();
  const activeChainType: UnifiedChainType = ethereumWallet.isConnected ? 'ethereum' : null;
  const activeWallet = ethereumWallet;
  
  const connectWallet = async (type: UnifiedWalletType): Promise<string | null> => {
    
    if (!type) {
      return null;
    }
    try {
      const result = await ethereumWallet.connectWallet(type as 'metamask');
      return result;
    } catch (error) {
      throw error;
    }
  };

  const disconnectWallet = async (): Promise<void> => {
    await ethereumWallet.disconnectWallet();
  };

  const signMessage = async (message: string, options?: { isSessionRefresh?: boolean }): Promise<string> => {
    return await ethereumWallet.signMessage(message, options);
  };

  return {

    walletType: activeWallet.walletType as UnifiedWalletType,
    chainType: activeChainType,
    address: activeWallet.address,
    isConnected: activeWallet.isConnected,
    
    connectWallet,
    disconnectWallet,
    signMessage,
    
    error: activeWallet.error,
    isInitializing: activeWallet.isInitializing,
    isConnecting: activeWallet.isConnecting,
  };
} 
