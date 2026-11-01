# Glam Nails — Studio & Spa

Sistema integral para gestión de citas, servicios, profesionales y clientas del salón Glam Nails.

---

## 📁 Estructura del Proyecto

```text
PROYECTO MANICURE Y PEDICURE/
├── backend/                   # API REST con Node.js + Express + MySQL
│   ├── src/
│   │   └── index.js           # Servidor Express y conexión MySQL
│   ├── .env                   # Variables de entorno locales
│   └── package.json
├── frontend/                  # Interfaz de usuario con React + Vite
│   ├── src/                   # Componentes y vistas
│   └── package.json
├── base de datos manicure y pedicure.sql  # Script SQL de la base de datos
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
