require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
const { requireAuth } = require('./middleware/authMiddleware');
const { getUserStatsHandler } = require('./controllers/habitController');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
// Trust exactly 1 reverse proxy hop (Railway's load balancer / edge proxy)
app.set('trust proxy', 1);
app.use(cors());
app.use(express.json());

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// ─── Root ─────────────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
    res.json({
        name: 'HabitUp API',
        version: '1.0.0',
        docs: '/api-docs',
        admin: '/admin-dashboard',
        health: '/health',
    });
});

// ─── Health Check (registered FIRST to prevent shadowing) ──────────────────────
app.get('/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ─── API Docs ─────────────────────────────────────────────────────────────────
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// ─── Admin Frontend (Static files & SPA Fallback) ────────────────────────────
const adminDistPath = path.join(__dirname, 'habitup-admin', 'dist');
if (fs.existsSync(adminDistPath)) {
    app.use('/admin-dashboard', express.static(adminDistPath));
    app.get('/dashboard', (req, res) => res.redirect('/admin-dashboard'));
    app.get('/admin-ui', (req, res) => res.redirect('/admin-dashboard'));
    app.use('/admin-dashboard', (req, res) => {
        res.sendFile(path.join(adminDistPath, 'index.html'));
    });
}

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/users', require('./routes/users'));
app.use('/habits', require('./routes/habits'));
app.use('/reminders', require('./routes/reminders'));
app.use('/admin', require('./routes/admin'));
app.get('/stats', requireAuth, getUserStatsHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));