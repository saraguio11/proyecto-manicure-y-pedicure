import { Router } from 'express';
import { pool } from '../index.js';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ─────────────────────────────────────────────
// GET / — Todos los servicios activos (público)
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [servicios] = await pool.query(
      'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url, categoria FROM servicios WHERE activo = 1 ORDER BY id ASC'
    );
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
    const [servicios] = await pool.query(
      'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url, categoria, activo FROM servicios ORDER BY id ASC'
    );
    res.json(servicios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// POST / — Crear servicio (solo admin)
// ─────────────────────────────────────────────
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, descripcion, duracion_min, precio, imagen_url, categoria } = req.body;
    if (!nombre || !duracion_min || !precio) {
      return res.status(400).json({ error: 'Nombre, duración y precio son obligatorios' });
    }
    if (Number(duracion_min) <= 0 || Number(precio) <= 0) {
      return res.status(400).json({ error: 'La duración y precio deben ser mayores a 0' });
    }
    const [result] = await pool.execute(
      'INSERT INTO servicios (nombre, descripcion, duracion_min, precio, imagen_url, categoria) VALUES (?, ?, ?, ?, ?, ?)',
      [nombre.trim(), descripcion?.trim() || null, Number(duracion_min), Number(precio), imagen_url?.trim() || null, categoria?.trim() || null]
    );
    res.status(201).json({ mensaje: 'Servicio creado exitosamente', id: result.insertId });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Ya existe un servicio con ese nombre' });
    }
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT /:id — Editar servicio (solo admin)
// ─────────────────────────────────────────────
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, descripcion, duracion_min, precio, imagen_url, categoria, activo } = req.body;
    if (!nombre || !duracion_min || !precio) {
      return res.status(400).json({ error: 'Nombre, duración y precio son obligatorios' });
    }
    await pool.execute(
      'UPDATE servicios SET nombre=?, descripcion=?, duracion_min=?, precio=?, imagen_url=?, categoria=?, activo=? WHERE id=?',
      [nombre.trim(), descripcion?.trim() || null, Number(duracion_min), Number(precio), imagen_url?.trim() || null, categoria?.trim() || null, activo !== undefined ? (activo ? 1 : 0) : 1, Number(id)]
    );
    res.json({ mensaje: 'Servicio actualizado exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
