const express = require('express');
const router = express.Router();
const sepayController = require('../../controllers/webhooks/sepayController');

/**
 * SePay Webhook Routes
 * Simplified webhook handler for receiving payment notifications from SePay payment gateway
 * No rate limiting or environment configuration required
 */

// Simple middleware to log webhook requests
const logWebhookRequest = (req, res, next) => {
  const timestamp = new Date().toISOString();
  const ip = req.ip || req.connection.remoteAddress;
  const userAgent = req.get('User-Agent') || 'Unknown';

  console.log(`[SePay Webhook] ${timestamp} - ${req.method} ${req.originalUrl} from ${ip}`);
  console.log(`[SePay Webhook] User-Agent: ${userAgent}`);

  next();
};

/**
 * SePay Payment Webhook Endpoint
 * POST /api/hooks/sepay-payment
 *
 * Receives payment notifications from SePay payment gateway
 *
 * Expected payload structure:
 * {
 *   "id": "string",
 *   "gateway": "string",
 *   "transactionDate": "string",
 *   "accountNumber": "string",
 *   "transferAmount": "number",
 *   "transferType": "string", // "in", "out", "pending"
 *   "referenceCode": "string",
 *   "content": "string" // Contains user ID
 * }
 */
router.post('/sepay-payment',
  logWebhookRequest,
  express.json({ limit: '1mb' }),
  sepayController.handlePaymentWebhook
);

/**
 * Health check endpoint for SePay webhook
 * GET /api/hooks/sepay-health
 */
router.get('/sepay-health', (req, res) => {
  const timestamp = new Date().toISOString();

  console.log(`[SePay Webhook] Health check at ${timestamp}`);

  res.status(200).json({
    success: true,
    message: 'SePay webhook endpoint is healthy',
    timestamp,
    service: 'sepay-webhook',
    version: '1.0.0'
  });
});



module.exports = router;
