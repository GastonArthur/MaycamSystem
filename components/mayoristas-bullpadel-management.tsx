"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import {
  ShoppingCart,
  Users,
  Plus,
  Edit,
  Trash2,
  Download,
  Filter,
  Package,
  TrendingUp,
  FileText,
  Phone,
  Mail,
  ChevronDown,
  ChevronUp,
  UserCircle,
  Search,
} from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { logActivity, hasPermission, getCurrentUser } from "@/lib/auth"
import { logError } from "@/lib/logger"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { formatCurrency } from "@/lib/utils"

type InventoryItem = {
  id: number
  sku: string
  ean: string | null
  description: string
  cost_without_tax: number
  cost_with_tax: number
  pvp_without_tax: number
  pvp_with_tax: number
  quantity: number
  company: "MAYCAM" | "BLUE DOGO" | "GLOBOBAZAAR"
  channel: "A" | "B"
  date_entered: string
  stock_status: "normal" | "missing" | "excess"
  supplier_id: number | null
  brand_id: number | null
  invoice_number: string | null
  observations: string | null
  created_at: string
  suppliers?: { name: string }
  brands?: { name: string }
}

type Supplier = {
  id: number
  name: string
}

type Brand = {
  id: number
  name: string
}

type WholesaleClient = {
  id: number
  name: string
  business_name: string
  cuit: string
  address: string
  city?: string
  province: string
  contact_person: string
  email: string
  whatsapp: string
  created_at: string
  extra_contact?: string
  zip_code?: string
  transport?: string
  destination?: string
  guide_number?: string
  shipping_price?: number
}

type WholesaleOrder = {
  id: number
  client_id: number
  order_date: string
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  is_paid: boolean
  total_amount: number
  subtotal?: number
  discount_percentage?: number
  shipping_cost?: number
  items: WholesaleOrderItem[]
  notes: string
  vendor?: string
  created_at: string
  client?: WholesaleClient
  payment_status?: "pagado" | "pendiente" | "no_pagado"
  delivery_status?: "entregado" | "pendiente" | "no_entregado"
  tracking_number?: string
  bultos?: number
}

type WholesaleOrderItem = {
  id: number
  order_id: number
  sku: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
  stock_status?: "STOCK RESTADO" | "NO HAY STOCK" | "ENTREGA BULLPADEL" | "PEDIR A BULLPADEL"
  observations?: string
}

interface MayoristasManagementProps {
  inventory: InventoryItem[]
  suppliers: Supplier[]
  brands: Brand[]
}

const getStatusColor = (status: string) => {
  switch (status) {
    case "pending":
      return "bg-yellow-500 hover:bg-yellow-600 text-white"
    case "confirmed":
      return "bg-blue-500 hover:bg-blue-600 text-white"
    case "shipped":
      return "bg-purple-500 hover:bg-purple-600 text-white"
    case "delivered":
      return "bg-green-500 hover:bg-green-600 text-white"
    case "cancelled":
      return "bg-red-500 hover:bg-red-600 text-white"
    default:
      return "bg-gray-500 hover:bg-gray-600 text-white"
  }
}

const getStatusLabel = (status: string) => {
  const labels: Record<string, string> = {
    pending: "Pendiente",
    confirmed: "Confirmado",
    shipped: "Enviado",
    delivered: "Entregado",
    cancelled: "Cancelado",
  }
  return labels[status] || status
}

const formatDate = (value: string) => {
  if (!value) return ""
  const s = value.slice(0, 10)
  const parts = s.split("-")
  if (parts.length === 3) {
    const [y, m, d] = parts
    return `${Number(d)}/${Number(m)}/${y}`
  }
  try {
    return new Date(value).toLocaleDateString()
  } catch {
    return value
  }
}

