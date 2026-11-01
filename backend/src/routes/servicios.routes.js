import { Router } from 'express';
import { pool } from '../index.js';

const router = Router();

// Obtener todos los servicios activos
router.get('/', async (req, res) => {
  try {
    const [servicios] = await pool.query(
      'SELECT id, nombre, descripcion, duracion_min, precio, imagen_url FROM servicios WHERE activo = 1 ORDER BY id ASC'
    );
    res.json(servicios);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Obtener un servicio con sus diseños/galería
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
