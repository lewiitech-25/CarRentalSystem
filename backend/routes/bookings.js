// routes/bookings.js  — FR-04, FR-05, FR-06, FR-10
const router = require('express').Router();
const { v4: uuidv4 } = require('uuid');
const pool   = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// Overlap detection query — returns true if car is available for the dates
async function isCarAvailable(carId, startDate, endDate, excludeBookingId = null) {
  let query = `
    SELECT id FROM bookings
    WHERE car_id = ?
      AND status NOT IN ('cancelled')
      AND NOT (end_date < ? OR start_date > ?)
  `;
  const params = [carId, startDate, endDate];
  if (excludeBookingId) { query += ' AND id != ?'; params.push(excludeBookingId); }

  const [rows] = await pool.execute(query, params);
  return rows.length === 0;
}

// POST /api/bookings/check-availability
router.post('/check-availability', async (req, res) => {
  try {
    const { car_id, start_date, end_date } = req.body;
    if (!car_id || !start_date || !end_date) {
      return res.status(400).json({ message: 'car_id, start_date and end_date are required.' });
    }
    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ message: 'end_date must be after start_date.' });
    }

    const [[car]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [car_id]);
    if (!car) return res.status(404).json({ message: 'Car not found.' });
    if (car.status === 'maintenance') {
      return res.json({ available: false, reason: 'Car is under maintenance.' });
    }

    const available = await isCarAvailable(car_id, start_date, end_date);
    if (!available) {
      return res.json({ available: false, reason: 'Car already booked for selected dates.' });
    }

    // FR-05: Calculate total
    const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
    const total_amount = days * parseFloat(car.price_per_day);
    res.json({ available: true, days, price_per_day: car.price_per_day, total_amount, car });
  } catch (err) {
    console.error('Availability check error:', err);
    res.status(500).json({ message: 'Failed to check availability.' });
  }
});

// POST /api/bookings  — create booking (FR-04)
router.post('/', requireAuth, async (req, res) => {
  try {
    const { car_id, start_date, end_date, notes } = req.body;
    if (!car_id || !start_date || !end_date) {
      return res.status(400).json({ message: 'car_id, start_date and end_date are required.' });
    }
    if (new Date(end_date) <= new Date(start_date)) {
      return res.status(400).json({ message: 'end_date must be after start_date.' });
    }
    if (new Date(start_date) < new Date().setHours(0,0,0,0)) {
      return res.status(400).json({ message: 'start_date cannot be in the past.' });
    }

    const [[car]] = await pool.execute('SELECT * FROM cars WHERE id = ?', [car_id]);
    if (!car) return res.status(404).json({ message: 'Car not found.' });
    if (car.status === 'maintenance') {
      return res.status(400).json({ message: 'Car is under maintenance.' });
    }

    const available = await isCarAvailable(car_id, start_date, end_date);
    if (!available) {
      return res.status(409).json({ message: 'Car is not available for the selected dates.' });
    }

    const days = Math.ceil((new Date(end_date) - new Date(start_date)) / (1000 * 60 * 60 * 24));
    const total_amount = days * parseFloat(car.price_per_day);
    const id = uuidv4();

    await pool.execute(
      'INSERT INTO bookings (id,customer_id,car_id,start_date,end_date,total_amount,status,notes) VALUES (?,?,?,?,?,?,?,?)',
      [id, req.user.id, car_id, start_date, end_date, total_amount, 'pending', notes||null]
    );

    const [[booking]] = await pool.execute(
      `SELECT b.*, c.make, c.model, c.year, c.category, c.price_per_day, c.image_url,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       JOIN users u ON b.customer_id = u.id
       WHERE b.id = ?`, [id]
    );
    res.status(201).json({ message: 'Booking created successfully.', booking });
  } catch (err) {
    console.error('Create booking error:', err);
    res.status(500).json({ message: 'Failed to create booking.' });
  }
});

