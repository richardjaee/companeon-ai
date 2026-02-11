/**
 * companeon-agent - Modern LLM Agent with Tool Calling
 * 
 * A clean, professional agent that:
 * - Uses native LLM tool calling (Gemini)
 * - ReAct-style reasoning loop
 * - Clean tool definitions with Zod schemas
 * - SSE streaming for real-time responses
 */

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import winston from 'winston';
import crypto from 'crypto';

import { Agent } from './agent/Agent.js';
import { createLLMClient } from './llm/GeminiClient.js';
import { ToolRegistry } from './tools/ToolRegistry.js';
import { FirestoreSessionStore } from './memory/FirestoreSessionStore.js';

// Load wallet tools and prompts
import { registerWalletTools } from './tools/definitions/wallet-index.js';
import { buildSystemPrompt } from './agent/wallet-prompts.js';

// Credit system - direct Firestore access (shared project with API service)
import admin from 'firebase-admin';

// Ensure Firebase Admin is initialized (FirestoreSessionStore does this too,
// but this is safe to call if already initialized)
if (!admin.apps.length) {
  admin.initializeApp();
}
const creditsDb = admin.firestore();
const CREDITS_COLLECTION = 'wallet_credits';

async function checkCredits(walletAddress) {
  const wallet = walletAddress.toLowerCase();
  const doc = await creditsDb.collection(CREDITS_COLLECTION).doc(wallet).get();
  if (!doc.exists) return 0;
  const data = doc.data();
  return (data.totalCredits || 0) - (data.usedCredits || 0);
}

async function deductCredit(walletAddress) {
  const wallet = walletAddress.toLowerCase();
  const docRef = creditsDb.collection(CREDITS_COLLECTION).doc(wallet);
  await docRef.update({
    usedCredits: admin.firestore.FieldValue.increment(1),
    updatedAt: Date.now()
  });
}

// ============================================================================
// Setup
// ============================================================================

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));

// Logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [new winston.transports.Console()]
});

// Initialize components
let llm;
let tools;
let sessionStore;

function initialize() {
  // Create LLM client
  llm = createLLMClient({ logger });
  logger.info('LLM client initialized', { model: llm.name });

  // Create tool registry and register wallet tools
  tools = new ToolRegistry({ logger });
  registerWalletTools(tools);
  logger.info('Wallet mode enabled: Direct wallet automation via ERC-7715 delegation');
  logger.info('Tools registered', { count: tools.list().length, tools: tools.list().map(t => t.name) });

  // Create Firestore session store (persistent across instances)
  sessionStore = new FirestoreSessionStore();
  logger.info('Firestore session store initialized');
}

// Initialize on startup
try {
  initialize();
  logger.info('Initialization complete');
} catch (e) {
  logger.error('Failed to initialize', { error: e.message, stack: e.stack });
}

// ============================================================================
// Middleware
// ============================================================================

// API key check (skip for health, images, and cache-clear endpoints)
app.use((req, res, next) => {
  // Skip auth for public endpoints
  if (req.path === '/health' ||
      req.path === '/delegation/clear-cache' ||
      req.path.startsWith('/images/')) {
    return next();
  }

  // Accept internal API key (service-to-service) or gateway API key (from Cloud Endpoints)
  const internalKey = process.env.INTERNAL_API_KEY || process.env.AGENT_INTERNAL_API_KEY || '';
  const gatewayKey = process.env.GATEWAY_API_KEY || '';

  if (!internalKey && !gatewayKey) return next(); // Dev mode - no key required

  const provided = req.get('x-internal-key') || req.get('x-api-key') || '';

  // Check if provided key matches either internal or gateway key
  const isValid = (internalKey && provided === internalKey) || (gatewayKey && provided === gatewayKey);
  if (!isValid) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  next();
});

// Request ID
app.use((req, res, next) => {
  res.locals.reqId = req.headers['x-request-id'] || crypto.randomUUID();
  res.set('x-request-id', res.locals.reqId);
  next();
});

// ============================================================================
// Image Storage (temporary in-memory store for generated images)
// ============================================================================

