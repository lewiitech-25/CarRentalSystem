// routes/payments.js  — FR-07: Secure Payment, FR-08: Receipt Generation
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool   = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// ── M-Pesa STK Push helper ──────────────────────────────────────────────────
async function getMpesaToken() {
  const key    = process.env.MPESA_CONSUMER_KEY;
  const secret = process.env.MPESA_CONSUMER_SECRET;
  const auth   = Buffer.from(`${key}:${secret}`).toString('base64');
  const res = await fetch(
    'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials',
    { headers: { Authorization: `Basic ${auth}` } }
  );
  const data = await res.json();
  return data.access_token;
}

async function sendStkPush(token, phone, amount, bookingId) {
  const shortcode = process.env.MPESA_SHORTCODE;
  const passkey   = process.env.MPESA_PASSKEY;
  const timestamp = new Date().toISOString().replace(/[-T:.Z]/g, '').slice(0, 14);
  const password  = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');

  const body = {
    BusinessShortCode: shortcode,
    Password: password,
    Timestamp: timestamp,
    TransactionType: 'CustomerPayBillOnline',
    Amount: Math.ceil(amount),
    PartyA: phone,
    PartyB: shortcode,
    PhoneNumber: phone,
    CallBackURL: process.env.MPESA_CALLBACK_URL,
    AccountReference: `Booking-${bookingId.slice(0,8)}`,
    TransactionDesc: 'Car Rental Payment - DriveDesk'
  };

  const res = await fetch('https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  return res.json();
}

// POST /api/payments/stk-push  — initiate M-Pesa STK Push (FR-07)
router.post('/stk-push', requireAuth, async (req, res) => {
  try {
    const { booking_id, phone } = req.body;
    if (!booking_id || !phone) {
      return res.status(400).json({ message: 'booking_id and phone are required.' });
    }

    const [[booking]] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [booking_id]);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: `Booking is already ${booking.status}.` });
    }

    // Check for existing payment
    const [[existing]] = await pool.execute('SELECT id FROM payments WHERE booking_id = ?', [booking_id]);
    if (existing) {
      return res.status(409).json({ message: 'Payment already initiated for this booking.' });
    }

    // Format phone: ensure it starts with 254
    const cleanPhone = phone.replace(/\s+/g, '').replace(/^\+/, '').replace(/^0/, '254');

    let checkoutRequestId = null;

    // Try M-Pesa if credentials exist, else simulate
    if (process.env.MPESA_CONSUMER_KEY && process.env.MPESA_CONSUMER_KEY !== 'your_consumer_key_here') {
      try {
        const mpesaToken = await getMpesaToken();
        const stkResult  = await sendStkPush(mpesaToken, cleanPhone, booking.total_amount, booking_id);
        if (stkResult.ResponseCode !== '0') {
          return res.status(400).json({ message: stkResult.errorMessage || 'M-Pesa request failed.' });
        }
        checkoutRequestId = stkResult.CheckoutRequestID;
      } catch (mpesaErr) {
        console.error('M-Pesa error:', mpesaErr);
        return res.status(500).json({ message: 'M-Pesa service unavailable. Please try again.' });
      }
    } else {
      // Sandbox simulation mode
      checkoutRequestId = `SIMULATED_${uuidv4()}`;
    }

    const paymentId = uuidv4();
    await pool.execute(
      `INSERT INTO payments (id,booking_id,amount,payment_method,status,mpesa_checkout_id,phone_number)
       VALUES (?,?,?,?,?,?,?)`,
      [paymentId, booking_id, booking.total_amount, 'mpesa', 'pending', checkoutRequestId, cleanPhone]
    );

    res.json({
      message: 'STK Push sent. Check your phone for the M-Pesa prompt.',
      checkout_request_id: checkoutRequestId,
      payment_id: paymentId
    });
  } catch (err) {
    console.error('STK Push error:', err);
    res.status(500).json({ message: 'Failed to initiate payment.' });
  }
});

