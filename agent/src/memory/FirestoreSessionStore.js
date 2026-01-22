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
  constructor({ sessionTtlMs = 24 * 60 * 60 * 1000 } = {}) {
    this.sessionTtlMs = sessionTtlMs;
    this.collection = db.collection(COLLECTION);
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

  /**
   * No-op for compatibility with in-memory store
   */
  destroy() {
    // No cleanup needed for Firestore
  }
}

