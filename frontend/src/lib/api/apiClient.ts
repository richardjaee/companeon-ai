import * as Sentry from '@sentry/nextjs';

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  retryableStatuses: number[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 1000,
  maxDelayMs: 16000,
  backoffMultiplier: 2,
  retryableStatuses: [404, 500, 502, 503, 504]
};

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

const isRetryableError = (error: any, config: RetryConfig): boolean => {

  if (!error.status && (
    error.message?.includes('fetch') ||
    error.message?.includes('network') ||
    error.message?.includes('timeout')
  )) {
    return true;
  }
  
  if (error.status && config.retryableStatuses.includes(error.status)) {
    return true;
  }
  
  if (error.message?.includes('Payment service is starting up') ||
      error.message?.includes('Service Unavailable') ||
      error.message?.includes('Bad Gateway') ||
      error.message?.includes('Internal Server Error') ||
      error.message?.includes('Request failed with status code 404') ||
      error.message?.includes('Request failed with status code 500') ||
      error.message?.includes('Request failed with status code 502') ||
      error.message?.includes('Request failed with status code 503') ||
      error.message?.includes('Payment session creation failed')) {
    return true;
  }
  
  return false;
};

const withRetry = async <T>(
  operation: () => Promise<T>,
  config: RetryConfig = DEFAULT_RETRY_CONFIG,
  context?: string
): Promise<T> => {
  let lastError: any;
  let delay = config.initialDelayMs;
  
  for (let attempt = 0; attempt <= config.maxRetries; attempt++) {
    try {
      if (attempt > 0) {
        await sleep(delay);
      }
      
      const result = await operation();
      
      if (attempt > 0) {
        }
      
      return result;
    } catch (error: any) {
      lastError = error;
      
      if (attempt === config.maxRetries || !isRetryableError(error, config)) {
        break;
      }
      
      delay = Math.min(delay * config.backoffMultiplier, config.maxDelayMs);
    }
  }
  
  if (lastError && isRetryableError(lastError, config)) {
    const enhancedError = new Error(`Request failed after ${config.maxRetries + 1} attempts: ${lastError.message}`);
    enhancedError.name = 'RetriesExhaustedError';
    throw enhancedError;
  }
  
  throw lastError;
};

const logApiRequest = (endpoint: string, method: string, headers: any, requestData: any) => {
  const authHeader = headers?.Authorization || 'No Auth Header';

  if (endpoint === 'CREATE_PAYMENT_INTENT_URL') {
    }
  
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('auth_token');
    const expiry = localStorage.getItem('auth_expiry');
    
    if (token && endpoint === 'CREATE_PAYMENT_INTENT_URL') {
      }
    
    if (requestData && requestData.data && endpoint === 'CREATE_PAYMENT_INTENT_URL') {
      }
  }
};

const getConnectedWalletAddress = (): string | null => {
  if (typeof window === 'undefined') return null;
  
  const normalizeAddress = (address: string): string => {

    if (address.startsWith('0x')) {
      return address.toLowerCase();
    }

    return address;
  };
  
  const sessionAuthAddress = sessionStorage.getItem('current_auth_address');
  if (sessionAuthAddress) {
    return normalizeAddress(sessionAuthAddress);
  }
  
  const localAuthAddress = localStorage.getItem('current_auth_address');
  if (localAuthAddress) {
    return normalizeAddress(localAuthAddress);
  }
  
  const walletAddress = localStorage.getItem('wallet_current_address');
  if (walletAddress) {
    return normalizeAddress(walletAddress);
  }
  
  return null;
};

export const apiClient = {
  post: async <T>(endpoint: string, data: any, customHeaders?: Record<string, string>): Promise<T> => {

    const criticalEndpoints = [
      'CREATE_PAYMENT_INTENT_URL',
      'CAPTURE_PAYPAL_PAYMENT_URL',
      'VERIFY_CRYPTO_PAYMENT_URL'
    ];
    
    const shouldRetry = criticalEndpoints.includes(endpoint);
    const context = `${endpoint} API call`;
    
    const performRequest = async (): Promise<T> => {

      const connectedWalletAddress = getConnectedWalletAddress();
      
      const requestData: any = {
        endpoint,
        method: 'POST',
        data: {
          ...data
        }
      };
      
      const walletAddressEndpoints = [
        'GET_TOKENS', 'GET_NFTS', 'GET_NFT_METADATA',
        'VERIFY_CRYPTO_PAYMENT_URL', 'CAPTURE_PAYPAL_PAYMENT_URL',
        'GET_REWARDS_DATA_URL'
      ];
      
      if (connectedWalletAddress && walletAddressEndpoints.includes(endpoint)) {

        const normalizeAddress = (address: string): string => {

          if (address.startsWith('0x')) {
            return address.toLowerCase();
          }

          return address;
        };
        
        const addressesMatch = (addr1: string, addr2: string): boolean => {

          if (addr1.startsWith('0x') && addr2.startsWith('0x')) {
            return addr1.toLowerCase() === addr2.toLowerCase();
          }

          return addr1 === addr2;
        };
        
        if (data.walletAddress) {
          requestData.data.walletAddress = normalizeAddress(data.walletAddress);
        } else {

          requestData.data.walletAddress = connectedWalletAddress;
        }

        // REMOVED: This was overriding the explicitly passed walletAddress with the connected wallet
        // which prevented querying specific wallet addresses when needed
        // if (data.walletAddress && connectedWalletAddress && !addressesMatch(data.walletAddress, connectedWalletAddress)) {
        // requestData.data.walletAddress = connectedWalletAddress;
        // }
      }
      
      if (customHeaders) {
        requestData.headers = customHeaders;
      }
      
      const requestBody = JSON.stringify(requestData);

      const response = await fetch('/api/proxyEndpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: requestBody,
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        const error: any = new Error();
        error.status = response.status;
        
        try {
          const errorJson = JSON.parse(errorText);
          if (errorJson.message) {
            error.message = errorJson.message;
          } else if (errorJson.error) {
            error.message = errorJson.error;
          } else {
            error.message = errorText;
          }
        } catch (parseError) {

          error.message = errorText;
        }
        
        Sentry.captureException(error);
        throw error;
      }

      const result = await response.json();
      return result;
    };
    
    if (shouldRetry) {

      return withRetry(performRequest, DEFAULT_RETRY_CONFIG, context);
    } else {

      try {
        return await performRequest();
      } catch (error) {
        Sentry.captureException(error);
        throw error;
      }
    }
  },

  async get<T>(endpoint: string, params?: Record<string, any>, customHeaders?: Record<string, string>): Promise<T> {
    try {
      // Removed legacy ABI path

      const requestData: any = {
        endpoint,
        method: 'GET'
      };

      // Add query parameters
      if (params) {
        requestData.params = params;
      }

      if (customHeaders) {
        requestData.headers = customHeaders;
      }
      
      const response = await fetch('/api/proxyEndpoint', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorText = await response.text();
        
        Sentry.captureException(errorText);
        throw new Error(errorText);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  }
};
