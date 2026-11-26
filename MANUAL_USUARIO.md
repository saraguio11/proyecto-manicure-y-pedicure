# 📖 Manual de Usuario — Glam Nails Studio & Spa

Guía práctica para el uso del sistema web de gestión y reserva de citas de **Glam Nails Studio & Spa**.

---

## 1. Acceso al Sistema

### 1.1 Registro de Clienta
1. En el menú lateral izquierdo, haz clic en **"Soy Clienta"**.
2. Selecciona **"Create an account"**.
3. Diligencia todos los campos obligatorios:
   - **Full Name**: Nombre completo (3 a 100 letras, sin números ni símbolos).
   - **Document ID / Cédula**: Solo números (5 a 15 dígitos).
   - **Phone / WhatsApp**: Número de contacto (7 a 15 dígitos).
   - **Email**: Correo electrónico válido (`ejemplo@correo.com`).
   - **Password**: Contraseña de mínimo 6 caracteres.
4. Presiona **"Create Account"** para iniciar sesión automáticamente.

### 1.2 Inicio de Sesión y Bloqueo de Seguridad
- Ingresa tu correo y contraseña en **"Soy Clienta"** o **"Administradora"**.
- Puedes usar el botón del ojo (`🔒` / `👁️`) para mostrar u ocultar la contraseña.
- **Protección contra fuerza bruta:** Si se ingresan **5 intentos fallidos**, el sistema cierra automáticamente el modal de login y bloquea nuevos intentos durante **15 minutos**.

### 1.3 Cierre de Sesión
- Presiona **"Cerrar sesión"** en la parte inferior del menú lateral. Esto elimina el token JWT del navegador y limpia los datos de sesión.

---

## 2. Flujo para Clientas

### 2.1 Explorar Tratamientos y Diseños
- **Tratamientos:** Permite seleccionar hasta **2 servicios continuos** para una misma sesión (ejemplo: Manicure Semipermanente + Spa Pedicure).
- **Diseños (Lookbook):** Muestra diseños de referencia; al elegir **"✨ Quiero este diseño"**, carga automáticamente el servicio sugerido y la nota en el formulario de reserva.

### 2.2 Reservar una Cita
1. Ve a **Reservar** en el menú lateral.
2. Verifica los servicios seleccionados, su duración total y valor en **COP**.
3. Elige la **manicurista** de tu preferencia (o deja *"Cualquiera disponible"*).
4. Selecciona la **fecha** (solo fechas desde hoy en adelante, hora de Colombia `America/Bogota`).
5. En el **calendario interactivo**, observa los bloques ya ocupados y haz clic en una franja libre para fijar tu hora de inicio.
6. Opcionalmente ingresa el número de comprobante de anticipo (**Nequi / Daviplata**) y notas personalizadas.
7. Presiona **"Confirmar Cita"**.

### 2.3 Mis Citas (Autogestión)
En la sección **Mis Citas** puedes:
- Ver estado de la cita (*Pendiente*, *Confirmada*, *Atendida*, *Cancelada*) y estado de pago (*pendiente*, *parcial*, *pagado*).
- **Descargar `.ics` o abrir en Google Calendar** para guardar un recordatorio personal.
- **Reprogramar:** Abre el calendario interactivo con los horarios ocupados reales del día elegido para escoger una nueva fecha y hora.
- **Cancelar Cita:** Libera inmediatamente el horario en la agenda del salón.

---

## 3. Flujo para Administradora

Al iniciar sesión como **Administradora**, se abre el **Panel de Control Exclusivo**:

### 3.1 Dashboard
Muestra en tiempo real: Total de citas, Pendientes, Confirmadas, Ingresos del Mes en COP, Atendidas, Clientas registradas, gráfico circular de estados, top 5 ingresos recientes y agenda del día.

### 3.2 Gestión de Citas
- **Vista Google Calendar (Día):** Visualiza todas las citas del día por horario y permite filtrar por manicurista o navegar entre días. Al hacer clic en una cita se abre el detalle para confirmar, marcar atendida, cancelar o actualizar el pago.
- **Vista Tabla:** Lista completa filtrable por estado, con selector rápido para asignar manicurista, cambiar estado de cita o estado de pago.

### 3.3 Servicios y Manicuristas (CRUD)
- **Servicios:** Crear, editar, desactivar o reactivar servicios (validando que no tenga citas futuras activas antes de desactivar).
- **Manicuristas:** Registrar especialistas, editar especialidad/foto, desactivar o reactivar.

### 3.4 Reportes Generales y Específicos
En la pestaña **Reportes**:
- **Reportes Generales:** KPIs globales del filtro aplicado, resumen por manicurista y servicios más solicitados.
- **Reportes Específicos:** Filtra combinando **Fecha Desde / Hasta**, **Manicurista**, **Servicio**, **Clienta**, **Estado**, **Orden** y **Búsqueda rápida**.
- **Exportación:** Botón **📥 Exportar CSV** (compatible con Excel con tildes) y **🖨 Imprimir / PDF**.

### 3.5 Usuarios y Roles
En la pestaña **Usuarios**:
- Presiona **"+ Crear Usuario / Rol"** para registrar una nueva cuenta y asignarle el rol **Clienta** o **Administradora**.
- Cambia el rol o activa/desactiva usuarios existentes directamente desde la tabla.
