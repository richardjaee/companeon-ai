/**
 * autonomous-agents.js - Unified A2A Agent Management Tools
 *
 * Provides tools across autonomous agents:
 * - list_all_scheduled: List all scheduled tasks (transfers + DCA)
 * - trigger_scheduled_now: Execute scheduled transfers or DCA swaps
 *   immediately using the Agent key and chained delegation context
 */

import { z } from 'zod';
import { ethers } from 'ethers';
import admin from 'firebase-admin';
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getSubDelegation } from '../../lib/subDelegation.js';
import { getRpcUrl, getChainConfig } from '../../lib/chainConfig.js';
import { resolveTokenAddress, fetch0xQuote } from './aggregator.js';

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = getFirestore();

const DCA_COLLECTION = 'DCASchedules';
const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';
const REBALANCING_COLLECTION = 'RebalancingSchedules';

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

/**
 * Execute a transfer schedule via delegation.
 */
async function executeTransfer(schedule, subDel, agentWallet, logger) {
  const chainId = schedule.chainId || subDel.chainId || 11155111;
  const rpcUrl = getRpcUrl(chainId);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = agentWallet.connect(provider);

  const isNative = !schedule.token || schedule.token.toUpperCase() === 'ETH';
  let execution;

  if (isNative) {
    const valueWei = ethers.parseEther(schedule.amount);
    execution = encodeExecution(schedule.recipient, valueWei, '0x');
  } else {
    const config = getChainConfig(chainId);
    const tokenAddress = config.tokens[schedule.token.toUpperCase()];
    if (!tokenAddress) throw new Error(`Token ${schedule.token} not found on chain ${chainId}`);

    const iface = new ethers.Interface(['function transfer(address to, uint256 amount)']);
    const decimals = schedule.token.toUpperCase() === 'USDC' || schedule.token.toUpperCase() === 'USDT' ? 6 : 18;
    const amountUnits = ethers.parseUnits(schedule.amount, decimals);
    const calldata = iface.encodeFunctionData('transfer', [schedule.recipient, amountUnits]);
    execution = encodeExecution(tokenAddress, 0n, calldata);
  }

  const delegationManager = new ethers.Contract(
    subDel.delegationManager,
    DELEGATION_MANAGER_ABI,
    wallet
  );

  const tx = await delegationManager.redeemDelegations(
    [subDel.chainedPermissionsContext],
    [EXECUTION_MODE_SINGLE],
    [execution]
  );

  logger?.info?.('trigger_tx_sent', { txHash: tx.hash });
  const receipt = await tx.wait();
  return { txHash: tx.hash, gasUsed: receipt.gasUsed.toString(), chainId };
}

/**
 * Execute a DCA swap schedule via delegation + 0x.
 */
async function executeDCASwap(schedule, subDel, agentWallet, walletAddress, logger) {
  const chainId = schedule.chainId || subDel.chainId || 8453;
  const rpcUrl = getRpcUrl(chainId);
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = agentWallet.connect(provider);

  const fromResolved = await resolveTokenAddress(schedule.fromToken, chainId);
  const toResolved = await resolveTokenAddress(schedule.toToken, chainId);
  const fromDecimals = fromResolved.decimals || 18;
  const sellAmountWei = ethers.parseUnits(schedule.amount, fromDecimals).toString();

  const delegationManager = new ethers.Contract(
    subDel.delegationManager,
    DELEGATION_MANAGER_ABI,
    wallet
  );

  // Fetch 0x quote with user's wallet as taker
  let quote = await fetch0xQuote(
    chainId,
    fromResolved.address,
    toResolved.address,
    sellAmountWei,
    walletAddress,
    schedule.slippageBps || 100
  );

  // Handle ERC-20 approval if needed
  const isNative = schedule.fromToken.toUpperCase() === 'ETH';
  if (!isNative && quote.issues?.allowance) {
    logger?.info?.('trigger_dca_approving', { token: schedule.fromToken, spender: quote.issues.allowance.spender });

    const iface = new ethers.Interface(['function approve(address spender, uint256 amount)']);
    const approveData = iface.encodeFunctionData('approve', [
      quote.issues.allowance.spender,
      ethers.MaxUint256
    ]);
    const approveExecution = encodeExecution(fromResolved.address, 0n, approveData);

    const approveTx = await delegationManager.redeemDelegations(
      [subDel.chainedPermissionsContext],
      [EXECUTION_MODE_SINGLE],
      [approveExecution]
    );
    await approveTx.wait();
    logger?.info?.('trigger_dca_approved', { txHash: approveTx.hash });

    // Re-fetch quote with fresh pricing
    quote = await fetch0xQuote(
      chainId,
      fromResolved.address,
      toResolved.address,
      sellAmountWei,
      walletAddress,
      schedule.slippageBps || 100
    );
  }

  // Execute swap
  const swapExecution = encodeExecution(
    quote.transaction.to,
    BigInt(quote.transaction.value || 0),
    quote.transaction.data
  );

  const tx = await delegationManager.redeemDelegations(
    [subDel.chainedPermissionsContext],
    [EXECUTION_MODE_SINGLE],
    [swapExecution]
  );

  logger?.info?.('trigger_tx_sent', { txHash: tx.hash });
  const receipt = await tx.wait();
  return { txHash: tx.hash, gasUsed: receipt.gasUsed.toString(), chainId };
}

