import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { verifyToken } from "@/lib/totp"

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

    const { secret, code, method } = await req.json()

    if (!code) {
      return NextResponse.json({ error: "Código requerido" }, { status: 400 })
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

    if (method === 'sms') {
        // Verify SMS Code
        const { data: user } = await supabase
            .from("users")
            .select("two_factor_code, two_factor_expires")
            .eq("id", session.user_id)
            .single()

        if (!user || !user.two_factor_code || !user.two_factor_expires) {
            return NextResponse.json({ error: "Código no solicitado" }, { status: 400 })
        }

        if (new Date() > new Date(user.two_factor_expires)) {
            return NextResponse.json({ error: "Código expirado" }, { status: 400 })
        }

        if (user.two_factor_code !== code) {
            return NextResponse.json({ error: "Código incorrecto" }, { status: 400 })
        }

        // Enable SMS 2FA
        const { error: updateError } = await supabase
            .from("users")
            .update({
                two_factor_enabled: true,
                two_factor_method: 'sms',
                two_factor_code: null, // Clear code
                two_factor_expires: null
            })
            .eq("id", session.user_id)

        if (updateError) throw updateError

    } else {
        // Default: App (TOTP)
        if (!secret) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 })
        }

        const isValid = verifyToken(code, secret)

        if (!isValid) {
            return NextResponse.json({ error: "Invalid code" }, { status: 400 })
        }

        // Enable App 2FA
        const { error: updateError } = await supabase
            .from("users")
            .update({
                two_factor_enabled: true,
                two_factor_secret: secret,
                two_factor_method: 'app'
            })
            .eq("id", session.user_id)

        if (updateError) throw updateError
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error enabling 2FA:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
