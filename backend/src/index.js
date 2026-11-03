import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

import authRoutes from './routes/auth.routes.js';
import serviciosRoutes from './routes/servicios.routes.js';
import citasRoutes from './routes/citas.routes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Pool de conexión a MySQL (incluye DB_PORT para Railway)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'manicure_pedicure',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/citas', citasRoutes);

// Healthcheck
app.get('/api/health', async (req, res) => {
  try {
    const [result] = await pool.query('SELECT 1 + 1 AS test');
    res.json({ status: 'ok', message: 'Servidor conectado a base de datos', result });
  } catch (error) {
    res.status(500).json({ status: 'error', message: error.message });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Backend de Manicure & Pedicure corriendo en el puerto ${PORT}`);
});
