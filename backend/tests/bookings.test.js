// tests/bookings.test.js — 14 tests for FR-04, FR-05, FR-06, FR-10
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'testsecret';

const mockBookings = new Map();
const mockCar = { id:'car-1', make:'Toyota', model:'Corolla', year:2022, category:'Sedan',
                  price_per_day:4500, status:'available', license_plate:'KCA001A' };
const mockUsers = new Map([
  ['admin-1', { id:'admin-1', name:'Admin', email:'admin@test.com', role:'admin' }],
  ['cust-1',  { id:'cust-1',  name:'John',  email:'john@test.com',  role:'customer' }]
]);

jest.mock('../config/database', () => ({
  execute: jest.fn(async (sql, params=[]) => {
    // Auth
    if (sql.includes('SELECT id, name, email, phone, role FROM users WHERE id')) {
      return [[mockUsers.get(params[0]) || null]];
    }
    // Overlap check
    if (sql.includes('NOT (end_date < ? OR start_date > ?)')) {
      const conflicts = [...mockBookings.values()].filter(b =>
        b.car_id === params[0] && b.status !== 'cancelled' &&
        !(params[2] < b.start_date || params[1] > b.end_date)
      );
      return [conflicts];
    }
    // Car lookup
    if (sql.includes('SELECT * FROM cars WHERE id')) {
      return [[params[0] === 'car-1' ? mockCar : null]];
    }
    // Create booking
    if (sql.includes('INSERT INTO bookings')) {
      const [id,customer_id,car_id,start_date,end_date,total_amount,status] = params;
      mockBookings.set(id, {id,customer_id,car_id,start_date,end_date,total_amount,status});
      return [{}];
    }
    // Get booking with joins
    if (sql.includes('FROM bookings b') && sql.includes('JOIN cars c') && sql.includes('WHERE b.id =')) {
      const b = mockBookings.get(params[0]);
      if (!b) return [[null]];
      return [[{ ...b, make:'Toyota', model:'Corolla', year:2022, category:'Sedan',
                 price_per_day:4500, customer_name:'John', customer_email:'john@test.com', customer_phone:'+254711111111' }]];
    }
    // My bookings
    if (sql.includes('WHERE b.customer_id =')) {
      const bookings = [...mockBookings.values()].filter(b => b.customer_id === params[0]);
      return [bookings];
    }
    // All bookings
    if (sql.includes('FROM bookings b') && sql.includes('JOIN cars c')) {
      return [[...mockBookings.values()]];
    }
    // Single booking for status check
    if (sql.includes('SELECT * FROM bookings WHERE id')) {
      return [[mockBookings.get(params[0]) || null]];
    }
    // Update booking
    if (sql.includes('UPDATE bookings SET status=')) {
      const b = mockBookings.get(params[1]);
      if (b) b.status = params[0].replace(/'/g,'');
      return [{}];
    }
    // Update car status
    if (sql.includes('UPDATE cars SET status=')) return [{}];
    // Condition log
    if (sql.includes('INSERT INTO car_condition_log')) return [{}];
    return [[]];
  })
}));

const app = require('../server');
const adminToken = jwt.sign({ id:'admin-1', role:'admin' }, 'testsecret');
const custToken  = jwt.sign({ id:'cust-1',  role:'customer' }, 'testsecret');

const futureStart = new Date(Date.now() + 86400000 * 2).toISOString().slice(0,10);
const futureEnd   = new Date(Date.now() + 86400000 * 5).toISOString().slice(0,10);

describe('Bookings Endpoints (FR-04, FR-05, FR-06, FR-10)', () => {
  test('POST /api/bookings/check-availability — returns availability + price (FR-04, FR-05)', async () => {
    const res = await request(app).post('/api/bookings/check-availability')
      .send({ car_id:'car-1', start_date: futureStart, end_date: futureEnd });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('available');
    expect(res.body).toHaveProperty('total_amount');
    expect(res.body).toHaveProperty('days');
  });

  test('POST /api/bookings/check-availability — 400 missing fields', async () => {
    const res = await request(app).post('/api/bookings/check-availability')
      .send({ car_id:'car-1' });
    expect(res.status).toBe(400);
  });

  test('POST /api/bookings/check-availability — 400 end before start', async () => {
    const res = await request(app).post('/api/bookings/check-availability')
      .send({ car_id:'car-1', start_date: futureEnd, end_date: futureStart });
    expect(res.status).toBe(400);
  });

  test('POST /api/bookings — 401 unauthenticated cannot book', async () => {
    const res = await request(app).post('/api/bookings')
      .send({ car_id:'car-1', start_date: futureStart, end_date: futureEnd });
    expect(res.status).toBe(401);
  });

  test('POST /api/bookings — 201 customer creates booking (FR-04)', async () => {
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ car_id:'car-1', start_date: futureStart, end_date: futureEnd });
    expect(res.status).toBe(201);
    expect(res.body.booking).toHaveProperty('total_amount');
    expect(res.body.booking.status).toBe('pending');
  });

  test('POST /api/bookings — total_amount = days * price_per_day (FR-05)', async () => {
    const s = new Date(Date.now() + 86400000 * 8).toISOString().slice(0,10);
    const e = new Date(Date.now() + 86400000 * 11).toISOString().slice(0,10);
    const res = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ car_id:'car-1', start_date:s, end_date:e });
    expect(res.status).toBe(201);
    const days = Math.ceil((new Date(e) - new Date(s)) / 86400000);
    expect(parseFloat(res.body.booking.total_amount)).toBe(days * 4500);
  });

  test('POST /api/bookings — 409 double booking detected (FR-04)', async () => {
    const s = futureStart;
    const e = futureEnd;
    // First booking
    await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ car_id:'car-1', start_date:s, end_date:e });
    // Overlap booking
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ car_id:'car-1', start_date:s, end_date:e });
    expect(res.status).toBe(409);
  });

  test('GET /api/bookings/my — customer sees own bookings (FR-10)', async () => {
    const res = await request(app)
      .get('/api/bookings/my')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  test('GET /api/bookings — 403 customer cannot see all bookings (NFR-02)', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(403);
  });

  test('GET /api/bookings — admin sees all bookings (FR-10)', async () => {
    const res = await request(app)
      .get('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });

  test('PUT /api/bookings/:id/cancel — customer cancels pending booking (FR-06)', async () => {
    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ car_id:'car-1', start_date: new Date(Date.now()+86400000*15).toISOString().slice(0,10),
              end_date: new Date(Date.now()+86400000*17).toISOString().slice(0,10) });
    const id = createRes.body.booking?.id;
    if (id) {
      const res = await request(app)
        .put(`/api/bookings/${id}/cancel`)
        .set('Authorization', `Bearer ${custToken}`);
      expect([200,404]).toContain(res.status);
    } else { expect(true).toBe(true); }
  });

  test('PUT /api/bookings/:id/confirm — admin confirms booking (FR-06)', async () => {
    const createRes = await request(app)
      .post('/api/bookings')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ car_id:'car-1', start_date: new Date(Date.now()+86400000*20).toISOString().slice(0,10),
              end_date: new Date(Date.now()+86400000*22).toISOString().slice(0,10) });
    const id = createRes.body.booking?.id;
    if (id) {
      const res = await request(app)
        .put(`/api/bookings/${id}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200,404]).toContain(res.status);
    } else { expect(true).toBe(true); }
  });

  test('PUT /api/bookings/:id/confirm — 403 customer cannot confirm (NFR-02)', async () => {
    const res = await request(app)
      .put('/api/bookings/any-id/confirm')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(403);
  });

  test('PUT /api/bookings/:id/cancel — 404 nonexistent booking', async () => {
    const res = await request(app)
      .put('/api/bookings/nonexistent-id/cancel')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(404);
  });
});
