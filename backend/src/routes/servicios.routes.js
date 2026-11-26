import { Router } from 'express';
import { pool } from '../index.js';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ─────────────────────────────────────────────
// GET / — Todos los servicios activos (público)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    let servicios;
    try {
      [servicios] = await pool.query(
        'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url, categoria FROM servicios WHERE activo = 1 ORDER BY id ASC'
      );
    } catch (colErr) {
      // Fallback si la columna categoria no ha sido creada aún en Railway
      [servicios] = await pool.query(
        'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url FROM servicios WHERE activo = 1 ORDER BY id ASC'
      );
    }
    res.json(servicios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /admin/all — Todos (activos + inactivos) solo admin
// ─────────────────────────────────────────────
router.get('/admin/all', verificarToken, soloAdmin, async (req, res) => {
  try {
    let servicios;
    try {
      [servicios] = await pool.query(
        'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url, categoria, activo FROM servicios ORDER BY id ASC'
      );
    } catch (colErr) {
      [servicios] = await pool.query(
        'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url, activo FROM servicios ORDER BY id ASC'
      );
    }
    res.json(servicios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const esEnteroPositivo = (val) => Number.isInteger(Number(val)) && Number(val) > 0;
const esUrlValida = (u) => !u || /^https?:\/\/.+/.test(u) || u.startsWith('/');

// ─────────────────────────────────────────────
// POST / — Crear servicio (solo admin)
// ─────────────────────────────────────────────
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, duracion_min, precio, imagen_url, categoria } = req.body || {};
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const descLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';
    const imgLimpia = typeof imagen_url === 'string' ? imagen_url.trim() : '';
    const catLimpia = typeof categoria === 'string' ? categoria.trim() : '';
    const durNum = Number(duracion_min);
    const precioNum = Number(precio);

    if (!nombreLimpio || nombreLimpio.length < 3 || nombreLimpio.length > 100) {
      return res.status(400).json({ error: 'El nombre del servicio debe tener entre 3 y 100 caracteres' });
    }
    if (!Number.isInteger(durNum) || durNum < 10 || durNum > 480) {
      return res.status(400).json({ error: 'La duración debe ser un número entero entre 10 y 480 minutos' });
    }
    if (isNaN(precioNum) || precioNum < 1000 || precioNum > 10000000) {
      return res.status(400).json({ error: 'El precio debe estar entre $1.000 y $10.000.000 COP' });
    }
    if (descLimpia.length > 500) {
      return res.status(400).json({ error: 'La descripción no puede superar los 500 caracteres' });
    }
    if (catLimpia.length > 80) {
      return res.status(400).json({ error: 'La categoría no puede superar los 80 caracteres' });
    }
    if (imgLimpia.length > 255 || !esUrlValida(imgLimpia)) {
      return res.status(400).json({ error: 'La URL de imagen no es válida' });
    }

    const [result] = await pool.execute(
      'INSERT INTO servicios (nombre, descripcion, duracion_min, precio, imagen_url, categoria) VALUES (?, ?, ?, ?, ?, ?)',
      [nombreLimpio, descLimpia || null, durNum, precioNum, imgLimpia || null, catLimpia || null]
    );
    res.status(201).json({ mensaje: 'Servicio creado exitosamente', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un servicio con ese nombre' });
    }
    res.status(500).json({ error: 'Error interno al crear el servicio' });
  }
});

// ─────────────────────────────────────────────
// PUT /:id — Editar servicio (solo admin)
// ─────────────────────────────────────────────
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!esEnteroPositivo(id)) {
      return res.status(400).json({ error: 'Identificador de servicio inválido' });
    }
    const { nombre, descripcion, duracion_min, precio, imagen_url, categoria, activo } = req.body || {};
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const descLimpia = typeof descripcion === 'string' ? descripcion.trim() : '';
    const imgLimpia = typeof imagen_url === 'string' ? imagen_url.trim() : '';
    const catLimpia = typeof categoria === 'string' ? categoria.trim() : '';
    const durNum = Number(duracion_min);
    const precioNum = Number(precio);

    if (!nombreLimpio || nombreLimpio.length < 3 || nombreLimpio.length > 100) {
      return res.status(400).json({ error: 'El nombre del servicio debe tener entre 3 y 100 caracteres' });
    }
    if (!Number.isInteger(durNum) || durNum < 10 || durNum > 480) {
      return res.status(400).json({ error: 'La duración debe ser un número entero entre 10 y 480 minutos' });
    }
    if (isNaN(precioNum) || precioNum < 1000 || precioNum > 10000000) {
      return res.status(400).json({ error: 'El precio debe estar entre $1.000 y $10.000.000 COP' });
    }
    if (descLimpia.length > 500 || catLimpia.length > 80) {
      return res.status(400).json({ error: 'Descripción o categoría exceden la longitud permitida' });
    }
    if (imgLimpia.length > 255 || !esUrlValida(imgLimpia)) {
      return res.status(400).json({ error: 'La URL de imagen no es válida' });
    }

    await pool.execute(
      'UPDATE servicios SET nombre=?, descripcion=?, duracion_min=?, precio=?, imagen_url=?, categoria=?, activo=? WHERE id=?',
      [nombreLimpio, descLimpia || null, durNum, precioNum, imgLimpia || null, catLimpia || null, activo !== undefined ? (activo ? 1 : 0) : 1, Number(id)]
    );
    res.json({ mensaje: 'Servicio actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al actualizar el servicio' });
  }
});

// ─────────────────────────────────────────────
// DELETE /:id — Desactivar servicio (soft delete, solo admin)
// Lógica de negocio: no se borra si tiene citas futuras pendientes/confirmadas
// ─────────────────────────────────────────────
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Verificar citas futuras activas con este servicio
    const [citasFuturas] = await pool.execute(
      `SELECT COUNT(*) AS total FROM citas WHERE servicio_id = ? AND estado_id IN (1,2) AND fecha >= CURRENT_DATE()`,
      [Number(id)]
    );
    if (citasFuturas[0].total > 0) {
      return res.status(409).json({
        error: `No se puede desactivar: tiene ${citasFuturas[0].total} cita(s) futura(s) pendiente(s) o confirmada(s). Cancélalas primero.`
      });
    }
    await pool.execute('UPDATE servicios SET activo = 0 WHERE id = ?', [Number(id)]);
    res.json({ mensaje: 'Servicio desactivado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// GET /:id — Un servicio con sus diseños (público)
// ─────────────────────────────────────────────
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [servicios] = await pool.query(
      'SELECT * FROM servicios WHERE id = ? AND activo = 1',
      [id]
    );
    if (servicios.length === 0) {
      return res.status(404).json({ error: 'Servicio no encontrado' });
    }
    const [disenos] = await pool.query(
      'SELECT id, titulo, imagen_url FROM disenos WHERE servicio_id = ? AND activo = 1',
      [id]
    );
    res.json({ ...servicios[0], disenos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
