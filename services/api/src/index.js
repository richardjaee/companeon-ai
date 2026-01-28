/**
 * Companeon API Service
 *
 * Express-based API gateway that serves the endpoints previously
 * handled by Firebase Functions.
 *
 * Endpoints:
 * - /auth/* - Wallet authentication
 * - /wallet/* - Wallet registration & delegation
 * - /assets/* - Token & NFT queries
 * - /prices/* - Price cache
 * - /credits/* - Credits & billing
 * - /agent/* - Agent tools & logs
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Firestore } from '@google-cloud/firestore';
import { ethers } from 'ethers';
import crypto from 'crypto';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firestore
// Firestore auto-detects project when running in GCP
const db = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT
});

// ========================================
// SDK Helpers for On-Chain Limit Queries
// ========================================

// Lazy-loaded SDK modules
let sdkModule = null;
let sdkUtilsModule = null;
let viemModule = null;
const clientCache = new Map();

async function getViem() {
  if (!viemModule) {
    viemModule = await import('viem');
  }
  return viemModule;
}

async function getViemChains() {
  return await import('viem/chains');
}

async function getSDK() {
  if (!sdkModule) {
    sdkModule = await import('@metamask/smart-accounts-kit');
  }
  return sdkModule;
}

async function getSDKUtils() {
  if (!sdkUtilsModule) {
    sdkUtilsModule = await import('@metamask/smart-accounts-kit/utils');
  }
  return sdkUtilsModule;
}

async function getViemChainObject(chainId) {
  const chains = await getViemChains();
  switch (chainId) {
    case 11155111:
      return chains.sepolia;
    case 8453:
      return chains.base;
    default:
      return chains.sepolia;
  }
}

function getRpcUrl(chainId) {
  if (chainId === 8453) {
    return process.env.BASE_RPC_URL || 'https://mainnet.base.org';
  }
  return process.env.RPC_URL || 'https://ethereum-sepolia-rpc.publicnode.com';
}

async function getCaveatEnforcerClient(chainId) {
  const cacheKey = `client_${chainId}`;

  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey);
  }

  const chain = await getViemChainObject(chainId);
  const rpcUrl = getRpcUrl(chainId);

  const { createPublicClient, http } = await getViem();
  const { createCaveatEnforcerClient, getSmartAccountsEnvironment } = await getSDK();

  const publicClient = createPublicClient({
    chain,
    transport: http(rpcUrl)
  });

  const environment = getSmartAccountsEnvironment(chain.id);

  const caveatEnforcerClient = createCaveatEnforcerClient({
    environment,
    client: publicClient
  });

  clientCache.set(cacheKey, { caveatEnforcerClient, environment, publicClient });

  return { caveatEnforcerClient, environment, publicClient };
}

/**
 * Query on-chain limits using MetaMask Smart Accounts SDK
 */
async function queryOnChainLimits(delegation, chainId) {
  const results = {
    nativeToken: null,
    erc20: {}
  };

  try {
    const { caveatEnforcerClient, environment } = await getCaveatEnforcerClient(chainId);
    const { decodeDelegations } = await getSDKUtils();

    const nativePeriodEnforcer = environment.caveatEnforcers?.NativeTokenPeriodTransferEnforcer?.toLowerCase();
    const erc20PeriodEnforcer = environment.caveatEnforcers?.ERC20PeriodTransferEnforcer?.toLowerCase();

    // Query native token using native context
    const nativeContext = delegation.allPermissionContexts?.native || delegation.permissionsContext;
    if (nativeContext && nativeContext !== '0x') {
      try {
        const nativeDelegations = decodeDelegations(nativeContext);
        if (nativeDelegations.length > 0) {
          const nativeDelegation = nativeDelegations[0];
          const caveats = nativeDelegation.caveats || [];

          for (const caveat of caveats) {
            const enforcerAddr = caveat.enforcer?.toLowerCase();
            if (enforcerAddr === nativePeriodEnforcer) {
              try {
                const result = await caveatEnforcerClient.getNativeTokenPeriodTransferEnforcerAvailableAmount({
                  delegation: nativeDelegation
                });

                results.nativeToken = {
                  availableWei: result.availableAmount.toString(),
                  availableEth: ethers.formatEther(result.availableAmount),
                  isNewPeriod: result.isNewPeriod,
                  currentPeriod: result.currentPeriod?.toString(),
                  querySuccess: true
                };
              } catch (e) {
                console.error('Native period query failed:', e.message);
                results.nativeToken = { querySuccess: false, error: e.message };
              }
              break;
            }
          }
        }
      } catch (e) {
        console.error('Native context decode failed:', e.message);
      }
    }

    // Query ERC-20 tokens using their specific contexts
    const allContexts = delegation.allPermissionContexts || {};
    for (const [tokenKey, tokenContext] of Object.entries(allContexts)) {
      if (tokenKey === 'native' || !tokenContext || tokenContext === '0x') continue;

      const tokenAddress = tokenKey.toLowerCase();

      try {
        const tokenDelegations = decodeDelegations(tokenContext);
        if (tokenDelegations.length > 0) {
          const tokenDelegation = tokenDelegations[0];
          const caveats = tokenDelegation.caveats || [];

          for (const caveat of caveats) {
            const enforcerAddr = caveat.enforcer?.toLowerCase();

            if (enforcerAddr === erc20PeriodEnforcer) {
              try {
                const result = await caveatEnforcerClient.getErc20PeriodTransferEnforcerAvailableAmount({
                  delegation: tokenDelegation
                });

                const scope = (delegation.scopes || []).find(s =>
                  s.tokenAddress?.toLowerCase() === tokenAddress
                );
                const decimals = scope?.decimals || 6;
                const availableRaw = result.availableAmount.toString();
                const availableFormatted = (Number(availableRaw) / Math.pow(10, decimals)).toString();

                results.erc20[tokenAddress] = {
                  tokenAddress,
                  tokenSymbol: scope?.tokenSymbol,
                  decimals,
                  availableUnits: availableRaw,
                  availableFormatted,
                  isNewPeriod: result.isNewPeriod,
                  currentPeriod: result.currentPeriod?.toString(),
                  querySuccess: true
                };
              } catch (e) {
                console.error('ERC20 period query failed:', tokenAddress, e.message);
                results.erc20[tokenAddress] = {
                  tokenAddress,
                  querySuccess: false,
                  error: e.message
                };
              }
              break;
            }
          }
        }
      } catch (e) {
        console.error('ERC20 context decode failed:', tokenAddress, e.message);
      }
    }
  } catch (e) {
    console.error('queryOnChainLimits error:', e.message);
  }

  return results;
}

