// tests/integration.test.js — 8 end-to-end flow tests
const request = require('supertest');
const jwt = require('jsonwebtoken');
process.env.JWT_SECRET = 'testsecret';

// Full in-memory DB simulation for integration tests
const db = { users: new Map(), cars: new Map(), bookings: new Map(), payments: new Map(), receipts: new Map() };
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');

jest.mock('../config/database', () => ({
  execute: jest.fn(async (sql, params=[]) => {
    // Users
    if (sql.includes('SELECT id FROM users WHERE email')) {
      const u = [...db.users.values()].find(u => u.email === params[0]);
      return [[u ? { id: u.id } : null]];
    }
    if (sql.includes('INSERT INTO users')) {
      const [id,name,email,password,phone,license_number,role] = params;
      db.users.set(id, {id,name,email,password,phone,license_number,role});
      return [{}];
    }
    if (sql.includes('SELECT id,name,email,phone,license_number,role FROM users WHERE id')) {
      const u = db.users.get(params[0]);
      return [[u ? {...u} : null]];
    }
    if (sql.includes('SELECT * FROM users WHERE email')) {
      const u = [...db.users.values()].find(u => u.email === params[0]);
      return [[u ? {...u} : null]];
    }
    if (sql.includes('SELECT id, name, email, phone, role FROM users WHERE id')) {
      const u = db.users.get(params[0]);
      return [[u ? {id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role} : null]];
    }
    // Cars
    if (sql.includes('INSERT INTO cars')) {
      const [id,make,model,year,category,price_per_day,status,color,transmission,fuel_type,seats,lp,desc_] = params;
      db.cars.set(id, {id,make,model,year,category,price_per_day,status:'available',color,transmission,fuel_type,seats,license_plate:lp,description:desc_});
      return [{}];
    }
    if (sql.includes('SELECT * FROM cars WHERE id')) {
      return [[db.cars.get(params[0]) || null]];
    }
    if (sql.includes('SELECT id FROM cars WHERE license_plate')) {
      const c = [...db.cars.values()].find(c => c.license_plate === params[0]);
      return [[c || null]];
    }
    if (sql.includes('SELECT * FROM cars WHERE 1=1') || sql.includes('SELECT * FROM cars ORDER BY')) {
      return [[...db.cars.values()]];
    }
    // Overlap
    if (sql.includes('NOT (end_date < ? OR start_date > ?)')) {
      const conflicts = [...db.bookings.values()].filter(b =>
        b.car_id === params[0] && b.status !== 'cancelled' &&
        !(params[2] < b.start_date || params[1] > b.end_date)
      );
      return [conflicts];
    }
    // Bookings
    if (sql.includes('INSERT INTO bookings')) {
      const [id,customer_id,car_id,start_date,end_date,total_amount,status] = params;
      db.bookings.set(id, {id,customer_id,car_id,start_date,end_date,total_amount,status});
      return [{}];
    }
    if (sql.includes('FROM bookings b') && sql.includes('WHERE b.id =')) {
      const b = db.bookings.get(params[0]);
      if (!b) return [[null]];
      const car = db.cars.get(b.car_id) || {};
      const user = db.users.get(b.customer_id) || {};
      return [[{ ...b, make:car.make, model:car.model, year:car.year, category:car.category,
                 price_per_day:car.price_per_day, image_url:null,
                 customer_name:user.name, customer_email:user.email, customer_phone:user.phone }]];
    }
    if (sql.includes('WHERE b.customer_id =')) {
      return [[...db.bookings.values()].filter(b => b.customer_id === params[0])];
    }
    if (sql.includes('SELECT * FROM bookings WHERE id')) {
      return [[db.bookings.get(params[0]) || null]];
    }
    if (sql.includes('UPDATE bookings SET status=')) {
      const b = db.bookings.get(params[1]);
      if (b) b.status = params[0].replace(/'/g,'');
      return [{}];
    }
    // Payments
    if (sql.includes('SELECT id FROM payments WHERE booking_id')) {
      return [[db.payments.has(params[0]) ? { id: params[0] } : null]];
    }
    if (sql.includes('INSERT INTO payments')) {
      const [id,booking_id,amount,method,status,checkout_id,phone] = params;
      db.payments.set(booking_id, {id,booking_id,amount,payment_method:method,status,mpesa_checkout_id:checkout_id,mpesa_receipt_number:null});
      return [{}];
    }
    if (sql.includes('SELECT * FROM payments WHERE booking_id')) {
      return [[db.payments.get(params[0]) || null]];
    }
    if (sql.includes("UPDATE payments SET status='completed'")) {
      const p = [...db.payments.values()].find(p => p.id === params[2]);
      if (p) { p.status='completed'; p.mpesa_receipt_number=params[0]; }
      return [{}];
    }
    // Receipts
    if (sql.includes('SELECT id FROM receipts WHERE booking_id')) {
      return [[db.receipts.has(params[0]) ? { id:params[0] } : null]];
    }
    if (sql.includes('INSERT INTO receipts')) {
      db.receipts.set(params[1], {id:params[0],booking_id:params[1],payment_id:params[2],total_amount:params[3]});
      return [{}];
    }
    if (sql.includes('UPDATE cars SET status=')) return [{}];
    if (sql.includes('INSERT INTO car_condition_log')) return [{}];
    if (sql.includes('COALESCE(SUM(amount),0)')) return [[{ grand_total:0, month_total:0 }]];
    if (sql.includes('SELECT COUNT(*)')) return [[{ total_cars:0, available_cars:0, rented_cars:0, total_customers:0, total_revenue:0, total_bookings:0 }]];
    return [[]];
  })
}));

const app = require('../server');

describe('Integration Tests — Full Booking Flow', () => {
  let customerToken, adminToken, carId, bookingId;

  test('1. Customer registers successfully', async () => {
    const res = await request(app).post('/api/auth/register').send({
      name:'Jane Customer', email:'jane@integration.com', password:'securepass123', phone:'+254722000001'
    });
    expect(res.status).toBe(201);
    customerToken = res.body.token;
    expect(customerToken).toBeDefined();
  });

  test('2. Customer can log in and receive token', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email:'jane@integration.com', password:'securepass123'
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  test('3. Admin registers and adds a car to fleet (FR-09)', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name:'Admin User', email:'admin@integration.com', password:'adminpass123', phone:'+254700000000'
    });
    // Force admin role in mock
    const adminUser = [...db.users.values()].find(u => u.email === 'admin@integration.com');
    if (adminUser) adminUser.role = 'admin';
    adminToken = jwt.sign({ id: adminUser?.id, role:'admin' }, 'testsecret');

    const carRes = await request(app).post('/api/cars')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ make:'Toyota', model:'Corolla', year:2023, category:'Sedan', price_per_day:4500, license_plate:'INT001A' });
    expect(carRes.status).toBe(201);
    carId = carRes.body.car.id;
  });

  test('4. Customer checks car availability (FR-03, FR-04)', async () => {
    const s = new Date(Date.now()+86400000*2).toISOString().slice(0,10);
    const e = new Date(Date.now()+86400000*5).toISOString().slice(0,10);
    const res = await request(app).post('/api/bookings/check-availability')
      .send({ car_id: carId, start_date:s, end_date:e });
    expect(res.status).toBe(200);
    expect(res.body.available).toBe(true);
  });

  test('5. Customer creates a booking with correct cost (FR-04, FR-05)', async () => {
    const s = new Date(Date.now()+86400000*2).toISOString().slice(0,10);
    const e = new Date(Date.now()+86400000*5).toISOString().slice(0,10);
    const res = await request(app).post('/api/bookings')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ car_id: carId, start_date:s, end_date:e });
    expect(res.status).toBe(201);
    bookingId = res.body.booking.id;
    const days = Math.ceil((new Date(e)-new Date(s))/86400000);
    expect(parseFloat(res.body.booking.total_amount)).toBe(days * 4500);
  });

  test('6. Payment initiated via STK Push simulation (FR-07)', async () => {
    const res = await request(app).post('/api/payments/stk-push')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ booking_id: bookingId, phone:'0722000001' });
    expect(res.status).toBe(200);
    expect(res.body.checkout_request_id).toBeDefined();
  });

  test('7. Customer views own booking history (FR-10)', async () => {
    const res = await request(app).get('/api/bookings/my')
      .set('Authorization', `Bearer ${customerToken}`);
    expect(res.status).toBe(200);
    expect(res.body.bookings.length).toBeGreaterThan(0);
  });

  test('8. Admin views all bookings (FR-10, NFR-02)', async () => {
    const res = await request(app).get('/api/bookings')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.bookings)).toBe(true);
  });
});
