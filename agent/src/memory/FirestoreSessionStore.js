/**
 * FirestoreSessionStore.js - Persistent session storage using Firestore
 * 
 * Replaces in-memory SessionStore for production use.
 * Benefits:
 * - Persists across Cloud Run instances
 * - Survives container restarts
 * - Enables chat history retrieval and auditing
 */

import admin from 'firebase-admin';
import crypto from 'crypto';

// Initialize Firebase Admin if not already done
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const COLLECTION = 'agent_sessions';

export class FirestoreSessionStore {
  constructor({ sessionTtlMs = 30 * 60 * 1000 } = {}) { // 30 minutes default
    this.sessionTtlMs = sessionTtlMs;
    this.collection = db.collection(COLLECTION);
    this.historyCollection = db.collection('wallet_chats');
    this.txLogCollection = db.collection('wallet_transactions');
  }

  /**
   * Create a new session
   */
  async create(initialFacts = {}) {
    const id = crypto.randomUUID();
    const now = Date.now();
    
    await this.collection.doc(id).set({
      id,
      createdAt: now,
      lastAccessedAt: now,
      messages: [],
      facts: { ...initialFacts }
    });

    
    return id;
  }

  /**
   * Ensure a session exists (create if not)
   */
  async ensure(id, initialFacts = {}) {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      const now = Date.now();
      await docRef.set({
        id,
        createdAt: now,
        lastAccessedAt: now,
        messages: [],
        facts: { ...initialFacts }
      });
      
    } else {
      // Update last accessed time
      await docRef.update({ lastAccessedAt: Date.now() });
      const data = doc.data();
      
    }
    
