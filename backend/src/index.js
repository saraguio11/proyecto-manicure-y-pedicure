import bcrypt from 'bcryptjs';
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

app.set('trust proxy', 1);
app.use(cors());
app.use(express.json({ limit: '1mb' }));

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
    await agregarColumnaSiNoExiste('citas', 'estado_pago', "ENUM('pendiente','parcial','pagado') NOT NULL DEFAULT 'pendiente' AFTER observacion");
    await agregarColumnaSiNoExiste('citas', 'comprobante_pago', 'VARCHAR(120) NULL AFTER estado_pago');
    await agregarColumnaSiNoExiste('citas', 'monto_anticipo', 'DECIMAL(10,2) NULL AFTER comprobante_pago');

    // Permitir citas paralelas con diferentes manicuristas eliminando la restricción de cita única global
    try {
      await pool.query('ALTER TABLE citas DROP INDEX uq_citas_horario_activo');
      console.log('✓ Restricción uq_citas_horario_activo retirada para soportar agendas paralelas');
    } catch (dropIdxErr) {
      // Índice ya retirado o no presente
    }
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

// =============================================
// ENDPOINT: Reportes generales y específicos (solo admin)
// =============================================
app.get('/api/admin/reportes', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { desde, hasta, manicurista_id, servicio_id, usuario_id, estado_id, busqueda, orden } = req.query;
    const FECHA_REGEX = /^\d{4}-\d{2}-\d{2}$/;

    if (desde && !FECHA_REGEX.test(String(desde))) {
      return res.status(400).json({ error: 'Formato de fecha inicial inválido (YYYY-MM-DD)' });
    }
    if (hasta && !FECHA_REGEX.test(String(hasta))) {
      return res.status(400).json({ error: 'Formato de fecha final inválido (YYYY-MM-DD)' });
    }

    let where = ' WHERE 1=1 ';
    const params = [];

    if (desde) {
      where += ' AND c.fecha >= ? ';
      params.push(desde);
    }
    if (hasta) {
      where += ' AND c.fecha <= ? ';
      params.push(hasta);
    }
    if (manicurista_id && !isNaN(Number(manicurista_id))) {
      where += ' AND c.manicurista_id = ? ';
      params.push(Number(manicurista_id));
    }
    if (servicio_id && !isNaN(Number(servicio_id))) {
      where += ' AND c.servicio_id = ? ';
      params.push(Number(servicio_id));
    }
    if (usuario_id && !isNaN(Number(usuario_id))) {
      where += ' AND c.usuario_id = ? ';
      params.push(Number(usuario_id));
    }
    if (estado_id && !isNaN(Number(estado_id))) {
      where += ' AND c.estado_id = ? ';
      params.push(Number(estado_id));
    }
    if (busqueda && String(busqueda).trim()) {
      const q = `%${String(busqueda).trim()}%`;
      where += ' AND (u.nombre_completo LIKE ? OR s.nombre LIKE ? OR COALESCE(m.nombre, \'\') LIKE ? OR COALESCE(c.comprobante_pago, \'\') LIKE ?) ';
      params.push(q, q, q, q);
    }

    let orderBy = ' ORDER BY c.fecha DESC, c.hora_inicio DESC ';
    if (orden === 'fecha_asc') orderBy = ' ORDER BY c.fecha ASC, c.hora_inicio ASC ';
    else if (orden === 'precio_desc') orderBy = ' ORDER BY c.precio DESC ';
    else if (orden === 'precio_asc') orderBy = ' ORDER BY c.precio ASC ';

    const [detalle] = await pool.execute(
      `SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.precio, c.estado_id, c.estado_pago,
              c.comprobante_pago, c.monto_anticipo, c.observacion,
              u.id AS usuario_id, u.nombre_completo AS cliente_nombre, u.telefono AS cliente_telefono, u.correo AS cliente_correo,
              s.id AS servicio_id, s.nombre AS servicio_nombre, s.duracion_min,
              ec.nombre AS estado_nombre,
              c.manicurista_id, COALESCE(m.nombre, 'Sin asignar') AS manicurista_nombre
       FROM citas c
       JOIN usuarios u ON u.id = c.usuario_id
       JOIN servicios s ON s.id = c.servicio_id
       JOIN estados_cita ec ON ec.id = c.estado_id
       LEFT JOIN manicuristas m ON m.id = c.manicurista_id
       ${where}
       ${orderBy}`,
      params
    );

    const [porEstado] = await pool.execute(
      `SELECT ec.id, ec.nombre, COUNT(c.id) AS total_citas, COALESCE(SUM(c.precio), 0) AS total_monto
       FROM citas c
       JOIN usuarios u ON u.id = c.usuario_id
       JOIN servicios s ON s.id = c.servicio_id
       JOIN estados_cita ec ON ec.id = c.estado_id
       LEFT JOIN manicuristas m ON m.id = c.manicurista_id
       ${where}
       GROUP BY ec.id, ec.nombre
       ORDER BY ec.id`,
      params
    );

    const [porManicurista] = await pool.execute(
      `SELECT COALESCE(m.id, 0) AS manicurista_id, COALESCE(m.nombre, 'Sin asignar') AS manicurista_nombre,
              COUNT(c.id) AS total_citas,
              COALESCE(SUM(CASE WHEN c.estado_id IN (2, 4) THEN c.precio ELSE 0 END), 0) AS ingresos
       FROM citas c
       JOIN usuarios u ON u.id = c.usuario_id
       JOIN servicios s ON s.id = c.servicio_id
       JOIN estados_cita ec ON ec.id = c.estado_id
       LEFT JOIN manicuristas m ON m.id = c.manicurista_id
       ${where}
       GROUP BY COALESCE(m.id, 0), COALESCE(m.nombre, 'Sin asignar')
       ORDER BY total_citas DESC`,
      params
    );

    const [porServicio] = await pool.execute(
      `SELECT s.id AS servicio_id, s.nombre AS servicio_nombre,
              COUNT(c.id) AS total_citas,
              COALESCE(SUM(CASE WHEN c.estado_id IN (2, 4) THEN c.precio ELSE 0 END), 0) AS ingresos
       FROM citas c
       JOIN usuarios u ON u.id = c.usuario_id
       JOIN servicios s ON s.id = c.servicio_id
       JOIN estados_cita ec ON ec.id = c.estado_id
       LEFT JOIN manicuristas m ON m.id = c.manicurista_id
       ${where}
       GROUP BY s.id, s.nombre
       ORDER BY total_citas DESC`,
      params
    );

    const totalCitas = detalle.length;
    const citasCanceladas = detalle.filter(c => Number(c.estado_id) === 3).length;
    const citasAtendidas = detalle.filter(c => Number(c.estado_id) === 4).length;
    const citasValidas = detalle.filter(c => [2, 4].includes(Number(c.estado_id)));
    const ingresosConfirmados = citasValidas.reduce((acc, c) => acc + Number(c.precio || 0), 0);
    const ingresosTotales = detalle.filter(c => Number(c.estado_id) !== 3).reduce((acc, c) => acc + Number(c.precio || 0), 0);
    const ticketPromedio = citasValidas.length > 0 ? Math.round(ingresosConfirmados / citasValidas.length) : 0;

    res.json({
      resumenGeneral: {
        totalCitas,
        citasActivas: totalCitas - citasCanceladas,
        citasAtendidas,
        citasCanceladas,
        ingresosTotales,
        ingresosConfirmados,
        ticketPromedio
      },
      porEstado,
      porManicurista,
      porServicio,
      detalle
    });
  } catch (err) {
    console.error('Error en GET /api/admin/reportes:', err);
    res.status(500).json({ error: 'Error al generar el reporte' });
  }
});

