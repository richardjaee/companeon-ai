/**
 * transfer-agent.js - Transfer Agent Tools (Agent-to-Agent Delegation)
 *
 * Implements recurring transfers using a sub‑delegation to a downstream
 * transfer agent that executes on schedule.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ethers } from 'ethers';
import { createSubDelegation, storeSubDelegation } from '../../lib/subDelegation.js';
import { getDelegationDataForWallet } from '../../lib/delegationSigner.js';

// Firestore
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';

function getTransferAgentAddress() {
  const key = process.env.TRANSFER_AGENT_PRIVATE_KEY;
  if (!key) throw new Error('TRANSFER_AGENT_PRIVATE_KEY not configured');
  return new ethers.Wallet(key).address;
}

function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'hourly': return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'test': return new Date(now.getTime() + 2 * 60 * 1000);
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

export const transferAgentTools = [
  {
    name: 'preview_recurring_transfer',
    description: 'Preview a recurring transfer setup and ask for confirmation.',
    parameters: z.object({
      token: z.string(),
      amount: z.string(),
      recipient: z.string(),
      frequency: z.enum(['hourly', 'daily', 'weekly', 'test']),
      name: z.string().optional(),
      maxExecutions: z.number().optional()
    }),
    tags: ['transfer', 'schedule', 'a2a', 'agent', 'preview'],
    handler: async (params, context) => {
      const { token, amount, recipient, frequency, name, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const nextRun = calculateNextRun(frequency);
      return {
        ask: true,
        preview: {
          token: token.toUpperCase(), amount, recipient,
          frequency: formatFrequency(frequency),
          name: name || null,
          firstExecution: nextRun.toLocaleString(),
          maxExecutions: maxExecutions || 'unlimited'
        }
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
      name: z.string().optional(),
      maxExecutions: z.number().optional()
    }),
    tags: ['transfer', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { token, amount, recipient, frequency, name, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const chainId = context?.chainId || context?.memoryFacts?.chainId || 8453;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      const transferAgentAddress = getTransferAgentAddress();
      const delegationData = await getDelegationDataForWallet(walletAddress, logger);

      // Create sub-delegation metadata (signed data creation done at execution time)
      const subDelegationData = await createSubDelegation({
        parentPermissionsContext: delegationData.permissionsContext,
        companeonKey: process.env.BACKEND_DELEGATION_KEY,
        dcaAgentAddress: transferAgentAddress,
        limits: { token, amount },
        delegationManager: delegationData.delegationManager,
        chainId,
        logger
      });

      const scheduleId = `transfer_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await storeSubDelegation(walletAddress, scheduleId, {
        ...subDelegationData,
        delegationManager: delegationData.delegationManager,
        chainId,
        agentType: 'transfer'
      });

      const nextRun = calculateNextRun(frequency);
      const schedule = {
        scheduleId,
        type: 'transfer',
        name: name || null,
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
        executionHistory: [],
        hasSubDelegation: !!subDelegationData,
        transferAgentAddress,
        parentDelegationHash: subDelegationData?.parentHash || null
      };
      await db.collection(TRANSFER_SCHEDULE_COLLECTION).doc(scheduleId).set(schedule);

      return {
        success: true,
        scheduleId,
        nextRun: nextRun.toISOString(),
        hasSubDelegation: !!subDelegationData,
        transferAgentAddress,
        showToUser: `Recurring transfer scheduled: ${amount} ${token.toUpperCase()} → ${recipient} (${formatFrequency(frequency)}). First execution: ${nextRun.toLocaleString()}. ID: ${scheduleId}`
      };
    }
  },
  {
    name: 'list_recurring_transfers',
    description: 'List recurring transfer schedules',
    parameters: z.object({ status: z.enum(['active','paused','completed','cancelled','all']).optional() }),
    tags: ['transfer', 'schedule', 'a2a', 'agent'],
    handler: async (params, context) => {
      const { status = 'active' } = params || {};
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const qs = await db.collection(TRANSFER_SCHEDULE_COLLECTION)
        .where('walletAddress','==', walletAddress.toLowerCase())
        .limit(50).get();
      const rows = [];
      qs.forEach(doc => {
        const d = doc.data();
        if (status !== 'all' && d.status !== status) return;
        rows.push({ id: d.scheduleId, token: d.token, amount: d.amount, recipient: d.recipient, frequency: d.frequency, status: d.status, nextRunAt: d.nextRunAt?.toDate?.()?.toISOString?.() || null });
      });
      return { success: true, count: rows.length, schedules: rows };
    }
  },
  {
    name: 'cancel_recurring_transfer',
    description: 'Cancel a recurring transfer by schedule ID',
    parameters: z.object({ scheduleId: z.string() }),
    tags: ['transfer', 'schedule', 'a2a', 'agent'],
    handler: async (params) => {
      const { scheduleId } = params;
      const ref = db.collection(TRANSFER_SCHEDULE_COLLECTION).doc(scheduleId);
      const doc = await ref.get();
      if (!doc.exists) return { success: false, error: 'Schedule not found' };
      await ref.update({ status: 'cancelled', cancelledAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp() });
      return { success: true, scheduleId };
    }
  }
];
