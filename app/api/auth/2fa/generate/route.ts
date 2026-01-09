import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateSecret } from "@/lib/totp"

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

    // Generate Secret
    const secret = generateSecret()
    
    // Get user email for the label
    const { data: user } = await supabase.from("users").select("email").eq("id", session.user_id).single()
    const label = user?.email || "MaycamSystem"
    
    // Create otpauth URL
    const otpauth = `otpauth://totp/Maycam:${label}?secret=${secret}&issuer=Maycam`

    return NextResponse.json({ secret, otpauth })
  } catch (error) {
    console.error("Error generating 2FA:", error)
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
  }
}