export const autonomousAgentTools = [
  {
    name: 'list_all_scheduled',
    description: 'List all scheduled tasks (transfers, DCA, rebalancing) for this wallet',
    parameters: z.object({ includeCompleted: z.boolean().optional() }),
    tags: ['transfer','dca','rebalancing','schedule','a2a','agent','list'],
    handler: async (params, context) => {
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      if (!walletAddress) throw new Error('Wallet address required');
      const lower = walletAddress.toLowerCase();
      const transfersSnap = await db.collection(TRANSFER_SCHEDULE_COLLECTION).where('walletAddress','==', lower).limit(50).get();
      const dcaSnap = await db.collection(DCA_COLLECTION).where('walletAddress','==', lower).limit(50).get();
      const rebalancingSnap = await db.collection(REBALANCING_COLLECTION).where('walletAddress','==', lower).limit(50).get();
      const transfers = transfersSnap.docs.map(d=>d.data());
      const dcas = dcaSnap.docs.map(d=>d.data());
      const rebalancings = rebalancingSnap.docs.map(d=>d.data());
      const lines = [];
      transfers.forEach((t,i)=>lines.push(`${i+1}. Transfer: ${t.amount} ${t.token} -> ${t.recipientENS || t.recipient} (${t.frequency}) - ${t.status}`));
      dcas.forEach((d,i)=>lines.push(`${i+1}. DCA: ${d.fromToken} -> ${d.toToken} ${d.amount} (${d.frequency}) - ${d.status}`));
      rebalancings.forEach((r,i)=>{
        const allocs = Object.entries(r.targetAllocations || {}).map(([tok, pct]) => `${pct}% ${tok}`).join(' / ');
        lines.push(`${i+1}. Rebalancing: ${allocs} (${r.frequency}) - ${r.status}`);
      });
      return { success: true, transfers: transfers.length, dcas: dcas.length, rebalancings: rebalancings.length, showToUser: lines.length ? lines.join('\n') : 'No scheduled tasks found.' };
    }
  },
  {
    name: 'trigger_scheduled_now',
    description: 'Execute active scheduled tasks (transfers, DCA swaps, or rebalancing) immediately using Agent-to-Agent delegation.',
    parameters: z.object({
      scheduleId: z.string().optional().describe('Specific schedule ID to execute. If omitted, executes all active schedules for this wallet.')
    }),
    tags: ['transfer','dca','rebalancing','schedule','a2a','agent','trigger'],
    handler: async (params, context) => {
      const walletAddress = context?.walletAddress || context?.memoryFacts?.walletAddress;
      const logger = context?.logger;
      if (!walletAddress) throw new Error('Wallet address required');

      const agentKey = process.env.BACKEND_SUBDELEGATION_KEY;
      if (!agentKey) return { success: false, error: 'BACKEND_SUBDELEGATION_KEY not configured' };

      const lower = walletAddress.toLowerCase();
      const agentWallet = new ethers.Wallet(agentKey);

      // Collect schedules from both collections
      let schedules = [];

      if (params.scheduleId) {
        // Look up by ID - try transfers first, then DCA, then rebalancing
        const transferDoc = await db.collection(TRANSFER_SCHEDULE_COLLECTION).doc(params.scheduleId).get();
        if (transferDoc.exists) {
          const data = transferDoc.data();
          if (data.walletAddress !== lower) return { success: false, error: 'Schedule belongs to a different wallet' };
          if (data.status !== 'active') return { success: false, error: `Schedule is ${data.status}, not active` };
          schedules.push({ ref: transferDoc.ref, data, type: 'transfer' });
        } else {
          const dcaDoc = await db.collection(DCA_COLLECTION).doc(params.scheduleId).get();
          if (dcaDoc.exists) {
            const data = dcaDoc.data();
            if (data.walletAddress !== lower) return { success: false, error: 'Schedule belongs to a different wallet' };
            if (data.status !== 'active') return { success: false, error: `Schedule is ${data.status}, not active` };
            schedules.push({ ref: dcaDoc.ref, data, type: 'dca' });
          } else {
            const rebalDoc = await db.collection(REBALANCING_COLLECTION).doc(params.scheduleId).get();
            if (!rebalDoc.exists) return { success: false, error: `Schedule ${params.scheduleId} not found` };
            const data = rebalDoc.data();
            if (data.walletAddress !== lower) return { success: false, error: 'Schedule belongs to a different wallet' };
            if (data.status !== 'active') return { success: false, error: `Schedule is ${data.status}, not active` };
            schedules.push({ ref: rebalDoc.ref, data, type: 'rebalancing' });
          }
        }
      } else {
        // Get all active schedules from all collections
        const transferSnap = await db.collection(TRANSFER_SCHEDULE_COLLECTION)
          .where('walletAddress', '==', lower)
          .where('status', '==', 'active')
          .limit(10)
          .get();
        transferSnap.forEach(doc => schedules.push({ ref: doc.ref, data: doc.data(), type: 'transfer' }));

        const dcaSnap = await db.collection(DCA_COLLECTION)
          .where('walletAddress', '==', lower)
          .where('status', '==', 'active')
          .limit(10)
          .get();
        dcaSnap.forEach(doc => schedules.push({ ref: doc.ref, data: doc.data(), type: 'dca' }));

        const rebalSnap = await db.collection(REBALANCING_COLLECTION)
          .where('walletAddress', '==', lower)
          .where('status', '==', 'active')
          .limit(10)
          .get();
        rebalSnap.forEach(doc => schedules.push({ ref: doc.ref, data: doc.data(), type: 'rebalancing' }));
      }

      if (schedules.length === 0) {
        return { success: true, processed: 0, showToUser: 'No active schedules to execute.' };
      }

      const results = [];

      for (const { ref, data: schedule, type } of schedules) {
        const sid = schedule.scheduleId;
        logger?.info?.('trigger_executing_schedule', { scheduleId: sid, type });

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

          // Execute based on type
          let result;
          if (type === 'rebalancing') {
            // Rebalancing requires multiple sub-delegations and price checks -
            // not suitable for the simple trigger flow. Log and skip.
            logger?.info?.('trigger_rebalancing_not_supported', { scheduleId: sid });
            results.push({ scheduleId: sid, success: false, reason: 'Use POST /jobs/rebalancing to trigger rebalancing schedules' });
            await ref.update({ status: 'active', updatedAt: FieldValue.serverTimestamp() });
            continue;
          } else if (type === 'dca') {
            logger?.info?.('trigger_dca_swap', { scheduleId: sid, from: schedule.fromToken, to: schedule.toToken });
            result = await executeDCASwap(schedule, subDel, agentWallet, lower, logger);
          } else {
            result = await executeTransfer(schedule, subDel, agentWallet, logger);
          }

          logger?.info?.('trigger_tx_confirmed', { scheduleId: sid, txHash: result.txHash, gasUsed: result.gasUsed });

          // Update schedule state
          const newCount = (schedule.executionCount || 0) + 1;
          const shouldComplete = schedule.maxExecutions && newCount >= schedule.maxExecutions;
          const nextRun = calculateNextRun(schedule.frequency);

          const executionRecord = {
            success: true,
            txHash: result.txHash,
            executedAt: new Date().toISOString(),
            gasUsed: result.gasUsed,
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

          const config = getChainConfig(result.chainId);
          results.push({
            scheduleId: sid,
            success: true,
            type,
            txHash: result.txHash,
            explorerUrl: `${config.explorer}/tx/${result.txHash}`,
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
        const label = r.type === 'dca' ? 'DCA Swap' : r.type === 'rebalancing' ? 'Rebalancing' : 'Transfer';
        showToUser += `- **${r.scheduleId}** (${label}): Executed (run #${r.executionNumber})\n`;
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
