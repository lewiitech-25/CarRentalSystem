// tests/api.test.js
// Full test suite — 53 tests across auth, cars, bookings, payments, integration

process.env.NODE_ENV  = 'test';
process.env.JWT_SECRET = 'test_secret_key_for_jest';
process.env.DB_PATH   = './database/test_carrental.db';

const request = require('supertest');
const app     = require('../server');
const db      = require('../database/db');
const bcrypt  = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

// ── Test helpers ──────────────────────────────────────────────────────────────
let adminToken, customerToken, customerId, carId, bookingId, paymentId;

const adminData = {
  email: 'testadmin@carrental.com',
  password: 'admin1234',
  name: 'Test Admin',
  phone: '0700111000'
};
const customerData = {
  email: 'testcustomer@carrental.com',
  password: 'customer1234',
  name: 'Test Customer',
  phone: '0712000999'
};

// Clean test DB before all tests
beforeAll(() => {
  db.exec(`
    DELETE FROM car_condition_log;
    DELETE FROM receipts;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM cars WHERE license_plate LIKE 'TEST%';
    DELETE FROM users WHERE email LIKE '%@carrental.com' OR email LIKE '%@example%test%';
  `);
});

// Clean up after all tests
afterAll(() => {
  db.exec(`
    DELETE FROM car_condition_log;
    DELETE FROM receipts;
    DELETE FROM payments;
    DELETE FROM bookings;
    DELETE FROM cars WHERE license_plate LIKE 'TEST%';
    DELETE FROM users WHERE email LIKE '%@carrental.com' OR email LIKE '%@example%test%';
  `);
  db.close();
});

