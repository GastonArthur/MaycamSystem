"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import {
  ShoppingBag,
  Users,
  Plus,
  Edit,
  Search,
  Download,
  Trash2,
  CheckCircle,
  XCircle,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { getCurrentUser, hasPermission, logActivity } from "@/lib/auth"
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
          <CardDescription>Gestión de ventas minoristas y clientes</CardDescription>
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
            <div className="grid grid-cols-5 gap-4">
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
              <Card className="bg-orange-500 text-white">
                <CardContent className="p-4">
                  <p className="text-orange-100 text-sm">Stock Pendiente</p>
                  <p className="text-2xl font-bold">{pendingStock}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex justify-between items-center gap-4">
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                <Input placeholder="Buscar por cliente, ID o SKU..." className="pl-9" />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="gap-2 text-green-600 border-green-600 hover:bg-green-50 bg-transparent"
                  onClick={() => {
                    if (!hasPermission("EXPORT")) {
                      toast({
                        title: "Sin permisos",
                        description: "No tiene permisos para exportar datos",
                        variant: "destructive",
                      })
                      return
                    }
                    // Logic for export would go here
                    toast({ title: "Exportar", description: "Funcionalidad de exportación en desarrollo" })
                  }}
                >
                  <Download className="w-4 h-4" /> Exportar Excel
                </Button>
                {!isReadOnly && (
                  <Button
                    className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => setShowNewSaleForm(true)}
                  >
                    <Plus className="w-4 h-4" /> Nueva Venta
                  </Button>
                )}
              </div>
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
                          {!isReadOnly && (
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="gap-2 bg-transparent"
                                onClick={() => {
                                  setEditingClient(client)
                                  setNewClientData({
                                    name: client.name,
                                    dni_cuit: client.dni_cuit || "",
                                    email: client.email || "",
                                    phone: client.phone || "",
                                    province: client.province || "",
                                    city: client.city || "",
                                    zip_code: client.zip_code || "",
                                    address: client.address || "",
                                  })
                                  setShowClientForm(true)
                                }}
                              >
                                <Edit className="w-4 h-4" /> Editar
                              </Button>
                              <Button
                                variant="destructive"
                                size="sm"
                                className="gap-2"
                                onClick={() => handleDeleteClient(client)}
                              >
                                <Trash2 className="w-4 h-4" /> Eliminar
                              </Button>
                            </div>
                          )}
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

      {showNewSaleForm && (
        <Dialog open={showNewSaleForm} onOpenChange={setShowNewSaleForm}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Registrar Venta</DialogTitle>
            </DialogHeader>
            <div className="grid gap-6 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Fecha de Venta *</Label>
                  <div className="relative">
                    <Calendar className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
                    <Input
                      type="date"
                      className="pl-9"
                      value={newSaleDate}
                      onChange={(e) => setNewSaleDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Cliente *</Label>
                  <div className="flex gap-2">
                    <Select
                      value={newSaleClientId ? String(newSaleClientId) : ""}
                      onValueChange={(val) => {
                        const id = Number.parseInt(val)
                        setNewSaleClientId(id)
                        const c = clients.find((x) => x.id === id)
                        setNewSaleClient(c ? c.name : "")
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar cliente..." />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button variant="outline" size="icon" onClick={() => setShowClientForm(true)} title="Nuevo Cliente">
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>

              <div className="border p-4 rounded-md bg-gray-50">
                <h4 className="font-medium mb-2">Agregar Producto</h4>
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label>SKU</Label>
                      <Input
                        value={currentSku}
                        onChange={(e) => setCurrentSku(e.target.value)}
                        placeholder="SKU"
                        onKeyDown={(e) => {
                          if (e.key === "Enter") addItemToSale()
                        }}
                      />
                    </div>
                    <div>
                      <Label>Cantidad</Label>
                      <Input
                        type="number"
                        min="1"
                        value={currentQuantity}
                        onChange={(e) => setCurrentQuantity(Number.parseInt(e.target.value) || 1)}
                      />
                    </div>
                  </div>

                  <div>
                    <Label>Nombre</Label>
                    <Input
                      value={currentDescription}
                      onChange={(e) => setCurrentDescription(e.target.value)}
                      placeholder="Nombre del producto"
                    />
                  </div>

                  <div>
                    <Label>Precio Unitario</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={currentUnitPrice}
                        onChange={(e) => setCurrentUnitPrice(Number.parseFloat(e.target.value) || 0)}
                        className="pl-7"
                      />
                    </div>
                  </div>

                  <Button type="button" onClick={addItemToSale} className="w-full bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="w-4 h-4 mr-2" /> Agregar a la Venta
                  </Button>
                </div>
              </div>

              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead className="w-[100px]">Cant.</TableHead>
                        <TableHead className="w-[120px] text-right">Precio Unit.</TableHead>
                        <TableHead className="w-[120px] text-right">Total</TableHead>
                        <TableHead className="w-[50px]"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {newSaleItems.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-gray-500 py-8">
                            No hay productos agregados
                          </TableCell>
                        </TableRow>
                      ) : (
                        newSaleItems.map((item, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div className="font-medium">{item.description}</div>
                              <div className="text-xs text-gray-500">{item.sku}</div>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="number"
                                className="h-8"
                                value={item.quantity}
                                onChange={(e) => {
                                  const qty = Number.parseInt(e.target.value) || 0
                                  const newItems = [...newSaleItems]
                                  newItems[index].quantity = qty
                                  newItems[index].total_price = qty * item.unit_price
                                  setNewSaleItems(newItems)
                                }}
                              />
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(item.unit_price)}</TableCell>
                            <TableCell className="text-right font-bold">{formatCurrency(item.total_price)}</TableCell>
                            <TableCell>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-red-500"
                                onClick={() => {
                                  setNewSaleItems(newSaleItems.filter((_, i) => i !== index))
                                }}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>% Descuento (opcional)</Label>
                  <Input
                    type="number"
                    value={discount}
                    onChange={(e) => setDiscount(Number.parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500">Se aplica sobre el subtotal</p>
                </div>
                <div className="space-y-2">
                  <Label>Costo de Envío (opcional)</Label>
                  <Input
                    type="number"
                    value={shippingCost}
                    onChange={(e) => setShippingCost(Number.parseFloat(e.target.value) || 0)}
                  />
                  <p className="text-xs text-gray-500">Se suma al total</p>
                </div>
                <div className="space-y-2">
                  <Label>Método de Envío</Label>
                  <Select value={shippingMethod} onValueChange={setShippingMethod}>
                    <SelectTrigger>
                      <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="correo">Correo Argentino</SelectItem>
                      <SelectItem value="andreani">Andreani</SelectItem>
                      <SelectItem value="moto">Moto Mensajería</SelectItem>
                      <SelectItem value="retiro">Retiro en Local</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                <div className="flex justify-between">
                  <span>Subtotal productos:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {discount > 0 && (
                  <div className="flex justify-between text-green-600">
                    <span>Descuento ({discount}%):</span>
                    <span>-{formatCurrency(subtotal * (discount / 100))}</span>
                  </div>
                )}
                {shippingCost > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>Envío:</span>
                    <span>+{formatCurrency(shippingCost)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold pt-2 border-t">
                  <span>TOTAL FINAL:</span>
                  <span className="text-emerald-600">{formatCurrency(total)}</span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Estado de Stock</Label>
                  <Select value={stockStatus} onValueChange={setStockStatus}>
                    <SelectTrigger className={stockStatus === "restado" ? "text-green-600" : "text-orange-600"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="restado">✓ Stock Restado</SelectItem>
                      <SelectItem value="pendiente">⚠ Restar Stock</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>¿Pagó?</Label>
                  <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                    <SelectTrigger className={paymentStatus === "pagado" ? "text-green-600" : "text-red-600"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pagado">SÍ</SelectItem>
                      <SelectItem value="no_pagado">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>¿Entregado/Enviado?</Label>
                  <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                    <SelectTrigger className={deliveryStatus === "entregado" ? "text-green-600" : "text-red-600"}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entregado">SÍ</SelectItem>
                      <SelectItem value="no_entregado">NO</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Notas (opcional)</Label>
                <Input
                  placeholder="Observaciones adicionales..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setShowNewSaleForm(false)}>
                  Cancelar
                </Button>
                <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleRegisterSale}>
                  Registrar Venta
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {showClientForm && (
        <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Nuevo Cliente Minorista</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Nombre *</Label>
                  <Input
                    value={newClientData.name}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="space-y-2">
                  <Label>DNI o CUIT</Label>
                  <Input
                    value={newClientData.dni_cuit}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, dni_cuit: e.target.value }))}
                    placeholder="DNI o CUIT"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    value={newClientData.email}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="ejemplo@email.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Teléfono</Label>
                  <Input
                    value={newClientData.phone}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, phone: e.target.value }))}
                    placeholder="Número de teléfono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Provincia</Label>
                  <Input
                    value={newClientData.province}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, province: e.target.value }))}
                    placeholder="Provincia"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Localidad</Label>
                  <Input
                    value={newClientData.city}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, city: e.target.value }))}
                    placeholder="Localidad"
                  />
                </div>
                <div className="space-y-2">
                  <Label>C. Postal</Label>
                  <Input
                    value={newClientData.zip_code}
                    onChange={(e) => setNewClientData((prev) => ({ ...prev, zip_code: e.target.value }))}
                    placeholder="CP"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Dirección</Label>
                <Input
                  value={newClientData.address}
                  onChange={(e) => setNewClientData((prev) => ({ ...prev, address: e.target.value }))}
                  placeholder="Dirección completa"
                />
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setShowClientForm(false)}>
                  Cancelar
                </Button>
                <Button onClick={handleCreateClient} className="bg-emerald-600 hover:bg-emerald-700">
                  {editingClient ? "Guardar Cambios" : "Crear Cliente"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
      {viewingClient && (
        <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Información del Cliente</DialogTitle>
              <DialogDescription>Detalles completos del cliente minorista</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Nombre</Label>
                  <div className="font-medium">{viewingClient.name}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">DNI/CUIT</Label>
                  <div className="font-medium">{viewingClient.dni_cuit || "-"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Email</Label>
                  <div className="font-medium truncate" title={viewingClient.email}>
                    {viewingClient.email || "-"}
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Teléfono</Label>
                  <div className="font-medium">{viewingClient.phone || "-"}</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-gray-500">Provincia</Label>
                  <div className="font-medium">{viewingClient.province || "-"}</div>
                </div>
                <div>
                  <Label className="text-xs text-gray-500">Ciudad</Label>
                  <div className="font-medium">{viewingClient.city || "-"}</div>
                </div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Dirección</Label>
                <div className="font-medium">{viewingClient.address || "-"}</div>
              </div>
              <div>
                <Label className="text-xs text-gray-500">Código Postal</Label>
                <div className="font-medium">{viewingClient.zip_code || "-"}</div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={() => setViewingClient(null)}>Cerrar</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}
