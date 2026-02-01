/**
 * Companeon Worker Service
 *
 * Handles background jobs:
 * - Transfer agent execution (every 5 minutes)
 * - Cleanup tasks (every 30 minutes)
 * - Manual trigger endpoints
 */

import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { Firestore } from '@google-cloud/firestore';

// Jobs
import { runTransferAgent } from './jobs/dcaAgent.js';
import { cleanupExpired } from './jobs/cleanup.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

// Initialize Firestore
// Firestore auto-detects project when running in GCP
const firestore = new Firestore({
  projectId: process.env.GOOGLE_CLOUD_PROJECT
});

// Make firestore available
app.locals.firestore = firestore;

app.use(express.json());

// ========================================
// Health Check
// ========================================
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'companeon-worker',
    timestamp: new Date().toISOString(),
    jobs: {
      transferAgent: transferAgentJobStatus,
      cleanup: cleanupJobStatus
    }
  });
});

// ========================================
// Job Status Tracking
// ========================================
let transferAgentJobStatus = { lastRun: null, status: 'idle', nextRun: null };
let cleanupJobStatus = { lastRun: null, status: 'idle', nextRun: null };

// ========================================
// Manual Trigger Endpoints
// ========================================
app.post('/jobs/transfers', async (req, res) => {
  try {
    console.log('Manual transfer agent triggered');
    transferAgentJobStatus.status = 'running';
    const result = await runTransferAgent(firestore);
    transferAgentJobStatus.status = 'idle';
    transferAgentJobStatus.lastRun = new Date().toISOString();
    res.json({ success: true, ...result });
  } catch (error) {
    transferAgentJobStatus.status = 'error';
    console.error('Transfer agent error:', error);
    res.status(500).json({ error: 'Failed to run transfer agent' });
  }
});

// Backwards-compatible alias
app.post('/jobs/dca', async (req, res) => {
  try {
    const result = await runTransferAgent(firestore);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(500).json({ error: 'Failed to run transfer agent' });
  }
});

app.post('/jobs/cleanup', async (req, res) => {
  try {
    console.log('Manual cleanup triggered');
    cleanupJobStatus.status = 'running';
    const result = await cleanupExpired(firestore);
    cleanupJobStatus.status = 'idle';
    cleanupJobStatus.lastRun = new Date().toISOString();
    res.json({ success: true, ...result });
  } catch (error) {
    cleanupJobStatus.status = 'error';
    console.error('Cleanup error:', error);
    res.status(500).json({ error: 'Failed to run cleanup' });
  }
});

// ========================================
// Scheduled Jobs (using node-cron)
// ========================================

// Run transfer agent every 5 minutes
if (process.env.ENABLE_TRANSFER_AGENT !== 'false') {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled transfer agent...');
    transferAgentJobStatus.status = 'running';
    try {
      await runTransferAgent(firestore);
      transferAgentJobStatus.status = 'idle';
      transferAgentJobStatus.lastRun = new Date().toISOString();
    } catch (error) {
      transferAgentJobStatus.status = 'error';
      console.error('Scheduled transfer agent error:', error);
    }
  });
  console.log('Transfer agent job scheduled (every 5 minutes)');
}

// Cleanup expired auth/sessions every 30 minutes (matches session TTL)
cron.schedule('*/30 * * * *', async () => {
  console.log('Running scheduled cleanup...');
  cleanupJobStatus.status = 'running';
  try {
    await cleanupExpired(firestore);
    cleanupJobStatus.status = 'idle';
    cleanupJobStatus.lastRun = new Date().toISOString();
  } catch (error) {
    cleanupJobStatus.status = 'error';
    console.error('Scheduled cleanup error:', error);
  }
});
console.log('Cleanup job scheduled (every 30 minutes)');

// ========================================
// Start Server
// ========================================
app.listen(PORT, () => {
  console.log(`Companeon Worker Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`GCP Project: ${process.env.GOOGLE_CLOUD_PROJECT || '(auto-detect)'}`);
});

export default app;
