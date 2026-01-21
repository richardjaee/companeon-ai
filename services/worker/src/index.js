/**
 * Companeon Worker Service
 *
 * Handles background jobs:
 * - Price cache updates (scheduled)
 * - DCA agent execution (scheduled)
 * - Cleanup tasks (scheduled)
 * - Manual trigger endpoints
 */

import express from 'express';
import cron from 'node-cron';
import dotenv from 'dotenv';
import { Firestore } from '@google-cloud/firestore';

// Jobs
import { updatePrices } from './jobs/priceCache.js';
import { runDCAAgent } from './jobs/dcaAgent.js';
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
      priceCache: priceJobStatus,
      dcaAgent: dcaJobStatus,
      cleanup: cleanupJobStatus
    }
  });
});

// ========================================
// Job Status Tracking
// ========================================
let priceJobStatus = { lastRun: null, status: 'idle', nextRun: null };
let dcaJobStatus = { lastRun: null, status: 'idle', nextRun: null };
let cleanupJobStatus = { lastRun: null, status: 'idle', nextRun: null };

// ========================================
// Manual Trigger Endpoints
// ========================================
app.post('/jobs/prices', async (req, res) => {
  try {
    console.log('Manual price update triggered');
    priceJobStatus.status = 'running';
    await updatePrices(firestore);
    priceJobStatus.status = 'idle';
    priceJobStatus.lastRun = new Date().toISOString();
    res.json({ success: true, message: 'Price cache updated' });
  } catch (error) {
    priceJobStatus.status = 'error';
    console.error('Price update error:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

app.post('/jobs/dca', async (req, res) => {
  try {
    console.log('Manual DCA agent triggered');
    dcaJobStatus.status = 'running';
    const result = await runDCAAgent(firestore);
    dcaJobStatus.status = 'idle';
    dcaJobStatus.lastRun = new Date().toISOString();
    res.json({ success: true, ...result });
  } catch (error) {
    dcaJobStatus.status = 'error';
    console.error('DCA agent error:', error);
    res.status(500).json({ error: 'Failed to run DCA agent' });
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

// Update prices every 5 minutes
if (process.env.ENABLE_PRICE_CACHE !== 'false') {
  cron.schedule('*/5 * * * *', async () => {
    console.log('Running scheduled price update...');
    priceJobStatus.status = 'running';
    try {
      await updatePrices(firestore);
      priceJobStatus.status = 'idle';
      priceJobStatus.lastRun = new Date().toISOString();
    } catch (error) {
      priceJobStatus.status = 'error';
      console.error('Scheduled price update error:', error);
    }
  });
  console.log('Price cache job scheduled (every 5 minutes)');
}

// Run DCA agent every hour
if (process.env.ENABLE_DCA_AGENT !== 'false') {
  cron.schedule('0 * * * *', async () => {
    console.log('Running scheduled DCA agent...');
    dcaJobStatus.status = 'running';
    try {
      await runDCAAgent(firestore);
      dcaJobStatus.status = 'idle';
      dcaJobStatus.lastRun = new Date().toISOString();
    } catch (error) {
      dcaJobStatus.status = 'error';
      console.error('Scheduled DCA agent error:', error);
    }
  });
  console.log('DCA agent job scheduled (every hour)');
}

// Cleanup expired auth/sessions every 6 hours
cron.schedule('0 */6 * * *', async () => {
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
console.log('Cleanup job scheduled (every 6 hours)');

// ========================================
// Start Server
// ========================================
app.listen(PORT, () => {
  console.log(`Companeon Worker Service running on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`GCP Project: ${process.env.GOOGLE_CLOUD_PROJECT || '(auto-detect)'}`);
});

export default app;
