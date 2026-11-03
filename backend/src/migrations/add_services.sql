-- Migración: Nuevos servicios para Glam Nails Studio & Spa
-- Solo agregar servicios que NO existen en la DB
-- Existentes: Manicure tradicional, Manicure en gel, Pedicure tradicional, Uñas acrílicas

-- =============================================
-- MANICURA (nuevos)
-- =============================================
INSERT IGNORE INTO servicios (nombre, descripcion, duracion_min, precio) VALUES
  ('Semipermanente', 'Esmaltado semipermanente de larga duración con curado en lámpara UV/LED.', 60, 38000),
  ('Semipermanente con Rubber Base', 'Esmaltado semipermanente con base rubber que refuerza y protege la uña natural.', 60, 40000),
  ('Dipping', 'Técnica de inmersión en polvo acrílico para uñas resistentes y durables sin lámpara.', 60, 45000),
  ('Nivelación', 'Corrección y nivelado de la superficie de la uña para un acabado uniforme y liso.', 75, 50000),
  ('Forrado en Builder Gel', 'Refuerzo de la uña natural con builder gel para mayor durabilidad y brillo.', 90, 55000),
  ('Forrado en Polygel', 'Forrado de uñas naturales con polygel de alta densidad para mayor resistencia.', 90, 60000),
  ('Forrado en Acrílico', 'Forrado de uñas naturales con acrílico tradicional para máxima protección.', 90, 65000),
  ('Press On', 'Aplicación de uñas press on diseñadas a medida para un look profesional y temporal.', 60, 70000),
  ('Polygel con Tips (hasta largo #2)', 'Extensión de uñas con polygel sobre tips hasta largo número 2, resistentes y livianas.', 120, 85000),
  ('Acrílicas con Tips (hasta largo #2)', 'Extensión completa de uñas acrílicas sobre tips hasta largo número 2.', 120, 90000);

-- =============================================
-- RETOQUES
-- =============================================
INSERT IGNORE INTO servicios (nombre, descripcion, duracion_min, precio) VALUES
  ('Retoque de Press', 'Mantenimiento y retoque de uñas press on existentes para prolongar su duración.', 45, 60000),
  ('Retoque de Forrado en Polygel', 'Mantenimiento del forrado en polygel para rellenar el crecimiento natural.', 45, 55000),
  ('Retoque de Forrado en Acrílico', 'Mantenimiento del forrado en acrílico para rellenar el crecimiento natural.', 45, 60000),
  ('Retoque de Polygel con Tips', 'Relleno de polygel con tips para mantener el largo y la estructura de las uñas.', 45, 60000),
  ('Retoque de Acrílicas con Tips', 'Relleno de acrílicas con tips para mantener el largo y la resistencia.', 45, 70000);

-- =============================================
-- CABALLERO
-- =============================================
INSERT IGNORE INTO servicios (nombre, descripcion, duracion_min, precio) VALUES
  ('Semipermanente en manos (Caballero)', 'Esmaltado semipermanente en manos para caballero, acabado discreto y duradero.', 45, 25000),
  ('Semipermanente en pies (Caballero)', 'Esmaltado semipermanente en pies para caballero, cuidado y presentación impecable.', 45, 25000);

-- =============================================
-- SERVICIOS ADICIONALES
-- =============================================
INSERT IGNORE INTO servicios (nombre, descripcion, duracion_min, precio) VALUES
  ('Retiro de semipermanente (otro salón)', 'Retiro seguro de esmaltado semipermanente aplicado en otro salón, sin dañar la uña.', 30, 5000),
  ('Retiro de sistemas (otro salón)', 'Retiro seguro de sistemas (Press, Polygel o Acrílicas) aplicados en otro salón.', 30, 10000),
  ('Decoración Sencilla', 'Nail art básico, efectos y pedrería sencilla por diseño (aplica con más de 3 uñas decoradas por mano).', 20, 3000),
  ('Decoración Especial', 'Diseños avanzados: encapsulado, técnica reversa, caricatura o 3D por diseño (aplica con más de 3 uñas decoradas por mano).', 30, 5000);
