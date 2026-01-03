#!/usr/bin/env node
/*
  One-time snapshot of the price cache into a local JSON file.
  Usage:
    node scripts/snapshot-price-cache.js [outputPath]
  Defaults to: frontend/src/data/priceCacheSnapshot.json

  It attempts, in order:
  - GET_PRICE_CACHE_URL (env) directly
  - http://localhost:3000/api/proxyEndpoint with endpoint=GET_PRICE_CACHE

  Set API_KEY in env if your proxy/backend requires it.
*/

const fs = require('fs');
const path = require('path');

const OUTPUT = process.argv[2] || path.resolve(__dirname, '..', 'src', 'data', 'priceCacheSnapshot.json');

async function fetchJson(url, options) {
  const res = await fetch(url, options);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

async function snapshot() {
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.API_KEY) headers['x-api-key'] = process.env.API_KEY;

  let payload = null;
  let url = process.env.GET_PRICE_CACHE_URL || '';

  if (url) {
    // Call backend directly
    payload = await fetchJson(url, { method: 'POST', headers, body: JSON.stringify({}) });
  } else {
    // Fall back to local Next proxy (dev server must be running)
    const localProxy = process.env.LOCAL_PROXY || 'http://localhost:3000/api/proxyEndpoint';
    const body = { endpoint: 'GET_PRICE_CACHE', method: 'POST', data: {} };
    payload = await fetchJson(localProxy, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  }

  const outDir = path.dirname(OUTPUT);
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUTPUT, JSON.stringify(payload, null, 2));
}

snapshot().catch((err) => {
  
  process.exit(1);
});

