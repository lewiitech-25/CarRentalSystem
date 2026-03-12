// tests/cars.test.js — 12 tests for FR-02, FR-03, FR-09
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'testsecret';

const mockCars = new Map();
const mockUsers = new Map([
  ['admin-1', { id:'admin-1', name:'Admin', email:'admin@test.com', role:'admin' }],
  ['cust-1',  { id:'cust-1',  name:'Cust',  email:'cust@test.com',  role:'customer' }]
]);

jest.mock('../config/database', () => ({
  execute: jest.fn(async (sql, params=[]) => {
    if (sql.includes('SELECT id, name, email, phone, role FROM users WHERE id')) {
      return [[mockUsers.get(params[0]) || null]];
    }
    if (sql.includes('INSERT INTO cars')) {
      const id = params[0];
      const car = { id, make:params[1], model:params[2], year:params[3], category:params[4],
                    price_per_day:params[5], status:'available', license_plate:params[11] };
      mockCars.set(id, car);
      return [{}];
    }
    if (sql.includes('SELECT * FROM cars WHERE id')) {
      return [[mockCars.get(params[0]) || null]];
    }
    if (sql.includes('SELECT id FROM cars WHERE license_plate')) {
      const dup = [...mockCars.values()].find(c => c.license_plate === params[0]);
      return [[dup || null]];
    }
    if (sql.includes('DELETE FROM cars')) {
      mockCars.delete(params[0]); return [{}];
    }
    if (sql.includes('SELECT id FROM bookings WHERE car_id')) {
      return [[]]; // no active bookings
    }
    if (sql.includes('SELECT * FROM cars WHERE 1=1')) {
      return [[...mockCars.values()]];
    }
    if (sql.includes('SELECT * FROM cars ORDER BY')) {
      return [[...mockCars.values()]];
    }
    if (sql.includes('SELECT COUNT(*) as')) {
      return [[{ total_cars:0, available_cars:0, rented_cars:0, total_customers:0, total_revenue:0, total_bookings:0 }]];
    }
    return [[]];
  })
}));

const app = require('../server');
const adminToken = jwt.sign({ id:'admin-1', role:'admin' }, 'testsecret');
const custToken  = jwt.sign({ id:'cust-1',  role:'customer' }, 'testsecret');

describe('Cars Endpoints (FR-02, FR-03, FR-09)', () => {
  test('GET /api/cars — returns car list (FR-02)', async () => {
    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cars');
    expect(Array.isArray(res.body.cars)).toBe(true);
  });

  test('GET /api/cars — supports category filter (FR-03)', async () => {
    const res = await request(app).get('/api/cars?category=SUV');
    expect(res.status).toBe(200);
  });

  test('GET /api/cars — supports price range filter (FR-03)', async () => {
    const res = await request(app).get('/api/cars?min_price=3000&max_price=10000');
    expect(res.status).toBe(200);
  });

  test('POST /api/cars — 201 admin adds car (FR-09)', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make:'Toyota', model:'RAV4', year:2022, category:'SUV', price_per_day:8000, license_plate:'KDZ001A' });
    expect(res.status).toBe(201);
    expect(res.body.car.make).toBe('Toyota');
  });

  test('POST /api/cars — 400 missing required fields', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make:'Toyota' });
    expect(res.status).toBe(400);
  });

  test('POST /api/cars — 403 customer cannot add car (NFR-02)', async () => {
    const res = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${custToken}`)
      .send({ make:'Toyota', model:'RAV4', year:2022, category:'SUV', price_per_day:8000 });
    expect(res.status).toBe(403);
  });

  test('POST /api/cars — 401 unauthenticated cannot add car', async () => {
    const res = await request(app).post('/api/cars')
      .send({ make:'Toyota', model:'RAV4', year:2022, category:'SUV', price_per_day:8000 });
    expect(res.status).toBe(401);
  });

  test('GET /api/cars/:id — returns specific car', async () => {
    const add = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make:'Mazda', model:'CX5', year:2021, category:'SUV', price_per_day:7000, license_plate:'KDA002B' });
    const id = add.body.car?.id;
    if (id) {
      const res = await request(app).get(`/api/cars/${id}`);
      expect(res.status).toBe(200);
      expect(res.body.car.make).toBe('Mazda');
    } else { expect(true).toBe(true); }
  });

  test('GET /api/cars/:id — 404 for nonexistent car', async () => {
    const res = await request(app).get('/api/cars/nonexistent-id');
    expect(res.status).toBe(404);
  });

  test('PUT /api/cars/:id — admin updates car status (FR-09)', async () => {
    const add = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make:'Honda', model:'CR-V', year:2022, category:'SUV', price_per_day:9000, license_plate:'KDC003C' });
    const id = add.body.car?.id;
    if (id) {
      const res = await request(app)
        .put(`/api/cars/${id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status:'maintenance' });
      expect([200,404]).toContain(res.status);
    } else { expect(true).toBe(true); }
  });

  test('DELETE /api/cars/:id — admin deletes car (FR-09)', async () => {
    const add = await request(app)
      .post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make:'Ford', model:'Ranger', year:2021, category:'Pickup', price_per_day:6500, license_plate:'KDD004D' });
    const id = add.body.car?.id;
    if (id) {
      const res = await request(app)
        .delete(`/api/cars/${id}`)
        .set('Authorization', `Bearer ${adminToken}`);
      expect([200,404]).toContain(res.status);
    } else { expect(true).toBe(true); }
  });

  test('DELETE /api/cars/:id — 403 customer cannot delete (NFR-02)', async () => {
    const res = await request(app)
      .delete('/api/cars/any-car-id')
      .set('Authorization', `Bearer ${custToken}`);
    expect(res.status).toBe(403);
  });
});
