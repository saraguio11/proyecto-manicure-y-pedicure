import { Router } from 'express';
import { pool } from '../index.js';
import { verificarToken, soloAdmin } from '../middlewares/auth.middleware.js';

const router = Router();

// ==========================================
// CONSULTAR HORARIOS OCUPADOS / DISPONIBLES EN UNA FECHA
// ==========================================
router.get('/disponibilidad', async (req, res) => {
  try {
    const { fecha, manicurista_id } = req.query;
    if (!fecha) {
      return res.status(400).json({ error: 'La fecha es obligatoria' });
    }

    let query = `
      SELECT c.id, c.hora_inicio, c.hora_fin, c.usuario_id, c.estado_id, c.precio, c.observacion,
             c.manicurista_id, c.estado_pago,
             s.nombre AS servicio_nombre, s.duracion_min,
             u.nombre_completo AS cliente_nombre,
             COALESCE(m.nombre, 'Sin asignar') AS manicurista_nombre
      FROM citas c
      JOIN servicios s ON c.servicio_id = s.id
      JOIN usuarios u ON c.usuario_id = u.id
      LEFT JOIN manicuristas m ON c.manicurista_id = m.id
      WHERE c.fecha = ? AND c.estado_id != 3
    `;
    const params = [fecha];

    if (manicurista_id && !isNaN(Number(manicurista_id))) {
      query += ' AND (c.manicurista_id = ? OR c.manicurista_id IS NULL)';
      params.push(Number(manicurista_id));
    }

    query += ' ORDER BY c.hora_inicio ASC';

    let citasOcupadas;
    try {
      [citasOcupadas] = await pool.execute(query, params);
    } catch (joinErr) {
      [citasOcupadas] = await pool.execute(
        `SELECT c.id, c.hora_inicio, c.hora_fin, c.usuario_id, c.estado_id, c.precio, c.observacion,
                c.manicurista_id, c.estado_pago,
                s.nombre AS servicio_nombre, s.duracion_min,
                u.nombre_completo AS cliente_nombre,
                'Manicurista' AS manicurista_nombre
         FROM citas c
         JOIN servicios s ON c.servicio_id = s.id
         JOIN usuarios u ON c.usuario_id = u.id
         WHERE c.fecha = ? AND c.estado_id != 3
         ORDER BY c.hora_inicio ASC`,
        [fecha]
      );
    }

    res.json(citasOcupadas);
  } catch (error) {
    console.error('Error al consultar disponibilidad:', error);
    res.status(500).json({ error: error.message || 'Error al consultar disponibilidad de horarios' });
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
             c.comprobante_pago, c.monto_anticipo,
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
               NULL AS comprobante_pago, NULL AS monto_anticipo,
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
    const { estado_id, estado_pago, manicurista_id, comprobante_pago, monto_anticipo } = req.body;

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

    if (comprobante_pago !== undefined) {
      updates.push('comprobante_pago = ?');
      params.push(comprobante_pago ? String(comprobante_pago).trim() : null);
    }

    if (monto_anticipo !== undefined) {
      updates.push('monto_anticipo = ?');
      params.push(monto_anticipo ? Number(monto_anticipo) : 0);
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
// CANCELAR CITA POR CLIENTA (AUTOGESTIÓN)
// ==========================================
router.patch('/:id/cancelar-cliente', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const usuario_id = req.usuario.id;
    const esAdmin = req.usuario.rol_id === 2 || req.usuario.rol === 'Administradora';

    const [citas] = await pool.execute('SELECT id, usuario_id, estado_id FROM citas WHERE id = ?', [id]);
    if (citas.length === 0) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    const cita = citas[0];
    if (cita.usuario_id !== usuario_id && !esAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para cancelar esta cita' });
    }
    if (cita.estado_id === 3) {
      return res.status(400).json({ error: 'La cita ya se encuentra cancelada' });
    }
    if (cita.estado_id === 4) {
      return res.status(400).json({ error: 'No es posible cancelar una cita que ya fue realizada' });
    }

    await pool.execute('UPDATE citas SET estado_id = 3 WHERE id = ?', [id]);
    res.json({ mensaje: 'Cita cancelada correctamente. El espacio ha sido liberado.' });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al cancelar la cita' });
  }
});

// ==========================================
// REPROGRAMAR CITA POR CLIENTA (AUTOGESTIÓN)
// ==========================================
router.patch('/:id/reprogramar', verificarToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { fecha, hora_inicio } = req.body;
    const usuario_id = req.usuario.id;
    const esAdmin = req.usuario.rol_id === 2 || req.usuario.rol === 'Administradora';

    if (!fecha || !hora_inicio) {
      return res.status(400).json({ error: 'La nueva fecha y hora son obligatorias' });
    }
    const fechaActual = new Date().toISOString().split('T')[0];
    if (fecha < fechaActual) {
      return res.status(400).json({ error: 'No es posible reprogramar a una fecha pasada' });
    }

    const [citas] = await pool.execute(
      `SELECT c.id, c.usuario_id, c.estado_id, c.manicurista_id, s.duracion_min
       FROM citas c
       JOIN servicios s ON c.servicio_id = s.id
       WHERE c.id = ?`,
      [id]
    );
    if (citas.length === 0) return res.status(404).json({ error: 'Cita no encontrada' });
    const cita = citas[0];

    if (cita.usuario_id !== usuario_id && !esAdmin) {
      return res.status(403).json({ error: 'No tienes permiso para reprogramar esta cita' });
    }
    if (cita.estado_id === 3 || cita.estado_id === 4) {
      return res.status(400).json({ error: 'Solo se pueden reprogramar citas activas' });
    }

    const [hH, hM] = String(hora_inicio).split(':').map(Number);
    const minInicio = hH * 60 + hM;
    const minFin = minInicio + Number(cita.duracion_min);
    const horaFinCalculada = `${String(Math.floor(minFin / 60)).padStart(2, '0')}:${String(minFin % 60).padStart(2, '0')}:00`;
    const horaInicioFormatted = `${String(hH).padStart(2, '0')}:${String(hM).padStart(2, '0')}:00`;

    // Validar solapamiento con la manicurista asignada
    let solapadosQuery = `
      SELECT c.id FROM citas c
      WHERE c.fecha = ? AND c.estado_id != 3 AND c.id != ?
        AND (c.hora_inicio < ? AND c.hora_fin > ?)
    `;
    const solapadosParams = [fecha, id, horaFinCalculada, horaInicioFormatted];
    if (cita.manicurista_id) {
      solapadosQuery += ' AND (c.manicurista_id = ? OR c.manicurista_id IS NULL)';
      solapadosParams.push(cita.manicurista_id);
    }
    const [solapados] = await pool.execute(solapadosQuery, solapadosParams);
    if (solapados.length > 0) {
      return res.status(409).json({ error: 'El horario seleccionado no está disponible para esa manicurista. Elige otro horario.' });
    }

    await pool.execute(
      'UPDATE citas SET fecha = ?, hora_inicio = ?, hora_fin = ?, estado_id = 1 WHERE id = ?',
      [fecha, horaInicioFormatted, horaFinCalculada, id]
    );
    res.json({ mensaje: '¡Cita reprogramada con éxito!', fecha, hora_inicio: horaInicioFormatted, hora_fin: horaFinCalculada });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Error al reprogramar la cita' });
  }
});

