// config/init.js
// Creates all tables if they don't exist and seeds demo data
const pool = require('./database');

async function initDatabase() {
  const conn = await pool.getConnection();
  try {
    console.log('🗄️  Initialising database...');

    // ── USERS ─────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id          VARCHAR(36)  PRIMARY KEY,
        name        VARCHAR(100) NOT NULL,
        email       VARCHAR(150) NOT NULL UNIQUE,
        password    VARCHAR(255) NOT NULL,
        phone       VARCHAR(20),
        license_number VARCHAR(50),
        role        ENUM('customer','admin') NOT NULL DEFAULT 'customer',
        created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ── CARS ──────────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS cars (
        id            VARCHAR(36)  PRIMARY KEY,
        make          VARCHAR(80)  NOT NULL,
        model         VARCHAR(80)  NOT NULL,
        year          INT          NOT NULL,
        category      ENUM('Sedan','SUV','Hatchback','Luxury','Van','Pickup','Convertible') NOT NULL,
        price_per_day DECIMAL(10,2) NOT NULL,
        status        ENUM('available','rented','maintenance') NOT NULL DEFAULT 'available',
        color         VARCHAR(50),
        transmission  ENUM('Manual','Automatic') DEFAULT 'Automatic',
        fuel_type     ENUM('Petrol','Diesel','Electric','Hybrid') DEFAULT 'Petrol',
        seats         INT DEFAULT 5,
        license_plate VARCHAR(20) UNIQUE,
        description   TEXT,
        image_url     VARCHAR(500),
        created_at    DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // ── BOOKINGS ──────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS bookings (
        id           VARCHAR(36)  PRIMARY KEY,
        customer_id  VARCHAR(36)  NOT NULL,
        car_id       VARCHAR(36)  NOT NULL,
        start_date   DATE         NOT NULL,
        end_date     DATE         NOT NULL,
        total_amount DECIMAL(10,2) NOT NULL,
        status       ENUM('pending','confirmed','cancelled','completed') NOT NULL DEFAULT 'pending',
        notes        TEXT,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES users(id) ON DELETE CASCADE,
        FOREIGN KEY (car_id)      REFERENCES cars(id)  ON DELETE CASCADE
      )
    `);

    // ── PAYMENTS ──────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id                  VARCHAR(36)  PRIMARY KEY,
        booking_id          VARCHAR(36)  NOT NULL UNIQUE,
        amount              DECIMAL(10,2) NOT NULL,
        payment_method      ENUM('mpesa','card','cash') NOT NULL DEFAULT 'mpesa',
        status              ENUM('pending','completed','failed','refunded') NOT NULL DEFAULT 'pending',
        mpesa_checkout_id   VARCHAR(100),
        mpesa_receipt_number VARCHAR(100),
        phone_number        VARCHAR(20),
        transaction_date    DATETIME,
        created_at          DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at          DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE
      )
    `);

    // ── RECEIPTS ──────────────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS receipts (
        id           VARCHAR(36)  PRIMARY KEY,
        booking_id   VARCHAR(36)  NOT NULL UNIQUE,
        payment_id   VARCHAR(36)  NOT NULL,
        issue_date   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        total_amount DECIMAL(10,2) NOT NULL,
        created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
        FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE
      )
    `);

    // ── CAR CONDITION LOG ─────────────────────────────────
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS car_condition_log (
        id            VARCHAR(36) PRIMARY KEY,
        car_id        VARCHAR(36) NOT NULL,
        booking_id    VARCHAR(36),
        condition_at  ENUM('pickup','return') NOT NULL,
        mileage       INT,
        fuel_level    ENUM('full','3/4','1/2','1/4','empty') DEFAULT 'full',
        damage_notes  TEXT,
        logged_by     VARCHAR(36),
        logged_at     DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (car_id)     REFERENCES cars(id) ON DELETE CASCADE,
        FOREIGN KEY (booking_id) REFERENCES bookings(id) ON DELETE SET NULL
      )
    `);

    console.log('✅ Tables ready');

    // ── SEED ADMIN USER ───────────────────────────────────
    const bcrypt = require('bcryptjs');
    const { v4: uuidv4 } = require('uuid');

    const [[adminExists]] = await conn.execute(
      'SELECT id FROM users WHERE email = ?', ['admin@carrental.com']
    );
    if (!adminExists) {
      const hash = await bcrypt.hash('admin123', 10);
      await conn.execute(
        `INSERT INTO users (id,name,email,password,phone,role) VALUES (?,?,?,?,?,?)`,
        [uuidv4(), 'System Admin', 'admin@carrental.com', hash, '+254700000000', 'admin']
      );
      console.log('✅ Admin user seeded  → admin@carrental.com / admin123');
    }

    // ── SEED DEMO CUSTOMER ────────────────────────────────
    const [[custExists]] = await conn.execute(
      'SELECT id FROM users WHERE email = ?', ['john@example.com']
    );
    if (!custExists) {
      const hash = await bcrypt.hash('customer123', 10);
      await conn.execute(
        `INSERT INTO users (id,name,email,password,phone,license_number,role) VALUES (?,?,?,?,?,?,?)`,
        [uuidv4(), 'John Doe', 'john@example.com', hash, '+254711111111', 'DL-2021-KE-001', 'customer']
      );
      console.log('✅ Demo customer seeded  → john@example.com / customer123');
    }

    // ── SEED CARS ─────────────────────────────────────────
    const [[carCount]] = await conn.execute('SELECT COUNT(*) as cnt FROM cars');
    if (carCount.cnt === 0) {
      const cars = [
        [uuidv4(),'Subaru','Outback',2023,'SUV',50000,'available','Silver','Automatic','Petrol',5,'KBZ 001A','Rugged AWD SUV perfect for both city and off-road.'],
        [uuidv4(),'Suzuki','Alto',2021,'Hatchback',2500,'available','White','Manual','Petrol',4,'KBY 002B','Fuel-efficient city runabout, easy to park.'],
        [uuidv4(),'Toyota','Corolla',2022,'Sedan',4500,'available','Black','Automatic','Petrol',5,'KCA 003C','Reliable family sedan with excellent fuel economy.'],
        [uuidv4(),'Mazda','Demio',2012,'Hatchback',3500,'available','Red','Manual','Petrol',5,'KBP 004D','Compact and peppy, great for urban commuting.'],
        [uuidv4(),'Mercedes-Benz','C200',2023,'Luxury',12000,'available','Pearl White','Automatic','Petrol',5,'KDG 005E','Elegant executive saloon with premium features.'],
        [uuidv4(),'Porsche','Panamera',2022,'Luxury',12300,'available','Midnight Blue','Automatic','Petrol',4,'KDJ 006F','Exhilarating performance meets luxury comfort.'],
        [uuidv4(),'Toyota','HiAce',2020,'Van',8000,'available','White','Manual','Diesel',14,'KCG 007G','Spacious 14-seater, ideal for group travel.'],
        [uuidv4(),'Toyota','Land Cruiser',2021,'SUV',15000,'available','Bronze','Automatic','Diesel',7,'KCT 008H','Ultimate off-road capability, 7-seater.'],
        [uuidv4(),'Nissan','X-Trail',2022,'SUV',7000,'available','Graphite','Automatic','Petrol',7,'KDA 009I','Versatile family SUV with 7 seats.'],
        [uuidv4(),'Volkswagen','Polo',2023,'Sedan',3800,'available','Blue','Automatic','Petrol',5,'KDB 010J','Modern compact sedan with advanced safety features.'],
      ];
      for (const car of cars) {
        await conn.execute(
          `INSERT INTO cars (id,make,model,year,category,price_per_day,status,color,transmission,fuel_type,seats,license_plate,description)
           VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          car
        );
      }
      console.log('✅ 10 cars seeded');
    }

    console.log('🚗 Database initialisation complete\n');
  } finally {
    conn.release();
  }
}

module.exports = initDatabase;
