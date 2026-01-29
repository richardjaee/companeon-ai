/**
 * dca-agent.js - Recurring Transfer Tools (Agent-to-Agent Delegation)
 *
 * Implements simple recurring transfers using a sub-delegation to a
 * downstream transfer agent. Schedule metadata is stored in Firestore and a
 * separate trigger (Cloud Functions or cron) can execute due items.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { Timestamp, FieldValue, getFirestore } from 'firebase-admin/firestore';
import { ethers } from 'ethers';
import { createSubDelegation, storeSubDelegation } from '../../lib/subDelegation.js';
import { getDelegationDataForWallet } from '../../lib/delegationSigner.js';

// Initialize Firestore
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

// Collections
const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';
const DCA_COLLECTION = 'DCASchedules'; // Used for list_all_scheduled only

function getDCAAgentAddress() {
  const key = process.env.DCA_AGENT_PRIVATE_KEY;
  if (!key) throw new Error('DCA_AGENT_PRIVATE_KEY not configured');
  return new ethers.Wallet(key).address;
}

function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'hourly': return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'test': return new Date(now.getTime() + 2 * 60 * 1000); // demo
    default: return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

function formatFrequency(f) {
  return f === 'hourly' ? 'every hour'
    : f === 'daily' ? 'every day'
    : f === 'weekly' ? 'every week'
    : f === 'test' ? 'in 2 minutes (test mode)'
    : f;
}

export const dcaAgentTools = [
  {
    name: 'preview_recurring_transfer',
    description: 'Preview a recurring transfer setup and ask for confirmation.',
    parameters: z.object({
      token: z.string(),
      amount: z.string(),
      recipient: z.string(),
      frequency: z.enum(['hourly', 'daily', 'weekly', 'test']),
      maxExecutions: z.number().optional()
    }),
    tags: ['transfer', 'schedule', 'a2a', 'agent', 'preview'],
    handler: async (params, context) => {
      const { token, amount, recipient, frequency, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const nextRun = calculateNextRun(frequency);
      return {
        success: true,
        preview: true,
        ask: true,
        pendingTransferSchedule: { token: token.toUpperCase(), amount, recipient, frequency, maxExecutions: maxExecutions || null },
        showToUser: `**Set Up Recurring Transfer?**\n\n**Transfer Details:**\n- Amount: ${amount} ${token.toUpperCase()}\n- To: ${recipient}\n- Frequency: ${formatFrequency(frequency)}\n- First execution: ${nextRun.toLocaleString()}\n${maxExecutions ? `- Max transfers: ${maxExecutions}` : '- Continues until cancelled'}\n\n**Agent-to-Agent Delegation:**\nThis will create a sub-delegation from Companeon to the Transfer Agent.\nThe Transfer Agent will autonomously execute transfers using your existing wallet permissions.\n\n**Would you like to set this up?**`
      };
    }
  },
  {
    name: 'schedule_recurring_transfer',
    description: 'Create a recurring transfer schedule after user confirmation.',
    parameters: z.object({
      token: z.string(),
      amount: z.string(),
      recipient: z.string(),
      frequency: z.enum(['hourly', 'daily', 'weekly', 'test']),
      maxExecutions: z.number().optional()
    }),
    tags: ['transfer', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { token, amount, recipient, frequency, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const chainId = context?.chainId || context?.memoryFacts?.chainId || 8453;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      const scheduleId = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const nextRun = calculateNextRun(frequency);

      // Create sub-delegation with scoped caveats (best-effort)
      try {
        const transferAgentAddress = getDCAAgentAddress();
        const delegationData = await getDelegationDataForWallet(walletAddress, logger);

        // Build caveat config to scope the sub-delegation
        const caveatConfig = {
          token: token.toUpperCase(),
          amount,
          frequency,
          recipient
        };
        if (token.toUpperCase() !== 'ETH') {
          const scope = (delegationData.scopes || []).find(s =>
            s.tokenSymbol?.toUpperCase() === token.toUpperCase()
          );
          if (scope?.tokenAddress) {
            caveatConfig.tokenAddress = scope.tokenAddress;
            caveatConfig.decimals = scope.decimals;
          }
        }

        const subDelegationData = await createSubDelegation({
          parentPermissionsContext: delegationData.permissionsContext,
          companeonKey: process.env.BACKEND_DELEGATION_KEY,
          dcaAgentAddress: transferAgentAddress,
          limits: { token, amount },
          caveatConfig,
          delegationManager: delegationData.delegationManager,
          chainId,
          logger
        });
        await storeSubDelegation(walletAddress, scheduleId, {
          ...subDelegationData,
          delegationManager: delegationData.delegationManager,
          chainId
        });
      } catch (e) {
        logger?.warn?.('sub_delegation_create_failed', { error: e.message });
      }

      const schedule = {
        scheduleId,
        type: 'transfer',
        walletAddress: walletAddress.toLowerCase(),
        chainId,
        token: token.toUpperCase(),
        amount,
        recipient,
        frequency,
        maxExecutions: maxExecutions || null,
        executionCount: 0,
        status: 'active',
        nextRunAt: Timestamp.fromDate(nextRun),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'companeon',
        executedBy: 'transfer-agent',
        executionHistory: []
      };
      await db.collection(TRANSFER_SCHEDULE_COLLECTION).doc(scheduleId).set(schedule);

      return {
        success: true,
        scheduleId,
        message: 'Recurring transfer schedule created',
        schedule: {
          id: scheduleId,
          token: token.toUpperCase(),
          amount,
          recipient,
          frequency: formatFrequency(frequency),
          nextExecution: nextRun.toISOString(),
          status: 'active'
        },
        showToUser: `**Recurring Transfer Scheduled**\n\n- Send: ${amount} ${token.toUpperCase()}\n- To: ${recipient}\n- Frequency: ${formatFrequency(frequency)}\n- First execution: ${nextRun.toLocaleString()}\n${maxExecutions ? `- Max transfers: ${maxExecutions}` : ''}\n\nSchedule ID: ${scheduleId}`
      };
    }
  },
  {
    name: 'list_recurring_transfers',
    description: 'List recurring transfer schedules for this wallet',
    parameters: z.object({ status: z.enum(['active','paused','completed','cancelled','all']).optional() }),
    tags: ['transfer', 'schedule', 'a2a', 'agent'],
    handler: async (params, context) => {
      const { status = 'active' } = params || {};
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const snapshot = await db.collection(TRANSFER_SCHEDULE_COLLECTION)
        .where('walletAddress', '==', walletAddress.toLowerCase())
        .limit(50)
        .get();
      const rows = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        if (status !== 'all' && data.status !== status) return;
        rows.push({
          id: data.scheduleId,
          token: data.token,
          amount: data.amount,
          recipient: data.recipient,
          frequency: data.frequency,
          status: data.status,
          nextRunAt: data.nextRunAt?.toDate?.()?.toISOString?.() || null
        });
      });
      return {
        success: true,
        count: rows.length,
        schedules: rows,
        showToUser: rows.length ? rows.map((r,i)=>`${i+1}. ${r.amount} ${r.token} → ${r.recipient} (${r.frequency}) - ${r.status}${r.nextRunAt ? `, next: ${new Date(r.nextRunAt).toLocaleString()}`:''}`).join('\n') : 'No recurring transfers found.'
      };
    }
  },
  {
    name: 'cancel_recurring_transfer',
    description: 'Cancel a recurring transfer schedule by ID',
    parameters: z.object({ scheduleId: z.string() }),
    tags: ['transfer', 'schedule', 'a2a', 'agent'],
    handler: async (params) => {
      const { scheduleId } = params;
      const docRef = db.collection(TRANSFER_SCHEDULE_COLLECTION).doc(scheduleId);
      const doc = await docRef.get();
      if (!doc.exists) return { success: false, error: 'Schedule not found' };
      await docRef.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return { success: true, scheduleId, showToUser: `Recurring transfer ${scheduleId} cancelled.` };
    }
  },
  {
    name: 'trigger_scheduled_now',
    description: 'Trigger due scheduled tasks via a Cloud Function (best-effort) for demo/manual runs',
    parameters: z.object({}),
    tags: ['transfer', 'dca', 'schedule', 'a2a', 'agent', 'trigger'],
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
  },
  {
    name: 'list_all_scheduled',
    description: 'List all scheduled tasks (transfers + DCA) for this wallet',
    parameters: z.object({ includeCompleted: z.boolean().optional() }),
    tags: ['transfer', 'dca', 'schedule', 'a2a', 'agent', 'list'],
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
  }
];

