import { NextResponse } from "next/server";

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  // 1. Manejo de Errores devueltos por MercadoLibre
  if (error) {
    return NextResponse.json({ 
      ok: false, 
      error, 
      description: "Error devuelto por MercadoLibre durante la autorización." 
    }, { status: 400 });
  }

  const clientId = process.env.ML_CLIENT_ID;
  const clientSecret = process.env.ML_CLIENT_SECRET;
  // Asegúrate de que esta URL coincida EXACTAMENTE con la configurada en tu aplicación de MercadoLibre
  const redirectUri = "https://sistemamaycam2026.vercel.app/api/ml/callback";

  // 2. Si NO hay código, iniciamos el flujo redirigiendo al usuario a MercadoLibre
  if (!code) {
    if (!clientId) {
      return NextResponse.json({ 
        ok: false, 
        error: "Configuración incompleta", 
        message: "Falta la variable de entorno ML_CLIENT_ID en el servidor." 
      }, { status: 500 });
    }

    // Construir URL de autorización para Argentina (.com.ar)
    // Si tu cuenta es de otro país, cambia el dominio (ej: auth.mercadolibre.com.mx, .com.br, etc.)
    const authUrl = `https://auth.mercadolibre.com.ar/authorization?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    
    // Redirigir al usuario para que inicie sesión y autorice
    return NextResponse.redirect(authUrl);
  }

  // 3. Si HAY código, intentamos canjearlo por el Access Token automáticamente
  try {
    if (!clientId || !clientSecret) {
       return NextResponse.json({ 
         ok: false, 
         message: "Código recibido exitosamente, pero faltan ML_CLIENT_ID o ML_CLIENT_SECRET para obtener el token final.", 
         code 
       });
    }

    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);
    params.append('code', code);
    params.append('redirect_uri', redirectUri);

    const tokenRes = await fetch("https://api.mercadolibre.com/oauth/token", {
      method: "POST",
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded", 
        "Accept": "application/json" 
      },
      body: params
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok) {
      return NextResponse.json({ 
        ok: false, 
        error: "Error al canjear el código por token", 
        details: tokenData 
      }, { status: 400 });
    }

    // 4. Token obtenido con éxito
    // Aquí mostramos los datos (Access Token, Refresh Token, User ID)
    // para que puedas copiarlos a tu configuración o base de datos.
    
    return NextResponse.json({
      ok: true,
      message: "¡Conexión exitosa! Copia estos datos (especialmente el refresh_token) para configurar tu cuenta.",
      data: {
        user_id: tokenData.user_id,
        refresh_token: tokenData.refresh_token,
        access_token: tokenData.access_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        token_type: tokenData.token_type
      }
    });

  } catch (err: any) {
    return NextResponse.json({ ok: false, error: err.message }, { status: 500 });
  }
}
