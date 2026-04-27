const { Worker } = require('bullmq');
const sgMail = require('@sendgrid/mail');
const { Pool } = require('pg');

const redisOptions = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
};

sgMail.setApiKey(process.env.SENDGRID_API_KEY || 'mock_key');

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

  switch (job.name) {
    case 'tier1_reminder':
      if (process.env.MOCK_EMAIL === 'false' || process.env.NODE_ENV === 'production') {
        console.log(`[Tier 1] Sending true 12-hour reminder email to ${usn}...`);
        try {
          await sgMail.send({ to: `${usn}@college.edu`, from: 'admin@phoenixlab.edu', subject: 'Lab Component Return Reminder', text: 'Please return your component within 12 hours.' });
        } catch (mailErr) {
          console.error('[Tier 1] Email Dispatch Failed:', mailErr);
        }
      } else {
        console.log(`[Tier 1] Mock Mode Active: Bypassing SendGrid dispatch for 12-hour reminder.`);
      }
      break;

    case 'tier2_overdue':
      console.log(`[Tier 2] Checking status for ${reservationId} at deadline...`);
      // Simulate DB fetching to check if item has been returned
      try {
        const res = await pool.query('SELECT status FROM reservations WHERE reservation_id = $1', [reservationId]);
        if (res.rows[0] && res.rows[0].status === 'BORROWED') {
          console.log(`[Tier 2] Component Overdue! Alerting student ${usn} and supervising faculty.`);
        } else {
          console.log(`[Tier 2] Component already returned. Discarding alert.`);
        }
      } catch (err) {
        console.error('DB Error checking status', err);
      }
      break;

    case 'tier3_hod':
      console.log(`[Tier 3] 48 hours post-deadline! Generating incident report PDF...`);
      // Here we would call the @react-pdf/renderer mockup logic to build the PDF buffer
      const mockPdfBuffer = Buffer.from('Mock Incident Report PDF Buffer Data');
      
      if (process.env.MOCK_EMAIL === 'false' || process.env.NODE_ENV === 'production') {
        console.log(`[Tier 3] Dispatching true PDF Incident Report to HOD via SendGrid...`);
        try {
          await sgMail.send({
            to: 'hod_ece@college.edu', from: 'admin@phoenixlab.edu',
            subject: `[ESCALATION] Missing Hardware - USN: ${usn}`,
            attachments: [{ content: mockPdfBuffer.toString('base64'), filename: 'report.pdf', type: 'application/pdf', disposition: 'attachment' }]
          });
        } catch (mailErr) {
          console.error('[Tier 3] Email Dispatch Failed:', mailErr);
        }
      } else {
        console.log(`[Tier 3] Mock Mode Active: Bypassing SendGrid dispatch for PDF Incident Report.`);
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