// =============================================
// ENDPOINTS: Gestión de Usuarios y Roles (solo admin)
// =============================================
app.get('/api/admin/usuarios', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [usuarios] = await pool.query(`
      SELECT u.id, u.rol_id, r.nombre AS rol_nombre, u.nombre_completo, u.documento,
             u.telefono, u.correo, u.activo, u.creado_en,
             (SELECT COUNT(*) FROM citas c WHERE c.usuario_id = u.id) AS total_citas
      FROM usuarios u
      JOIN roles r ON r.id = u.rol_id
      ORDER BY u.id DESC
    `);
    res.json(usuarios);
  } catch (err) {
    res.status(500).json({ error: 'Error al listar usuarios' });
  }
});

app.post('/api/admin/usuarios', verificarToken, soloAdmin, async (req, res) => {
  try {
    let { nombre_completo, documento, telefono, correo, password, rol_id } = req.body || {};
    nombre_completo = typeof nombre_completo === 'string' ? nombre_completo.trim() : '';
    documento = documento ? String(documento).trim() : '';
    telefono = telefono ? String(telefono).trim() : '';
    correo = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';
    const rolNum = Number(rol_id);

    if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{3,100}$/.test(nombre_completo)) {
      return res.status(400).json({ error: 'El nombre debe tener entre 3 y 100 letras sin números ni símbolos' });
    }
    if (!/^\d{5,15}$/.test(documento)) {
      return res.status(400).json({ error: 'El documento debe contener solo números (5 a 15 dígitos)' });
    }
    if (!/^\+?\d{7,15}$/.test(telefono)) {
      return res.status(400).json({ error: 'El teléfono debe ser numérico válido (7 a 15 dígitos)' });
    }
    if (correo.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
    }
    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 100 caracteres' });
    }
    if (![1, 2].includes(rolNum)) {
      return res.status(400).json({ error: 'Rol inválido (debe ser Clienta o Administradora)' });
    }

    const [existente] = await pool.execute(
      'SELECT id FROM usuarios WHERE correo = ? OR documento = ? LIMIT 1',
      [correo, documento]
    );
    if (existente.length > 0) {
      return res.status(409).json({ error: 'Ya existe un usuario con ese correo o documento' });
    }

    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      `INSERT INTO usuarios (rol_id, nombre_completo, documento, telefono, correo, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rolNum, nombre_completo, documento, telefono, correo, password_hash]
    );

    res.status(201).json({
      mensaje: `Usuario creado con rol ${rolNum === 2 ? 'Administradora' : 'Clienta'}`,
      id: result.insertId
    });
  } catch (err) {
    res.status(500).json({ error: 'Error interno al crear el usuario' });
  }
});

app.patch('/api/admin/usuarios/:id/rol', verificarToken, soloAdmin, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Identificador de usuario inválido' });
    }
    const { rol_id, activo } = req.body || {};

    if (id === req.usuario.id && (rol_id === 1 || activo === 0 || activo === false)) {
      return res.status(400).json({ error: 'No puedes quitarte el rol de Administradora ni desactivar tu propia cuenta' });
    }

    const updates = [];
    const params = [];
    if (rol_id !== undefined) {
      const rolNum = Number(rol_id);
      if (![1, 2].includes(rolNum)) {
        return res.status(400).json({ error: 'Rol inválido' });
      }
      updates.push('rol_id = ?');
      params.push(rolNum);
    }
    if (activo !== undefined) {
      updates.push('activo = ?');
      params.push(activo ? 1 : 0);
    }
    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se enviaron cambios para actualizar' });
    }
    params.push(id);
    await pool.execute(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`, params);
    res.json({ mensaje: 'Permisos de usuario actualizados correctamente' });
  } catch (err) {
    res.status(500).json({ error: 'Error al actualizar el usuario' });
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
