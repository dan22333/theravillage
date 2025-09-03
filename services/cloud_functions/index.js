const functions = require('@google-cloud/functions-framework');
const nodemailer = require('nodemailer');

// Configure email transporter (you'll need to set up SMTP credentials)
console.log('EMAIL_USER:', process.env.EMAIL_USER ? 'SET' : 'NOT SET');
console.log('EMAIL_PASSWORD:', process.env.EMAIL_PASSWORD ? 'SET' : 'NOT SET');

const transporter = nodemailer.createTransport({
  service: 'gmail', // or your preferred email service
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

functions.http('sendClientInvitation', async (req, res) => {
  // Enable CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method not allowed');
    return;
  }

  try {
    const { 
      clientEmail, 
      clientName, 
      therapistName, 
      invitationToken, 
      frontendUrl 
    } = req.body;

    if (!clientEmail || !clientName || !therapistName || !invitationToken || !frontendUrl) {
      res.status(400).json({ 
        error: 'Missing required fields: clientEmail, clientName, therapistName, invitationToken, frontendUrl' 
      });
      return;
    }

    const invitationLink = `${frontendUrl}/invite/${invitationToken}`;

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: clientEmail,
      subject: `You've been invited to join TheraVillage by ${therapistName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="margin: 0; font-size: 28px;">TheraVillage</h1>
            <p style="margin: 10px 0 0 0; opacity: 0.9;">Professional Therapy Management</p>
          </div>
          
          <div style="background: white; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #1f2937; margin-top: 0;">Hello ${clientName},</h2>
            
            <p style="color: #4b5563; line-height: 1.6;">
              You've been invited by <strong>${therapistName}</strong> to join TheraVillage, 
              a secure platform for managing your therapy sessions and progress.
            </p>
            
            <p style="color: #4b5563; line-height: 1.6;">
              TheraVillage helps you and your therapist stay connected, track your progress, 
              and manage appointments efficiently.
            </p>
            
            <div style="text-align: center; margin: 30px 0;">
              <a href="${invitationLink}" 
                 style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                        color: white; 
                        padding: 15px 30px; 
                        text-decoration: none; 
                        border-radius: 8px; 
                        font-weight: 600; 
                        display: inline-block;
                        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
                Accept Invitation
              </a>
            </div>
            
            <p style="color: #6b7280; font-size: 14px; margin-top: 30px;">
              This invitation link will expire in 7 days for security reasons. 
              If you have any questions, please contact your therapist.
            </p>
            
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">
            
            <p style="color: #6b7280; font-size: 12px; text-align: center;">
              TheraVillage - Secure Therapy Management Platform<br>
              This email was sent to ${clientEmail}
            </p>
          </div>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);

    res.status(200).json({ 
      success: true, 
      message: 'Invitation email sent successfully' 
    });

  } catch (error) {
    console.error('Error sending invitation email:', error);
    res.status(500).json({ 
      error: 'Failed to send invitation email',
      details: error.message 
    });
  }
});
