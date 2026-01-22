/**
 * autonomous-agents.js - Unified A2A Agent Management Tools
 *
 * Provides tools across autonomous agents:
 * - list_all_scheduled: List all scheduled tasks
 * - trigger_scheduled_now: Execute scheduled tasks now via Cloud Function
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const DCA_COLLECTION = 'DCASchedules';
const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';

export const autonomousAgentTools = [
  {
    name: 'list_all_scheduled',
    description: 'List all scheduled tasks (transfers + DCA) for this wallet',
    parameters: z.object({ includeCompleted: z.boolean().optional() }),
    tags: ['transfer','dca','schedule','a2a','agent','list'],
    handler: async (params, context) => {
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const lower = walletAddress.toLowerCase();
      const transfersSnap = await db.collection(TRANSFER_SCHEDULE_COLLECTION).where('walletAddress','==', lower).limit(50).get();
      const dcaSnap = await db.collection(DCA_COLLECTION).where('walletAddress','==', lower).limit(50).get();
      const transfers = transfersSnap.docs.map(d=>d.data());
      const dcas = dcaSnap.docs.map(d=>d.data());
      const lines = [];
      transfers.forEach((t,i)=>lines.push(`${i+1}. Transfer: ${t.amount} ${t.token} → ${t.recipient} (${t.frequency}) - ${t.status}`));
      dcas.forEach((d,i)=>lines.push(`${i+1}. DCA: ${d.fromToken} → ${d.toToken} ${d.amount} (${d.frequency}) - ${d.status}`));
      return { success: true, transfers: transfers.length, dcas: dcas.length, showToUser: lines.length ? lines.join('\n') : 'No scheduled tasks found.' };
    }
  },
  {
    name: 'trigger_scheduled_now',
    description: 'Trigger due scheduled tasks via a Cloud Function (best-effort) for demo/manual runs',
    parameters: z.object({}),
    tags: ['transfer','dca','schedule','a2a','agent','trigger'],
    handler: async (params, context) => {
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const triggerUrl = process.env.FIREBASE_FUNCTIONS_URL;
      if (!triggerUrl) return { success: false, error: 'FIREBASE_FUNCTIONS_URL not configured' };
      try {
        const response = await fetch(`${triggerUrl}/triggerDCAAgent`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ walletAddress, force: true })
        });
        if (!response.ok) throw new Error(`Trigger failed: ${response.status}`);
        const result = await response.json();
        return { success: true, processed: result.processed, results: result.results };
      } catch (e) {
        return { success: false, error: e.message };
      }
    }
  }
];

