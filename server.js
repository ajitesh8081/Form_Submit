// server.js
require('dotenv').config();
const express = require('express');
const path = require('path');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');

const app = express();
const port = process.env.PORT || 8000;

// middleware
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// create a MySQL pool
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'form_demo',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: 'utf8mb4'
});

// GET form page
app.get('/', (req, res) => {
  res.render('form', { errors: null, old: {} , success: null});
});

// POST handler
app.post(
  '/submit',
  // validation middleware
  [
    body('name').trim().notEmpty().withMessage('Name is required').isLength({ max: 100 }),
    body('email').trim().isEmail().withMessage('Valid email is required').normalizeEmail(),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
    body('message').trim().optional({ checkFalsy: true }).isLength({ max: 2000 })
  ],
  async (req, res) => {
    const errors = validationResult(req);
    const { name, email, password, message } = req.body;

    if (!errors.isEmpty()) {
      // re-render form with errors and previous values
      return res.status(422).render('form', { errors: errors.array(), old: { name, email, message }, success: null });
    }

    try {
      // hash the password
      const saltRounds = 10;
      const password_hash = await bcrypt.hash(password, saltRounds);

      // use prepared statements to avoid SQL injection
      const sql = 'INSERT INTO users (name, email, password_hash, message) VALUES (?, ?, ?, ?)';
      const [result] = await pool.execute(sql, [name, email, password_hash, message || null]);

      return res.render('form', { errors: null, old: {}, success: 'Form submitted successfully!' });
    } catch (err) {
      console.error('DB error', err);
      // handle duplicate email or other DB errors
      let errMsg = 'An error occurred. Please try again.';
      if (err.code === 'ER_DUP_ENTRY') errMsg = 'The email is already registered.';
      return res.status(500).render('form', { errors: [{ msg: errMsg }], old: { name, email, message }, success: null });
    }
  }
);

// endpoint to list users (for testing only — remove in production)
app.get('/users', async (req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, name, email, message, created_at FROM users ORDER BY created_at DESC');
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Unable to fetch users' });
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