// Middleware
app.use(cors({
  origin: '*',
  credentials: true
}));
app.use(express.json());

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ========================================
// Health Check
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'companeon-api',
    timestamp: new Date().toISOString()
  });
});

// ========================================
// AUTH ENDPOINTS (matches original Firebase Functions)
// ========================================

const NONCE_COLLECTION = 'WalletNonces';
const NONCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const AUTH_EXPIRY_MS = 15 * 60 * 1000; // 15 minutes

/**
 * POST /auth/nonce - Get nonce for wallet action verification
 */
app.post('/auth/nonce', async (req, res) => {
  try {
    const { walletAddress, action } = req.body;

    if (!walletAddress || !action) {
      return res.status(400).json({ error: 'Wallet address and action are required' });
    }

    const wallet = walletAddress.toLowerCase();
    const nonce = crypto.randomBytes(32).toString('hex');
    const message = `Companeon.io: Action verification request for ${walletAddress}.\n\nAction: ${action}\n\nClick to sign and authorize this action. This action will not incur any gas fees.\n\nNonce:\n${nonce}`;

    // Store in Firestore
    await db.collection(NONCE_COLLECTION).doc(`${wallet}_${action}`).set({
      nonce,
      action,
      walletAddress: wallet,
      createdAt: Date.now(),
      expiresAt: Date.now() + NONCE_EXPIRY_MS
    });

    res.json({ message, nonce });
  } catch (error) {
    console.error('auth/nonce error:', error);
    res.status(500).json({ error: 'Failed to generate wallet nonce' });
  }
});

/**
 * POST /auth/verify - Verify wallet signature
 */
app.post('/auth/verify', async (req, res) => {
  try {
    const { walletAddress, action, message, signature } = req.body;

    if (!walletAddress || !action || !message || !signature) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const wallet = walletAddress.toLowerCase();
    const nonceRef = db.collection(NONCE_COLLECTION).doc(`${wallet}_${action}`);
    const nonceDoc = await nonceRef.get();

    if (!nonceDoc.exists) {
      return res.status(401).json({ error: 'No verification request found for this wallet and action' });
    }

    const nonceData = nonceDoc.data();

    // Check if nonce has expired
    if (nonceData.expiresAt < Date.now()) {
      return res.status(401).json({ error: 'Verification request expired. Please request a new one.' });
    }

    // Reconstruct the expected message
    const expectedMessage = `Companeon.io: Action verification request for ${walletAddress}.\n\nAction: ${action}\n\nClick to sign and authorize this action. This action will not incur any gas fees.\n\nNonce:\n${nonceData.nonce}`;

    // Verify that the message matches what we expect
    if (message !== expectedMessage) {
      return res.status(401).json({ error: 'Invalid message format' });
    }

    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    if (recoveredAddress.toLowerCase() !== wallet) {
      return res.status(401).json({ error: 'Invalid signature' });
    }

    // Delete the used nonce to prevent replay attacks
    await nonceRef.delete();

    // Generate secure session ID with context binding
    const generateSecureSessionId = (walletAddr, act, nonceVal) => {
      const entropy = crypto.randomBytes(32);
      const context = Buffer.concat([
        Buffer.from(walletAddr.toLowerCase(), 'utf8'),
        Buffer.from(act, 'utf8'),
        Buffer.from(nonceVal, 'hex'),
        Buffer.from(Date.now().toString(), 'utf8')
      ]);
      const combined = Buffer.concat([entropy, context]);
      return crypto.createHash('sha256').update(combined).digest('hex');
    };

    const sessionId = generateSecureSessionId(walletAddress, action, nonceData.nonce);

    // Create AuthorizedActions entry
    const authDocId = `${wallet}_${action}_${sessionId}`;
    await db.collection('AuthorizedActions').doc(authDocId).set({
      walletAddress: wallet,
      action,
      sessionId,
      authorizedAt: Date.now(),
      expiresAt: Date.now() + AUTH_EXPIRY_MS,
      requires2FA: false,
      twoFAVerified: true
    });

    console.log(`verifyWalletAction: Created authorization ${authDocId}`);

    res.json({
      success: true,
      sessionId,
      message: 'Wallet action verification successful'
    });
  } catch (error) {
    console.error('auth/verify error:', error);
    res.status(500).json({ error: 'Failed to verify wallet action' });
  }
});

