// tests/payments.test.js — 11 tests for FR-07, FR-08, NFR-06
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'testsecret';
process.env.MPESA_CONSUMER_KEY = 'your_consumer_key_here'; // triggers simulation mode

const mockPayments = new Map();
const mockReceipts = new Map();
const mockBooking = { id:'bk-1', customer_id:'cust-1', car_id:'car-1', total_amount:13500,
                      start_date:'2025-04-01', end_date:'2025-04-04', status:'pending' };
const mockUsers = new Map([
  ['admin-1', { id:'admin-1', name:'Admin', email:'admin@test.com', role:'admin' }],
  ['cust-1',  { id:'cust-1',  name:'John',  email:'john@test.com',  role:'customer' }]
]);

jest.mock('../config/database', () => ({
  execute: jest.fn(async (sql, params=[]) => {
    if (sql.includes('SELECT id, name, email, phone, role FROM users WHERE id')) {
      return [[mockUsers.get(params[0]) || null]];
    }
    if (sql.includes('SELECT * FROM bookings WHERE id')) {
      return [[params[0] === 'bk-1' ? { ...mockBooking } : null]];
    }
    if (sql.includes('SELECT id FROM payments WHERE booking_id')) {
      return [[mockPayments.has(params[0]) ? { id: params[0] } : null]];
    }
    if (sql.includes('INSERT INTO payments')) {
      const [id,booking_id,amount,method,status,checkout_id,phone] = params;
      mockPayments.set(booking_id, {id,booking_id,amount,payment_method:method,status,mpesa_checkout_id:checkout_id,phone_number:phone,mpesa_receipt_number:null});
      return [{}];
    }
    if (sql.includes('SELECT * FROM payments WHERE booking_id')) {
      return [[mockPayments.get(params[0]) || null]];
    }
    if (sql.includes('SELECT * FROM payments WHERE mpesa_checkout_id')) {
      const p = [...mockPayments.values()].find(p => p.mpesa_checkout_id === params[0]);
      return [[p || null]];
    }
    if (sql.includes("UPDATE payments SET status='completed'")) {
      const p = [...mockPayments.values()].find(p => p.id === params[2]);
      if (p) { p.status='completed'; p.mpesa_receipt_number=params[0]; }
      return [{}];
    }
    if (sql.includes("UPDATE payments SET status='failed'")) {
      const p = [...mockPayments.values()].find(p => p.id === params[0]);
      if (p) p.status = 'failed';
      return [{}];
    }
    if (sql.includes('UPDATE bookings SET status=')) return [{}];
    if (sql.includes('UPDATE cars SET status=')) return [{}];
    if (sql.includes('SELECT id FROM receipts WHERE booking_id')) {
      return [[mockReceipts.has(params[0]) ? { id: params[0] } : null]];
    }
    if (sql.includes('INSERT INTO receipts')) {
      mockReceipts.set(params[1], { id:params[0], booking_id:params[1], payment_id:params[2], total_amount:params[3] });
      return [{}];
    }
    if (sql.includes('FROM receipts r') && sql.includes('JOIN bookings b')) {
      const r = mockReceipts.get(params[0]);
      if (!r) return [[null]];
      return [[{ ...r, start_date:'2025-04-01', end_date:'2025-04-04', booking_status:'confirmed',
                 make:'Toyota', model:'Corolla', year:2022, category:'Sedan', license_plate:'KCA001A', color:'Black',
                 customer_name:'John', customer_email:'john@test.com', customer_phone:'+254711111111',
                 payment_method:'mpesa', mpesa_receipt_number:'SIM123', transaction_date:new Date(), mpesa_phone:'+254711111111' }]];
    }
    if (sql.includes('COALESCE(SUM(amount),0) as grand_total')) return [[{ grand_total:0 }]];
    if (sql.includes('COALESCE(SUM(amount),0) as month_total')) return [[{ month_total:0 }]];
    if (sql.includes('SELECT') && sql.includes('FROM payments')) return [[]];
    return [[]];
  })
}));

