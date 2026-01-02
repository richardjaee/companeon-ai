/**
 * SessionStore.js - Simple session and memory management
 */

import crypto from 'crypto';

export class SessionStore {
  constructor({ maxSessions = 1000, sessionTtlMs = 24 * 60 * 60 * 1000 } = {}) {
    this.sessions = new Map();
    this.maxSessions = maxSessions;
    this.sessionTtlMs = sessionTtlMs;

    // Cleanup expired sessions every 5 minutes
    this.cleanupInterval = setInterval(() => {
      this._cleanupExpired();
    }, 5 * 60 * 1000);
  }

  /**
   * Create a new session
   */
  create(initialFacts = {}) {
    const id = crypto.randomUUID();
    
    this.sessions.set(id, {
      id,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      messages: [],
      facts: { ...initialFacts }
    });

    // Enforce max sessions
    if (this.sessions.size > this.maxSessions) {
      this._evictOldest();
    }

    return id;
  }

  /**
   * Ensure a session exists (create if not)
   */
  ensure(id, initialFacts = {}) {
    const existed = this.sessions.has(id);
    if (!existed) {
      this.sessions.set(id, {
        id,
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        messages: [],
        facts: { ...initialFacts }
      });
      // DEBUG: Log when new session is created
      console.log(`[SessionStore] ensure: CREATED NEW session=${id}, totalSessions=${this.sessions.size}`);
    } else {
      // DEBUG: Log when existing session is reused
      const session = this.sessions.get(id);
      console.log(`[SessionStore] ensure: REUSING session=${id}, factKeys=${Object.keys(session.facts).join(',')}, hasPending=${!!session.facts.pendingSwapIntent}`);
    }
    return this.get(id);
  }

  /**
   * Get a session
   */
  get(id) {
    const session = this.sessions.get(id);
    if (session) {
      session.lastAccessedAt = Date.now();
    }
    return session || null;
  }

  /**
   * Delete a session
   */
  delete(id) {
    return this.sessions.delete(id);
  }

  /**
   * Append a message to session history
   */
  appendMessage(id, role, content) {
    const session = this.ensure(id);
    session.messages.push({
      role,
      content,
      timestamp: Date.now()
    });

    // Keep last 50 messages to bound memory
    if (session.messages.length > 50) {
      session.messages = session.messages.slice(-50);
    }
  }

  /**
   * Get chat history for a session
   */
  getChatHistory(id, limit = 10) {
    const session = this.get(id);
    if (!session) return [];
    return session.messages.slice(-limit);
  }

  /**
   * Set a fact in session memory
   */
  setFact(id, key, value) {
    const session = this.ensure(id);
    session.facts[key] = value;
    // DEBUG: Log fact setting for troubleshooting
    if (key === 'pendingSwaps' || key === 'pendingSwapIntent') {
      console.log(`[SessionStore] setFact: session=${id}, key=${key}, valueExists=${!!value}, sessionHas=${this.sessions.has(id)}`);
    }
  }

  /**
   * Get a fact from session memory
   */
  getFact(id, key) {
    const session = this.get(id);
    return session?.facts?.[key] ?? null;
  }

  /**
   * Get all facts for a session
   */
  getFacts(id) {
    const session = this.get(id);
    const facts = session?.facts || {};
    // DEBUG: Log when facts are retrieved
    console.log(`[SessionStore] getFacts: session=${id}, sessionExists=${!!session}, hasPendingSwaps=${!!facts.pendingSwaps?.length}, hasPendingSwapIntent=${!!facts.pendingSwapIntent}`);
    return facts;
  }

  /**
   * Update multiple facts at once
   */
  updateFacts(id, facts) {
    const session = this.ensure(id);
    Object.assign(session.facts, facts);
  }

  /**
   * Get session metrics
   */
  getMetrics() {
    return {
      totalSessions: this.sessions.size,
      maxSessions: this.maxSessions
    };
  }

  /**
   * Cleanup expired sessions
   */
  _cleanupExpired() {
    const now = Date.now();
    let removed = 0;

    for (const [id, session] of this.sessions) {
      if (now - session.lastAccessedAt > this.sessionTtlMs) {
        this.sessions.delete(id);
        removed++;
      }
    }

    return removed;
  }

  /**
   * Evict oldest sessions when at capacity
   */
  _evictOldest() {
    const sorted = Array.from(this.sessions.entries())
      .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    // Remove oldest 10%
    const toRemove = Math.max(1, Math.floor(sorted.length * 0.1));
    for (let i = 0; i < toRemove; i++) {
      this.sessions.delete(sorted[i][0]);
    }
  }

  /**
   * Destroy the store (cleanup intervals)
   */
  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.sessions.clear();
  }
}