// POST /api/payments/callback  — Safaricom callback (FR-07: NFR-06 security)
router.post('/callback', async (req, res) => {
  try {
    const body = req.body?.Body?.stkCallback;
    if (!body) return res.status(400).json({ message: 'Invalid callback payload.' });

    const { CheckoutRequestID, ResultCode, CallbackMetadata } = body;

    // Security: find payment by CheckoutRequestID (not booking_id alone)
    const [[payment]] = await pool.execute(
      'SELECT * FROM payments WHERE mpesa_checkout_id = ?', [CheckoutRequestID]
    );
    if (!payment) {
      console.warn('Callback for unknown CheckoutRequestID:', CheckoutRequestID);
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      // Success — extract metadata
      const items = CallbackMetadata?.Item || [];
      const get   = (name) => items.find(i => i.Name === name)?.Value;
      const receiptNumber = get('MpesaReceiptNumber');
      const transDate     = get('TransactionDate');

      await pool.execute(
        `UPDATE payments SET status='completed', mpesa_receipt_number=?, transaction_date=? WHERE id=?`,
        [receiptNumber||null, transDate ? new Date(transDate.toString()) : new Date(), payment.id]
      );
      await pool.execute("UPDATE bookings SET status='confirmed' WHERE id=?", [payment.booking_id]);
      await pool.execute(
        "UPDATE cars SET status='rented' WHERE id=(SELECT car_id FROM bookings WHERE id=?)",
        [payment.booking_id]
      );

      // Generate receipt (FR-08)
      const [[existingReceipt]] = await pool.execute('SELECT id FROM receipts WHERE booking_id=?', [payment.booking_id]);
      if (!existingReceipt) {
        await pool.execute(
          'INSERT INTO receipts (id,booking_id,payment_id,total_amount) VALUES (?,?,?,?)',
          [uuidv4(), payment.booking_id, payment.id, payment.amount]
        );
      }
    } else {
      await pool.execute("UPDATE payments SET status='failed' WHERE id=?", [payment.id]);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (err) {
    console.error('Callback error:', err);
    res.status(500).json({ message: 'Callback processing failed.' });
  }
});

// POST /api/payments/simulate-success  — DEV ONLY: simulate successful payment
router.post('/simulate-success', requireAuth, async (req, res) => {
  try {
    const { booking_id } = req.body;
    const [[payment]] = await pool.execute(
      'SELECT * FROM payments WHERE booking_id = ? AND status = "pending"', [booking_id]
    );
    if (!payment) return res.status(404).json({ message: 'No pending payment for this booking.' });

    const receiptNum = `SIM${Date.now()}`;
    await pool.execute(
      "UPDATE payments SET status='completed', mpesa_receipt_number=?, transaction_date=NOW() WHERE id=?",
      [receiptNum, payment.id]
    );
    await pool.execute("UPDATE bookings SET status='confirmed' WHERE id=?", [booking_id]);
    await pool.execute(
      "UPDATE cars SET status='rented' WHERE id=(SELECT car_id FROM bookings WHERE id=?)", [booking_id]
    );

    const [[existingReceipt]] = await pool.execute('SELECT id FROM receipts WHERE booking_id=?', [booking_id]);
    if (!existingReceipt) {
      await pool.execute(
        'INSERT INTO receipts (id,booking_id,payment_id,total_amount) VALUES (?,?,?,?)',
        [uuidv4(), booking_id, payment.id, payment.amount]
      );
    }
    res.json({ message: 'Payment simulated successfully.', receipt_number: receiptNum });
  } catch (err) {
    res.status(500).json({ message: 'Simulation failed.' });
  }
});

// GET /api/payments/status/:bookingId  — poll payment status (frontend polling)
router.get('/status/:bookingId', requireAuth, async (req, res) => {
  try {
    const [[payment]] = await pool.execute(
      'SELECT * FROM payments WHERE booking_id = ?', [req.params.bookingId]
    );
    if (!payment) return res.status(404).json({ message: 'No payment found for this booking.' });

    // NFR-06: Return pending (not null) on timeout/unknown state
    const status = payment.status || 'pending';
    res.json({ status, payment_id: payment.id, receipt_number: payment.mpesa_receipt_number || null });
  } catch (err) {
    res.status(500).json({ message: 'Failed to get payment status.', status: 'pending' });
  }
});

// GET /api/payments/receipt/:bookingId  — get receipt (FR-08)
router.get('/receipt/:bookingId', requireAuth, async (req, res) => {
  try {
    const [[receipt]] = await pool.execute(
      `SELECT r.*, b.start_date, b.end_date, b.status as booking_status,
              c.make, c.model, c.year, c.category, c.license_plate, c.color,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              p.payment_method, p.mpesa_receipt_number, p.transaction_date, p.phone_number as mpesa_phone
       FROM receipts r
       JOIN bookings b ON r.booking_id = b.id
       JOIN cars c     ON b.car_id = c.id
       JOIN users u    ON b.customer_id = u.id
       JOIN payments p ON r.payment_id = p.id
       WHERE r.booking_id = ?`,
      [req.params.bookingId]
    );
    if (!receipt) return res.status(404).json({ message: 'Receipt not found.' });
    if (req.user.role === 'customer' && receipt.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    res.json({ receipt });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch receipt.' });
  }
});

// GET /api/payments/revenue  — admin revenue analytics
router.get('/revenue', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { period } = req.query; // 'week' | 'month' | 'year'

    const groupBy = period === 'week'  ? 'YEARWEEK(transaction_date)'
                  : period === 'year'  ? 'YEAR(transaction_date)'
                  :                      'DATE_FORMAT(transaction_date, "%Y-%m")';

    const labelFmt = period === 'week'  ? 'YEARWEEK(transaction_date)'
                   : period === 'year'  ? 'YEAR(transaction_date)'
                   :                     'DATE_FORMAT(transaction_date, "%Y-%m")';

    const [rows] = await pool.execute(
      `SELECT ${labelFmt} as period, SUM(amount) as total, COUNT(*) as transactions
       FROM payments
       WHERE status = 'completed'
       GROUP BY ${groupBy}
       ORDER BY period DESC
       LIMIT 12`
    );

    // NFR-06: null check — return zero totals if no data
    const [[{ grand_total }]] = await pool.execute(
      "SELECT COALESCE(SUM(amount),0) as grand_total FROM payments WHERE status='completed'"
    );
    const [[{ month_total }]] = await pool.execute(
      "SELECT COALESCE(SUM(amount),0) as month_total FROM payments WHERE status='completed' AND MONTH(transaction_date)=MONTH(NOW()) AND YEAR(transaction_date)=YEAR(NOW())"
    );

    res.json({ revenue: rows || [], grand_total, month_total });
  } catch (err) {
    console.error('Revenue error:', err);
    // Return zeros instead of crashing (Bug #004 fix)
    res.json({ revenue: [], grand_total: 0, month_total: 0 });
  }
});

// GET /api/payments  — admin: all payments
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [payments] = await pool.execute(
      `SELECT p.*, u.name as customer_name, u.email as customer_email,
              c.make, c.model, b.start_date, b.end_date
       FROM payments p
       JOIN bookings b ON p.booking_id = b.id
       JOIN users u    ON b.customer_id = u.id
       JOIN cars c     ON b.car_id = c.id
       ORDER BY p.created_at DESC`
    );
    res.json({ payments });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch payments.' });
  }
});

module.exports = router;