// ========================================
// WALLET ENDPOINTS
// ========================================

const WALLET_COLLECTION = 'UserWallets';

/**
 * POST /wallet/register-agent - Register wallet with delegation
 * Stores permission contexts and scopes for ERC-7715 delegation
 */
app.post('/wallet/register-agent', async (req, res) => {
  try {
    const {
      walletAddress,
      permissionsContext,
      allPermissionContexts,
      delegationManager,
      chainId = 11155111,
      expiresAt,
      smartAccountAddress,
      accountMeta,
      scopes
    } = req.body;

    console.log('registerWalletAgent:', walletAddress?.slice(0, 10), 'scopes:', scopes?.length || 0);

    if (!walletAddress || !permissionsContext) {
      return res.status(400).json({
        error: 'Missing required: walletAddress, permissionsContext'
      });
    }

    const wallet = walletAddress.toLowerCase();
    const docRef = db.collection(WALLET_COLLECTION).doc(wallet);

    // Parse scopes with human-readable descriptions
    const parsedScopes = (scopes || []).map(scope => ({
      type: scope.type,
      tokenAddress: scope.tokenAddress || null,
      tokenSymbol: scope.tokenSymbol || (scope.type === 'nativeTokenPeriodTransfer' ? 'ETH' : null),
      decimals: scope.decimals || (scope.tokenSymbol === 'USDC' || scope.tokenSymbol === 'USDT' ? 6 : 18),
      // Amount limits
      periodAmount: scope.periodAmount || null,
      periodAmountFormatted: scope.periodAmountFormatted || null,
      periodDuration: scope.periodDuration || null,
      // Human-readable period description
      periodDescription: scope.periodDuration === 86400 ? 'per day'
        : scope.periodDuration === 604800 ? 'per week'
        : scope.periodDuration === 3600 ? 'per hour'
        : scope.periodDuration === 2592000 ? 'per month'
        : scope.periodDuration ? `every ${Math.round(scope.periodDuration / 3600)} hours` : null,
      frequency: scope.frequency || null,
      // Per-token expiration
      expiresAt: scope.expiresAt || null,
      startTime: scope.startTime || null
    }));

    // Calculate master expiresAt as the LATEST of all scope expirations
    const scopeExpirations = parsedScopes.map(s => s.expiresAt).filter(Boolean);
    const latestExpiration = scopeExpirations.length > 0
      ? Math.max(...scopeExpirations)
      : expiresAt;

    await docRef.set({
      walletAddress: wallet,
      smartAccountAddress: smartAccountAddress || null,
      accountMeta: accountMeta || null,
      registeredAt: Date.now(),
      updatedAt: Date.now(),
      // Nested delegation object for agent compatibility
      delegation: {
        enabled: true,
        permissionsContext,
        allPermissionContexts: allPermissionContexts || { native: permissionsContext },
        delegationManager,
        chainId,
        expiresAt: latestExpiration || null,
        grantedAt: Date.now(),
        scopes: parsedScopes,
        scopeCount: parsedScopes.length
      },
      // Also keep flat fields for backwards compatibility
      delegationActive: true
    }, { merge: true });

    res.json({
      success: true,
      walletAddress: wallet,
      chainId,
      hasDelegation: true,
      message: 'Wallet delegation registered'
    });
  } catch (error) {
    console.error('wallet/register-agent error:', error);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * GET /wallet/status - Get wallet delegation status
 */
app.get('/wallet/status', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await db.collection(WALLET_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.json({ registered: false, walletAddress: wallet });
    }

    const data = doc.data();
    res.json({
      registered: true,
      walletAddress: wallet,
      delegationActive: data.delegationActive || false,
      chainId: data.chainId,
      expiresAt: data.expiresAt,
      registeredAt: data.registeredAt
    });
  } catch (error) {
    console.error('wallet/status error:', error);
    res.status(500).json({ error: 'Failed to get status' });
  }
});

/**
 * GET /wallet/limits - Get wallet spending limits
 * Returns current spending limits and remaining allowances
 * Now queries on-chain enforcer state for actual remaining amounts
 */
app.get('/wallet/limits', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;
    const chainId = parseInt(req.query.chainId) || 11155111;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await db.collection(WALLET_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.json({
        success: true,
        walletAddress: wallet,
        delegationEnabled: false,
        status: 'NO_DELEGATION',
        limits: [],
        source: 'firestore'
      });
    }

    const data = doc.data();

    // Read from nested delegation object (where register-agent stores it)
    const delegation = data.delegation || {};
    const scopes = delegation.scopes || data.scopes || [];
    const delegationEnabled = delegation.enabled || data.delegationActive || false;

    // Query on-chain limits using SDK if delegation is enabled
    let onChainLimits = { nativeToken: null, erc20: {} };
    if (delegationEnabled && (delegation.permissionsContext || delegation.allPermissionContexts)) {
      try {
        onChainLimits = await queryOnChainLimits(delegation, chainId);
        console.log('On-chain limits queried:', JSON.stringify(onChainLimits, null, 2));
      } catch (e) {
        console.error('On-chain limit query failed, using stored values:', e.message);
      }
    }

    // Transform scopes to limits format expected by frontend
    const limits = scopes.map(scope => {
      // Determine asset symbol - avoid duplicate like "ETH ETH"
      const asset = scope.tokenSymbol ||
                   (scope.type === 'nativeTokenPeriodTransfer' ? 'ETH' : 'TOKEN');

      // Use pre-formatted limit if available, otherwise format from raw amount
      let configuredLimit = scope.periodAmountFormatted || null;
      if (!configuredLimit && scope.periodAmount) {
        const decimals = scope.decimals || 18;
        try {
          const amountBigInt = BigInt(scope.periodAmount);
          const divisor = BigInt(10 ** decimals);
          const formatted = Number(amountBigInt) / Number(divisor);
          // Don't append asset here since frontend may add it
          configuredLimit = `${formatted} ${asset}`;
        } catch (e) {
          configuredLimit = `${scope.periodAmount} ${asset}`;
        }
      }
      if (!configuredLimit) configuredLimit = '0';

      // Get on-chain available amount based on token type
      let available = configuredLimit; // Fallback to configured if on-chain query failed
      let currentPeriod = '1';
      let isNewPeriod = false;

      if (scope.type === 'nativeTokenPeriodTransfer' && onChainLimits.nativeToken?.querySuccess) {
        // Native token (ETH) - use on-chain available amount
        available = `${onChainLimits.nativeToken.availableEth} ${asset}`;
        currentPeriod = onChainLimits.nativeToken.currentPeriod || '1';
        isNewPeriod = onChainLimits.nativeToken.isNewPeriod || false;
      } else if (scope.type === 'erc20PeriodTransfer' && scope.tokenAddress) {
        // ERC-20 token - look up by token address
        const tokenAddr = scope.tokenAddress.toLowerCase();
        const erc20Limit = onChainLimits.erc20[tokenAddr];
        if (erc20Limit?.querySuccess) {
          available = `${erc20Limit.availableFormatted} ${asset}`;
          currentPeriod = erc20Limit.currentPeriod || '1';
          isNewPeriod = erc20Limit.isNewPeriod || false;
        }
      }

      // Use stored periodDescription (human-readable) or fallback to computing it
      let frequency = scope.periodDescription || 'daily';
      if (!scope.periodDescription && scope.periodDuration) {
        if (scope.periodDuration === 86400) frequency = 'per day';
        else if (scope.periodDuration === 604800) frequency = 'per week';
        else if (scope.periodDuration === 3600) frequency = 'per hour';
        else if (scope.periodDuration === 2592000) frequency = 'per month';
        else frequency = `every ${Math.round(scope.periodDuration / 3600)} hours`;
      }

      // Handle expiresAt - could be seconds or milliseconds
      // Unix timestamps in seconds are typically < 10000000000 (year 2286)
      let scopeExpiresAt = scope.expiresAt || delegation.expiresAt || null;
      let startTime = scope.startTime || delegation.grantedAt || data.registeredAt || null;

      // Convert to milliseconds if needed for Date formatting
      const toMs = (ts) => {
        if (!ts) return null;
        // If timestamp is less than year 2100 in seconds, it's in seconds
        return ts < 4102444800 ? ts * 1000 : ts;
      };

      // Format dates for display
      const formatDate = (ts) => {
        if (!ts) return null;
        const date = new Date(toMs(ts));
        return date.toLocaleDateString('en-US', {
          month: 'numeric',
          day: 'numeric',
          year: 'numeric'
        });
      };

      return {
        asset,
        tokenAddress: scope.tokenAddress || '0x0000000000000000000000000000000000000000',
        configuredLimit,
        available,
        frequency, // Human-readable: "per day", "per week", etc.
        periodDuration: scope.periodDuration || null, // Raw seconds for calculations
        currentPeriod,
        isNewPeriod,
        status: 'HAS_ALLOWANCE',
        expiresAt: scopeExpiresAt,
        expiresAtFormatted: formatDate(scopeExpiresAt),
        startTime: startTime,
        startTimeFormatted: formatDate(startTime)
      };
    });

    // Calculate overall expiresIn from delegation expiresAt
    let expiresIn = null;
    let masterExpiresAt = delegation.expiresAt || data.expiresAt || null;
    if (masterExpiresAt) {
      // Handle seconds vs milliseconds
      const expiryMs = masterExpiresAt < 4102444800 ? masterExpiresAt * 1000 : masterExpiresAt;
      const now = Date.now();
      const diffMs = expiryMs - now;
      if (diffMs > 0) {
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        expiresIn = `${diffDays} day${diffDays !== 1 ? 's' : ''}`;
      } else {
        expiresIn = 'Expired';
      }
    }

    // Determine source based on whether on-chain query succeeded
    const hasOnChainData = onChainLimits.nativeToken?.querySuccess ||
      Object.values(onChainLimits.erc20).some(e => e?.querySuccess);

    res.json({
      success: true,
      walletAddress: wallet,
      delegationEnabled,
      status: delegationEnabled ? 'ACTIVE' : 'INACTIVE',
      limits,
      expiresAt: masterExpiresAt,
      expiresIn,
      grantedAt: delegation.grantedAt || data.registeredAt,
      source: hasOnChainData ? 'on-chain' : 'firestore'
    });
  } catch (error) {
    console.error('wallet/limits error:', error);
    res.status(500).json({ success: false, error: 'Failed to get limits' });
  }
});