// GET /api/bookings/my  — customer's own bookings (FR-10)
router.get('/my', requireAuth, async (req, res) => {
  try {
    const [bookings] = await pool.execute(
      `SELECT b.*, c.make, c.model, c.year, c.category, c.image_url, c.price_per_day,
              p.status as payment_status, p.mpesa_receipt_number
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.customer_id = ?
       ORDER BY b.created_at DESC`,
      [req.user.id]
    );
    res.json({ bookings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
});

// GET /api/bookings  — admin: all bookings (FR-10)
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { status, start_date, end_date, customer_id } = req.query;
    let query = `
      SELECT b.*, c.make, c.model, c.year, c.category, c.image_url,
             u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
             p.status as payment_status, p.mpesa_receipt_number, p.payment_method
      FROM bookings b
      JOIN cars c ON b.car_id = c.id
      JOIN users u ON b.customer_id = u.id
      LEFT JOIN payments p ON b.id = p.booking_id
      WHERE 1=1
    `;
    const params = [];
    if (status)      { query += ' AND b.status = ?';       params.push(status); }
    if (customer_id) { query += ' AND b.customer_id = ?';  params.push(customer_id); }
    if (start_date)  { query += ' AND b.start_date >= ?';  params.push(start_date); }
    if (end_date)    { query += ' AND b.end_date <= ?';    params.push(end_date); }
    query += ' ORDER BY b.created_at DESC';

    const [bookings] = await pool.execute(query, params);
    res.json({ bookings, total: bookings.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch bookings.' });
  }
});

// GET /api/bookings/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const [[booking]] = await pool.execute(
      `SELECT b.*, c.make, c.model, c.year, c.category, c.price_per_day, c.image_url, c.color, c.transmission,
              u.name as customer_name, u.email as customer_email, u.phone as customer_phone,
              p.status as payment_status, p.mpesa_receipt_number, p.payment_method, p.transaction_date
       FROM bookings b
       JOIN cars c ON b.car_id = c.id
       JOIN users u ON b.customer_id = u.id
       LEFT JOIN payments p ON b.id = p.booking_id
       WHERE b.id = ?`, [req.params.id]
    );
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    // Customers can only view their own bookings
    if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    res.json({ booking });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch booking.' });
  }
});

// PUT /api/bookings/:id/cancel  — customer cancel (FR-06)
router.put('/:id/cancel', requireAuth, async (req, res) => {
  try {
    const [[booking]] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (req.user.role === 'customer' && booking.customer_id !== req.user.id) {
      return res.status(403).json({ message: 'Access denied.' });
    }
    if (!['pending', 'confirmed'].includes(booking.status)) {
      return res.status(400).json({ message: `Cannot cancel a booking with status: ${booking.status}.` });
    }
    await pool.execute("UPDATE bookings SET status='cancelled' WHERE id=?", [req.params.id]);
    await pool.execute("UPDATE cars SET status='available' WHERE id=?", [booking.car_id]);
    res.json({ message: 'Booking cancelled successfully.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to cancel booking.' });
  }
});

// PUT /api/bookings/:id/confirm  — admin confirm (FR-06)
router.put('/:id/confirm', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[booking]] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending bookings can be confirmed.' });
    }
    await pool.execute("UPDATE bookings SET status='confirmed' WHERE id=?", [req.params.id]);
    await pool.execute("UPDATE cars SET status='rented' WHERE id=?", [booking.car_id]);
    res.json({ message: 'Booking confirmed.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to confirm booking.' });
  }
});

// PUT /api/bookings/:id/complete  — admin mark complete + log return (FR-06)
router.put('/:id/complete', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[booking]] = await pool.execute('SELECT * FROM bookings WHERE id = ?', [req.params.id]);
    if (!booking) return res.status(404).json({ message: 'Booking not found.' });
    if (booking.status !== 'confirmed') {
      return res.status(400).json({ message: 'Only confirmed bookings can be completed.' });
    }

    const { mileage, fuel_level, damage_notes } = req.body;
    await pool.execute("UPDATE bookings SET status='completed' WHERE id=?", [req.params.id]);
    await pool.execute("UPDATE cars SET status='available' WHERE id=?", [booking.car_id]);

    // Log condition
    await pool.execute(
      'INSERT INTO car_condition_log (id,car_id,booking_id,condition_at,mileage,fuel_level,damage_notes,logged_by) VALUES (?,?,?,?,?,?,?,?)',
      [uuidv4(), booking.car_id, booking.id, 'return', mileage||null, fuel_level||'full', damage_notes||null, req.user.id]
    );
    res.json({ message: 'Booking completed and car returned.' });
  } catch (err) {
    res.status(500).json({ message: 'Failed to complete booking.' });
  }
});

module.exports = router;
