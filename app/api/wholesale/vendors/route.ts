import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase mal configurado" }, { status: 500 })
    }

    const { name, section } = await req.json().catch(() => ({}))
    const trimmedName = typeof name === "string" ? name.trim() : ""
    const trimmedSection = typeof section === "string" ? section.trim() : undefined

    if (!trimmedName) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const insertPayload: Record<string, any> = { name: trimmedName }
    if (trimmedSection) insertPayload.section = trimmedSection

    const { data, error } = await supabase
      .from("wholesale_vendors")
      .insert(insertPayload)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}

export async function GET(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase mal configurado" }, { status: 500 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const section = req.nextUrl.searchParams.get("section")
    const excludeSection = req.nextUrl.searchParams.get("exclude_section")
    
    let query = supabase
      .from("wholesale_vendors")
      .select("*")
      .order("name")
    
    if (section) {
      query = query.eq("section", section)
    }

    if (excludeSection) {
      query = query.or(`section.neq.${excludeSection},section.is.null`)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase mal configurado" }, { status: 500 })
    }

    const { id, name } = await req.json().catch(() => ({}))
    const vendorId = typeof id === "number" ? id : Number(id)
    const trimmedName = typeof name === "string" ? name.trim() : ""

    if (!Number.isFinite(vendorId) || vendorId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    if (!trimmedName) {
      return NextResponse.json({ error: "Nombre requerido" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from("wholesale_vendors")
      .update({ name: trimmedName })
      .eq("id", vendorId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: "Supabase mal configurado" }, { status: 500 })
    }

    const idParam = req.nextUrl.searchParams.get("id")
    const vendorId = idParam ? Number(idParam) : NaN

    if (!Number.isFinite(vendorId) || vendorId <= 0) {
      return NextResponse.json({ error: "ID inválido" }, { status: 400 })
    }

    const supabase = createClient(supabaseUrl, supabaseKey)

    const { data, error } = await supabase
      .from("wholesale_vendors")
      .delete()
      .eq("id", vendorId)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }

    return NextResponse.json({ data })
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error interno" }, { status: 500 })
  }
}
