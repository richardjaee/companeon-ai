import { apiClient } from './apiClient';

export interface CreditBalance {
  credits: number;
  used: number;
  remaining: number;
  freeCreditsGranted: boolean;
}

export const creditsApi = {
  getBalance: async (walletAddress: string): Promise<CreditBalance> => {
    return apiClient.get<CreditBalance>('CREDITS_BALANCE', { wallet: walletAddress });
  },

  grantFree: async (walletAddress: string): Promise<{ success: boolean; credits: number; remaining: number }> => {
    return apiClient.post('CREDITS_GRANT_FREE', { walletAddress });
  },

  submitPurchase: async (
    walletAddress: string,
    txHash: string,
    chainId: number,
    paymentType: 'USDC' | 'ETH' = 'USDC'
  ): Promise<{ success: boolean; credits: number; remaining: number }> => {
    return apiClient.post('CREDITS_PURCHASE', { walletAddress, txHash, chainId, paymentType });
  }
};
