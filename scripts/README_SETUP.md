# Configuración de Base de Datos - Sistema 2026

Para configurar la base de datos completa en Supabase, sigue estos pasos:

1.  Accede a tu panel de control de [Supabase](https://supabase.com/dashboard).
2.  Ve a la sección **SQL Editor** (icono de terminal en la barra lateral izquierda).
3.  Crea una nueva consulta (New Query).
4.  Copia todo el contenido del archivo `MASTER_DB_SETUP.sql` ubicado en esta carpeta.
5.  Pega el contenido en el editor de Supabase.
6.  Haz clic en **Run** (Ejecutar).

## ¿Qué hace este script?

Este script "todo en uno" realiza las siguientes acciones:

*   **Extensiones:** Habilita extensiones necesarias como `uuid-ossp`.
*   **Usuarios:** Crea la tabla de usuarios personalizada y las sesiones.
*   **Inventario:** Configura tablas para productos, proveedores y marcas.
*   **Gastos:** Crea el módulo completo de gestión de gastos y categorías.
*   **Mayoristas:** Configura clientes mayoristas, pedidos y precios escalonados (incluyendo la corrección del campo 'city').
*   **Configuración:** Establece los porcentajes de IVA y márgenes por defecto.
*   **Datos Iniciales:**
    *   Crea un usuario administrador por defecto.
    *   **Email:** `maycamadmin@maycam.com`
    *   **Contraseña:** `maycamadmin2025!`

## Solución de Problemas

Si encuentras errores al ejecutar el script:
*   Si dice que una tabla "ya existe", no te preocupes, el script usa `IF NOT EXISTS` para evitar borrar datos existentes.
*   Si necesitas reiniciar todo desde cero (¡CUIDADO! esto borra datos), deberás ejecutar comandos `DROP TABLE ... CASCADE` manualmente antes de correr este script.