/**
 * DELETE /wallet/revoke - Revoke delegation
 */
app.delete('/wallet/revoke', async (req, res) => {
  try {
    const { walletAddress } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const wallet = walletAddress.toLowerCase();
    await db.collection(WALLET_COLLECTION).doc(wallet).update({
      delegationActive: false,
      permissionsContext: null,
      revokedAt: Date.now(),
      updatedAt: Date.now()
    });

    res.json({ success: true, walletAddress: wallet });
  } catch (error) {
    console.error('wallet/revoke error:', error);
    res.status(500).json({ error: 'Revocation failed' });
  }
});

// ========================================
// ASSETS ENDPOINTS
// ========================================

// Price cache TTL (5 minutes)
const PRICE_CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Get prices for a list of token symbols, using Firestore cache with lazy CMC refresh
 */
async function getTokenPrices(db, symbols) {
  if (!symbols.length) return {};

  // Read current cache
  const cacheDoc = await db.collection('PriceCache').doc('latest').get();
  const cached = cacheDoc.exists ? cacheDoc.data() : { prices: {}, updatedAt: 0 };
  const cacheAge = Date.now() - (cached.updatedAt || 0);

  // If cache is fresh, return cached prices for requested symbols
  if (cacheAge < PRICE_CACHE_TTL_MS) {
    const result = {};
    for (const sym of symbols) {
      if (cached.prices[sym]) result[sym] = cached.prices[sym];
    }
    return result;
  }

  // Cache is stale - refresh from CMC
  const cmcApiKey = process.env.CMC_API_KEY;
  if (!cmcApiKey) {
    // No API key, return stale cache
    const result = {};
    for (const sym of symbols) {
      if (cached.prices[sym]) result[sym] = cached.prices[sym];
    }
    return result;
  }

  try {
    const symbolList = symbols.join(',');
    const response = await fetch(
      `https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest?symbol=${symbolList}&convert=USD`,
      { headers: { 'X-CMC_PRO_API_KEY': cmcApiKey } }
    );
    const json = await response.json();

    const prices = { ...cached.prices };
    if (json.data) {
      for (const sym of symbols) {
        const tokenData = json.data[sym];
        if (tokenData) {
          const quote = Array.isArray(tokenData) ? tokenData[0]?.quote?.USD : tokenData.quote?.USD;
          if (quote) {
            prices[sym] = {
              usd: quote.price,
              change24h: quote.percent_change_24h,
              marketCap: quote.market_cap,
              volume24h: quote.volume_24h
            };
          }
        }
      }
    }

    // Update cache
    await db.collection('PriceCache').doc('latest').set({
      prices,
      updatedAt: Date.now(),
      source: 'coinmarketcap'
    });

    return prices;
  } catch (error) {
    console.error('CMC price fetch failed:', error.message);
    return cached.prices || {};
  }
}

