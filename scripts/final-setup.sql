-- CONFIGURACIÓN FINAL DEL SISTEMA
-- Limpiar datos de prueba y configurar usuario administrador único

-- Limpiar usuarios de prueba
DELETE FROM user_sessions;
DELETE FROM users WHERE email != 'maycamadmin@maycam.com';

-- Crear usuario administrador único
INSERT INTO users (email, name, password_hash, role, is_active, can_view_logs) 
VALUES (
  'maycamadmin@maycam.com', 
  'Administrador MAYCAM', 
  '$2b$12$LQv3c1yAvFnpsIjcLMTuNOHHDJkqP.TaP0gs2GuqbG5vMw/aO.Uy6', -- maycamadmin2025!
  'admin', 
  true, 
  true
) ON CONFLICT (email) DO UPDATE SET
  name = EXCLUDED.name,
  password_hash = EXCLUDED.password_hash,
  role = EXCLUDED.role,
  is_active = EXCLUDED.is_active,
  can_view_logs = EXCLUDED.can_view_logs;

-- Configurar IVA por defecto
INSERT INTO config (id, iva_percentage) VALUES (1, 21.00) 
ON CONFLICT (id) DO UPDATE SET iva_percentage = EXCLUDED.iva_percentage;

-- Crear algunos proveedores base
INSERT INTO suppliers (name) VALUES 
  ('PROVEEDOR PRINCIPAL'),
  ('DISTRIBUIDOR NACIONAL'),
  ('IMPORTADOR DIRECTO')
ON CONFLICT (name) DO NOTHING;

-- Crear algunas marcas base
INSERT INTO brands (name) VALUES 
  ('MARCA PREMIUM'),
  ('MARCA ESTÁNDAR'),
  ('MARCA ECONÓMICA')
ON CONFLICT (name) DO NOTHING;

-- Limpiar logs antiguos (mantener solo los últimos 1000)
DELETE FROM activity_logs WHERE id NOT IN (
  SELECT id FROM activity_logs ORDER BY created_at DESC LIMIT 1000
);

-- Optimizar tablas
VACUUM ANALYZE users;
VACUUM ANALYZE inventory;
VACUUM ANALYZE suppliers;
VACUUM ANALYZE brands;
VACUUM ANALYZE activity_logs;

-- Crear índices adicionales para mejor rendimiento
CREATE INDEX IF NOT EXISTS idx_inventory_created_at ON inventory(created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_company_channel ON inventory(company, channel);
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_action ON activity_logs(user_id, action);

-- Función para limpiar sesiones expiradas automáticamente
CREATE OR REPLACE FUNCTION auto_cleanup_sessions()
RETURNS void AS $$
BEGIN
  DELETE FROM user_sessions WHERE expires_at < NOW() - INTERVAL '1 day';
END;
$$ LANGUAGE plpgsql;

-- Log de configuración inicial
INSERT INTO activity_logs (
  user_id, user_email, user_name, action, description, created_at
) VALUES (
  1, 'maycamadmin@maycam.com', 'Administrador MAYCAM', 'SYSTEM_SETUP', 
  'Sistema configurado para producción - Usuario administrador único creado', 
  NOW()
);
