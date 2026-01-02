/**
 * price.js - Tools for getting crypto prices (current and historical)
 */

import { z } from 'zod';
import axios from 'axios';

/**
 * Fetch quotes from CoinMarketCap
 */
async function fetchCMCQuotes(symbols, convert = 'USD') {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    throw new Error('CMC_API_KEY not configured');
  }

  const url = 'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest';
  const response = await axios.get(url, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey },
    params: {
      symbol: symbols.join(','),
      convert
    },
    timeout: 10000
  });

  return response.data;
}

/**
 * Fetch historical OHLCV data from CoinMarketCap
 * Uses v2 endpoint for historical quotes
 */
async function fetchCMCHistorical(symbol, timeStart, timeEnd, interval = 'daily', convert = 'USD') {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    throw new Error('CMC_API_KEY not configured');
  }

  // CMC uses v2 for OHLCV historical data
  const url = 'https://pro-api.coinmarketcap.com/v2/cryptocurrency/ohlcv/historical';
  
  const response = await axios.get(url, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey },
    params: {
      symbol: symbol.toUpperCase(),
      time_start: timeStart,
      time_end: timeEnd,
      interval,
      convert
    },
    timeout: 15000
  });

  return response.data;
}

/**
 * Parse natural language time references to timestamps
 */
function parseTimeReference(reference) {
  const now = new Date();
  const ref = reference.toLowerCase().trim();
  
  // Handle relative references
  if (ref === 'yesterday' || ref === '1 day ago' || ref === 'a day ago') {
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    return { start: yesterday, end: now, label: 'yesterday' };
  }
  
  if (ref === 'last week' || ref === '7 days ago' || ref === 'a week ago') {
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    return { start: weekAgo, end: now, label: 'last 7 days' };
  }
  
  if (ref === 'last month' || ref === '30 days ago' || ref === 'a month ago') {
    const monthAgo = new Date(now);
    monthAgo.setDate(monthAgo.getDate() - 30);
    return { start: monthAgo, end: now, label: 'last 30 days' };
  }
  
  if (ref === 'last year' || ref === '1 year ago' || ref === 'a year ago') {
    const yearAgo = new Date(now);
    yearAgo.setFullYear(yearAgo.getFullYear() - 1);
    return { start: yearAgo, end: now, label: 'last year' };
  }
  
  // Handle "last X days/weeks/months"
  const lastNMatch = ref.match(/last\s+(\d+)\s+(day|days|week|weeks|month|months|year|years)/i);
  if (lastNMatch) {
    const n = parseInt(lastNMatch[1], 10);
    const unit = lastNMatch[2].toLowerCase();
    const past = new Date(now);
    
    if (unit.startsWith('day')) {
      past.setDate(past.getDate() - n);
    } else if (unit.startsWith('week')) {
      past.setDate(past.getDate() - (n * 7));
    } else if (unit.startsWith('month')) {
      past.setMonth(past.getMonth() - n);
    } else if (unit.startsWith('year')) {
      past.setFullYear(past.getFullYear() - n);
    }
    
    return { start: past, end: now, label: `last ${n} ${unit}` };
  }
  
  // Handle "X days/weeks/months ago"
  const agoMatch = ref.match(/(\d+)\s+(day|days|week|weeks|month|months|year|years)\s+ago/i);
  if (agoMatch) {
    const n = parseInt(agoMatch[1], 10);
    const unit = agoMatch[2].toLowerCase();
    const past = new Date(now);
    
    if (unit.startsWith('day')) {
      past.setDate(past.getDate() - n);
    } else if (unit.startsWith('week')) {
      past.setDate(past.getDate() - (n * 7));
    } else if (unit.startsWith('month')) {
      past.setMonth(past.getMonth() - n);
    } else if (unit.startsWith('year')) {
      past.setFullYear(past.getFullYear() - n);
    }
    
    // For "X ago", return a single day window around that point
    const dayAfter = new Date(past);
    dayAfter.setDate(dayAfter.getDate() + 1);
    return { start: past, end: dayAfter, label: `${n} ${unit} ago` };
  }
  
  // Handle "today"
  if (ref === 'today' || ref === 'now') {
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    return { start: startOfDay, end: now, label: 'today' };
  }
  
  // Default: last 24 hours
  const dayAgo = new Date(now);
  dayAgo.setDate(dayAgo.getDate() - 1);
  return { start: dayAgo, end: now, label: 'last 24 hours' };
}