// Alchemy RPC URLs by chain
const ALCHEMY_URLS = {
  8453: process.env.ALCHEMY_RPC_URL || 'https://base-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY,
  1: 'https://eth-mainnet.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY,
  11155111: process.env.SEPOLIA_RPC_URL || 'https://eth-sepolia.g.alchemy.com/v2/' + process.env.ALCHEMY_API_KEY
};

/**
 * POST /assets/tokens - Get token balances via Alchemy
 */
app.post('/assets/tokens', async (req, res) => {
  try {
    const { walletAddress, chainId = 8453 } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const alchemyUrl = ALCHEMY_URLS[chainId] || ALCHEMY_URLS[8453];

    // Fetch ETH balance
    const ethResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getBalance',
        params: [walletAddress, 'latest']
      })
    });
    const ethData = await ethResponse.json();
    const ethBalanceWei = BigInt(ethData.result || '0');
    const ethBalance = ethers.formatEther(ethBalanceWei);

    // Fetch token balances
    const tokensResponse = await fetch(alchemyUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'alchemy_getTokenBalances',
        params: [walletAddress]
      })
    });
    const tokensData = await tokensResponse.json();

    // Process token balances and collect symbols for price lookup
    const tokenBalances = tokensData.result?.tokenBalances || [];
    const tokens = [];
    const symbolsNeeded = ['ETH'];

    for (const token of tokenBalances.slice(0, 20)) {
      if (token.tokenBalance === '0x0' || token.tokenBalance === '0x0000000000000000000000000000000000000000000000000000000000000000') continue;

      try {
        const metaResponse = await fetch(alchemyUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 3,
            method: 'alchemy_getTokenMetadata',
            params: [token.contractAddress]
          })
        });
        const metaData = await metaResponse.json();
        const meta = metaData.result;

        if (!meta) continue;

        const balance = BigInt(token.tokenBalance || '0');
        const formattedBalance = ethers.formatUnits(balance, meta.decimals || 18);
        const symbol = meta.symbol || 'UNKNOWN';

        if (symbol !== 'UNKNOWN') symbolsNeeded.push(symbol);

        tokens.push({
          contract: token.contractAddress,
          symbol,
          name: meta.name || 'Unknown Token',
          balance: formattedBalance,
          decimals: meta.decimals || 18,
          logo: meta.logo || null
        });
      } catch (e) {
        // Skip tokens that fail metadata fetch
      }
    }

    // Lazy-load prices for all symbols found in wallet
    const prices = await getTokenPrices(db, [...new Set(symbolsNeeded)]);
    const ethPrice = prices.ETH?.usd || 0;

    // Attach prices to tokens
    for (const token of tokens) {
      const priceUsd = prices[token.symbol]?.usd || 0;
      token.priceInUSD = priceUsd;
      token.totalValueInUSD = (parseFloat(token.balance) * priceUsd).toFixed(2);
    }

    res.json({
      eth: {
        balance: ethBalance,
        priceInUSD: ethPrice,
        totalValueInUSD: (parseFloat(ethBalance) * ethPrice).toFixed(2)
      },
      tokens,
      walletAddress: walletAddress.toLowerCase(),
      chainId
    });
  } catch (error) {
    console.error('assets/tokens error:', error);
    res.status(500).json({ error: 'Failed to get tokens' });
  }
});