const imageStore = new Map();
const IMAGE_TTL_MS = 10 * 60 * 1000; // 10 minutes

function storeImage(base64, mimeType) {
  const id = crypto.randomUUID();
  imageStore.set(id, { base64, mimeType, createdAt: Date.now() });
  
  // Clean up after TTL
  setTimeout(() => imageStore.delete(id), IMAGE_TTL_MS);
  
  return id;
}

// Export for use in tools
export { storeImage };

// ============================================================================
// Routes
// ============================================================================

/**
 * Serve generated images
 */
app.get('/images/:id', (req, res) => {
  const { id } = req.params;
  const image = imageStore.get(id);
  
  if (!image) {
    return res.status(404).json({ error: 'Image not found or expired' });
  }
  
  const buffer = Buffer.from(image.base64, 'base64');
  res.set('Content-Type', image.mimeType);
  res.set('Cache-Control', 'public, max-age=600'); // 10 min cache
  res.send(buffer);
});

/**
 * Health check
 */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    model: llm?.name || 'not_initialized',
    tools: tools?.list() || []
  });
});

/**
 * Version info
 */
app.get('/version', (req, res) => {
  try {
    const pkg = JSON.parse(process.env.npm_package_json ? process.env.npm_package_json : '{}');
    // Fallback to reading package.json directly if not injected by npm
    let name = pkg.name, version = pkg.version;
    if (!name || !version) {
      const fs = require('fs');
      const path = require('path');
      const p = path.resolve(process.cwd(), 'package.json');
      if (fs.existsSync(p)) {
        const raw = JSON.parse(fs.readFileSync(p, 'utf8'));
        name = raw.name; version = raw.version;
      }
    }
    return res.json({ ok: true, name, version });
  } catch (_) {
    return res.json({ ok: true });
  }
});

/**
 * Create a new session
 */
app.post('/sessions', async (req, res) => {
  try {
    const id = await sessionStore.create();
    res.json({ sessionId: id });
  } catch (e) {
    logger.error('Failed to create session', { error: e.message });
    res.status(500).json({ error: 'Failed to create session' });
  }
});

/**
 * Get session info
 */
app.get('/sessions/:id', async (req, res) => {
  try {
    const session = await sessionStore.get(req.params.id);
    if (!session) {
      return res.status(404).json({ error: 'session not found' });
    }
    res.json({
      id: session.id,
      facts: session.facts,
      messageCount: (session.messages || []).length
    });
  } catch (e) {
    logger.error('Failed to get session', { error: e.message });
    res.status(500).json({ error: 'Failed to get session' });
  }
});

/**
 * Remember facts in a session
 */
app.post('/sessions/:id/remember', async (req, res) => {
  try {
    const { key, value, facts } = req.body || {};
    const id = req.params.id;

    if (facts && typeof facts === 'object') {
      await sessionStore.updateFacts(id, facts);
    } else if (key) {
      await sessionStore.setFact(id, key, value);
    }

    res.json({ ok: true });
  } catch (e) {
    logger.error('Failed to remember facts', { error: e.message });
    res.status(500).json({ error: 'Failed to remember facts' });
  }
});

/**
 * Stream a message (SSE) - Main conversational endpoint
 */
