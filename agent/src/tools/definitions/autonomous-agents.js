/**
 * autonomous-agents.js - Unified A2A Agent Management Tools
 *
 * Provides tools across autonomous agents:
 * - list_all_scheduled: List all scheduled tasks
 * - trigger_scheduled_now: Execute due scheduled transfers directly using
 *   the Transfer Agent key and chained delegation context
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getSubDelegation } from '../../lib/subDelegation.js';
import { getRpcUrl, getChainConfig } from '../../lib/chainConfig.js';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const DCA_COLLECTION = 'DCASchedules';
const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';

const DELEGATION_MANAGER_ABI = [
  {
    inputs: [
      { name: 'delegations', type: 'bytes[]' },
      { name: 'modes', type: 'bytes32[]' },
      { name: 'executions', type: 'bytes[]' }
    ],
    name: 'redeemDelegations',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function'
  }
];

const EXECUTION_MODE_SINGLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

function encodeExecution(target, value, callData) {
  return ethers.solidityPacked(
    ['address', 'uint256', 'bytes'],
    [target, value, callData || '0x']
  );
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
      transfers.forEach((t,i)=>lines.push(`${i+1}. Transfer: ${t.amount} ${t.token} → ${t.recipientENS || t.recipient} (${t.frequency}) - ${t.status}`));
      dcas.forEach((d,i)=>lines.push(`${i+1}. DCA: ${d.fromToken} → ${d.toToken} ${d.amount} (${d.frequency}) - ${d.status}`));
      return { success: true, transfers: transfers.length, dcas: dcas.length, showToUser: lines.length ? lines.join('\n') : 'No scheduled tasks found.' };
    }
  },
  {
    name: 'trigger_scheduled_now',
    description: 'Execute active recurring transfer schedules immediately using Agent-to-Agent delegation. The Transfer Agent submits the chained delegation on-chain.',
    parameters: z.object({
      scheduleId: z.string().optional().describe('Specific schedule ID to execute. If omitted, executes all due active schedules.')
    }),
    tags: ['transfer','dca','schedule','a2a','agent','trigger'],
    handler: async (params, context) => {
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      const agentKey = process.env.TRANSFER_AGENT_PRIVATE_KEY;
      if (!agentKey) return { success: false, error: 'TRANSFER_AGENT_PRIVATE_KEY not configured' };

      const lower = walletAddress.toLowerCase();

      // Find schedules to execute
      let schedules = [];
      if (params.scheduleId) {
        const doc = await db.collection(TRANSFER_SCHEDULE_COLLECTION).doc(params.scheduleId).get();
        if (!doc.exists) return { success: false, error: `Schedule ${params.scheduleId} not found` };
        const data = doc.data();
        if (data.walletAddress !== lower) return { success: false, error: 'Schedule belongs to a different wallet' };
        if (data.status !== 'active') return { success: false, error: `Schedule is ${data.status}, not active` };
        schedules.push({ ref: doc.ref, data });
      } else {
        const snap = await db.collection(TRANSFER_SCHEDULE_COLLECTION)
          .where('walletAddress', '==', lower)
          .where('status', '==', 'active')
          .limit(10)
          .get();
        snap.forEach(doc => schedules.push({ ref: doc.ref, data: doc.data() }));
      }

      if (schedules.length === 0) {
        return { success: true, processed: 0, showToUser: 'No active schedules to execute.' };
      }

      const results = [];

      for (const { ref, data: schedule } of schedules) {
        const sid = schedule.scheduleId;
        logger?.info?.('trigger_executing_schedule', { scheduleId: sid });

        try {
          // Check max executions
          if (schedule.maxExecutions && schedule.executionCount >= schedule.maxExecutions) {
            await ref.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
            results.push({ scheduleId: sid, success: false, reason: 'Max executions reached, marked completed' });
            continue;
          }

          // Check expiration
          if (schedule.expiresAt && schedule.expiresAt < Math.floor(Date.now() / 1000)) {
            await ref.update({ status: 'completed', updatedAt: FieldValue.serverTimestamp() });
            results.push({ scheduleId: sid, success: false, reason: 'Schedule expired, marked completed' });
            continue;
          }

          // Get sub-delegation with chained context
          const subDel = await getSubDelegation(lower, sid);
          if (!subDel?.chainedPermissionsContext) {
            results.push({ scheduleId: sid, success: false, reason: 'No sub-delegation or chained context found' });
            continue;
          }

          const chainId = schedule.chainId || subDel.chainId || 11155111;
          const rpcUrl = getRpcUrl(chainId);
          const provider = new ethers.JsonRpcProvider(rpcUrl);
          const agentWallet = new ethers.Wallet(agentKey, provider);

          // Build the transfer execution
          const isNative = !schedule.token || schedule.token.toUpperCase() === 'ETH';
          let execution;

          if (isNative) {
            const valueWei = ethers.parseEther(schedule.amount);
            execution = encodeExecution(schedule.recipient, valueWei, '0x');
          } else {
            // ERC-20: encode transfer(address,uint256) call
            const config = getChainConfig(chainId);
            const tokenAddress = config.tokens[schedule.token.toUpperCase()];
            if (!tokenAddress) {
              results.push({ scheduleId: sid, success: false, reason: `Token ${schedule.token} not found on chain ${chainId}` });
              continue;
            }
            const iface = new ethers.Interface(['function transfer(address to, uint256 amount)']);
            const decimals = schedule.token.toUpperCase() === 'USDC' || schedule.token.toUpperCase() === 'USDT' ? 6 : 18;
            const amountUnits = ethers.parseUnits(schedule.amount, decimals);
            const calldata = iface.encodeFunctionData('transfer', [schedule.recipient, amountUnits]);
            execution = encodeExecution(tokenAddress, 0n, calldata);
          }

          // Submit via DelegationManager with chained context
          const delegationManager = new ethers.Contract(
            subDel.delegationManager,
            DELEGATION_MANAGER_ABI,
            agentWallet
          );

          logger?.info?.('trigger_submitting_tx', { scheduleId: sid, agent: agentWallet.address });

          const tx = await delegationManager.redeemDelegations(
            [subDel.chainedPermissionsContext],
            [EXECUTION_MODE_SINGLE],
            [execution]
          );

          logger?.info?.('trigger_tx_sent', { scheduleId: sid, txHash: tx.hash });
          const receipt = await tx.wait();
          logger?.info?.('trigger_tx_confirmed', { scheduleId: sid, txHash: tx.hash, gasUsed: receipt.gasUsed.toString() });

          // Update schedule state
          const newCount = (schedule.executionCount || 0) + 1;
          const shouldComplete = schedule.maxExecutions && newCount >= schedule.maxExecutions;
          const nextRun = calculateNextRun(schedule.frequency);

          const executionRecord = {
            success: true,
            txHash: tx.hash,
            executedAt: new Date().toISOString(),
            gasUsed: receipt.gasUsed.toString(),
            executionNumber: newCount
          };

          await ref.update({
            executionCount: newCount,
            lastExecutionAt: FieldValue.serverTimestamp(),
            lastExecutionResult: executionRecord,
            nextRunAt: shouldComplete ? null : Timestamp.fromDate(nextRun),
            status: shouldComplete ? 'completed' : 'active',
            executionHistory: FieldValue.arrayUnion(executionRecord),
            updatedAt: FieldValue.serverTimestamp()
          });

          const config = getChainConfig(chainId);
          results.push({
            scheduleId: sid,
            success: true,
            txHash: tx.hash,
            explorerUrl: `${config.explorer}/tx/${tx.hash}`,
            executionNumber: newCount,
            nextRun: shouldComplete ? null : nextRun.toISOString()
          });

        } catch (e) {
          logger?.error?.('trigger_execution_failed', { scheduleId: sid, error: e.message });

          const executionRecord = {
            success: false,
            error: e.message,
            executedAt: new Date().toISOString()
          };
          await ref.update({
            lastExecutionResult: executionRecord,
            executionHistory: FieldValue.arrayUnion(executionRecord),
            updatedAt: FieldValue.serverTimestamp()
          }).catch(() => {});

          results.push({ scheduleId: sid, success: false, error: e.message });
        }
      }

      // Build formatted output
      const succeeded = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      let showToUser = `**Execution Results** (${results.length} schedule(s))\n\n`;
      for (const r of succeeded) {
        showToUser += `- **${r.scheduleId}**: Executed (run #${r.executionNumber})\n`;
        showToUser += `  TX: [${r.txHash.slice(0, 10)}...](${r.explorerUrl})\n`;
        if (r.nextRun) showToUser += `  Next run: ${new Date(r.nextRun).toLocaleString()}\n`;
      }
      for (const r of failed) {
        showToUser += `- **${r.scheduleId}**: Failed - ${r.error || r.reason}\n`;
      }

      return {
        success: succeeded.length > 0,
        processed: results.length,
        succeeded: succeeded.length,
        failed: failed.length,
        results,
        showToUser
      };
    }
  }
];