/**
 * POST /assets/nfts - Get NFTs via Alchemy
 */
app.post('/assets/nfts', async (req, res) => {
  try {
    const { walletAddress, chainId = 8453 } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const alchemyUrl = ALCHEMY_URLS[chainId] || ALCHEMY_URLS[8453];
    const nftUrl = `${alchemyUrl}/getNFTs?owner=${walletAddress}&pageSize=50`;

    const nftResponse = await fetch(nftUrl, {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    const nftData = await nftResponse.json();

    const nfts = (nftData.ownedNfts || []).map(nft => {
      let tokenId;
      try {
        tokenId = nft.id?.tokenId ? parseInt(nft.id.tokenId.replace('0x', ''), 16).toString() : null;
      } catch {
        tokenId = nft.id?.tokenId;
      }

      return {
        contract: nft.contract?.address,
        tokenId,
        type: nft.id?.tokenMetadata?.tokenType || 'unknown',
        metadata: {
          name: nft.title || null,
          description: nft.description || null,
          image: nft.media?.[0]?.gateway || null,
          attributes: nft.metadata?.attributes || []
        }
      };
    }).filter(Boolean);

    res.json({
      walletAddress: walletAddress.toLowerCase(),
      chainId,
      nfts
    });
  } catch (error) {
    console.error('assets/nfts error:', error);
    res.status(500).json({ error: 'Failed to get NFTs' });
  }
});

// ========================================
// PRICES ENDPOINTS
// ========================================

/**
 * GET /prices/cache - Get cached prices (lazy-loaded from CMC on demand)
 */
app.get('/prices/cache', async (req, res) => {
  try {
    const doc = await db.collection('PriceCache').doc('latest').get();
    if (!doc.exists) {
      return res.json({ prices: {}, updatedAt: null });
    }
    res.json(doc.data());
  } catch (error) {
    console.error('prices/cache error:', error);
    res.status(500).json({ error: 'Failed to get prices' });
  }
});

// ========================================
// AGENT ENDPOINTS
// ========================================

/**
 * GET /agent/tools - Get available tools
 */
app.get('/agent/tools', async (req, res) => {
  // Proxy to agent service
  const agentUrl = process.env.AGENT_SERVICE_URL || 'https://companeon-agent-440170696844.us-central1.run.app';
  try {
    const response = await fetch(`${agentUrl}/health`);
    const data = await response.json();
    res.json({ tools: data.tools || [] });
  } catch (error) {
    res.json({ tools: [] });
  }
});

/**
 * GET /agent/logs - Get agent run logs
 */
app.get('/agent/logs', async (req, res) => {
  try {
    const walletAddress = req.query.wallet;
    const limit = parseInt(req.query.limit) || 50;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const snapshot = await db.collection('AgentExecutions')
      .where('walletAddress', '==', wallet)
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const logs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    res.json({ logs });
  } catch (error) {
    console.error('agent/logs error:', error);
    res.status(500).json({ error: 'Failed to get logs' });
  }
});

// ========================================
// CHAT HISTORY ENDPOINTS
// ========================================

const WALLET_CHATS_COLLECTION = 'wallet_chats';
const WALLET_TX_COLLECTION = 'wallet_transactions';

/**
 * GET /chat/history - Get permanent chat history for a wallet
 * Query params: wallet (required), limit (default 100), offset (default 0)
 */
app.get('/chat/history', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;
    const limit = parseInt(req.query.limit) || 100;
    const offset = parseInt(req.query.offset) || 0;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await db.collection(WALLET_CHATS_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.json({ messages: [], total: 0, wallet });
    }

    const data = doc.data();
    const allMessages = data.messages || [];
    const total = allMessages.length;

    // Return paginated slice (most recent first)
    const sorted = [...allMessages].reverse();
    const messages = sorted.slice(offset, offset + limit);

    res.json({
      messages,
      total,
      wallet,
      hasMore: offset + limit < total
    });
  } catch (error) {
    console.error('chat/history error:', error);
    res.status(500).json({ error: 'Failed to get chat history' });
  }
});

