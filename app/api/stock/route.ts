import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"

type Action =
  | "createBrand"
  | "createProduct"
  | "updateQuantity"
  | "deleteProduct"
  | "getChangeCounts"
  | "verifyProduct"
  | "updateCreatedAt"
  | "updateProduct"
  | "listAll"
  | "deleteBrand"

export async function POST(req: NextRequest) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseKey = process.env.SUPABASE_SERVICE_KEY
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase config missing:", { url: !!supabaseUrl, key: !!supabaseKey })
      return NextResponse.json({ error: "Supabase no está configurado" }, { status: 500 })
    }
    const supabase = createClient(supabaseUrl, supabaseKey)

    // 1. Extraer token de sesión (Authorization header o cookie)
    const authHeader = req.headers.get("Authorization")
    const tokenFromHeader = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : null
    const tokenFromCookie = req.cookies.get("session_token")?.value
    const sessionToken = tokenFromHeader || tokenFromCookie

    if (!sessionToken) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 })
    }

    // 2. Validar sesión
    const { data: session, error: sessionError } = await supabase
      .from("user_sessions")
      .select(
        `
        user_id,
        expires_at,
        users!inner ( id, email, name, is_active )
      `
      )
      .eq("session_token", sessionToken)
      .maybeSingle()

    if (sessionError || !session || !session.users?.is_active) {
      return NextResponse.json({ error: "Sesión inválida" }, { status: 401 })
    }
    const expiresAt = new Date(session.expires_at)
    if (expiresAt.getTime() < Date.now()) {
      return NextResponse.json({ error: "Sesión expirada" }, { status: 401 })
    }
    const user = session.users
    const userId = user.id

    const body = await req.json()
    const { action, payload }: { action: Action; payload: any } = body

    if (!action) {
      return NextResponse.json({ error: "Acción requerida" }, { status: 400 })
    }

    if (action === "createBrand") {
      const name: string = (body?.payload?.name || "").toString().trim()
      if (!name) {
        return NextResponse.json({ error: "Nombre de marca requerido" }, { status: 400 })
      }
      const { data: existing } = await supabase.from("stock_brands").select("name").eq("name", name).maybeSingle()
      if (!existing) {
        const { error: insErr } = await supabase.from("stock_brands").insert({ name })
        if (insErr) return NextResponse.json({ error: insErr.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "createProduct") {
      const { sku, name, brand, quantity } = body?.payload || {}
      const skuV = String(sku || "").toUpperCase().trim()
      const nameV = String(name || "").trim()
      const brandV = String(brand || "").trim()
      const qtyV = Number(quantity)
      if (!skuV || !nameV || !brandV || !Number.isFinite(qtyV) || qtyV < 0) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
      }
      // Ensure brand
      const { data: existingBrand } = await supabase.from("stock_brands").select("name").eq("name", brandV).maybeSingle()
      if (!existingBrand) {
        const { error: bErr } = await supabase.from("stock_brands").insert({ name: brandV })
        if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 })
      }
      const { data: inserted, error: insErr } = await supabase
        .from("stock_products")
        .insert([{ sku: skuV, name: nameV, brand: brandV, quantity: qtyV }])
        .select("id")
        .single()
      if (insErr || !inserted) {
        return NextResponse.json({ error: insErr?.message || "Error insertando producto" }, { status: 400 })
      }
      const { error: chErr } = await supabase.from("stock_changes").insert([
        {
          product_id: inserted.id,
          sku: skuV,
          old_quantity: 0,
          new_quantity: qtyV,
          user_email: session.users.email || "usuario",
        },
      ])
      if (chErr) {
        await supabase.from("stock_products").delete().eq("id", inserted.id)
        return NextResponse.json({ error: chErr.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, id: inserted.id })
    }

    if (action === "updateQuantity") {
      const { product_id, sku, old_quantity, new_quantity } = body?.payload || {}
      const pid = Number(product_id)
      const oldQ = Number(old_quantity)
      const newQ = Number(new_quantity)
      if (!Number.isFinite(pid) || !Number.isFinite(oldQ) || !Number.isFinite(newQ) || newQ < 0) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
      }
      const { error: updErr } = await supabase.from("stock_products").update({ quantity: newQ }).eq("id", pid)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
      const { error: chErr } = await supabase.from("stock_changes").insert([
        {
          product_id: pid,
          sku: String(sku || "").toUpperCase(),
          old_quantity: oldQ,
          new_quantity: newQ,
          user_email: session.users.email || "usuario",
        },
      ])
      if (chErr) {
        await supabase.from("stock_products").update({ quantity: oldQ }).eq("id", pid)
        return NextResponse.json({ error: chErr.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "deleteProduct") {
      const { product_id } = body?.payload || {}
      const pid = Number(product_id)
      if (!Number.isFinite(pid)) {
        return NextResponse.json({ error: "ID inválido" }, { status: 400 })
      }
      await supabase.from("stock_changes").delete().eq("product_id", pid)
      const { error: delErr } = await supabase.from("stock_products").delete().eq("id", pid)
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "getChangeCounts") {
      const { data, error } = await supabase.from("stock_changes").select("sku")
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      const counts: Record<string, number> = {}
      for (const row of data || []) {
        const k = String((row as any).sku)
        counts[k] = (counts[k] || 0) + 1
      }
      return NextResponse.json({ ok: true, counts })
    }

    if (action === "verifyProduct") {
      const sku: string = (body?.payload?.sku || "").toString().trim().toUpperCase()
      if (!sku) {
        return NextResponse.json({ error: "SKU requerido" }, { status: 400 })
      }
      const { data, error } = await supabase
        .from("stock_products")
        .select("id, sku, name, brand, quantity, created_at, updated_at")
        .eq("sku", sku)
        .maybeSingle()
      if (error) {
        return NextResponse.json({ error: error.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true, exists: !!data, product: data || null })
    }

    if (action === "updateCreatedAt") {
      const { product_id, created_at } = body?.payload || {}
      const pid = Number(product_id)
      const dt = String(created_at || "")
      if (!Number.isFinite(pid) || !dt) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
      }
      const parsed = new Date(dt)
      if (isNaN(parsed.getTime())) {
        return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
      }
      const { error: updErr } = await supabase.from("stock_products").update({ created_at: dt }).eq("id", pid)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "updateProduct") {
      const { product_id, sku, name, brand, quantity, created_at } = body?.payload || {}
      const pid = Number(product_id)
      const skuV = String(sku || "").toUpperCase().trim()
      const nameV = String(name || "").trim()
      const brandV = String(brand || "").trim()
      const qtyNum = Number(quantity)
      const dt = created_at ? String(created_at) : null
      if (!Number.isFinite(pid) || !skuV || !nameV || !brandV || !Number.isFinite(qtyNum) || qtyNum < 0) {
        return NextResponse.json({ error: "Datos inválidos" }, { status: 400 })
      }
      if (dt) {
        const parsed = new Date(dt)
        if (isNaN(parsed.getTime())) {
          return NextResponse.json({ error: "Fecha inválida" }, { status: 400 })
        }
      }
      const { data: existing } = await supabase.from("stock_products").select("*").eq("id", pid).maybeSingle()
      if (!existing) {
        return NextResponse.json({ error: "Producto no encontrado" }, { status: 404 })
      }
      const { data: existingBrand } = await supabase.from("stock_brands").select("name").eq("name", brandV).maybeSingle()
      if (!existingBrand) {
        const { error: bErr } = await supabase.from("stock_brands").insert({ name: brandV })
        if (bErr) return NextResponse.json({ error: bErr.message }, { status: 400 })
      }
      const updateData: any = { sku: skuV, name: nameV, brand: brandV, quantity: qtyNum }
      if (dt) updateData.created_at = dt
      const { error: updErr } = await supabase.from("stock_products").update(updateData).eq("id", pid)
      if (updErr) {
        return NextResponse.json({ error: updErr.message }, { status: 400 })
      }
      if (Number(existing.quantity) !== qtyNum) {
        await supabase.from("stock_changes").insert([
          {
            product_id: pid,
            sku: skuV,
            old_quantity: Number(existing.quantity),
            new_quantity: qtyNum,
            user_email: session.users.email || "usuario",
          },
        ])
      }
      return NextResponse.json({ ok: true })
    }

    if (action === "listAll") {
      const { data: prods, error: pErr } = await supabase
        .from("stock_products")
        .select("id, sku, name, brand, quantity, created_at, updated_at")
        .order("created_at", { ascending: false })
      if (pErr) {
        return NextResponse.json({ error: pErr.message }, { status: 400 })
      }
      const { data: brandRows, error: bErr } = await supabase
        .from("stock_brands")
        .select("name")
        .order("name", { ascending: true })
      if (bErr) {
        return NextResponse.json({ error: bErr.message }, { status: 400 })
      }
      return NextResponse.json({
        ok: true,
        products: prods || [],
        brands: (brandRows || []).map((b: any) => b.name),
      })
    }

    if (action === "deleteBrand") {
      const name: string = (body?.payload?.name || "").toString().trim()
      if (!name) {
        return NextResponse.json({ error: "Nombre de marca requerido" }, { status: 400 })
      }
      const { count, error: cErr } = await supabase
        .from("stock_products")
        .select("id", { count: "exact", head: true })
        .eq("brand", name)
      if (cErr) {
        return NextResponse.json({ error: cErr.message }, { status: 400 })
      }
      if ((count || 0) > 0) {
        const placeholder = "Sin marca"
        const { data: existingPlaceholder } = await supabase
          .from("stock_brands")
          .select("name")
          .eq("name", placeholder)
          .maybeSingle()
        if (!existingPlaceholder) {
          const { error: insErr } = await supabase.from("stock_brands").insert({ name: placeholder })
          if (insErr) {
            return NextResponse.json({ error: insErr.message }, { status: 400 })
          }
        }
        const { error: updErr } = await supabase
          .from("stock_products")
          .update({ brand: placeholder })
          .eq("brand", name)
        if (updErr) {
          return NextResponse.json({ error: updErr.message }, { status: 400 })
        }
      }
      const { error: delErr } = await supabase.from("stock_brands").delete().eq("name", name)
      if (delErr) {
        return NextResponse.json({ error: delErr.message }, { status: 400 })
      }
      const { data: brandRows } = await supabase
        .from("stock_brands")
        .select("name")
        .order("name", { ascending: true })
      return NextResponse.json({ ok: true, brands: (brandRows || []).map((b: any) => b.name) })
    }

    return NextResponse.json({ error: "Acción no soportada" }, { status: 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error interno" }, { status: 500 })
  }
}
