require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const { requireAuth } = require('./middleware/authMiddleware');
const { getUserStatsHandler } = require('./controllers/habitController');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./swagger');

const app = express();
app.set('trust proxy', true);
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

// ─── API Routes ───────────────────────────────────────────────────────────────
app.use('/auth', require('./routes/auth'));
app.use('/habits', require('./routes/habits'));
app.use('/reminders', require('./routes/reminders'));
app.get('/stats', requireAuth, getUserStatsHandler);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));