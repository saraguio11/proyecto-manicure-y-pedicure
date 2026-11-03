# Glam Nails — Studio & Spa

Sistema integral para gestión de citas, servicios, profesionales y clientas del salón Glam Nails.

---

## 📁 Estructura del Proyecto

```text
PROYECTO MANICURE Y PEDICURE/
├── backend/                   # API REST con Node.js + Express + MySQL
│   ├── src/
│   │   └── index.js           # Servidor Express y conexión MySQL
│   ├── schema.sql             # Tablas e inserts para Railway (sin DROP DATABASE)
│   ├── railway.json
│   ├── .env                   # Variables de entorno locales (no se sube)
│   └── package.json
├── frontend/                  # Interfaz de usuario con React + Vite
│   ├── src/                   # Componentes y vistas
│   ├── railway.json
│   └── package.json
├── base de datos manicure y pedicure.sql  # Script SQL local (XAMPP)
└── casos de uso - aplicacion manicure y pedicure.docx # Casos de uso
```

---

## 🚀 Cómo ejecutar el proyecto en VS Code

### 1. Iniciar la Base de Datos
Asegúrate de tener **XAMPP**, **WAMP** o tu servicio **MySQL** activo e importa el archivo:
- `base de datos manicure y pedicure.sql`

Revisa los datos de acceso en [`.env`](file:///c:/Users/sarag/OneDrive/Documentos/PROYECTO%20MANICURE%20Y%20PEDICURE/backend/.env) (puerto, usuario y contraseña de MySQL).

### 2. Iniciar el Backend
Abre una terminal en Visual Studio Code:
```bash
cd backend
npm run dev
```
> El servidor arrancará en `http://localhost:4000`.

### 3. Iniciar el Frontend
En una segunda terminal:
```bash
cd frontend
npm run dev
```
> La aplicación web abrirá en `http://localhost:5173`.

---

## Despliegue en Railway

El proyecto se publica como **tres servicios** en el mismo proyecto de [Railway](https://railway.app): MySQL, API (`backend`) y frontend (`frontend`). Sube el código a GitHub y conéctalo al proyecto.

### 1. Plugin MySQL

Añade el plugin **MySQL**. Railway crea la base y las variables `MYSQLHOST`, `MYSQLPORT`, `MYSQLUSER`, `MYSQLPASSWORD` y `MYSQLDATABASE`.

Importa [backend/schema.sql](backend/schema.sql) sobre esa base (Query del plugin o cliente `mysql` contra el host público). No uses el `.sql` de la raíz: ese archivo hace `DROP DATABASE` / `CREATE DATABASE` y falla en MySQL gestionado.

Después, con las variables de la API apuntando a esa base, ejecuta una vez el seed (one-off en Railway o local contra el host público):

```bash
cd backend
npm run seed
```

Cuentas de prueba:

- Administradora: `admin@glamnails.com` / `admin123`
- Clienta: `clienta@glamnails.com` / `cliente123`

### 2. Servicio backend

- Root Directory: `backend`
- Generate Domain
- Variables:

| Variable | Valor |
| --- | --- |
| `DB_HOST` | `${{MySQL.MYSQLHOST}}` |
| `DB_PORT` | `${{MySQL.MYSQLPORT}}` |
| `DB_USER` | `${{MySQL.MYSQLUSER}}` |
| `DB_PASSWORD` | `${{MySQL.MYSQLPASSWORD}}` |
| `DB_NAME` | `${{MySQL.MYSQLDATABASE}}` |
| `JWT_SECRET` | un secreto nuevo (no el de `.env.example`) |

`PORT` lo asigna Railway. Comprueba `https://<url-del-backend>/api/health`.

### 3. Servicio frontend

- Root Directory: `frontend`
- Generate Domain
- Variable de **build** (Vite la incrusta al hacer `npm run build`):

| Variable | Valor |
| --- | --- |
| `VITE_API_URL` | `https://<url-del-backend>/api` |

Si cambias la URL de la API, vuelve a desplegar el frontend para regenerar el build.

### Verificación

1. `GET /api/health` responde `{ "status": "ok", ... }`.
2. Abre la URL del frontend, lista servicios, inicia sesión y crea una reserva de prueba.
3. Si la interfaz carga pero no hay datos, `VITE_API_URL` está mal o el frontend no se reconstruyó.
