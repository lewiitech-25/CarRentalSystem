// routes/cars.js  — FR-02, FR-03, FR-09: Browse, Filter, Fleet Management
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool   = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/cars  — public, supports filters: category, max_price, min_price, status
router.get('/', async (req, res) => {
  try {
    const { category, min_price, max_price, status } = req.query;
    let query  = 'SELECT * FROM cars WHERE 1=1';
    const params = [];

    if (category)  { query += ' AND category = ?';         params.push(category); }
    if (min_price) { query += ' AND price_per_day >= ?';   params.push(parseFloat(min_price)); }
    if (max_price) { query += ' AND price_per_day <= ?';   params.push(parseFloat(max_price)); }
    if (status)    { query += ' AND status = ?';           params.push(status); }
    else           { query += ' AND status = "available"'; }   // default: show only available

    query += ' ORDER BY created_at DESC';
    const [cars] = await pool.execute(query, params);
    res.json({ cars, total: cars.length });
  } catch (err) {
    console.error('Get cars error:', err);
    res.status(500).json({ message: 'Failed to fetch cars.' });
  }
});

// GET /api/cars/all  — admin: all cars regardless of status
router.get('/all', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [cars] = await pool.execute('SELECT * FROM cars ORDER BY created_at DESC');
    res.json({ cars, total: cars.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch cars.' });
  }
});

// GET /api/cars/:id
router.get('/:id', async (req, res) => {
  try {
    const [[car]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (!car) return res.status(404).json({ message: 'Car not found.' });
    res.json({ car });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch car.' });
  }
});

// POST /api/cars  — admin only (FR-09)
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { make, model, year, category, price_per_day, color,
            transmission, fuel_type, seats, license_plate, description, image_url } = req.body;

    if (!make || !model || !year || !category || !price_per_day) {
      return res.status(400).json({ message: 'Make, model, year, category and price are required.' });
    }

    // Check duplicate license plate
    if (license_plate) {
      const [[dup]] = await pool.execute('SELECT id FROM cars WHERE license_plate = ?', [license_plate]);
      if (dup) return res.status(409).json({ message: 'License plate already registered.' });
    }

    const id = uuidv4();
    await pool.execute(
      `INSERT INTO cars (id,make,model,year,category,price_per_day,status,color,transmission,fuel_type,seats,license_plate,description,image_url)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, make, model, parseInt(year), category, parseFloat(price_per_day),
       'available', color||null, transmission||'Automatic', fuel_type||'Petrol',
       parseInt(seats)||5, license_plate||null, description||null, image_url||null]
    );
    const [[car]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [id]);
    res.status(201).json({ message: 'Car added successfully.', car });
  } catch (err) {
    console.error('Add car error:', err);
    res.status(500).json({ message: 'Failed to add car.' });
  }
});

// PUT /api/cars/:id  — admin only (FR-09)
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[car]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (!car) return res.status(404).json({ message: 'Car not found.' });

    const { make, model, year, category, price_per_day, status,
            color, transmission, fuel_type, seats, license_plate, description, image_url } = req.body;

    await pool.execute(
      `UPDATE cars SET make=?,model=?,year=?,category=?,price_per_day=?,status=?,
       color=?,transmission=?,fuel_type=?,seats=?,license_plate=?,description=?,image_url=?
       WHERE id=?`,
      [make||car.make, model||car.model, year||car.year, category||car.category,
       price_per_day||car.price_per_day, status||car.status,
       color||car.color, transmission||car.transmission, fuel_type||car.fuel_type,
       seats||car.seats, license_plate||car.license_plate, description||car.description,
       image_url||car.image_url, req.params.id]
    );
    const [[updated]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    res.json({ message: 'Car updated.', car: updated });
  } catch (err) {
    console.error('Update car error:', err);
    res.status(500).json({ message: 'Failed to update car.' });
  }
});

// DELETE /api/cars/:id  — admin only (FR-09)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[car]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [req.params.id]);
    if (!car) return res.status(404).json({ message: 'Car not found.' });

    // Check for active bookings
    const [[activeBooking]] = await pool.execute(
      `SELECT id FROM bookings WHERE car_id=? AND status IN ('pending','confirmed')`, [req.params.id]
    );
    if (activeBooking) {
      return res.status(400).json({ message: 'Cannot delete car with active bookings.' });
    }

    await pool.execute('DELETE FROM cars WHERE id = ?', [req.params.id]);
    res.json({ message: 'Car removed from fleet.' });
  } catch (err) {
    console.error('Delete car error:', err);
    res.status(500).json({ message: 'Failed to delete car.' });
  }
});

// GET /api/cars/stats/dashboard  — admin dashboard stats
router.get('/stats/dashboard', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[{ total_cars }]]     = await pool.execute('SELECT COUNT(*) as total_cars FROM cars');
    const [[{ available_cars }]] = await pool.execute('SELECT COUNT(*) as available_cars FROM cars WHERE status="available"');
    const [[{ rented_cars }]]    = await pool.execute('SELECT COUNT(*) as rented_cars FROM cars WHERE status="rented"');
    const [[{ total_customers }]]= await pool.execute('SELECT COUNT(*) as total_customers FROM users WHERE role="customer"');
    const [[{ total_revenue }]]  = await pool.execute('SELECT COALESCE(SUM(amount),0) as total_revenue FROM payments WHERE status="completed"');
    const [[{ total_bookings }]] = await pool.execute('SELECT COUNT(*) as total_bookings FROM bookings');

    res.json({ total_cars, available_cars, rented_cars, total_customers, total_revenue, total_bookings });
  } catch (err) {
    console.error('Dashboard stats error:', err);
    res.status(500).json({ message: 'Failed to fetch stats.' });
  }
});

module.exports = router;
