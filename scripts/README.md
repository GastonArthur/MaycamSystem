# Gestión de Base de Datos (SQL)

Este directorio contiene los scripts SQL para gestionar la base de datos de Supabase.

## 1. Archivo Maestro (`MASTER_DB_SETUP.sql`)
Este es el archivo **"Fuente de Verdad"**. Contiene la definición COMPLETA de la base de datos tal como debería estar hoy.
- **Uso:** Úsalo para inicializar una nueva base de datos desde cero (ej. entorno local o nuevo proyecto).
- **En Producción:** Puedes ejecutarlo en el SQL Editor de Supabase. Está diseñado con `IF NOT EXISTS`, por lo que **no borrará datos** y solo agregará tablas o columnas que falten.

## 2. Migraciones (`migrations/`)
Aquí se deben guardar los scripts de los cambios futuros.
- **Flujo de trabajo:**
    1. Si necesitas cambiar algo (ej. agregar una tabla), crea un archivo aquí: `YYYYMMDD_descripcion.sql`.
    2. Ejecuta ese archivo pequeño en Supabase.
    3. Una vez probado, **actualiza** el `MASTER_DB_SETUP.sql` para que refleje el nuevo estado.

## ¿Por qué en Git?
Es CRÍTICO que estos archivos estén en Git. El esquema de la base de datos es código. Si algo se rompe o se borra accidentalmente en Supabase, estos archivos son tu única copia de seguridad de la **estructura** (no de los datos, pero sí del diseño).
