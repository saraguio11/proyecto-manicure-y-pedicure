DROP DATABASE IF EXISTS manicure_pedicure;
CREATE DATABASE manicure_pedicure
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;
USE manicure_pedicure;

CREATE TABLE roles (
  id      TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre  VARCHAR(30) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_roles_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE usuarios (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  rol_id          TINYINT UNSIGNED NOT NULL,
  nombre_completo VARCHAR(120) NOT NULL,
  documento       VARCHAR(20)  NOT NULL,
  telefono        VARCHAR(20)  NOT NULL,
  correo          VARCHAR(120) NOT NULL,
  password_hash   VARCHAR(255) NOT NULL,
  activo          TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en       DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_usuarios_documento (documento),
  UNIQUE KEY uq_usuarios_correo (correo),
  KEY idx_usuarios_nombre (nombre_completo),
  KEY idx_usuarios_telefono (telefono),
  CONSTRAINT fk_usuarios_rol FOREIGN KEY (rol_id) REFERENCES roles (id)
) ENGINE=InnoDB;

CREATE TABLE servicios (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(100) NOT NULL,
  descripcion  TEXT         NULL,
  duracion_min SMALLINT UNSIGNED NOT NULL,
  precio       DECIMAL(10,2) NOT NULL,
  imagen_url   VARCHAR(255) NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME   NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_servicios_nombre (nombre),
  KEY idx_servicios_activo (activo),
  CONSTRAINT chk_servicios_duracion CHECK (duracion_min > 0),
  CONSTRAINT chk_servicios_precio   CHECK (precio > 0)
) ENGINE=InnoDB;

CREATE TABLE disenos (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  servicio_id INT UNSIGNED NOT NULL,
  titulo      VARCHAR(100) NULL,
  imagen_url  VARCHAR(255) NOT NULL,
  activo      TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_disenos_servicio (servicio_id),
  CONSTRAINT fk_disenos_servicio FOREIGN KEY (servicio_id)
    REFERENCES servicios (id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE horarios_atencion (
  id                   INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dia_semana           TINYINT UNSIGNED NOT NULL,
  hora_inicio          TIME NOT NULL,
  hora_fin             TIME NOT NULL,
  duracion_espacio_min SMALLINT UNSIGNED NOT NULL DEFAULT 60,
  activo               TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id),
  KEY idx_horarios_dia (dia_semana, activo),
  CONSTRAINT chk_horarios_dia      CHECK (dia_semana BETWEEN 1 AND 7),
  CONSTRAINT chk_horarios_rango    CHECK (hora_fin > hora_inicio),
  CONSTRAINT chk_horarios_espacio  CHECK (duracion_espacio_min > 0)
) ENGINE=InnoDB;

CREATE TABLE bloqueos_horario (
  id          INT UNSIGNED NOT NULL AUTO_INCREMENT,
  fecha       DATE NOT NULL,
  hora_inicio TIME NULL,
  hora_fin    TIME NULL,
  motivo      VARCHAR(150) NULL,
  creado_en   DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_bloqueos_fecha (fecha),
  CONSTRAINT chk_bloqueos_rango CHECK (
    (hora_inicio IS NULL AND hora_fin IS NULL)
    OR (hora_inicio IS NOT NULL AND hora_fin IS NOT NULL AND hora_fin > hora_inicio)
  )
) ENGINE=InnoDB;

CREATE TABLE estados_cita (
  id     TINYINT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre VARCHAR(30) NOT NULL,
  color  VARCHAR(20) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_estados_cita_nombre (nombre)
) ENGINE=InnoDB;

CREATE TABLE citas (
  id              INT UNSIGNED NOT NULL AUTO_INCREMENT,
  usuario_id      INT UNSIGNED NOT NULL,
  servicio_id     INT UNSIGNED NOT NULL,
  estado_id       TINYINT UNSIGNED NOT NULL DEFAULT 1,
  fecha           DATE NOT NULL,
  hora_inicio     TIME NOT NULL,
  hora_fin        TIME NOT NULL,
  precio          DECIMAL(10,2) NOT NULL,
  observacion     VARCHAR(255) NULL,
  estado_pago     ENUM('pendiente','parcial','pagado') NOT NULL DEFAULT 'pendiente',
  creado_en       DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  bloquea_horario TINYINT GENERATED ALWAYS AS (IF(estado_id = 3, NULL, 1)) VIRTUAL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_citas_horario_activo (fecha, hora_inicio, bloquea_horario),
  KEY idx_citas_usuario (usuario_id, fecha),
  KEY idx_citas_servicio (servicio_id),
  KEY idx_citas_estado (estado_id),
  KEY idx_citas_fecha (fecha),
  CONSTRAINT fk_citas_usuario  FOREIGN KEY (usuario_id)  REFERENCES usuarios (id),
  CONSTRAINT fk_citas_servicio FOREIGN KEY (servicio_id) REFERENCES servicios (id),
  CONSTRAINT fk_citas_estado   FOREIGN KEY (estado_id)   REFERENCES estados_cita (id),
  CONSTRAINT chk_citas_rango   CHECK (hora_fin > hora_inicio),
  CONSTRAINT chk_citas_precio  CHECK (precio > 0)
) ENGINE=InnoDB;

CREATE TABLE citas_historial (
  id               INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cita_id          INT UNSIGNED NOT NULL,
  estado_anterior  TINYINT UNSIGNED NULL,
  estado_nuevo     TINYINT UNSIGNED NOT NULL,
  fecha_anterior   DATE NULL,
  hora_anterior    TIME NULL,
  realizado_por    INT UNSIGNED NOT NULL,
  creado_en        DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_hist_cita (cita_id),
  CONSTRAINT fk_hist_cita   FOREIGN KEY (cita_id)         REFERENCES citas (id) ON DELETE CASCADE,
  CONSTRAINT fk_hist_ant    FOREIGN KEY (estado_anterior) REFERENCES estados_cita (id),
  CONSTRAINT fk_hist_nuevo  FOREIGN KEY (estado_nuevo)    REFERENCES estados_cita (id),
  CONSTRAINT fk_hist_user   FOREIGN KEY (realizado_por)   REFERENCES usuarios (id)
) ENGINE=InnoDB;

CREATE TABLE pagos (
  id             INT UNSIGNED NOT NULL AUTO_INCREMENT,
  cita_id        INT UNSIGNED NOT NULL,
  registrado_por INT UNSIGNED NOT NULL,
  valor          DECIMAL(10,2) NOT NULL,
  metodo_pago    ENUM('efectivo','transferencia','otro') NOT NULL,
  fecha_pago     DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  observacion    VARCHAR(255) NULL,
  PRIMARY KEY (id),
  KEY idx_pagos_cita (cita_id),
  KEY idx_pagos_fecha (fecha_pago),
  CONSTRAINT fk_pagos_cita FOREIGN KEY (cita_id)        REFERENCES citas (id),
  CONSTRAINT fk_pagos_user FOREIGN KEY (registrado_por) REFERENCES usuarios (id),
  CONSTRAINT chk_pagos_valor CHECK (valor > 0)
) ENGINE=InnoDB;

DELIMITER $$

CREATE TRIGGER trg_pagos_validar_saldo
BEFORE INSERT ON pagos
FOR EACH ROW
BEGIN
  DECLARE v_precio DECIMAL(10,2);
  DECLARE v_pagado DECIMAL(10,2);

  SELECT precio INTO v_precio FROM citas WHERE id = NEW.cita_id;
  SELECT COALESCE(SUM(valor), 0) INTO v_pagado FROM pagos WHERE cita_id = NEW.cita_id;

  IF v_pagado + NEW.valor > v_precio THEN
    SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'El pago supera el saldo pendiente de la cita';
  END IF;
END$$

CREATE TRIGGER trg_pagos_actualizar_estado
AFTER INSERT ON pagos
FOR EACH ROW
BEGIN
  DECLARE v_precio DECIMAL(10,2);
  DECLARE v_pagado DECIMAL(10,2);

  SELECT precio INTO v_precio FROM citas WHERE id = NEW.cita_id;
  SELECT COALESCE(SUM(valor), 0) INTO v_pagado FROM pagos WHERE cita_id = NEW.cita_id;

  UPDATE citas
     SET estado_pago = CASE
                         WHEN v_pagado >= v_precio THEN 'pagado'
                         WHEN v_pagado > 0         THEN 'parcial'
                         ELSE 'pendiente'
                       END
   WHERE id = NEW.cita_id;
END$$

DELIMITER ;

CREATE VIEW vw_citas_detalle AS
SELECT c.id AS cita_id,
       c.fecha, c.hora_inicio, c.hora_fin,
       u.id AS usuario_id, u.nombre_completo AS clienta, u.telefono,
       s.nombre AS servicio,
       e.nombre AS estado, e.color AS color_estado,
       c.precio,
       COALESCE(SUM(p.valor), 0)            AS total_pagado,
       c.precio - COALESCE(SUM(p.valor), 0) AS saldo,
       c.estado_pago,
       c.observacion
FROM citas c
JOIN usuarios u     ON u.id = c.usuario_id
JOIN servicios s    ON s.id = c.servicio_id
JOIN estados_cita e ON e.id = c.estado_id
LEFT JOIN pagos p   ON p.cita_id = c.id
GROUP BY c.id;

CREATE VIEW vw_ventas AS
SELECT DATE(p.fecha_pago) AS fecha,
       s.id               AS servicio_id,
       s.nombre           AS servicio,
       c.id               AS cita_id,
       p.valor,
       p.metodo_pago
FROM pagos p
JOIN citas c     ON c.id = p.cita_id
JOIN servicios s ON s.id = c.servicio_id;

INSERT INTO roles (id, nombre) VALUES (1, 'Clienta'), (2, 'Administradora');

INSERT INTO estados_cita (id, nombre, color) VALUES
  (1, 'Pendiente',  'amarillo'),
  (2, 'Confirmada', 'verde'),
  (3, 'Cancelada',  'rojo'),
  (4, 'Atendida',   'azul');

INSERT INTO servicios (nombre, descripcion, duracion_min, precio) VALUES
  ('Manicure tradicional', 'Limado, cutícula y esmaltado tradicional.', 45, 25000),
  ('Manicure en gel',      'Esmaltado semipermanente con acabado brillante.', 60, 40000),
  ('Pedicure tradicional', 'Limpieza, exfoliación y esmaltado de pies.', 60, 30000),
  ('Uñas acrílicas',       'Extensión de uñas con acrílico y diseño a elección.', 120, 80000);

INSERT INTO horarios_atencion (dia_semana, hora_inicio, hora_fin, duracion_espacio_min) VALUES
  (1, '08:00', '18:00', 60), (2, '08:00', '18:00', 60), (3, '08:00', '18:00', 60),
  (4, '08:00', '18:00', 60), (5, '08:00', '18:00', 60), (6, '08:00', '18:00', 60);