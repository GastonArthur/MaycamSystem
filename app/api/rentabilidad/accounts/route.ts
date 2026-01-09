import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { name, seller_id, refresh_token } = body

    if (!name || !seller_id || !refresh_token) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    
    if (!supabaseUrl || !supabaseKey) {
        return NextResponse.json({ error: "Server misconfiguration" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    // Check if exists
    const { data: existing } = await supabase
      .from("rt_ml_accounts")
      .select("id")
      .eq("seller_id", seller_id)
      .single()

    if (existing) {
      return NextResponse.json({ error: "Account already exists" }, { status: 409 })
    }

    const { data, error } = await supabase
      .from("rt_ml_accounts")
      .insert({
        name,
        seller_id,
        refresh_token,
        // access_token will be fetched by cron or on demand
      })
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
    // Return accounts list (without sensitive tokens ideally, but for now full obj)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const supabase = createClient(supabaseUrl!, supabaseKey!)

    const { data, error } = await supabase.from("rt_ml_accounts").select("*")
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    
    return NextResponse.json({ data })
}
