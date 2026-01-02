import { apiClient } from './apiClient';

export const companeonApi = {
  registerWalletAgent: async (params: any) => apiClient.post('REGISTER_WALLET_AGENT_URL', params),
};
