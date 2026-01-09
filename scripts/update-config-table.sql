-- Agregar columnas para configuración de cuotas en la tabla config
ALTER TABLE config ADD COLUMN IF NOT EXISTS cuotas_3_percentage INTEGER DEFAULT 20;
ALTER TABLE config ADD COLUMN IF NOT EXISTS cuotas_6_percentage INTEGER DEFAULT 40;
ALTER TABLE config ADD COLUMN IF NOT EXISTS cuotas_9_percentage INTEGER DEFAULT 60;
ALTER TABLE config ADD COLUMN IF NOT EXISTS cuotas_12_percentage INTEGER DEFAULT 80;

-- Actualizar la configuración existente con valores por defecto
UPDATE config SET 
  cuotas_3_percentage = 20,
  cuotas_6_percentage = 40,
  cuotas_9_percentage = 60,
  cuotas_12_percentage = 80
WHERE id = 1;

-- Insertar configuración si no existe
INSERT INTO config (id, iva_percentage, cuotas_3_percentage, cuotas_6_percentage, cuotas_9_percentage, cuotas_12_percentage)
SELECT 1, 21, 20, 40, 60, 80
WHERE NOT EXISTS (SELECT 1 FROM config WHERE id = 1);