// ==========================================
// AGENDAR NUEVA CITA (SOPORTA 1 O VARIOS SERVICIOS CONTINUOS)
// ==========================================
router.post('/', verificarToken, async (req, res) => {
  try {
    const { servicios_ids, servicio_id, manicurista_id, fecha, hora_inicio, observacion, comprobante_pago, monto_anticipo } = req.body;
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
    let serviciosEncontrados;
    try {
      [serviciosEncontrados] = await pool.execute(
        `SELECT id, nombre, duracion_min, precio FROM servicios WHERE id IN (${placeholders}) AND (activo = 1 OR activo IS NULL)`,
        listaIds
      );
    } catch (colActivoErr) {
      [serviciosEncontrados] = await pool.execute(
        `SELECT id, nombre, duracion_min, precio FROM servicios WHERE id IN (${placeholders})`,
        listaIds
      );
    }

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

    const mId = manicurista_id ? Number(manicurista_id) : null;

    // 4. Validar solapamiento con citas existentes (soporta citas paralelas con profesionales distintas)
    if (mId) {
      const [solapados] = await pool.execute(
        `SELECT c.id, c.hora_inicio, c.hora_fin, s.nombre AS servicio_nombre
         FROM citas c
         JOIN servicios s ON c.servicio_id = s.id
         WHERE c.fecha = ? 
           AND c.estado_id != 3 
           AND (c.hora_inicio < ? AND c.hora_fin > ?)
           AND (c.manicurista_id = ? OR c.manicurista_id IS NULL)
         LIMIT 1`,
        [fecha, horaFinCalculada, horaInicioFormatted, mId]
      );

      if (solapados.length > 0) {
        const cChocante = solapados[0];
        const hIni = cChocante.hora_inicio.substring(0, 5);
        const hFin = cChocante.hora_fin.substring(0, 5);
        return res.status(409).json({ 
          error: `⛔ Conflicto de horario: La manicurista seleccionada ya tiene una cita activa de ${hIni} a ${hFin}. Por favor elige otro horario o selecciona "Cualquiera disponible".`
        });
      }
    } else {
      // Si no especificó manicurista, verificar la capacidad total del salón en ese rango
      let totalManicuristas = 3;
      try {
        const [countM] = await pool.execute('SELECT COUNT(*) AS total FROM manicuristas WHERE activo = 1');
        totalManicuristas = Math.max(Number(countM[0]?.total) || 1, 1);
      } catch (errM) {}

      const [solapados] = await pool.execute(
        `SELECT COUNT(*) AS total
         FROM citas c
         WHERE c.fecha = ? 
           AND c.estado_id != 3 
           AND (c.hora_inicio < ? AND c.hora_fin > ?)`,
        [fecha, horaFinCalculada, horaInicioFormatted]
      );

      if (Number(solapados[0]?.total) >= totalManicuristas) {
        return res.status(409).json({ 
          error: `⛔ Horario completo: Todas las manicuristas del salón están ocupadas de ${horaInicioFormatted.substring(0, 5)} a ${horaFinCalculada.substring(0, 5)}. Por favor elige otro horario.`
        });
      }
    }

    // 5. Concatenar nota si es combo
    const primerServicioId = serviciosEncontrados[0].id;
    const notaCompleta = serviciosEncontrados.length > 1 
      ? `[Combo de ${serviciosEncontrados.length} servicios: ${nombresServicios}] ${observacion ? '— ' + String(observacion).trim() : ''}`
      : (observacion ? String(observacion).trim() : null);

    const compPago = comprobante_pago ? String(comprobante_pago).trim() : null;
    const mAbono = compPago ? (Number(monto_anticipo) || 20000) : 0;
    const estPago = compPago ? 'parcial' : 'pendiente';

    let result;
    try {
      [result] = await pool.execute(
        `INSERT INTO citas (usuario_id, servicio_id, manicurista_id, estado_id, fecha, hora_inicio, hora_fin, precio, observacion, estado_pago, comprobante_pago, monto_anticipo)
         VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [usuario_id, primerServicioId, mId, fecha, horaInicioFormatted, horaFinCalculada, precioTotal, notaCompleta, estPago, compPago, mAbono]
      );
    } catch (insertFullErr) {
      try {
        [result] = await pool.execute(
          `INSERT INTO citas (usuario_id, servicio_id, manicurista_id, estado_id, fecha, hora_inicio, hora_fin, precio, observacion, estado_pago)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?, ?)`,
          [usuario_id, primerServicioId, mId, fecha, horaInicioFormatted, horaFinCalculada, precioTotal, notaCompleta, estPago]
        );
      } catch (insertErr) {
        [result] = await pool.execute(
          `INSERT INTO citas (usuario_id, servicio_id, estado_id, fecha, hora_inicio, hora_fin, precio, observacion, estado_pago)
           VALUES (?, ?, 1, ?, ?, ?, ?, ?, ?)`,
          [usuario_id, primerServicioId, fecha, horaInicioFormatted, horaFinCalculada, precioTotal, notaCompleta, estPago]
        );
      }
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
        precio_total: precioTotal,
        comprobante_pago: compPago,
        estado_pago: estPago
      }
    });
  } catch (error) {
    console.error('Error en POST /citas:', error);
    if (error.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: '⛔ Horario no disponible: Ya existe una cita agendada en este horario. Por favor elige otro horario o manicurista.' });
    }
    res.status(500).json({ error: error.message || 'Error interno al procesar la reserva' });
  }
});

export default router;
