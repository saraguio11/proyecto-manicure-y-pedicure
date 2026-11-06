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

// ─────────────────────────────────────────────
// POST / — Crear manicurista (solo admin)
// ─────────────────────────────────────────────
router.post('/', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { nombre, especialidad, foto_url } = req.body;
    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    const [result] = await pool.execute(
      'INSERT INTO manicuristas (nombre, especialidad, foto_url) VALUES (?, ?, ?)',
      [nombre.trim(), especialidad?.trim() || null, foto_url?.trim() || null]
    );
    res.status(201).json({ mensaje: 'Manicurista agregada exitosamente', id: result.insertId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ─────────────────────────────────────────────
// PUT /:id — Editar manicurista (solo admin)
// ─────────────────────────────────────────────
router.put('/:id', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { nombre, especialidad, foto_url, activo } = req.body;
    if (!nombre?.trim()) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    await pool.execute(
      'UPDATE manicuristas SET nombre=?, especialidad=?, foto_url=?, activo=? WHERE id=?',
      [nombre.trim(), especialidad?.trim() || null, foto_url?.trim() || null, activo !== undefined ? (activo ? 1 : 0) : 1, Number(id)]
    );
    res.json({ mensaje: 'Manicurista actualizada exitosamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
