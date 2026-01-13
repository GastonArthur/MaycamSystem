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
  Settings,
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
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
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
}

type WholesaleOrder = {
  id: number
  client_id: number
  order_date: string
  status: "pending" | "confirmed" | "shipped" | "delivered" | "cancelled"
  is_paid: boolean
  total_amount: number
  items: WholesaleOrderItem[]
  notes: string
  vendor?: string
  created_at: string
  client?: WholesaleClient
}

type WholesaleOrderItem = {
  id: number
  order_id: number
  sku: string
  description: string
  quantity: number
  unit_price: number
  total_price: number
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

export function MayoristasManagement({ inventory, suppliers, brands }: MayoristasManagementProps) {
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
  const [orderNotes, setOrderNotes] = useState("")
  const [orderVendor, setOrderVendor] = useState("")
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split("T")[0])
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
    vendorSales: [] as { name: string; sales: number; orders: number; percentage: number }[],
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
        .order("name")

      if (clientsError) throw clientsError
      setClients(clientsData || [])

      // Fetch orders
      const { data: ordersData, error: ordersError } = await supabase
        .from("wholesale_orders")
        .select("*, items:wholesale_order_items(*)")
        .order("created_at", { ascending: false })

      if (ordersError) throw ordersError
      setOrders(ordersData || [])

      // Fetch vendors from API (to bypass RLS issues)
      try {
        const vendorsRes = await fetch("/api/wholesale/vendors")
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

    const newItem: WholesaleOrderItem = {
      id: Date.now(),
      order_id: 0,
      sku: currentSku,
      description: currentDescription,
      quantity: currentQuantity,
      unit_price: currentUnitPrice,
      total_price: currentUnitPrice * currentQuantity,
    }

    setOrderItems((prev) => [...prev, newItem])
    setCurrentSku("")
    setCurrentDescription("")
    setCurrentUnitPrice(0)
    setCurrentQuantity(1)
  }

  // Auto-fill details when SKU exists in inventory
  useEffect(() => {
    if (!currentSku) return

    const item = inventory.find((i) => i.sku === currentSku)
    if (item) {
      setCurrentDescription(item.description)
      // Default to price list 1
      setCurrentUnitPrice(item.cost_without_tax * (1 + wholesaleConfig.percentage_1 / 100))
    }
  }, [currentSku, inventory, wholesaleConfig])

  const removeItemFromOrder = (id: number) => {
    setOrderItems((prev) => prev.filter((item) => item.id !== id))
  }

  const createOrder = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault()

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

    const totalAmount = orderItems.reduce((sum, item) => sum + item.total_price, 0)
    const clientId = Number.parseInt(selectedClient)

    try {
      if (isSupabaseConfigured) {
        const user = getCurrentUser()
        const userId = user?.id || null

        if (editingOrder) {
          // Update order
          const { error: orderError } = await supabase
            .from("wholesale_orders")
            .update({
              client_id: clientId,
              total_amount: totalAmount,
              notes: orderNotes,
              order_date: orderDate,
              vendor: orderVendor || null,
            })
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
          }))

          const { error: itemsError } = await supabase.from("wholesale_order_items").insert(itemsToInsert)

          if (itemsError) throw itemsError

          toast({
            title: "Pedido actualizado",
            description: "El pedido se ha actualizado correctamente",
          })
        } else {
          // Create order
          const { data: orderData, error: orderError } = await supabase
            .from("wholesale_orders")
            .insert([
              {
                client_id: clientId,
                order_date: orderDate,
                status: "pending",
                total_amount: totalAmount,
                notes: orderNotes,
                created_by: userId,
                vendor: orderVendor || null,
              },
            ])
            .select()
            .single()

          if (orderError) throw orderError

          const itemsToInsert = orderItems.map((item) => ({
            order_id: orderData.id,
            sku: item.sku,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: item.total_price,
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
            total_amount: totalAmount,
            items: orderItems,
            notes: orderNotes,
            vendor: orderVendor || undefined,
            order_date: orderDate,
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
            is_paid: false,
            total_amount: totalAmount,
            items: orderItems,
            notes: orderNotes,
            vendor: orderVendor || undefined,
            created_at: new Date().toISOString(),
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

  const exportToPDF = (order: WholesaleOrder) => {
    const client = clients.find((c) => c.id === order.client_id)
    const clientName = client?.name || "Cliente desconocido"
    const clientCuit = client?.cuit || ""

    const sanitizeFilePart = (value: string) =>
      value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .replace(/\s+/g, "_")
        .replace(/[^A-Za-z0-9_-]/g, "")

    const toPdfText = (value: string) => value.replace(/\s+/g, " ").trim()

    const escapePdfString = (value: string) =>
      toPdfText(value).replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)")

    const wrapText = (text: string, maxChars: number) => {
      const clean = toPdfText(text)
      if (!clean) return [""]
      const words = clean.split(/\s+/g)
      const lines: string[] = []
      let current = ""
      for (const word of words) {
        const next = current ? `${current} ${word}` : word
        if (next.length <= maxChars) {
          current = next
          continue
        }
        if (current) lines.push(current)
        if (word.length > maxChars) {
          let start = 0
          while (start < word.length) {
            lines.push(word.slice(start, start + maxChars))
            start += maxChars
          }
          current = ""
        } else {
          current = word
        }
      }
      if (current) lines.push(current)
      return lines.length ? lines : [""]
    }

    const encodeLatin1 = (input: string) => {
      const bytes = new Uint8Array(input.length)
      for (let i = 0; i < input.length; i++) {
        const code = input.charCodeAt(i)
        bytes[i] = code <= 0xff ? code : 63
      }
      return bytes
    }

    const byteLengthLatin1 = (input: string) => encodeLatin1(input).length

    const pageWidth = 595
    const pageHeight = 842
    const marginLeft = 20
    const marginRight = 20
    const marginTop = 40
    const marginBottom = 40
    const contentWidth = pageWidth - marginLeft - marginRight

    const drawLine = (x1: number, y1: number, x2: number, y2: number, width: number = 0.5) =>
      `${width} w ${x1} ${y1} m ${x2} ${y2} l S\n`

    const drawRect = (x: number, y: number, width: number, height: number, color: string, fill: boolean = true) =>
      fill ? `${color} rg ${x} ${y} ${width} ${height} re f\n` : `${color} RG 1 w ${x} ${y} ${width} ${height} re S\n`

    const pushText = (
      parts: string[],
      x: number,
      y: number,
      font: "F1" | "F2",
      size: number,
      color: string = "0 0 0",
      align: "left" | "center" | "right" = "left",
    ) => {
      const colorCmd = `${color} rg\n`
      let result = ""
      parts.forEach((text, index) => {
        const safeText = escapePdfString(text)
        const charWidth = size * 0.55
        const textWidth = safeText.length * charWidth

        let textX = x
        if (align === "center") textX = x - textWidth / 2
        if (align === "right") textX = x - textWidth

        result += `BT ${colorCmd}/${font} ${size} Tf 1 0 0 1 ${textX} ${y - index * size * 1.2} Tm (${safeText}) Tj ET\n`
      })
      return result
    }

    const cols = [
      { name: "SKU", x: marginLeft, width: 80, align: "left" as const },
      { name: "Producto/s", x: marginLeft + 80, width: 315, align: "left" as const },
      { name: "Cantidad", x: marginLeft + 395, width: 80, align: "right" as const },
      { name: "U. medida", x: marginLeft + 475, width: 80, align: "center" as const },
    ]

    const pages: string[] = []
    const addPage = (content: string) => pages.push(content)

    let currentPageContent = ""
    let y = pageHeight - marginTop

    const drawHeaderAndTableHeader = () => {
      const orderDate = order.order_date
        ? new Date(order.order_date).toLocaleDateString("es-AR")
        : new Date(order.created_at).toLocaleDateString("es-AR")

      currentPageContent += pushText(["Maycam Games"], marginLeft, y, "F2", 16)
      currentPageContent += pushText([`Pedido N°: ${order.id}`], pageWidth - marginRight, y, "F2", 10, "0 0 0", "right")
      y -= 22
      currentPageContent += pushText([`Fecha: ${orderDate}`], pageWidth - marginRight, y, "F1", 9, "0 0 0", "right")
      currentPageContent += pushText([`Apellido y Nombre: ${clientName}`], marginLeft, y, "F1", 10)
      y -= 14
      currentPageContent += pushText([`CUIT / DNI: ${clientCuit}`], marginLeft, y, "F1", 10)
      y -= 22

      const tableTop = y
      const tableHeaderHeight = 20
      currentPageContent += drawRect(marginLeft, tableTop - tableHeaderHeight, contentWidth, tableHeaderHeight, "0.9 0.9 0.9", true)
      currentPageContent += drawRect(marginLeft, tableTop - tableHeaderHeight, contentWidth, tableHeaderHeight, "0 0 0", false)

      cols.forEach((col) => {
        let drawX = col.x + 2
        if (col.align === "right") drawX = col.x + col.width - 2
        if (col.align === "center") drawX = col.x + col.width / 2
        currentPageContent += pushText([col.name], drawX, tableTop - 14, "F2", 8, "0 0 0", col.align)
        if (col.x !== marginLeft) {
          currentPageContent += drawLine(col.x, tableTop, col.x, tableTop - tableHeaderHeight)
        }
      })

      y = tableTop - tableHeaderHeight - 6
    }

    const startNewPage = () => {
      if (currentPageContent) addPage(currentPageContent)
      currentPageContent = ""
      y = pageHeight - marginTop
      drawHeaderAndTableHeader()
    }

    const ensureSpace = (neededHeight: number) => {
      if (y - neededHeight < marginBottom + 20) startNewPage()
    }

    drawHeaderAndTableHeader()

    const items = (order.items || []).filter((item) => item.sku !== "ENVIO")

    for (const item of items) {
      const fallbackProduct = item.product_id ? products.find((p) => p.id === item.product_id) : undefined
      const sku = item.sku || fallbackProduct?.sku || ""
      const description = item.description || fallbackProduct?.name || ""
      const qty = Number(item.quantity ?? 0)
      const nameLines = wrapText(description, 52)
      const rowHeight = Math.max(nameLines.length * 10, 12) + 6

      ensureSpace(rowHeight)

      const textY = y - 10

      currentPageContent += pushText([sku], cols[0].x + 2, textY, "F1", 8)

      for (let i = 0; i < nameLines.length; i++) {
        currentPageContent += pushText([nameLines[i]], cols[1].x + 2, textY - i * 10, "F1", 8)
      }

      currentPageContent += pushText([toPdfText(String(qty))], cols[2].x + cols[2].width - 2, textY, "F1", 8, "0 0 0", "right")
      currentPageContent += pushText(["unidades"], cols[3].x + cols[3].width / 2, textY, "F1", 8, "0 0 0", "center")

      y -= rowHeight
    }

    addPage(currentPageContent)

    const buildPdf = (pageContents: string[]) => {
      type PdfObj = { id: number; body: string }
      const objects: PdfObj[] = []
      const addObject = (body: string) => {
        const id = objects.length + 1
        objects.push({ id, body })
        return id
      }

      const fontRegularId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
      const fontBoldId = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>")

      const pageObjectIds: number[] = []
      const pagesIdPlaceholder = addObject("<< >>")

      for (let i = 0; i < pageContents.length; i++) {
        const pageNo = i + 1
        const totalPages = pageContents.length
        const footer = pushText([`Página ${pageNo} de ${totalPages}`], marginLeft, 34, "F1", 9)
        const fullContent = `${pageContents[i]}${footer}`
        const contentBytesLength = byteLengthLatin1(fullContent)
        const contentId = addObject(`<< /Length ${contentBytesLength} >>\nstream\n${fullContent}endstream`)

        const pageId = addObject(
          `<< /Type /Page /Parent ${pagesIdPlaceholder} 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R >> >> /Contents ${contentId} 0 R >>`,
        )
        pageObjectIds.push(pageId)
      }

      const kids = pageObjectIds.map((id) => `${id} 0 R`).join(" ")
      objects[pagesIdPlaceholder - 1].body = `<< /Type /Pages /Kids [${kids}] /Count ${pageObjectIds.length} >>`

      const catalogId = addObject(`<< /Type /Catalog /Pages ${pagesIdPlaceholder} 0 R >>`)

      const header = "%PDF-1.4\n%\u00e2\u00e3\u00cf\u00d3\n"
      const chunks: string[] = [header]
      const offsets: number[] = [0]

      let byteOffset = byteLengthLatin1(header)

      for (const obj of objects) {
        offsets[obj.id] = byteOffset
        const chunk = `${obj.id} 0 obj\n${obj.body}\nendobj\n`
        chunks.push(chunk)
        byteOffset += byteLengthLatin1(chunk)
      }

      const xrefStart = byteOffset
      const xrefLines: string[] = []
      xrefLines.push("xref\n")
      xrefLines.push(`0 ${objects.length + 1}\n`)
      xrefLines.push("0000000000 65535 f \n")
      for (let i = 1; i <= objects.length; i++) {
        const off = offsets[i] || 0
        xrefLines.push(`${String(off).padStart(10, "0")} 00000 n \n`)
      }

      const trailer =
        `trailer\n<< /Size ${objects.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`
      chunks.push(xrefLines.join(""))
      chunks.push(trailer)

      return new Blob(chunks.map((c) => encodeLatin1(c)), { type: "application/pdf" })
    }

    const pdfBlob = buildPdf(pages)
    const url = URL.createObjectURL(pdfBlob)

    const a = document.createElement("a")
    a.href = url
    a.download = `Pedido_${order.id}_${sanitizeFilePart(clientName)}.pdf`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)

    toast({ title: "Exportación completada", description: `Se exportó el pedido #${order.id}` })
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
        {/* Cabecera actualizada con fondo más claro y descripción */}
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-purple-800">
              <ShoppingCart className="w-5 h-5 text-purple-600" />
              Mayoristas
            </CardTitle>
            <CardDescription>Gestión completa de ventas mayoristas, precios y clientes</CardDescription>
          </CardHeader>
        </Card>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="precios" className="flex items-center gap-2">
              <Package className="w-4 h-4" />
              Precios
            </TabsTrigger>
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

          <TabsContent value="precios" className="space-y-4 h-[calc(95vh-200px)] overflow-y-auto">
            {/* Configuración de porcentajes */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="w-5 h-5" />
                  Configuración de Precios
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label>Precio Nivel 1 (%)</Label>
                    <Input
                      type="number"
                      value={wholesaleConfig.percentage_1}
                      onChange={(e) =>
                        setWholesaleConfig((prev) => ({
                          ...prev,
                          percentage_1: Number(e.target.value),
                        }))
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label>Precio Nivel 2 (%)</Label>
                    <Input
                      type="number"
                      value={wholesaleConfig.percentage_2}
                      onChange={(e) =>
                        setWholesaleConfig((prev) => ({
                          ...prev,
                          percentage_2: Number(e.target.value),
                        }))
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                  <div>
                    <Label>Precio Nivel 3 (%)</Label>
                    <Input
                      type="number"
                      value={wholesaleConfig.percentage_3}
                      onChange={(e) =>
                        setWholesaleConfig((prev) => ({
                          ...prev,
                          percentage_3: Number(e.target.value),
                        }))
                      }
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                {!isReadOnly && (
                  <Button
                    type="button"
                    onClick={() => updateWholesaleConfig(wholesaleConfig)}
                    className="mt-4 bg-purple-600 hover:bg-purple-700"
                  >
                    Guardar Configuración
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Filtros */}
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-slate-500 border-r border-slate-200 pr-3 mr-1">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline-block">Filtros</span>
              </div>

              <div className="flex items-center gap-2">
                <Select value={itemsPerPage.toString()} onValueChange={(value) => setItemsPerPage(Number(value))}>
                  <SelectTrigger className="h-8 text-sm w-[80px]">
                    <SelectValue placeholder="50" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="200">200</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 flex-1 min-w-[200px] max-w-sm">
                <Input
                  placeholder="Buscar por SKU o descripción..."
                  value={priceFilters.search}
                  onChange={(e) =>
                    setPriceFilters((prev) => ({
                      ...prev,
                      search: e.target.value,
                    }))
                  }
                  className="h-8 text-sm"
                />
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={priceFilters.brand}
                  onValueChange={(value) =>
                    setPriceFilters((prev) => ({
                      ...prev,
                      brand: value,
                    }))
                  }
                >
                  <SelectTrigger className="h-8 text-sm w-[180px]">
                    <SelectValue placeholder="Todas las marcas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las marcas</SelectItem>
                    {brands.map((brand) => (
                      <SelectItem key={brand.id} value={brand.id.toString()}>
                        {brand.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Button
                variant={priceFilters.showNewOnly ? "default" : "outline"}
                onClick={() =>
                  setPriceFilters((prev) => ({
                    ...prev,
                    showNewOnly: !prev.showNewOnly,
                  }))
                }
                className="h-8 text-sm whitespace-nowrap"
                size="sm"
              >
                {priceFilters.showNewOnly ? "✓ Solo NUEVOS" : "Solo NUEVOS"}
              </Button>
            </div>

            {/* Estadísticas */}
            <div className="grid grid-cols-4 gap-4">
              <Card className="bg-purple-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-purple-600 text-sm">Total Productos</p>
                    <p className="text-2xl font-bold text-purple-800">{totalProducts}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-yellow-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-yellow-600 text-sm">Productos NUEVOS</p>
                    <p className="text-2xl font-bold text-yellow-800">{newProducts}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-green-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-green-600 text-sm">Marcas</p>
                    <p className="text-2xl font-bold text-green-800">{Object.keys(groupedByBrandForStats).length}</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-blue-50">
                <CardContent className="p-4">
                  <div className="text-center">
                    <p className="text-blue-600 text-sm">Clientes</p>
                    <p className="text-2xl font-bold text-blue-800">{clients.length}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de precios agrupada por marca */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Lista de Precios Mayoristas</CardTitle>
                <Button onClick={exportWholesalePrices} className="bg-purple-600 hover:bg-purple-700 h-8">
                  <Download className="w-4 h-4 mr-2" />
                  Exportar
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="p-4 bg-slate-50 border-b flex justify-between items-center text-sm text-slate-500">
                  <div>
                    Mostrando {filteredItems.length > 0 ? startIndex + 1 : 0} a{" "}
                    {Math.min(endIndex, filteredItems.length)} de {filteredItems.length} productos
                  </div>
                </div>
                <ScrollArea className="h-[400px]">
                  {Object.entries(groupedCurrentItems).map(([brandName, products]) => (
                    <div key={brandName} className="mb-6">
                      <div className="bg-purple-100 px-4 py-2 font-semibold text-purple-800 sticky top-0 z-10">
                        {brandName} ({products.length} productos en esta página)
                      </div>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>SKU</TableHead>
                            <TableHead>Nombre</TableHead>
                            <TableHead className="hidden md:table-cell">Costo Base</TableHead>
                            <TableHead>Precio {wholesaleConfig.percentage_1}%</TableHead>
                            <TableHead className="hidden md:table-cell">
                              Precio {wholesaleConfig.percentage_2}%
                            </TableHead>
                            <TableHead className="hidden md:table-cell">
                              Precio {wholesaleConfig.percentage_3}%
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {products.map((item) => (
                            <TableRow key={item.id}>
                              <TableCell className="font-medium">{item.sku}</TableCell>
                              <TableCell>{item.description}</TableCell>
                              <TableCell className="hidden md:table-cell">
                                {formatCurrency(item.cost_without_tax)}
                              </TableCell>
                              <TableCell className="font-medium text-green-600">
                                {formatCurrency(item.wholesale_price_1)}
                              </TableCell>
                              <TableCell className="font-medium text-blue-600 hidden md:table-cell">
                                {formatCurrency(item.wholesale_price_2)}
                              </TableCell>
                              <TableCell className="font-medium text-purple-600 hidden md:table-cell">
                                {formatCurrency(item.wholesale_price_3)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ))}
                  {filteredItems.length === 0 && (
                    <div className="text-center py-8 text-gray-500">No se encontraron productos</div>
                  )}
                </ScrollArea>

                {/* Controles de Paginación */}
                <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
                  <div className="text-sm text-slate-500">
                    Página {currentPage} de {totalPages || 1}
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
          </TabsContent>

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
                <div className="overflow-x-auto">
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

            {/* Filtros exhaustivos para pedidos */}
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
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nº</TableHead>
                        <TableHead className="hidden md:table-cell">Fecha</TableHead>
                        <TableHead>Cliente</TableHead>
                        {/* Columna Vendedor añadida */}
                        <TableHead>Vendedor</TableHead>
                        <TableHead>Estado</TableHead>
                        <TableHead>Pagado</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="hidden md:table-cell">Notas</TableHead>
                        <TableHead className="hidden md:table-cell">Items</TableHead>
                        <TableHead>Acciones</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders
                        // Aplicar filtros a los pedidos
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
                        .map((order, idx) => {
                          const clientName =
                            clients.find((c) => c.id === order.client_id)?.name || "Cliente desconocido"
                          const hasMultipleItems = (order.items?.length || 0) > 1

                          return (
                            <>
                              <TableRow key={order.id}>
                                <TableCell className="font-medium">#{idx + 1}</TableCell>
                                <TableCell className="hidden md:table-cell">{formatDate(order.order_date)}</TableCell>
                                <TableCell>{clientName}</TableCell>
                                {/* Mostrar nombre del vendedor */}
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
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => editOrder(order)}
                                        title="Editar pedido"
                                      >
                                        <Edit className="w-3 h-3" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => exportToPDF(order)}
                                        title="Exportar pedido"
                                        className="text-blue-600 hover:text-blue-700"
                                      >
                                        <FileText className="w-3 h-3" />
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
                                  <TableCell colSpan={10} className="p-4">
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
                        })}
                      {orders.filter((order) => {
                        const clientName = clients.find((c) => c.id === order.client_id)?.name || ""
                        const matchesClient =
                          orderFilters.cliente === "all" ||
                          clientName.toLowerCase().includes(orderFilters.cliente.toLowerCase())
                        const matchesVendor = orderFilters.vendedor === "all" || order.vendor === orderFilters.vendedor
                        const matchesEstado = orderFilters.estado === "all" || order.status === orderFilters.estado
                        const matchesFechaInicio =
                          !orderFilters.fechaInicio || order.order_date >= orderFilters.fechaInicio
                        const matchesFechaFin = !orderFilters.fechaFin || order.order_date <= orderFilters.fechaFin

                        return matchesClient && matchesVendor && matchesEstado && matchesFechaInicio && matchesFechaFin
                      }).length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                            No hay pedidos registrados que coincidan con los filtros
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
                  }
                }}
              >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>{editingOrder ? "Editar Pedido Mayorista" : "Nuevo Pedido Mayorista"}</DialogTitle>
                    <DialogDescription>Complete los datos y confirme para guardar el pedido.</DialogDescription>
                  </DialogHeader>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label>Cliente</Label>
                        <div className="flex gap-2">
                          <Select value={selectedClient} onValueChange={setSelectedClient}>
                            <SelectTrigger className="flex-1">
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
                            onClick={() => setShowClientForm(true)}
                            title="Nuevo Cliente"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label>Fecha del Pedido</Label>
                        <Input type="date" value={orderDate} onChange={(e) => setOrderDate(e.target.value)} />
                      </div>

                      <div>
                        <Label>Vendedor</Label>
                        <div className="flex gap-2">
                          <Select value={orderVendor} onValueChange={setOrderVendor}>
                            <SelectTrigger className="flex-1">
                              <SelectValue placeholder="Seleccionar vendedor" />
                            </SelectTrigger>
                            <SelectContent>
                              {vendors.map((v) => (
                                <SelectItem key={v.id} value={v.name}>
                                  {v.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={() => setActiveTab("vendedores")}
                            title="Nuevo Vendedor"
                          >
                            <Plus className="w-4 h-4" />
                          </Button>
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
                                onChange={(e) => {
                                  const val = e.target.value
                                  setCurrentSku(val)
                                  const item = inventory.find((i) => i.sku === val)
                                  if (item) {
                                    setCurrentDescription(item.description)
                                    setCurrentUnitPrice(
                                      item.cost_without_tax * (1 + wholesaleConfig.percentage_1 / 100),
                                    )
                                  }
                                }}
                                placeholder="SKU"
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") addItemToOrder()
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

                          <Button
                            type="button"
                            onClick={addItemToOrder}
                            className="w-full bg-purple-600 hover:bg-purple-700"
                          >
                            <Plus className="w-4 h-4 mr-2" /> Agregar al Pedido
                          </Button>
                        </div>
                      </div>

                      <div>
                        <Label>Notas</Label>
                        <Textarea
                          value={orderNotes}
                          onChange={(e) => setOrderNotes(e.target.value)}
                          placeholder="Observaciones sobre el pedido..."
                        />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Items del Pedido</h4>
                      <ScrollArea className="h-[300px] border rounded-md p-2">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>SKU</TableHead>
                              <TableHead>Cant.</TableHead>
                              <TableHead>Total</TableHead>
                              <TableHead></TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {orderItems.map((item) => (
                              <TableRow key={item.id}>
                                <TableCell className="font-medium">{item.sku}</TableCell>
                                <TableCell>{item.quantity}</TableCell>
                                <TableCell>{formatCurrency(item.total_price)}</TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="sm" onClick={() => removeItemFromOrder(item.id)}>
                                    <Trash2 className="w-3 h-3 text-red-500" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                            {orderItems.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-gray-500 py-8">
                                  Agregue productos al pedido
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </ScrollArea>

                      <div className="flex justify-between items-center text-lg font-bold p-4 bg-purple-50 rounded-md">
                        <span>Total:</span>
                        <span>${orderItems.reduce((sum, item) => sum + item.total_price, 0).toFixed(2)}</span>
                      </div>

                      <div className="flex gap-2 justify-end">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setShowOrderForm(false)
                            setEditingOrder(null)
                            setOrderItems([])
                            setSelectedClient("")
                            setOrderNotes("")
                          }}
                        >
                          Cancelar
                        </Button>
                        <Button type="button" onClick={createOrder} className="bg-purple-600 hover:bg-purple-700">
                          {editingOrder ? "Actualizar Pedido" : "Confirmar Pedido"}
                        </Button>
                      </div>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            )}
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
                            body: JSON.stringify({ name: newVendor.trim() }),
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

          <TabsContent value="reportes" className="space-y-4 h-[calc(95vh-200px)] overflow-y-auto">
            {/* Filtros de reportes */}
            <div className="bg-white p-2 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center gap-3 mb-4">
              <div className="flex items-center gap-2 text-slate-500 border-r border-slate-200 pr-3 mr-1">
                <Filter className="w-4 h-4" />
                <span className="text-sm font-medium hidden sm:inline-block">Reportes</span>
              </div>

              <div className="flex items-center gap-2">
                <Select
                  value={reportFilters.mode}
                  onValueChange={(val) => {
                    if (val === "diario") {
                      const t = new Date().toISOString().split("T")[0]
                      setReportFilters((prev) => ({ ...prev, mode: "diario", dateFrom: t, dateTo: t }))
                    } else if (val === "semanal") {
                      const today = new Date()
                      const startOfWeek = new Date(today)
                      startOfWeek.setDate(today.getDay() === 0 ? today.getDate() - 6 : today.getDate() - today.getDay())
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
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Editar Cliente Mayorista" : "Nuevo Cliente Mayorista"}</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Nombre *</Label>
                  <Input
                    value={newClient.name}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, name: e.target.value }))}
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
                  <Label>CUIT *</Label>
                  <Input
                    value={newClient.cuit}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, cuit: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Provincia</Label>
                  <Input
                    value={newClient.province}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, province: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Dirección</Label>
                  <Input
                    value={newClient.address}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, address: e.target.value }))}
                  />
                </div>
                {/* <div>
                  <Label>Ciudad</Label>
                  <Input
                    value={newClient.city || ""}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, city: e.target.value }))}
                  />
                </div> */}
                <div>
                  <Label>Persona de Contacto</Label>
                  <Input
                    value={newClient.contact_person}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, contact_person: e.target.value }))}
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
                  <Label>WhatsApp</Label>
                  <Input
                    value={newClient.whatsapp}
                    onChange={(e) => setNewClient((prev) => ({ ...prev, whatsapp: e.target.value }))}
                  />
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