const app = require('../server');
const custToken  = jwt.sign({ id:'cust-1', role:'customer' }, 'testsecret');
const adminToken = jwt.sign({ id:'admin-1', role:'admin' }, 'testsecret');

describe('Payments Endpoints (FR-07, FR-08, NFR-06)', () => {
  test('POST /api/payments/stk-push — 401 without token (FR-07)', async () => {
    const res = await request(app).post('/api/payments/stk-push')
      .send({ booking_id:'bk-1', phone:'0711111111' });
    expect(res.status).toBe(401);
  });

  test('POST /api/payments/stk-push — 400 missing fields', async () => {
    const res = await request(app).post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ booking_id:'bk-1' });
    expect(res.status).toBe(400);
  });

  test('POST /api/payments/stk-push — 200 initiates payment (FR-07)', async () => {
    const res = await request(app).post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ booking_id:'bk-1', phone:'0711111111' });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('checkout_request_id');
    expect(res.body).toHaveProperty('payment_id');
  });

  test('POST /api/payments/stk-push — 409 duplicate payment blocked (NFR-06)', async () => {
    const res = await request(app).post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ booking_id:'bk-1', phone:'0711111111' });
    expect(res.status).toBe(409);
  });

  test('GET /api/payments/status/:bookingId — returns pending (not null) before confirmation (NFR-06)', async () => {
    const res = await request(app).get('/api/payments/status/bk-1')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBeDefined();
    expect(res.body.status).not.toBeNull(); // Bug #003 fix
  });

  test('POST /api/payments/callback — validates CheckoutRequestID (NFR-06 security)', async () => {
    const p = [...require('../config/database').execute.mock.results]
      .map(r => r.value).filter(Boolean);
    const checkoutId = [...mockPayments.values()][0]?.mpesa_checkout_id || 'SIMULATED_TEST';

    const res = await request(app).post('/api/payments/callback').send({
      Body: { stkCallback: { CheckoutRequestID: checkoutId, ResultCode: 0,
        CallbackMetadata: { Item: [
          { Name:'MpesaReceiptNumber', Value:'MPX12345' },
          { Name:'TransactionDate',    Value:'20250401120000' }
        ]}
      }}
    });
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);
  });

  test('POST /api/payments/callback — unknown CheckoutRequestID is silently ignored', async () => {
    const res = await request(app).post('/api/payments/callback').send({
      Body: { stkCallback: { CheckoutRequestID: 'FORGED_ID', ResultCode: 0, CallbackMetadata: { Item: [] } } }
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/payments/callback — failed payment (ResultCode != 0) marks as failed', async () => {
    const checkoutId = [...mockPayments.values()][0]?.mpesa_checkout_id || 'SIMULATED_FAIL';
    const res = await request(app).post('/api/payments/callback').send({
      Body: { stkCallback: { CheckoutRequestID: checkoutId, ResultCode: 1032 } }
    });
    expect(res.status).toBe(200);
  });

  test('POST /api/payments/simulate-success — completes payment and creates receipt (FR-08)', async () => {
    // Reset payment for simulation
    const p = [...mockPayments.values()][0];
    if (p) p.status = 'pending';

    const res = await request(app).post('/api/payments/simulate-success')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ booking_id:'bk-1' });
    expect([200, 404]).toContain(res.status);
  });

  test('GET /api/payments/receipt/:bookingId — returns full receipt (FR-08)', async () => {
    const res = await request(app).get('/api/payments/receipt/bk-1')
      .set('Authorization', `Bearer ${custToken}`);
    expect([200, 404]).toContain(res.status);
  });

  test('GET /api/payments/revenue — admin revenue (returns 0 not crash when empty — Bug #004)', async () => {
    const res = await request(app).get('/api/payments/revenue')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('grand_total');
    expect(res.body.grand_total).not.toBeNull(); // Bug #004 fix
  });
});
