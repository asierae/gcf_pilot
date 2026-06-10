const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const multer = require('multer');
const nodemailer = require('nodemailer');
const cloudinary = require('cloudinary').v2;

const app = express();
const PORT = process.env.EMAIL_SERVER_PORT || 3001;
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 }
});

const GMAIL_USER = process.env.GMAIL_USER || 'crisprcasx2@gmail.com';
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || 'dryinrcbv';
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_UPLOAD_FOLDER = process.env.CLOUDINARY_UPLOAD_FOLDER || 'gcf-applicants';

if (process.env.CLOUDINARY_URL) {
  cloudinary.config({ secure: true });
} else {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET
  });
}

app.use(cors({ origin: true }));
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    configured: Boolean(GMAIL_APP_PASSWORD),
    sender: GMAIL_USER,
    cloudinary: Boolean(CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET)
  });
});

app.post('/api/upload', upload.single('file'), (req, res) => {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(503).json({
      error: 'Cloudinary not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env'
    });
  }

  if (!req.file) {
    return res.status(400).json({ error: 'No file provided' });
  }

  const resourceType = getCloudinaryResourceType(req.file);

  const stream = cloudinary.uploader.upload_stream(
    {
      folder: CLOUDINARY_UPLOAD_FOLDER,
      resource_type: resourceType,
      type: 'upload',
      access_mode: 'public'
    },
    (error, result) => {
      if (error || !result) {
        console.error('Cloudinary upload failed:', error);
        return res.status(500).json({
          error: 'Failed to upload file to Cloudinary',
          details: error?.message || 'Unknown error'
        });
      }

      const url = buildDeliveryUrl(result);

      res.json({
        ok: true,
        url,
        publicId: result.public_id,
        resourceType: result.resource_type
      });
    }
  );

  stream.end(req.file.buffer);
});

app.delete('/api/upload', async (req, res) => {
  if (!CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    return res.status(503).json({
      error: 'Cloudinary not configured. Set CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in server/.env'
    });
  }

  const { publicId, resourceType } = req.body;

  if (!publicId) {
    return res.status(400).json({ error: 'Missing publicId' });
  }

  try {
    const result = await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType || 'image',
      invalidate: true
    });

    res.json({ ok: true, result });
  } catch (error) {
    console.error('Cloudinary delete failed:', error);
    res.status(500).json({
      error: 'Failed to delete file from Cloudinary',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
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

function buildDeliveryUrl(result) {
  return cloudinary.url(result.public_id, {
    resource_type: result.resource_type,
    type: 'upload',
    secure: true,
    version: result.version
  });
}

function getCloudinaryResourceType(file) {
  const mime = file.mimetype || '';
  const name = (file.originalname || '').toLowerCase();

  if (mime.startsWith('image/')) {
    return 'image';
  }

  if (mime.startsWith('video/')) {
    return 'video';
  }

  if (mime.startsWith('audio/')) {
    return 'video';
  }

  const rawExtensions = [
    '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx',
    '.zip', '.txt', '.csv', '.rtf', '.odt', '.ods'
  ];

  if (rawExtensions.some((ext) => name.endsWith(ext))) {
    return 'raw';
  }

  return 'raw';
}

app.listen(PORT, () => {
  console.log(`Email server running on http://localhost:${PORT}`);
  console.log(`Sender: ${GMAIL_USER}`);
  console.log(`Gmail configured: ${GMAIL_APP_PASSWORD ? 'yes' : 'no — set GMAIL_APP_PASSWORD in server/.env'}`);
  console.log(`Cloudinary configured: ${CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET ? 'yes' : 'no — set Cloudinary keys in server/.env'}`);
});
