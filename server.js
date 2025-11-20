// server.js
require("dotenv").config();
const express = require("express");
const path = require("path");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
const { body, validationResult } = require("express-validator");

const app = express();
const port = process.env.PORT || 8000;

// ==========================
// Middleware
// ==========================
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.static(path.join(__dirname, "public")));

// ==========================
// MySQL Connection Pool
// ==========================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  charset: "utf8mb4",
});

// Test DB connection immediately on start
pool.getConnection()
  .then((conn) => {
    console.log("MySQL Connected Successfully!");
    conn.release();
  })
  .catch((err) => {
    console.error("❌ MySQL Connection Failed:");
    console.error("MYSQL ERROR =>", err);
  });

// ==========================
// Routes
// ==========================

// GET: Form page
app.get("/", (req, res) => {
  res.render("form", { errors: null, old: {}, success: null });
});

// POST: Submit form
app.post(
  "/submit",

  // Validation rules
  [
    body("name")
      .trim()
      .notEmpty().withMessage("Name is required")
      .isLength({ max: 100 }).withMessage("Name is too long"),

    body("email")
      .trim()
      .isEmail().withMessage("Valid email is required")
      .normalizeEmail(),

    body("password")
      .isLength({ min: 6 }).withMessage("Password must be at least 6 characters"),

    body("message")
      .trim()
      .optional({ checkFalsy: true })
      .isLength({ max: 2000 }).withMessage("Message is too long"),
  ],

  async (req, res) => {
    const errors = validationResult(req);
    const { name, email, password, message } = req.body;

    if (!errors.isEmpty()) {
      return res.status(422).render("form", {
        errors: errors.array(),
        old: { name, email, message },
        success: null,
      });
    }

    try {
      // Hash password
      const password_hash = await bcrypt.hash(password, 10);

      // Insert into DB
      const sql =
        "INSERT INTO users (name, email, password_hash, message) VALUES (?, ?, ?, ?)";

      const [result] = await pool.execute(sql, [
        name,
        email,
        password_hash,
        message || null,
      ]);

      return res.render("form", {
        errors: null,
        old: {},
        success: "Form submitted successfully!",
      });
    } catch (err) {
      console.error("MYSQL ERROR =>", err);

      let errMsg = "An error occurred. Please try again.";

      if (err.code === "ER_DUP_ENTRY") {
        errMsg = "This email is already registered.";
      }

      return res.status(500).render("form", {
        errors: [{ msg: errMsg }],
        old: { name, email, message },
        success: null,
      });
    }
  }
);

// Debug: Fetch all users (remove in production)
app.get("/users", async (req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, name, email, message, created_at FROM users ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (err) {
    console.error("MYSQL ERROR =>", err);
    res.status(500).json({ error: "Unable to fetch users" });
  }
});

// ==========================
// Start Server
// ==========================
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});


