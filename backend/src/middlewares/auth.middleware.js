import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'manicure_secret_key';

// Middleware para verificar token JWT
export function verificarToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token requerido' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.usuario = payload;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Token inválido o expirado' });
  }
}

// Middleware para verificar si es administradora (rol_id = 2)
export function soloAdmin(req, res, next) {
  if (!req.usuario || (req.usuario.rol_id !== 2 && req.usuario.rol !== 'Administradora')) {
    return res.status(403).json({ error: 'Permiso denegado: Esta acción requiere rol de Administradora' });
  }
  next();
}
