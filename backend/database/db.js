// database/db.js
// SQLite database setup using better-sqlite3
// Creates all tables matching the class diagram and seeds demo data

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DB_PATH = process.env.DB_PATH || './database/carrental.db';

// Ensure the database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─────────────────────────────────────────────
// CREATE TABLES
// ─────────────────────────────────────────────
db.exec(`
  -- Users table (Customer + Admin via role field)
  CREATE TABLE IF NOT EXISTS users (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    email       TEXT NOT NULL UNIQUE,
    password    TEXT NOT NULL,
    phone       TEXT NOT NULL,
    license_number TEXT,
    role        TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'admin')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Cars table (CarDatabase entity from class diagram)
  CREATE TABLE IF NOT EXISTS cars (
    id            TEXT PRIMARY KEY,
    make          TEXT NOT NULL,
    model         TEXT NOT NULL,
    year          INTEGER NOT NULL,
    category      TEXT NOT NULL CHECK(category IN ('Sedan','SUV','Hatchback','Luxury','Van','Pickup')),
    price_per_day REAL NOT NULL,
    status        TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','rented','maintenance')),
    license_plate TEXT NOT NULL UNIQUE,
    color         TEXT NOT NULL DEFAULT 'White',
    transmission  TEXT NOT NULL DEFAULT 'Automatic' CHECK(transmission IN ('Automatic','Manual')),
    fuel_type     TEXT NOT NULL DEFAULT 'Petrol' CHECK(fuel_type IN ('Petrol','Diesel','Electric','Hybrid')),
    seats         INTEGER NOT NULL DEFAULT 5,
    description   TEXT,
    image_url     TEXT,
    created_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Bookings table
  CREATE TABLE IF NOT EXISTS bookings (
    id            TEXT PRIMARY KEY,
    customer_id   TEXT NOT NULL REFERENCES users(id),
    car_id        TEXT NOT NULL REFERENCES cars(id),
    start_date    TEXT NOT NULL,
    end_date      TEXT NOT NULL,
    total_amount  REAL NOT NULL,
    status        TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
    created_at    TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Payments table
  CREATE TABLE IF NOT EXISTS payments (
    id                   TEXT PRIMARY KEY,
    booking_id           TEXT NOT NULL REFERENCES bookings(id),
    amount               REAL NOT NULL,
    payment_method       TEXT NOT NULL DEFAULT 'mpesa' CHECK(payment_method IN ('mpesa','card','cash')),
    status               TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','completed','failed','refunded')),
    mpesa_checkout_id    TEXT,
    mpesa_receipt_number TEXT,
    phone_number         TEXT,
    timestamp            TEXT NOT NULL DEFAULT (datetime('now'))
  );

  -- Receipts table
  CREATE TABLE IF NOT EXISTS receipts (
    id           TEXT PRIMARY KEY,
    booking_id   TEXT NOT NULL REFERENCES bookings(id),
    payment_id   TEXT NOT NULL REFERENCES payments(id),
    issue_date   TEXT NOT NULL DEFAULT (datetime('now')),
    total_amount REAL NOT NULL
  );

  -- Car condition log (car returns and damage tracking)
  CREATE TABLE IF NOT EXISTS car_condition_log (
    id          TEXT PRIMARY KEY,
    car_id      TEXT NOT NULL REFERENCES cars(id),
    booking_id  TEXT REFERENCES bookings(id),
    condition   TEXT NOT NULL DEFAULT 'good' CHECK(condition IN ('good','minor_damage','major_damage')),
    notes       TEXT,
    mileage     INTEGER,
    logged_at   TEXT NOT NULL DEFAULT (datetime('now')),
    logged_by   TEXT REFERENCES users(id)
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_bookings_car_id ON bookings(car_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_customer_id ON bookings(customer_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
  CREATE INDEX IF NOT EXISTS idx_cars_status ON cars(status);
  CREATE INDEX IF NOT EXISTS idx_cars_category ON cars(category);
  CREATE INDEX IF NOT EXISTS idx_payments_booking_id ON payments(booking_id);
`);

// ─────────────────────────────────────────────
// SEED DATA — only if tables are empty
// ─────────────────────────────────────────────
const userCount = db.prepare('SELECT COUNT(*) as c FROM users').get().c;

