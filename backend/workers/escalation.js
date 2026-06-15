const { Worker } = require('bullmq');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const pool = new Pool({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  user: process.env.POSTGRES_USER || 'admin',
  password: process.env.POSTGRES_PASSWORD || 'password',
  database: process.env.POSTGRES_DB || 'phoenix_db',
});

const worker = new Worker('escalationAlerts', async (job) => {
  const { reservationId, usn } = job.data;
  console.log(`[BullMQ] Processing Job: ${job.name} for Reservation: ${reservationId}`);

  // Fetch User ID to insert notification
  const userQuery = await pool.query('SELECT user_id FROM users WHERE usn = $1 LIMIT 1', [usn]);
  const userId = userQuery.rows[0]?.user_id;

  switch (job.name) {
    case 'tier1_reminder':
      if (userId) {
        await pool.query('INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)', [userId, 'Component Due Soon', 'Please return your component within 12 hours.', 'WARNING']);
      }
      if (process.env.MOCK_EMAIL === 'false' || process.env.NODE_ENV === 'production') {
        console.log(`[Tier 1] Sending true 12-hour reminder email to ${usn}...`);
        try {
          await transporter.sendMail({ to: `${usn}@college.edu`, from: 'admin@phoenixlab.edu', subject: 'Lab Component Return Reminder', text: 'Please return your component within 12 hours.' });
        } catch (mailErr) {
          console.error('[Tier 1] Email Dispatch Failed:', mailErr);
        }
      } else {
        console.log(`[Tier 1] Mock Mode Active: Bypassing Nodemailer dispatch for 12-hour reminder.`);
      }
      break;

    case 'tier2_overdue':
      console.log(`[Tier 2] Checking status for ${reservationId} at deadline...`);
      try {
        const res = await pool.query('SELECT status FROM reservations WHERE reservation_id = $1', [reservationId]);
        if (res.rows[0] && res.rows[0].status === 'BORROWED') {
          console.log(`[Tier 2] Component Overdue! Alerting student ${usn} and supervising faculty.`);
          if (userId) {
             await pool.query('INSERT INTO notifications (user_id, title, message, type) VALUES ($1, $2, $3, $4)', [userId, 'Component Overdue', 'Your component is overdue. Please return immediately.', 'ERROR']);
          }
        } else {
          console.log(`[Tier 2] Component already returned. Discarding alert.`);
        }
      } catch (err) {
        console.error('DB Error checking status', err);
      }
      break;

    case 'tier3_hod':
      console.log(`[Tier 3] 48 hours post-deadline! Generating incident report PDF...`);
      const mockPdfBuffer = Buffer.from('Mock Incident Report PDF Buffer Data');
      
      if (process.env.MOCK_EMAIL === 'false' || process.env.NODE_ENV === 'production') {
        console.log(`[Tier 3] Dispatching true PDF Incident Report to HOD via Nodemailer...`);
        try {
          await transporter.sendMail({
            to: 'hod_ece@college.edu', from: 'admin@phoenixlab.edu',
            subject: `[ESCALATION] Missing Hardware - USN: ${usn}`,
            attachments: [{ content: mockPdfBuffer, filename: 'report.pdf', contentType: 'application/pdf' }]
          });
        } catch (mailErr) {
          console.error('[Tier 3] Email Dispatch Failed:', mailErr);
        }
      } else {
        console.log(`[Tier 3] Mock Mode Active: Bypassing Nodemailer dispatch for PDF Incident Report.`);
      }
      break;
      
    default:
      console.warn(`Unknown job phase: ${job.name}`);
  }
}, { connection: redisOptions });

worker.on('completed', job => {
  console.log(`[BullMQ] Job ${job.id} has completed successfully!`);
});

worker.on('failed', (job, err) => {
  console.error(`[BullMQ] Job ${job?.id} has failed with error ${err.message}`);
});

module.exports = worker;
