import { NextResponse } from "next/server";
import { MLService } from "@/lib/rentabilidad/ml-service";

export async function POST(req: Request) {
  // MercadoLibre manda distintos formatos (orders, items, questions).
  // Es CRÍTICO responder 200 OK rápidamente para evitar que ML reintente o deshabilite la notificación.
  
  try {
    const body = await req.json();
    console.log("ML Notification received:", JSON.stringify(body));
    
    const { topic, resource, user_id } = body;

    if (topic === 'orders_v2') {
        // resource example: "/orders/7654321"
        const orderId = resource.split('/').pop();
        
        if (orderId && user_id) {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
            const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
            
            if (supabaseUrl && supabaseKey) {
                console.log(`[Webhook] Processing order ${orderId} for user ${user_id}`);
                const mlService = new MLService(supabaseUrl, supabaseKey);
                // We await here because fetching a single order is fast enough (< 2s)
                // and we want to ensure it's saved before the lambda dies.
                await mlService.syncOrderById(user_id, orderId);
            } else {
                console.error("[Webhook] Missing Supabase credentials");
            }
        }
    } else {
        console.log(`[Webhook] Ignored topic: ${topic}`);
    }
    
  } catch (error) {
    console.error("Error processing ML notification body:", error);
    // Aun así respondemos 200 para no romper el webhook
  }

  return NextResponse.json({ ok: true });
}

export async function GET() {
  // ML a veces verifica la URL con un GET
  return NextResponse.json({ ok: true, status: "active" });
}
