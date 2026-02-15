/**
 * rebalancing-agent.js - Portfolio Rebalancing Agent Tools
 *
 * Implements recurring portfolio rebalancing using sub-delegation.
 * The worker periodically checks token allocations and executes
 * swaps to maintain target percentages (e.g., "60% ETH / 40% USDC").
 */

import { z } from 'zod';
import admin from 'firebase-admin';
import { getFirestore, Timestamp, FieldValue } from 'firebase-admin/firestore';
import { ethers } from 'ethers';
import { createSubDelegation, storeSubDelegation } from '../../lib/subDelegation.js';
import { getDelegationDataForWallet } from '../../lib/delegationSigner.js';
import { resolveTokenAddress } from './aggregator.js';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const REBALANCING_COLLECTION = 'RebalancingSchedules';

function getAgentAddress() {
  const key = process.env.BACKEND_SUBDELEGATION_KEY;
  if (!key) throw new Error('BACKEND_SUBDELEGATION_KEY not configured');
  return new ethers.Wallet(key).address;
}

function calculateNextRun(frequency, options = {}) {
  const now = new Date();
  const { scheduledTime, timezone } = options;

  if (!scheduledTime || frequency === 'test') {
    switch (frequency) {
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
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'test': return 'Every 2 minutes (test)';
    default: return freq;
  }
}

const tokenAllocationSchema = z.object({
  symbol: z.string().describe('Token symbol (e.g., "ETH", "USDC")'),
  targetPercent: z.number().min(1).max(99).describe('Target allocation percentage')
});

export const rebalancingAgentTools = [
  {
    name: 'preview_rebalancing_schedule',
    description: 'Preview a portfolio rebalancing schedule before creating it. Shows target allocations, threshold, and frequency, then asks for confirmation.',
    parameters: z.object({
      tokens: z.array(tokenAllocationSchema).min(2).max(5)
        .describe('Target token allocations - must sum to 100%'),
      frequency: z.enum(['daily', 'weekly', 'test']),
      scheduledTime: z.string().optional()
        .describe('Time of day in HH:MM 24h format (e.g., "14:30" for 2:30 PM). If omitted, runs at interval from creation time.'),
      timezone: z.string().optional()
        .describe('IANA timezone for scheduledTime (e.g., "America/New_York", "Europe/London"). Required when scheduledTime is set.'),
      thresholdPercent: z.number().optional()
        .describe('Minimum deviation (%) before rebalancing. Default: 5'),
      slippageBps: z.number().optional()
        .describe('Slippage tolerance in basis points. Default: 100 (1%)'),
      expiresIn: z.string().optional()
        .describe('Duration (e.g., "30d", "90d")'),
      maxExecutions: z.number().optional()
    }),
    tags: ['rebalancing', 'schedule', 'a2a', 'agent', 'preview'],
    handler: async (params, context) => {
      const { tokens, frequency, scheduledTime, timezone, thresholdPercent = 5, slippageBps = 100, expiresIn, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');

      // Validate allocations sum to 100
      const totalPercent = tokens.reduce((sum, t) => sum + t.targetPercent, 0);
      if (totalPercent !== 100) {
        throw new Error(`Target allocations must sum to 100%, got ${totalPercent}%`);
      }

      // Validate all tokens are resolvable
      const chainId = context?.chainId || context?.memoryFacts?.chainId || 8453;
      for (const t of tokens) {
        const resolved = await resolveTokenAddress(t.symbol, chainId);
        if (!resolved?.address) {
          throw new Error(`Could not resolve token: ${t.symbol}`);
        }
      }

      const nextRun = calculateNextRun(frequency, { scheduledTime, timezone });
      const durationSec = parseDuration(expiresIn);

      const freqDisplay = scheduledTime && frequency !== 'test'
        ? `${formatFrequency(frequency)} at ${scheduledTime}${timezone ? ` (${timezone})` : ''}`
        : formatFrequency(frequency);

      const firstRunDisplay = timezone
        ? nextRun.toLocaleString('en-US', { timeZone: timezone })
        : nextRun.toLocaleString();

      const allocationsTable = tokens
        .map(t => `| ${t.symbol.toUpperCase()} | ${t.targetPercent}% |`)
        .join('\n');

      return {
        ask: true,
        preview: {
          tokens: tokens.map(t => ({ symbol: t.symbol.toUpperCase(), targetPercent: t.targetPercent })),
          frequency: freqDisplay,
          thresholdPercent,
          slippageBps,
          expiresIn: durationSec ? formatDuration(durationSec) : 'Inherits parent delegation',
          firstExecution: firstRunDisplay,
          maxExecutions: maxExecutions || 'unlimited'
        },
        showToUser: `**Portfolio Rebalancing Preview**

| Token | Target |
|-------|--------|
${allocationsTable}

| Field | Value |
|-------|-------|
| Frequency | ${freqDisplay} |
| Threshold | ${thresholdPercent}% deviation before rebalancing |
| Expires | ${durationSec ? formatDuration(durationSec) : 'Inherits parent delegation'} |
| First Check | ${firstRunDisplay} |
| Max Runs | ${maxExecutions || 'Unlimited'} |
| Slippage | ${slippageBps / 100}% |

This will create sub-delegations for each portfolio token, allowing the rebalancing agent to swap between them when allocations drift beyond the ${thresholdPercent}% threshold. Swaps execute via 0x aggregator for best pricing.

**Confirm to create?**`
      };
    }
  },
  {
    name: 'schedule_rebalancing',
    description: 'Create a portfolio rebalancing schedule after user confirmation. Sets up sub-delegations for each token and starts the schedule.',
    parameters: z.object({
      tokens: z.array(tokenAllocationSchema).min(2).max(5),
      frequency: z.enum(['daily', 'weekly', 'test']),
      scheduledTime: z.string().optional(),
      timezone: z.string().optional(),
      thresholdPercent: z.number().optional(),
      slippageBps: z.number().optional(),
      expiresIn: z.string().optional(),
      name: z.string().optional(),
      maxExecutions: z.number().optional()
    }),
    tags: ['rebalancing', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { tokens, frequency, scheduledTime, timezone, thresholdPercent = 5, slippageBps = 100, expiresIn, name, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const chainId = context?.chainId || context?.memoryFacts?.chainId || 8453;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      // Validate allocations sum to 100
      const totalPercent = tokens.reduce((sum, t) => sum + t.targetPercent, 0);
      if (totalPercent !== 100) {
        throw new Error(`Target allocations must sum to 100%, got ${totalPercent}%`);
      }

      const agentAddress = getAgentAddress();
      const delegationData = await getDelegationDataForWallet(walletAddress, logger);

      const durationSec = parseDuration(expiresIn);
      const expiresAtTimestamp = durationSec ? Math.floor(Date.now() / 1000) + durationSec : null;

      const scheduleId = `rebal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const subDelegationTokens = [];

      // Create a sub-delegation for each portfolio token
      for (const t of tokens) {
        const symbol = t.symbol.toUpperCase();
        const isNative = symbol === 'ETH';

        const caveatConfig = {
          token: symbol,
          amount: '0', // Rebalancing doesn't have a fixed amount per period
          frequency,
          expiresAt: expiresAtTimestamp
        };

        // For ERC-20 tokens, find address from delegation scopes
        if (!isNative) {
          const scope = (delegationData.scopes || []).find(s =>
            s.tokenSymbol?.toUpperCase() === symbol
          );
          if (scope?.tokenAddress) {
            caveatConfig.tokenAddress = scope.tokenAddress;
            caveatConfig.decimals = scope.decimals;
          }
        }

        // Select parent permission context
        let parentContext = delegationData.permissionsContext;
        if (!isNative && caveatConfig.tokenAddress) {
          const allContexts = delegationData.allPermissionContexts || {};
          const tokenKey = caveatConfig.tokenAddress.toLowerCase();
          const tokenContext = allContexts[tokenKey] || allContexts[caveatConfig.tokenAddress];
          if (tokenContext) {
            parentContext = tokenContext;
            logger?.info?.('rebalancing_using_erc20_parent_context', { token: symbol });
          }
        }

        try {
          const subDelegationData = await createSubDelegation({
            parentPermissionsContext: parentContext,
            companeonKey: process.env.BACKEND_DELEGATION_KEY,
            dcaAgentAddress: agentAddress,
            limits: { token: symbol, amount: '0' },
            caveatConfig,
            delegationManager: delegationData.delegationManager,
            chainId,
            logger
          });

          // Store sub-delegation keyed as {walletAddress}_{scheduleId}_{tokenSymbol}
          await storeSubDelegation(walletAddress, `${scheduleId}_${symbol}`, {
            ...subDelegationData,
            delegationManager: delegationData.delegationManager,
            chainId,
            agentType: 'rebalancing'
          });

          subDelegationTokens.push(symbol);
          logger?.info?.('rebalancing_sub_delegation_created', { token: symbol, scheduleId });
        } catch (err) {
          logger?.error?.('rebalancing_sub_delegation_failed', { token: symbol, error: err.message });
          throw new Error(`Failed to create sub-delegation for ${symbol}: ${err.message}`);
        }
      }

      // Build target allocations map
      const targetAllocations = {};
      for (const t of tokens) {
        targetAllocations[t.symbol.toUpperCase()] = t.targetPercent;
      }

      const nextRun = calculateNextRun(frequency, { scheduledTime, timezone });
      const schedule = {
        scheduleId,
        type: 'rebalancing',
        name: name || null,
        walletAddress: walletAddress.toLowerCase(),
        chainId,
        targetAllocations,
        thresholdPercent,
        slippageBps,
        frequency,
        scheduledTime: scheduledTime || null,
        timezone: timezone || null,
        status: 'active',
        nextRunAt: Timestamp.fromDate(nextRun),
        expiresAt: expiresAtTimestamp || null,
        expiresIn: expiresIn || null,
        executionCount: 0,
        maxExecutions: maxExecutions || null,
        executionHistory: [],
        subDelegationTokens,
        agentAddress,
        hasSubDelegation: subDelegationTokens.length > 0,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
      };

      await db.collection(REBALANCING_COLLECTION).doc(scheduleId).set(schedule);

      const allocationsTable = tokens
        .map(t => `| ${t.symbol.toUpperCase()} | ${t.targetPercent}% |`)
        .join('\n');

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
        hasSubDelegation: subDelegationTokens.length > 0,
        showToUser: `**Rebalancing Schedule Created**

| Token | Target |
|-------|--------|
${allocationsTable}

| Field | Value |
|-------|-------|
| Frequency | ${freqDisplay} |
| Threshold | ${thresholdPercent}% |
| Expires | ${expiresDisplay} |
| First Check | ${timezone ? nextRun.toLocaleString('en-US', { timeZone: timezone }) : nextRun.toLocaleString()} |
| Max Runs | ${maxExecutions || 'Unlimited'} |
| Slippage | ${slippageBps / 100}% |

Sub-delegations created for ${subDelegationTokens.join(', ')}. The agent will check allocations ${freqDisplay.toLowerCase()} and rebalance when any token drifts more than ${thresholdPercent}% from target.`
      };
    }
  },
  {
    name: 'list_rebalancing_schedules',
    description: 'List portfolio rebalancing schedules for this wallet.',
    parameters: z.object({
      status: z.enum(['active', 'paused', 'completed', 'cancelled', 'all']).optional()
    }),
    tags: ['rebalancing', 'schedule', 'a2a', 'agent'],
    handler: async (params, context) => {
      const { status = 'active' } = params || {};
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');

      let query = db.collection(REBALANCING_COLLECTION)
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
          showToUser: `No ${status === 'all' ? '' : status + ' '}rebalancing schedules found.`
        };
      }

      const lines = schedules.map((s, i) => {
        const allocs = Object.entries(s.targetAllocations || {})
          .map(([token, pct]) => `${pct}% ${token}`)
          .join(' / ');
        let line = `${i + 1}. **${s.name || 'Portfolio Rebalance'}** - ${allocs} (${formatFrequency(s.frequency)}) [${s.status}]`;
        if (s.executionCount > 0) line += ` | ${s.executionCount} runs`;
        return line;
      });

      return {
        success: true,
        count: schedules.length,
        schedules,
        showToUser: `**Rebalancing Schedules** (${schedules.length})\n\n${lines.join('\n')}`
      };
    }
  },
  {
    name: 'cancel_rebalancing_schedule',
    description: 'Cancel a portfolio rebalancing schedule.',
    parameters: z.object({
      scheduleId: z.string().describe('The schedule ID to cancel')
    }),
    tags: ['rebalancing', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { scheduleId } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');

      const ref = db.collection(REBALANCING_COLLECTION).doc(scheduleId);
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

      const allocs = Object.entries(schedule.targetAllocations || {})
        .map(([token, pct]) => `${pct}% ${token}`)
        .join(' / ');

      return {
        success: true,
        scheduleId,
        showToUser: `Rebalancing schedule **${schedule.name || scheduleId}** (${allocs}) has been cancelled.`
      };
    }
  }
];