if (userCount === 0) {
  const { v4: uuidv4 } = require('uuid');

  // Seed admin user
  const adminHash = bcrypt.hashSync('admin123', 10);
  db.prepare(`INSERT INTO users (id, name, email, password, phone, role) VALUES (?, ?, ?, ?, ?, ?)`)
    .run(uuidv4(), 'System Admin', 'admin@carrental.com', adminHash, '0700000001', 'admin');

  // Seed customer user
  const custHash = bcrypt.hashSync('customer123', 10);
  const customerId = uuidv4();
  db.prepare(`INSERT INTO users (id, name, email, password, phone, license_number, role) VALUES (?, ?, ?, ?, ?, ?, ?)`)
    .run(customerId, 'John Kamau', 'john@example.com', custHash, '0712345678', 'DL-KE-2021-00123', 'customer');

  // Seed cars
  const insertCar = db.prepare(`
    INSERT INTO cars (id, make, model, year, category, price_per_day, status, license_plate, color, transmission, fuel_type, seats, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const cars = [
    [uuidv4(), 'Toyota',   'Corolla',   2022, 'Sedan',   4500,   'available', 'KDJ 001A', 'White',  'Automatic', 'Petrol', 5, 'Reliable and fuel-efficient sedan, perfect for city driving.'],
    [uuidv4(), 'Mazda',    'Demio',      2012, 'Hatchback',3500,  'available', 'KCK 234B', 'Silver', 'Manual',    'Petrol', 5, 'Compact and easy to park, great for urban commuting.'],
    [uuidv4(), 'Subaru',   'Outback',    2023, 'SUV',     50000,  'available', 'KDZ 500C', 'Blue',   'Automatic', 'Petrol', 5, 'All-wheel drive SUV ideal for off-road and highway travel.'],
    [uuidv4(), 'Suzuki',   'Alto',       2021, 'Hatchback',2500,  'available', 'KDA 112D', 'Red',    'Automatic', 'Petrol', 5, 'Budget-friendly and economical, great for short trips.'],
    [uuidv4(), 'Mercedes', 'C200',       2023, 'Luxury',  120000, 'available', 'KDG 777E', 'Black',  'Automatic', 'Petrol', 5, 'Premium luxury saloon with advanced tech and comfort.'],
    [uuidv4(), 'Porsche',  'Panamera',   2022, 'Luxury',  123000, 'available', 'KDE 911F', 'White',  'Automatic', 'Petrol', 4, 'High-performance luxury car for the discerning driver.'],
    [uuidv4(), 'Toyota',   'Land Cruiser',2020,'SUV',     35000,  'available', 'KCZ 300G', 'White',  'Automatic', 'Diesel', 7, '7-seater 4x4 ideal for safaris and group travel.'],
    [uuidv4(), 'Nissan',   'X-Trail',    2021, 'SUV',     18000,  'available', 'KDA 450H', 'Grey',   'Automatic', 'Petrol', 5, 'Comfortable crossover with great fuel economy.'],
    [uuidv4(), 'Toyota',   'HiAce',      2019, 'Van',     12000,  'available', 'KBZ 888I', 'White',  'Manual',    'Diesel', 14,'14-seater matatu-style van, ideal for group transfers.'],
    [uuidv4(), 'Ford',     'Ranger',     2022, 'Pickup',  22000,  'maintenance','KDD 200J','Silver', 'Automatic', 'Diesel', 5, 'Double-cab pickup for heavy-duty transport needs.'],
    [uuidv4(), 'Toyota',   'Vitz',        2018, 'Hatchback', 3000,   'available', 'KDG 123K', 'Pink',   'Automatic', 'Petrol', 5, 'Highly popular and fuel-efficient subcompact hatchback.'],
    [uuidv4(), 'Honda',    'Fit',         2019, 'Hatchback', 3200,   'available', 'KDF 456L', 'Blue',   'Automatic', 'Hybrid', 5, 'Spacious interior with excellent hybrid fuel economy.'],
    [uuidv4(), 'Volkswagen', 'Golf',       2017, 'Hatchback', 5500,   'available', 'KDB 789M', 'Black',  'Automatic', 'Petrol', 5, 'Sporty German engineering with premium interior feel.'],
    [uuidv4(), 'Toyota',   'Prado',       2021, 'SUV',       25000,  'available', 'KDL 001N', 'White',  'Automatic', 'Diesel', 7, 'The gold standard for luxury 4x4 rentals in Kenya.'],
    [uuidv4(), 'Mitsubishi', 'Pajero',     2015, 'SUV',       15000,  'available', 'KCP 555O', 'Silver', 'Automatic', 'Diesel', 7, 'Rugged off-roader capable of handling tough terrain.'],
    [uuidv4(), 'Land Rover', 'Defender',   2022, 'SUV',       65000,  'available', 'KDM 999P', 'Green',  'Automatic', 'Diesel', 5, 'Iconic luxury off-roader for high-end safari experiences.'],
    [uuidv4(), 'Toyota',   'Noah',        2016, 'Van',       8000,   'available', 'KCS 222Q', 'Silver', 'Automatic', 'Petrol', 8, '8-seater family van with sliding doors for easy access.'],
    [uuidv4(), 'Hyundai',  'Tucson',      2020, 'SUV',       12000,  'available', 'KDE 333R', 'White',  'Automatic', 'Petrol', 5, 'Modern crossover with great safety features and tech.'],
    [uuidv4(), 'BMW',      'X5',          2021, 'Luxury',    45000,  'available', 'KDJ 444S', 'Black',  'Automatic', 'Petrol', 5, 'High-performance luxury SUV for executive rentals.'],
    [uuidv4(), 'Isuzu',    'D-Max',       2023, 'Pickup',    20000,  'available', 'KDN 888T', 'White',  'Manual',    'Diesel', 5, 'Brand new double-cab pickup, perfect for site visits.']
  ];

  cars.forEach(car => insertCar.run(...car));

  console.log('✅ Database seeded with 2 users and 10 cars');
}

module.exports = db;
