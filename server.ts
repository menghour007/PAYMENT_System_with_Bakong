import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import { KHQR, CURRENCY, COUNTRY, TAG } from 'ts-khqr';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'transactions.json');

const BAKONG_BASE_URL = (process.env.BAKONG_BASE_URL || 'https://api-bakong.nbc.gov.kh').trim();
const BAKONG_TOKEN = (process.env.BAKONG_TOKEN || '').trim();
const BAKONG_MERCHANT_ID = (process.env.BAKONG_MERCHANT_ID || 'lim_menghour@bkrt').trim();
const BAKONG_MERCHANT_NAME = (process.env.BAKONG_MERCHANT_NAME || 'MENGHOUR LIM')
  .replace(/^"|"$/g, '')
  .trim();
const BAKONG_MERCHANT_CITY = (process.env.BAKONG_MERCHANT_CITY || 'PHNOM PENH')
  .replace(/^"|"$/g, '')
  .trim();
const BAKONG_ACCOUNT_ID = (process.env.BAKONG_ACCOUNT_ID || BAKONG_MERCHANT_ID).trim();
const PAYMENT_TIMEOUT_SECONDS = Number(process.env.PAYMENT_TIMEOUT_SECONDS || 80);

const APP_ICON_URL = (
  process.env.APP_ICON_URL || 'https://bakong.nbc.gov.kh/images/logo.svg'
).trim();
const APP_NAME = (process.env.APP_NAME || 'CS Drone Store').trim();
const APP_DEEPLINK_CALLBACK = (
  process.env.APP_DEEPLINK_CALLBACK || 'https://bakong.nbc.gov.kh/'
).trim();

const TELEGRAM_BOT_TOKEN = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
const TELEGRAM_CHAT_ID = (process.env.TELEGRAM_CHAT_ID || '').trim();

type TransactionStatus = 'PENDING' | 'COMPLETED' | 'EXPIRED';

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
};

type Transaction = {
  id: string;
  status: TransactionStatus;
  amount: string;
  currency: 'USD' | 'KHR';
  description: string;
  createdAt: string;
  md5: string;
  qrString: string;
  deepLink?: string;
  items: OrderItem[];
};

type CustomerPayload = {
  name?: string;
  phone?: string;
  province?: string;
  district?: string;
  addressNote?: string;
  telegramEnabled?: boolean;
  paymentMethod?: string;
  lat?: number | null;
  lng?: number | null;
};

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const db = {
  read(): Transaction[] {
    if (!fs.existsSync(DB_FILE)) return [];
    try {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  },

  write(data: Transaction[]) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  },
};

function normalizeItems(items: any): OrderItem[] {
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => ({
      name: typeof item?.name === 'string' ? item.name.trim() : '',
      price: Number(item?.price),
      quantity: Number(item?.quantity),
    }))
    .filter(
      (item) =>
        item.name &&
        Number.isFinite(item.price) &&
        item.price >= 0 &&
        Number.isFinite(item.quantity) &&
        item.quantity > 0
    );
}

