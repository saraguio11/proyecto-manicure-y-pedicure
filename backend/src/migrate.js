import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import mysql from 'mysql2/promise';
import dotenv from 'dotenv';

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || process.env.MYSQLHOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || process.env.MYSQLPORT) || 3306,
  user: process.env.DB_USER || process.env.MYSQLUSER || 'root',
  password: process.env.DB_PASSWORD || process.env.MYSQLPASSWORD || '',
  database: process.env.DB_NAME || process.env.MYSQLDATABASE || process.env.MYSQL_DATABASE || 'manicure_pedicure'
};

function splitStatements(sql) {
  const withoutTriggers = sql.replace(/DELIMITER\s+\$\$[\s\S]*?DELIMITER\s*;/gi, '');
  return withoutTriggers
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.split('\n').every((line) => line.trim() === '' || line.trim().startsWith('--')))
    .map((part) => {
      let statement = part
        .replace(/^CREATE TABLE /i, 'CREATE TABLE IF NOT EXISTS ')
        .replace(/^INSERT INTO /i, 'INSERT IGNORE INTO ')
        .replace(/^CREATE VIEW /i, 'CREATE OR REPLACE VIEW ');
      return `${statement};`;
    });
}

async function migrar() {
  const schemaPath = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'schema.sql');
  const sql = await readFile(schemaPath, 'utf8');
  const statements = splitStatements(sql);

  const connection = await mysql.createConnection(dbConfig);

  try {
    for (const statement of statements) {
      await connection.query(statement);
    }
    console.log(`Migración lista: ${statements.length} sentencias ejecutadas.`);
  } catch (err) {
    console.error('Error en la migración:', err.message);
    process.exitCode = 1;
  } finally {
    await connection.end();
  }
}

migrar();
