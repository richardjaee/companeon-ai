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
 */
app.post('/wallet/register-agent', async (req, res) => {
  try {
    const {
      walletAddress,
      permissionsContext,
      allPermissionContexts,
      delegationManager,
      chainId = 8453,
      expiresAt,
      smartAccountAddress,
      accountMeta,
      scopes
    } = req.body;

    console.log('registerWalletAgent:', walletAddress?.slice(0, 10));

    if (!walletAddress || !permissionsContext || !delegationManager) {
      return res.status(400).json({
        error: 'Missing required: walletAddress, permissionsContext, delegationManager'
      });
    }

    const wallet = walletAddress.toLowerCase();
    const docRef = db.collection(WALLET_COLLECTION).doc(wallet);

    await docRef.set({
      walletAddress: wallet,
      permissionsContext,
      allPermissionContexts: allPermissionContexts || { native: permissionsContext },
      delegationManager,
      chainId,
      expiresAt: expiresAt || null,
      smartAccountAddress: smartAccountAddress || null,
      accountMeta: accountMeta || null,
      scopes: scopes || [],
      delegationActive: true,
      registeredAt: Date.now(),
      updatedAt: Date.now()
    }, { merge: true });

    res.json({
      success: true,
      walletAddress: wallet,
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
 */
app.get('/wallet/limits', async (req, res) => {
  try {
    const walletAddress = req.query.wallet || req.query.walletAddress;

    if (!walletAddress) {
      return res.status(400).json({ error: 'wallet query param required' });
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await db.collection(WALLET_COLLECTION).doc(wallet).get();

    if (!doc.exists) {
      return res.json({ walletAddress: wallet, limits: null });
    }

    const data = doc.data();
    res.json({
      walletAddress: wallet,
      scopes: data.scopes || [],
      delegationActive: data.delegationActive || false,
      expiresAt: data.expiresAt
    });
  } catch (error) {
    console.error('wallet/limits error:', error);
    res.status(500).json({ error: 'Failed to get limits' });
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

    // Get price cache for USD values
    const priceDoc = await db.collection('PriceCache').doc('latest').get();
    const prices = priceDoc.exists ? priceDoc.data().prices || {} : {};
    const ethPrice = prices.ETH?.usd || 0;

    // Process token balances with metadata
    const tokenBalances = tokensData.result?.tokenBalances || [];
    const tokens = [];

    for (const token of tokenBalances.slice(0, 20)) { // Limit to 20 tokens
      if (token.tokenBalance === '0x0' || token.tokenBalance === '0x0000000000000000000000000000000000000000000000000000000000000000') continue;

      try {
        // Get token metadata
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
        const priceUsd = prices[symbol]?.usd || 0;
        const totalValue = (parseFloat(formattedBalance) * priceUsd).toFixed(2);

        tokens.push({
          contract: token.contractAddress,
          symbol,
          name: meta.name || 'Unknown Token',
          balance: formattedBalance,
          priceInUSD: priceUsd,
          totalValueInUSD: totalValue,
          logo: meta.logo || null
        });
      } catch (e) {
        // Skip tokens that fail metadata fetch
      }
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
 * GET /prices/cache - Get cached prices
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

/**
 * GET /prices/range - Get historical prices
 */
app.get('/prices/range', async (req, res) => {
  try {
    const { token, from, to } = req.query;

    // TODO: Query PriceHistory collection for range
    res.json({
      token,
      from,
      to,
      prices: []
    });
  } catch (error) {
    console.error('prices/range error:', error);
    res.status(500).json({ error: 'Failed to get price history' });
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
