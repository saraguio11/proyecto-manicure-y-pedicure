import bcrypt from 'bcryptjs';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

async function sembrarUsuarios() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
    user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
    password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
    database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'manicure_pedicure'
  });

  const salt = await bcrypt.genSalt(10);

  // 1. Administradora
  const passAdmin = await bcrypt.hash('admin123', salt);
  // 2. Clienta
  const passCliente = await bcrypt.hash('cliente123', salt);

  try {
    // Insertar o actualizar Administradora (rol_id = 2)
    await connection.query(`
      INSERT INTO usuarios (rol_id, nombre_completo, documento, telefono, correo, password_hash)
      VALUES (2, 'Administradora Glam Nails', '11111111', '3009998877', 'admin@glamnails.com', ?)
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        rol_id = 2;
    `, [passAdmin]);

    // Insertar o actualizar Clienta de prueba (rol_id = 1)
    await connection.query(`
      INSERT INTO usuarios (rol_id, nombre_completo, documento, telefono, correo, password_hash)
      VALUES (1, 'Camila Gómez', '22222222', '3101234567', 'clienta@glamnails.com', ?)
      ON DUPLICATE KEY UPDATE 
        password_hash = VALUES(password_hash),
        rol_id = 1;
    `, [passCliente]);

    console.log("Usuarios de prueba creados / actualizados exitosamente.");
  } catch (err) {
    console.error("Error al sembrar usuarios:", err.message);
  } finally {
    await connection.end();
  }
}

sembrarUsuarios();
