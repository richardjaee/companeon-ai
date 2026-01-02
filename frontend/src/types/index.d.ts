export interface HistoricalPricePoint {
  date: string;
  price: number;
  marketCap?: number;
  volume24h?: number;
  name?: string;
}

export interface HistoricalPricesData {
  [symbol: string]: HistoricalPricePoint[];
}

export interface HistoricalPricesResponse {
  success: boolean;
  data: HistoricalPricesData;
  message?: string;
}

// Removed legacy vault types
