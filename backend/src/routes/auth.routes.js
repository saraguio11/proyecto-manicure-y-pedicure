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

// Expresión regular para validar formato seguro de correo
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ==========================================
// REGISTRO DE CLIENTAS
// ==========================================
router.post('/registro', async (req, res) => {
  try {
    let { nombre_completo, documento, telefono, correo, password, rol_id = 1 } = req.body;

    // 1. Sanitización básica
    nombre_completo = nombre_completo ? String(nombre_completo).trim() : '';
    documento = documento ? String(documento).trim() : '';
    telefono = telefono ? String(telefono).trim() : '';
    correo = correo ? String(correo).trim().toLowerCase() : '';
    password = password ? String(password) : '';

    // 2. Validación del lado del servidor
    if (!nombre_completo || !documento || !telefono || !correo || !password) {
      return res.status(400).json({ error: 'Todos los campos son estrictamente obligatorios' });
    }

    if (!EMAIL_REGEX.test(correo)) {
      return res.status(400).json({ error: 'El formato de correo electrónico no es válido' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
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
    let { correo, password } = req.body;
    correo = correo ? String(correo).trim().toLowerCase() : '';
    password = password ? String(password) : '';

    if (!correo || !password) {
      return res.status(400).json({ error: 'Por favor ingresa tu correo y contraseña' });
    }

    const ahora = Date.now();
    const claveIntento = `${correo}_${req.ip}`;
    const estadoIntento = intentosLogin.get(claveIntento) || { intentos: 0, bloqueadoHasta: 0 };

    // Validar si la cuenta/IP está bloqueada por exceder 5 intentos
    if (estadoIntento.bloqueadoHasta > ahora) {
      const minutosRestantes = Math.ceil((estadoIntento.bloqueadoHasta - ahora) / 60000);
      return res.status(429).json({
        error: `⛔ Demasiados intentos fallidos (5 de 5). Por seguridad, el acceso ha sido bloqueado temporalmente. Inténtalo de nuevo en ${minutosRestantes} minuto(s).`
      });
    }

    // Si ya pasó el tiempo de bloqueo, resetear
    if (estadoIntento.bloqueadoHasta !== 0 && estadoIntento.bloqueadoHasta <= ahora) {
      intentosLogin.delete(claveIntento);
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
      registrarIntentoFallido(claveIntento);
      const restantes = obtenerRestantes(claveIntento);
      return res.status(401).json({
        error: restantes > 0 
          ? `Credenciales inválidas. Te quedan ${restantes} intento(s) antes del bloqueo de seguridad.`
          : '⛔ Has alcanzado el límite de 5 intentos fallidos. Acceso bloqueado por 15 minutos.'
      });
    }

    const usuario = usuarios[0];

    // Verificar contraseña con bcrypt
    const passwordValido = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValido) {
      registrarIntentoFallido(claveIntento);
      const restantes = obtenerRestantes(claveIntento);
      return res.status(401).json({
        error: restantes > 0 
          ? `Contraseña incorrecta. Te quedan ${restantes} intento(s) antes del bloqueo de seguridad.`
          : '⛔ Has alcanzado el límite de 5 intentos fallidos. Acceso bloqueado por 15 minutos.'
      });
    }

    // Si el login fue exitoso: Limpiar intentos fallidos acumulados
    intentosLogin.delete(claveIntento);

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
function registrarIntentoFallido(clave) {
  const ahora = Date.now();
  const info = intentosLogin.get(clave) || { intentos: 0, bloqueadoHasta: 0 };
  info.intentos += 1;

  if (info.intentos >= MAX_INTENTOS) {
    info.bloqueadoHasta = ahora + TIEMPO_BLOQUEO_MS;
  }
  intentosLogin.set(clave, info);
}

function obtenerRestantes(clave) {
  const info = intentosLogin.get(clave);
  if (!info) return MAX_INTENTOS;
  const rem = MAX_INTENTOS - info.intentos;
  return rem > 0 ? rem : 0;
}

export default router;
