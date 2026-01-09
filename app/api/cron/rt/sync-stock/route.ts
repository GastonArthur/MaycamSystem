import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { MLService } from "@/lib/rentabilidad/ml-service"
import { RT_ML_Account } from "@/lib/rentabilidad/types"

export const dynamic = 'force-dynamic' // No caching

export async function POST(req: NextRequest) {
  try {
    // 1. Init DB Client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 })
    }

    // Security Check: Removed by user request (Open API)
    // const authHeader = req.headers.get('authorization')
    // const cronSecret = process.env.CRON_SECRET
    // ... logic removed ...

    const supabase = createClient(supabaseUrl, supabaseKey)

    // 2. Fetch Accounts
    const { data: accounts, error } = await supabase
      .from("rt_ml_accounts")
      .select("*")

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!accounts || accounts.length === 0) {
      return NextResponse.json({ message: "No accounts found" })
    }

    // 3. Sync Stock for each account
    const mlService = new MLService(supabaseUrl, supabaseKey)
    const results = []

    for (const account of accounts) {
      try {
        await mlService.syncStock(account as RT_ML_Account)
        results.push({ account: account.name, status: "success" })
      } catch (err: any) {
        console.error(`Error syncing stock for ${account.name}:`, err)
        results.push({ account: account.name, status: "error", error: err.message })
      }
    }

    return NextResponse.json({ results })
  } catch (err: any) {
    console.error("Critical error in sync-stock:", err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
