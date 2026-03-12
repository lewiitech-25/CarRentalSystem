// routes/users.js  — admin user management
const router = require('express').Router();
const pool   = require('../config/database');
const { requireAuth, requireAdmin } = require('../middleware/auth');

// GET /api/users  — admin: all customers
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [users] = await pool.execute(
      `SELECT u.id, u.name, u.email, u.phone, u.license_number, u.role, u.created_at,
              COUNT(b.id) as total_bookings
       FROM users u
       LEFT JOIN bookings b ON u.id = b.customer_id
       WHERE u.role = 'customer'
       GROUP BY u.id
       ORDER BY u.created_at DESC`
    );
    res.json({ users, total: users.length });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch users.' });
  }
});

// GET /api/users/:id  — admin: single user with bookings
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const [[user]] = await pool.execute(
      'SELECT id,name,email,phone,license_number,role,created_at FROM users WHERE id=?',
      [req.params.id]
    );
    if (!user) return res.status(404).json({ message: 'User not found.' });
    const [bookings] = await pool.execute(
      `SELECT b.*, c.make, c.model FROM bookings b JOIN cars c ON b.car_id=c.id
       WHERE b.customer_id=? ORDER BY b.created_at DESC`, [req.params.id]
    );
    res.json({ user, bookings });
  } catch (err) {
    res.status(500).json({ message: 'Failed to fetch user.' });
  }
});

module.exports = router;