/**
 * GET /chat/sessions - Get chat sessions summary for sidebar display
 * Groups messages into sessions based on 30-minute gaps
 */
app.get('/chat/sessions', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;
    const limit = parseInt(req.query.limit) || 20;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await db.collection(WALLET_CHATS_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.json({ sessions: [], wallet });
    }

    const data = doc.data();
    const messages = data.messages || [];

    // Group messages into "sessions" based on time gaps (>30 min = new session)
    const sessions = [];
    let currentSession = null;
    const SESSION_GAP_MS = 30 * 60 * 1000; // 30 minutes

    for (const msg of messages) {
      if (!currentSession || msg.timestamp - currentSession.lastTimestamp > SESSION_GAP_MS) {
        if (currentSession) sessions.push(currentSession);
        currentSession = {
          startedAt: msg.timestamp,
          lastTimestamp: msg.timestamp,
          messageCount: 1,
          preview: msg.role === 'user' ? msg.content.slice(0, 100) : null
        };
      } else {
        currentSession.lastTimestamp = msg.timestamp;
        currentSession.messageCount++;
        if (!currentSession.preview && msg.role === 'user') {
          currentSession.preview = msg.content.slice(0, 100);
        }
      }
    }
    if (currentSession) sessions.push(currentSession);

    // Return most recent sessions first
    const sortedSessions = sessions.reverse().slice(0, limit);

    res.json({
      sessions: sortedSessions,
      wallet,
      totalSessions: sessions.length
    });
  } catch (error) {
    console.error('chat/sessions error:', error);
    res.status(500).json({ error: 'Failed to get chat sessions' });
  }
});

/**
 * GET /chat/session/:startedAt - Get messages from a specific historical session
 * Query params: wallet (required)
 */
app.get('/chat/session/:startedAt', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;
    const startedAt = parseInt(req.params.startedAt);

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    if (!startedAt || isNaN(startedAt)) {
      return res.status(400).json({ error: 'valid startedAt timestamp required' });
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await db.collection(WALLET_CHATS_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.json({ messages: [], startedAt, endedAt: null, wallet });
    }

    const data = doc.data();
    const allMessages = data.messages || [];
    const SESSION_GAP_MS = 30 * 60 * 1000;

    // Find session boundaries
    const startIdx = allMessages.findIndex(m => m.timestamp >= startedAt);
    if (startIdx === -1) {
      return res.json({ messages: [], startedAt, endedAt: null, wallet });
    }

    // Find where session ends (30+ min gap or end of messages)
    let endedAt = startedAt;
    const sessionMessages = [];

    for (let i = startIdx; i < allMessages.length; i++) {
      const msg = allMessages[i];
      if (sessionMessages.length > 0 && msg.timestamp - endedAt > SESSION_GAP_MS) {
        break;
      }
      sessionMessages.push(msg);
      endedAt = msg.timestamp;
    }

    res.json({
      messages: sessionMessages,
      startedAt,
      endedAt,
      wallet,
      messageCount: sessionMessages.length
    });
  } catch (error) {
    console.error('chat/session error:', error);
    res.status(500).json({ error: 'Failed to get session messages' });
  }
});

/**
 * POST /chat/resume - Resume a historical session
 * Creates a new agent session pre-loaded with messages from an old conversation
 * Body: { walletAddress, startedAt, chainId? }
 * Returns: { sessionId, loaded, ... }
 */
