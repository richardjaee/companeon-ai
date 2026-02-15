/**
 * dca-agent.js - DCA (Dollar-Cost Averaging) Agent Tools
 *
 * Implements recurring swap schedules using sub-delegation.
 * The worker executes swaps via 0x API on the configured frequency.
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ethers } from 'ethers';
import { createSubDelegation, storeSubDelegation } from '../../lib/subDelegation.js';
import { getDelegationDataForWallet } from '../../lib/delegationSigner.js';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const DCA_SCHEDULE_COLLECTION = 'DCASchedules';

function getTransferAgentAddress() {
  const key = process.env.BACKEND_SUBDELEGATION_KEY;
  if (!key) throw new Error('BACKEND_SUBDELEGATION_KEY not configured');
  return new ethers.Wallet(key).address;
}

function calculateNextRun(frequency, options = {}) {
  const now = new Date();
  const { scheduledTime, timezone } = options;

  if (!scheduledTime || frequency === 'test') {
    switch (frequency) {
      case 'hourly': return new Date(now.getTime() + 60 * 60 * 1000);
      case 'daily': return new Date(now.getTime() + 24 * 60 * 60 * 1000);
      case 'weekly': return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
      case 'test': return new Date(now.getTime() + 2 * 60 * 1000);
      default: return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    }
  }

  const [hour, minute] = scheduledTime.split(':').map(Number);
  const tz = timezone || 'UTC';

  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    hour: 'numeric', minute: 'numeric',
    hour12: false
  });
  const parts = formatter.formatToParts(now);
  const nowHour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
  const nowMin = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

  const targetMinutes = hour * 60 + minute;
  const currentMinutes = nowHour * 60 + nowMin;
  let minutesUntil = targetMinutes - currentMinutes;

  if (minutesUntil <= 0) {
    switch (frequency) {
      case 'hourly': minutesUntil += 60; break;
      case 'daily': minutesUntil += 24 * 60; break;
      case 'weekly': minutesUntil += 7 * 24 * 60; break;
      default: minutesUntil += 24 * 60; break;
    }
  }

  return new Date(now.getTime() + minutesUntil * 60 * 1000);
}

function parseDuration(durationStr) {
  if (!durationStr) return null;
  const match = durationStr.trim().toLowerCase().match(/^(\d+)\s*(h|d|w|m)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    case 'w': return num * 604800;
    case 'm': return num * 2592000;
    default: return null;
  }
}

function formatDuration(seconds) {
  if (!seconds) return null;
  const days = Math.floor(seconds / 86400);
  if (days >= 30 && days % 30 === 0) return `${days / 30} month(s)`;
  if (days >= 7 && days % 7 === 0) return `${days / 7} week(s)`;
  if (days > 0) return `${days} day(s)`;
  const hours = Math.floor(seconds / 3600);
  return `${hours} hour(s)`;
}

function formatFrequency(freq) {
  switch (freq) {
    case 'hourly': return 'Every hour';
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'test': return 'Every 2 minutes (test)';
    default: return freq;
  }
}

export const dcaAgentTools = [
  {
    name: 'preview_dca_schedule',
    description: 'Preview a DCA (dollar-cost averaging) swap schedule before creating it. Shows what will be set up and asks for confirmation.',
    parameters: z.object({
      fromToken: z.string().describe('Token to sell (e.g., "USDC", "ETH")'),
      toToken: z.string().describe('Token to buy (e.g., "ETH", "WBTC")'),
      amount: z.string().describe('Amount of fromToken per swap'),
      frequency: z.enum(['hourly', 'daily', 'weekly', 'test']),
      scheduledTime: z.string().optional().describe('Time of day in HH:MM 24h format (e.g., "14:30" for 2:30 PM). If omitted, runs at interval from creation time.'),
      timezone: z.string().optional().describe('IANA timezone for scheduledTime (e.g., "America/New_York", "Europe/London"). Required when scheduledTime is set.'),
      expiresIn: z.string().optional().describe('Duration (e.g., "7d", "30d", "2w")'),
      name: z.string().optional(),
      maxExecutions: z.number().optional(),
      slippageBps: z.number().optional().describe('Slippage tolerance in basis points (default: 100 = 1%)')
    }),
    tags: ['dca', 'schedule', 'a2a', 'agent', 'preview'],
    handler: async (params, context) => {
      const { fromToken, toToken, amount, frequency, scheduledTime, timezone, expiresIn, name, maxExecutions, slippageBps } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');

      const nextRun = calculateNextRun(frequency, { scheduledTime, timezone });
      const durationSec = parseDuration(expiresIn);
      const expiresAt = durationSec ? Math.floor(Date.now() / 1000) + durationSec : null;

      const freqDisplay = scheduledTime && frequency !== 'test'
        ? `${formatFrequency(frequency)} at ${scheduledTime}${timezone ? ` (${timezone})` : ''}`
        : formatFrequency(frequency);

      const firstRunDisplay = timezone
        ? nextRun.toLocaleString('en-US', { timeZone: timezone })
        : nextRun.toLocaleString();

      return {
        ask: true,
        preview: {
          fromToken: fromToken.toUpperCase(),
          toToken: toToken.toUpperCase(),
          amount,
          frequency: freqDisplay,
          expiresIn: durationSec ? formatDuration(durationSec) : 'Inherits parent delegation',
          name: name || null,
          firstExecution: firstRunDisplay,
          maxExecutions: maxExecutions || 'unlimited',
          slippageBps: slippageBps || 100
        },
        showToUser: `**DCA Schedule Preview**

| Field | Value |
|-------|-------|
| Sell | ${amount} ${fromToken.toUpperCase()} per swap |
| Buy | ${toToken.toUpperCase()} |
| Frequency | ${freqDisplay} |
| Expires | ${durationSec ? formatDuration(durationSec) : 'Inherits parent delegation'} |
| First Run | ${firstRunDisplay} |
| Max Runs | ${maxExecutions || 'Unlimited'} |
| Slippage | ${(slippageBps || 100) / 100}% |

This will create a sub-delegation scoped to swap ${fromToken.toUpperCase()} for ${toToken.toUpperCase()}. Swaps execute via 0x aggregator for best pricing.

**Confirm to create?**`
      };
    }
  },
  {
    name: 'schedule_dca',
    description: 'Create a recurring DCA swap schedule after user confirmation. Sets up sub-delegation and starts the schedule.',
    parameters: z.object({
      fromToken: z.string(),
      toToken: z.string(),
      amount: z.string(),
      frequency: z.enum(['hourly', 'daily', 'weekly', 'test']),
      scheduledTime: z.string().optional(),
      timezone: z.string().optional(),
      expiresIn: z.string().optional(),
      name: z.string().optional(),
      maxExecutions: z.number().optional(),
      slippageBps: z.number().optional()
    }),
    tags: ['dca', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { fromToken, toToken, amount, frequency, scheduledTime, timezone, expiresIn, name, maxExecutions, slippageBps } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const chainId = context?.chainId || context?.memoryFacts?.chainId || 8453;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      const agentAddress = getTransferAgentAddress();
      const delegationData = await getDelegationDataForWallet(walletAddress, logger);

      const durationSec = parseDuration(expiresIn);
      const expiresAtTimestamp = durationSec ? Math.floor(Date.now() / 1000) + durationSec : null;

      // Build caveat config for the sell token
      const caveatConfig = {
        token: fromToken.toUpperCase(),
        amount,
        frequency,
        expiresAt: expiresAtTimestamp
      };

      // For ERC-20 sell tokens, find address from delegation scopes
      if (fromToken.toUpperCase() !== 'ETH') {
        const scope = (delegationData.scopes || []).find(s =>
          s.tokenSymbol?.toUpperCase() === fromToken.toUpperCase()
        );
        if (scope?.tokenAddress) {
          caveatConfig.tokenAddress = scope.tokenAddress;
          caveatConfig.decimals = scope.decimals;
        }
      }

      // Select parent permission context
      let parentContext = delegationData.permissionsContext;
      if (fromToken.toUpperCase() !== 'ETH' && caveatConfig.tokenAddress) {
        const allContexts = delegationData.allPermissionContexts || {};
        const tokenKey = caveatConfig.tokenAddress.toLowerCase();
        const tokenContext = allContexts[tokenKey] || allContexts[caveatConfig.tokenAddress];
        if (tokenContext) {
          parentContext = tokenContext;
          logger?.info?.('dca_using_erc20_parent_context', { token: fromToken.toUpperCase() });
        }
      }

      // Create sub-delegation
      const subDelegationData = await createSubDelegation({
        parentPermissionsContext: parentContext,
        companeonKey: process.env.BACKEND_DELEGATION_KEY,
        dcaAgentAddress: agentAddress,
        limits: { token: fromToken, amount },
        caveatConfig,
        delegationManager: delegationData.delegationManager,
        chainId,
        logger
      });

      const scheduleId = `dca_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await storeSubDelegation(walletAddress, scheduleId, {
        ...subDelegationData,
        delegationManager: delegationData.delegationManager,
        chainId,
        agentType: 'dca'
      });

      const nextRun = calculateNextRun(frequency, { scheduledTime, timezone });
      const schedule = {
        scheduleId,
        type: 'dca',
        name: name || null,
        walletAddress: walletAddress.toLowerCase(),
        chainId,
        fromToken: fromToken.toUpperCase(),
        toToken: toToken.toUpperCase(),
        amount,
        frequency,
        scheduledTime: scheduledTime || null,
        timezone: timezone || null,
        slippageBps: slippageBps || 100,
        maxExecutions: maxExecutions || null,
        expiresAt: expiresAtTimestamp || null,
        expiresIn: expiresIn || null,
        executionCount: 0,
        status: 'active',
        nextRunAt: Timestamp.fromDate(nextRun),
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        createdBy: 'companeon',
        executedBy: 'dca-agent',
        executionHistory: [],
        hasSubDelegation: !!subDelegationData,
        agentAddress,
        parentDelegationHash: subDelegationData?.parentHash || null
      };
      await db.collection(DCA_SCHEDULE_COLLECTION).doc(scheduleId).set(schedule);

      const expiresDisplay = expiresAtTimestamp
        ? `${formatDuration(durationSec)} (${new Date(expiresAtTimestamp * 1000).toLocaleDateString()})`
        : 'Inherits parent delegation';

      const freqDisplay = scheduledTime && frequency !== 'test'
        ? `${formatFrequency(frequency)} at ${scheduledTime}${timezone ? ` (${timezone})` : ''}`
        : formatFrequency(frequency);

      return {
        success: true,
        scheduleId,
        nextRun: nextRun.toISOString(),
        hasSubDelegation: !!subDelegationData,
        showToUser: `**DCA Schedule Created**

| Field | Value |
|-------|-------|
| Sell | ${amount} ${fromToken.toUpperCase()} per swap |
| Buy | ${toToken.toUpperCase()} |
| Frequency | ${freqDisplay} |
| Expires | ${expiresDisplay} |
| First Run | ${timezone ? nextRun.toLocaleString('en-US', { timeZone: timezone }) : nextRun.toLocaleString()} |
| Max Runs | ${maxExecutions || 'Unlimited'} |
| Slippage | ${(slippageBps || 100) / 100}% |

Sub-delegation scoped to ${amount} ${fromToken.toUpperCase()}/${frequency} for swaps to ${toToken.toUpperCase()}.`
      };
    }
  },
  {
    name: 'list_dca_schedules',
    description: 'List DCA swap schedules for this wallet.',
    parameters: z.object({
      status: z.enum(['active', 'paused', 'completed', 'cancelled', 'all']).optional()
    }),
    tags: ['dca', 'schedule', 'a2a', 'agent'],
    handler: async (params, context) => {
      const { status = 'active' } = params || {};
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');

      let query = db.collection(DCA_SCHEDULE_COLLECTION)
        .where('walletAddress', '==', walletAddress.toLowerCase());

      if (status !== 'all') {
        query = query.where('status', '==', status);
      }

      const snapshot = await query.limit(50).get();
      const schedules = snapshot.docs.map(d => d.data());

      if (schedules.length === 0) {
        return {
          success: true,
          count: 0,
          schedules: [],
          showToUser: `No ${status === 'all' ? '' : status + ' '}DCA schedules found.`
        };
      }

      const lines = schedules.map((s, i) => {
        let line = `${i + 1}. **${s.name || `${s.fromToken} to ${s.toToken}`}** - ${s.amount} ${s.fromToken} -> ${s.toToken} (${formatFrequency(s.frequency)}) [${s.status}]`;
        if (s.executionCount > 0) line += ` | ${s.executionCount} runs`;
        return line;
      });

      return {
        success: true,
        count: schedules.length,
        schedules,
        showToUser: `**DCA Schedules** (${schedules.length})\n\n${lines.join('\n')}`
      };
    }
  },
  {
    name: 'cancel_dca_schedule',
    description: 'Cancel a DCA swap schedule.',
    parameters: z.object({
      scheduleId: z.string().describe('The schedule ID to cancel')
    }),
    tags: ['dca', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { scheduleId } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');

      const ref = db.collection(DCA_SCHEDULE_COLLECTION).doc(scheduleId);
      const doc = await ref.get();

      if (!doc.exists) {
        return { success: false, error: `Schedule ${scheduleId} not found` };
      }

      const schedule = doc.data();
      if (schedule.walletAddress !== walletAddress.toLowerCase()) {
        return { success: false, error: 'Schedule belongs to a different wallet' };
      }

      if (schedule.status === 'cancelled' || schedule.status === 'completed') {
        return { success: false, error: `Schedule is already ${schedule.status}` };
      }

      await ref.update({
        status: 'cancelled',
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      });

      return {
        success: true,
        scheduleId,
        showToUser: `DCA schedule **${schedule.name || scheduleId}** (${schedule.fromToken} -> ${schedule.toToken}) has been cancelled.`
      };
    }
  }
];
