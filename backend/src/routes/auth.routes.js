import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../index.js';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'manicure_secret_key';

// Mapa en memoria para bloqueo de fuerza bruta por IP/Correo
// Estructura: { [identificador]: { intentos: number, bloqueadoHasta: number } }
const intentosLogin = new Map();
const MAX_INTENTOS = 5;
const TIEMPO_BLOQUEO_MS = 15 * 60 * 1000; // 15 minutos

// Expresión regular para validar formato seguro de correo, nombre, documento y teléfono
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NOMBRE_REGEX = /^[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ\s]{3,100}$/;
const DOCUMENTO_REGEX = /^\d{5,15}$/;
const TELEFONO_REGEX = /^\+?\d{7,15}$/;

// ==========================================
// REGISTRO DE CLIENTAS
// ==========================================
router.post('/registro', async (req, res) => {
  try {
    let { nombre_completo, documento, telefono, correo, password } = req.body || {};

    // 1. Sanitización básica
    nombre_completo = typeof nombre_completo === 'string' ? nombre_completo.trim() : '';
    documento = typeof documento === 'string' || typeof documento === 'number' ? String(documento).trim() : '';
    telefono = typeof telefono === 'string' || typeof telefono === 'number' ? String(telefono).trim() : '';
    correo = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';

    // 2. Validación estricta del lado del servidor
    if (!nombre_completo || !documento || !telefono || !correo || !password) {
      return res.status(400).json({ error: 'Todos los campos son estrictamente obligatorios' });
    }

    if (!NOMBRE_REGEX.test(nombre_completo)) {
      return res.status(400).json({ error: 'El nombre completo debe tener entre 3 y 100 letras sin números ni símbolos' });
    }

    if (!DOCUMENTO_REGEX.test(documento)) {
      return res.status(400).json({ error: 'El documento debe contener solo números (entre 5 y 15 dígitos)' });
    }

    if (!TELEFONO_REGEX.test(telefono)) {
      return res.status(400).json({ error: 'El teléfono debe ser un número válido de 7 a 15 dígitos' });
    }

    if (correo.length > 120 || !EMAIL_REGEX.test(correo)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
    }

    if (password.length < 6 || password.length > 100) {
      return res.status(400).json({ error: 'La contraseña debe tener entre 6 y 100 caracteres' });
    }

    // Seguridad: Prevenir escalada de privilegios (nadie puede registrarse directamente como admin)
    const rolSeguro = 1; // Solo Clienta

    // 3. Protección contra SQL Injection usando consultas parametrizadas
    const [existente] = await pool.execute(
      'SELECT id FROM usuarios WHERE correo = ? OR documento = ? LIMIT 1',
      [correo, documento]
    );

    if (existente.length > 0) {
      return res.status(400).json({ error: 'El correo electrónico o documento ya se encuentra registrado' });
    }

    // 4. Encriptación segura de contraseña con salting (bcrypt)
    const salt = await bcrypt.genSalt(10);
    const password_hash = await bcrypt.hash(password, salt);

    const [result] = await pool.execute(
      `INSERT INTO usuarios (rol_id, nombre_completo, documento, telefono, correo, password_hash)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [rolSeguro, nombre_completo, documento, telefono, correo, password_hash]
    );

    // 5. Creación de Token JWT seguro (expira en 7 días)
    const token = jwt.sign(
      { id: result.insertId, correo, rol_id: rolSeguro, nombre: nombre_completo, rol: 'Clienta' },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // 6. Protección de información sensible: JAMÁS devolver password_hash
    res.status(201).json({
      mensaje: '¡Cuenta creada exitosamente! Bienvenida a Glam Nails.',
      token,
      usuario: { id: result.insertId, nombre_completo, correo, rol_id: rolSeguro, rol: 'Clienta' }
    });
  } catch (error) {
    console.error('Error en /registro:', error);
    // Manejo seguro de errores: no exponer trazas internas de la base de datos al cliente
    res.status(500).json({ error: 'Ocurrió un error interno al procesar el registro' });
  }
});

// ==========================================
// INICIO DE SESIÓN CON PROTECCIÓN DE 5 INTENTOS
// ==========================================
router.post('/login', async (req, res) => {
  try {
    let { correo, password } = req.body || {};
    correo = typeof correo === 'string' ? correo.trim().toLowerCase() : '';
    password = typeof password === 'string' ? password : '';

    const ahora = Date.now();
    const ipCliente = req.ip || req.socket?.remoteAddress || 'unknown';
    const claveIp = `ip_${ipCliente}`;
    const claveCorreo = correo ? `${correo}_${ipCliente}` : claveIp;

    // Validar si la IP o la cuenta ya está bloqueada por exceder 5 intentos
    const bloqueoActivo = verificarBloqueo(claveIp, ahora) || verificarBloqueo(claveCorreo, ahora);
    if (bloqueoActivo) {
      const minutosRestantes = Math.ceil((bloqueoActivo.bloqueadoHasta - ahora) / 60000);
      return res.status(429).json({
        error: `⛔ Login cerrado por seguridad (5 intentos fallidos). Inténtalo de nuevo en ${minutosRestantes} minuto(s).`,
        bloqueado: true,
        intentos_restantes: 0,
        bloqueado_hasta: bloqueoActivo.bloqueadoHasta
      });
    }

    if (!correo || !password) {
      return res.status(400).json({ error: 'Por favor ingresa tu correo y contraseña' });
    }

    if (!EMAIL_REGEX.test(correo)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
    }

    // Consulta segura parametrizada (Prevención SQL Injection)
    const [usuarios] = await pool.execute(
      `SELECT u.id, u.rol_id, u.nombre_completo, u.correo, u.password_hash, u.activo, r.nombre AS rol_nombre 
       FROM usuarios u 
       JOIN roles r ON u.rol_id = r.id 
       WHERE u.correo = ? LIMIT 1`,
      [correo]
    );

    // Si el usuario no existe o está inactivo
    if (usuarios.length === 0 || !usuarios[0].activo) {
      const { restantes, bloqueadoHasta } = registrarIntentoFallidoDual(claveIp, claveCorreo);
      if (restantes === 0) {
        return res.status(429).json({
          error: '⛔ Has alcanzado el límite de 5 intentos fallidos. El login se ha cerrado por seguridad durante 15 minutos.',
          bloqueado: true,
          intentos_restantes: 0,
          bloqueado_hasta: bloqueadoHasta
        });
      }
      return res.status(401).json({
        error: `Credenciales inválidas. Te quedan ${restantes} intento(s) antes de cerrar el login.`,
        bloqueado: false,
        intentos_restantes: restantes
      });
    }

    const usuario = usuarios[0];

    // Verificar contraseña con bcrypt
    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      const { restantes, bloqueadoHasta } = registrarIntentoFallidoDual(claveIp, claveCorreo);
      if (restantes === 0) {
        return res.status(429).json({
          error: '⛔ Has alcanzado el límite de 5 intentos fallidos. El login se ha cerrado por seguridad durante 15 minutos.',
          bloqueado: true,
          intentos_restantes: 0,
          bloqueado_hasta: bloqueadoHasta
        });
      }
      return res.status(401).json({
        error: `Contraseña incorrecta. Te quedan ${restantes} intento(s) antes de cerrar el login.`,
        bloqueado: false,
        intentos_restantes: restantes
      });
    }

    // Si el login fue exitoso: Limpiar intentos fallidos acumulados
    intentosLogin.delete(claveIp);
    intentosLogin.delete(claveCorreo);

    // Generar Token JWT firmado
    const token = jwt.sign(
      { id: usuario.id, correo: usuario.correo, rol_id: usuario.rol_id, nombre: usuario.nombre_completo, rol: usuario.rol_nombre },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Exclusión de datos sensibles (password_hash nunca se envía)
    res.json({
      mensaje: 'Inicio de sesión exitoso',
      token,
      usuario: {
        id: usuario.id,
        nombre: usuario.nombre_completo,
        correo: usuario.correo,
        rol: usuario.rol_nombre,
        rol_id: usuario.rol_id
      }
    });
  } catch (error) {
    console.error('Error en /login:', error);
    res.status(500).json({ error: 'Ocurrió un error interno en el servidor de autenticación' });
  }
});

// Funciones auxiliares para manejo de intentos
function verificarBloqueo(clave, ahora) {
  const info = intentosLogin.get(clave);
  if (!info) return null;
  if (info.bloqueadoHasta > ahora) return info;
  if (info.bloqueadoHasta !== 0 && info.bloqueadoHasta <= ahora) {
    intentosLogin.delete(clave);
  }
  return null;
}

function registrarIntentoFallido(clave) {
  const ahora = Date.now();
  const info = intentosLogin.get(clave) || { intentos: 0, bloqueadoHasta: 0 };
  info.intentos += 1;

  if (info.intentos >= MAX_INTENTOS) {
    info.bloqueadoHasta = ahora + TIEMPO_BLOQUEO_MS;
  }
  intentosLogin.set(clave, info);
  return info;
}

function registrarIntentoFallidoDual(claveIp, claveCorreo) {
  const infoIp = registrarIntentoFallido(claveIp);
  const infoCorreo = claveCorreo !== claveIp ? registrarIntentoFallido(claveCorreo) : infoIp;
  const maxIntentosUsados = Math.max(infoIp.intentos, infoCorreo.intentos);
  const restantes = Math.max(0, MAX_INTENTOS - maxIntentosUsados);
  const bloqueadoHasta = Math.max(infoIp.bloqueadoHasta, infoCorreo.bloqueadoHasta);
  return { restantes, bloqueadoHasta };
}

export default router;