app.post('/sessions/:id/messages/stream', async (req, res) => {
  const sessionId = req.params.id;
  const { role = 'user', content, controls = {}, walletAddress, chainId } = req.body || {};

  if (!content) {
    return res.status(400).json({ error: 'content required' });
  }

  // Import chain config helpers
  const { setRequestChainId, clearRequestChainId, getChainConfig } = await import('./lib/chainConfig.js');
  
  // Set chain context for this request (affects all chain-aware functions)
  const effectiveChainId = chainId || 1;
  setRequestChainId(effectiveChainId);
  logger.info('request_chain_context', { sessionId, chainId: effectiveChainId, chainName: getChainConfig().name });

  // Credit check: verify wallet has remaining credits before running agent
  if (walletAddress) {
    try {
      const remaining = await checkCredits(walletAddress);
      if (remaining <= 0) {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache, no-transform');
        res.setHeader('Connection', 'keep-alive');
        res.flushHeaders?.();
        const writeErr = (event) => res.write(`data: ${JSON.stringify(event)}\n\n`);
        writeErr({ type: 'error', code: 'NO_CREDITS', message: 'No credits remaining. Purchase more credits to continue using the AI assistant.' });
        writeErr({ type: 'done', result: { plan: 'no_credits' } });
        res.end();
        return;
      }
    } catch (creditError) {
      logger.warn('credit_check_failed', { walletAddress, error: creditError.message });
      // Allow request to proceed if credit check fails (fail-open)
    }
  }

  // Ensure session exists (Firestore - async)
  await sessionStore.ensure(sessionId);

  // Update session facts from request (Firestore - async)
  if (walletAddress) await sessionStore.setFact(sessionId, 'walletAddress', walletAddress);
  if (chainId != null) await sessionStore.setFact(sessionId, 'chainId', Number(chainId));
  if (controls.autoTxMode) await sessionStore.setFact(sessionId, 'autoTxMode', controls.autoTxMode);
  if (controls.x402Mode) await sessionStore.setFact(sessionId, 'x402Mode', controls.x402Mode);

  // Add message to history (Firestore - async)
  await sessionStore.appendMessage(sessionId, role, content);

  // Save to permanent wallet history (never expires)
  if (walletAddress) {
    await sessionStore.saveToWalletHistory(walletAddress, role, content, { sessionId });
  }

  // Set up SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders?.();

  const write = (event) => {
    try {
      // Log key events for debugging streaming issues
      if (['ask_start', 'ask', 'ask_delta', 'done', 'tx_message'].includes(event.type)) {
        logger.info('sse_event', {
          type: event.type,
          hasMessage: !!event.message,
          messageLength: event.message?.length,
          textLength: event.text?.length
        });
      }
      res.write(`data: ${JSON.stringify(event)}\n\n`);
      // Flush immediately for real-time streaming (prevents Cloud Run/proxy buffering)
      if (typeof res.flush === 'function') {
        res.flush();
      }
    } catch (e) {
      logger.warn('sse_write_error', { type: event.type, error: e.message });
    }
  };

  // Heartbeat - send every 3 seconds to keep proxies/load balancers alive
  const heartbeat = setInterval(() => {
    write({ type: 'heartbeat', ts: Date.now() });
  }, 3000);

  try {
    // Build context (Firestore - async)
    const facts = await sessionStore.getFacts(sessionId);
    const chatHistory = await sessionStore.getChatHistory(sessionId, 10);
    
    // DEBUG: Log memory state at start of each turn
    logger.info('memory_state_start', {
      sessionId,
      hasPendingSwaps: !!facts?.pendingSwaps?.length,
      pendingSwapsCount: facts?.pendingSwaps?.length || 0,
      hasPendingSwapIntent: !!facts?.pendingSwapIntent,
      pendingSwapIntentToken: facts?.pendingSwapIntent?.fromToken,
      hasLastAsk: !!facts?.lastAsk,
      userMessage: content?.slice(0, 50)
    });
    
    // Note: remember is async but we fire-and-forget for performance
    // The Agent will await if needed via context
    const remember = async (key, value) => {
      await sessionStore.setFact(sessionId, key, value);
      if (facts && typeof facts === 'object') {
        facts[key] = value;
      }
      // DEBUG: Log when memory is updated
      if (key === 'pendingSwaps' || key === 'pendingSwapIntent') {
        logger.info('memory_updated', { sessionId, key, valueExists: !!value });
      }
    };

    const context = {
      walletAddress: facts.walletAddress,
      chainId: facts.chainId || effectiveChainId, // Chain ID for tools
      memoryFacts: facts,
      chatHistory,
      logger,
      remember,
      sessionId
    };

    // Run agent
    const agent = new Agent({ llm, tools, logger, maxIterations: 8, usePrompts: buildSystemPrompt });
    const result = await agent.run({
      prompt: content,
      context,
      onEvent: write
    });

    // Deduct one credit for successful agent response
    if (walletAddress) {
      try {
        await deductCredit(walletAddress);
      } catch (deductError) {
        logger.warn('credit_deduct_failed', { walletAddress, error: deductError.message });
      }
    }

    // Save assistant response to history with tool context (Firestore - async)
    if (result.response) {
      // Build a richer message that includes what tools were called
      let messageContent = result.response;
      
      // If tools were called, prepend a summary so the LLM has context
      if (result.toolResults && result.toolResults.length > 0) {
        const toolSummary = result.toolResults
          .map(t => t.ok ? `[Called ${t.tool}]` : `[${t.tool} failed]`)
          .join(' ');
        messageContent = `${toolSummary}\n${result.response}`;
      }
      
      await sessionStore.appendMessage(sessionId, 'assistant', messageContent);

      // Save to permanent wallet history
      if (walletAddress) {
        await sessionStore.saveToWalletHistory(walletAddress, 'assistant', messageContent, {
          sessionId,
          toolsCalled: result.toolResults?.map(t => t.tool) || []
        });

        // Log blockchain transactions for audit trail
        const txTools = ['swap', 'transfer', 'executeSwap', 'sendTransfer'];
        for (const toolResult of (result.toolResults || [])) {
          if (txTools.includes(toolResult.tool)) {
            await sessionStore.logTransaction(walletAddress, {
              tool: toolResult.tool,
              params: toolResult.params,
              result: toolResult.output,
              txHash: toolResult.output?.txHash || toolResult.output?.transactionHash,
              chainId: effectiveChainId,
              status: toolResult.ok ? 'completed' : 'failed',
              error: toolResult.ok ? null : toolResult.error
            });
          }
        }
      }

      // Track what we asked so LLM has context for "yes" responses
      // No pattern matching - LLM interprets meaning from chat history + memory facts
      const trimmed = result.response.trim();
      if (trimmed.endsWith('?')) {
        await sessionStore.setFact(sessionId, 'lastAsk', trimmed);
      }
    }

  } catch (e) {
    logger.error('Agent error', { sessionId, error: e.message, stack: e.stack });
    write({ type: 'error', message: e.message });
    write({ type: 'ask_start' });
    write({ type: 'ask', message: 'I encountered an error processing that. Please try again.' });
  } finally {
    // ALWAYS send done event - this is critical for frontend
    try {
      write({ type: 'done', result: { plan: 'completed' } });
    } catch (doneErr) {
      logger.warn('done_event_failed', { error: doneErr.message });
    }
    clearInterval(heartbeat);
    // Clear chain context
    clearRequestChainId();
    try { res.end(); } catch {}
  }
});

