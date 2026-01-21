/**
 * Cleanup Job
 *
 * Cleans up expired auth nonces and stale sessions
 */

const NONCE_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const SESSION_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Clean up expired data
 */
export async function cleanupExpired(firestore) {
  console.log('Running cleanup...');

  const now = Date.now();
  let noncesDeleted = 0;
  let sessionsDeleted = 0;

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

    // Clean up stale sessions (inactive for 24+ hours)
    const staleSessions = await firestore
      .collection('Sessions')
      .where('status', '==', 'active')
      .where('updatedAt', '<', now - SESSION_EXPIRY_MS)
      .get();

    for (const doc of staleSessions.docs) {
      await doc.ref.update({
        status: 'expired',
        expiredAt: now
      });
      sessionsDeleted++;
    }

    console.log(`Cleanup complete: ${noncesDeleted} nonces, ${sessionsDeleted} sessions`);
    return { noncesDeleted, sessionsDeleted };

  } catch (error) {
    console.error('Cleanup error:', error);
    throw error;
  }
}
