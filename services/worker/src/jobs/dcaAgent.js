/**
 * DCA Agent Job
 *
 * Implements agent-to-agent delegation for autonomous DCA execution.
 * Converted from Firebase Functions to standalone Express worker.
 */

import { ethers } from 'ethers';

const DCA_COLLECTION = 'DCASchedules';
const TRANSFER_SCHEDULE_COLLECTION = 'RecurringTransferSchedules';
const SUBDELEGATION_COLLECTION = 'SubDelegations';

// Agent private keys (must be set in environment)
const DCA_AGENT_KEY = process.env.DCA_AGENT_PRIVATE_KEY;
const TRANSFER_AGENT_KEY = process.env.TRANSFER_AGENT_PRIVATE_KEY;

// RPC endpoints
const RPC_URLS = {
  8453: process.env.BASE_RPC_URL || 'https://base.publicnode.com',
  11155111: process.env.SEPOLIA_RPC_URL || 'https://ethereum-sepolia.publicnode.com',
  1: process.env.MAINNET_RPC_URL || 'https://ethereum.publicnode.com'
};

// DelegationManager ABI
const DELEGATION_MANAGER_ABI = [
  'function redeemDelegations(bytes[] delegations, bytes32[] modes, bytes[] executions) returns (bool)'
];

const EXECUTION_MODE_SINGLE = '0x0000000000000000000000000000000000000000000000000000000000000000';

/**
 * Calculate next run time based on frequency
 */
function calculateNextRun(frequency) {
  const now = new Date();
  switch (frequency) {
    case 'hourly':
      return new Date(now.getTime() + 60 * 60 * 1000);
    case 'daily':
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
    case 'weekly':
      return new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    case 'test':
      return new Date(now.getTime() + 2 * 60 * 1000);
    default:
      return new Date(now.getTime() + 24 * 60 * 60 * 1000);
  }
}

/**
 * Execute swap with chained delegation
 */
async function executeWithChainedDelegation(firestore, schedule, subDelegationData) {
  const { scheduleId, walletAddress, chainId } = schedule;

  console.log(`[DCA Agent] Executing with chained delegation for ${scheduleId}`);

  if (!DCA_AGENT_KEY) {
    throw new Error('DCA_AGENT_PRIVATE_KEY not configured');
  }

  const rpcUrl = RPC_URLS[chainId] || RPC_URLS[8453];
  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const dcaWallet = new ethers.Wallet(DCA_AGENT_KEY, provider);

  console.log(`   DCA Agent Address: ${dcaWallet.address}`);

  const chainedContext = subDelegationData.chainedPermissionsContext;

  if (!chainedContext) {
    throw new Error('No chained permissions context found');
  }

  const delegationManager = new ethers.Contract(
    subDelegationData.delegationManager,
    DELEGATION_MANAGER_ABI,
    dcaWallet
  );

  // Encode execution (placeholder for production swap)
  const execution = ethers.solidityPacked(
    ['address', 'uint256', 'bytes'],
    [walletAddress, 0n, '0x']
  );

  try {
    const tx = await delegationManager.redeemDelegations(
      [chainedContext],
      [EXECUTION_MODE_SINGLE],
      [execution]
    );

    console.log(`   Transaction sent: ${tx.hash}`);
    const receipt = await tx.wait();

    console.log(`[DCA Agent] Execution successful! TX: ${receipt.hash}`);

    return {
      success: true,
      txHash: receipt.hash,
      method: 'chained_delegation',
      dcaAgentAddress: dcaWallet.address
    };

  } catch (error) {
    console.error(`[DCA Agent] Execution failed:`, error.message);
    throw error;
  }
}

/**
 * Execute a single DCA schedule
 */
async function executeDCASchedule(firestore, schedule) {
  const { scheduleId, walletAddress, fromToken, toToken, amount, hasSubDelegation } = schedule;

  console.log(`[DCA Agent] Executing ${scheduleId}: ${amount} ${fromToken} -> ${toToken}`);

  if (!hasSubDelegation) {
    return { success: false, error: 'No sub-delegation configured' };
  }

  if (!DCA_AGENT_KEY) {
    return { success: false, error: 'DCA Agent key not configured' };
  }

  try {
    const subDelDoc = await firestore.collection(SUBDELEGATION_COLLECTION)
      .doc(`${walletAddress.toLowerCase()}_${scheduleId}`)
      .get();

    if (!subDelDoc.exists) {
      return { success: false, error: 'Sub-delegation not found' };
    }

    return await executeWithChainedDelegation(firestore, schedule, subDelDoc.data());

  } catch (error) {
    console.error(`[DCA Agent] Error:`, error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Main DCA Agent job
 * Called by worker scheduler
 */
export async function runDCAAgent(firestore) {
  console.log('[DCA Agent] Starting scheduled run...');

  if (!DCA_AGENT_KEY) {
    console.warn('[DCA Agent] DCA_AGENT_PRIVATE_KEY not set, skipping');
    return { skipped: true, reason: 'No agent key configured' };
  }

  const now = Date.now();
  const results = [];

  try {
    // Get due DCA schedules
    const dueSchedules = await firestore.collection(DCA_COLLECTION)
      .where('status', '==', 'active')
      .where('nextRunAt', '<=', now)
      .limit(10)
      .get();

    console.log(`[DCA Agent] Found ${dueSchedules.size} schedules due`);

    for (const doc of dueSchedules.docs) {
      const schedule = doc.data();
      const result = await executeDCASchedule(firestore, schedule);

      // Update schedule
      const nextRun = calculateNextRun(schedule.frequency);
      const newCount = (schedule.executionCount || 0) + 1;
      const shouldComplete = schedule.maxExecutions && newCount >= schedule.maxExecutions;

      await doc.ref.update({
        executionCount: newCount,
        lastExecutionAt: Date.now(),
        lastExecutionResult: { success: result.success, txHash: result.txHash || null, error: result.error || null },
        nextRunAt: shouldComplete ? null : nextRun.getTime(),
        status: shouldComplete ? 'completed' : 'active',
        updatedAt: Date.now()
      });

      results.push({
        scheduleId: schedule.scheduleId,
        success: result.success,
        txHash: result.txHash
      });
    }

    // Get due transfer schedules
    const dueTransfers = await firestore.collection(TRANSFER_SCHEDULE_COLLECTION)
      .where('status', '==', 'active')
      .where('nextRunAt', '<=', now)
      .limit(10)
      .get();

    console.log(`[Transfer Agent] Found ${dueTransfers.size} transfers due`);

    // Process transfers similarly (simplified for now)
    for (const doc of dueTransfers.docs) {
      const schedule = doc.data();
      // Update schedule timing even if not executing
      const nextRun = calculateNextRun(schedule.frequency);
      await doc.ref.update({
        nextRunAt: nextRun.getTime(),
        updatedAt: Date.now()
      });
    }

    console.log(`[DCA Agent] Completed. Processed ${results.length} schedules`);
    return { success: true, processed: results.length, results };

  } catch (error) {
    console.error('[DCA Agent] Job error:', error);
    throw error;
  }
}
