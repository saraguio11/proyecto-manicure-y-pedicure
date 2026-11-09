import { Router } from 'express';
import { pool } from '../index.js';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ==========================================
// CONSULTAR HORARIOS OCUPADOS / DISPONIBLES EN UNA FECHA
// ==========================================
router.get('/disponibilidad', async (req, res) => {
  try {
    const { fecha } = req.query;
    if (!fecha) {
      return res.status(400).json({ error: 'La fecha es obligatoria' });
    }

    const [citasOcupadas] = await pool.execute(
      `SELECT hora_inicio, hora_fin 
       FROM citas 
       WHERE fecha = ? AND estado_id != 3`,
      [fecha]
    );

    res.json(citasOcupadas);
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: 'Error al consultar disponibilidad de horarios' });
  }
});

// ==========================================
// CONSULTAR CITAS
// ==========================================
router.get('/', verificarToken, async (req, res) => {
  try {
    const { usuario_id, fecha, estado_id } = req.query;
    const esAdmin = req.usuario.rol_id === 2 || req.usuario.rol === 'Administradora';

    let query = `
      SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.precio, c.observacion, c.estado_pago,
             s.nombre AS servicio_nombre, s.duracion_min,
             u.nombre_completo AS cliente_nombre, u.telefono AS cliente_telefono, u.correo AS cliente_correo,
             e.id AS estado_id, e.nombre AS estado_nombre, e.color AS estado_color,
             c.manicurista_id, COALESCE(m.nombre, 'Sin asignar') AS manicurista_nombre
      FROM citas c
      JOIN servicios s ON c.servicio_id = s.id
      JOIN usuarios u ON c.usuario_id = u.id
      JOIN estados_cita e ON c.estado_id = e.id
      LEFT JOIN manicuristas m ON c.manicurista_id = m.id
      WHERE 1=1
    `;
    const params = [];

    if (!esAdmin) {
      query += ' AND c.usuario_id = ?';
      params.push(req.usuario.id);
    } else {
      if (usuario_id) {
        query += ' AND c.usuario_id = ?';
        params.push(usuario_id);
      }
    }

    if (fecha) {
      query += ' AND c.fecha = ?';
      params.push(fecha);
    }
    if (estado_id) {
      query += ' AND c.estado_id = ?';
      params.push(estado_id);
    }

    query += ' ORDER BY c.fecha DESC, c.hora_inicio DESC';

    let citas;
    try {
      [citas] = await pool.execute(query, params);
    } catch (colErr) {
      const fallbackQuery = `
        SELECT c.id, c.fecha, c.hora_inicio, c.hora_fin, c.precio, c.observacion, c.estado_pago,
               s.nombre AS servicio_nombre, s.duracion_min,
               u.nombre_completo AS cliente_nombre, u.telefono AS cliente_telefono, u.correo AS cliente_correo,
               e.id AS estado_id, e.nombre AS estado_nombre, e.color AS estado_color,
               NULL AS manicurista_id, 'Sin asignar' AS manicurista_nombre
        FROM citas c
        JOIN servicios s ON c.servicio_id = s.id
        JOIN usuarios u ON c.usuario_id = u.id
        JOIN estados_cita e ON c.estado_id = e.id
        WHERE 1=1
        ${!esAdmin ? ' AND c.usuario_id = ?' : (usuario_id ? ' AND c.usuario_id = ?' : '')}
        ${fecha ? ' AND c.fecha = ?' : ''}
        ${estado_id ? ' AND c.estado_id = ?' : ''}
        ORDER BY c.fecha DESC, c.hora_inicio DESC
      `;
      [citas] = await pool.execute(fallbackQuery, params);
    }
    res.json(citas);
  } catch (error) {
    console.error('Error en GET /citas:', error);
    res.status(500).json({ error: error.message || 'Error al obtener la lista de citas' });
  }
});

// ==========================================
// ACTUALIZAR ESTADO DE CITA O PAGO (SOLO ADMIN)
// ==========================================
router.patch('/:id/estado', verificarToken, soloAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { estado_id, estado_pago, manicurista_id } = req.body;

    if (!id || isNaN(Number(id))) {
      return res.status(400).json({ error: 'Identificador de cita inválido' });
    }

    let updates = [];
    let params = [];

    if (estado_id !== undefined) {
      const numEstado = Number(estado_id);
      if (![1, 2, 3, 4].includes(numEstado)) {
        return res.status(400).json({ error: 'Estado de cita no válido' });
      }
      updates.push('estado_id = ?');
      params.push(numEstado);
    }

    if (estado_pago !== undefined) {
      if (!['pendiente', 'parcial', 'pagado'].includes(estado_pago)) {
        return res.status(400).json({ error: 'Estado de pago no válido' });
      }
      updates.push('estado_pago = ?');
      params.push(estado_pago);
    }

    if (manicurista_id !== undefined) {
      updates.push('manicurista_id = ?');
      params.push(manicurista_id ? Number(manicurista_id) : null);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No se enviaron datos para actualizar' });
    }

    params.push(Number(id));
    await pool.execute(`UPDATE citas SET ${updates.join(', ')} WHERE id = ?`, params);

    res.json({ mensaje: 'Cita actualizada exitosamente' });
  } catch (error) {
    console.error('Error en PATCH /citas/:id/estado:', error);
    res.status(500).json({ error: error.message || 'Error interno al actualizar la cita' });
  }
});