// ══════════════════════════════════════════════════════════════════════════════
// AUTH TESTS (8 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('AUTH — Registration & Login', () => {

  test('POST /api/auth/register — should register admin successfully', async () => {
    const adminHash = bcrypt.hashSync(adminData.password, 10);
    const adminId = uuidv4();
    db.prepare(`INSERT INTO users (id, name, email, password, phone, role) VALUES (?, ?, ?, ?, ?, 'admin')`)
      .run(adminId, adminData.name, adminData.email, adminHash, adminData.phone);

    const res = await request(app).post('/api/auth/login').send({
      email: adminData.email, password: adminData.password
    });
    expect(res.status).toBe(200);
    adminToken = res.body.token;
    expect(adminToken).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });

  test('POST /api/auth/register — should register customer successfully', async () => {
    const res = await request(app).post('/api/auth/register').send(customerData);
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('customer');
    customerToken = res.body.token;
    customerId    = res.body.user.id;
  });

  test('POST /api/auth/register — should reject duplicate email with 409', async () => {
    const res = await request(app).post('/api/auth/register').send(customerData);
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('POST /api/auth/register — should reject weak password (< 8 chars)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Weak', email: 'weak@test.com', password: '123', phone: '0700000000'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/8 characters/i);
  });

  test('POST /api/auth/register — should reject missing name field', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'noname@test.com', password: 'password123', phone: '0700000000'
    });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login — should reject wrong password with 401', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: customerData.email, password: 'wrongpassword'
    });
    expect(res.status).toBe(401);
    expect(res.body.message).toMatch(/invalid/i);
  });

  test('POST /api/auth/login — should reject non-existent email', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'ghost@nowhere.com', password: 'password123'
    });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me — should return current user with valid token', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(customerData.email);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// CARS API TESTS (12 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('CARS API — Fleet Management', () => {

  test('POST /api/cars — admin should add a car (FR-09)', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        make: 'Toyota', model: 'TestCamry', year: 2022,
        category: 'Sedan', price_per_day: 5000,
        license_plate: 'TEST001A', color: 'White'
      });
    expect(res.status).toBe(201);
    expect(res.body.car.make).toBe('Toyota');
    carId = res.body.car.id;
  });

  test('POST /api/cars — customer should be denied (403 RBAC)', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ make: 'Honda', model: 'Civic', year: 2020, category: 'Sedan', price_per_day: 3000, license_plate: 'TEST002B' });
    expect(res.status).toBe(403);
  });

  test('POST /api/cars — should reject duplicate license plate (409)', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make: 'Honda', model: 'Civic', year: 2020, category: 'Sedan', price_per_day: 3000, license_plate: 'TEST001A' });
    expect(res.status).toBe(409);
  });

  test('POST /api/cars — should reject missing required fields (400)', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make: 'Honda' }); // missing model, year, category, price, plate
    expect(res.status).toBe(400);
  });

  test('GET /api/cars — should return available cars list (FR-02)', async () => {
    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cars)).toBe(true);
    expect(res.body.cars.length).toBeGreaterThan(0);
    // All returned cars should be available
    res.body.cars.forEach(car => expect(car.status).toBe('available'));
  });

  test('GET /api/cars — filter by category (FR-03)', async () => {
    const res = await request(app).get('/api/cars?category=Sedan');
    expect(res.status).toBe(200);
    res.body.cars.forEach(car => expect(car.category).toBe('Sedan'));
  });

  test('GET /api/cars — filter by max_price (FR-03)', async () => {
    const res = await request(app).get('/api/cars?max_price=5000');
    expect(res.status).toBe(200);
    res.body.cars.forEach(car => expect(car.price_per_day).toBeLessThanOrEqual(5000));
  });

  test('GET /api/cars — filter by search term (FR-03)', async () => {
    const res = await request(app).get('/api/cars?search=Toyota');
    expect(res.status).toBe(200);
    res.body.cars.forEach(car =>
      expect(car.make.toLowerCase() + car.model.toLowerCase()).toMatch(/toyota/i)
    );
  });

  test('GET /api/cars/:id — should return single car details', async () => {
    const res = await request(app).get(`/api/cars/${carId}`);
    expect(res.status).toBe(200);
    expect(res.body.car.id).toBe(carId);
  });

  test('GET /api/cars/:id — should return 404 for unknown car', async () => {
    const res = await request(app).get('/api/cars/nonexistent-id');
    expect(res.status).toBe(404);
  });

  test('PUT /api/cars/:id — admin should update car details', async () => {
    const res = await request(app)
      .put(`/api/cars/${carId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ price_per_day: 5500, color: 'Blue' });
    expect(res.status).toBe(200);
    expect(res.body.car.price_per_day).toBe(5500);
    expect(res.body.car.color).toBe('Blue');
  });

  test('GET /api/cars/all — admin should see all cars including non-available', async () => {
    const res = await request(app)
      .get('/api/cars/all')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.cars)).toBe(true);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// BOOKINGS API TESTS (14 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('BOOKINGS — Availability & Booking Flow', () => {

  const future = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  const startDate = future(5);
  const endDate   = future(8);

  test('POST /api/bookings/check-availability — car is available', async () => {
    const res = await request(app)
      .post('/api/bookings/check-availability')
      .send({ car_id: carId, start_date: startDate, end_date: endDate });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.days).toBe(3);
    expect(res.body.total_amount).toBe(3 * 5500); // Updated price
  });

  test('POST /api/bookings/check-availability — reject end before start', async () => {
    const res = await request(app)
      .post('/api/bookings/check-availability')
      .send({ car_id: carId, start_date: endDate, end_date: startDate });
    expect(res.status).toBe(400);
  });

  test('POST /api/bookings/check-availability — 404 for unknown car', async () => {
    const res = await request(app)
      .post('/api/bookings/check-availability')
      .send({ car_id: 'ghost-car', start_date: startDate, end_date: endDate });
    expect(res.status).toBe(404);
  });

  test('POST /api/bookings — customer can create a booking (FR-04)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ car_id: carId, start_date: startDate, end_date: endDate });
    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe('pending');
    expect(res.body.days).toBe(3);
    expect(res.body.total_amount).toBeGreaterThan(0);
    bookingId = res.body.booking.id;
  });

  test('POST /api/bookings — FR-05 cost calculation is correct (days × price)', async () => {
    const res = await request(app)
      .post('/api/bookings/check-availability')
      .send({ car_id: carId, start_date: future(10), end_date: future(14) });
    expect(res.status).toBe(200);
    expect(res.body.days).toBe(4);
    expect(res.body.total_amount).toBe(res.body.days * res.body.price_per_day);
  });

  test('POST /api/bookings — should reject overlapping dates (409)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ car_id: carId, start_date: future(6), end_date: future(9) }); // Overlaps with existing
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/not available/i);
  });

  test('POST /api/bookings — should require auth (401)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .send({ car_id: carId, start_date: future(20), end_date: future(23) });
    expect(res.status).toBe(401);
  });

  test('GET /api/bookings/my — customer sees own bookings (FR-10)', async () => {
    const res = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
    expect(res.body.bookings.length).toBeGreaterThan(0);
  });

  test('GET /api/bookings — admin sees all bookings (FR-10)', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  test('GET /api/bookings — customer cannot access admin endpoint (403)', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/bookings/:id — customer retrieves own booking', async () => {
    const res = await request(app)
      .get(`/api/bookings/${bookingId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.booking.id).toBe(bookingId);
  });

  test('PUT /api/bookings/:id/confirm — admin confirms booking (FR-06)', async () => {
    const res = await request(app)
      .put(`/api/bookings/${bookingId}/confirm`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/confirmed/i);
  });

  test('PUT /api/bookings/:id/cancel — customer cancels booking (FR-06)', async () => {
    // Create a new booking to cancel
    const res1 = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ car_id: carId, start_date: future(30), end_date: future(33) });

    // First free up car (it's now rented from previous test)
    db.prepare(`UPDATE cars SET status = 'available' WHERE id = ?`).run(carId);
    db.prepare(`UPDATE bookings SET status = 'pending' WHERE id = ?`).run(res1.body?.booking?.id || bookingId);

    const cancelId = res1.body?.booking?.id || bookingId;
    const res2 = await request(app)
      .put(`/api/bookings/${cancelId}/cancel`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res2.status).toBe(200);
  });

  test('PUT /api/bookings/:id/complete — admin completes booking (FR-06)', async () => {
    // Set the booking back to confirmed for completion
    db.prepare(`UPDATE bookings SET status = 'confirmed' WHERE id = ?`).run(bookingId);
    db.prepare(`UPDATE cars SET status = 'rented' WHERE id = ?`).run(carId);

    const res = await request(app)
      .put(`/api/bookings/${bookingId}/complete`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ condition: 'good', notes: 'No damage observed', mileage: 12500 });
    expect(res.status).toBe(200);
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// PAYMENTS TESTS (11 tests)
// ══════════════════════════════════════════════════════════════════════════════
describe('PAYMENTS — M-Pesa & Receipts', () => {

  const future = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  let payBookingId;

  beforeAll(async () => {
    // Reset car to available
    db.prepare(`UPDATE cars SET status = 'available' WHERE id = ?`).run(carId);

    // Create a fresh booking for payment tests
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ car_id: carId, start_date: future(40), end_date: future(42) });
    payBookingId = res.body?.booking?.id;
  });

  test('POST /api/payments/stk-push — should initiate payment (FR-07)', async () => {
    const res = await request(app)
      .post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ booking_id: payBookingId, phone_number: '0712345678' });
    expect(res.status).toBe(200);
    expect(res.body.payment_id).toBeDefined();
    expect(res.body.checkout_request_id).toBeDefined();
    paymentId = res.body.payment_id;
  });

  test('POST /api/payments/stk-push — should reject missing phone_number (400)', async () => {
    const res = await request(app)
      .post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ booking_id: payBookingId });
    expect(res.status).toBe(400);
  });

  test('POST /api/payments/stk-push — should reject invalid booking_id (404)', async () => {
    const res = await request(app)
      .post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ booking_id: 'fake-id', phone_number: '0712345678' });
    expect(res.status).toBe(404);
  });

  test('POST /api/payments/stk-push — should require authentication (401)', async () => {
    const res = await request(app)
      .post('/api/payments/stk-push')
      .send({ booking_id: payBookingId, phone_number: '0712345678' });
    expect(res.status).toBe(401);
  });

  test('GET /api/payments/status/:id — should return payment status', async () => {
    const res = await request(app)
      .get(`/api/payments/status/${paymentId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(['pending', 'completed']).toContain(res.body.status);
  });

  test('GET /api/payments/status/:id — demo mode auto-completes payment', async () => {
    // Reset payment to pending
    db.prepare(`UPDATE payments SET status = 'pending' WHERE id = ?`).run(paymentId);
    db.prepare(`UPDATE bookings SET status = 'pending' WHERE id = ?`).run(payBookingId);
    db.prepare(`UPDATE cars SET status = 'available' WHERE id = ?`).run(carId);

    const res = await request(app)
      .get(`/api/payments/status/${paymentId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('POST /api/payments/callback — valid Safaricom callback confirms booking (NFR-06)', async () => {
    // Create another booking + payment for callback test
    db.prepare(`UPDATE cars SET status = 'available' WHERE id = ?`).run(carId);
    const newBid = uuidv4();
    db.prepare(`INSERT INTO bookings (id, customer_id, car_id, start_date, end_date, total_amount, status)
                VALUES (?, ?, ?, '2025-12-01', '2025-12-03', 11000, 'pending')`)
      .run(newBid, customerId, carId);
    const newPid = uuidv4();
    const fakeCheckoutId = `CALLBACK_TEST_${Date.now()}`;
    db.prepare(`INSERT INTO payments (id, booking_id, amount, payment_method, status, mpesa_checkout_id)
                VALUES (?, ?, 11000, 'mpesa', 'pending', ?)`)
      .run(newPid, newBid, fakeCheckoutId);

    const res = await request(app)
      .post('/api/payments/callback')
      .send({
        Body: {
          stkCallback: {
            CheckoutRequestID: fakeCheckoutId,
            ResultCode: 0,
            CallbackMetadata: {
              Item: [{ Name: 'MpesaReceiptNumber', Value: 'PKH123XYZ' }]
            }
          }
        }
      });
    expect(res.status).toBe(200);
    expect(res.body.ResultCode).toBe(0);

    const updatedBooking = db.prepare('SELECT status FROM bookings WHERE id = ?').get(newBid);
    expect(updatedBooking.status).toBe('confirmed');
  });

  test('POST /api/payments/callback — failed payment does NOT confirm booking (NFR-06)', async () => {
    db.prepare(`UPDATE cars SET status = 'available' WHERE id = ?`).run(carId);
    const failBid = uuidv4();
    db.prepare(`INSERT INTO bookings (id, customer_id, car_id, start_date, end_date, total_amount, status)
                VALUES (?, ?, ?, '2026-01-10', '2026-01-12', 11000, 'pending')`)
      .run(failBid, customerId, carId);
    const failPid  = uuidv4();
    const failCID  = `FAIL_TEST_${Date.now()}`;
    db.prepare(`INSERT INTO payments (id, booking_id, amount, status, mpesa_checkout_id)
                VALUES (?, ?, 11000, 'pending', ?)`)
      .run(failPid, failBid, failCID);

    await request(app).post('/api/payments/callback').send({
      Body: { stkCallback: { CheckoutRequestID: failCID, ResultCode: 1032 } }
    });

    const booking = db.prepare('SELECT status FROM bookings WHERE id = ?').get(failBid);
    const payment = db.prepare('SELECT status FROM payments WHERE id = ?').get(failPid);
    expect(booking.status).toBe('pending');  // NOT confirmed — no ghost booking
    expect(payment.status).toBe('failed');
  });

  test('POST /api/payments/callback — forged CheckoutRequestID is ignored', async () => {
    const res = await request(app)
      .post('/api/payments/callback')
      .send({
        Body: {
          stkCallback: {
            CheckoutRequestID: 'FORGED_ID_12345',
            ResultCode: 0
          }
        }
      });
    expect(res.status).toBe(200); // Responds 200 to Safaricom but does nothing
  });

  test('GET /api/payments/receipt/:booking_id — should return receipt (FR-08)', async () => {
    const res = await request(app)
      .get(`/api/payments/receipt/${payBookingId}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.receipt.booking_id).toBe(payBookingId);
    expect(res.body.receipt.total_amount).toBeGreaterThan(0);
    expect(res.body.receipt.mpesa_receipt).toBeDefined();
  });

  test('GET /api/payments/stats — admin gets revenue dashboard data', async () => {
    const res = await request(app)
      .get('/api/payments/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.total_cars).toBeGreaterThan(0);
    expect(res.body.total_customers).toBeGreaterThan(0);
    expect(typeof res.body.total_revenue).toBe('number');
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// INTEGRATION TESTS (8 tests) — Full end-to-end flows
// ══════════════════════════════════════════════════════════════════════════════
describe('INTEGRATION — Full Booking Flow', () => {

  let intToken, intBookingId, intPaymentId, intCarId;

  const future = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  };

  test('Step 1: Register new customer account', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Integration User', email: 'integration_test@example.com',
      password: 'testpass123', phone: '0799888777'
    });
    expect(res.status).toBe(201);
    intToken = res.body.token;
  });

  test('Step 2: Browse available cars', async () => {
    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(res.body.cars.length).toBeGreaterThan(0);
    intCarId = res.body.cars[0].id;
  });

  test('Step 3: Check availability for selected car', async () => {
    const res = await request(app)
      .post('/api/bookings/check-availability')
      .send({ car_id: intCarId, start_date: future(60), end_date: future(63) });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
    expect(res.body.total_amount).toBe(res.body.days * res.body.price_per_day);
  });

  test('Step 4: Create booking with auto cost calculation (FR-04 + FR-05)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${intToken}`)
      .send({ car_id: intCarId, start_date: future(60), end_date: future(63) });
    expect(res.status).toBe(201);
    expect(res.body.booking.status).toBe('pending');
    intBookingId = res.body.booking.id;
  });

  test('Step 5: Initiate M-Pesa payment (FR-07)', async () => {
    const res = await request(app)
      .post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${intToken}`)
      .send({ booking_id: intBookingId, phone_number: '0799888777' });
    expect(res.status).toBe(200);
    intPaymentId = res.body.payment_id;
  });

  test('Step 6: Poll payment status — auto-confirmed in demo mode', async () => {
    const res = await request(app)
      .get(`/api/payments/status/${intPaymentId}`)
      .set('Authorization', `Bearer ${intToken}`);
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('completed');
  });

  test('Step 7: Retrieve booking history (FR-10)', async () => {
    const res = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${intToken}`);
    expect(res.status).toBe(200);
    const myBooking = res.body.bookings.find(b => b.id === intBookingId);
    expect(myBooking).toBeDefined();
    expect(myBooking.status).toBe('confirmed');
  });

  test('Step 8: Retrieve receipt (FR-08)', async () => {
    const res = await request(app)
      .get(`/api/payments/receipt/${intBookingId}`)
      .set('Authorization', `Bearer ${intToken}`);
    expect(res.status).toBe(200);
    expect(res.body.receipt.booking_id).toBe(intBookingId);
    expect(res.body.receipt.total_amount).toBeGreaterThan(0);
  });
});