app.post('/chat/resume', async (req, res) => {
  try {
    const { walletAddress, startedAt, chainId = 8453 } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    if (!startedAt) {
      return res.status(400).json({ error: 'startedAt timestamp required' });
    }

    const wallet = walletAddress.toLowerCase();

    // Generate new session ID
    const sessionId = `${wallet}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Get historical messages
    const doc = await db.collection(WALLET_CHATS_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'No chat history found for this wallet' });
    }

    const data = doc.data();
    const allMessages = data.messages || [];
    const SESSION_GAP_MS = 30 * 60 * 1000;

    // Find session boundaries
    const startIdx = allMessages.findIndex(m => m.timestamp >= startedAt);
    if (startIdx === -1) {
      return res.status(404).json({ error: 'No messages found for this session' });
    }

    // Collect session messages
    let endedAt = startedAt;
    const sessionMessages = [];

    for (let i = startIdx; i < allMessages.length; i++) {
      const msg = allMessages[i];
      if (sessionMessages.length > 0 && msg.timestamp - endedAt > SESSION_GAP_MS) {
        break;
      }
      sessionMessages.push({
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp
      });
      endedAt = msg.timestamp;
    }

    // Keep last 50 for LLM context
    const trimmedMessages = sessionMessages.slice(-50);

    // Create agent session with pre-loaded messages
    await db.collection('agent_sessions').doc(sessionId).set({
      id: sessionId,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      messages: trimmedMessages,
      facts: {
        walletAddress: wallet,
        chainId,
        resumedFrom: startedAt
      }
    });

    // Check wallet delegation
    const walletDoc = await db.collection(WALLET_COLLECTION).doc(wallet).get();
    const hasDelegation = walletDoc.exists && walletDoc.data()?.delegationActive;

    res.json({
      sessionId,
      agentSessionId: sessionId,
      walletAddress: wallet,
      chainId,
      hasDelegation,
      loaded: trimmedMessages.length,
      resumedFrom: startedAt,
      originalSessionEnd: endedAt
    });
  } catch (error) {
    console.error('chat/resume error:', error);
    res.status(500).json({ error: 'Failed to resume session' });
  }
});

/**
 * GET /transactions/history - Get transaction audit log for a wallet
 */
app.get('/transactions/history', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;
    const limit = parseInt(req.query.limit) || 50;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const snapshot = await db.collection(WALLET_TX_COLLECTION)
      .doc(wallet)
      .collection('logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const transactions = snapshot.docs.map(doc => doc.data());

    res.json({
      transactions,
      wallet,
      count: transactions.length
    });
  } catch (error) {
    console.error('transactions/history error:', error);
    res.status(500).json({ error: 'Failed to get transaction history' });
  }
});

// ========================================
// AGENT SESSION ENDPOINTS (Legacy routes)
// ========================================

/**
 * POST /companeon/create-live-session - Create agent session (legacy route)
 */
app.post('/companeon/create-live-session', async (req, res) => {
  try {
    const { walletAddress, chainId = 8453 } = req.body;

    if (!walletAddress) {
      return res.status(400).json({ error: 'walletAddress required' });
    }

    const wallet = walletAddress.toLowerCase();
    const sessionId = `${wallet}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;

    // Check wallet delegation
    const walletDoc = await db.collection(WALLET_COLLECTION).doc(wallet).get();
    const hasDelegation = walletDoc.exists && walletDoc.data()?.delegationActive;

    // Create session in Firestore
    await db.collection('AgentSessions').doc(sessionId).set({
      sessionId,
      walletAddress: wallet,
      chainId,
      hasDelegation,
      status: 'active',
      createdAt: Date.now()
    });

    res.json({
      sessionId,
      agentSessionId: sessionId, // Alias for frontend compatibility
      walletAddress: wallet,
      hasDelegation
    });
  } catch (error) {
    console.error('create-live-session error:', error);
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * POST /companeon/stream - Stream agent messages (legacy route, proxies to agent service)
 */
app.post('/companeon/stream', async (req, res) => {
  const agentUrl = process.env.AGENT_SERVICE_URL || 'https://companeon-agent-440170696844.us-central1.run.app';
  const apiKey = process.env.INTERNAL_API_KEY;

  try {
    const response = await fetch(`${agentUrl}/live/messages/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey
      },
      body: JSON.stringify(req.body)
    });

    // Stream response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const reader = response.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (error) {
    console.error('stream error:', error);
    res.status(500).json({ error: 'Stream failed' });
  }
});

// ========================================
// LEGACY REDIRECT ENDPOINTS
// ========================================

app.post('/companeon-agent/register-agent', (req, res) => {
  res.redirect(307, '/wallet/register-agent');
});

app.get('/companeon-agent/get-agent-status', async (req, res) => {
  const wallet = req.query.wallet?.toLowerCase();
  if (!wallet) return res.status(400).json({ error: 'wallet required' });

  const doc = await db.collection(WALLET_COLLECTION).doc(wallet).get();
  res.json({
    registered: doc.exists,
    active: doc.exists ? doc.data()?.delegationActive : false
  });
});

// ========================================
// Error Handler
// ========================================
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ========================================
// Start Server
// ========================================
app.listen(PORT, () => {
  console.log(`Companeon API Service running on port ${PORT}`);
  console.log(`Project: ${process.env.GOOGLE_CLOUD_PROJECT || '(auto-detect)'}`);
});

export default app;
