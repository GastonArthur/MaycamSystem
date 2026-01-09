# Módulo de Rentabilidad Real

Este módulo permite calcular la ganancia real de las ventas de MercadoLibre, unificando múltiples cuentas y conciliando costos, ingresos y cargos reales.

## Arquitectura

El módulo está diseñado para ser **100% aditivo** y **no intrusivo**. Funciona en paralelo al sistema existente.

### Base de Datos
Todas las tablas del módulo tienen el prefijo `rt_` para evitar colisiones.
- `rt_ml_accounts`: Credenciales de cuentas ML.
- `rt_ml_sku_map`: Mapeo de SKU a Publicaciones.
- `rt_stock_current`: Stock sincronizado.
- `rt_ml_orders`: Órdenes crudas de ML.
- `rt_sales`: Ventas normalizadas (si no se usa el modelo interno).
- `rt_sale_profit`: Cálculo de rentabilidad por venta.

### Sincronización
La sincronización se realiza mediante Cron Jobs (Server-side) que no bloquean la UI.
Endpoints:
- `POST /api/cron/rt/sync-stock`: Actualiza stock y mapeo de SKUs.
- `POST /api/cron/rt/sync-orders`: Descarga nuevas órdenes.
- `POST /api/cron/rt/sync-billing`: (Pendiente) Descarga reportes de facturación.

### Configuración
1. **Base de Datos**: Ejecutar el script `scripts/setup_rentabilidad_module.sql` en Supabase.
2. **Cuentas**: Configurar en el panel `/dashboard/rentabilidad` pestaña "Configuración".
   - Se requiere `seller_id` y `refresh_token` inicial.
3. **Costos**: El sistema intentará leer la tabla `inventory` (campo `cost_without_tax`). Si no existe, usará `rt_products_shadow`.

## Seguridad
- Los tokens de acceso se renuevan automáticamente.
- Los tokens se almacenan en la base de datos (se recomienda encriptación en producción).
- No se exponen tokens al frontend.

## Uso
Acceder a `/dashboard/rentabilidad` para ver el tablero de control.