/**
 * Compatibility endpoint for Firebase gateway
 */
app.post('/live/messages/stream', async (req, res) => {
  const b = req.body || {};
  const id = b.agentSessionId || b.sessionId || b.id || b.data?.agentSessionId;
  const text = b.prompt || b.content || b.data?.prompt;
  const controls = b.controls || b.data?.controls || {};
  const walletAddress = b.walletAddress || b.data?.walletAddress;
  const chainId = b.chainId ?? b.data?.chainId;

  if (!id || !text) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: 'error', message: 'agentSessionId and prompt required' })}\n\n`);
    return res.end();
  }

  // Rewrite to canonical handler
  req.url = `/sessions/${id}/messages/stream`;
  req.params = { id };
  req.body = { role: 'user', content: text, controls, walletAddress, chainId };
  
  return app._router.handle(req, res, () => {});
});

/**
 * Direct tool invocation (for testing)
 */
app.post('/tools/:name', async (req, res) => {
  const name = req.params.name;
  
  // Guard against tools not being initialized
  if (!tools) {
    return res.status(503).json({ error: 'Server still initializing, tools not ready' });
  }
  
  if (!tools.has(name)) {
    return res.status(404).json({ error: `unknown tool: ${name}` });
  }

  // Import chain config helpers
  const { setRequestChainId, clearRequestChainId, getChainConfig } = await import('./lib/chainConfig.js');
  
  // Extract chainId from body and set context
  const { chainId, ...toolParams } = req.body || {};
  const effectiveChainId = chainId || 1;
  setRequestChainId(effectiveChainId);

  try {
    // Pass chainId in context for tools that need it
    const context = { 
      logger, 
      chainId: effectiveChainId,
      walletAddress: toolParams.walletAddress 
    };
    const result = await tools.execute(name, toolParams, context);
    res.json({ ok: true, output: result });
  } catch (e) {
    logger.error('Tool execution failed', { tool: name, error: e.message });
    res.status(500).json({ ok: false, error: e.message });
  } finally {
    clearRequestChainId();
  }
});

/**
 * Clear delegation cache - no-op since we removed caching
 * Kept for backwards compatibility with frontends that may call it
 */
app.post('/delegation/clear-cache', async (req, res) => {
  const { walletAddress } = req.body || {};
  logger.info('delegation_cache_clear_noop', { walletAddress: walletAddress || 'all' });
  res.json({ 
    ok: true, 
    message: 'No cache to clear - delegation data is always fetched fresh from Firestore'
  });
});

/**
 * Non-streaming task endpoint
 */
app.post('/tasks', async (req, res) => {
  const { prompt, context = {}, walletAddress, chainId, controls = {} } = req.body || {};

  if (!prompt) {
    return res.status(400).json({ error: 'prompt required' });
  }

  // Import chain config helpers
  const { setRequestChainId, clearRequestChainId, getChainConfig } = await import('./lib/chainConfig.js');
  
  // Set chain context for this request
  const effectiveChainId = chainId ?? context.chainId ?? 1;
  setRequestChainId(effectiveChainId);
  logger.info('task_chain_context', { chainId: effectiveChainId, chainName: getChainConfig().name });

  const events = [];
  const onEvent = (e) => events.push(e);

  // Build full context with all passed parameters
  const fullContext = {
    ...context,
    walletAddress: walletAddress ?? context.walletAddress,
    chainId: effectiveChainId, // Include chainId in context!
    memoryFacts: {
      ...context.memoryFacts,
      chainId: effectiveChainId,
      autoTxMode: controls.autoTxMode ?? context.memoryFacts?.autoTxMode ?? 'ask',
      x402Mode: controls.x402Mode ?? context.memoryFacts?.x402Mode ?? 'off'
    },
    logger
  };

  if (!fullContext.remember) {
    fullContext.remember = (key, value) => {
      fullContext.memoryFacts = fullContext.memoryFacts || {};
      fullContext.memoryFacts[key] = value;
    };
  }

  try {
    const agent = new Agent({ llm, tools, logger, maxIterations: 8, usePrompts: buildSystemPrompt });
    const result = await agent.run({
      prompt,
      context: fullContext,
      onEvent
    });

    res.json({
      ok: true,
      response: result.response,
      toolResults: result.toolResults,
      events
    });
  } catch (e) {
    logger.error('Task failed', { error: e.message });
    res.status(500).json({ ok: false, error: e.message, events });
  } finally {
    // Clear chain context
    clearRequestChainId();
  }
});

/**
 * Metrics endpoint
 */
app.get('/metrics', (req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    memory: {
      heapUsedMB: (mem.heapUsed / 1024 / 1024).toFixed(2),
      heapTotalMB: (mem.heapTotal / 1024 / 1024).toFixed(2),
      rssMB: (mem.rss / 1024 / 1024).toFixed(2)
    },
    sessions: sessionStore?.getMetrics() || {},
    uptime: process.uptime(),
    model: llm?.name || 'unknown'
  });
});

// ============================================================================
// Start Server
// ============================================================================

const PORT = Number(process.env.PORT || 8080);

const server = app.listen(PORT, () => {
  logger.info(`companeon-agent listening on port ${PORT}`, {
    model: llm?.name,
    tools: tools?.list()?.length || 0
  });
});

// Graceful shutdown
const shutdown = () => {
  logger.info('Shutting down...');
  sessionStore?.destroy();
  server.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

server.on('error', (err) => {
  logger.error('Server error', { error: err.message });
  process.exit(1);
});
