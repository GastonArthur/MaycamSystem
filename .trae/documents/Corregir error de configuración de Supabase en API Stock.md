El error **"Supabase no está configurado"** se debe a que este archivo específico (`app/api/stock/route.ts`) está exigiendo una clave especial llamada `SUPABASE_SERVICE_KEY` que probablemente no está definida en tu entorno de despliegue (Vercel), a diferencia del resto de tu sistema que usa la clave pública (`NEXT_PUBLIC_SUPABASE_ANON_KEY`).

He verificado tu script SQL (`MASTER_DB_SETUP.sql`) y las tablas `stock_products` y `user_sessions` **están correctamente definidas**, por lo que no falta ningún SQL. El problema es puramente de conexión en este punto.

### Plan de Solución
1.  **Modificar `app/api/stock/route.ts`**:
    *   Cambiar la validación estricta para que intente usar `SUPABASE_SERVICE_KEY`.
    *   Si no la encuentra, permitir que use `NEXT_PUBLIC_SUPABASE_ANON_KEY` (la misma que usa el resto de tu sistema y que confirmaste que funciona).
    *   Esto eliminará el error 500 y permitirá que la carga de stock funcione.

¿Estás de acuerdo con realizar este cambio?