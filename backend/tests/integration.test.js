const request = require('supertest');
const app = require('../server');

describe('Integration Tests', () => {
  test('GET /health returns ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  test('GET /api/cars returns cars array', async () => {
    const res = await request(app).get('/api/cars');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('cars');
    expect(Array.isArray(res.body.cars)).toBe(true);
  });

  test('GET /api/customers returns array', async () => {
    const res = await request(app).get('/api/customers');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /api/bookings returns bookings', async () => {
    const res = await request(app).get('/api/bookings');
    expect(res.status).toBe(200);
  });

  test('POST /api/auth/login with wrong password returns 401', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'wrong@test.com', password: 'wrong' });
    expect(res.status).toBe(401);
  });

  test('POST /api/auth/register with missing fields returns 400', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'test@test.com' });
    expect(res.status).toBe(400);
  });

  test('GET unknown route returns 404', async () => {
    const res = await request(app).get('/api/unknown');
    expect(res.status).toBe(404);
  });

  test('POST /api/bookings with missing fields returns 400', async () => {
    const res = await request(app).post('/api/bookings').send({});
    expect(res.status).toBe(400);
  });
});