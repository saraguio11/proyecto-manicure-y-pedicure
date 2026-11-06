-- =============================================
-- Migración: Manicuristas + columna categoria en servicios + manicurista_id en citas
-- Ejecutar en Railway MySQL (Data → SQL Query)
-- =============================================

-- 1. Agregar columna categoria a servicios (si no existe)
ALTER TABLE servicios
  ADD COLUMN IF NOT EXISTS categoria VARCHAR(80) NULL AFTER imagen_url;

-- 2. Crear tabla manicuristas
CREATE TABLE IF NOT EXISTS manicuristas (
  id           INT UNSIGNED NOT NULL AUTO_INCREMENT,
  nombre       VARCHAR(120) NOT NULL,
  especialidad VARCHAR(150) NULL,
  foto_url     VARCHAR(255) NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  creado_en    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- 3. Agregar columna manicurista_id a citas (si no existe)
ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS manicurista_id INT UNSIGNED NULL AFTER servicio_id,
  ADD CONSTRAINT fk_citas_manicurista
    FOREIGN KEY IF NOT EXISTS (manicurista_id)
    REFERENCES manicuristas (id)
    ON DELETE SET NULL;

-- 4. Asignar categorías a los servicios existentes (actualización inicial)
UPDATE servicios SET categoria = '💅 Manicura'  WHERE nombre LIKE '%Manicure%' OR nombre LIKE '%Semipermanente%' OR nombre LIKE '%Dipping%' OR nombre LIKE '%Nivelación%' OR nombre LIKE '%Forrado%' OR nombre LIKE '%Press On%' OR nombre LIKE '%Polygel%' OR nombre LIKE '%Acrílica%';
UPDATE servicios SET categoria = '🦶 Pedicure'  WHERE nombre LIKE '%Pedicure%' AND categoria IS NULL;
UPDATE servicios SET categoria = '🔄 Retoques'  WHERE nombre LIKE '%Retoque%' AND categoria IS NULL;
UPDATE servicios SET categoria = '🧔 Caballero' WHERE nombre LIKE '%Caballero%' AND categoria IS NULL;
UPDATE servicios SET categoria = '✨ Adicionales' WHERE (nombre LIKE '%Retiro%' OR nombre LIKE '%Decoración%' OR nombre LIKE '%Reparación%') AND categoria IS NULL;
UPDATE servicios SET categoria = '✨ Adicionales' WHERE categoria IS NULL;
