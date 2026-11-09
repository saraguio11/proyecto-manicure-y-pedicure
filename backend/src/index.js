import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import mysql from 'mysql2/promise';

import authRoutes from './routes/auth.routes.js';
import serviciosRoutes from './routes/servicios.routes.js';
import citasRoutes from './routes/citas.routes.js';
import manicuristasRoutes from './routes/manicuristas.routes.js';
import { verificarToken, soloAdmin } from './middlewares/auth.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Pool de conexión a MySQL (DB_* o variables nativas de Railway MYSQL*)
export const pool = mysql.createPool({
  host: process.env.DB_HOST || process.env.MYSQLHOST || 'localhost',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'manicure_pedicure',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Rutas de la API
app.use('/api/auth', authRoutes);
app.use('/api/servicios', serviciosRoutes);
app.use('/api/citas', citasRoutes);
app.use('/api/manicuristas', manicuristasRoutes);

// Función universal para agregar columnas de forma segura en cualquier versión de MySQL
async function agregarColumnaSiNoExiste(tabla, columna, definicion) {
  try {
    const [cols] = await pool.query(
      `SELECT COLUMN_NAME FROM information_schema.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      [tabla, columna]
    );
    if (cols.length === 0) {
      await pool.query(`ALTER TABLE \`${tabla}\` ADD COLUMN \`${columna}\` ${definicion}`);
      console.log(`✓ Columna '${columna}' agregada con éxito a '${tabla}'`);
    }
  } catch (err) {
    console.warn(`Aviso al verificar columna ${columna} en ${tabla}:`, err.message);
  }
}

// Auto-verificar y sincronizar columnas/tablas requeridas en Railway MySQL
(async () => {
  try {
    await agregarColumnaSiNoExiste('servicios', 'categoria', 'VARCHAR(80) NULL AFTER imagen_url');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS manicuristas (
        id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
        nombre       VARCHAR(120) NOT NULL,
        especialidad VARCHAR(150) NULL,
        foto_url     VARCHAR(255) NULL,
        activo       TINYINT(1)   NOT NULL DEFAULT 1,
        creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB
    `);
    const [countM] = await pool.query('SELECT COUNT(*) AS total FROM manicuristas');
    if (countM[0].total === 0) {
      await pool.query(`
        INSERT INTO manicuristas (nombre, especialidad, foto_url) VALUES
        ('Valentina Gómez', 'Especialista en Uñas Acrílicas y Polygel', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150'),
        ('Camila Restrepo', 'Experta en Semipermanente y Nail Art', 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=150'),
        ('Sofía Morales', 'Técnica en Spa Pedicure y Nivelación', 'https://images.unsplash.com/photo-1567532939604-b6b5b0db2604?w=150')
      `);
    }
    await agregarColumnaSiNoExiste('citas', 'manicurista_id', 'INT UNSIGNED NULL AFTER servicio_id');
  } catch (err) {
    console.warn('DB Sync info (continuando normal):', err.message);
  }
})();

// =============================================
// ENDPOINT: Estadísticas para el dashboard admin
// =============================================
app.get('/api/admin/stats', verificarToken, soloAdmin, async (req, res) => {
  try {
    // Total de citas por estado
    const [porEstado] = await pool.query(`
      SELECT ec.id, ec.nombre, COUNT(c.id) AS total
      FROM estados_cita ec
      LEFT JOIN citas c ON c.estado_id = ec.id
      GROUP BY ec.id, ec.nombre
      ORDER BY ec.id
    `);

    // Ingresos del mes actual (citas pagadas o atendidas)
    const [ingresosMes] = await pool.query(`
      SELECT COALESCE(SUM(c.precio), 0) AS ingresos_mes
      FROM citas c
      WHERE MONTH(c.fecha) = MONTH(CURRENT_DATE())
        AND YEAR(c.fecha) = YEAR(CURRENT_DATE())
        AND c.estado_id IN (2, 4)
    `);

    // Ingresos totales (citas confirmadas + atendidas)
    const [ingresosTotal] = await pool.query(`
      SELECT COALESCE(SUM(c.precio), 0) AS ingresos_total
      FROM citas c
      WHERE c.estado_id IN (2, 4)
    `);

    // Citas de hoy (incluye manicurista)
    const [citasHoy] = await pool.query(`
      SELECT c.id, c.hora_inicio, c.hora_fin, c.precio, c.estado_id, c.estado_pago,
             u.nombre_completo AS cliente_nombre,
             s.nombre AS servicio_nombre,
             ec.nombre AS estado_nombre,
             s.duracion_min,
             COALESCE(m.nombre, 'Sin asignar') AS manicurista_nombre
      FROM citas c
      JOIN usuarios u ON u.id = c.usuario_id
      JOIN servicios s ON s.id = c.servicio_id
      JOIN estados_cita ec ON ec.id = c.estado_id
      LEFT JOIN manicuristas m ON m.id = c.manicurista_id
      WHERE c.fecha = CURRENT_DATE()
        AND c.estado_id != 3
      ORDER BY c.hora_inicio
    `);

    // Top 5 citas recientes (para lista de ingresos)
    const [citasRecientes] = await pool.query(`
      SELECT c.id, c.fecha, c.precio, c.estado_pago, c.estado_id,
             u.nombre_completo AS cliente_nombre,
             s.nombre AS servicio_nombre
      FROM citas c
      JOIN usuarios u ON u.id = c.usuario_id
      JOIN servicios s ON s.id = c.servicio_id
      WHERE c.estado_id IN (2, 4)
      ORDER BY c.creado_en DESC
      LIMIT 5
    `);

    // Total clientas registradas
    const [totalClientas] = await pool.query(`
      SELECT COUNT(*) AS total FROM usuarios WHERE rol_id = 1
    `);

    res.json({
      estadosCita: porEstado,
      ingresosMes: Number(ingresosMes[0].ingresos_mes),
      ingresosTotal: Number(ingresosTotal[0].ingresos_total),
      citasHoy,
      citasRecientes,
      totalClientas: Number(totalClientas[0].total)
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

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
