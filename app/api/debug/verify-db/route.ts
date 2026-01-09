import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase credentials missing" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const tables = [
      "rt_ml_accounts",
      "rt_ml_orders",
      "rt_ml_order_items",
      "rt_stock_current",
      "rt_ml_sku_map", 
      "rt_sales",
      "rt_sale_items"
    ]

    const status: Record<string, boolean> = {}
    let allOk = true

    for (const table of tables) {
      const { error } = await supabase.from(table).select("count", { count: 'exact', head: true })
      if (error) {
        console.error(`Error checking table ${table}:`, error)
        status[table] = false
        allOk = false
      } else {
        status[table] = true
      }
    }

    return NextResponse.json({ ok: allOk, tables: status })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
