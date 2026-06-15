import nodemailer from 'nodemailer';

export const sendNotificationEmail = async (
  to: string, 
  subject: string, 
  status: string,
  componentName: string,
  usn: string,
  message?: string
) => {
  try {
    // If credentials are not set, just log and return (prevents crashing in local dev without env vars)
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.warn("EMAIL_USER or EMAIL_APP_PASSWORD not set in environment. Skipping email dispatch.");
      return false;
    }

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_APP_PASSWORD,
      },
    });

    let statusColor = '#3b82f6'; // blue default
    if (status.includes('APPROVED') || status === 'Ready for Collection') statusColor = '#10b981'; // green
    if (status.includes('REJECTED') || status === 'RETURNED DAMAGED') statusColor = '#ef4444'; // red

    const htmlTemplate = `
      <div style="font-family: 'Inter', Helvetica, sans-serif; max-width: 600px; margin: 0 auto; background-color: #09090b; color: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #27272a;">
        <div style="padding: 32px; text-align: center; border-bottom: 1px solid #27272a;">
          <h1 style="margin: 0; font-size: 24px; font-weight: 900; letter-spacing: 2px;">LAB<span style="color: #22d3ee;">NEXUS</span></h1>
          <p style="color: #a1a1aa; margin-top: 8px; font-size: 14px;">Laboratory Requisition System</p>
        </div>
        
        <div style="padding: 32px;">
          <h2 style="font-size: 20px; font-weight: 600; margin-top: 0;">Requisition Update</h2>
          <p style="color: #d4d4d8; line-height: 1.6;">Hello,</p>
          <p style="color: #d4d4d8; line-height: 1.6;">There has been an update regarding your hardware request (USN: <strong>${usn}</strong>).</p>
          
          <div style="background-color: #18181b; border: 1px solid #3f3f46; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <p style="margin: 0 0 12px 0; color: #a1a1aa; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">Requested Item</p>
            <p style="margin: 0 0 24px 0; font-size: 18px; font-weight: bold;">${componentName}</p>
            
            <p style="margin: 0 0 12px 0; color: #a1a1aa; font-size: 14px; text-transform: uppercase; letter-spacing: 1px;">New Status</p>
            <div style="display: inline-block; padding: 8px 16px; background-color: ${statusColor}22; border: 1px solid ${statusColor}55; color: ${statusColor}; border-radius: 8px; font-weight: bold; font-size: 14px; letter-spacing: 1px;">
              ${status}
            </div>
          </div>
          
          ${message ? `<p style="color: #d4d4d8; line-height: 1.6; border-left: 4px solid #22d3ee; padding-left: 16px; font-style: italic;">" ${message} "</p>` : ''}
          
          <p style="color: #d4d4d8; line-height: 1.6; margin-top: 32px;">Please log in to your Student Dashboard for more details or to print your digital pass.</p>
        </div>
        
        <div style="padding: 24px; text-align: center; background-color: #000000; color: #71717a; font-size: 12px;">
          This is an automated message from the LabNexus Inventory System. Please do not reply.
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"LabNexus Admin" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: htmlTemplate,
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Notification email sent successfully:', info.messageId);
    return true;
  } catch (error) {
    console.error('Error sending notification email:', error);
    return false;
  }
};