async function generateBakongDeepLink(qrString: string): Promise<string | undefined> {
  if (!BAKONG_TOKEN) {
    console.log('[Bakong Deeplink] Missing BAKONG_TOKEN');
    return undefined;
  }

  try {
    const response = await axios.post(
      `${BAKONG_BASE_URL}/v1/generate_deeplink_by_qr`,
      {
        qr: qrString,
        sourceInfo: {
          appIconUrl: APP_ICON_URL,
          appName: APP_NAME,
          appDeepLinkCallback: APP_DEEPLINK_CALLBACK,
        },
      },
      {
        headers: {
          Authorization: `Bearer ${BAKONG_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 10000,
      }
    );

    console.log('[Bakong Deeplink RAW]:', JSON.stringify(response.data, null, 2));

    if (response.data?.responseCode === 0 && response.data?.data?.shortLink) {
      return response.data.data.shortLink;
    }

    return undefined;
  } catch (error: any) {
    console.error(
      '[Bakong Deeplink ERROR]:',
      error?.response?.data || error?.message || error
    );
    return undefined;
  }
}

async function sendTelegramMessage(payment: Transaction, customer?: CustomerPayload) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log('[Telegram] Missing TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID');
    return;
  }

  const productList =
    payment.items.length > 0
      ? payment.items
          .map(
            (item, index) =>
              `${index + 1}. ${item.name}\n   Qty: ${item.quantity} × $${item.price.toFixed(2)}`
          )
          .join('\n\n')
      : 'No items';

  const mapLink =
    customer?.lat != null && customer?.lng != null
      ? `https://maps.google.com/?q=${customer.lat},${customer.lng}`
      : '';

  const customerInfo = customer
    ? [
        '',
        'Customer:',
        `Name: ${customer.name || '-'}`,
        `Phone: ${customer.phone || '-'}`,
        `Address: ${customer.province || '-'}`,
        `Province: ${customer.district || '-'}`,
        `Note: ${customer.addressNote || '-'}`,
        `Telegram: ${customer.telegramEnabled ? 'Yes' : 'No'}`,
        `Payment: ${customer.paymentMethod || '-'}`,
        mapLink ? `Google Map: ${mapLink}` : 'Google Map: -',
      ].join('\n')
    : '';

  const text = [
    'CS Drone Store - New Order',
    '',
    'Products:',
    productList,
    customerInfo,
    '',
    `Total: ${payment.amount} ${payment.currency}`,
    `Payment ID: ${payment.id}`,
    `Order Ref: ${payment.description}`,
    `Time: ${new Date().toLocaleString()}`,
    '',
    'Payment successful',
  ].join('\n');

  try {
    const tgRes = await axios.post(
      `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
      {
        chat_id: TELEGRAM_CHAT_ID,
        text,
      }
    );

    console.log('[Telegram] Sent successfully:', tgRes.data);
  } catch (error: any) {
    console.error('[Telegram] Failed:', error?.response?.data || error?.message || error);
    throw error;
  }
}

async function startServer() {
  const app = express();

  app.use(express.json());

  app.get('/api/transactions', (_req, res) => {
    const transactions = db.read().sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
    res.json(transactions);
  });

  app.get('/api/reverse-geocode', async (req, res) => {
    try {
      const lat = String(req.query.lat || '');
      const lng = String(req.query.lng || '');

      if (!lat || !lng) {
        return res.status(400).json({ error: 'Missing lat/lng' });
      }

      const response = await axios.get('https://nominatim.openstreetmap.org/reverse', {
        params: {
          format: 'jsonv2',
          lat,
          lon: lng,
        },
        headers: {
          'User-Agent': 'cs-drone-store/1.0',
        },
        timeout: 10000,
      });

      return res.json({
        address: response.data?.display_name || '',
        raw: response.data,
      });
    } catch (error: any) {
      console.error('[Reverse Geocode ERROR]:', error?.message || error);
      return res.status(500).json({ error: 'Failed to reverse geocode' });
    }
  });

  app.post('/api/generate-khqr', async (req, res) => {
    try {
      const rawAmount = Number(req.body?.amount);
      const currencyType: 'USD' | 'KHR' = req.body?.currency === 'KHR' ? 'KHR' : 'USD';

      const description =
        typeof req.body?.description === 'string' && req.body.description.trim()
          ? req.body.description.trim()
          : 'Payment';

      const items = normalizeItems(req.body?.items);

      if (!Number.isFinite(rawAmount) || rawAmount <= 0) {
        return res.status(400).json({ error: 'Invalid amount' });
      }

      const result = KHQR.generate({
        tag: TAG.INDIVIDUAL,
        accountID: BAKONG_ACCOUNT_ID,
        merchantName: BAKONG_MERCHANT_NAME,
        merchantCity: BAKONG_MERCHANT_CITY || 'PHNOM PENH',
        currency: currencyType === 'KHR' ? CURRENCY.KHR : CURRENCY.USD,
        amount:
          currencyType === 'USD'
            ? Number(rawAmount.toFixed(2))
            : Math.round(rawAmount),
        countryCode: COUNTRY.KH,
        merchantCategoryCode: '5999',
        expirationTimestamp: Date.now() + PAYMENT_TIMEOUT_SECONDS * 1000,
        additionalData: {
          billNumber: description,
          purposeOfTransaction: 'Payment',
        },
      });

      if (!result?.data?.qr || !result?.data?.md5) {
        return res.status(500).json({ error: 'Failed to generate valid KHQR payload' });
      }

      const qrString = result.data.qr;
      const md5 = result.data.md5;
      const paymentId = crypto.randomUUID();
      const deepLink = await generateBakongDeepLink(qrString);

      const transactions = db.read();
      transactions.push({
        id: paymentId,
        status: 'PENDING',
        amount:
          currencyType === 'USD'
            ? rawAmount.toFixed(2)
            : Math.round(rawAmount).toString(),
        currency: currencyType,
        description,
        createdAt: new Date().toISOString(),
        md5,
        qrString,
        deepLink,
        items,
      });

      db.write(transactions);

      console.log(`[KHQR] Generated for ${BAKONG_ACCOUNT_ID}: ${paymentId}`);
      return res.json({ qrString, paymentId, deepLink });
    } catch (error) {
      console.error('[API] Error generating KHQR:', error);
      return res.status(500).json({ error: 'Failed to generate KHQR' });
    }
  });

  app.post('/api/notify-telegram', async (req, res) => {
    try {
      console.log('[Telegram] /api/notify-telegram body:', req.body);

      const { paymentId, customer } = req.body;
      const transactions = db.read();
      const payment = transactions.find((t) => t.id === paymentId);

      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      await sendTelegramMessage(payment, customer);
      console.log('[Telegram] Manual trigger sent:', payment.id);

      return res.json({ success: true });
    } catch (error: any) {
      console.error(
        '[Telegram] Manual trigger error:',
        error?.response?.data || error?.message || error
      );
      return res.status(500).json({ error: 'Failed to send telegram' });
    }
  });

  app.get('/api/check-status/:paymentId', async (req, res) => {
    try {
      const { paymentId } = req.params;
      const transactions = db.read();
      const payment = transactions.find((t) => t.id === paymentId);

      if (!payment) {
        return res.status(404).json({ error: 'Payment not found' });
      }

      if (payment.status === 'COMPLETED') {
        return res.json({ status: 'COMPLETED' });
      }

      const elapsedSeconds =
        (Date.now() - new Date(payment.createdAt).getTime()) / 1000;

      if (elapsedSeconds > PAYMENT_TIMEOUT_SECONDS && payment.status === 'PENDING') {
        payment.status = 'EXPIRED';
        db.write(transactions);
        return res.json({ status: 'EXPIRED' });
      }

      if (!BAKONG_TOKEN) {
        console.log('[Bakong] Missing BAKONG_TOKEN, cannot verify payment');
        return res.json({ status: payment.status });
      }

      try {
        const response = await axios.post(
          `${BAKONG_BASE_URL}/v1/check_transaction_by_md5`,
          { md5: payment.md5 },
          {
            headers: {
              Authorization: `Bearer ${BAKONG_TOKEN}`,
              'Content-Type': 'application/json',
            },
            timeout: 5000,
          }
        );

        const data = response.data;
        console.log('[Bakong Check Status RAW]:', JSON.stringify(data, null, 2));

        if (data?.responseCode === 0 && data?.data) {
          payment.status = 'COMPLETED';
          db.write(transactions);
          return res.json({ status: 'COMPLETED' });
        }
      } catch (error: any) {
        console.error(
          '[Bakong API] Error checking transaction:',
          error?.response?.data || error?.message || error
        );
      }

      return res.json({ status: payment.status });
    } catch (error) {
      console.error('[API] Error checking status:', error);
      return res.status(500).json({ error: 'Internal server error' });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Bakong account: ${BAKONG_ACCOUNT_ID}`);
    console.log(`Timeout: ${PAYMENT_TIMEOUT_SECONDS}s`);
    console.log(
      TELEGRAM_BOT_TOKEN && TELEGRAM_CHAT_ID
        ? 'Telegram notifications: enabled'
        : 'Telegram notifications: disabled'
    );
    console.log(
      BAKONG_TOKEN
        ? 'Bakong status/deeplink: enabled'
        : 'Bakong status/deeplink: disabled (missing BAKONG_TOKEN)'
    );
  });
}

startServer();