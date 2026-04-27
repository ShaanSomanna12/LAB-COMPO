const express = require('express');
const { Queue } = require('bullmq');
const Redis = require('ioredis');
require('dotenv').config();

const app = express();
app.use(express.json());

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

// Initialize BullMQ Queue
const escalationQueue = new Queue('escalationAlerts', { connection: redisOptions });

// Basic API to verify the worker is alive
app.get('/health', (req, res) => {
  res.json({ status: 'Worker Service Active', queues: ['escalationAlerts'] });
});

// Mock endpoint to simulate adding a job (called by Next.js in production)
app.post('/jobs/schedule', async (req, res) => {
  try {
    const { reservationId, usn, type, delay } = req.body;
    
    // Add job to queue with specified delay
    await escalationQueue.add(
      type, // 'tier1_reminder', 'tier2_overdue', 'tier3_hod'
      { reservationId, usn },
      { delay: delay || 0 }
    );
    
    res.json({ success: true, message: `Scheduled ${type} for ${reservationId}` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to schedule job' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`Background Worker Service running on port ${PORT}`);
  require('./workers/escalation'); // Initialize workers
});
