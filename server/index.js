const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const app = express();
const PORT = process.env.EMAIL_SERVER_PORT || 3001;

const GMAIL_USER = process.env.GMAIL_USER || 'crisprcasx2@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;

app.use(require('cors')({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(GMAIL_APP_PASSWORD),
    sender: GMAIL_USER
  });
});

app.post('/api/send-review-email', async (req, res) => {
  if (!GMAIL_APP_PASSWORD) {
    return res.status(503).json({
      error: 'Gmail not configured. Set GMAIL_APP_PASSWORD in server/.env (see .env.example).'
    });
  }

  const { to, subject, body } = req.body;

  if (!to || !subject || !body) {
    return res.status(400).json({ error: 'Missing to, subject or body' });
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: GMAIL_USER,
        pass: GMAIL_APP_PASSWORD
      }
    });

    await transporter.sendMail({
      from: `"GCF Accreditation Team" <${GMAIL_USER}>`,
      to,
      subject,
      text: body
    });

    res.json({ ok: true, from: GMAIL_USER, to });
  } catch (error) {
    console.error('Email send failed:', error);
    res.status(500).json({
      error: 'Failed to send email',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`);
  console.log(`Sender: ${GMAIL_USER}`);
  console.log(`Gmail configured: ${GMAIL_APP_PASSWORD ? 'yes' : 'no — set GMAIL_APP_PASSWORD in server/.env'}`);
});
