"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { toast } from "@/hooks/use-toast"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { getCurrentUser, logActivity } from "@/lib/auth"
import { cn } from "@/lib/utils"
import { Pencil, Trash2, Search, History, Package, Layers } from "lucide-react"

type StockProduct = {
  id: number
  sku: string
  name: string
  brand: string
  quantity: number
  created_at: string
  updated_at: string
  change_count?: number
}

type StockChange = {
  id: number
  product_id: number
  sku: string
  old_quantity: number
  new_quantity: number
  user_email: string
  created_at: string
}

const sanitizeText = (s: string) => s.replace(/\s+/g, " ").trim()

export function StockManagement() {
  const user = getCurrentUser()
  const readOnly = user?.role === "viewer"

  const [form, setForm] = useState({
    name: "",
    sku: "",
    brandMode: "select" as "select" | "new",
    brand: "",
    quantity: "",
  })
  const [brands, setBrands] = useState<string[]>([])
  const [products, setProducts] = useState<StockProduct[]>([])
  const [filtered, setFiltered] = useState<StockProduct[]>([])
  const [search, setSearch] = useState("")
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historySku, setHistorySku] = useState<string | null>(null)
  const [history, setHistory] = useState<StockChange[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const editQtyRef = useRef<HTMLInputElement>(null)
  const [persistStatus, setPersistStatus] = useState<"ok" | "fail" | null>(null)
  const [lastCreatedSku, setLastCreatedSku] = useState<string | null>(null)
  const [lastLog, setLastLog] = useState<any | null>(null)
  const [brandFilter, setBrandFilter] = useState<string>("all")
  const [skuCheckResult, setSkuCheckResult] = useState<{ exists: boolean; product?: StockProduct | null } | null>(null)
  const [showSkuTools, setShowSkuTools] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  useEffect(() => {
    const q = search.toLowerCase()
    setFiltered(
      products.filter((p) => {
        const matchesSearch =
          p.sku.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
        const matchesBrand = brandFilter === "all" ? true : p.brand === brandFilter
        return matchesSearch && matchesBrand
      }),
    )
  }, [products, search, brandFilter])

  const groupedByBrand = useMemo(() => {
    const groups: Record<string, StockProduct[]> = {}
    filtered.forEach((p) => {
      if (!groups[p.brand]) groups[p.brand] = []
      groups[p.brand].push(p)
    })
    return Object.entries(groups).sort((a, b) => a[0].localeCompare(b[0]))
  }, [filtered])

  const diffByProductId = useMemo(() => {
    const bySku: Record<string, StockProduct[]> = {}
    products
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((p) => {
        if (!bySku[p.sku]) bySku[p.sku] = []
        bySku[p.sku].push(p)
      })
    const map: Record<number, number | null> = {}
    Object.values(bySku).forEach((list) => {
      for (let i = 0; i < list.length; i++) {
        const curr = list[i]
        const prev = i > 0 ? list[i - 1] : null
        map[curr.id] = prev ? curr.quantity - prev.quantity : null
      }
    })
    return map
  }, [products])
  async function fetchData() {
    try {
      setLoading(true)
      if (!isSupabaseConfigured) {
        const raw = localStorage.getItem("stock:products")
        const items: StockProduct[] = raw ? JSON.parse(raw) : []
        setProducts(items)
        setBrands(Array.from(new Set(items.map((i) => i.brand))).sort())
        return
      }
      const { data: prods, error: pErr } = await supabase
        .from("stock_products")
        .select("id, sku, name, brand, quantity, created_at, updated_at")
        .order("brand", { ascending: true })
        .order("name", { ascending: true })
      if (pErr) throw pErr
      // Obtener conteos de cambios por SKU desde API (service role)
      let countMap = new Map<string, number>()
      try {
        const res = await fetch("/api/stock", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ action: "getChangeCounts" }),
        })
        const json = await res.json()
        if (res.ok && json?.ok && json?.counts) {
          countMap = new Map<string, number>(Object.entries(json.counts))
        }
      } catch (e) {
        // Ignorar error de conteo para no bloquear carga principal
      }
      const enriched = (prods || []).map((p) => ({
        ...p,
        change_count: countMap.get(p.sku) || 0,
      }))
      setProducts(enriched)
      const { data: brandRows } = await supabase
        .from("stock_brands")
        .select("name")
        .order("name", { ascending: true })
      setBrands((brandRows || []).map((b: any) => b.name))
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: "No se pudo cargar Stock",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  function autocompleteNameFromSku(sku: string) {
    const exists = products.find((p) => p.sku.toLowerCase() === sku.toLowerCase())
    if (exists) {
      setForm((prev) => ({ ...prev, name: exists.name }))
    }
  }

  async function saveProduct() {
    if (readOnly) return
    const name = sanitizeText(form.name)
    const sku = sanitizeText(form.sku).toUpperCase()
    const brandValue =
      form.brandMode === "select" ? sanitizeText(form.brand) : sanitizeText(form.brand)
    const qtyNum = Number(form.quantity)

    if (!name || !sku || !brandValue || !Number.isFinite(qtyNum) || qtyNum < 0) {
      toast({
        title: "Validación",
        description: "Completa todos los campos correctamente",
        variant: "destructive",
      })
      return
    }
    if (products.some((p) => p.sku.toUpperCase() === sku)) {
      toast({
        title: "SKU existente",
        description: "El SKU ya existe. Usa edición o cambia el SKU.",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)
      const now = new Date().toISOString()
      let newId = Math.floor(Math.random() * 1e9)

      if (!isSupabaseConfigured) {
        const newItem: StockProduct = {
          id: newId,
          sku,
          name,
          brand: brandValue,
          quantity: qtyNum,
          created_at: now,
          updated_at: now,
          change_count: 1,
        }
        const next = [...products, newItem]
        localStorage.setItem("stock:products", JSON.stringify(next))
        setProducts(next)
        localStorage.setItem(
          `stock:changes:${sku}`,
          JSON.stringify([
            {
              id: Math.floor(Math.random() * 1e9),
              product_id: newId,
              sku,
              old_quantity: 0,
              new_quantity: qtyNum,
              user_email: user?.email || "usuario",
              created_at: now,
            },
          ])
        )
        toast({ title: "Guardado", description: "Producto creado" })
        setForm({ name: "", sku: "", brandMode: "select", brand: "", quantity: "" })
        return
      }

      // Crear producto y asegurar marca vía API con service role
      const resp = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "createProduct",
          payload: { sku, name, brand: brandValue, quantity: qtyNum },
        }),
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error creando producto")
      }
      newId = json.id
      // Actualizar lista de marcas local si era nueva
      if (!brands.includes(brandValue)) {
        setBrands((prev) => [...prev, brandValue].sort())
      }

      const logObj = {
        user_id: user?.id,
        user_email: user?.email,
        user_name: user?.name,
        action: "CREATE_STOCK_PRODUCT",
        table_name: "stock_products",
        record_id: newId,
        old_data: null,
        new_data: JSON.stringify({ sku, name, brand: brandValue, quantity: qtyNum }),
        description: "Creación de producto en Stock",
      }
      setLastLog(logObj)
      await logActivity("CREATE_STOCK_PRODUCT", "stock_products", newId, null, { sku, name, brand: brandValue, quantity: qtyNum }, "Creación de producto en Stock")

      setLastCreatedSku(sku)
      const verifyRes = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ action: "verifyProduct", payload: { sku } }),
      })
      const verifyJson = await verifyRes.json()
      if (verifyRes.ok && verifyJson?.ok && verifyJson?.exists) {
        setPersistStatus("ok")
        const nowItem: StockProduct = {
          id: newId,
          sku,
          name,
          brand: brandValue,
          quantity: qtyNum,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }
        setProducts((prev) => [...prev, nowItem])
        toast({ title: "Guardado", description: "Producto creado y verificado" })
      } else {
        setPersistStatus("fail")
        toast({
          title: "Error de verificación",
          description: "El producto no fue verificado en la base de datos",
          variant: "destructive",
        })
      }
      setForm({ name: "", sku: "", brandMode: "select", brand: "", quantity: "" })
      setSearch("")
      setBrandFilter("all")
      fetchData()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: "No se pudo guardar el producto. Verifique su conexión o permisos.",
        variant: "destructive",
      })
      setPersistStatus("fail")
    } finally {
      setSaving(false)
    }
  }

  async function updateQuantity(product: StockProduct, newQty: number) {
    if (readOnly) return
    if (!Number.isFinite(newQty) || newQty < 0) return
    const oldQty = Number(product.quantity)
    if (oldQty === newQty) return
    try {
      // Update product
      if (!isSupabaseConfigured) {
        const now = new Date().toISOString()
        const next = products.map((p) => (p.id === product.id ? { ...p, quantity: newQty, updated_at: now, change_count: (p.change_count || 0) + 1 } : p))
        localStorage.setItem("stock:products", JSON.stringify(next))
        setProducts(next)
        const raw = localStorage.getItem(`stock:changes:${product.sku}`)
        const list: StockChange[] = raw ? JSON.parse(raw) : []
        list.push({
          id: Math.floor(Math.random() * 1e9),
          product_id: product.id,
          sku: product.sku,
          old_quantity: oldQty,
          new_quantity: newQty,
          user_email: user?.email || "usuario",
          created_at: new Date().toISOString(),
        })
        localStorage.setItem(`stock:changes:${product.sku}`, JSON.stringify(list))
        toast({ title: "Actualizado", description: "Stock modificado" })
        return
      }

      const resp = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "updateQuantity",
          payload: {
            product_id: product.id,
            sku: product.sku,
            old_quantity: oldQty,
            new_quantity: newQty,
          },
        }),
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error actualizando stock")
      }
      await logActivity("UPDATE_STOCK_QTY", "stock_products", product.id, { quantity: oldQty }, { quantity: newQty }, "Actualización de stock")
      toast({ title: "Actualizado", description: "Stock modificado" })
      fetchData()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: "No se pudo modificar el stock",
        variant: "destructive",
      })
    }
  }

  async function deleteProduct(product: StockProduct) {
    if (readOnly) return
    const ok = window.confirm(`¿Eliminar producto ${product.sku}?`)
    if (!ok) return
    try {
      if (!isSupabaseConfigured) {
        const next = products.filter((p) => p.id !== product.id)
        localStorage.setItem("stock:products", JSON.stringify(next))
        setProducts(next)
        toast({ title: "Eliminado", description: "Producto eliminado" })
        return
      }
      const resp = await fetch("/api/stock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          action: "deleteProduct",
          payload: { product_id: product.id },
        }),
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error eliminando")
      }
      await logActivity("DELETE_STOCK_PRODUCT", "stock_products", product.id, product, null, "Eliminación de producto en Stock")
      toast({ title: "Eliminado", description: "Producto eliminado" })
      fetchData()
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: "No se pudo eliminar",
        variant: "destructive",
      })
    }
  }

  async function openHistory(sku: string, productId: number) {
    setHistoryOpen(true)
    setHistorySku(sku)
    try {
      if (!isSupabaseConfigured) {
        const raw = localStorage.getItem(`stock:changes:${sku}`)
        const list: StockChange[] = raw ? JSON.parse(raw) : []
        setHistory(list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()))
        return
      }
      const { data, error } = await supabase
        .from("stock_changes")
        .select("*")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
      if (error) throw error
      setHistory((data || []) as StockChange[])
    } catch (err) {
      console.error(err)
      toast({
        title: "Error",
        description: "No se pudo cargar el historial",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Layers className="w-5 h-5" />
            Stock
          </CardTitle>
          <CardDescription>Base de datos independiente</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-5 gap-4">
            <div className="md:col-span-2">
              <Label>Nombre</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={readOnly}
                placeholder="Nombre del producto"
              />
            </div>
            <div>
              <Label>SKU</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                <Input
                  value={form.sku}
                  onChange={(e) => {
                    const v = e.target.value
                    setForm((f) => ({ ...f, sku: v }))
                    autocompleteNameFromSku(v)
                  }}
                  disabled={readOnly}
                  className="pl-8"
                  placeholder="SKU único"
                />
              </div>
            </div>
            <div>
              <Label>Marca</Label>
              {form.brandMode === "select" ? (
                <Select
                  value={form.brand}
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setForm((f) => ({ ...f, brandMode: "new", brand: "" }))
                    } else {
                      setForm((f) => ({ ...f, brand: val }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b} value={b}>
                        {b}
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ Nueva marca…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={form.brand}
                    onChange={(e) => setForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="Escribir marca"
                    disabled={readOnly}
                  />
                  <Button
                    variant="outline"
                    onClick={() => setForm((f) => ({ ...f, brandMode: "select", brand: "" }))}
                  >
                    Usar lista
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Cantidad de stock</Label>
              <Input
                type="number"
                value={form.quantity}
                onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                disabled={readOnly}
                placeholder="0"
              />
            </div>
          </div>
          <div className="mt-4 flex items-center gap-3">
            <Button onClick={saveProduct} disabled={saving || readOnly} className="bg-emerald-600 hover:bg-emerald-700">
              Guardar
            </Button>
            {lastCreatedSku && (
              <Badge variant={persistStatus === "ok" ? "default" : "destructive"}>
                {persistStatus === "ok" ? "Persistencia BD: OK" : "Persistencia BD: ERROR"}
              </Badge>
            )}
          </div>
          
        </CardContent>
      </Card>

      <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm">
        <CardHeader>
          <div className="bg-white p-3 rounded-lg border flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-9 text-sm"
                placeholder="Buscar por nombre, SKU o marca"
              />
            </div>
            <Select value={brandFilter} onValueChange={(val) => setBrandFilter(val)}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder="Marca" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las marcas</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b} value={b}>
                    {b}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {filtered.length} items
            </Badge>
            
          </div>
        </CardHeader>
        <CardContent>
          {groupedByBrand.map(([brand, items]) => (
            <div key={brand} className="mb-6">
              <div className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 px-3 py-2 rounded border border-blue-100 text-slate-700 font-semibold">
                {brand || "Sin marca"}
              </div>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha creación</TableHead>
                    <TableHead>Nombre</TableHead>
                    <TableHead>SKU</TableHead>
                    <TableHead>Marca</TableHead>
                    <TableHead>Stock</TableHead>
                    <TableHead>Diferencia</TableHead>
                    <TableHead>Última modificación</TableHead>
                    <TableHead className="text-right">Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((p) => (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{new Date(p.created_at).toLocaleString()}</TableCell>
                      <TableCell className="font-medium">{p.name}</TableCell>
                      <TableCell className="font-mono text-xs">
                        <button
                          className="inline-flex items-center gap-2 text-blue-700 hover:underline"
                          onClick={() => openHistory(p.sku, p.id)}
                        >
                          {p.sku}
                          {p.change_count && p.change_count > 0 && (
                            <Badge variant="outline" className="text-blue-700 border-blue-200 bg-blue-50">
                              {p.change_count}
                            </Badge>
                          )}
                          <History className="w-4 h-4" />
                        </button>
                      </TableCell>
                      <TableCell className="text-xs">
                        {diffByProductId[p.id] != null ? (
                          <span className={diffByProductId[p.id]! >= 0 ? "text-green-600" : "text-red-600"}>
                            {diffByProductId[p.id]! >= 0 ? "+" : ""}
                            {diffByProductId[p.id]}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>{p.brand}</TableCell>
                      <TableCell>
                        {editingId === p.id ? (
                          <div className="flex items-center gap-2">
                            <Input
                              ref={editQtyRef}
                              type="number"
                              defaultValue={p.quantity}
                              className="h-8 w-24"
                            />
                            <Button
                              size="sm"
                              onClick={() => {
                                const v = Number(editQtyRef.current?.value || p.quantity)
                                setEditingId(null)
                                updateQuantity(p, v)
                              }}
                            >
                              Guardar
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                              Cancelar
                            </Button>
                          </div>
                        ) : (
                          <span className="font-bold">{p.quantity}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{new Date(p.updated_at || p.created_at).toLocaleString()}</TableCell>
                      <TableCell className="text-right">
                        {!readOnly && (
                          <div className="flex justify-end gap-2">
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => setEditingId(p.id)}
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="icon"
                              onClick={() => deleteProduct(p)}
                              title="Eliminar"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ))}
        </CardContent>
      </Card>

      

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Historial de {historySku}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha/Hora</TableHead>
                  <TableHead>Usuario</TableHead>
                  <TableHead>Anterior</TableHead>
                  <TableHead>Nuevo</TableHead>
                  <TableHead>Diferencia</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {history.map((h) => (
                  <TableRow key={h.id}>
                    <TableCell className="text-xs">{new Date(h.created_at).toLocaleString()}</TableCell>
                    <TableCell className="text-xs">{h.user_email}</TableCell>
                    <TableCell className="text-xs">{h.old_quantity}</TableCell>
                    <TableCell className="text-xs">{h.new_quantity}</TableCell>
                    <TableCell className={cn("text-xs", h.new_quantity - h.old_quantity >= 0 ? "text-emerald-700" : "text-red-700")}>
                      {h.new_quantity - h.old_quantity}
                    </TableCell>
                  </TableRow>
                ))}
                {history.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                      No hay cambios registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
