// tests/auth.test.js — 8 tests for FR-01
const request = require('supertest');

// Use in-memory mock so tests run without a real DB
jest.mock('../config/database', () => {
  const users = new Map();
  return {
    execute: jest.fn(async (sql, params) => {
      if (sql.includes('SELECT id FROM users WHERE email')) {
        const user = [...users.values()].find(u => u.email === params[0]);
        return [[user || null]];
      }
      if (sql.includes('INSERT INTO users')) {
        const [id,name,email,password,phone,license_number,role] = params;
        users.set(id, {id,name,email,password,phone,license_number,role});
        return [{ insertId: id }];
      }
      if (sql.includes('SELECT id,name,email,phone,license_number,role FROM users WHERE id')) {
        const user = users.get(params[0]);
        return [[user || null]];
      }
      if (sql.includes('SELECT * FROM users WHERE email')) {
        const user = [...users.values()].find(u => u.email === params[0]);
        return [[user || null]];
      }
      if (sql.includes('SELECT id, name, email, phone, role FROM users WHERE id')) {
        const user = users.get(params[0]);
        return [[user || null]];
      }
      return [[]];
    })
  };
});

const app = require('../server');

describe('Auth Endpoints (FR-01)', () => {
  test('POST /api/auth/register — success with valid data', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Test User', email: 'test@example.com', password: 'password123', phone: '+254700000001'
    });
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user.email).toBe('test@example.com');
    expect(res.body.user).not.toHaveProperty('password');
  });

  test('POST /api/auth/register — 400 when fields missing', async () => {
    const res = await request(app).post('/api/auth/register').send({ name: 'No Email' });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });

  test('POST /api/auth/register — 400 for invalid email format', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad', email: 'notanemail', password: 'password123'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/email/i);
  });

  test('POST /api/auth/register — 400 for weak password (< 8 chars)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name: 'Bad', email: 'weak@example.com', password: '123'
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/password/i);
  });

  test('POST /api/auth/register — 409 for duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'First', email: 'dup@example.com', password: 'password123'
    });
    const res = await request(app).post('/api/auth/register').send({
      name: 'Second', email: 'dup@example.com', password: 'password123'
    });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already registered/i);
  });

  test('POST /api/auth/login — 400 when fields missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'only@email.com' });
    expect(res.status).toBe(400);
  });

  test('POST /api/auth/login — 401 for wrong password', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Login Test', email: 'login@example.com', password: 'correctpass'
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com', password: 'wrongpass'
    });
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me — 401 without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });
});