/**
 * Format price change with direction
 */
function formatPriceChange(startPrice, endPrice) {
  const change = endPrice - startPrice;
  const percentChange = ((change / startPrice) * 100).toFixed(2);
  const direction = change >= 0 ? 'up' : 'down';
  const arrow = change >= 0 ? '+' : '';
  
  return {
    startPrice: startPrice.toFixed(2),
    endPrice: endPrice.toFixed(2),
    change: change.toFixed(2),
    percentChange: `${arrow}${percentChange}%`,
    direction,
    isPositive: change >= 0
  };
}

/**
 * Fetch Fear & Greed index from CoinMarketCap
 */
async function fetchFearGreed() {
  const apiKey = process.env.CMC_API_KEY;
  if (!apiKey) {
    throw new Error('CMC_API_KEY not configured');
  }

  const url = 'https://pro-api.coinmarketcap.com/v3/fear-and-greed/latest';
  const response = await axios.get(url, {
    headers: { 'X-CMC_PRO_API_KEY': apiKey },
    timeout: 10000
  });

  return response.data;
}

export const priceTools = [
  {
    name: 'get_prices',
    description: 'Get current prices for one or more cryptocurrencies. Returns price, 24h change, and market cap.',
    parameters: z.object({
      symbols: z.array(z.string()).min(1).max(10).describe('Array of token symbols (e.g., ["ETH", "BTC", "USDC"])'),
      convert: z.string().default('USD').describe('Currency to convert prices to')
    }),
    handler: async ({ symbols, convert = 'USD' }, context) => {
      const upperSymbols = symbols.map(s => s.toUpperCase());
      const data = await fetchCMCQuotes(upperSymbols, convert);

      const prices = {};
      for (const symbol of upperSymbols) {
        const quote = data.data?.[symbol];
        if (quote) {
          const price = quote.quote?.[convert];
          prices[symbol] = {
            price: price?.price,
            change24h: price?.percent_change_24h,
            change7d: price?.percent_change_7d,
            marketCap: price?.market_cap,
            volume24h: price?.volume_24h
          };
        }
      }

      const timestamp = new Date().toISOString();
      const response = { prices, convert, timestamp };

      if (context?.remember) {
        context.remember('lastPriceLookup', {
          symbols: upperSymbols,
          convert,
          timestamp,
          prices
        });
      }

      return response;
    }
  },

  {
    name: 'get_market_sentiment',
    description: 'Get the current Fear & Greed index for the crypto market. Values: 0-24 = Extreme Fear, 25-44 = Fear, 45-55 = Neutral, 56-75 = Greed, 76-100 = Extreme Greed.',
    parameters: z.object({}),
    handler: async (_, context) => {
      const data = await fetchFearGreed();
      const fg = data.data;

      const response = {
        value: fg.value,
        classification: fg.value_classification,
        timestamp: fg.update_time,
        interpretation: fg.value <= 24 ? 'Extreme Fear - potential buying opportunity'
          : fg.value <= 44 ? 'Fear - market is cautious'
          : fg.value <= 55 ? 'Neutral - balanced sentiment'
          : fg.value <= 75 ? 'Greed - market is optimistic'
          : 'Extreme Greed - consider taking profits'
      };

      if (context?.remember) {
        context.remember('lastMarketSentiment', {
          value: response.value,
          classification: response.classification,
          timestamp: response.timestamp
        });
      }

      return response;
    }
  },

  {
    name: 'get_historical_prices',
    description: `Get price changes for cryptocurrencies to analyze profit/loss over time.
Use this to check if user is making or losing money by comparing current prices to past values.
Supports: "yesterday"/"24 hours" (uses 24h change), "last week"/"7 days" (uses 7d change), "last month"/"30 days" (uses 30d change).
Returns current price, price change percentage, and calculated previous price.`,
    parameters: z.object({
      symbols: z.array(z.string()).min(1).max(5).describe('Array of token symbols (e.g., ["ETH", "BTC"])'),
      timeReference: z.string().describe('Time period: "yesterday", "24 hours", "last week", "7 days", "last month", "30 days", "60 days", "90 days"'),
      convert: z.string().default('USD').describe('Currency to convert prices to')
    }),
    handler: async ({ symbols, timeReference, convert = 'USD' }, context) => {
      const upperSymbols = symbols.map(s => s.toUpperCase());
      const ref = timeReference.toLowerCase().trim();
      
      // Determine which CMC field to use based on time reference
      let changeField, periodLabel;
      if (ref.includes('hour') || ref.includes('1h')) {
        changeField = 'percent_change_1h';
        periodLabel = 'last hour';
      } else if (ref.includes('yesterday') || ref.includes('24') || ref.includes('day') && !ref.includes('week') && !ref.includes('month') && !ref.includes('7') && !ref.includes('30') && !ref.includes('60') && !ref.includes('90')) {
        changeField = 'percent_change_24h';
        periodLabel = 'last 24 hours';
      } else if (ref.includes('week') || ref.includes('7 day')) {
        changeField = 'percent_change_7d';
        periodLabel = 'last 7 days';
      } else if (ref.includes('month') || ref.includes('30 day')) {
        changeField = 'percent_change_30d';
        periodLabel = 'last 30 days';
      } else if (ref.includes('60 day')) {
        changeField = 'percent_change_60d';
        periodLabel = 'last 60 days';
      } else if (ref.includes('90 day')) {
        changeField = 'percent_change_90d';
        periodLabel = 'last 90 days';
      } else {
        // Default to 24h
        changeField = 'percent_change_24h';
        periodLabel = 'last 24 hours';
      }
      
      try {
        // Fetch current quotes - they include historical change percentages!
        const data = await fetchCMCQuotes(upperSymbols, convert);
        
        const results = {};
        
        for (const symbol of upperSymbols) {
          const quote = data.data?.[symbol];
          if (quote) {
            const price = quote.quote?.[convert];
            const currentPrice = price?.price;
            const percentChange = price?.[changeField];
            
            if (currentPrice !== undefined && percentChange !== undefined) {
              // Calculate previous price from current price and percent change
              // If price went up 5%, previous = current / 1.05
              const previousPrice = currentPrice / (1 + (percentChange / 100));
              const absoluteChange = currentPrice - previousPrice;
              
              results[symbol] = {
                symbol,
                period: periodLabel,
                currentPrice: currentPrice.toFixed(2),
                previousPrice: previousPrice.toFixed(2),
                absoluteChange: absoluteChange.toFixed(2),
                percentChange: (percentChange >= 0 ? '+' : '') + percentChange.toFixed(2) + '%',
                direction: percentChange >= 0 ? 'up' : 'down',
                isPositive: percentChange >= 0,
                // Include other timeframes for context
                change1h: price?.percent_change_1h?.toFixed(2) + '%',
                change24h: price?.percent_change_24h?.toFixed(2) + '%',
                change7d: price?.percent_change_7d?.toFixed(2) + '%',
                change30d: price?.percent_change_30d?.toFixed(2) + '%'
              };
            }
          }
        }
        
        // Build summary
        const summaryParts = Object.values(results).map(r => 
          `${r.symbol}: ${r.direction} ${r.percentChange} ($${r.previousPrice} -> $${r.currentPrice})`
        );
        
        const response = {
          period: periodLabel,
          convert,
          prices: results,
          summary: summaryParts.join(', '),
          timestamp: new Date().toISOString()
        };
        
        if (context?.remember) {
          context.remember('lastHistoricalPriceLookup', {
            symbols: upperSymbols,
            period: periodLabel,
            prices: results,
            timestamp: new Date().toISOString()
          });
        }
        
        return response;
        
      } catch (err) {
        context?.logger?.error?.('historical_price_error', { error: err.message });
        throw new Error(`Failed to fetch price data: ${err.message}`);
      }
    }
  }
];
