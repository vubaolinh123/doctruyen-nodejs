const crypto = require('crypto');
const User = require('../../models/user');
const Transaction = require('../../models/transaction');

/**
 * SePay Webhook Controller
 * Handles payment notifications from SePay payment gateway
 */

/**
 * Process SePay payment webhook
 * POST /api/hooks/sepay-payment
 */
exports.handlePaymentWebhook = async (req, res) => {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();
  
  try {
    console.log(`[SePay Webhook] [${requestId}] Incoming webhook request at ${new Date().toISOString()}`);
    console.log(`[SePay Webhook] [${requestId}] Headers:`, JSON.stringify(req.headers, null, 2));
    console.log(`[SePay Webhook] [${requestId}] Body:`, JSON.stringify(req.body, null, 2));
    console.log(`[SePay Webhook] [${requestId}] IP Address:`, req.ip || req.connection.remoteAddress);

    // Validate request body exists
    if (!req.body || Object.keys(req.body).length === 0) {
      console.error(`[SePay Webhook] [${requestId}] Empty request body`);
      return res.status(400).json({
        success: false,
        message: 'Empty request body',
        requestId
      });
    }

    // Extract webhook data
    const webhookData = req.body;

    // Validate required fields based on actual SePay payload structure
    const requiredFields = ['id', 'transferAmount', 'transferType'];
    const missingFields = requiredFields.filter(field => !webhookData[field]);

    if (missingFields.length > 0) {
      console.error(`[SePay Webhook] [${requestId}] Missing required fields:`, missingFields);
      return res.status(400).json({
        success: false,
        message: `Missing required fields: ${missingFields.join(', ')}`,
        requestId
      });
    }

    // Map SePay payload to internal format
    const mappedData = mapSepayPayload(webhookData, requestId);
    if (!mappedData) {
      console.error(`[SePay Webhook] [${requestId}] Failed to map SePay payload - creating failed transaction record`);

      // Create failed transaction record for unmappable payload
      try {
        const failedDescription = generateFailedDescription(
          parseFloat(webhookData.transferAmount || 0),
          'user_id_extraction_failed'
        );

        await Transaction.create({
          user_id: null,
          transaction_id: webhookData.id || `failed_${Date.now()}`,
          description: failedDescription,
          coin_change: 0,
          type: 'sepay_deposit',
          direction: 'in',
          status: 'failed',
          reference_type: 'payment',
          metadata: {
            payment_method: 'sepay',
            paymentMethod: 'bank_transfer',
            bankCode: webhookData.gateway || 'VietinBank',
            gateway: webhookData.gateway || 'VietinBank',
            vnd_amount: parseFloat(webhookData.transferAmount || 0),
            original_amount: parseFloat(webhookData.transferAmount || 0),
            error_reason: 'user_id_extraction_failed',
            webhook_data: webhookData,
            processed_at: new Date()
          }
        });
      } catch (dbError) {
        console.error(`[SePay Webhook] [${requestId}] Failed to create failed transaction record:`, dbError);
      }

      return res.status(400).json({
        success: false,
        message: 'Invalid payment data format - could not extract user ID',
        requestId
      });
    }

    // Note: Signature verification and IP validation removed for simplified webhook
    // This is a receive-only webhook that processes all incoming SePay notifications

    // Process the payment based on mapped data
    const result = await processPayment(mappedData, requestId);
    
    const processingTime = Date.now() - startTime;
    console.log(`[SePay Webhook] [${requestId}] Processing completed in ${processingTime}ms`);

    // Return success response
    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      requestId,
      processingTime: `${processingTime}ms`,
      data: {
        transactionId: mappedData.transactionId,
        status: result.status,
        processed: true
      }
    });

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[SePay Webhook] [${requestId}] Error processing webhook:`, error);
    console.error(`[SePay Webhook] [${requestId}] Error stack:`, error.stack);

    // Return error response without exposing sensitive information
    return res.status(500).json({
      success: false,
      message: 'Internal server error processing webhook',
      requestId,
      processingTime: `${processingTime}ms`
    });
  }
};

/**
 * Map SePay webhook payload to internal format
 * @param {Object} sepayData - Original SePay webhook payload
 * @param {string} requestId - Request ID for logging
 * @returns {Object|null} - Mapped data or null if mapping fails
 */
function mapSepayPayload(sepayData, requestId) {
  try {
    console.log(`[SePay Webhook] [${requestId}] Mapping SePay payload:`, JSON.stringify(sepayData, null, 2));

    // Extract user ID from payment content or reference code
    const userId = extractUserIdFromPayment(sepayData, requestId);
    if (!userId) {
      console.error(`[SePay Webhook] [${requestId}] Could not extract user ID from payment`);
      return null;
    }

    // Map SePay fields to internal format
    const mappedData = {
      transactionId: sepayData.id,
      amount: parseFloat(sepayData.transferAmount),
      status: mapTransferTypeToStatus(sepayData.transferType),
      userId: userId,
      timestamp: sepayData.transactionDate || new Date().toISOString(),
      metadata: {
        gateway: sepayData.gateway,
        accountNumber: sepayData.accountNumber,
        referenceCode: sepayData.referenceCode,
        content: sepayData.content,
        originalPayload: sepayData
      }
    };

    console.log(`[SePay Webhook] [${requestId}] Mapped data:`, JSON.stringify(mappedData, null, 2));
    return mappedData;

  } catch (error) {
    console.error(`[SePay Webhook] [${requestId}] Error mapping SePay payload:`, error);
    return null;
  }
}

/**
 * Extract user ID from payment content or reference code
 * @param {Object} sepayData - SePay webhook payload
 * @param {string} requestId - Request ID for logging
 * @returns {string|null} - User ID or null if not found
 */
function extractUserIdFromPayment(sepayData, requestId) {
  try {
    console.log(`[SePay Webhook] [${requestId}] Extracting user ID from content: "${sepayData.content}"`);
    console.log(`[SePay Webhook] [${requestId}] Extracting user ID from description: "${sepayData.description}"`);

    // Method 1: Extract from VietinBank SEVQR format in content field
    // Pattern: "SEVQR 6848cd3ac7683de968c64969" (after SEVQR keyword)
    if (sepayData.content) {
      const sevqrMatch = sepayData.content.match(/SEVQR\s+([a-f0-9]{24})/i);
      if (sevqrMatch) {
        console.log(`[SePay Webhook] [${requestId}] Found user ID with SEVQR pattern: ${sevqrMatch[1]}`);
        return sevqrMatch[1];
      }

      // Alternative pattern: Extract any 24-character hex string from content
      const hexMatch = sepayData.content.match(/([a-f0-9]{24})/i);
      if (hexMatch) {
        console.log(`[SePay Webhook] [${requestId}] Found user ID in content: ${hexMatch[1]}`);
        return hexMatch[1];
      }
    }

    // Method 2: Extract from description field (fallback)
    if (sepayData.description) {
      const sevqrMatch = sepayData.description.match(/SEVQR\s+([a-f0-9]{24})/i);
      if (sevqrMatch) {
        console.log(`[SePay Webhook] [${requestId}] Found user ID with SEVQR pattern in description: ${sevqrMatch[1]}`);
        return sevqrMatch[1];
      }

      // Alternative pattern: Extract any 24-character hex string from description
      const hexMatch = sepayData.description.match(/([a-f0-9]{24})/i);
      if (hexMatch) {
        console.log(`[SePay Webhook] [${requestId}] Found user ID in description: ${hexMatch[1]}`);
        return hexMatch[1];
      }
    }

    // Method 3: Extract from reference code
    if (sepayData.referenceCode) {
      const refMatch = sepayData.referenceCode.match(/([a-f0-9]{24})/i);
      if (refMatch) {
        console.log(`[SePay Webhook] [${requestId}] Found user ID in reference code: ${refMatch[1]}`);
        return refMatch[1];
      }
    }

    // Method 4: Check if there's a direct userId field (fallback)
    if (sepayData.userId && sepayData.userId.match(/^[a-f0-9]{24}$/i)) {
      console.log(`[SePay Webhook] [${requestId}] Found direct user ID field: ${sepayData.userId}`);
      return sepayData.userId;
    }

    console.warn(`[SePay Webhook] [${requestId}] Could not extract user ID from payment data`);
    console.warn(`[SePay Webhook] [${requestId}] Content: "${sepayData.content}"`);
    console.warn(`[SePay Webhook] [${requestId}] Description: "${sepayData.description}"`);
    console.warn(`[SePay Webhook] [${requestId}] Reference Code: "${sepayData.referenceCode}"`);
    return null;

  } catch (error) {
    console.error(`[SePay Webhook] [${requestId}] Error extracting user ID:`, error);
    return null;
  }
}

/**
 * Map SePay transfer type to internal status
 * @param {string} transferType - SePay transfer type
 * @returns {string} - Internal status
 */
function mapTransferTypeToStatus(transferType) {
  switch (transferType?.toLowerCase()) {
    case 'in':
      return 'success';
    case 'out':
      return 'failed';
    case 'pending':
      return 'pending';
    default:
      return 'success'; // Default to success for 'in' transfers
  }
}





/**
 * Process payment based on webhook data
 * @param {Object} webhookData - Payment data from SePay
 * @param {string} requestId - Request ID for logging
 * @returns {Object} - Processing result
 */
async function processPayment(webhookData, requestId) {
  try {
    const { transactionId, amount, status, userId, metadata } = webhookData;

    console.log(`[SePay Webhook] [${requestId}] Processing payment:`, {
      transactionId,
      amount,
      status,
      userId,
      gateway: metadata?.gateway
    });

    // Find the user
    const user = await User.findById(userId);
    if (!user) {
      console.error(`[SePay Webhook] [${requestId}] User not found: ${userId}`);

      // Generate Vietnamese description for user not found
      const failedDescription = generateFailedDescription(amount, 'user_not_found');

      // Create failed transaction record for non-existent user
      await Transaction.create({
        user_id: null, // No user reference since user doesn't exist
        transaction_id: transactionId,
        description: failedDescription,
        coin_change: 0,
        type: 'sepay_deposit',
        direction: 'in',
        status: 'failed',
        reference_type: 'payment',
        metadata: {
          payment_method: 'sepay',
          paymentMethod: 'bank_transfer',
          bankCode: metadata?.gateway || 'VietinBank',
          gateway: metadata?.gateway || 'VietinBank',
          vnd_amount: parseFloat(amount),
          original_amount: parseFloat(amount),
          error_reason: 'user_not_found',
          user_id_attempted: userId,
          webhook_data: webhookData,
          processed_at: new Date(),
          ...metadata
        }
      });

      return {
        status: 'failed',
        transactionId,
        message: `User not found: ${userId}`,
        error: 'user_not_found'
      };
    }

    // Process based on payment status
    switch (status.toLowerCase()) {
      case 'success':
      case 'completed':
      case 'paid':
        return await handleSuccessfulPayment(webhookData, user, requestId);
      
      case 'failed':
      case 'error':
      case 'cancelled':
        return await handleFailedPayment(webhookData, user, requestId);
      
      case 'pending':
      case 'processing':
        return await handlePendingPayment(webhookData, user, requestId);
      
      default:
        console.warn(`[SePay Webhook] [${requestId}] Unknown payment status: ${status}`);
        return { status: 'unknown', message: `Unknown payment status: ${status}` };
    }

  } catch (error) {
    console.error(`[SePay Webhook] [${requestId}] Error processing payment:`, error);
    throw error;
  }
}

/**
 * Format VND amount with thousand separators
 * @param {number} amount - Amount in VND
 * @returns {string} - Formatted amount (e.g., "100.000 VNĐ")
 */
function formatVNDAmount(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount) + ' VNĐ';
}

/**
 * Generate Vietnamese description for successful payment
 * @param {number} amount - Payment amount in VND
 * @param {Object} metadata - Payment metadata
 * @returns {string} - Vietnamese description
 */
function generateSuccessDescription(amount, metadata) {
  const formattedAmount = formatVNDAmount(amount);
  const bankCode = metadata?.bankCode || metadata?.gateway || '';

  // Hide SePay branding from user-facing descriptions
  if (bankCode && bankCode !== 'SePay') {
    return `Nạp tiền thành công ${formattedAmount} từ ${bankCode}`;
  } else {
    return `Nạp tiền thành công ${formattedAmount}`;
  }
}

/**
 * Generate Vietnamese description for failed payment
 * @param {number} amount - Payment amount in VND
 * @param {string} reason - Failure reason
 * @returns {string} - Vietnamese description
 */
function generateFailedDescription(amount, reason) {
  const formattedAmount = formatVNDAmount(amount);

  switch (reason) {
    case 'user_not_found':
      return `Nạp tiền thất bại ${formattedAmount} - Không tìm thấy tài khoản`;
    case 'user_id_extraction_failed':
      return `Nạp tiền thất bại ${formattedAmount} - Lỗi xử lý thông tin`;
    default:
      return `Nạp tiền thất bại ${formattedAmount}`;
  }
}

/**
 * Handle successful payment
 */
async function handleSuccessfulPayment(webhookData, user, requestId) {
  try {
    const { transactionId, amount, metadata } = webhookData;
    
    console.log(`[SePay Webhook] [${requestId}] Processing successful payment for user ${user._id}`);

    // Check if transaction already exists to prevent duplicate processing
    const existingTransaction = await Transaction.findOne({
      transaction_id: transactionId
    });

    if (existingTransaction) {
      console.log(`[SePay Webhook] [${requestId}] Transaction already processed: ${transactionId}`);
      return { status: 'already_processed', transactionId };
    }

    // Generate Vietnamese description
    const description = generateSuccessDescription(amount, metadata);

    // Create transaction record with proper Vietnamese description and dedicated type
    await Transaction.create({
      user_id: user._id,
      transaction_id: transactionId,
      description: description,
      coin_change: parseFloat(amount),
      type: 'sepay_deposit',
      direction: 'in',
      status: 'completed',
      reference_type: 'payment',
      metadata: {
        payment_method: 'sepay',
        paymentMethod: 'bank_transfer',
        bankCode: metadata?.gateway || 'VietinBank',
        gateway: metadata?.gateway || 'VietinBank',
        vnd_amount: parseFloat(amount),
        webhook_data: webhookData,
        processed_at: new Date(),
        ...metadata
      }
    });

    // Update user's coin balance (1 VND = 1 coin conversion rate)
    const coinAmount = parseFloat(amount);
    const updatedUser = await User.findByIdAndUpdate(user._id, {
      $inc: {
        coin: coinAmount,
        coin_total: coinAmount
      }
    }, { new: true });

    console.log(`[SePay Webhook] [${requestId}] Successfully processed payment:`, {
      transactionId,
      userId: user._id,
      vndAmount: amount,
      coinAmount: coinAmount,
      previousBalance: user.coin,
      newBalance: updatedUser.coin
    });

    return { 
      status: 'success', 
      transactionId,
      amount: coinAmount,
      message: 'Payment processed successfully'
    };

  } catch (error) {
    console.error(`[SePay Webhook] [${requestId}] Error handling successful payment:`, error);
    throw error;
  }
}

/**
 * Handle failed payment
 */
async function handleFailedPayment(webhookData, user, requestId) {
  try {
    const { transactionId, amount, metadata } = webhookData;
    
    console.log(`[SePay Webhook] [${requestId}] Processing failed payment for user ${user._id}`);

    // Generate Vietnamese description for failed payment
    const description = generateFailedDescription(amount, 'payment_failed');

    // Create transaction record for failed payment
    await Transaction.create({
      user_id: user._id,
      transaction_id: transactionId,
      description: description,
      coin_change: 0, // No coins added for failed payment
      type: 'sepay_deposit',
      direction: 'in',
      status: 'failed',
      reference_type: 'payment',
      metadata: {
        payment_method: 'sepay',
        paymentMethod: 'bank_transfer',
        bankCode: metadata?.gateway || 'VietinBank',
        gateway: metadata?.gateway || 'VietinBank',
        vnd_amount: parseFloat(amount),
        original_amount: parseFloat(amount),
        webhook_data: webhookData,
        processed_at: new Date(),
        ...metadata
      }
    });

    console.log(`[SePay Webhook] [${requestId}] Recorded failed payment: ${transactionId}`);

    return { 
      status: 'failed', 
      transactionId,
      message: 'Payment failed'
    };

  } catch (error) {
    console.error(`[SePay Webhook] [${requestId}] Error handling failed payment:`, error);
    throw error;
  }
}

/**
 * Handle pending payment
 */
async function handlePendingPayment(webhookData, user, requestId) {
  try {
    const { transactionId, amount, metadata } = webhookData;
    
    console.log(`[SePay Webhook] [${requestId}] Processing pending payment for user ${user._id}`);

    // Generate Vietnamese description for pending payment
    const formattedAmount = formatVNDAmount(amount);
    const description = `Đang xử lý nạp tiền ${formattedAmount}`;

    // Create or update transaction record for pending payment
    await Transaction.findOneAndUpdate(
      { transaction_id: transactionId },
      {
        user_id: user._id,
        transaction_id: transactionId,
        description: description,
        coin_change: 0, // No coins added until payment is completed
        type: 'sepay_deposit',
        direction: 'in',
        status: 'pending',
        reference_type: 'payment',
        metadata: {
          payment_method: 'sepay',
          paymentMethod: 'bank_transfer',
          bankCode: metadata?.gateway || 'VietinBank',
          gateway: metadata?.gateway || 'VietinBank',
          vnd_amount: parseFloat(amount),
          pending_amount: parseFloat(amount),
          webhook_data: webhookData,
          processed_at: new Date(),
          ...metadata
        }
      },
      { upsert: true, new: true }
    );

    console.log(`[SePay Webhook] [${requestId}] Recorded pending payment: ${transactionId}`);

    return { 
      status: 'pending', 
      transactionId,
      message: 'Payment is pending'
    };

  } catch (error) {
    console.error(`[SePay Webhook] [${requestId}] Error handling pending payment:`, error);
    throw error;
  }
}
