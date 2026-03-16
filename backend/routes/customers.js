const router = require('express').Router();
const pool   = require('../config/database');

// GET /api/customers — public, returns all customers
router.get('/', async (req, res) => {
  try {
    const [customers] = await pool.execute(
      `SELECT id as customerId, name, email, phone, license_number as licenseNumber
       FROM users WHERE role = 'customer' ORDER BY created_at DESC`
    );
    res.json(customers);
  } catch (err) {
    console.error('Get customers error:', err);
    res.status(500).json({ message: 'Failed to fetch customers.' });
  }
});

// POST /api/customers — add a customer
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, licenseNumber } = req.body;
    if (!name || !email || !phone) {
      return res.status(400).json({ message: 'Name, email and phone are required.' });
    }
    const { v4: uuidv4 } = require('uuid');
    const bcrypt = require('bcryptjs');
    const id   = uuidv4();
    const hash = await bcrypt.hash('customer123', 10);
    await pool.execute(
      'INSERT INTO users (id,name,email,password,phone,license_number,role) VALUES (?,?,?,?,?,?,?)',
      [id, name, email, hash, phone, licenseNumber||null, 'customer']
    );
    res.status(201).json({ message: 'Customer added.', customerId: id, name, email, phone });
  } catch (err) {
    console.error('Add customer error:', err);
    res.status(500).json({ message: 'Failed to add customer.' });
  }
});

module.exports = router;