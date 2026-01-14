"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ShoppingBag,
  Users,
  Plus,
  Edit,
  Search,
  Trash2,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronUp,
  Filter,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { getCurrentUser, logActivity } from "@/lib/auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { logError } from "@/lib/logger"

type InventoryItem = {
  id: number
  sku: string
  description: string
  pvp_with_tax: number
  quantity: number
  stock_status: "normal" | "missing" | "excess"
  cost_without_tax?: number
}

type RetailClient = {
  id: number
  name: string
  dni_cuit: string
  email: string
  phone: string
  province: string
  city: string
  zip_code: string
  address: string
  created_at: string
}

type RetailSaleItem = {
  id: number
  sku: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  cost?: number
}

type RetailSale = {
  id: number
  date: string
  client_id: number
  client_name: string
  items: RetailSaleItem[]
  subtotal: number
  discount_percentage: number
  shipping_cost: number
  total: number
  stock_status: "restado" | "pendiente"
  payment_status: "pagado" | "pendiente"
  delivery_status: "entregado" | "pendiente"
  tracking_number?: string
  bultos?: number
  notes?: string
}

interface VentasMinoristasProps {
  inventory: InventoryItem[]
}

export function VentasMinoristas({ inventory }: VentasMinoristasProps) {
  const currentUser = getCurrentUser()
  const isReadOnly = currentUser?.role === "viewer"

  const [activeTab, setActiveTab] = useState("ventas")
  const [sales, setSales] = useState<RetailSale[]>([])
  const [clients, setClients] = useState<RetailClient[]>([])
  const [showNewSaleForm, setShowNewSaleForm] = useState(false)

  // New Sale Form State
  const [newSaleDate, setNewSaleDate] = useState(new Date().toISOString().split("T")[0])
  const [newSaleClient, setNewSaleClient] = useState("")
  const [newSaleClientId, setNewSaleClientId] = useState<number | null>(null)
  const [newSaleItems, setNewSaleItems] = useState<RetailSaleItem[]>([])
  const [currentSku, setCurrentSku] = useState("")
  const [currentManualProduct, setCurrentManualProduct] = useState({ description: "", price: 0 })
  const [discount, setDiscount] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)
  const [shippingMethod, setShippingMethod] = useState("")
  const [stockStatus, setStockStatus] = useState("restado")
  const [paymentStatus, setPaymentStatus] = useState("no_pagado")
  const [deliveryStatus, setDeliveryStatus] = useState("no_entregado")
  const [notes, setNotes] = useState("")

  // New State for features
  const [editingSale, setEditingSale] = useState<RetailSale | null>(null)
  const [editingClient, setEditingClient] = useState<RetailClient | null>(null)
  const [viewingClient, setViewingClient] = useState<RetailClient | null>(null)
  const [expandedSales, setExpandedSales] = useState<number[]>([])

  const toggleSaleExpansion = (saleId: number) => {
    setExpandedSales((prev) => (prev.includes(saleId) ? prev.filter((id) => id !== saleId) : [...prev, saleId]))
  }

  // Client creation state
  const [showClientForm, setShowClientForm] = useState(false)
  const [newClientData, setNewClientData] = useState({
    name: "",
    dni_cuit: "",
    email: "",
    phone: "",
    province: "",
    city: "",
    zip_code: "",
    address: "",
  })

  // Product addition state
  const [currentDescription, setCurrentDescription] = useState("")
  const [currentQuantity, setCurrentQuantity] = useState(1)
  const [currentUnitPrice, setCurrentUnitPrice] = useState(0)

  // Stats
  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const salesCount = sales.length
  const paidSales = sales.filter((s) => s.payment_status === "pagado").length
  const deliveredSales = sales.filter((s) => s.delivery_status === "entregado").length
  const pendingStock = sales.filter((s) => s.stock_status === "pendiente").length

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    if (isSupabaseConfigured) {
      try {
        const { data: clientsData, error } = await supabase
          .from("retail_clients")
          .select("*")
          .order("created_at", { ascending: false })

        if (error) throw error
        if (clientsData) setClients(clientsData)

        // TODO: Load retail sales if table exists
      } catch (error) {
        logError("Error loading retail clients", error)
        toast({ title: "Error", description: "No se pudieron cargar los clientes", variant: "destructive" })
      }
    } else {
      // Load initial mock data
      setSales([
        {
          id: 1,
          date: "2024-01-14",
          client_id: 1,
          client_name: "Juan Pérez",
          items: [
            { id: 1, sku: "SKU123", description: "Producto A", quantity: 2, unit_price: 2750, total_price: 5500 },
          ],
          subtotal: 5500,
          discount_percentage: 10,
          shipping_cost: 500,
          total: 5450,
          stock_status: "restado",
          payment_status: "pagado",
          delivery_status: "entregado",
          tracking_number: "CA123456789AR",
          bultos: 1,
        },
        {
          id: 2,
          date: "2024-01-15",
          client_id: 2,
          client_name: "María García",
          items: [
            { id: 2, sku: "SKU456", description: "Producto B", quantity: 1, unit_price: 3000, total_price: 3000 },
          ],
          subtotal: 3000,
          discount_percentage: 0,
          shipping_cost: 0,
          total: 3000,
          stock_status: "pendiente",
          payment_status: "pendiente",
          delivery_status: "pendiente",
          bultos: 0,
        },
      ])

      setClients([
        {
          id: 1,
          name: "Juan Pérez",
          dni_cuit: "20123456789",
          email: "juan@example.com",
          phone: "123456789",
          province: "Buenos Aires",
          city: "La Plata",
          zip_code: "1900",
          address: "Calle 123",
          created_at: "2024-01-01",
        },
        {
          id: 2,
          name: "María García",
          dni_cuit: "27987654321",
          email: "maria@example.com",
          phone: "987654321",
          province: "CABA",
          city: "Buenos Aires",
          zip_code: "1000",
          address: "Av. Siempre Viva 742",
          created_at: "2024-01-02",
        },
      ])
    }
  }

  // Auto-fill details when SKU exists in inventory
  useEffect(() => {
    if (!currentSku) return

    const item = inventory.find((i) => i.sku.toLowerCase() === currentSku.toLowerCase())
    if (item) {
      setCurrentDescription(item.description)
      setCurrentUnitPrice(item.pvp_with_tax)
    }
  }, [currentSku, inventory])

  const addItemToSale = () => {
    if (!currentSku && !currentDescription) {
      toast({
        title: "Datos incompletos",
        description: "Debe ingresar al menos una descripción",
        variant: "destructive",
      })
      return
    }

    if (currentQuantity <= 0 || currentUnitPrice < 0) {
      toast({
        title: "Datos inválidos",
        description: "Cantidad debe ser mayor a 0 y precio no negativo",
        variant: "destructive",
      })
      return
    }

    const inventoryItem = inventory.find((i) => i.sku.toLowerCase() === currentSku.toLowerCase())

    const newItem: RetailSaleItem = {
      id: Date.now(),
      sku: currentSku || "MANUAL",
      description: currentDescription,
      quantity: currentQuantity,
      unit_price: currentUnitPrice,
      total_price: currentUnitPrice * currentQuantity,
      cost: inventoryItem?.cost_without_tax,
    }

    setNewSaleItems([...newSaleItems, newItem])
    setCurrentSku("")
    setCurrentDescription("")
    setCurrentQuantity(1)
    setCurrentUnitPrice(0)
  }

  const calculateTotals = () => {
    const subtotal = newSaleItems.reduce((sum, item) => sum + item.total_price, 0)
    const discountAmount = subtotal * (discount / 100)
    const total = subtotal - discountAmount + shippingCost
    return { subtotal, total }
  }

  const { subtotal, total } = calculateTotals()

  const handleRegisterSale = () => {
    if (!newSaleClientId) {
      toast({ title: "Error", description: "Debe seleccionar un cliente", variant: "destructive" })
      return
    }
    if (newSaleItems.length === 0) {
      toast({ title: "Error", description: "Debe agregar productos", variant: "destructive" })
      return
    }

    if (editingSale) {
      const updatedSale: RetailSale = {
        ...editingSale,
        date: newSaleDate,
        client_name: newSaleClient,
        items: newSaleItems,
        subtotal,
        discount_percentage: discount,
        shipping_cost: shippingCost,
        total,
        stock_status: stockStatus as any,
        payment_status: paymentStatus as any,
        delivery_status: deliveryStatus as any,
        notes,
      }

      setSales(sales.map((s) => (s.id === editingSale.id ? updatedSale : s)))
      toast({ title: "Venta actualizada", description: "La venta se ha actualizado correctamente" })
    } else {
      const newSale: RetailSale = {
        id: Date.now(),
        date: newSaleDate,
        client_id: newSaleClientId || 0,
        client_name: newSaleClient,
        items: newSaleItems,
        subtotal,
        discount_percentage: discount,
        shipping_cost: shippingCost,
        total,
        stock_status: stockStatus as any,
        payment_status: paymentStatus as any,
        delivery_status: deliveryStatus as any,
        notes,
      }
      setSales([newSale, ...sales])
      toast({ title: "Venta registrada", description: "La venta se ha registrado correctamente" })
    }

    setShowNewSaleForm(false)
    resetForm()
  }

  const resetForm = () => {
    setNewSaleItems([])
    setNewSaleClient("")
    setNewSaleClientId(null)
    setDiscount(0)
    setShippingCost(0)
    setNotes("")
    setEditingSale(null)
    setNewSaleDate(new Date().toISOString().split("T")[0])
    setStockStatus("restado")
    setPaymentStatus("no_pagado")
    setDeliveryStatus("no_entregado")
    setCurrentSku("")
    setCurrentDescription("")
    setCurrentQuantity(1)
    setCurrentUnitPrice(0)
  }

  const editSale = (sale: RetailSale) => {
    setEditingSale(sale)
    setNewSaleDate(sale.date)
    setNewSaleClient(sale.client_name)
    setNewSaleItems(sale.items)
    setDiscount(sale.discount_percentage)
    setShippingCost(sale.shipping_cost)
    setStockStatus(sale.stock_status)
    setPaymentStatus(sale.payment_status)
    setDeliveryStatus(sale.delivery_status)
    setNotes(sale.notes || "")
    setShowNewSaleForm(true)
  }

  const deleteSale = (id: number) => {
    if (confirm("¿Está seguro de eliminar esta venta?")) {
      setSales(sales.filter((s) => s.id !== id))
      toast({ title: "Venta eliminada", description: "La venta ha sido eliminada correctamente" })
    }
  }

  const handleCreateClient = async () => {
    if (!newClientData.name) {
      toast({ title: "Error", description: "El nombre es obligatorio", variant: "destructive" })
      return
    }

    try {
      if (isSupabaseConfigured) {
        if (editingClient) {
          const { data, error } = await supabase
            .from("retail_clients")
            .update({
              name: newClientData.name,
              dni_cuit: newClientData.dni_cuit,
              email: newClientData.email,
              phone: newClientData.phone,
              province: newClientData.province,
              city: newClientData.city,
              zip_code: newClientData.zip_code,
              address: newClientData.address,
            })
            .eq("id", editingClient.id)
            .select()
            .single()
          if (error) throw error
          setClients(clients.map((c) => (c.id === data.id ? data : c)))
          await logActivity(
            "UPDATE_RETAIL_CLIENT",
            "retail_clients",
            data.id,
            editingClient,
            data,
            "Cliente minorista actualizado",
          )
        } else {
          const { data, error } = await supabase
            .from("retail_clients")
            .insert([
              {
                name: newClientData.name,
                dni_cuit: newClientData.dni_cuit,
                email: newClientData.email,
                phone: newClientData.phone,
                province: newClientData.province,
                city: newClientData.city,
                zip_code: newClientData.zip_code,
                address: newClientData.address,
              },
            ])
            .select()
            .single()
          if (error) throw error
          setClients([data, ...clients])
          setNewSaleClient(data.name)
          setNewSaleClientId(data.id)
          await logActivity("CREATE_RETAIL_CLIENT", "retail_clients", data.id, null, data, "Cliente minorista creado")
        }
      } else {
        if (editingClient) {
          const updated: RetailClient = { ...editingClient, ...newClientData }
          setClients(clients.map((c) => (c.id === updated.id ? updated : c)))
        } else {
          const newClient: RetailClient = {
            id: Date.now(),
            ...newClientData,
            created_at: new Date().toISOString().split("T")[0],
          }
          setClients([newClient, ...clients])
          setNewSaleClient(newClient.name)
          setNewSaleClientId(newClient.id)
        }
      }

      setShowClientForm(false)
      setEditingClient(null)
      setNewClientData({
        name: "",
        dni_cuit: "",
        email: "",
        phone: "",
        province: "",
        city: "",
        zip_code: "",
        address: "",
      })
      toast({
        title: editingClient ? "Cliente actualizado" : "Cliente creado",
        description: editingClient
          ? "El cliente se ha actualizado correctamente"
          : "El cliente se ha creado correctamente",
      })
    } catch (error) {
      logError("Error creating client", error)
      toast({ title: "Error", description: "No se pudo crear el cliente", variant: "destructive" })
    }
  }

  const handleDeleteClient = async (client: RetailClient) => {
    try {
      if (isSupabaseConfigured) {
        const { error } = await supabase.from("retail_clients").delete().eq("id", client.id)
        if (error) throw error
        await logActivity(
          "DELETE_RETAIL_CLIENT",
          "retail_clients",
          client.id,
          client,
          null,
          "Cliente minorista eliminado",
        )
      }
      setClients(clients.filter((c) => c.id !== client.id))
      toast({ title: "Cliente eliminado", description: "El cliente ha sido eliminado correctamente" })
    } catch (error) {
      logError("Error deleting client", error)
      toast({ title: "Error", description: "No se pudo eliminar el cliente", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-green-800">
            <ShoppingBag className="w-5 h-5 text-green-600" />
            Minoristas
          </CardTitle>
          <CardDescription>Gestión completa de ventas minoristas, clientes y seguimiento de pedidos</CardDescription>
        </CardHeader>
      </Card>
      {/* </CHANGE> */}

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col">
        <div className="px-6 border-b">
          <TabsList>
            <TabsTrigger value="ventas" className="gap-2">
              <ShoppingBag className="w-4 h-4" /> Ventas
            </TabsTrigger>
            <TabsTrigger value="clientes" className="gap-2">
              <Users className="w-4 h-4" /> Clientes
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 overflow-y-auto bg-gray-50/50 p-6">
          <TabsContent value="ventas" className="m-0 space-y-6">
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-emerald-600 text-white">
                <CardContent className="p-4">
                  <p className="text-emerald-100 text-sm">Total Ventas</p>
                  <p className="text-2xl font-bold">{formatCurrency(totalSales)}</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-600 text-white">
                <CardContent className="p-4">
                  <p className="text-blue-100 text-sm">Cantidad Ventas</p>
                  <p className="text-2xl font-bold">{salesCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-emerald-500 text-white">
                <CardContent className="p-4">
                  <p className="text-emerald-100 text-sm">Pagadas</p>
                  <p className="text-2xl font-bold">{paidSales}</p>
                </CardContent>
              </Card>
              <Card className="bg-purple-600 text-white">
                <CardContent className="p-4">
                  <p className="text-purple-100 text-sm">Entregadas</p>
                  <p className="text-2xl font-bold">{deliveredSales}</p>
                </CardContent>
              </Card>
            </div>
            {/* </CHANGE> */}

            <div className="flex justify-between items-center gap-4">
              <div className="bg-white p-2.5 rounded-lg border shadow-sm flex items-center gap-2.5 flex-1 max-w-2xl">
                <div className="flex items-center gap-2 text-emerald-600 border-r border-gray-200 pr-3">
                  <Filter className="w-3.5 h-3.5" />
                  <span className="text-xs font-medium">Filtros</span>
                </div>

                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-gray-400" />
                  <Input placeholder="Buscar cliente, ID o SKU..." className="pl-7 h-8 text-xs" />
                </div>

                <Select defaultValue="todos">
                  <SelectTrigger className="h-8 text-xs w-[110px]">
                    <SelectValue placeholder="Pago" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="pagado">Pagados</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                  </SelectContent>
                </Select>

                <Select defaultValue="todos">
                  <SelectTrigger className="h-8 text-xs w-[110px]">
                    <SelectValue placeholder="Entrega" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos</SelectItem>
                    <SelectItem value="entregado">Entregados</SelectItem>
                    <SelectItem value="pendiente">Pendientes</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {/* </CHANGE> */}

              {!isReadOnly && (
                <Button onClick={() => setShowNewSaleForm(true)} className="bg-green-600 hover:bg-green-700 h-9">
                  <Plus className="w-4 h-4 mr-2" />
                  Nueva Venta
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-gray-50/50">
                        <TableHead className="w-[50px]">ID</TableHead>
                        <TableHead>Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Productos</TableHead>
                        <TableHead>Subtotal</TableHead>
                        <TableHead>Desc.</TableHead>
                        <TableHead>Envío</TableHead>
                        <TableHead>Total</TableHead>
                        <TableHead>Estado Stock</TableHead>
                        <TableHead>Pagado</TableHead>
                        <TableHead>Entregado</TableHead>
                        <TableHead>Nro. Guía</TableHead>
                        <TableHead>Bultos</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map((sale) => (
                        <>
                          <TableRow key={sale.id}>
                            <TableCell className="font-bold">#{sale.id}</TableCell>
                            <TableCell>{sale.date}</TableCell>
                            <TableCell>{sale.client_name}</TableCell>
                            <TableCell>
                              {sale.items.length > 1 ? (
                                <div className="flex items-center gap-2">
                                  <span>{sale.items.length} items</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 w-6 p-0"
                                    onClick={() => toggleSaleExpansion(sale.id)}
                                  >
                                    {expandedSales.includes(sale.id) ? (
                                      <ChevronUp className="w-4 h-4" />
                                    ) : (
                                      <ChevronDown className="w-4 h-4" />
                                    )}
                                  </Button>
                                </div>
                              ) : (
                                <span>{sale.items.length} item(s)</span>
                              )}
                            </TableCell>
                            <TableCell>{formatCurrency(sale.subtotal)}</TableCell>
                            <TableCell>{sale.discount_percentage > 0 ? `${sale.discount_percentage}%` : "-"}</TableCell>
                            <TableCell>{sale.shipping_cost > 0 ? formatCurrency(sale.shipping_cost) : "-"}</TableCell>
                            <TableCell className="font-bold">{formatCurrency(sale.total)}</TableCell>
                            <TableCell>
                              {sale.stock_status === "restado" ? (
                                <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50 gap-1">
                                  <CheckCircle className="w-3 h-3" /> Stock Restado
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="border-orange-500 text-orange-700 bg-orange-50 gap-1"
                                >
                                  <XCircle className="w-3 h-3" /> Restar Stock
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {sale.payment_status === "pagado" ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">SÍ</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">NO</Badge>
                              )}
                            </TableCell>
                            <TableCell>
                              {sale.delivery_status === "entregado" ? (
                                <Badge className="bg-green-100 text-green-700 hover:bg-green-200 border-0">SÍ</Badge>
                              ) : (
                                <Badge className="bg-red-100 text-red-700 hover:bg-red-200 border-0">NO</Badge>
                              )}
                            </TableCell>
                            <TableCell>{sale.tracking_number || "-"}</TableCell>
                            <TableCell>{sale.bultos || 0}</TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button variant="ghost" size="sm" onClick={() => editSale(sale)} title="Editar venta">
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteSale(sale.id)}
                                  title="Eliminar venta"
                                >
                                  <Trash2 className="w-4 h-4 text-red-500" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {expandedSales.includes(sale.id) && sale.items.length > 1 && (
                            <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                              <TableCell colSpan={14} className="p-4">
                                <div className="bg-white rounded-md border p-4 shadow-sm">
                                  <h4 className="font-semibold mb-3 text-sm text-gray-700 flex items-center gap-2">
                                    <ShoppingBag className="w-4 h-4" />
                                    Detalle de Productos
                                  </h4>
                                  <div className="overflow-x-auto">
                                    <Table>
                                      <TableHeader>
                                        <TableRow className="hover:bg-transparent">
                                          <TableHead className="h-8">SKU</TableHead>
                                          <TableHead className="h-8">Descripción</TableHead>
                                          <TableHead className="h-8 text-right">Cantidad</TableHead>
                                          <TableHead className="h-8 text-right">Precio Unit.</TableHead>
                                          <TableHead className="h-8 text-right">Total</TableHead>
                                          <TableHead className="h-8 text-right">Costo Est.</TableHead>
                                        </TableRow>
                                      </TableHeader>
                                      <TableBody>
                                        {sale.items.map((item, idx) => (
                                          <TableRow key={idx} className="hover:bg-gray-50">
                                            <TableCell className="py-2 text-sm">{item.sku}</TableCell>
                                            <TableCell className="py-2 text-sm">{item.description}</TableCell>
                                            <TableCell className="text-right py-2 text-sm">{item.quantity}</TableCell>
                                            <TableCell className="text-right py-2 text-sm">
                                              {formatCurrency(item.unit_price)}
                                            </TableCell>
                                            <TableCell className="text-right py-2 text-sm font-medium">
                                              {formatCurrency(item.total_price)}
                                            </TableCell>
                                            <TableCell className="text-right py-2 text-sm text-gray-500">
                                              {item.cost
                                                ? formatCurrency(item.cost)
                                                : // Fallback to inventory lookup if cost not saved in item
                                                  inventory.find((i) => i.sku === item.sku)?.cost_without_tax
                                                  ? formatCurrency(
                                                      inventory.find((i) => i.sku === item.sku)?.cost_without_tax || 0,
                                                    )
                                                  : "-"}
                                            </TableCell>
                                          </TableRow>
                                        ))}
                                      </TableBody>
                                    </Table>
                                  </div>
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="clientes" className="m-0">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Gestión de Clientes</CardTitle>
                {!isReadOnly && (
                  <Button
                    className="bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => {
                      setEditingClient(null)
                      setNewClientData({
                        name: "",
                        dni_cuit: "",
                        email: "",
                        phone: "",
                        province: "",
                        city: "",
                        zip_code: "",
                        address: "",
                      })
                      setShowClientForm(true)
                    }}
                  >
                    <Plus className="w-4 h-4 mr-2" /> Nuevo Cliente
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nombre</TableHead>
                      <TableHead>DNI/CUIT</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Teléfono</TableHead>
                      <TableHead>Ubicación</TableHead>
                      <TableHead>Dirección</TableHead>
                      <TableHead>Acciones</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => (
                      <TableRow key={client.id}>
                        <TableCell className="font-medium">
                          <Button
                            variant="link"
                            className="p-0 h-auto font-medium text-emerald-700 hover:text-emerald-900"
                            onClick={() => setViewingClient(client)}
                          >
                            {client.name}
                          </Button>
                        </TableCell>
                        <TableCell>{client.dni_cuit || "-"}</TableCell>
                        <TableCell>{client.email}</TableCell>
                        <TableCell>{client.phone}</TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>{client.province || "-"}</span>
                            <span className="text-gray-500">{client.city || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-col text-xs">
                            <span>{client.address}</span>
                            <span className="text-gray-500">CP: {client.zip_code || "-"}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            {!isReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingClient(client)}
                                title="Editar cliente"
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                            )}
                            {!isReadOnly && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDeleteClient(client)}
                                title="Eliminar cliente"
                              >
                                <Trash2 className="w-4 h-4 text-red-500" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </div>
      </Tabs>
    </div>
  )
}
