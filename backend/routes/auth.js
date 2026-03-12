// routes/auth.js  — FR-01: User Registration & Authentication
const router  = require('express').Router();
const bcrypt  = require('bcryptjs');
const jwt     = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const pool    = require('../config/database');
const { requireAuth } = require('../middleware/auth');

function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, phone, license_number } = req.body;

    // Validation
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email and password are required.' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'Invalid email format.' });
    }
    if (password.length < 8) {
      return res.status(400).json({ message: 'Password must be at least 8 characters.' });
    }

    // Duplicate email check
    const [[existing]] = await pool.execute('SELECT id FROM users WHERE email = ?', [email]);
    if (existing) {
      return res.status(409).json({ message: 'Email already registered.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const id   = uuidv4();
    await pool.execute(
      'INSERT INTO users (id,name,email,password,phone,license_number,role) VALUES (?,?,?,?,?,?,?)',
      [id, name.trim(), email.toLowerCase().trim(), hash, phone || null, license_number || null, 'customer']
    );

    const [[user]] = await pool.execute(
      'SELECT id,name,email,phone,license_number,role FROM users WHERE id = ?', [id]
    );
    const token = generateToken(user);
    res.status(201).json({ message: 'Registration successful.', token, user });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const [[user]] = await pool.execute('SELECT * FROM users WHERE email = ?', [email.toLowerCase().trim()]);
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      return res.status(401).json({ message: 'Invalid email or password.' });
    }

    const token = generateToken(user);
    const { password: _pw, ...userSafe } = user;
    res.json({ message: 'Login successful.', token, user: userSafe });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login.' });
  }
});

// GET /api/auth/me  — protected
router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

// PUT /api/auth/profile  — update own profile
router.put('/profile', requireAuth, async (req, res) => {
  try {
    const { name, phone, license_number } = req.body;
    await pool.execute(
      'UPDATE users SET name=?, phone=?, license_number=? WHERE id=?',
      [name || req.user.name, phone || req.user.phone, license_number || null, req.user.id]
    );
    const [[updated]] = await pool.execute(
      'SELECT id,name,email,phone,license_number,role FROM users WHERE id=?', [req.user.id]
    );
    res.json({ message: 'Profile updated.', user: updated });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ message: 'Server error.' });
  }
});

module.exports = router;