    return this.get(id);
  }

  /**
   * Get a session
   */
  async get(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      return null;
    }
    return doc.data();
  }

  /**
   * Delete a session
   */
  async delete(id) {
    await this.collection.doc(id).delete();
    return true;
  }

  /**
   * Append a message to session history
   */
  async appendMessage(id, role, content) {
    const docRef = this.collection.doc(id);
    const doc = await docRef.get();
    
    if (!doc.exists) {
      // Create session if it doesn't exist
      await this.ensure(id);
    }
    
    const session = (await docRef.get()).data();
    const messages = session.messages || [];
    
    messages.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Keep last 50 messages
    const trimmedMessages = messages.slice(-50);
    
    await docRef.update({
      messages: trimmedMessages,
      lastAccessedAt: Date.now()
    });
  }

  /**
   * Get chat history for a session
   */
  async getChatHistory(id, limit = 10) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return [];
    
    const data = doc.data();
    return (data.messages || []).slice(-limit);
  }

  /**
   * Set a fact in session memory
   */
  async setFact(id, key, value) {
    const docRef = this.collection.doc(id);
    
    // Use dot notation to update nested field
    await docRef.update({
      [`facts.${key}`]: value,
      lastAccessedAt: Date.now()
    });
    
    if (key === 'pendingSwaps' || key === 'pendingSwapIntent') {
      
    }
  }

  /**
   * Get a fact from session memory
   */
  async getFact(id, key) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) return null;
    
    const data = doc.data();
    return data.facts?.[key] ?? null;
  }

  /**
   * Get all facts for a session
   */
  async getFacts(id) {
    const doc = await this.collection.doc(id).get();
    if (!doc.exists) {
      
      return {};
    }
    
    const data = doc.data();
    const facts = data.facts || {};
    
    
    return facts;
  }

  /**
   * Update multiple facts at once
   */
  async updateFacts(id, facts) {
    const docRef = this.collection.doc(id);
    
    // Build update object with dot notation
    const updates = { lastAccessedAt: Date.now() };
    for (const [key, value] of Object.entries(facts)) {
      updates[`facts.${key}`] = value;
    }
    
    await docRef.update(updates);
  }

  /**
   * Get session metrics
   */
  async getMetrics() {
    const snapshot = await this.collection.count().get();
    return {
      totalSessions: snapshot.data().count
    };
  }

  /**
   * Cleanup expired sessions (can be called by a scheduled function)
   */
  async cleanupExpired() {
    const cutoff = Date.now() - this.sessionTtlMs;
    const snapshot = await this.collection
      .where('lastAccessedAt', '<', cutoff)
      .limit(100) // Process in batches
      .get();

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });

    if (!snapshot.empty) {
      await batch.commit();
      
    }

    return snapshot.size;
  }

  // ============================================
  // PERMANENT WALLET CHAT HISTORY
  // ============================================

  /**
   * Save message to permanent wallet history (never expires)
   */
  async saveToWalletHistory(walletAddress, role, content, metadata = {}) {
    if (!walletAddress) return;

    const wallet = walletAddress.toLowerCase();
    const docRef = this.historyCollection.doc(wallet);
    const doc = await docRef.get();

    const message = {
      role,
      content,
      timestamp: Date.now(),
      ...metadata
    };

    if (!doc.exists) {
      await docRef.set({
        walletAddress: wallet,
        createdAt: Date.now(),
        messages: [message],
        messageCount: 1
      });
    } else {
      const data = doc.data();
      const messages = data.messages || [];
      messages.push(message);

      await docRef.update({
        messages,
        messageCount: messages.length,
        lastMessageAt: Date.now()
      });
    }
  }

  /**
   * Get permanent chat history for a wallet
   */
  async getWalletHistory(walletAddress, limit = 100, offset = 0) {
    if (!walletAddress) return { messages: [], total: 0 };

    const wallet = walletAddress.toLowerCase();
    const doc = await this.historyCollection.doc(wallet).get();

    if (!doc.exists) {
      return { messages: [], total: 0 };
    }

    const data = doc.data();
    const allMessages = data.messages || [];
    const total = allMessages.length;

    // Return paginated slice (most recent first)
    const sorted = [...allMessages].reverse();
    const messages = sorted.slice(offset, offset + limit);

    return { messages, total };
  }

  /**
   * Get chat sessions summary for a wallet (for sidebar display)
   */
  async getWalletChatSessions(walletAddress, limit = 20) {
    if (!walletAddress) return [];

    const wallet = walletAddress.toLowerCase();
    const doc = await this.historyCollection.doc(wallet).get();

    if (!doc.exists) return [];

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
    return sessions.reverse().slice(0, limit);
  }

  // ============================================
  // SESSION RESUME (load historical context)
  // ============================================

  /**
   * Resume an old conversation by loading messages from permanent history
   * into a new or existing session.
   *
   * @param {string} sessionId - The session to load messages into
   * @param {string} walletAddress - The wallet whose history to load
   * @param {number} startedAt - Start timestamp of the old session
   * @param {number} endedAt - End timestamp of the old session (optional, defaults to startedAt + 30min)
   * @returns {object} - { loaded: number, sessionId }
   */
  async resumeFromHistory(sessionId, walletAddress, startedAt, endedAt = null) {
    if (!walletAddress || !startedAt) {
      return { loaded: 0, sessionId };
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await this.historyCollection.doc(wallet).get();

    if (!doc.exists) {
      return { loaded: 0, sessionId };
    }

    const data = doc.data();
    const allMessages = data.messages || [];

    // Default endedAt to 30 minutes after startedAt if not provided
    const sessionEnd = endedAt || (startedAt + 30 * 60 * 1000);

    // Filter messages within the time range
    const sessionMessages = allMessages.filter(
      msg => msg.timestamp >= startedAt && msg.timestamp <= sessionEnd
    );

    if (sessionMessages.length === 0) {
      return { loaded: 0, sessionId };
    }

    // Ensure session exists
    await this.ensure(sessionId, { walletAddress: wallet });

    // Load messages into session (keep last 50)
    const docRef = this.collection.doc(sessionId);
    const trimmedMessages = sessionMessages.slice(-50).map(msg => ({
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp
    }));

    await docRef.update({
      messages: trimmedMessages,
      lastAccessedAt: Date.now(),
      'facts.resumedFrom': startedAt,
      'facts.walletAddress': wallet
    });

    return { loaded: trimmedMessages.length, sessionId };
  }

  /**
   * Get messages from a specific historical session time range
   * (for displaying old conversations without loading into active session)
   */
  async getHistoricalSession(walletAddress, startedAt, endedAt = null) {
    if (!walletAddress || !startedAt) {
      return { messages: [], startedAt, endedAt: null };
    }

    const wallet = walletAddress.toLowerCase();
    const doc = await this.historyCollection.doc(wallet).get();

    if (!doc.exists) {
      return { messages: [], startedAt, endedAt: null };
    }

    const data = doc.data();
    const allMessages = data.messages || [];

    // Find session boundaries - start from startedAt, end when gap > 30 min
    const SESSION_GAP_MS = 30 * 60 * 1000;
    let sessionEndAt = endedAt;

    if (!sessionEndAt) {
      // Find where the session naturally ends (30+ min gap)
      const startIdx = allMessages.findIndex(m => m.timestamp >= startedAt);
      if (startIdx === -1) {
        return { messages: [], startedAt, endedAt: null };
      }

      sessionEndAt = startedAt;
      for (let i = startIdx; i < allMessages.length; i++) {
        const msg = allMessages[i];
        if (msg.timestamp - sessionEndAt > SESSION_GAP_MS) {
          break;
        }
        sessionEndAt = msg.timestamp;
      }
    }

    const messages = allMessages.filter(
      msg => msg.timestamp >= startedAt && msg.timestamp <= sessionEndAt
    );

    return { messages, startedAt, endedAt: sessionEndAt };
  }

  // ============================================
  // TRANSACTION AUDIT LOG
  // ============================================

  /**
   * Log a transaction executed by the AI agent
   */
  async logTransaction(walletAddress, txData) {
    if (!walletAddress) return;

    const wallet = walletAddress.toLowerCase();
    const txId = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

    const logEntry = {
      id: txId,
      walletAddress: wallet,
      timestamp: Date.now(),
      tool: txData.tool,
      params: txData.params || {},
      result: txData.result || {},
      txHash: txData.txHash || null,
      chainId: txData.chainId || 8453,
      status: txData.status || 'completed',
      error: txData.error || null
    };

    await this.txLogCollection
      .doc(wallet)
      .collection('logs')
      .doc(txId)
      .set(logEntry);

    return txId;
  }

  /**
   * Get transaction history for a wallet
   */
  async getTransactionHistory(walletAddress, limit = 50) {
    if (!walletAddress) return [];

    const wallet = walletAddress.toLowerCase();
    const snapshot = await this.txLogCollection
      .doc(wallet)
      .collection('logs')
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    return snapshot.docs.map(doc => doc.data());
  }

  /**
   * No-op for compatibility with in-memory store
   */
  destroy() {
    // No cleanup needed for Firestore
  }
}

