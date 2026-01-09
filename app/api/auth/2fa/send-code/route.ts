import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logActivity } from "@/lib/auth"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Configuration error" }, { status: 500 })
    }

    const sessionToken = req.cookies.get("session_token")?.value
    if (!sessionToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { phone, method } = await req.json()

    if (!phone && method === 'sms') {
      return NextResponse.json({ error: "Número de teléfono requerido" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Validate session
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select("user_id")
      .eq("session_token", sessionToken)
      .single()

    if (sessionError || !session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Generate Code
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    const expires = new Date()
    expires.setMinutes(expires.getMinutes() + 10)

    // Update User with Code and Phone
    const { error: updateError } = await supabase
      .from("users")
      .update({
        phone: phone,
        two_factor_code: code,
        two_factor_expires: expires.toISOString(),
        // Don't set method yet, only on enable
      })
      .eq("id", session.user_id)

    if (updateError) throw updateError

    // Mock Send SMS
    console.log(`📱 [2FA SETUP] Sending SMS code to ${phone}: ${code}`)
    
    // Log for debugging/demo
    await supabase.from("activity_logs").insert([{
        user_id: session.user_id,
        action: "2FA_SETUP_CODE",
        description: `Código de verificación enviado a ${phone}: ${code}`,
        created_at: new Date().toISOString()
    }])

    return NextResponse.json({ success: true, message: "Código enviado" })
  } catch (error) {
    console.error("Error sending 2FA code:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
