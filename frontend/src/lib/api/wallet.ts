import { apiClient } from './apiClient';
import * as Sentry from '@sentry/nextjs';

// ============= Register Wallet Agent Types =============

export interface RegisterWalletAgentScope {
  type: 'nativeTokenPeriodTransfer' | 'erc20PeriodTransfer';
  periodAmount: string;
  periodAmountFormatted: string;
  periodDuration: number;
  frequency?: string;
  startTime?: number;
  expiresAt?: number;  // Per-token expiration timestamp
  tokenAddress?: string;
  tokenSymbol?: string;
  decimals?: number;
}

export interface RegisterWalletAgentRequest {
  walletAddress: string;
  backendDelegationAddress?: string;
  permissionsContext: string;  // Primary context (backward compat)
  allPermissionContexts?: Record<string, string>;  // All contexts keyed by token: { "native": "0x...", "0x1c7d...": "0x..." }
  delegationManager: string;
  chainId: number;
  expiresAt?: number;  // Master expiration (latest of all scope expirations)
  smartAccountAddress?: string;
  accountMeta?: any;
  scopes: RegisterWalletAgentScope[];  // Per-token limits with individual expirations
}

export interface RegisterWalletAgentResponse {
  success: boolean;
  walletAddress: string;
  chainId: number;
  chain: string;
  hasDelegation: boolean;
  message: string;
}

// ============= Get Wallet Limits Types =============

export interface WalletLimit {
  asset: string;
  tokenAddress?: string;  // Token contract address (for ERC-20 only)
  available: string; // Remaining in current period
  configuredLimit: string; // Total limit per period (e.g., "2 ETH")
  periodDuration: string; // How often it resets (e.g., "per hour", "per day")
  isNewPeriod: boolean; // Period just reset (full allowance)
  currentPeriod: string; // Which period since grant
  status: string; // "HAS_ALLOWANCE", etc.
  // Per-token expiration fields
  expiresAt?: string;  // ISO date string for this specific token's expiration
  expiresIn?: string;  // Human readable time remaining (e.g., "29 days")
  startTime?: number;  // Unix timestamp when this permission started
}

export interface GetWalletLimitsRequest {
  walletAddress: string;
  chainId?: number;
}

export interface GetWalletLimitsResponse {
  success: boolean;
  walletAddress: string;
  delegationEnabled: boolean;
  status: string;
  limits: WalletLimit[];
  expiresAt?: string;
  expiresIn?: string;
  source: string;
}

export const walletApi = {
  /**
 * Get delegation limits for a wallet (LIVE via SDK)
 *
 * Calls the agent controller to query on-chain enforcer state using the MetaMask SDK.
 * Returns real remaining amounts, not just configured limits.
 */
  getWalletLimits: async (
    walletAddress: string,
    chainId: number = 11155111
  ): Promise<GetWalletLimitsResponse> => {
    try {
      console.log('[walletApi.getWalletLimits] request', { walletAddress, chainId });
      const response = await apiClient.get<GetWalletLimitsResponse>(
        'GET_WALLET_LIMITS_URL',
        { walletAddress, chainId }
      );
      console.log('[walletApi.getWalletLimits] response', response);

      if (!response.success) {
        throw new Error('Failed to get wallet limits');
      }

      return response;
    } catch (error) {
      console.error('[walletApi] Error getting wallet limits:', error);
      Sentry.captureException(error);
      throw error;
    }
  }
};
