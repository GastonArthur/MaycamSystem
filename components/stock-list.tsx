"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { getSessionToken } from "@/lib/auth"
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Package,
  Search,
  Pencil,
  Trash2,
  Plus,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getCurrentUser, logActivity } from "@/lib/auth"
import { isSupabaseConfigured } from "@/lib/config" // Import the isSupabaseConfigured variable

type StockItem = {
  id: number
  sku: string
  name: string
  brand: string
  quantity: number
  created_at: string
  updated_at: string
}

export function StockList() {
  const user = getCurrentUser()
  const readOnly = user?.role === "viewer"

  const [items, setItems] = useState<StockItem[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingDateId, setEditingDateId] = useState<number | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [editItem, setEditItem] = useState<StockItem | null>(null)
  const [editForm, setEditForm] = useState({
    name: "",
    sku: "",
    brandMode: "select" as "select" | "new",
    brand: "",
    quantity: "",
    created_at: "",
  })

  const [filters, setFilters] = useState({
    search: "",
    brand: "all",
    sortBy: "date_desc",
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, itemsPerPage])

  const [form, setForm] = useState({
    name: "",
    sku: "",
    brandMode: "select" as "select" | "new",
    brand: "",
    quantity: "",
  })
  const [brandDialogOpen, setBrandDialogOpen] = useState(false)
  const qtyRef = useRef<HTMLInputElement>(null)
  const editQtyRef = useRef<HTMLInputElement>(null)
  const editDateRef = useRef<HTMLInputElement>(null)

  // Helper interno para llamadas a /api/stock con token
  const fetchStock = async (body: any) => {
    const token = getSessionToken()
    return fetch("/api/stock", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      credentials: "include",
      body: JSON.stringify(body),
    })
  }
  async function deleteBrandByName(b: string) {
    if (readOnly) return
    const ok = window.confirm(`¿Eliminar marca "${b}"?`)
    if (!ok) return
    try {
      const resp = await fetchStock({ action: "deleteBrand", payload: { name: b } })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error eliminando marca")
      }
      if (Array.isArray(json?.brands)) {
        setBrands(json.brands)
      } else {
        setBrands((prev) => prev.filter((x) => x !== b))
      }
      if (form.brand === b) setForm((f) => ({ ...f, brand: "" }))
      if (editForm.brand === b) setEditForm((f) => ({ ...f, brand: "" }))
      toast({ title: "Eliminado", description: "Marca eliminada" })
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo eliminar la marca", variant: "destructive" })
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      setLoading(true)
      const token = getSessionToken()
      const resp = await fetchStock({ action: "listAll" })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error cargando Stock")
      }
      setItems(json.products || [])
      setBrands(json.brands || [])
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo cargar Stock", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const diffById = useMemo(() => {
    const bySku: Record<string, StockItem[]> = {}
    items
      .slice()
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      .forEach((it) => {
        if (!bySku[it.sku]) bySku[it.sku] = []
        bySku[it.sku].push(it)
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
  }, [items])

  const filteredData = useMemo(() => {
    const q = filters.search.toLowerCase()
    let arr = items.filter((i) => {
      const matchesSearch =
        i.sku.toLowerCase().includes(q) || i.name.toLowerCase().includes(q) || i.brand.toLowerCase().includes(q)
      const matchesBrand = filters.brand === "all" ? true : i.brand === filters.brand
      return matchesSearch && matchesBrand
    })
    if (filters.sortBy === "date_desc") {
      arr = arr.slice().sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    } else if (filters.sortBy === "date_asc") {
      arr = arr.slice().sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    } else if (filters.sortBy === "brand") {
      arr = arr.slice().sort((a, b) => a.brand.localeCompare(b.brand))
    } else if (filters.sortBy === "name") {
      arr = arr.slice().sort((a, b) => a.name.localeCompare(b.name))
    }
    return arr
  }, [items, filters])

  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredData.slice(startIndex, endIndex)

  async function saveItem() {
    if (readOnly) return
    try {
      setSaving(true)
      const name = String(form.name || "").trim()
      const sku = String(form.sku || "")
        .trim()
        .toUpperCase()
      const brandValue = form.brandMode === "select" ? String(form.brand || "").trim() : String(form.brand || "").trim()
      const qtyNum = Number(form.quantity)
      if (!name || !sku || !brandValue || !Number.isFinite(qtyNum) || qtyNum < 0) {
        toast({ title: "Datos inválidos", description: "Complete todos los campos", variant: "destructive" })
        return
      }

      const resp = await fetchStock({
        action: "createProduct",
        payload: { sku, name, brand: brandValue, quantity: qtyNum },
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error creando producto")
      }
      const nowItem: StockItem = {
        id: json.id,
        sku,
        name,
        brand: brandValue,
        quantity: qtyNum,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }
      setItems((prev) => [nowItem, ...prev])
      if (!brands.includes(brandValue)) {
        setBrands((prev) => [...prev, brandValue].sort())
      }
      await logActivity(
        "CREATE_STOCK_PRODUCT",
        "stock_products",
        json.id,
        null,
        { sku, name, brand: brandValue, quantity: qtyNum },
        "Creación de producto en Stock",
      )
      toast({ title: "Guardado", description: "Producto creado" })
      setForm({ name: "", sku: "", brandMode: "select", brand: "", quantity: "" })
      await loadData()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo guardar el producto", variant: "destructive" })
    } finally {
      setSaving(false)
    }
  }

  async function updateQuantity(item: StockItem, newQty: number) {
    if (readOnly) return
    try {
      if (!Number.isFinite(newQty) || newQty < 0) {
        toast({ title: "Cantidad inválida", description: "Ingrese un número válido", variant: "destructive" })
        return
      }
      const resp = await fetchStock({
        action: "updateQuantity",
        payload: { product_id: item.id, sku: item.sku, old_quantity: item.quantity, new_quantity: newQty },
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error actualizando stock")
      }
      await logActivity(
        "UPDATE_STOCK_QTY",
        "stock_products",
        item.id,
        { quantity: item.quantity },
        { quantity: newQty },
        "Actualización de stock",
      )
      toast({ title: "Actualizado", description: "Stock modificado" })
      await loadData()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo modificar el stock", variant: "destructive" })
    } finally {
      setEditingId(null)
    }
  }

  async function updateCreatedAt(item: StockItem, newDateISO: string) {
    if (readOnly) return
    try {
      const date = new Date(newDateISO)
      if (isNaN(date.getTime())) {
        toast({ title: "Fecha inválida", description: "Ingrese una fecha válida", variant: "destructive" })
        return
      }
      const resp = await fetchStock({
        action: "updateCreatedAt",
        payload: { product_id: item.id, created_at: newDateISO },
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error actualizando fecha")
      }
      await logActivity(
        "UPDATE_STOCK_DATE",
        "stock_products",
        item.id,
        { created_at: item.created_at },
        { created_at: newDateISO },
        "Actualización de fecha",
      )
      toast({ title: "Actualizado", description: "Fecha modificada" })
      await loadData()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo modificar la fecha", variant: "destructive" })
    } finally {
      setEditingDateId(null)
    }
  }

  async function deleteItem(item: StockItem) {
    if (readOnly) return
    const ok = window.confirm(`¿Eliminar producto ${item.sku}?`)
    if (!ok) return
    try {
      const resp = await fetchStock({
        action: "deleteProduct",
        payload: { product_id: item.id },
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error eliminando")
      }
      await logActivity(
        "DELETE_STOCK_PRODUCT",
        "stock_products",
        item.id,
        item,
        null,
        "Eliminación de producto en Stock",
      )
      toast({ title: "Eliminado", description: "Producto eliminado" })
      await loadData()
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo eliminar", variant: "destructive" })
    }
  }

  function openEditDialog(item: StockItem) {
    setEditItem(item)
    setEditOpen(true)
    setEditForm({
      name: item.name,
      sku: item.sku,
      brandMode: brands.includes(item.brand) ? "select" : "new",
      brand: item.brand,
      quantity: String(item.quantity),
      created_at: new Date(item.created_at).toISOString().slice(0, 10),
    })
  }

  async function saveEditDialog() {
    if (!editItem || readOnly) return
    try {
      const name = String(editForm.name || "").trim()
      const sku = String(editForm.sku || "")
        .trim()
        .toUpperCase()
      const brandValue = String(editForm.brand || "").trim()
      const qtyNum = Number(editForm.quantity)
      const createdLocalDate = String(editForm.created_at || "")
      const createdLocal = createdLocalDate ? createdLocalDate + "T00:00:00" : ""
      if (!name || !sku || !brandValue || !Number.isFinite(qtyNum) || qtyNum < 0 || !createdLocal) {
        toast({ title: "Datos inválidos", description: "Complete todos los campos", variant: "destructive" })
        return
      }
      if (!isSupabaseConfigured) {
        const next = items.map((i) =>
          i.id === editItem.id
            ? {
                ...i,
                name,
                sku,
                brand: brandValue,
                quantity: qtyNum,
                created_at: new Date(createdLocal).toISOString(),
                updated_at: new Date().toISOString(),
              }
            : i,
        )
        setItems(next)
        localStorage.setItem("stock:products", JSON.stringify(next))
        if (!brands.includes(brandValue)) setBrands((prev) => [...prev, brandValue].sort())
        toast({ title: "Actualizado", description: "Producto modificado" })
        setEditOpen(false)
        setEditItem(null)
        return
      }
      const resp = await fetchStock({
        action: "updateProduct",
        payload: {
          product_id: editItem.id,
          sku,
          name,
          brand: brandValue,
          quantity: qtyNum,
          created_at: createdLocal,
        },
      })
      const json = await resp.json()
      if (!resp.ok || !json?.ok) {
        throw new Error(json?.error || "Error actualizando producto")
      }
      await logActivity(
        "UPDATE_STOCK_PRODUCT",
        "stock_products",
        editItem.id,
        editItem,
        { sku, name, brand: brandValue, quantity: qtyNum, created_at: createdLocal },
        "Edición de producto en Stock",
      )
      toast({ title: "Actualizado", description: "Producto modificado" })
      setEditOpen(false)
      setEditItem(null)
      loadData()
      if (!brands.includes(brandValue)) setBrands((prev) => [...prev, brandValue].sort())
    } catch (err) {
      console.error(err)
      toast({ title: "Error", description: "No se pudo modificar el producto", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-xl border-0 bg-white/90 backdrop-blur-sm overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-slate-50 via-blue-50 to-indigo-50 border-b border-blue-100">
          <CardTitle className="flex items-center justify-between gap-3 text-slate-800">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-blue-100">
                <Package className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <span className="bg-gradient-to-r from-blue-700 to-indigo-700 bg-clip-text text-transparent font-bold text-xl">
                  Lista Stock
                </span>
                <p className="text-sm text-gray-600 font-normal mt-1">
                  Control completo del inventario y gestión de productos
                </p>
              </div>
            </div>
            <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
              {filteredData.length} items
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-100">
            <h3 className="text-lg font-semibold text-blue-900 mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Crear Nuevo Producto
            </h3>
            <div className="grid md:grid-cols-12 gap-4">
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-gray-700">SKU</Label>
                <div className="relative">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
                  <Input
                    value={form.sku}
                    onChange={(e) => {
                      const v = e.target.value
                      setForm((f) => ({ ...f, sku: v }))
                      const existing = items.find((i) => i.sku.toLowerCase() === v.toLowerCase())
                      if (existing) {
                        setForm((f) => ({ ...f, name: existing.name, brandMode: "select", brand: existing.brand }))
                        if (!brands.includes(existing.brand)) {
                          setBrands((prev) => [...prev, existing.brand].sort())
                        }
                      }
                    }}
                    disabled={readOnly}
                    className="pl-8"
                    placeholder="SKU"
                  />
                </div>
              </div>
              <div className="md:col-span-4">
                <Label className="text-sm font-medium text-gray-700">Nombre del Producto</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  disabled={readOnly}
                  placeholder="Ingrese el nombre del producto"
                />
              </div>
              <div className="md:col-span-3">
                <Label className="text-sm font-medium text-gray-700">Marca</Label>
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
                          <div className="flex items-center justify-between w-full gap-10 pr-2">
                            <span className="flex-1 truncate">{b}</span>
                            {!readOnly && (
                              <button
                                type="button"
                                className="text-red-600 hover:text-red-700 ml-auto shrink-0"
                                title="Eliminar marca"
                                onPointerDown={(e) => e.preventDefault()}
                                onMouseDown={(e) => e.preventDefault()}
                                onPointerUp={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  deleteBrandByName(b)
                                }}
                                onClick={(e) => {
                                  e.preventDefault()
                                  e.stopPropagation()
                                  deleteBrandByName(b)
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
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
              <div className="md:col-span-2">
                <Label className="text-sm font-medium text-gray-700">Cantidad</Label>
                <Input
                  ref={qtyRef}
                  type="number"
                  value={form.quantity}
                  onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
                  disabled={readOnly}
                  placeholder="0"
                />
              </div>
              <div className="md:col-span-1 flex items-end">
                <Button
                  onClick={saveItem}
                  disabled={loading || readOnly}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Guardar
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 bg-white p-3 rounded-lg border flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                value={filters.search}
                onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
                className="pl-8 h-9 text-sm"
                placeholder="Buscar por nombre, SKU o marca"
              />
            </div>
            <Select value={filters.brand} onValueChange={(val) => setFilters((f) => ({ ...f, brand: val }))}>
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
            <Select value={filters.sortBy} onValueChange={(val) => setFilters((f) => ({ ...f, sortBy: val }))}>
              <SelectTrigger className="w-[200px] h-9 text-sm">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date_desc">Fecha desc</SelectItem>
                <SelectItem value="date_asc">Fecha asc</SelectItem>
                <SelectItem value="brand">Marca</SelectItem>
                <SelectItem value="name">Nombre</SelectItem>
              </SelectContent>
            </Select>
            <Select value={String(itemsPerPage)} onValueChange={(val) => setItemsPerPage(Number(val))}>
              <SelectTrigger className="w-[140px] h-9 text-sm">
                <SelectValue placeholder="Items por página" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="25">25</SelectItem>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="md:hidden space-y-4">
            {currentItems.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <span className="text-xs text-gray-500 font-mono block mb-1">{item.sku}</span>
                      <h3 className="font-bold text-base leading-tight">{item.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="secondary" className="text-xs font-normal">
                          {item.brand}
                        </Badge>
                        <span className="text-xs text-gray-400">
                          {new Date(item.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className="block font-bold text-lg">{item.quantity}</span>
                       <span className="text-[10px] text-gray-500 uppercase">Unid.</span>
                    </div>
                  </div>
                  
                  {!readOnly && (
                    <div className="flex justify-end gap-2 pt-2 border-t mt-2">
                       <Button variant="outline" size="sm" className="h-8" onClick={() => openEditDialog(item)}>
                         <Pencil className="w-3.5 h-3.5 mr-1.5" /> Editar
                       </Button>
                       <Button variant="destructive" size="sm" className="h-8" onClick={() => deleteItem(item)}>
                         <Trash2 className="w-3.5 h-3.5 mr-1.5" /> Eliminar
                       </Button>
                    </div>
                  )}
                </div>
              </Card>
            ))}
            {currentItems.length === 0 && (
               <div className="text-center p-8 text-gray-500 bg-gray-50 rounded-lg border border-dashed">
                 No hay productos encontrados
               </div>
            )}
          </div>

          <div className="hidden md:block rounded overflow-hidden border">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-50">
                  <TableHead className="font-semibold">Fecha</TableHead>
                  <TableHead className="font-semibold">SKU</TableHead>
                  <TableHead className="font-semibold">Nombre</TableHead>
                  <TableHead className="font-semibold">Marca</TableHead>
                  <TableHead className="font-semibold">Cantidad</TableHead>
                  <TableHead className="font-semibold">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((item) => (
                  <TableRow key={item.id} className="hover:bg-slate-50/50">
                    <TableCell className="text-xs">
                      {editingDateId === item.id ? (
                        <div className="flex items-center gap-2">
                          <Input
                            ref={editDateRef}
                            type="date"
                            defaultValue={new Date(item.created_at).toISOString().slice(0, 10)}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            onClick={() => {
                              const raw =
                                editDateRef.current?.value || new Date(item.created_at).toISOString().slice(0, 10)
                              const v = String(raw) + "T00:00:00"
                              updateCreatedAt(item, v as string)
                            }}
                          >
                            Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingDateId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <button className="text-blue-700 hover:underline" onClick={() => setEditingDateId(item.id)}>
                          {new Date(item.created_at).toLocaleDateString()}
                        </button>
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{item.sku}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.brand}</TableCell>
                    <TableCell>
                      {editingId === item.id ? (
                        <div className="flex items-center gap-2">
                          <Input ref={editQtyRef} type="number" defaultValue={item.quantity} className="h-8 w-24" />
                          <Button
                            size="sm"
                            onClick={() => {
                              const v = Number(editQtyRef.current?.value || item.quantity)
                              updateQuantity(item, v)
                            }}
                          >
                            Guardar
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                            Cancelar
                          </Button>
                        </div>
                      ) : (
                        <span className="font-bold">{item.quantity}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!readOnly && (
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" size="icon" title="Editar" onClick={() => openEditDialog(item)}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button variant="destructive" size="icon" title="Eliminar" onClick={() => deleteItem(item)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {currentItems.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                      Sin resultados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-3 flex items-center justify-between text-sm">
            <div className="text-slate-700">
              Mostrando {filteredData.length > 0 ? startIndex + 1 : 0} a {Math.min(endIndex, filteredData.length)} de{" "}
              {filteredData.length} productos
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronsLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
                disabled={currentPage === 1}
                className="h-8 w-8 p-0"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <div className="text-sm font-medium text-slate-700">
                Página {currentPage} de {totalPages || 1}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages || totalPages === 0}
                className="h-8 w-8 p-0"
              >
                <ChevronsRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <Dialog open={brandDialogOpen} onOpenChange={setBrandDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Administrar marcas</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {brands.length === 0 && <div className="text-sm text-slate-500">No hay marcas disponibles</div>}
            {brands.map((b) => (
              <div key={b} className="flex items-center justify-between border rounded px-3 py-2">
                <span className="text-sm">{b}</span>
                {!readOnly && (
                  <Button variant="destructive" size="icon" title="Eliminar marca" onClick={() => deleteBrandByName(b)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar producto</DialogTitle>
          </DialogHeader>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label>Nombre</Label>
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>SKU</Label>
              <Input value={editForm.sku} onChange={(e) => setEditForm((f) => ({ ...f, sku: e.target.value }))} />
            </div>
            <div>
              <Label>Marca</Label>
              {editForm.brandMode === "select" ? (
                <Select
                  value={editForm.brand}
                  onValueChange={(val) => {
                    if (val === "__new__") {
                      setEditForm((f) => ({ ...f, brandMode: "new", brand: "" }))
                    } else {
                      setEditForm((f) => ({ ...f, brand: val }))
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar marca" />
                  </SelectTrigger>
                  <SelectContent>
                    {brands.map((b) => (
                      <SelectItem key={b} value={b}>
                        <div className="flex items-center justify-between w-full gap-10 pr-2">
                          <span className="flex-1 truncate">{b}</span>
                          {!readOnly && (
                            <button
                              type="button"
                              className="text-red-600 hover:text-red-700 ml-auto shrink-0"
                              title="Eliminar marca"
                              onPointerDown={(e) => e.preventDefault()}
                              onMouseDown={(e) => e.preventDefault()}
                              onPointerUp={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                deleteBrandByName(b)
                              }}
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                deleteBrandByName(b)
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                    <SelectItem value="__new__">+ Nueva marca…</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <div className="flex gap-2">
                  <Input
                    value={editForm.brand}
                    onChange={(e) => setEditForm((f) => ({ ...f, brand: e.target.value }))}
                    placeholder="Escribir marca"
                  />
                  <Button
                    variant="outline"
                    onClick={() => setEditForm((f) => ({ ...f, brandMode: "select", brand: "" }))}
                  >
                    Usar lista
                  </Button>
                </div>
              )}
            </div>
            <div>
              <Label>Cantidad</Label>
              <Input
                type="number"
                value={editForm.quantity}
                onChange={(e) => setEditForm((f) => ({ ...f, quantity: e.target.value }))}
              />
            </div>
            <div className="md:col-span-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={editForm.created_at}
                onChange={(e) => setEditForm((f) => ({ ...f, created_at: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditOpen(false)}>
              Cancelar
            </Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={saveEditDialog}>
              Guardar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
