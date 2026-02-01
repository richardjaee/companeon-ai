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
import { createSubDelegation, storeSubDelegation, getSubDelegation } from '../../lib/subDelegation.js';
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

/**
 * Parse a human-readable duration string into seconds.
 * Supports: "7d", "30d", "2w", "1h", "24h", "3m" (months)
 * Returns null if unparseable.
 */
function parseDuration(durationStr) {
  if (!durationStr) return null;
  const match = durationStr.trim().toLowerCase().match(/^(\d+)\s*(h|d|w|m)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  switch (match[2]) {
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    case 'w': return num * 604800;
    case 'm': return num * 2592000; // ~30 days
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

/**
 * Resolve ENS name to address via mainnet registry.
 * Returns { address, ensName } or throws on failure.
 */
async function resolveRecipient(recipient, logger) {
  if (recipient.endsWith('.eth')) {
    const mainnetProvider = new ethers.JsonRpcProvider(process.env.ETH_MAINNET_RPC_URL || 'https://eth.llamarpc.com');
    logger?.info?.('resolving_ens', { ensName: recipient });
    const address = await mainnetProvider.resolveName(recipient);
    if (!address) {
      throw new Error(`Could not resolve ENS name: ${recipient}. Make sure the name exists on mainnet.`);
    }
    logger?.info?.('ens_resolved', { ensName: recipient, address });
    return { address: ethers.getAddress(address), ensName: recipient };
  }
  if (!/^0x[a-fA-F0-9]{40}$/.test(recipient)) {
    throw new Error('Valid recipient address (0x...) or ENS name (.eth) is required');
  }
  return { address: ethers.getAddress(recipient), ensName: null };
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
      expiresIn: z.string().optional().describe('Duration for sub-delegation expiry (e.g., "7d", "30d", "2w", "1m"). Defaults to parent delegation expiry.'),
      name: z.string().optional(),
      maxExecutions: z.number().optional()
    }),
    tags: ['transfer', 'schedule', 'a2a', 'agent', 'preview'],
    handler: async (params, context) => {
      const { token, amount, recipient, frequency, expiresIn, name, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      const { address, ensName } = await resolveRecipient(recipient, logger);
      const nextRun = calculateNextRun(frequency);

      const durationSec = parseDuration(expiresIn);
      const expiresAt = durationSec ? Math.floor(Date.now() / 1000) + durationSec : null;

      return {
        ask: true,
        preview: {
          token: token.toUpperCase(), amount,
          recipient: address,
          recipientENS: ensName,
          frequency: formatFrequency(frequency),
          expiresIn: durationSec ? formatDuration(durationSec) : 'Inherits parent delegation',
          expiresAt: expiresAt ? new Date(expiresAt * 1000).toISOString() : null,
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
      expiresIn: z.string().optional().describe('Duration for sub-delegation expiry (e.g., "7d", "30d", "2w", "1m"). Defaults to parent delegation expiry.'),
      name: z.string().optional(),
      maxExecutions: z.number().optional()
    }),
    tags: ['transfer', 'schedule', 'a2a', 'agent', 'write'],
    handler: async (params, context) => {
      const { token, amount, recipient, frequency, expiresIn, name, maxExecutions } = params;
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const chainId = context?.chainId || context?.memoryFacts?.chainId || 8453;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      // Resolve ENS name to address before scheduling
      const { address: resolvedRecipient, ensName } = await resolveRecipient(recipient, logger);

      const transferAgentAddress = getTransferAgentAddress();
      const delegationData = await getDelegationDataForWallet(walletAddress, logger);

      // Parse expiration duration into a unix timestamp
      const durationSec = parseDuration(expiresIn);
      const expiresAtTimestamp = durationSec ? Math.floor(Date.now() / 1000) + durationSec : null;

      // Build caveat config to scope the sub-delegation to this schedule's parameters
      const caveatConfig = {
        token: token.toUpperCase(),
        amount,
        frequency,
        recipient: resolvedRecipient,
        expiresAt: expiresAtTimestamp
      };

      // For ERC-20 tokens, find the token address from parent delegation scopes
      if (token.toUpperCase() !== 'ETH') {
        const scope = (delegationData.scopes || []).find(s =>
          s.tokenSymbol?.toUpperCase() === token.toUpperCase()
        );
        if (scope?.tokenAddress) {
          caveatConfig.tokenAddress = scope.tokenAddress;
          caveatConfig.decimals = scope.decimals;
        }
      }

      // Select the correct parent permission context:
      // Native ETH uses the primary context, ERC-20 uses the token-specific context
      let parentContext = delegationData.permissionsContext;
      if (token.toUpperCase() !== 'ETH' && caveatConfig.tokenAddress) {
        const allContexts = delegationData.allPermissionContexts || {};
        const tokenKey = caveatConfig.tokenAddress.toLowerCase();
        const tokenContext = allContexts[tokenKey] || allContexts[caveatConfig.tokenAddress];
        if (tokenContext) {
          parentContext = tokenContext;
          logger?.info?.('sub_delegation_using_erc20_parent_context', { token: token.toUpperCase(), tokenAddress: caveatConfig.tokenAddress });
        } else {
          logger?.warn?.('sub_delegation_no_erc20_context', { token: token.toUpperCase(), tokenAddress: caveatConfig.tokenAddress, availableContexts: Object.keys(allContexts) });
        }
      }

      // Create sub-delegation with scoped caveats (narrowed from parent permissions)
      const subDelegationData = await createSubDelegation({
        parentPermissionsContext: parentContext,
        companeonKey: process.env.BACKEND_DELEGATION_KEY,
        dcaAgentAddress: transferAgentAddress,
        limits: { token, amount },
        caveatConfig,
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
        recipient: resolvedRecipient,
        recipientENS: ensName,
        frequency,
        maxExecutions: maxExecutions || null,
        expiresAt: expiresAtTimestamp || null,
        expiresIn: expiresIn || null,
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

      const recipientDisplay = ensName ? `${ensName} (${resolvedRecipient.slice(0, 6)}...${resolvedRecipient.slice(-4)})` : resolvedRecipient;
      const expiresDisplay = expiresAtTimestamp
        ? `${formatDuration(durationSec)} (${new Date(expiresAtTimestamp * 1000).toLocaleDateString()})`
        : 'Inherits parent delegation';

      return {
        success: true,
        scheduleId,
        nextRun: nextRun.toISOString(),
        hasSubDelegation: !!subDelegationData,
        hasScopedCaveats: !!(subDelegationData?.caveatConfig),
        transferAgentAddress,
        recipientENS: ensName,
        showToUser: `**Recurring Transfer Confirmed**

| Field       | Value                                      |
|-------------|-------------------------------------------|
| Token       | ${token.toUpperCase()}                     |
| Amount      | ${amount} ${token.toUpperCase()} per transfer |
| Recipient   | ${recipientDisplay}                        |
| Frequency   | ${formatFrequency(frequency)}              |
| Expires     | ${expiresDisplay}                          |
| First Run   | ${nextRun.toLocaleString()}                |
| Max Runs    | ${maxExecutions || 'Unlimited'}            |

Sub-delegation scoped to ${amount} ${token.toUpperCase()}/${frequency} to ${recipientDisplay} only.`
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
      for (const doc of qs.docs) {
        const d = doc.data();
        if (status !== 'all' && d.status !== status) continue;

        const row = {
          id: d.scheduleId,
          token: d.token,
          amount: d.amount,
          recipient: d.recipient,
          frequency: d.frequency,
          status: d.status,
          executionCount: d.executionCount || 0,
          nextRunAt: d.nextRunAt?.toDate?.()?.toISOString?.() || null,
          name: d.name || null
        };

        // Fetch sub-delegation caveat details if available
        if (d.hasSubDelegation && d.scheduleId) {
          try {
            const subDel = await getSubDelegation(walletAddress, d.scheduleId);
            if (subDel?.caveatConfig) {
              row.scopedCaveats = {
                amount: subDel.caveatConfig.amount,
                frequency: subDel.caveatConfig.frequency,
                recipient: subDel.caveatConfig.recipient || null,
                token: subDel.caveatConfig.token,
                hasScopedCaveats: true
              };
            }
          } catch (e) {
            // Sub-delegation lookup is best-effort
          }
        }

        rows.push(row);
      }

      // Build formatted output
      let showToUser = '';
      if (rows.length > 0) {
        showToUser = `**Recurring Transfers** (${rows.length})\n\n`;
        for (const r of rows) {
          const freqLabel = r.frequency === 'daily' ? '/day'
            : r.frequency === 'weekly' ? '/week'
            : r.frequency === 'hourly' ? '/hour'
            : r.frequency === 'test' ? ' (test)'
            : `/${r.frequency}`;
          showToUser += `- **${r.amount} ${r.token}${freqLabel}** to \`${r.recipient}\` [${r.status}]`;
          if (r.scopedCaveats?.hasScopedCaveats) showToUser += ' (scoped)';
          if (r.nextRunAt) showToUser += `\n  Next: ${new Date(r.nextRunAt).toLocaleString()}`;
          if (r.executionCount > 0) showToUser += ` | Runs: ${r.executionCount}`;
          if (r.name) showToUser += ` | Name: ${r.name}`;
          showToUser += '\n';
        }
      } else {
        showToUser = `No ${status === 'all' ? '' : status + ' '}recurring transfers found.`;
      }

      return { success: true, count: rows.length, schedules: rows, showToUser };
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
