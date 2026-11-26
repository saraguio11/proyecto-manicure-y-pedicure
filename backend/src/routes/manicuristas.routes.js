import { Router } from 'express';
import { pool } from '../index.js';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ─────────────────────────────────────────────
// GET / — Listar manicuristas activas
// ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, especialidad, foto_url, activo FROM manicuristas WHERE activo = 1 ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /admin/all — Todas (activas e inactivas), solo admin
router.get('/admin/all', verificarToken, soloAdmin, async (req, res) => {
  try {
    const [rows] = await pool.query(
      'SELECT id, nombre, especialidad, foto_url, activo FROM manicuristas ORDER BY nombre ASC'
    );
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const esEnteroPositivo = (val) => Number.isInteger(Number(val)) && Number(val) > 0;
const NOMBRE_MANICURISTA_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{3,100}$/;
const esUrlValida = (u) => !u || /^https?:\/\/.+/.test(u) || u.startsWith('/');

// ─────────────────────────────────────────────
// POST / — Crear manicurista (solo admin)
// ─────────────────────────────────────────────
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, especialidad, foto_url } = req.body || {};
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const espLimpia = typeof especialidad === 'string' ? especialidad.trim() : '';
    const fotoLimpia = typeof foto_url === 'string' ? foto_url.trim() : '';

    if (!NOMBRE_MANICURISTA_REGEX.test(nombreLimpio)) {
      return res.status(400).json({ error: 'El nombre debe tener entre 3 y 100 letras sin números ni símbolos' });
    }
    if (espLimpia.length > 150) {
      return res.status(400).json({ error: 'La especialidad no puede superar los 150 caracteres' });
    }
    if (fotoLimpia.length > 255 || !esUrlValida(fotoLimpia)) {
      return res.status(400).json({ error: 'La URL de la foto no es válida' });
    }

    const [result] = await pool.execute(
      'INSERT INTO manicuristas (nombre, especialidad, foto_url) VALUES (?, ?, ?)',
      [nombreLimpio, espLimpia || null, fotoLimpia || null]
    );
    res.status(201).json({ mensaje: 'Manicurista agregada exitosamente', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al crear la manicurista' });
  }
});

// ─────────────────────────────────────────────
// PUT /:id — Editar manicurista (solo admin)
// ─────────────────────────────────────────────
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!esEnteroPositivo(id)) {
      return res.status(400).json({ error: 'Identificador de manicurista inválido' });
    }
    const { nombre, especialidad, foto_url, activo } = req.body || {};
    const nombreLimpio = typeof nombre === 'string' ? nombre.trim() : '';
    const espLimpia = typeof especialidad === 'string' ? especialidad.trim() : '';
    const fotoLimpia = typeof foto_url === 'string' ? foto_url.trim() : '';

    if (!NOMBRE_MANICURISTA_REGEX.test(nombreLimpio)) {
      return res.status(400).json({ error: 'El nombre debe tener entre 3 y 100 letras sin números ni símbolos' });
    }
    if (espLimpia.length > 150) {
      return res.status(400).json({ error: 'La especialidad no puede superar los 150 caracteres' });
    }
    if (fotoLimpia.length > 255 || !esUrlValida(fotoLimpia)) {
      return res.status(400).json({ error: 'La URL de la foto no es válida' });
    }

    await pool.execute(
      'UPDATE manicuristas SET nombre=?, especialidad=?, foto_url=?, activo=? WHERE id=?',
      [nombreLimpio, espLimpia || null, fotoLimpia || null, activo !== undefined ? (activo ? 1 : 0) : 1, Number(id)]
    );
    res.json({ mensaje: 'Manicurista actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: 'Error interno al actualizar la manicurista' });
  }
});

// ─────────────────────────────────────────────
// DELETE /:id — Desactivar manicurista (soft delete, solo admin)
// Lógica de negocio: no se desactiva si tiene citas futuras asignadas
// ─────────────────────────────────────────────
router.delete('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    // Verificar citas futuras asignadas a esta manicurista
    const [citasFuturas] = await pool.execute(
      `SELECT COUNT(*) AS total FROM citas WHERE manicurista_id = ? AND estado_id IN (1,2) AND fecha >= CURRENT_DATE()`,
      [Number(id)]
    );
    if (citasFuturas[0].total > 0) {
      return res.status(409).json({
        error: `No se puede desactivar: tiene ${citasFuturas[0].total} cita(s) futura(s) asignada(s). Reasigna o cancela primero.`
      });
    }
    await pool.execute('UPDATE manicuristas SET activo = 0 WHERE id = ?', [Number(id)]);
    res.json({ mensaje: 'Manicurista desactivada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
