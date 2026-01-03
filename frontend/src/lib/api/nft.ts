import { apiClient } from './apiClient';
import * as Sentry from '@sentry/nextjs';
import { HistoricalPricesResponse, HistoricalPricesData } from '../../types';
interface TokenResponse {
  eth?: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
  };
  sol?: {
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    solana?: {
      ownerAddress: string;
      programIds: {
        mainProgram: string;
        sbtProgram: string;
      };
      pdaDerivation: {
        programSeeds: {
          prefix: string;
          owner: string;
        };
        sbtStateSeeds: {
          prefix: string;
        };
      };
      standardPrograms: {
        tokenProgram: string;
        associatedTokenProgram: string;
        systemProgram: string;
        rent: string;
      };
    };
  };
  tokens: Array<{
    contract: string;
    symbol: string;
    name: string;
    balance: string;
    priceInUSD: number;
    totalValueInUSD: string;
    logo?: string;
    decimals?: number;
    userTokenAccount?: string;
    solana?: {
      mintAddress: string;
      userTokenAccount?: string;
      decimals: number;
      rawBalance: string | number;
      compressed: boolean;
    };
  }>;
  addressType?: 'ethereum' | 'solana';
}

interface NFTMetadataResponse {
  success: boolean;
  ethPriceInUSD: number;
  floorPrice: number;
  floorPriceUSD: number;
  collectionName: string;
  imageUrl: string;
  tokenId: string;
  name: string;
}

interface PriceCacheEntry {
  price: number;
  timestamp: number;
  marketCap?: number;
  volume24h?: number;
  name?: string;
}

interface PriceCacheResponse {
  lastUpdate: number;
  lastUpdateReadable: string;
  prices: {
    [key: string]: PriceCacheEntry;
  };
}

let cachedPrices: PriceCacheResponse | null = null;
let lastCacheUpdate = 0;
const CACHE_DURATION = 5 * 60 * 1000;

export const nftApi = {
  getById: async (tokenId: string) => {
    try {

      const response = await apiClient.post('GET_NFT_BY_ID', {
        tokenId
      });
      return response;
    } catch (error) {
      Sentry.captureException(error);

      return {
        id: tokenId,
        name: `Companeon #${tokenId}`,
        imageUrl: '/placeholder-nft.png',
        assets: [],
        estimatedValueUSD: 0
      };
    }
  },

  async getTokens(address: string, chainId: number): Promise<TokenResponse> {
    try {
      
      const response = await apiClient.post<TokenResponse>('GET_TOKENS', {
        walletAddress: address,
        chainId,
      });
      
      
      return response;
    } catch (error) {
      Sentry.captureException(error);
      return {
        eth: {
          balance: '0',
          priceInUSD: 0,
          totalValueInUSD: '0',
        },
        tokens: [],
      };
    }
  },

  getNFTs: async (walletAddress: string, chainId: number) => {
    try {
      
      const response = await apiClient.post<{ nfts: any[] }>('GET_NFTS', {
        walletAddress: walletAddress.toLowerCase(),
        chainId,
      });
      
      
      return response;
    } catch (error) {
      Sentry.captureException(error);
      return { nfts: [] };
    }
  },

  getContractData: async () => {
    try {

      const response = await apiClient.post('GET_CONTRACT_DATA', {});
      return response;
    } catch (error) {
      Sentry.captureException(error);
      return null;
    }
  },

  getGasEstimates: async () => {
    try {

      const response = await apiClient.post('GET_GAS_ESTIMATES', {});
      return response;
    } catch (error) {
      Sentry.captureException(error);
      return null;
    }
  },

  getPriceCache: async (): Promise<PriceCacheResponse> => {
    try {

      const response = await apiClient.post<PriceCacheResponse>('GET_PRICE_CACHE', {});
      
      if (response.prices) {
        const normalizedPrices: { [key: string]: any } = {};
        for (const [key, value] of Object.entries(response.prices)) {
          normalizedPrices[key] = value;
          normalizedPrices[key.toUpperCase()] = value;
        }
        response.prices = normalizedPrices;
      }
      
      cachedPrices = response;
      lastCacheUpdate = Date.now();
      
      return response;
    } catch (error) {
      Sentry.captureException(error);
      throw error;
    }
  },

  getNFTMetadata: async (contractAddress: string, tokenId: string | number | bigint, walletAddress: string, chainId: number): Promise<NFTMetadataResponse> => {
    try {
      const response = await apiClient.post<NFTMetadataResponse>('GET_NFT_METADATA', {
        contractAddress,
        tokenId: tokenId.toString(),
        walletAddress,
        chainId
      });
      return response;
    } catch (error) {
      Sentry.captureException(error);
      return {
        success: false,
        ethPriceInUSD: 0,
        floorPrice: 0,
        floorPriceUSD: 0,
        collectionName: '',
        imageUrl: '',
        tokenId: tokenId.toString(),
        name: ''
      };
    }
  },

  // Removed legacy list-by-contract API
  
  getNonce: async (tokenId: string) => {
    try {
      const response = await apiClient.post<{ nonce: string }>('GET_TOKEN_NONCE', {
        tokenId,
      });
      return response;
    } catch (error) {
      Sentry.captureException(error);

      return { nonce: '0' };
    }
  },

  getHistoricalPrices: async (days: number = 7, symbols?: string[]): Promise<HistoricalPricesResponse> => {
    try {
      const requestBody: { days: number; symbols?: string } = { days };
      
      if (symbols && symbols.length > 0) {
        requestBody.symbols = symbols.join(',');
      }
      
      const response = await apiClient.post<{
        days: number;
        totalTokens: number;
        data: HistoricalPricesData;
      }>('GET_HISTORICAL_PRICES_URL', requestBody);
      
      return {
        success: true,
        data: response.data,
        message: `Retrieved ${response.totalTokens} tokens over ${response.days} days`
      };
    } catch (error) {
      Sentry.captureException(error);
      return {
        success: false,
        data: {},
        message: 'Failed to fetch historical prices'
      };
    }
  },
};
