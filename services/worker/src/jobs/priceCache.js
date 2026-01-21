/**
 * Price Cache Job
 *
 * Updates token prices from CoinMarketCap and caches them
 * Price cache update job using CoinMarketCap API
 */

import axios from 'axios';

// Tokens to track
const TRACKED_TOKENS = [
  { symbol: 'ETH', cmcId: 1027 },
  { symbol: 'USDC', cmcId: 3408 },
  { symbol: 'USDT', cmcId: 825 },
  { symbol: 'DAI', cmcId: 4943 },
  { symbol: 'WETH', cmcId: 2396 },
  { symbol: 'cbETH', cmcId: 21535 },
  { symbol: 'AERO', cmcId: 29270 }
];

/**
 * Update price cache
 */
export async function updatePrices(firestore) {
  const cmcApiKey = process.env.CMC_API_KEY;

  if (!cmcApiKey) {
    console.warn('CMC_API_KEY not set, skipping price update');
    return { skipped: true, reason: 'No API key' };
  }

  try {
    const ids = TRACKED_TOKENS.map(t => t.cmcId).join(',');

    const response = await axios.get(
      'https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest',
      {
        params: { id: ids, convert: 'USD' },
        headers: { 'X-CMC_PRO_API_KEY': cmcApiKey }
      }
    );

    const prices = {};
    const data = response.data.data;

    for (const token of TRACKED_TOKENS) {
      const tokenData = data[token.cmcId];
      if (tokenData) {
        prices[token.symbol] = {
          usd: tokenData.quote.USD.price,
          change24h: tokenData.quote.USD.percent_change_24h,
          marketCap: tokenData.quote.USD.market_cap,
          volume24h: tokenData.quote.USD.volume_24h
        };
      }
    }

    // Store in Firestore
    await firestore.collection('PriceCache').doc('latest').set({
      prices,
      updatedAt: Date.now(),
      source: 'coinmarketcap'
    });

    // Store historical data point
    const historyId = `${new Date().toISOString().split('T')[0]}-${new Date().getHours()}`;
    await firestore.collection('PriceHistory').doc(historyId).set({
      prices,
      timestamp: Date.now()
    });

    console.log(`Price cache updated: ${Object.keys(prices).length} tokens`);
    return { success: true, tokensUpdated: Object.keys(prices).length };

  } catch (error) {
    console.error('Price update failed:', error.message);
    throw error;
  }
}