// ==========================================
// AGENDAR NUEVA CITA (SOPORTA 1 O VARIOS SERVICIOS CONTINUOS)
// ==========================================
router.post('/', verificarToken, async (req, res) => {
  try {
    const { servicios_ids, servicio_id, manicurista_id, fecha, hora_inicio, observacion } = req.body;
    const usuario_id = req.usuario.id;

    // Acepta arreglo de servicios o un único servicio
    const listaIds = Array.isArray(servicios_ids) && servicios_ids.length > 0 
      ? servicios_ids 
      : (servicio_id ? [servicio_id] : []);

    if (listaIds.length === 0 || !fecha || !hora_inicio) {
      return res.status(400).json({ error: 'Por favor selecciona al menos un servicio, fecha y hora de atención' });
    }

    // Regla de negocio: Máximo 2 servicios por sesión
    if (listaIds.length > 2) {
      return res.status(400).json({ error: 'Solo se permite un máximo de 2 servicios por cita (ej. Manicure + Pedicure)' });
    }

    // 1. Validar no fecha pasada
    const fechaActual = new Date().toISOString().split('T')[0];
    if (fecha < fechaActual) {
      return res.status(400).json({ error: 'No es posible agendar citas en fechas anteriores a hoy' });
    }

    // 2. Consultar todos los servicios seleccionados (ej: Uñas acrílicas + Pedicure)
    const placeholders = listaIds.map(() => '?').join(',');
    const [serviciosEncontrados] = await pool.execute(
      `SELECT id, nombre, duracion_min, precio FROM servicios WHERE id IN (${placeholders}) AND activo = 1`,
      listaIds
    );

    if (serviciosEncontrados.length === 0) {
      return res.status(404).json({ error: 'Ninguno de los servicios seleccionados está disponible' });
    }

    // Calcular duración acumulada y precio total del combo
    const duracionTotal = serviciosEncontrados.reduce((acc, s) => acc + Number(s.duracion_min), 0);
    const precioTotal = serviciosEncontrados.reduce((acc, s) => acc + Number(s.precio), 0);
    const nombresServicios = serviciosEncontrados.map(s => s.nombre).join(' + ');

    // 3. Calcular hora_fin precisa considerando la duración total del combo
    const [horaH, horaM] = String(hora_inicio).split(':').map(Number);
    if (isNaN(horaH) || isNaN(horaM)) {
      return res.status(400).json({ error: 'Formato de hora de inicio inválido' });
    }

    const minutosInicio = horaH * 60 + horaM;
    const minutosFin = minutosInicio + duracionTotal;

    const horaFinCalculada = `${String(Math.floor(minutosFin / 60)).padStart(2, '0')}:${String(minutosFin % 60).padStart(2, '0')}:00`;
    const horaInicioFormatted = `${String(horaH).padStart(2, '0')}:${String(horaM).padStart(2, '0')}:00`;

    // 4. Validar solapamiento con citas existentes
    const [solapados] = await pool.execute(
      `SELECT c.id, c.hora_inicio, c.hora_fin, s.nombre AS servicio_nombre
       FROM citas c
       JOIN servicios s ON c.servicio_id = s.id
       WHERE c.fecha = ? 
         AND c.estado_id != 3 
         AND (c.hora_inicio < ? AND c.hora_fin > ?)
       LIMIT 1`,
      [fecha, horaFinCalculada, horaInicioFormatted]
    );

    if (solapados.length > 0) {
      const cChocante = solapados[0];
      const hIni = cChocante.hora_inicio.substring(0, 5);
      const hFin = cChocante.hora_fin.substring(0, 5);
      return res.status(409).json({ 
        error: `⛔ Conflicto de horario: Tu sesión requiere ${duracionTotal} min (hasta las ${horaFinCalculada.substring(0, 5)}), pero ya existe una cita activa de ${hIni} a ${hFin}. Por favor elige otro horario.`
      });
    }

    // 5. Si es más de un servicio, usamos el primer servicio como principal y concatenamos en la observación o servicio
    const primerServicioId = serviciosEncontrados[0].id;
    const notaCompleta = serviciosEncontrados.length > 1 
      ? `[Combo de ${serviciosEncontrados.length} servicios: ${nombresServicios}] ${observacion ? '— ' + String(observacion).trim() : ''}`
      : (observacion ? String(observacion).trim() : null);

    const mId = manicurista_id ? Number(manicurista_id) : null;
    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO citas (usuario_id, servicio_id, manicurista_id, estado_id, fecha, hora_inicio, hora_fin, precio, observacion, estado_pago)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, 'pendiente')`,
        [usuario_id, primerServicioId, mId, fecha, horaInicioFormatted, horaFinCalculada, precioTotal, notaCompleta]
      );
    } catch (insertErr) {
      console.warn('Fallback INSERT sin manicurista_id (columna aún no presente):', insertErr.message);
      [result] = await pool.execute(
        `INSERT INTO citas (usuario_id, servicio_id, estado_id, fecha, hora_inicio, hora_fin, precio, observacion, estado_pago)
         VALUES (?, ?, 1, ?, ?, ?, ?, ?, 'pendiente')`,
        [usuario_id, primerServicioId, fecha, horaInicioFormatted, horaFinCalculada, precioTotal, notaCompleta]
      );
    }

    res.status(201).json({
      mensaje: `¡Sesión agendada con éxito! (${nombresServicios})`,
      cita_id: result.insertId,
      detalle: { 
        servicios: nombresServicios,
        fecha, 
        hora_inicio: horaInicioFormatted, 
        hora_fin: horaFinCalculada, 
        duracion_total: duracionTotal,
        precio_total: precioTotal 
      }
    });
  } catch (error) {
    console.error('Error en POST /citas:', error);
    res.status(500).json({ error: error.message || 'Error interno al procesar la reserva' });
  }
});

export default router;
