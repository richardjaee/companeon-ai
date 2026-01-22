/**
 * Cleanup Job
 *
 * Cleans up expired auth nonces and stale sessions.
 * Note: Permanent wallet history (wallet_chats) is never deleted.
 */

const NONCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes (idle timeout)
const LEGACY_SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours for legacy sessions

/**
 * Clean up expired data
 */
export async function cleanupExpired(firestore) {
  console.log('Running cleanup...');

  const now = Date.now();
  let noncesDeleted = 0;
  let sessionsDeleted = 0;
  let agentSessionsDeleted = 0;

  try {
    // Clean up expired auth nonces
    const expiredNonces = await firestore
      .collection('AuthNonces')
      .where('expiresAt', '<', now)
      .get();

    for (const doc of expiredNonces.docs) {
      await doc.ref.delete();
      noncesDeleted++;
    }

    // Clean up expired wallet nonces
    const expiredWalletNonces = await firestore
      .collection('WalletNonces')
      .where('expiresAt', '<', now)
      .get();

    for (const doc of expiredWalletNonces.docs) {
      await doc.ref.delete();
      noncesDeleted++;
    }

    // Clean up stale legacy Sessions (inactive for 24+ hours)
    const staleSessions = await firestore
      .collection('Sessions')
      .where('status', '==', 'active')
      .where('updatedAt', '<', now - LEGACY_SESSION_EXPIRY_MS)
      .get();

    for (const doc of staleSessions.docs) {
      await doc.ref.update({
        status: 'expired',
        expiredAt: now
      });
      sessionsDeleted++;
    }

    // Clean up expired agent_sessions (30-minute idle timeout)
    // These are temporary sessions; permanent history is in wallet_chats
    const staleAgentSessions = await firestore
      .collection('agent_sessions')
      .where('lastAccessedAt', '<', now - SESSION_EXPIRY_MS)
      .limit(100) // Process in batches
      .get();

    const batch = firestore.batch();
    for (const doc of staleAgentSessions.docs) {
      batch.delete(doc.ref);
      agentSessionsDeleted++;
    }

    if (agentSessionsDeleted > 0) {
      await batch.commit();
    }

    console.log(`Cleanup complete: ${noncesDeleted} nonces, ${sessionsDeleted} legacy sessions, ${agentSessionsDeleted} agent sessions`);
    return { noncesDeleted, sessionsDeleted, agentSessionsDeleted };

  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
}