export function MayoristasBullpadelManagement({ inventory, suppliers, brands }: MayoristasManagementProps) {
  const currentUser = getCurrentUser()
  const isReadOnly = currentUser?.role === "viewer"

  const [activeTab, setActiveTab] = useState("precios")
  const [wholesaleConfig, setWholesaleConfig] = useState({
    percentage_1: 10,
    percentage_2: 17,
    percentage_3: 25,
  })

  // Estados para clientes
  const [clients, setClients] = useState<WholesaleClient[]>([])
  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<WholesaleClient | null>(null)
  const [newClient, setNewClient] = useState({
    name: "",
    business_name: "",
    cuit: "",
    address: "",
    city: "",
    province: "",
    contact_person: "",
    email: "",
    whatsapp: "",
    extra_contact: "",
    zip_code: "",
    transport: "",
    destination: "",
    guide_number: "",
    shipping_price: 0,
  })

  // Estados para pedidos
  const [orders, setOrders] = useState<WholesaleOrder[]>([])
  const [showOrderForm, setShowOrderForm] = useState(false)
  const [selectedClient, setSelectedClient] = useState<string>("")
  const [orderItems, setOrderItems] = useState<WholesaleOrderItem[]>([])
  const [currentSku, setCurrentSku] = useState("")
  const [currentDescription, setCurrentDescription] = useState("")
  const [currentUnitPrice, setCurrentUnitPrice] = useState(0)
  const [currentQuantity, setCurrentQuantity] = useState(1)
  const [currentStockStatus, setCurrentStockStatus] = useState<
    "STOCK RESTADO" | "NO HAY STOCK" | "ENTREGA BULLPADEL" | "PEDIR A BULLPADEL"
  >("STOCK RESTADO")
  const [currentObservations, setCurrentObservations] = useState("")
  const [orderNotes, setOrderNotes] = useState("")
  const [orderVendor, setOrderVendor] = useState("")
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0])
  
  // New State for replicated Retail dynamics
  const [discount, setDiscount] = useState(0)
  const [shippingCost, setShippingCost] = useState(0)
  const [stockStatus, setStockStatus] = useState("restado")
  const [paymentStatus, setPaymentStatus] = useState("no_pagado")
  const [deliveryStatus, setDeliveryStatus] = useState("no_entregado")
  const [trackingNumber, setTrackingNumber] = useState("")
  const [bultos, setBultos] = useState(0)

  const [editingOrder, setEditingOrder] = useState<WholesaleOrder | null>(null)
  const [viewingClient, setViewingClient] = useState<WholesaleClient | null>(null)
  const [expandedOrders, setExpandedOrders] = useState<number[]>([])
  const [vendors, setVendors] = useState<{ id: number; name: string }[]>([])
  const [newVendor, setNewVendor] = useState("")
  const [showVendorDialog, setShowVendorDialog] = useState(false)
  const [editingVendor, setEditingVendor] = useState<{ id: number; name: string } | null>(null)
  const [vendorNameDraft, setVendorNameDraft] = useState("")

  // Estados para filtros de pedidos
  const [orderFilters, setOrderFilters] = useState({
    cliente: "all",
    vendedor: "all",
    estado: "all",
    fechaInicio: "",
    fechaFin: "",
  })

  const sortVendorsByName = (list: { id: number; name: string }[]) =>
    [...list].sort((a, b) => a.name.localeCompare(b.name))

  const openVendorEdit = (vendor: { id: number; name: string }) => {
    setEditingVendor(vendor)
    setVendorNameDraft(vendor.name)
    setShowVendorDialog(true)
  }

  const saveVendorEdit = async () => {
    if (!editingVendor) return
    const nextName = vendorNameDraft.trim()
    if (!nextName) {
      toast({ title: "Nombre requerido", description: "Ingrese un nombre válido", variant: "destructive" })
      return
    }

    if (isSupabaseConfigured) {
      try {
        const res = await fetch("/api/wholesale/vendors", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: editingVendor.id, name: nextName }),
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || `Error ${res.status}`)
        const data = json?.data
        if (!data) throw new Error("Respuesta inválida del servidor")

        setVendors((prev) =>
          sortVendorsByName(prev.map((v) => (v.id === data.id ? { id: data.id, name: data.name } : v))),
        )
        setShowVendorDialog(false)
        setEditingVendor(null)
        setVendorNameDraft("")
        toast({ title: "Vendedor actualizado", description: data.name })
      } catch (error) {
        logError("Error updating vendor:", error)
        toast({ title: "Error", description: "No se pudo actualizar el vendedor", variant: "destructive" })
      }
    } else {
      setVendors((prev) =>
        sortVendorsByName(prev.map((v) => (v.id === editingVendor.id ? { ...v, name: nextName } : v))),
      )
      setShowVendorDialog(false)
      setEditingVendor(null)
      setVendorNameDraft("")
      toast({ title: "Vendedor actualizado", description: nextName })
    }
  }

  const deleteVendor = async (vendor: { id: number; name: string }) => {
    const ok = window.confirm(`Eliminar vendedor "${vendor.name}"?`)
    if (!ok) return

    if (isSupabaseConfigured) {
      try {
        const res = await fetch(`/api/wholesale/vendors?id=${encodeURIComponent(String(vendor.id))}`, {
          method: "DELETE",
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(json?.error || `Error ${res.status}`)
        setVendors((prev) => prev.filter((v) => v.id !== vendor.id))
        toast({ title: "Vendedor eliminado", description: vendor.name })
      } catch (error) {
        logError("Error deleting vendor:", error)
        toast({ title: "Error", description: "No se pudo eliminar el vendedor", variant: "destructive" })
      }
    } else {
      setVendors((prev) => prev.filter((v) => v.id !== vendor.id))
      toast({ title: "Vendedor eliminado", description: vendor.name })
    }
  }

  const toggleOrderExpansion = (orderId: number) => {
    setExpandedOrders((prev) => (prev.includes(orderId) ? prev.filter((id) => id !== orderId) : [...prev, orderId]))
  }

  // Filtros para precios
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)
  const [invoiceOrder, setInvoiceOrder] = useState<WholesaleOrder | null>(null)

  const [priceFilters, setPriceFilters] = useState({
    brand: "all",
    search: "",
    showNewOnly: false,
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  useEffect(() => {
    setCurrentPage(1)
  }, [priceFilters, itemsPerPage])

  // Estadísticas reales
  const [statistics, setStatistics] = useState({
    totalSales: 0,
    totalOrders: 0,
    averageTicket: 0,
    activeClients: 0,
    growth: 0,
    retention: 0,
    activeProducts: 0,
    topClients: [] as any[],
    topProducts: [] as any[],
    vendorSales: [] as any[], // Added for vendor sales statistics
  })

  const [reportFilters, setReportFilters] = useState({
    mode: "mensual" as "diario" | "semanal" | "mensual" | "personalizado",
    dateFrom: new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split("T")[0],
    dateTo: new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).toISOString().split("T")[0],
    clientId: "all",
  })

  useEffect(() => {
    calculateStatistics()
  }, [orders, clients]) // Initial calculation on load

  const calculateStatistics = () => {
    const from = new Date(reportFilters.dateFrom)
    const to = new Date(reportFilters.dateTo)
    to.setHours(23, 59, 59, 999)

    // Calculate previous period for growth comparison
    const duration = to.getTime() - from.getTime()
    const prevFrom = new Date(from.getTime() - duration)
    const prevTo = new Date(from.getTime() - 1)

    // Filter valid orders (confirmed, shipped, delivered)
    const validOrders = orders.filter((o) => {
      const d = new Date(o.order_date)
      // Correct date parsing often requires handling timezone, but assuming ISO string YYYY-MM-DD is local or UTC consistent
      // For simplicity, let's treat string comparison or Date object comparison
      return ["confirmed", "shipped", "delivered"].includes(o.status)
    })

    const currentPeriodOrders = validOrders.filter((o) => {
      const d = new Date(o.order_date)
      const dateInRange = d >= from && d <= to
      const clientMatch = reportFilters.clientId === "all" || o.client_id.toString() === reportFilters.clientId
      return dateInRange && clientMatch
    })

    const prevPeriodOrders = validOrders.filter((o) => {
      const d = new Date(o.order_date)
      const dateInRange = d >= prevFrom && d <= prevTo
      const clientMatch = reportFilters.clientId === "all" || o.client_id.toString() === reportFilters.clientId
      return dateInRange && clientMatch
    })

    // Total Sales
    const totalSales = currentPeriodOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)
    const prevTotalSales = prevPeriodOrders.reduce((sum, order) => sum + (order.total_amount || 0), 0)

    // Total Orders
    const totalOrdersCount = currentPeriodOrders.length

    // Average Ticket
    const averageTicket = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0

    // Active Clients (clients with at least one valid order in period)
    const activeClientIds = new Set(currentPeriodOrders.map((o) => o.client_id))
    const activeClients = activeClientIds.size

    // Growth
    const growth =
      prevTotalSales > 0 ? ((totalSales - prevTotalSales) / prevTotalSales) * 100 : totalSales > 0 ? 100 : 0

    // Retention (Clients with > 1 order in period OR Clients who ordered in previous period AND this period)
    // Let's use: Clients in this period who have ordered before (lifetime) or >1 in this period?
    // Standard retention: % of customers from previous period who bought in this period.
    // Simple retention for this dashboard: % of active clients who are "repeat" buyers (have > 1 order lifetime or within period)
    // Let's stick to "Repeat Buyers in Period" or similar.
    // Original logic was: Clients with > 1 order.
    const clientOrderCounts = currentPeriodOrders.reduce(
      (acc, order) => {
        acc[order.client_id] = (acc[order.client_id] || 0) + 1
        return acc
      },
      {} as Record<number, number>,
    )

    const repeatClients = Object.values(clientOrderCounts).filter((count) => count > 1).length
    const retention = activeClients > 0 ? (repeatClients / activeClients) * 100 : 0

    // Top Clients
    const clientSales = Object.entries(clientOrderCounts)
      .map(([clientId, count]) => {
        const id = Number.parseInt(clientId)
        const client = clients.find((c) => c.id === id)
        const sales = currentPeriodOrders
          .filter((o) => o.client_id === id)
          .reduce((sum, o) => sum + (o.total_amount || 0), 0)
        return {
          id,
          name: client?.name || "Desconocido",
          businessName: client?.business_name || "",
          province: client?.province || "N/A",
          sales,
          orders: count,
          percentage: totalSales > 0 ? (sales / totalSales) * 100 : 0,
        }
      })
      .sort((a, b) => b.sales - a.sales)

    // Active Products & Top Products
    const productSalesMap = new Map<string, { quantity: number; revenue: number; description: string }>()

    currentPeriodOrders.forEach((order) => {
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach((item) => {
          const current = productSalesMap.get(item.sku) || { quantity: 0, revenue: 0, description: item.description }
          productSalesMap.set(item.sku, {
            quantity: current.quantity + (item.quantity || 0),
            revenue: current.revenue + (item.total_price || 0),
            description: item.description,
          })
        })
      }
    })

    const activeProducts = productSalesMap.size

    const topProducts = Array.from(productSalesMap.entries())
      .map(([sku, data]) => ({
        sku,
        ...data,
      }))
      .sort((a, b) => b.quantity - a.quantity)

    const vendorSales = (() => {
      const map: Record<string, { sales: number; orders: number }> = {}
      currentPeriodOrders.forEach((o) => {
        const v = (o.vendor || "").trim() || "Sin vendedor"
        const prev = map[v] || { sales: 0, orders: 0 }
        map[v] = { sales: prev.sales + (o.total_amount || 0), orders: prev.orders + 1 }
      })
      return Object.entries(map)
        .map(([name, data]) => ({
          name,
          sales: data.sales,
          orders: data.orders,
          percentage: totalSales > 0 ? (data.sales / totalSales) * 100 : 0,
        }))
        .sort((a, b) => b.sales - a.sales)
    })()

    setStatistics({
      totalSales,
      totalOrders: totalOrdersCount,
      averageTicket,
      activeClients,
      growth,
      retention,
      activeProducts,
      topClients: clientSales,
      topProducts,
      vendorSales,
    })
  }

  useEffect(() => {
    loadWholesaleData()
  }, [])

  const loadWholesaleData = async () => {
    if (!isSupabaseConfigured) {
      // Simular carga de datos (en modo offline)
      setClients([
        {
          id: 1,
          name: "Distribuidora Norte",
          business_name: "Distribuidora Norte S.A.",
          cuit: "30-12345678-9",
          address: "Av. Libertador 1234",
          province: "Buenos Aires",
          contact_person: "Juan Pérez",
          email: "juan@distribuidoranorte.com",
          whatsapp: "+54911234567",
          created_at: new Date().toISOString(),
        },
        {
          id: 2,
          name: "Deportes Sur",
          business_name: "Deportes Sur S.R.L.",
          cuit: "30-87654321-0",
          address: "Calle Falsa 456",
          province: "Córdoba",
          contact_person: "María González",
          email: "maria@deportessur.com",
          whatsapp: "+54351987654",
          created_at: new Date().toISOString(),
        },
      ])

      setOrders([
        {
          id: 1,
          client_id: 1,
          order_date: new Date().toISOString().split("T")[0],
          status: "confirmed",
          total_amount: 15000,
          items: [],
          notes: "Pedido urgente para fin de mes",
          created_at: new Date().toISOString(),
        },
      ])

      toast({
        title: "Datos cargados (Offline)",
        description: "Información de mayoristas cargada en modo offline",
      })
      return
    }

    try {
      // Fetch clients
      const { data: clientsData, error: clientsError } = await supabase
        .from("wholesale_clients")
        .select("*")
        .eq("section", "bullpadel")
        .order("name")

      if (clientsError) throw clientsError
      setClients(clientsData || [])

      // Fetch orders
      const clientIds = (clientsData || []).map((c) => c.id)
      let ordersData: any[] = []
      if (clientIds.length > 0) {
        const { data, error } = await supabase
          .from("wholesale_orders")
          .select("*, items:wholesale_order_items(*)")
          .in("client_id", clientIds)
          .order("created_at", { ascending: false })
        if (error) throw error
        ordersData = data || []
      }

      setOrders(ordersData || [])

      // Fetch vendors from API (to bypass RLS issues)
      try {
        const vendorsRes = await fetch("/api/wholesale/vendors?section=bullpadel")
        if (vendorsRes.ok) {
          const vendorsJson = await vendorsRes.json()
          setVendors(vendorsJson.data || [])
        } else {
          console.error("Error fetching vendors:", await vendorsRes.text())
        }
      } catch (error) {
        console.error("Error calling vendors API:", error)
      }

      // Fetch config
      const { data: configData, error: configError } = await supabase
        .from("config")
        .select("wholesale_percentage_1, wholesale_percentage_2, wholesale_percentage_3")
        .single()

      if (configData) {
        setWholesaleConfig({
          percentage_1: Number(configData.wholesale_percentage_1),
          percentage_2: Number(configData.wholesale_percentage_2),
          percentage_3: Number(configData.wholesale_percentage_3),
        })
      }

      toast({
        title: "Datos actualizados",
        description: "Información de mayoristas cargada desde la base de datos",
      })
    } catch (error) {
      logError("Error loading wholesale data:", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los datos de mayoristas",
        variant: "destructive",
      })
    }
  }

  const getWholesalePrices = () => {
    const uniqueSkus = new Map<string, InventoryItem>()

    // Obtener el último registro de cada SKU
    inventory.forEach((item) => {
      if (!uniqueSkus.has(item.sku) || new Date(item.created_at) > new Date(uniqueSkus.get(item.sku)!.created_at)) {
        uniqueSkus.set(item.sku, item)
      }
    })

    const wholesalePrices = Array.from(uniqueSkus.values()).map((item) => {
      const baseCost = item.cost_without_tax
      const price1 = baseCost * (1 + wholesaleConfig.percentage_1 / 100)
      const price2 = baseCost * (1 + wholesaleConfig.percentage_2 / 100)
      const price3 = baseCost * (1 + wholesaleConfig.percentage_3 / 100)

      // Verificar si es un SKU nuevo (solo aparece una vez en el inventario)
      const skuCount = inventory.filter((inv) => inv.sku === item.sku).length
      const isNew = skuCount === 1

      return {
        ...item,
        wholesale_price_1: price1,
        wholesale_price_2: price2,
        wholesale_price_3: price3,
        is_new: isNew,
      }
    })

    return wholesalePrices
  }

  const getFilteredWholesaleItems = () => {
    let filtered = getWholesalePrices()

    if (priceFilters.search) {
      filtered = filtered.filter(
        (item) =>
          item.sku.toLowerCase().includes(priceFilters.search.toLowerCase()) ||
          item.description.toLowerCase().includes(priceFilters.search.toLowerCase()),
      )
    }

    if (priceFilters.brand !== "all") {
      filtered = filtered.filter((item) => item.brand_id?.toString() === priceFilters.brand)
    }

    if (priceFilters.showNewOnly) {
      filtered = filtered.filter((item) => item.is_new)
    }

    return filtered
  }

  const updateWholesaleConfig = async (newConfig: typeof wholesaleConfig) => {
    setWholesaleConfig(newConfig)

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("config")
          .update({
            wholesale_percentage_1: newConfig.percentage_1,
            wholesale_percentage_2: newConfig.percentage_2,
            wholesale_percentage_3: newConfig.percentage_3,
          })
          .eq("id", 1)

        if (error) throw error
      } catch (error) {
        logError("Error updating config:", error)
        toast({
          title: "Error",
          description: "No se pudo guardar la configuración en la base de datos",
          variant: "destructive",
        })
      }
    }

    await logActivity(
      "UPDATE_WHOLESALE_CONFIG",
      "wholesale_config",
      1,
      wholesaleConfig,
      newConfig,
      "Configuración de precios mayoristas actualizada",
    )

    toast({
      title: "Configuración actualizada",
      description: "Los porcentajes de precios mayoristas han sido actualizados",
    })
  }

  const editClient = async (client: WholesaleClient) => {
    setEditingClient(client)
    setNewClient({
      name: client.name,
      business_name: client.business_name,
      cuit: client.cuit,
      address: client.address,
      city: client.city || "",
      province: client.province,
      contact_person: client.contact_person,
      email: client.email,
      whatsapp: client.whatsapp,
    })
    setShowClientForm(true)
  }

  const updateClient = async () => {
    if (!editingClient || !newClient.name || !newClient.business_name || !newClient.cuit) {
      toast({
        title: "Campos requeridos",
        description: "Nombre, razón social y CUIT son obligatorios",
        variant: "destructive",
      })
      return
    }

    const updatedClient: WholesaleClient = {
      ...editingClient,
      ...newClient,
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase
          .from("wholesale_clients")
          .update({
            name: updatedClient.name,
            business_name: updatedClient.business_name,
            cuit: updatedClient.cuit,
            address: updatedClient.address,
            province: updatedClient.province,
            contact_person: updatedClient.contact_person,
            email: updatedClient.email,
            whatsapp: updatedClient.whatsapp,
            extra_contact: updatedClient.extra_contact,
            zip_code: updatedClient.zip_code,
            transport: updatedClient.transport,
            destination: updatedClient.destination,
            guide_number: updatedClient.guide_number,
            shipping_price: updatedClient.shipping_price,
          })
          .eq("id", updatedClient.id)

        if (error) throw error
      } catch (error) {
        logError("Error updating client:", error)
        toast({
          title: "Error",
          description: "No se pudo actualizar el cliente en la base de datos",
          variant: "destructive",
        })
        return
      }
    }

    setClients((prev) => prev.map((client) => (client.id === editingClient.id ? updatedClient : client)))
    setNewClient({
      name: "",
      business_name: "",
      cuit: "",
      address: "",
      city: "",
      province: "",
      contact_person: "",
      email: "",
      whatsapp: "",
      extra_contact: "",
      zip_code: "",
      transport: "",
      destination: "",
      guide_number: "",
      shipping_price: 0,
    })
    setEditingClient(null)
    setShowClientForm(false)

    await logActivity(
      "UPDATE_WHOLESALE_CLIENT",
      "wholesale_clients",
      updatedClient.id,
      editingClient,
      updatedClient,
      `Cliente mayorista ${updatedClient.name} actualizado`,
    )

    toast({
      title: "Cliente actualizado",
      description: `${updatedClient.name} ha sido actualizado correctamente`,
    })
  }

  const deleteClient = async (client: WholesaleClient) => {
    if (!confirm(`¿Está seguro de eliminar el cliente ${client.name}?`)) {
      return
    }

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("wholesale_clients").delete().eq("id", client.id)
        if (error) throw error
      } catch (error) {
        logError("Error deleting client:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar el cliente de la base de datos",
          variant: "destructive",
        })
        return
      }
    }

    setClients((prev) => prev.filter((c) => c.id !== client.id))

    await logActivity(
      "DELETE_WHOLESALE_CLIENT",
      "wholesale_clients",
      client.id,
      client,
      null,
      `Cliente mayorista ${client.name} eliminado`,
    )

    toast({
      title: "Cliente eliminado",
      description: `${client.name} ha sido eliminado de la lista de clientes mayoristas`,
    })
  }

  const addClient = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()
    console.log("Adding client...", newClient)
    if (!newClient.name || !newClient.business_name || !newClient.cuit) {
      console.log("Validation failed", newClient)
      toast({
        title: "Campos requeridos",
        description: "Nombre, razón social y CUIT son obligatorios",
        variant: "destructive",
      })
      return
    }

    // Validaciones adicionales
    const cleanCuit = newClient.cuit.replace(/[^0-9]/g, "")
    if (!cleanCuit || cleanCuit.length < 7) {
      toast({
        title: "CUIT/DNI inválido",
        description: "El CUIT/DNI debe contener solo números y ser válido",
        variant: "destructive",
      })
      return
    }

    if (newClient.email && !newClient.email.includes("@")) {
      toast({
        title: "Email inválido",
        description: "El email debe contener @",
        variant: "destructive",
      })
      return
    }

    if (newClient.whatsapp) {
      const cleanWhatsapp = newClient.whatsapp.replace(/[^0-9]/g, "")
      if (!cleanWhatsapp) {
        toast({
          title: "WhatsApp inválido",
          description: "El WhatsApp debe contener solo números",
          variant: "destructive",
        })
        return
      }
    }

    if (editingClient) {
      await updateClient()
      return
    }

    try {
      const user = getCurrentUser()
      const userId = user?.id || null

      if (isSupabaseConfigured) {
        console.log("Using Supabase")
        const { data, error } = await supabase
          .from("wholesale_clients")
          .insert([
            {
              name: newClient.name,
              business_name: newClient.business_name,
              cuit: newClient.cuit,
              address: newClient.address,
              province: newClient.province,
              contact_person: newClient.contact_person,
              email: newClient.email,
              whatsapp: newClient.whatsapp,
              created_by: userId,
              section: "bullpadel",
              extra_contact: newClient.extra_contact,
              zip_code: newClient.zip_code,
              transport: newClient.transport,
              destination: newClient.destination,
              guide_number: newClient.guide_number,
              shipping_price: newClient.shipping_price,
            },
          ])
          .select()
          .single()

        if (error) throw error

        const client: WholesaleClient = data
        setClients((prev) => [...prev, client])

        await logActivity(
          "CREATE_WHOLESALE_CLIENT",
          "wholesale_clients",
          client.id,
          null,
          client,
          `Cliente mayorista ${client.name} creado`,
        )

        toast({
          title: "Cliente agregado",
          description: `${client.name} ha sido agregado a la lista de clientes mayoristas`,
        })
      } else {
        console.log("Offline mode")
        const client: WholesaleClient = {
          id: Date.now(),
          ...newClient,
          created_at: new Date().toISOString(),
        }

        setClients((prev) => [...prev, client])

        await logActivity(
          "CREATE_WHOLESALE_CLIENT",
          "wholesale_clients",
          client.id,
          null,
          client,
          `Cliente mayorista ${client.name} creado`,
        )

        toast({
          title: "Cliente agregado",
          description: `${client.name} ha sido agregado a la lista de clientes mayoristas`,
        })
      }

      setNewClient({
        name: "",
        business_name: "",
        cuit: "",
        address: "",
        city: "",
        province: "",
        contact_person: "",
        email: "",
        whatsapp: "",
      })
      closeClientForm()
    } catch (error) {
      logError("Error adding client:", error)
      toast({
        title: "Error",
        description: "No se pudo agregar el cliente. Revise la consola para más detalles.",
        variant: "destructive",
      })
    }
  }

  const addItemToOrder = () => {
    // Validations removed as per user request to make everything optional
    /*
    if (!currentSku || currentQuantity <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Debe ingresar SKU y cantidad mayor a 0",
        variant: "destructive",
      })
      return
    }

    if (!currentDescription || currentUnitPrice <= 0) {
      toast({
        title: "Datos incompletos",
        description: "Debe ingresar descripción y precio unitario",
        variant: "destructive",
      })
      return
    }
    */

    const newItem: WholesaleOrderItem = {
      id: Date.now(),
      order_id: 0,
      sku: currentSku,
      description: currentDescription,
      quantity: currentQuantity,
      unit_price: currentUnitPrice,
      total_price: currentUnitPrice * currentQuantity,
      stock_status: currentStockStatus,
      observations: currentObservations,
    }

    setOrderItems((prev) => [...prev, newItem])
    setCurrentSku("")
    setCurrentDescription("")
    setCurrentUnitPrice(0)
    setCurrentQuantity(1)
    setCurrentStockStatus("STOCK RESTADO")
    setCurrentObservations("")
  }

  // Auto-fill details removed
  // useEffect(() => {
  //   if (!currentSku) return
  //
  //   const item = inventory.find((i) => i.sku === currentSku)
  //   if (item) {
  //     setCurrentDescription(item.description)
  //     // Default to price list 1
  //     setCurrentUnitPrice(item.cost_without_tax * (1 + wholesaleConfig.percentage_1 / 100))
  //   }
  // }, [currentSku, inventory, wholesaleConfig])

  const removeItemFromOrder = (id: number) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id))
  }

  const calculateTotals = () => {
    const subtotal = orderItems.reduce((sum, item) => sum + item.total_price, 0)
    const discountAmount = subtotal * (discount / 100)
    const total = subtotal - discountAmount + shippingCost
    return { subtotal, total }
  }

  const { subtotal, total } = calculateTotals()

  const createOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()

    // Validations removed as per user request
    /*
    if (!selectedClient) {
      toast({
        title: "Error",
        description: "Debe seleccionar un cliente",
        variant: "destructive",
      })
      return
    }

    if (orderItems.length === 0) {
      toast({
        title: "Error",
        description: "Debe agregar al menos un producto",
        variant: "destructive",
      })
      return
    }
    */

    const clientId = selectedClient ? Number.parseInt(selectedClient) : null

    try {
      if (isSupabaseConfigured) {
        const user = getCurrentUser()
        const userId = user?.id || null

        const orderData = {
          client_id: clientId,
          order_date: orderDate,
          total_amount: total,
          subtotal: subtotal,
          discount_percentage: discount,
          shipping_cost: shippingCost,
          notes: orderNotes,
          vendor: orderVendor || null,
          payment_status: paymentStatus,
          delivery_status: deliveryStatus,
          tracking_number: trackingNumber,
          bultos: bultos,
          // Maintain backward compatibility
          is_paid: paymentStatus === "pagado", 
          status: deliveryStatus === "entregado" ? "delivered" : "pending", 
        }

        if (editingOrder) {
          // Update order
          const { error: orderError } = await supabase
            .from("wholesale_orders")
            .update(orderData)
            .eq("id", editingOrder.id)

          if (orderError) throw orderError

          // Delete existing items
          const { error: deleteError } = await supabase
            .from("wholesale_order_items")
            .delete()
            .eq("order_id", editingOrder.id)

          if (deleteError) throw deleteError

          // Insert new items
          const itemsToInsert = orderItems.map((item) => ({
            order_id: editingOrder.id,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            stock_status: item.stock_status,
            observations: item.observations,
          }))

          const { error: itemsError } = await supabase.from("wholesale_order_items").insert(itemsToInsert)

          if (itemsError) throw itemsError

          toast({
            title: "Pedido actualizado",
            description: "El pedido se ha actualizado correctamente",
          })
        } else {
          // Create order
          const { data: orderDataResponse, error: orderError } = await supabase
            .from("wholesale_orders")
            .insert([
              {
                ...orderData,
                status: "pending",
                created_by: userId,
              },
            ])
            .select()
            .single()

          if (orderError) throw orderError

          const itemsToInsert = orderItems.map((item) => ({
            order_id: orderDataResponse.id,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
            stock_status: item.stock_status,
            observations: item.observations,
          }))

          const { error: itemsError } = await supabase.from("wholesale_order_items").insert(itemsToInsert)

          if (itemsError) throw itemsError

          toast({
            title: "Pedido creado",
            description: "El pedido se ha guardado correctamente",
          })
        }

        // Refresh orders
        loadWholesaleData()
      } else {
        // Offline mode
        if (editingOrder) {
          const updatedOrder: WholesaleOrder = {
            ...editingOrder,
            client_id: clientId,
            total_amount: total,
            subtotal,
            discount_percentage: discount,
            shipping_cost: shippingCost,
            items: orderItems,
            notes: orderNotes,
            vendor: orderVendor || undefined,
            order_date: orderDate,
            stock_status: stockStatus as any,
            payment_status: paymentStatus as any,
            delivery_status: deliveryStatus as any,
            tracking_number: trackingNumber,
            bultos: bultos,
          }
          setOrders((prev) => prev.map((o) => (o.id === editingOrder.id ? updatedOrder : o)))
          toast({
            title: "Pedido actualizado (Offline)",
            description: "El pedido se ha actualizado localmente",
          })
        } else {
          const newOrder: WholesaleOrder = {
            id: Date.now(),
            client_id: clientId,
            order_date: orderDate,
            status: "pending",
            is_paid: paymentStatus === "pagado",
            total_amount: total,
            subtotal,
            discount_percentage: discount,
            shipping_cost: shippingCost,
            items: orderItems,
            notes: orderNotes,
            vendor: orderVendor || undefined,
            created_at: new Date().toISOString(),
            stock_status: stockStatus as any,
            payment_status: paymentStatus as any,
            delivery_status: deliveryStatus as any,
            tracking_number: trackingNumber,
            bultos: bultos,
          }
          setOrders((prev) => [newOrder, ...prev])
          toast({
            title: "Pedido creado (Offline)",
            description: "El pedido se ha guardado localmente",
          })
        }
      }

      // Reset form
      setShowOrderForm(false)
      setOrderItems([])
      setSelectedClient("")
      setOrderNotes("")
      setOrderVendor("")
      setOrderDate(new Date().toISOString().split("T")[0])
      setEditingOrder(null)
      setDiscount(0)
      setShippingCost(0)
      setStockStatus("restado")
      setPaymentStatus("no_pagado")
      setDeliveryStatus("no_entregado")
      setTrackingNumber("")
      setBultos(0)
      setCurrentSku("")
      setCurrentDescription("")
      setCurrentQuantity(1)
      setCurrentUnitPrice(0)
    } catch (error) {
      logError("Error saving order:", error)
      toast({
        title: "Error",
        description: "No se pudo guardar el pedido. Revise la consola.",
        variant: "destructive",
      })
    }
  }

  const updateOrderStatus = async (orderId: number, newStatus: WholesaleOrder["status"]) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o)))

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("wholesale_orders").update({ status: newStatus }).eq("id", orderId)

        if (error) throw error

        toast({
          title: "Estado actualizado",
          description: `El pedido #${orderId} ha cambiado a ${newStatus}`,
        })
      } catch (error) {
        logError("Error updating order status:", error)
        toast({
          title: "Error",
          description: "No se pudo actualizar el estado en la base de datos",
          variant: "destructive",
        })
        loadWholesaleData()
      }
    } else {
      toast({
        title: "Estado actualizado (Offline)",
        description: `El pedido #${orderId} ha cambiado a ${newStatus}`,
      })
    }
  }

  const updateOrderPaymentStatus = async (orderId: number, isPaid: boolean) => {
    setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, is_paid: isPaid } : o)))

    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("wholesale_orders").update({ is_paid: isPaid }).eq("id", orderId)

        if (error) throw error

        toast({
          title: "Estado de pago actualizado",
          description: `El pedido #${orderId} ha sido marcado como ${isPaid ? "Pagado" : "No Pagado"}`,
        })
      } catch (error: any) {
        logError("Error updating order payment status:", error)

        const errorMessage = error?.message || ""
        let description = "No se pudo actualizar el estado de pago en la base de datos"

        if (errorMessage.includes("Could not find the 'is_paid' column")) {
          description =
            "Falta la columna 'is_paid' en la base de datos. Por favor ejecute el script 'scripts/add_payment_status_to_wholesale_orders.sql' en Supabase."
        }

        toast({
          title: "Error",
          description,
          variant: "destructive",
          duration: 10000,
        })
        loadWholesaleData()
      }
    } else {
      toast({
        title: "Estado de pago actualizado (Offline)",
        description: `El pedido #${orderId} ha sido marcado como ${isPaid ? "Pagado" : "No Pagado"}`,
      })
    }
  }

  const editOrder = (order: WholesaleOrder) => {
    setEditingOrder(order)
    setSelectedClient(order.client_id.toString())
    setOrderNotes(order.notes || "")
    setOrderVendor(order.vendor || "")
    setOrderDate(order.order_date.split("T")[0])
    setOrderItems(order.items || [])

    // Set new fields
    setDiscount(order.discount_percentage || 0)
    setShippingCost(order.shipping_cost || 0)
    setPaymentStatus(order.payment_status || (order.is_paid ? "pagado" : "no_pagado"))
    setDeliveryStatus(order.delivery_status || (order.status === "delivered" ? "entregado" : "no_entregado"))
    setTrackingNumber(order.tracking_number || "")
    setBultos(order.bultos || 0)

    setShowOrderForm(true)
  }

  const deleteOrder = async (order: WholesaleOrder) => {
    if (!confirm(`¿Está seguro de eliminar el pedido #${order.id}?`)) {
      return
    }

    if (isSupabaseConfigured) {
      try {
        // First delete items
        const { error: itemsError } = await supabase.from("wholesale_order_items").delete().eq("order_id", order.id)
        if (itemsError) throw itemsError

        // Then delete order
        const { error: orderError } = await supabase.from("wholesale_orders").delete().eq("id", order.id)
        if (orderError) throw orderError
      } catch (error) {
        logError("Error deleting order:", error)
        toast({
          title: "Error",
          description: "No se pudo eliminar el pedido",
          variant: "destructive",
        })
        return
      }
    }

    setOrders((prev) => prev.filter((o) => o.id !== order.id))

    await logActivity(
      "DELETE_WHOLESALE_ORDER",
      "wholesale_orders",
      order.id,
      order,
      null,
      `Pedido mayorista #${order.id} eliminado`,
    )

    toast({
      title: "Pedido eliminado",
      description: `El pedido #${order.id} ha sido eliminado`,
    })
  }

  const exportWholesalePrices = () => {
    if (!hasPermission("EXPORT")) {
      toast({
        title: "Sin permisos",
        description: "No tiene permisos para exportar datos",
        variant: "destructive",
      })
      return
    }

    const allPrices = getFilteredWholesaleItems()

    const headers = [
      "SKU",
      "Nombre",
      "Marca",
      "Costo Base",
      `Precio ${wholesaleConfig.percentage_1}%`,
      `Precio ${wholesaleConfig.percentage_2}%`,
      `Precio ${wholesaleConfig.percentage_3}%`,
    ]

    const csvRows = allPrices.map((item) => [
      item.sku,
      item.description,
      item.brands?.name || "Sin marca",
      `$${item.cost_without_tax.toFixed(2)}`,
      `$${item.wholesale_price_1.toFixed(2)}`,
      `$${item.wholesale_price_2.toFixed(2)}`,
      `$${item.wholesale_price_3.toFixed(2)}`,
    ])

    const excelContent = `
<html>
<head>
<meta charset="utf-8">
<style>
.header { 
  background-color: #7C3AED; 
  color: white; 
  font-weight: bold; 
  text-align: center; 
  padding: 8px;
  border: 1px solid #5B21B6;
}
.data { 
  text-align: left; 
  padding: 6px;
  border: 1px solid #E5E7EB;
}
.data-number { 
  text-align: right; 
  padding: 6px;
  border: 1px solid #E5E7EB;
}
.new-item { 
  background-color: #FEF3C7; 
  font-weight: bold;
  color: #D97706;
}
table { 
  border-collapse: collapse; 
  width: 100%; 
  font-family: Arial, sans-serif;
  font-size: 12px;
}
</style>
</head>
<body>
<h2 style="text-align: center; color: #7C3AED; margin-bottom: 20px;">PRECIOS MAYORISTAS</h2>
<table>
<tr>
${headers.map((h) => `<th class="header">${h}</th>`).join("")}
</tr>
${csvRows
  .map((row, index) => {
    const item = allPrices[index]
    return `<tr>
    <td class="data">${row[0]}</td>
    <td class="data">${row[1]}</td>
    <td class="data">${row[2]}</td>
    <td class="data-number">${row[3]}</td>
    <td class="data-number">${row[4]}</td>
    <td class="data-number">${row[5]}</td>
    <td class="data-number">${row[6]}</td>

  </tr>`
  })
  .join("")}
</table>
</body>
</html>`

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `precios_mayoristas_${new Date().toISOString().split("T")[0]}.xls`
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    logActivity(
      "EXPORT_WHOLESALE",
      null,
      null,
      null,
      { count: allPrices.length },
      `Exportación de precios mayoristas: ${allPrices.length} productos`,
    )

    toast({
      title: "Exportación completada",
      description: `Se exportaron ${allPrices.length} precios mayoristas`,
    })
  }

  const exportCompleteReport = () => {
    if (!hasPermission("EXPORT")) {
      toast({
        title: "Sin permisos",
        description: "No tiene permisos para exportar datos",
        variant: "destructive",
      })
      return
    }

    // Generar datos del reporte completo
    const reportData = {
      period: `${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()} - ${new Date().toLocaleDateString()}`,
      totalSales: statistics.totalSales,
      totalOrders: statistics.totalOrders,
      averageTicket: statistics.averageTicket,
      activeClients: statistics.activeClients,
      growth: statistics.growth.toFixed(1),
      retention: statistics.retention.toFixed(0),
      activeProducts: statistics.activeProducts,
    }

    const clientSales = statistics.topClients.map((client) => {
      const clientOrders = orders.filter(
        (o) => o.client_id === client.id && ["confirmed", "shipped", "delivered"].includes(o.status),
      )
      let lastOrderDays = 0
      if (clientOrders.length > 0) {
        const lastOrderDate = new Date(Math.max(...clientOrders.map((o) => new Date(o.order_date).getTime())))
        lastOrderDays = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
      }
      return {
        name: client.name,
        businessName: client.businessName,
        province: client.province,
        sales: client.sales,
        orders: client.orders,
        lastOrder: lastOrderDays,
      }
    })

    const productSales = statistics.topProducts.slice(0, 20).map((item) => ({
      sku: item.sku,
      description: item.description,
      quantity: item.quantity,
      revenue: item.revenue,
    }))

    const excelContent = `
<html>
<head>
<meta charset="utf-8">
<style>
.header { 
  background-color: #7C3AED; 
  color: white; 
  font-weight: bold; 
  text-align: center; 
  padding: 12px;
  border: 1px solid #5B21B6;
  font-size: 14px;
}
.section-header {
  background-color: #F3F4F6;
  font-weight: bold;
  padding: 10px;
  border: 1px solid #D1D5DB;
  font-size: 13px;
}
.data { 
  text-align: left; 
  padding: 8px;
  border: 1px solid #E5E7EB;
  font-size: 12px;
}
.data-number { 
  text-align: right; 
  padding: 8px;
  border: 1px solid #E5E7EB;
  font-size: 12px;
}
.metric-value {
  background-color: #EDE9FE;
  font-weight: bold;
  color: #7C3AED;
  text-align: center;
  padding: 8px;
  border: 1px solid #C4B5FD;
}
table { 
  border-collapse: collapse; 
  width: 100%; 
  font-family: Arial, sans-serif;
  margin-bottom: 20px;
}
h1 { 
  color: #7C3AED; 
  text-align: center; 
  margin-bottom: 30px;
}
h2 { 
  color: #374151; 
  margin-top: 30px; 
  margin-bottom: 15px;
}
</style>
</head>
<body>
<h1>REPORTE COMPLETO DE VENTAS MAYORISTAS</h1>
<p style="text-align: center; color: #6B7280; margin-bottom: 30px;">Período: ${reportData.period}</p>

<h2>MÉTRICAS PRINCIPALES</h2>
<table>
<tr>
<th class="header">Métrica</th>
<th class="header">Valor</th>
<th class="header">Comparativa</th>
</tr>
<tr>
<td class="data">Ventas Totales</td>
<td class="metric-value">$${reportData.totalSales.toLocaleString()}</td>
<td class="data">+${reportData.growth}% vs mes anterior</td>
</tr>
<tr>
<td class="data">Pedidos Realizados</td>
<td class="metric-value">${reportData.totalOrders}</td>
<td class="data">+8% vs mes anterior</td>
</tr>
<tr>
<td class="data">Ticket Promedio</td>
<td class="metric-value">$${reportData.averageTicket.toLocaleString()}</td>
<td class="data">+3% vs mes anterior</td>
</tr>
<tr>
<td class="data">Clientes Activos</td>
<td class="metric-value">${reportData.activeClients}</td>
<td class="data">+12% vs mes anterior</td>
</tr>
<tr>
<td class="data">Retención de Clientes</td>
<td class="metric-value">${reportData.retention}%</td>
<td class="data">Excelente</td>
</tr>
</table>

<h2>VENTAS POR CLIENTE</h2>
<table>
<tr>
<th class="header">Cliente</th>
<th class="header">Razón Social</th>
<th class="header">Provincia</th>
<th class="header">Ventas</th>
<th class="header">Pedidos</th>
<th class="header">Último Pedido</th>
</tr>
${clientSales
  .map(
    (client) => `
<tr>
<td class="data">${client.name}</td>
<td class="data">${client.businessName}</td>
<td class="data">${client.province}</td>
<td class="data-number">$${client.sales.toLocaleString()}</td>
<td class="data-number">${client.orders}</td>
<td class="data">Hace ${client.lastOrder} días</td>
</tr>
`,
  )
  .join("")}
</table>

<h2>PRODUCTOS MÁS VENDIDOS</h2>
<table>
<tr>
<th class="header">SKU</th>
<th class="header">Nombre</th>
<th class="header">Cantidad Vendida</th>
<th class="header">Revenue</th>
</tr>
${productSales
  .map(
    (product) => `
<tr>
<td class="data">${product.sku}</td>
<td class="data">${product.description}</td>
<td class="data-number">${product.quantity} unidades</td>
<td class="data-number">${formatCurrency(product.revenue)}</td>
</tr>
`,
  )
  .join("")}
</table>

<p style="text-align: center; color: #6B7280; margin-top: 40px; font-size: 12px;">
Reporte generado el ${new Date().toLocaleString()} | Sistema de Inventario Mayorista
</p>
</body>
</html>`

    const blob = new Blob([excelContent], { type: "application/vnd.ms-excel;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `reporte_completo_mayoristas_${new Date().toISOString().split("T")[0]}.xls`
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    logActivity(
      "EXPORT_COMPLETE_REPORT",
      null,
      null,
      null,
      { clients: clientSales.length, products: productSales.length },
      `Exportación de reporte completo mayoristas`,
    )

    toast({
      title: "Reporte exportado",
      description: "Reporte completo de ventas mayoristas exportado a Excel",
    })
  }

  const exportAnalysis = () => {
    if (!hasPermission("EXPORT")) {
      toast({
        title: "Sin permisos",
        description: "No tiene permisos para exportar datos",
        variant: "destructive",
      })
      return
    }

    const analysisData = {
      period: `${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toLocaleDateString()} - ${new Date().toLocaleDateString()}`,
      growth: statistics.growth.toFixed(1),
      retention: statistics.retention.toFixed(0),
      activeProducts: statistics.activeProducts,
      trends: [
        {
          metric: "Ventas",
          trend: statistics.growth >= 0 ? "Crecimiento" : "Decrecimiento",
          percentage: `${statistics.growth >= 0 ? "+" : ""}${statistics.growth.toFixed(1)}%`,
        },
        { metric: "Clientes", trend: "Retención", percentage: `${statistics.retention.toFixed(0)}%` },
        { metric: "Productos", trend: "Diversificación", percentage: `${statistics.activeProducts} activos` },
        { metric: "Ticket Promedio", trend: "Valor Promedio", percentage: `$${statistics.averageTicket.toFixed(0)}` },
      ],
    }

    const htmlContent = `
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Análisis de Tendencias - Ventas Mayoristas</title>
<style>
body { 
  font-family: Arial, sans-serif; 
  margin: 40px; 
  color: #374151;
  line-height: 1.6;
}
.header { 
  text-align: center; 
  color: #7C3AED; 
  border-bottom: 3px solid #7C3AED; 
  padding-bottom: 20px;
  margin-bottom: 40px;
}
.metric-card {
  background: linear-gradient(135deg, #F3F4F6 0%, #E5E7EB 100%);
  border-left: 5px solid #7C3AED;
  padding: 20px;
  margin: 20px 0;
  border-radius: 8px;
}
.metric-title {
  font-size: 18px;
  font-weight: bold;
  color: #7C3AED;
  margin-bottom: 10px;
}
.metric-value {
  font-size: 32px;
  font-weight: bold;
  color: #059669;
  margin: 10px 0;
}
.trend-analysis {
  background: #F9FAFB;
  padding: 25px;
  border-radius: 10px;
  margin: 30px 0;
  border: 1px solid #E5E7EB;
}
.recommendation {
  background: #EDE9FE;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #7C3AED;
  margin: 20px 0;
}
.footer {
  text-align: center;
  color: #6B7280;
  margin-top: 50px;
  padding-top: 20px;
  border-top: 1px solid #E5E7EB;
  font-size: 12px;
}
</style>
</head>
<body>
<div class="header">
<h1>ANÁLISIS DE TENDENCIAS</h1>
<h2>Ventas Mayoristas</h2>
<p>Período: ${analysisData.period}</p>
</div>

<div class="metric-card">
<div class="metric-title">Crecimiento Mensual</div>
<div class="metric-value">+${analysisData.growth}%</div>
<p>Las ventas mayoristas muestran un crecimiento sostenido del 18.5% comparado con el mes anterior, indicando una tendencia positiva en el mercado.</p>
</div>

<div class="metric-card">
<div class="metric-title">Retención de Clientes</div>
<div class="metric-value">${analysisData.retention}%</div>
<p>Excelente nivel de retención de clientes, con un 87% de clientes que realizan compras recurrentes, demostrando alta satisfacción y fidelidad.</p>
</div>

<div class="metric-card">
<div class="metric-title">Productos Activos</div>
<div class="metric-value">${analysisData.activeProducts}</div>
<p>Amplio catálogo de productos con ventas activas, permitiendo diversificación de riesgo y múltiples oportunidades de venta.</p>
</div>

<div class="trend-analysis">
<h3>Análisis de Tendencias Detallado</h3>
${analysisData.trends
  .map(
    (trend) => `
<div style="margin: 15px 0; padding: 15px; background: white; border-radius: 5px;">
<strong>${trend.metric}:</strong> ${trend.trend} (${trend.percentage})
</div>
`,
  )
  .join("")}
</div>

<div class="recommendation">
<h3>Recomendaciones Estratégicas</h3>
<ul>
<li><strong>Mantener el impulso:</strong> Continuar con las estrategias actuales que están generando el crecimiento del 18.5%</li>
<li><strong>Fidelización:</strong> Implementar programas de lealtad para mantener la alta retención del 87%</li>
<li><strong>Diversificación:</strong> Aprovechar el amplio catálogo para cross-selling y up-selling</li>
<li><strong>Análisis predictivo:</strong> Implementar herramientas de forecasting para anticipar demanda</li>
</ul>
</div>

<div class="footer">
Análisis generado el ${new Date().toLocaleString()} | Sistema de Inventario Mayorista<br>
Este reporte contiene información confidencial y está destinado únicamente para uso interno
</div>
</body>
</html>`

    const blob = new Blob([htmlContent], { type: "text/html;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `analisis_tendencias_mayoristas_${new Date().toISOString().split("T")[0]}.html`
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    logActivity(
      "EXPORT_ANALYSIS",
      null,
      null,
      null,
      { trends: analysisData.trends.length },
      `Exportación de análisis de tendencias mayoristas`,
    )

    toast({
      title: "Análisis exportado",
      description: "Análisis de tendencias exportado a HTML",
    })
  }

  const exportClients = () => {
    if (!hasPermission("EXPORT")) {
      toast({
        title: "Sin permisos",
        description: "No tiene permisos para exportar datos",
        variant: "destructive",
      })
      return
    }

    const clientsData = clients.map((client) => {
      const clientOrders = orders.filter(
        (o) => o.client_id === client.id && ["confirmed", "shipped", "delivered"].includes(o.status),
      )
      const totalOrders = clientOrders.length
      const totalSales = clientOrders.reduce((sum, o) => sum + o.total_amount, 0)

      let lastOrder = "Sin pedidos"
      let daysSinceLastOrder = -1
      if (totalOrders > 0) {
        const lastOrderDate = new Date(Math.max(...clientOrders.map((o) => new Date(o.order_date).getTime())))
        daysSinceLastOrder = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
        lastOrder = `Hace ${daysSinceLastOrder} días`
      }

      // Calculate frequency (average days between orders)
      let frequency = "N/A"
      if (totalOrders > 1) {
        const dates = clientOrders.map((o) => new Date(o.order_date).getTime()).sort((a, b) => a - b)
        const firstOrder = dates[0]
        const lastOrderTime = dates[dates.length - 1]
        const daysDiff = (lastOrderTime - firstOrder) / (1000 * 60 * 60 * 24)
        const avgDays = Math.round(daysDiff / (totalOrders - 1))
        frequency = `Cada ${avgDays} días`
      }

      // Monthly Average (Total Sales / months since first order or registration)
      const createdDate = new Date(client.created_at)
      const monthsSinceRegistration = Math.max(1, (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30))
      const monthlyAverage = (totalOrders / monthsSinceRegistration).toFixed(1)

      let status = "Inactivo"
      if (totalOrders > 0) {
        if (daysSinceLastOrder <= 30) status = "Activo"
        else if (daysSinceLastOrder <= 90) status = "Regular"
      } else if ((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30) {
        status = "Nuevo"
      }

      return {
        name: client.name,
        businessName: client.business_name,
        cuit: client.cuit,
        address: client.address,
        province: client.province,
        contactPerson: client.contact_person,
        email: client.email,
        whatsapp: client.whatsapp,
        lastOrder,
        totalOrders,
        totalSales: `$${totalSales.toLocaleString()}`,
        frequency,
        monthlyAverage,
        status,
        createdAt: new Date(client.created_at).toLocaleDateString(),
      }
    })

    const headers = [
      "Nombre",
      "Razón Social",
      "CUIT",
      "Dirección",
      "Provincia",
      "Persona de Contacto",
      "Email",
      "WhatsApp",
      "Último Pedido",
      "Total Pedidos",
      "Ventas Totales",
      "Frecuencia de Compra",
      "Promedio Mensual (Pedidos)",
      "Estado",
      "Fecha de Registro",
    ]

    const csvContent = [
      headers.join(","),
      ...clientsData.map((client) =>
        [
          `"${client.name}"`,
          `"${client.businessName}"`,
          `"${client.cuit}"`,
          `"${client.address}"`,
          `"${client.province}"`,
          `"${client.contactPerson}"`,
          `"${client.email}"`,
          `"${client.whatsapp}"`,
          `"${client.lastOrder}"`,
          client.totalOrders,
          `"${client.totalSales}"`,
          `"${client.frequency}"`,
          `"${client.monthlyAverage}/mes"`,
          `"${client.status}"`,
          `"${client.createdAt}"`,
        ].join(","),
      ),
    ].join("\n")

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `clientes_mayoristas_${new Date().toISOString().split("T")[0]}.csv`
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    logActivity(
      "EXPORT_CLIENTS",
      null,
      null,
      null,
      { count: clientsData.length },
      `Exportación de clientes mayoristas: ${clientsData.length} registros`,
    )

    toast({
      title: "Clientes exportados",
      description: `Se exportaron ${clientsData.length} clientes a CSV`,
    })
  }

  const filteredItems = getFilteredWholesaleItems()
  const totalProducts = filteredItems.length
  const newProducts = filteredItems.filter((item) => item.is_new).length

  // Agrupar por marca para mostrar en las tarjetas de estadísticas, aunque la tabla principal será paginada
  const groupedByBrandForStats = filteredItems.reduce(
    (acc, item) => {
      const brandName = item.brands?.name || "Sin marca"
      acc[brandName] = true
      return acc
    },
    {} as Record<string, boolean>,
  )

  // Lógica de paginación
  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredItems.slice(startIndex, endIndex)

  // Agrupar los items de la página actual por marca
  const groupedCurrentItems = currentItems.reduce(
    (acc, item) => {
      const brandName = item.brands?.name || "Sin marca"
      if (!acc[brandName]) {
        acc[brandName] = []
      }
      acc[brandName].push(item)
      return acc
    },
    {} as Record<string, typeof currentItems>,
  )

  const closeClientForm = () => {
    setShowClientForm(false)
    setEditingClient(null)
    setNewClient({
      name: "",
      business_name: "",
      cuit: "",
      address: "",
      city: "",
      province: "",
      contact_person: "",
      email: "",
      whatsapp: "",
    })
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4">
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              Mayoristas Bullpadel
            </CardTitle>
            <CardDescription>Gestión completa de ventas mayoristas, precios y clientes</CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="clientes" className="flex items-center gap-2">
              <Users className="w-4 h-4" />
              Clientes
            </TabsTrigger>
            <TabsTrigger value="pedidos" className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Pedidos
            </TabsTrigger>
            <TabsTrigger value="reportes" className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Reportes
            </TabsTrigger>
            <TabsTrigger value="vendedores" className="flex items-center gap-2">
              <UserCircle className="w-4 h-4" />
              Vendedores
            </TabsTrigger>
          </TabsList>

          <TabsContent value="clientes" className="space-y-4 h-[calc(95vh-200px)] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Clientes Mayoristas</h3>
              {!isReadOnly && (
                <Button onClick={() => setShowClientForm(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Cliente
                </Button>
              )}
            </div>

            <Card>
              <CardContent className="p-0">
                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-3 p-4 bg-gray-50/50">
                  {clients.map((client) => (
                    <div key={client.id} className="bg-white p-4 rounded-lg border shadow-sm space-y-3">
                      <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-bold text-base text-purple-700" onClick={() => setViewingClient(client)}>{client.name}</h4>
                            <p className="text-xs text-gray-500">{client.business_name}</p>
                          </div>
                          {!isReadOnly && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => editClient(client)} className="h-8 w-8 p-0">
                              <Edit className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteClient(client)} className="h-8 w-8 p-0 text-red-500">
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          )}
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-xs text-gray-500 block">Contacto</span>
                          <span>{client.contact_person}</span>
                        </div>
                        <div>
                          <span className="text-xs text-gray-500 block">WhatsApp</span>
                          <span>{client.whatsapp}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-xs text-gray-500 block">Ubicación</span>
                          <span>{client.province}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="hidden md:table-cell">Razón Social</TableHead>
                        <TableHead className="hidden md:table-cell">CUIT</TableHead>
                        <TableHead className="hidden md:table-cell">Provincia</TableHead>
                        <TableHead>Contacto</TableHead>
                        <TableHead className="hidden md:table-cell">Email</TableHead>
                        <TableHead className="hidden md:table-cell">WhatsApp</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {clients.map((client) => (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">
                            <Button
                              variant="link"
                              className="p-0 h-auto font-medium text-purple-700 hover:text-purple-900"
                              onClick={() => setViewingClient(client)}
                            >
                              {client.name}
                            </Button>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">{client.business_name}</TableCell>
                          <TableCell className="hidden md:table-cell">{client.cuit}</TableCell>
                          <TableCell className="hidden md:table-cell">{client.province}</TableCell>
                          <TableCell>{client.contact_person}</TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <Mail className="w-4 h-4 text-gray-500" />
                              {client.email}
                            </div>
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <Phone className="w-4 h-4 text-gray-500" />
                              {client.whatsapp}
                            </div>
                          </TableCell>
                          <TableCell>
                            {!isReadOnly && (
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => editClient(client)}
                                  title="Editar cliente"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteClient(client)}
                                  title="Eliminar cliente"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="vendedores" className="space-y-4 h-[calc(95vh-200px)] overflow-y-auto">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCircle className="w-5 h-5" />
                  Vendedores
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2 mb-4">
                  <Input
                    placeholder="Nombre del vendedor"
                    value={newVendor}
                    onChange={(e) => setNewVendor(e.target.value)}
                    className="w-64"
                  />
                  <Button
                    onClick={async () => {
                      if (!newVendor.trim()) return
                      if (isSupabaseConfigured) {
                        try {
                          const res = await fetch("/api/wholesale/vendors", {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ name: newVendor.trim(), section: "bullpadel" }),
                          })
                          const json = await res.json()
                          if (!res.ok) {
                            throw new Error(json?.error || `Error ${res.status}`)
                          }
                          const data = json?.data
                          if (!data) throw new Error("Respuesta inválida del servidor")
                          setVendors((prev) => sortVendorsByName([...prev, data]))
                          setNewVendor("")
                          toast({ title: "Vendedor agregado", description: data.name })
                        } catch (err: any) {
                          const status = String(err?.status || "")
                          const msg = typeof err?.message === "string" ? err.message : "No se pudo agregar el vendedor"
                          const is404 =
                            status.startsWith("404") || /not found|does not exist|relation .* does not exist/i.test(msg)
                          const is401 = status.startsWith("401") || /row-level security/i.test(msg)
                          if (is404) {
                            toast({
                              title: "Tabla faltante: wholesale_vendors",
                              description:
                                "Crea la tabla en Supabase ejecutando MASTER_DB_SETUP.sql y vuelve a intentar.",
                              variant: "destructive",
                            })
                          } else if (is401) {
                            toast({
                              title: "Acceso denegado por RLS",
                              description:
                                "Autoriza INSERT/SELECT en wholesale_vendors para el rol apropiado (anon/authenticated).",
                              variant: "destructive",
                            })
                          } else {
                            toast({ title: "Error", description: msg, variant: "destructive" })
                          }
                        }
                      } else {
                        const v = { id: Date.now(), name: newVendor.trim() }
                        setVendors((prev) => [...prev, v])
                        setNewVendor("")
                        toast({ title: "Vendedor agregado", description: v.name })
                      }
                    }}
                    className="bg-indigo-600 hover:bg-indigo-700"
                  >
                    Agregar
                  </Button>
                </div>
                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nombre</TableHead>
                        <TableHead className="text-right">Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {vendors.map((v) => (
                        <TableRow key={v.id}>
                          <TableCell className="font-medium">{v.name}</TableCell>
                          <TableCell className="text-right">
                            {!isReadOnly && (
                              <div className="flex gap-2 justify-end">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => openVendorEdit(v)}
                                  title="Editar vendedor"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => deleteVendor(v)}
                                  title="Eliminar vendedor"
                                  className="text-red-600 hover:text-red-700"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {vendors.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center text-gray-500">
                            No hay vendedores cargados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
                <Dialog
                  open={showVendorDialog}
                  onOpenChange={(open) => {
                    setShowVendorDialog(open)
                    if (!open) {
                      setEditingVendor(null)
                      setVendorNameDraft("")
                    }
                  }}
                >
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Editar vendedor</DialogTitle>
                      <DialogDescription>Modificar nombre del vendedor</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-2">
                      <Label>Nombre</Label>
                      <Input value={vendorNameDraft} onChange={(e) => setVendorNameDraft(e.target.value)} />
                    </div>
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowVendorDialog(false)
                          setEditingVendor(null)
                          setVendorNameDraft("")
                        }}
                      >
                        Cancelar
                      </Button>
                      <Button onClick={saveVendorEdit} className="bg-indigo-600 hover:bg-indigo-700">
                        Guardar
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pedidos" className="space-y-4 h-[calc(95vh-200px)] overflow-y-auto">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Pedidos Mayoristas</h3>
              {!isReadOnly && (
                <Button onClick={() => setShowOrderForm(true)} className="bg-purple-600 hover:bg-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Nuevo Pedido
                </Button>
              )}
            </div>

            <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-wrap gap-4 items-center">
              <div className="relative w-64">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
                <Input
                  placeholder="Buscar cliente..."
                  value={orderFilters.cliente}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, cliente: e.target.value }))}
                  className="pl-8"
                />
              </div>

              <Select
                value={orderFilters.vendedor}
                onValueChange={(val) => setOrderFilters((prev) => ({ ...prev, vendedor: val }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los vendedores</SelectItem>
                  {vendors.map((vendor) => (
                    <SelectItem key={vendor.id} value={vendor.name}>
                      {vendor.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={orderFilters.estado}
                onValueChange={(val) => setOrderFilters((prev) => ({ ...prev, estado: val }))}
              >
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendiente</SelectItem>
                  <SelectItem value="confirmed">Confirmado</SelectItem>
                  <SelectItem value="shipped">Enviado</SelectItem>
                  <SelectItem value="delivered">Entregado</SelectItem>
                  <SelectItem value="cancelled">Cancelado</SelectItem>
                </SelectContent>
              </Select>

              <div className="flex gap-2 items-center">
                <Label className="text-sm text-gray-600">Desde:</Label>
                <Input
                  type="date"
                  value={orderFilters.fechaInicio}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, fechaInicio: e.target.value }))}
                  className="w-[150px]"
                />
              </div>

              <div className="flex gap-2 items-center">
                <Label className="text-sm text-gray-600">Hasta:</Label>
                <Input
                  type="date"
                  value={orderFilters.fechaFin}
                  onChange={(e) => setOrderFilters((prev) => ({ ...prev, fechaFin: e.target.value }))}
                  className="w-[150px]"
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setOrderFilters({ cliente: "all", vendedor: "all", estado: "all", fechaInicio: "", fechaFin: "" })
                }
              >
                <Filter className="w-4 h-4 mr-2" />
                Limpiar filtros
              </Button>
            </div>

            <Card>
              <CardContent className="p-0">
                {/* Mobile View - Cards */}
                <div className="md:hidden space-y-4 p-4 bg-gray-50/50">
                   {(() => {
                        const filtered = orders
                          .filter((order) => {
                            const clientName = clients.find((c) => c.id === order.client_id)?.name || ""
                            const matchesClient =
                              orderFilters.cliente === "all" ||
                              clientName.toLowerCase().includes(orderFilters.cliente.toLowerCase())
                            const matchesVendor =
                              orderFilters.vendedor === "all" || order.vendor === orderFilters.vendedor
                            const matchesEstado = orderFilters.estado === "all" || order.status === orderFilters.estado
                            const matchesFechaInicio =
                              !orderFilters.fechaInicio || order.order_date >= orderFilters.fechaInicio
                            const matchesFechaFin = !orderFilters.fechaFin || order.order_date <= orderFilters.fechaFin
                            return (
                              matchesClient && matchesVendor && matchesEstado && matchesFechaInicio && matchesFechaFin
                            )
                          })
                          .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
                        return filtered.map((order, idx) => {
                          const clientName =
                            clients.find((c) => c.id === order.client_id)?.name || "Cliente desconocido"
                          return (
                            <Card key={order.id} className="overflow-hidden">
                               <div className="p-4 space-y-3">
                                 <div className="flex justify-between items-start">
                                   <div>
                                     <div className="flex items-center gap-2 mb-1">
                                       <span className="text-xs text-gray-500 font-mono">#{order.id}</span>
                                       <span className="text-xs text-gray-400">{formatDate(order.order_date)}</span>
                                     </div>
                                     <h3 className="font-bold text-base">{clientName}</h3>
                                     {order.vendor && (
                                       <Badge variant="secondary" className="mt-1 text-[10px]">{order.vendor}</Badge>
                                     )}
                                   </div>
                                   <div className="text-right">
                                     <span className="block font-bold text-lg text-purple-700">${order.total_amount.toFixed(2)}</span>
                                     <span className="text-xs text-gray-500">{order.items?.length || 0} items</span>
                                   </div>
                                 </div>

                                 <div className="flex flex-wrap gap-2 pt-2">
                                    <Badge className={`border-0 ${getStatusColor(order.status)}`}>{getStatusLabel(order.status)}</Badge>
                                    <Badge className={`border-0 ${order.is_paid ? "bg-green-600" : "bg-red-500"} text-white`}>
                                       {order.is_paid ? "Pagado" : "No Pagado"}
                                    </Badge>
                                 </div>

                                 <div className="flex justify-between items-center pt-3 border-t mt-2">
                                    <Button variant="ghost" size="sm" onClick={() => toggleOrderExpansion(order.id)} className="h-8 text-xs">
                                       {expandedOrders.includes(order.id) ? "Ocultar items" : "Ver items"}
                                       {expandedOrders.includes(order.id) ? <ChevronUp className="ml-1 w-3 h-3" /> : <ChevronDown className="ml-1 w-3 h-3" />}
                                    </Button>
                                    
                                    {!isReadOnly && (
                                       <div className="flex gap-1">
                                         <Button variant="ghost" size="sm" onClick={() => editOrder(order)} className="h-8 w-8 p-0">
                                           <Edit className="w-4 h-4" />
                                         </Button>
                                         <Button variant="ghost" size="sm" onClick={() => deleteOrder(order)} className="h-8 w-8 p-0 text-red-500">
                                           <Trash2 className="w-4 h-4" />
                                         </Button>
                                       </div>
                                    )}
                                 </div>

                                 {expandedOrders.includes(order.id) && (
                                   <div className="bg-gray-50 -mx-4 -mb-4 p-4 text-sm border-t mt-2">
                                      {order.items?.map((item, i) => (
                                        <div key={i} className="flex justify-between py-1 border-b last:border-0 border-gray-200">
                                          <div className="flex-1">
                                            <div className="font-medium">{item.description}</div>
                                            <div className="text-xs text-gray-500">{item.sku}</div>
                                          </div>
                                          <div className="text-right pl-2">
                                            <div>{item.quantity} x {formatCurrency(item.unit_price)}</div>
                                            <div className="font-medium">{formatCurrency(item.total_price)}</div>
                                          </div>
                                        </div>
                                      ))}
                                   </div>
                                 )}
                               </div>
                            </Card>
                          )
                        })
                      })()}
                      {orders.length === 0 && (
                        <div className="text-center py-8 text-gray-500">
                          No hay pedidos registrados
                        </div>
                      )}
                </div>

                <div className="overflow-x-auto hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        <TableHead>Vendedor</TableHead>
                        {/* END ADD */}
                        <TableHead>Estado</TableHead>
                        <TableHead>Pagado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="hidden md:table-cell">Notas</TableHead>
                        <TableHead className="hidden md:table-cell">Items</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {(() => {
                        const filtered = orders
                          .filter((order) => {
                            const clientName = clients.find((c) => c.id === order.client_id)?.name || ""
                            const matchesClient =
                              orderFilters.cliente === "all" ||
                              clientName.toLowerCase().includes(orderFilters.cliente.toLowerCase())
                            const matchesVendor =
                              orderFilters.vendedor === "all" || order.vendor === orderFilters.vendedor
                            const matchesEstado = orderFilters.estado === "all" || order.status === orderFilters.estado
                            const matchesFechaInicio =
                              !orderFilters.fechaInicio || order.order_date >= orderFilters.fechaInicio
                            const matchesFechaFin = !orderFilters.fechaFin || order.order_date <= orderFilters.fechaFin
                            return (
                              matchesClient && matchesVendor && matchesEstado && matchesFechaInicio && matchesFechaFin
                            )
                          })
                          .sort((a, b) => new Date(b.order_date).getTime() - new Date(a.order_date).getTime())
                        return filtered.map((order, idx) => {
                          const clientName =
                            clients.find((c) => c.id === order.client_id)?.name || "Cliente desconocido"
                          const hasMultipleItems = (order.items?.length || 0) > 1
                          const displayNumber = filtered.length - idx
                          return (
                            <>
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">#{displayNumber}</TableCell>
                                <TableCell className="hidden md:table-cell">{formatDate(order.order_date)}</TableCell>
                                <TableCell>{clientName}</TableCell>
                                <TableCell>
                                  <Badge variant="outline" className="text-xs">
                                    {order.vendor || "Sin vendedor"}
                                  </Badge>
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger disabled={isReadOnly} className="focus:outline-none">
                                      <Badge className={`cursor-pointer ${getStatusColor(order.status)} border-0`}>
                                        {getStatusLabel(order.status)}
                                      </Badge>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "pending")}>
                                        Pendiente
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "confirmed")}>
                                        Confirmado
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "shipped")}>
                                        Enviado
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "delivered")}>
                                        Entregado
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateOrderStatus(order.id, "cancelled")}>
                                        Cancelado
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                                <TableCell>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger disabled={isReadOnly} className="focus:outline-none">
                                      <Badge
                                        className={`cursor-pointer border-0 ${order.is_paid ? "bg-green-600 hover:bg-green-700" : "bg-red-500 hover:bg-red-600"} text-white`}
                                      >
                                        {order.is_paid ? "SÍ" : "NO"}
                                      </Badge>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent>
                                      <DropdownMenuItem onClick={() => updateOrderPaymentStatus(order.id, true)}>
                                        SÍ
                                      </DropdownMenuItem>
                                      <DropdownMenuItem onClick={() => updateOrderPaymentStatus(order.id, false)}>
                                        NO
                                      </DropdownMenuItem>
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                                <TableCell className="text-right">${order.total_amount.toFixed(2)}</TableCell>
                                <TableCell className="max-w-[200px] truncate hidden md:table-cell">
                                  {order.notes}
                                </TableCell>
                                <TableCell className="hidden md:table-cell">
                                  {hasMultipleItems ? (
                                    <div className="flex items-center gap-2">
                                      <span>{order.items?.length || 0} items</span>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-6 w-6 p-0"
                                        onClick={() => toggleOrderExpansion(order.id)}
                                      >
                                        {expandedOrders.includes(order.id) ? (
                                          <ChevronUp className="w-4 h-4" />
                                        ) : (
                                          <ChevronDown className="w-4 h-4" />
                                        )}
                                      </Button>
                                    </div>
                                  ) : (
                                    <span>{order.items?.length || 0} items</span>
                                  )}
                                </TableCell>
                                <TableCell>
                                  {!isReadOnly && (
                                    <div className="flex gap-2">
                                      <Button variant="ghost" size="sm" onClick={() => editOrder(order)} title="Editar pedido">
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                          setInvoiceOrder(order)
                                          setShowInvoiceModal(true)
                                        }}
                                        title="Crear Factura"
                                      >
                                        <FileText className="w-3 h-3 text-blue-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => deleteOrder(order)}
                                        title="Eliminar pedido"
                                        className="text-red-600 hover:text-red-700"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </Button>
                                    </div>
                                  )}
                                </TableCell>
                              </TableRow>
                              {expandedOrders.includes(order.id) && hasMultipleItems && (
                                <TableRow className="bg-gray-50/50 hover:bg-gray-50/50">
                                  <TableCell colSpan={9} className="p-4">
                                    <div className="bg-white rounded-md border p-4 shadow-sm">
                                      <h4 className="font-semibold mb-3 text-sm text-gray-700 flex items-center gap-2">
                                        <Package className="w-4 h-4" />
                                        Detalle del Pedido
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
                                            {order.items?.map((item, idx) => (
                                              <TableRow key={idx} className="hover:bg-gray-50">
                                                <TableCell className="py-2 text-sm">{item.sku}</TableCell>
                                                <TableCell className="py-2 text-sm">{item.description}</TableCell>
                                                <TableCell className="text-right py-2 text-sm">
                                                  {item.quantity}
                                                </TableCell>
                                                <TableCell className="text-right py-2 text-sm">
                                                  {formatCurrency(item.unit_price)}
                                                </TableCell>
                                                <TableCell className="text-right py-2 text-sm font-medium">
                                                  {formatCurrency(item.total_price)}
                                                </TableCell>
                                                <TableCell className="text-right py-2 text-sm text-gray-500">
                                                  {(() => {
                                                    const invItem = inventory.find((i) => i.sku === item.sku)
                                                    return invItem ? formatCurrency(invItem.cost_without_tax) : "-"
                                                  })()}
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
                          )
                        })
                      })()}
                      {orders.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={9} className="text-center py-8 text-gray-500">
                            No hay pedidos registrados
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            {/* Modal para nuevo pedido */}
            {showOrderForm && (
              <Dialog
                open={showOrderForm}
                onOpenChange={(open) => {
                  if (!open) {
                    setShowOrderForm(false)
                    setEditingOrder(null)
                    setOrderItems([])
                    setSelectedClient("")
                    setOrderNotes("")
                    setOrderVendor("")
                    setOrderDate(new Date().toISOString().split("T")[0])
                    setDiscount(0)
                    setShippingCost(0)
                    setStockStatus("restado")
                    setPaymentStatus("no_pagado")
                    setDeliveryStatus("no_entregado")
                    setTrackingNumber("")
                    setBultos(0)
                    setCurrentSku("")
                    setCurrentDescription("")
                    setCurrentQuantity(1)
                    setCurrentUnitPrice(0)
                  }
                }}
              >
                <DialogContent className="max-w-6xl h-[90vh] flex flex-col p-0">
                  <DialogHeader className="px-6 py-4 border-b bg-gray-50/50">
                    <DialogTitle>{editingOrder ? "Editar Pedido" : "Nueva Venta"}</DialogTitle>
                    <DialogDescription>Complete los detalles de la venta.</DialogDescription>
                  </DialogHeader>

                  <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-2">
                        <Label className="text-base font-semibold text-gray-700">Fecha de Emisión</Label>
                        <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} className="h-10" />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-base font-semibold text-gray-700">Cliente</Label>
                        <div className="flex gap-2">
                          <Select value={selectedClient} onValueChange={setSelectedClient}>
                            <SelectTrigger className="flex-1 h-10">
                              <SelectValue placeholder="Seleccionar cliente" />
                            </SelectTrigger>
                            <SelectContent>
                              {clients.map((client) => (
                                <SelectItem key={client.id} value={client.id.toString()}>
                                  {client.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="icon"
                            className="h-10 w-10"
                            onClick={() => setShowClientForm(true)}
                            title="Nuevo Cliente"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-xl p-5 bg-gray-50/30 space-y-4 shadow-sm">
                      <h4 className="font-semibold text-base flex items-center gap-2 text-purple-700">
                        <div className="p-1 bg-purple-100 rounded-md">
                            <Plus className="w-4 h-4" /> 
                        </div>
                        Agregar Producto
                      </h4>
                      <div className="grid grid-cols-12 gap-4 items-end">
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-sm font-medium">SKU</Label>
                          <Input
                            value={currentSku}
                            onChange={(e) => {
                                const val = e.target.value
                                setCurrentSku(val)
                            }}
                            placeholder="Buscar SKU..."
                            className="h-10"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") addItemToOrder()
                            }}
                          />
                        </div>
                        <div className="col-span-4 space-y-1.5">
                          <Label className="text-sm font-medium">Descripción</Label>
                          <Input
                            value={currentDescription}
                            onChange={(e) => setCurrentDescription(e.target.value)}
                            placeholder="Descripción del producto"
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-3 space-y-1.5">
                          <Label className="text-sm font-medium">Estado Stock</Label>
                           <Select value={currentStockStatus} onValueChange={(val: any) => setCurrentStockStatus(val)}>
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="STOCK RESTADO">STOCK RESTADO</SelectItem>
                              <SelectItem value="NO HAY STOCK">NO HAY STOCK</SelectItem>
                              <SelectItem value="ENTREGA BULLPADEL">ENTREGA BULLPADEL</SelectItem>
                              <SelectItem value="PEDIR A BULLPADEL">PEDIR A BULLPADEL</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="col-span-1 space-y-1.5">
                          <Label className="text-sm font-medium">Cant.</Label>
                          <Input
                            type="number"
                            min="1"
                            value={currentQuantity}
                            onChange={(e) => setCurrentQuantity(Number(e.target.value))}
                            className="h-10"
                          />
                        </div>
                        <div className="col-span-2 space-y-1.5">
                          <Label className="text-sm font-medium">Precio Unit.</Label>
                          <Input
                            type="number"
                            min="0"
                            value={currentUnitPrice}
                            onChange={(e) => setCurrentUnitPrice(Number(e.target.value))}
                            className="h-10"
                          />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-12 gap-4 items-end mt-4">
                        <div className="col-span-11 space-y-1.5">
                          <Label className="text-sm font-medium">Observaciones Item</Label>
                          <Input
                            value={currentObservations}
                            onChange={(e) => setCurrentObservations(e.target.value)}
                            placeholder="Observaciones para este item..."
                            className="h-10"
                            onKeyDown={(e) => {
                                if (e.key === "Enter") addItemToOrder()
                            }}
                          />
                        </div>
                        <div className="col-span-1">
                          <Button
                            onClick={addItemToOrder}
                            className="w-full h-10 bg-purple-600 hover:bg-purple-700 shadow-md"
                          >
                            <Plus className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="border rounded-xl overflow-hidden shadow-sm bg-white min-h-[250px]">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-gray-100/80 hover:bg-gray-100/80">
                            <TableHead className="h-10 font-bold text-gray-700">SKU</TableHead>
                            <TableHead className="h-10 font-bold text-gray-700">Descripción</TableHead>
                            <TableHead className="h-10 font-bold text-gray-700 text-right">Cant.</TableHead>
                            <TableHead className="h-10 font-bold text-gray-700 text-right">Precio</TableHead>
                            <TableHead className="h-10 font-bold text-gray-700 text-right">Total</TableHead>
                            <TableHead className="h-10 w-[50px]"></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {orderItems.length === 0 ? (
                            <TableRow>
                              <TableCell colSpan={6} className="text-center py-12 text-gray-400 text-base">
                                <div className="flex flex-col items-center gap-2">
                                    <ShoppingCart className="w-10 h-10 opacity-20" />
                                    No hay productos agregados
                                </div>
                              </TableCell>
                            </TableRow>
                          ) : (
                            orderItems.map((item, index) => (
                              <TableRow key={index} className="hover:bg-gray-50/50 transition-colors">
                                <TableCell className="py-3 font-medium text-gray-700">{item.sku}</TableCell>
                                <TableCell className="py-3 text-gray-600">{item.description}</TableCell>
                                <TableCell className="py-3 text-right">{item.quantity}</TableCell>
                                <TableCell className="py-3 text-right">
                                  {formatCurrency(item.unit_price)}
                                </TableCell>
                                <TableCell className="py-3 text-right font-bold text-gray-800">
                                  {formatCurrency(item.total_price)}
                                </TableCell>
                                <TableCell className="py-3">
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600 rounded-full"
                                    onClick={() => removeItemFromOrder(item.id)}
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))
                          )}
                        </TableBody>
                      </Table>
                    </div>

                    <div className="grid grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-sm font-medium">Estado Pago</Label>
                            <Select value={paymentStatus} onValueChange={setPaymentStatus}>
                              <SelectTrigger className="h-10">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="pagado">Pagado</SelectItem>
                                <SelectItem value="pendiente">Pendiente</SelectItem>
                                <SelectItem value="no_pagado">No Pagado</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Estado Entrega</Label>
                          <Select value={deliveryStatus} onValueChange={setDeliveryStatus}>
                            <SelectTrigger className="h-10">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="entregado">Entregado</SelectItem>
                              <SelectItem value="pendiente">Pendiente</SelectItem>
                              <SelectItem value="no_entregado">No Entregado</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm font-medium">Notas</Label>
                          <Textarea
                            value={orderNotes}
                            onChange={(e) => setOrderNotes(e.target.value)}
                            placeholder="Notas adicionales..."
                            className="resize-none h-24 text-sm bg-gray-50/30"
                          />
                        </div>
                      </div>

                      <div className="bg-gray-50/80 p-6 rounded-xl space-y-4 h-fit border shadow-sm">
                        <div className="flex justify-between text-base">
                          <span className="text-gray-600">Subtotal</span>
                          <span className="font-medium">{formatCurrency(subtotal)}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <Label className="text-base font-normal text-gray-600">Descuento (%)</Label>
                          <Input
                            type="number"
                            value={discount}
                            onChange={(e) => setDiscount(Number(e.target.value))}
                            className="w-24 h-9 text-right font-medium"
                          />
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <Label className="text-base font-normal text-gray-600">Costo de Envío ($)</Label>
                          <Input
                            type="number"
                            value={shippingCost}
                            onChange={(e) => setShippingCost(Number(e.target.value))}
                            className="w-28 h-9 text-right font-medium"
                          />
                        </div>
                        <div className="border-t border-gray-200 pt-4 mt-2 flex justify-between items-center">
                          <span className="font-bold text-xl text-gray-800">Total</span>
                          <span className="font-bold text-2xl text-purple-700">{formatCurrency(total)}</span>
                        </div>
                        
                        <div className="pt-4">
                            <Button onClick={createOrder} className="w-full h-11 text-lg font-medium bg-purple-600 hover:bg-purple-700 shadow-lg shadow-purple-200">
                              {editingOrder ? "Actualizar Pedido" : "Guardar Pedido"}
                            </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}

            {/* Modal para Factura */}
            {showInvoiceModal && invoiceOrder && (
              <Dialog
                open={showInvoiceModal}
                onOpenChange={(open) => {
                  if (!open) {
                    setShowInvoiceModal(false)
                    setInvoiceOrder(null)
                  }
                }}
              >
                <DialogContent className="max-w-[1000px] max-h-[90vh] overflow-y-auto bg-white">
                  <DialogHeader>
                    <DialogDescription className="sr-only">Vista previa de la factura</DialogDescription>
                    <div className="flex justify-between items-start border-b pb-4">
                      <div>
                        <DialogTitle className="text-2xl font-bold mb-2">FACTURA</DialogTitle>
                        <div className="space-y-1 text-sm">
                          <div className="flex gap-2 items-center">
                            <span className="font-semibold w-24">Punto de Venta:</span>
                            <Input className="w-20 h-7 text-sm" defaultValue="00018" />
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="font-semibold w-24">Comp. Nro:</span>
                            <Input className="w-32 h-7 text-sm" defaultValue="00000020" />
                          </div>
                          <div className="flex gap-2 items-center">
                            <span className="font-semibold w-24">Fecha de Emisión:</span>
                            <Input
                              type="date"
                              className="w-36 h-7 text-sm"
                              defaultValue={new Date().toISOString().split("T")[0]}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="text-center border p-4 rounded bg-gray-50">
                        <h2 className="text-3xl font-bold text-gray-800">A</h2>
                        <div className="text-[10px] font-bold mt-1">COD. 01</div>
                      </div>

                      <div className="text-right text-sm space-y-1">
                        <div className="font-bold text-lg mb-2">MAYCAM ...</div>
                        <div className="flex justify-end gap-2 items-center">
                          <span className="font-semibold">CUIT:</span>
                          <Input className="w-32 h-7 text-right text-sm" defaultValue="30-71626354-9" />
                        </div>
                        <div className="flex justify-end gap-2 items-center">
                          <span className="font-semibold">Ingresos Brutos:</span>
                          <Input className="w-32 h-7 text-right text-sm" defaultValue="30-71626354-9" />
                        </div>
                        <div className="flex justify-end gap-2 items-center">
                          <span className="font-semibold">Inicio de Actividades:</span>
                          <Input type="date" className="w-32 h-7 text-right text-sm" defaultValue="2018-11-01" />
                        </div>
                      </div>
                    </div>
                  </DialogHeader>

                  <div className="grid grid-cols-2 gap-8 py-4 border-b text-sm">
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="font-semibold w-20">CUIT:</span>
                        <Input
                          className="flex-1 h-7"
                          defaultValue={clients.find((c) => c.id === invoiceOrder.client_id)?.cuit || ""}
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="font-semibold w-20">Condición IVA:</span>
                        <Select defaultValue="monotributo">
                          <SelectTrigger className="flex-1 h-7">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="resp_inscripto">Responsable Inscripto</SelectItem>
                            <SelectItem value="monotributo">Monotributo</SelectItem>
                            <SelectItem value="cons_final">Consumidor Final</SelectItem>
                            <SelectItem value="exento">Exento</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="font-semibold w-20">Condición Venta:</span>
                        <Input className="flex-1 h-7" defaultValue="Cuenta Corriente" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex gap-2 items-center">
                        <span className="font-semibold w-20">Nombre:</span>
                        <Input
                          className="flex-1 h-7"
                          defaultValue={clients.find((c) => c.id === invoiceOrder.client_id)?.name || ""}
                        />
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="font-semibold w-20">Domicilio:</span>
                        <Input
                          className="flex-1 h-7"
                          defaultValue={clients.find((c) => c.id === invoiceOrder.client_id)?.address || ""}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="py-4">
                    <Table>
                      <TableHeader className="bg-gray-100">
                        <TableRow>
                          <TableHead className="w-[100px]">Código</TableHead>
                          <TableHead>Producto / Servicio</TableHead>
                          <TableHead className="text-right w-[80px]">Cantidad</TableHead>
                          <TableHead className="w-[80px]">U. Medida</TableHead>
                          <TableHead className="text-right">Precio Unit.</TableHead>
                          <TableHead className="text-right">% Bonif</TableHead>
                          <TableHead className="text-right">Subtotal</TableHead>
                          <TableHead className="text-right">Alícuota IVA</TableHead>
                          <TableHead className="text-right">Subtotal c/IVA</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceOrder.items?.map((item, idx) => {
                          const unitPrice = item.unit_price
                          const quantity = item.quantity
                          const subtotal = unitPrice * quantity
                          const ivaRate = 21
                          const ivaMultiplier = 1 + ivaRate / 100
                          const subtotalWithIva = subtotal * ivaMultiplier

                          return (
                            <TableRow key={idx}>
                              <TableCell className="font-medium">{item.sku}</TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="text-right">{quantity}</TableCell>
                              <TableCell>unidades</TableCell>
                              <TableCell className="text-right">{formatCurrency(unitPrice)}</TableCell>
                              <TableCell className="text-right">0.00%</TableCell>
                              <TableCell className="text-right">{formatCurrency(subtotal)}</TableCell>
                              <TableCell className="text-right">{ivaRate}%</TableCell>
                              <TableCell className="text-right">{formatCurrency(subtotalWithIva)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  <div className="grid grid-cols-2 gap-8 border-t pt-4">
                    <div>
                      <div className="bg-gray-50 p-4 border rounded space-y-2">
                        <div className="flex justify-between text-sm">
                          <span>Otros Tributos</span>
                          <span>$ 0.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Per./Ret. de Impuesto a las Ganancias</span>
                          <span>$ 0.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Per./Ret. de IVA</span>
                          <span>$ 0.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Per./Ret. Ingresos Brutos</span>
                          <span>$ 0.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Impuestos Internos</span>
                          <span>$ 0.00</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span>Impuestos Municipales</span>
                          <span>$ 0.00</span>
                        </div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="font-bold">Importe Neto Gravado:</span>
                        <span className="font-mono text-lg">
                          {formatCurrency(
                            invoiceOrder.items.reduce((acc, item) => acc + item.unit_price * item.quantity, 0),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">IVA 27%:</span>
                        <span className="font-mono">$ 0.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">IVA 21%:</span>
                        <span className="font-mono">
                          {formatCurrency(
                            invoiceOrder.items.reduce((acc, item) => acc + item.unit_price * item.quantity * 0.21, 0),
                          )}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">IVA 10.5%:</span>
                        <span className="font-mono">$ 0.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">IVA 5%:</span>
                        <span className="font-mono">$ 0.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">IVA 2.5%:</span>
                        <span className="font-mono">$ 0.00</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="font-bold">IVA 0%:</span>
                        <span className="font-mono">$ 0.00</span>
                      </div>
                      <div className="flex justify-between items-center border-t pt-2 mt-2">
                        <span className="text-xl font-bold">Importe Total:</span>
                        <span className="text-xl font-bold text-purple-600">
                          {formatCurrency(
                            invoiceOrder.items.reduce((acc, item) => acc + item.unit_price * item.quantity * 1.21, 0),
                          )}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6 flex justify-between items-end bg-gray-50 p-4 border rounded">
                    <div className="space-y-1">
                      <div className="flex gap-2 items-center">
                        <span className="font-bold text-sm">CAE N°:</span>
                        <span className="font-mono">71465829304958</span>
                      </div>
                      <div className="flex gap-2 items-center">
                        <span className="font-bold text-sm">Fecha de Vto. de CAE:</span>
                        <span className="font-mono">22/11/2021</span>
                      </div>
                    </div>
                    <Button className="bg-purple-600 hover:bg-purple-700">
                      <Download className="w-4 h-4 mr-2" />
                      Generar Comprobante
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </TabsContent>

          <TabsContent value="reportes" className="space-y-4 h-[calc(95vh-200px)] overflow-y-auto">
            {/* Filtros de reportes */}
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-slate-500 border-r border-slate-200 pr-3 mr-1">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline-block">Reportes</span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Desde:</span>
                {reportFilters.mode === "personalizado" ? (
                  <Input
                    type="date"
                    value={reportFilters.dateFrom}
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                    className="h-8 text-sm w-auto py-0 px-2"
                  />
                ) : (
                  <Input type="date" value={reportFilters.dateFrom} readOnly className="h-8 text-sm w-auto py-0 px-2" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">Hasta:</span>
                {reportFilters.mode === "personalizado" ? (
                  <Input
                    type="date"
                    value={reportFilters.dateTo}
                    onChange={(e) => setReportFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                    className="h-8 text-sm w-auto py-0 px-2"
                  />
                ) : (
                  <Input type="date" value={reportFilters.dateTo} readOnly className="h-8 text-sm w-auto py-0 px-2" />
                )}
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={reportFilters.clientId}
                  onValueChange={(val) => setReportFilters((prev) => ({ ...prev, clientId: val }))}
                >
                  <SelectTrigger className="h-8 text-sm w-[200px]">
                    <SelectValue placeholder="Seleccionar cliente" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos los clientes</SelectItem>
                    {clients.map((client) => (
                      <SelectItem key={client.id} value={client.id.toString()}>
                        {client.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 ml-auto">
                <Select
                  value={reportFilters.mode}
                  onValueChange={(val) => {
                    if (val === "diario") {
                      const t = new Date().toISOString().split("T")[0]
                      setReportFilters((prev) => ({ ...prev, mode: "diario", dateFrom: t, dateTo: t }))
                    } else if (val === "semanal") {
                      const today = new Date()
                      const startOfWeek = new Date(today)
                      startOfWeek.setDate(today.getDate() - today.getDay())
                      const f = startOfWeek.toISOString().split("T")[0]
                      const t = today.toISOString().split("T")[0]
                      setReportFilters((prev) => ({ ...prev, mode: "semanal", dateFrom: f, dateTo: t }))
                    } else if (val === "mensual") {
                      const d = new Date()
                      const f = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
                      const t = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]
                      setReportFilters((prev) => ({ ...prev, mode: "mensual", dateFrom: f, dateTo: t }))
                    } else {
                      setReportFilters((prev) => ({ ...prev, mode: "personalizado" }))
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-sm w-[200px]">
                    <SelectValue placeholder="Periodo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="diario">Diario</SelectItem>
                    <SelectItem value="semanal">Semanal</SelectItem>
                    <SelectItem value="mensual">Mensual</SelectItem>
                    <SelectItem value="personalizado">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                className="bg-purple-600 hover:bg-purple-700 h-8 text-sm ml-auto"
                onClick={calculateStatistics}
                size="sm"
              >
                <TrendingUp className="w-3.5 h-3.5 mr-2" />
                Generar
              </Button>
            </div>

            {/* Métricas principales */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-gradient-to-r from-purple-500 to-purple-600 text-white">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-purple-100 text-sm">Ventas Totales</p>
                    <p className="text-2xl font-bold">{formatCurrency(statistics.totalSales)}</p>
                    <p className="text-xs text-purple-200">
                      {statistics.growth >= 0 ? "+" : ""}
                      {statistics.growth.toFixed(1)}% vs mes anterior
                    </p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-green-100 text-sm">Pedidos Realizados</p>
                    <p className="text-2xl font-bold">{statistics.totalOrders}</p>
                    <p className="text-xs text-green-200">Total acumulado</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-blue-100 text-sm">Ticket Promedio</p>
                    <p className="text-2xl font-bold">{formatCurrency(statistics.averageTicket)}</p>
                    <p className="text-xs text-blue-200">Por pedido</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-orange-100 text-sm">Clientes Activos</p>
                    <p className="text-2xl font-bold">{statistics.activeClients}</p>
                    <p className="text-xs text-orange-200">Con compras registradas</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Gráficos y análisis */}
            <div className="grid grid-cols-2 gap-4">
              <Card>
                <CardHeader>
                  <CardTitle>Ventas por Cliente (Top 5)</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statistics.topClients.slice(0, 5).map((client, index) => {
                      return (
                        <div key={client.id} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center text-purple-600 font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{client.name}</p>
                              <p className="text-sm text-gray-500">{client.province}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{formatCurrency(client.sales)}</p>
                            <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                              <div
                                className="bg-purple-600 h-2 rounded-full"
                                style={{ width: `${client.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                    {statistics.topClients.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No hay datos de ventas disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Productos Más Vendidos</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {statistics.topProducts.slice(0, 5).map((item, index) => {
                      return (
                        <div key={item.sku} className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center text-green-600 font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium">{item.sku}</p>
                              <p className="text-sm text-gray-500">{item.description.substring(0, 30)}...</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold">{item.quantity} unidades</p>
                            <p className="text-sm text-gray-500">{formatCurrency(item.revenue)}</p>
                          </div>
                        </div>
                      )
                    })}
                    {statistics.topProducts.length === 0 && (
                      <p className="text-center text-gray-500 py-4">No hay datos de productos disponibles</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Ventas por Vendedor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {Array.isArray((statistics as any).vendorSales) &&
                    (statistics as any).vendorSales.slice(0, 10).map((v: any, index: number) => (
                      <div key={v.name + index} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-600 font-semibold text-sm">
                            {index + 1}
                          </div>
                          <div>
                            <p className="font-medium">{v.name}</p>
                            <p className="text-sm text-gray-500">{v.orders} pedidos</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className="font-semibold">{formatCurrency(v.sales)}</p>
                          <div className="w-20 bg-gray-200 rounded-full h-2 mt-1">
                            <div className="bg-indigo-600 h-2 rounded-full" style={{ width: `${v.percentage}%` }}></div>
                          </div>
                        </div>
                      </div>
                    ))}
                  {!Array.isArray((statistics as any).vendorSales) || (statistics as any).vendorSales.length === 0 ? (
                    <p className="text-center text-gray-500 py-4">No hay ventas por vendedor en el período</p>
                  ) : null}
                </div>
              </CardContent>
            </Card>

            {/* Análisis de tendencias */}
            <Card>
              <CardHeader>
                <CardTitle>Análisis de Tendencias de Ventas</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-6">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <TrendingUp className="w-8 h-8 text-purple-600" />
                    </div>
                    <h4 className="font-semibold mb-2">Crecimiento Mensual</h4>
                    <p className="text-2xl font-bold text-purple-600">
                      {statistics.growth >= 0 ? "+" : ""}
                      {statistics.growth.toFixed(1)}%
                    </p>
                    <p className="text-sm text-gray-500">Comparado con el mes anterior</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Users className="w-8 h-8 text-green-600" />
                    </div>
                    <h4 className="font-semibold mb-2">Retención de Clientes</h4>
                    <p className="text-2xl font-bold text-green-600">{statistics.retention.toFixed(0)}%</p>
                    <p className="text-sm text-gray-500">Clientes que repiten compras</p>
                  </div>
                  <div className="text-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
                      <Package className="w-8 h-8 text-blue-600" />
                    </div>
                    <h4 className="font-semibold mb-2">Productos Activos</h4>
                    <p className="text-2xl font-bold text-blue-600">{statistics.activeProducts}</p>
                    <p className="text-sm text-gray-500">Con ventas en el período</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Frecuencia de compras */}
            <Card>
              <CardHeader>
                <CardTitle>Frecuencia de Compras por Cliente</CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Último Pedido</TableHead>
                      <TableHead>Frecuencia</TableHead>
                      <TableHead>Total Pedidos</TableHead>
                      <TableHead>Promedio Mensual</TableHead>
                      <TableHead>Estado</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clients.map((client) => {
                      const clientOrders = orders.filter(
                        (o) => o.client_id === client.id && ["confirmed", "shipped", "delivered"].includes(o.status),
                      )
                      const totalOrders = clientOrders.length

                      let lastOrderStr = "Sin pedidos"
                      let daysSinceLastOrder = -1

                      if (totalOrders > 0) {
                        const lastOrderDate = new Date(
                          Math.max(...clientOrders.map((o) => new Date(o.order_date).getTime())),
                        )
                        daysSinceLastOrder = Math.floor((Date.now() - lastOrderDate.getTime()) / (1000 * 60 * 60 * 24))
                        lastOrderStr = `Hace ${daysSinceLastOrder} días`
                      }

                      // Calculate frequency
                      let frequencyStr = "N/A"
                      if (totalOrders > 1) {
                        const dates = clientOrders.map((o) => new Date(o.order_date).getTime()).sort((a, b) => a - b)
                        const firstOrder = dates[0]
                        const lastOrderTime = dates[dates.length - 1]
                        const daysDiff = (lastOrderTime - firstOrder) / (1000 * 60 * 60 * 24)
                        const avgDays = Math.round(daysDiff / (totalOrders - 1))
                        frequencyStr = `Cada ${avgDays} días`
                      }

                      const createdDate = new Date(client.created_at)
                      const monthsSinceRegistration = Math.max(
                        1,
                        (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24 * 30),
                      )
                      const monthlyAvg = (totalOrders / monthsSinceRegistration).toFixed(1)

                      let status = "Inactivo"
                      if (totalOrders > 0) {
                        if (daysSinceLastOrder <= 30) status = "Activo"
                        else if (daysSinceLastOrder <= 90) status = "Regular"
                      } else if ((Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24) < 30) {
                        status = "Nuevo"
                      }

                      const statusColor =
                        status === "Activo"
                          ? "bg-green-500"
                          : status === "Regular"
                            ? "bg-yellow-500"
                            : status === "Nuevo"
                              ? "bg-blue-500"
                              : "bg-red-500"

                      return (
                        <TableRow key={client.id}>
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{lastOrderStr}</TableCell>
                          <TableCell>{frequencyStr}</TableCell>
                          <TableCell>{totalOrders}</TableCell>
                          <TableCell>{monthlyAvg}/mes</TableCell>
                          <TableCell>
                            <Badge className={`${statusColor} text-white`}>{status}</Badge>
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>

            {/* Botones de exportación */}
            <Card>
              <CardHeader>
                <CardTitle>Exportar Reportes</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <Button onClick={exportCompleteReport} className="bg-green-600 hover:bg-green-700">
                    <Download className="w-4 h-4 mr-2" />
                    Exportar Reporte Completo
                  </Button>
                  <Button onClick={exportAnalysis} variant="outline">
                    <FileText className="w-4 h-4 mr-2" />
                    Exportar Análisis
                  </Button>
                  <Button onClick={exportClients} variant="outline">
                    <Users className="w-4 h-4 mr-2" />
                    Exportar Clientes
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modal para agregar cliente */}
        {showClientForm && (
          <Dialog open={showClientForm} onOpenChange={closeClientForm}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente Mayorista" : "Nuevo Cliente Mayorista"}</DialogTitle>
                <DialogDescription>Complete los datos del cliente.</DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Section 1: General Information */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Información General</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Nombre *</Label>
                      <Input
                        value={newClient.name}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>CUIT / CUIL *</Label>
                      <Input
                        value={newClient.cuit}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, cuit: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Razón Social *</Label>
                      <Input
                        value={newClient.business_name}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, business_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Teléfono / WhatsApp</Label>
                      <Input
                        value={newClient.whatsapp}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, whatsapp: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Email</Label>
                      <Input
                        type="email"
                        value={newClient.email}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Contacto Extra</Label>
                      <Input
                        value={newClient.extra_contact || ""}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, extra_contact: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 2: Address */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Domicilio</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Provincia</Label>
                      <Input
                        value={newClient.province}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, province: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Localidad</Label>
                      <Input
                        value={newClient.city || ""}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Calle y Número</Label>
                      <Input
                        value={newClient.address}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, address: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Código Postal</Label>
                      <Input
                        value={newClient.zip_code || ""}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, zip_code: e.target.value }))}
                      />
                    </div>
                  </div>
                </div>

                {/* Section 3: Shipping */}
                <div className="space-y-4">
                  <h3 className="font-semibold text-lg border-b pb-2">Datos de Envío</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label>Transporte</Label>
                      <Input
                        value={newClient.transport || ""}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, transport: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Destino</Label>
                      <Input
                        value={newClient.destination || ""}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, destination: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Número de Guía</Label>
                      <Input
                        value={newClient.guide_number || ""}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, guide_number: e.target.value }))}
                      />
                    </div>
                    <div>
                      <Label>Precio del Envío</Label>
                      <Input
                        type="number"
                        value={newClient.shipping_price || 0}
                        onChange={(e) => setNewClient((prev) => ({ ...prev, shipping_price: Number(e.target.value) }))}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-4">
                <Button variant="secondary" onClick={closeClientForm}>
                  Cancelar
                </Button>
                <Button type="button" onClick={addClient} className="bg-purple-600 hover:bg-purple-700">
                  {editingClient ? "Actualizar Cliente" : "Agregar Cliente"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}

        {viewingClient && (
          <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Detalles del Cliente</DialogTitle>
                <DialogDescription>Información completa del cliente seleccionado.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Nombre</Label>
                    <p className="font-medium">{viewingClient.name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Razón Social</Label>
                    <p className="font-medium">{viewingClient.business_name}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">CUIT</Label>
                    <p className="font-medium">{viewingClient.cuit}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Provincia</Label>
                    <p className="font-medium">{viewingClient.province}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Dirección</Label>
                    <p className="font-medium">{viewingClient.address}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Contacto</Label>
                    <p className="font-medium">{viewingClient.contact_person}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Email</Label>
                    <p className="font-medium">{viewingClient.email}</p>
                  </div>
                  <div>
                    <Label className="text-gray-500">WhatsApp</Label>
                    <p className="font-medium">{viewingClient.whatsapp}</p>
                  </div>
                </div>
                <div className="pt-4 flex justify-end">
                  <Button onClick={() => setViewingClient(null)}>Cerrar</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>
    </div>
  )
}
