"use client"

import React, { useState, useEffect } from "react"
import { checkSession } from "@/lib/auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import { 
  TrendingUp, 
  DollarSign, 
  Package, 
  ShoppingCart, 
  Settings, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  BarChart3,
  Calendar as CalendarIcon,
  Filter,
  Download,
  Database
} from "lucide-react"
import { formatCurrency } from "@/lib/utils"
import { toast } from "@/hooks/use-toast"
import { useRouter } from "next/navigation"
import { logout } from "@/lib/auth"

export default function RentabilidadPage() {
  const [activeTab, setActiveTab] = useState("summary")
  const [accounts, setAccounts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [fullSyncing, setFullSyncing] = useState(false)
  const [setupMode, setSetupMode] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [newAccount, setNewAccount] = useState({
    name: "",
    seller_id: "",
    refresh_token: ""
  })
  
  // Sales State
  const [sales, setSales] = useState<any[]>([])
  const [filteredSales, setFilteredSales] = useState<any[]>([])
  
  // Stock State
  const [stock, setStock] = useState<any[]>([])
  
  // Products State
  const [products, setProducts] = useState<any[]>([])

  // Filters
  const [accountFilter, setAccountFilter] = useState("all")
  const [dateFilter, setDateFilter] = useState("month") // today, week, month, custom
  const [dateRange, setDateRange] = useState<{from: Date | undefined, to: Date | undefined}>({
    from: new Date(new Date().setDate(new Date().getDate() - 30)),
    to: new Date()
  })

  const [dbStatus, setDbStatus] = useState<Record<string, boolean> | null>(null)
  const [dbReady, setDbReady] = useState(false)

  // Sidebar State (Dummy to satisfy interface)
  const [sidebarActiveTab, setSidebarActiveTab] = useState("rentabilidad")
  const [showWholesale, setShowWholesale] = useState(false)
  const [showRetail, setShowRetail] = useState(false)
  const [showGastos, setShowGastos] = useState(false)
  const [showClients, setShowClients] = useState(false)
  const [userEmail, setUserEmail] = useState("Usuario")

  useEffect(() => {
    const initSession = async () => {
      const user = await checkSession()
      if (user) {
        setUserEmail(user.email)
      }
    }
    initSession()
  }, [])
  // Redirect to main app for other tabs (client-side, sin recarga completa)
  const router = useRouter()
  const handleSidebarNavigation = (tab: string) => {
    router.push(`/?tab=${tab}`)
  }
  
  const handleShowWholesale = (val: boolean) => {
    if (val) router.push("/?section=wholesale")
  }

  const handleShowRetail = (val: boolean) => {
    if (val) router.push("/?section=retail")
  }

  const handleShowGastos = (val: boolean) => {
    if (val) router.push("/?section=gastos")
  }

  const handleShowClients = (val: boolean) => {
    if (val) router.push("/?section=clients")
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  useEffect(() => {
    if (activeTab === "sales" || activeTab === "summary") {
      fetchSales()
    }
    if (activeTab === "stock") {
      fetchStock()
    }
    if (activeTab === "products") {
      fetchProducts()
    }
  }, [activeTab, accounts]) // Refetch when accounts load or tab changes

  useEffect(() => {
    applyFilters()
  }, [sales, accountFilter, dateFilter, dateRange])

  const fetchProducts = async () => {
    if (!supabase) return
    try {
      setLoading(true)
      // 1. Get Inventory
      const { data: inventory, error: invError } = await supabase.from("inventory").select("*")
      // If inventory table doesn't exist or error, we might want to handle it, but for now just log
      if (invError) console.error("Error fetching inventory:", invError)

      // 2. Get Stock (all)
      const { data: stockData, error: stockError } = await supabase.from("rt_stock_current").select("*")
      
      // 3. Merge
      const stockMap = new Map()
      stockData?.forEach(s => {
          if (!stockMap.has(s.sku)) stockMap.set(s.sku, { qty: 0, accounts: [], status: 'Sin stock', title: s.title, thumbnail: s.thumbnail })
          const entry = stockMap.get(s.sku)
          entry.qty += (s.qty || 0)
          
          const accName = accounts.find(a => a.id === s.account_id)?.name || 'Unknown'
          if (!entry.accounts.includes(accName)) {
              entry.accounts.push(accName)
          }
          
          if (s.qty > 0) entry.status = 'En Stock'
          if (s.title && !entry.title) entry.title = s.title
          if (s.thumbnail && !entry.thumbnail) entry.thumbnail = s.thumbnail
      })

      // Combined list: Inventory items + items in Stock not in Inventory (Shadow)
      let combined = []
      
      if (inventory) {
          combined = inventory.map((inv: any) => {
            const stockInfo = stockMap.get(inv.sku)
            return {
                ...inv,
                ml_qty: stockInfo?.qty || 0,
                ml_status: stockInfo?.status || 'No sincronizado',
                ml_connected: !!stockInfo,
                ml_accounts: stockInfo?.accounts || [],
                ml_title: stockInfo?.title,
                ml_thumbnail: stockInfo?.thumbnail
            }
          })
      }

      // Add items from ML that are NOT in inventory
      stockMap.forEach((val, key) => {
          const exists = combined.find(c => c.sku === key)
          if (!exists) {
              combined.push({
                  sku: key,
                  name: val.title || 'Producto desconocido (Solo en ML)',
                  description: 'Importado desde MercadoLibre',
                  cost_without_tax: 0,
                  ml_qty: val.qty,
                  ml_status: val.status,
                  ml_connected: true,
                  ml_accounts: val.accounts,
                  ml_title: val.title,
                  ml_thumbnail: val.thumbnail,
                  is_shadow: true
              })
          }
      })

      setProducts(combined)
    } catch (err) {
      console.error("Error fetching products:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchStock = async () => {
    if (!supabase) return
    try {
      const { data, error } = await supabase.from("rt_stock_current").select("*")
      if (error) throw error

      // Group by SKU
      const grouped = new Map<string, any>()
      
      data?.forEach(row => {
        if (!grouped.has(row.sku)) {
            grouped.set(row.sku, {
                sku: row.sku,
                qty: 0,
                accounts: [],
                updated_at: row.updated_at,
                status: row.status,
                title: row.title,
                thumbnail: row.thumbnail
            })
        }
        const item = grouped.get(row.sku)
        item.qty += (row.qty || 0)
        
        const accName = accounts.find(a => a.id === row.account_id)?.name || 'Unknown'
        if (!item.accounts.includes(accName)) {
            item.accounts.push(accName)
        }
        // Update title/thumb if missing
        if (!item.title && row.title) item.title = row.title
        if (!item.thumbnail && row.thumbnail) item.thumbnail = row.thumbnail
      })

      const stockItems = Array.from(grouped.values())

      // Fetch costs
      if (stockItems.length > 0) {
        const skus = stockItems.map(i => i.sku)
        const { data: inventoryData } = await supabase
            .from("inventory")
            .select("sku, cost_without_tax")
            .in("sku", skus)
        
        const costMap = new Map()
        inventoryData?.forEach((i: any) => costMap.set(i.sku, Number(i.cost_without_tax) || 0))
        
        stockItems.forEach(item => {
            item.cost = costMap.get(item.sku) || 0
        })
      }

      setStock(stockItems)
    } catch (err) {
      console.error("Error fetching stock:", err)
    }
  }

  const fetchAccounts = async () => {
    if (!supabase) return
    try {
      setLoading(true)
      const { data, error } = await supabase.from("rt_ml_accounts").select("*")
      if (error) throw error
      setAccounts(data || [])
      if (data && data.length === 0) {
        setSetupMode(true)
        setActiveTab("config")
      }
    } catch (err) {
      console.error("Error fetching accounts:", err)
    } finally {
      setLoading(false)
    }
  }

  const fetchSales = async () => {
    if (!supabase) return
    try {
      // Get orders and join with accounts (manually join or use view if exists, simple fetch for now)
      // Note: Supabase JS client doesn't support deep joins easily without setup, so we fetch orders and map account names
      
      let query = supabase
        .from("rt_ml_orders")
        .select(`
          *,
          items:rt_ml_order_items(*)
        `)
        .order('date_created', { ascending: false })
        .limit(500) // Limit for performance

      const { data, error } = await query

      if (error) throw error
      
      // 1. Extract SKUs from all orders
      const allSkus = new Set<string>()
      data?.forEach(order => {
        order.items?.forEach((item: any) => {
           if(item.sku) allSkus.add(item.sku)
        })
      })

      // 2. Fetch costs from Inventory
      let costMap = new Map<string, number>()
      if (allSkus.size > 0) {
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory")
          .select("sku, cost_without_tax")
          .in("sku", Array.from(allSkus))
        
        if (!inventoryError && inventoryData) {
            inventoryData.forEach((item: any) => {
                costMap.set(item.sku, Number(item.cost_without_tax) || 0)
            })
        }
      }

      // 3. Enrich with account names and calculate Profit
      const enrichedSales = data?.map(sale => {
        const accountName = accounts.find(a => a.id === sale.account_id)?.name || 'Desconocido'
        
        let totalCost = 0
        let hasInvalidCost = false

        sale.items?.forEach((item: any) => {
           // Attempt to get cost, default to 0 if not found
           const cost = costMap.get(item.sku) || 0
           
           // Store cost in item for display
           item.unit_cost = cost

           // We no longer filter out sales with invalid costs, we just warn or handle them in UI
           if (cost <= 0) {
             hasInvalidCost = true
           }
           totalCost += cost * (item.quantity || 1)
        })

        // We calculate profit even if cost is 0 (it will just be equal to total_amount)
        // This ensures the sale is visible.
        const profit = (sale.total_amount || 0) - totalCost

        return {
          ...sale,
          account_name: accountName,
          total_cost: totalCost,
          profit: profit,
          has_warning: hasInvalidCost // Flag for UI
        }
      }) || []

      console.log(`[Sales] Fetched ${data?.length} raw orders. Displaying ${enrichedSales.length} after processing.`)

      if (data && data.length > 0 && enrichedSales.length === 0) {
          console.warn("[Sales] All sales filtered out! This should not happen now.")
      }

      setSales(enrichedSales)
    } catch (err) {
      console.error("Error fetching sales:", err)
    }
  }

  const applyFilters = () => {
    let filtered = [...sales]

    // 1. Account Filter
    if (accountFilter !== "all") {
      filtered = filtered.filter(s => s.account_name === accountFilter)
    }

    // 2. Date Filter
    const now = new Date()
    let from = new Date()
    let to = new Date()

    if (dateFilter === "today") {
      from.setHours(0,0,0,0)
      to.setHours(23,59,59,999)
    } else if (dateFilter === "week") {
      from.setDate(now.getDate() - 7)
    } else if (dateFilter === "month") {
      from.setDate(now.getDate() - 30)
    } else if (dateFilter === "custom" && dateRange.from) {
      from = dateRange.from
      if (dateRange.to) to = dateRange.to
    }

    filtered = filtered.filter(s => {
      const date = new Date(s.date_created)
      return date >= from && date <= to
    })

    setFilteredSales(filtered)
  }

  const handleSync = async () => {
    try {
      setSyncing(true)
      toast({ title: "Sincronizando...", description: "Descargando órdenes y stock de MercadoLibre." })
      
      // 1. Sync Orders
      const res1 = await fetch("/api/cron/rt/sync-orders", { method: "POST" })
      if (!res1.ok) {
         const err = await res1.json()
         throw new Error(err.error || "Error al sincronizar órdenes")
      }
      
      // 2. Sync Stock (Optional but good)
      const res2 = await fetch("/api/cron/rt/sync-stock", { method: "POST" })
      if (!res2.ok) {
         console.error("Stock sync failed but continuing...")
      }

      toast({ title: "Sincronización completada", description: "Los datos se han actualizado." })
      
      // Refresh local data
      await fetchAccounts()
      await fetchSales()
    } catch (err: any) {
      console.error("Sync error:", err)
      toast({ title: "Error", description: err.message || "Hubo un problema al sincronizar.", variant: "destructive" })
    } finally {
      setSyncing(false)
    }
  }
  
  const handleFullSync = async () => {
    if (!confirm("Esto descargará todo el historial desde 2024. Puede tardar varios minutos. ¿Continuar?")) return;
    
    try {
      setFullSyncing(true)
      toast({ title: "Iniciando descarga histórica...", description: "Esto puede tardar un poco. No cierres la ventana." })
      
      // Sync Orders with FULL flag
      const res = await fetch("/api/cron/rt/sync-orders?full=true", { method: "POST" })
      if (!res.ok) throw new Error("Error en la sincronización")

      toast({ title: "Historial completo", description: "Se han descargado todas las ventas desde 2024." })
      
      await fetchSales()
    } catch (err) {
      console.error("Full Sync error:", err)
      toast({ title: "Error", description: "Hubo un problema con la descarga histórica.", variant: "destructive" })
    } finally {
      setFullSyncing(false)
    }
  }

  const handleAddAccount = async () => {
    if (!supabase) return
    if (!newAccount.name || !newAccount.seller_id || !newAccount.refresh_token) {
      alert("Por favor completa todos los campos")
      return
    }

    try {
      setAddingAccount(true)
      const { error } = await supabase.from("rt_ml_accounts").insert([
        {
          name: newAccount.name,
          seller_id: parseInt(newAccount.seller_id),
          refresh_token: newAccount.refresh_token,
          created_at: new Date().toISOString()
        }
      ])

      if (error) throw error
      
      // Reset form and reload
      setNewAccount({ name: "", seller_id: "", refresh_token: "" })
      await fetchAccounts()
      alert("Cuenta agregada correctamente")
    } catch (err: any) {
      console.error("Error adding account:", err)
      alert("Error al agregar la cuenta: " + err.message)
    } finally {
      setAddingAccount(false)
    }
  }

  // Calculate Summary Metrics
  const totalSales = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
  const totalOrders = filteredSales.length
  
  // Real Profit Logic (Sales Price - Inventory Cost)
  const totalProfit = filteredSales.reduce((sum, s) => sum + (s.profit || 0), 0)
  const marginPercentage = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0 

  return (
    <SidebarProvider>
      <SidebarInset>

        
        <div className="flex-1 space-y-4 p-8 pt-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <h2 className="text-3xl font-bold tracking-tight">Panel de Rentabilidad</h2>
            <div className="flex items-center space-x-2">
              <Button onClick={handleSync} disabled={syncing || fullSyncing}>
                <RefreshCw className={`mr-2 h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? "Sincronizando..." : "Sincronizar Datos"}
              </Button>
            </div>
          </div>

          {setupMode && (
            <Alert variant="default" className="mb-6 border-blue-200 bg-blue-50 text-blue-800">
              <CheckCircle className="h-4 w-4" />
              <AlertTitle>Bienvenido al módulo de Rentabilidad Real</AlertTitle>
              <AlertDescription>
                Parece que es tu primera vez aquí. Configura tus cuentas de MercadoLibre para comenzar.
              </AlertDescription>
            </Alert>
          )}

          <Tabs defaultValue="summary" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
            <TabsList>
              <TabsTrigger value="summary">Resumen</TabsTrigger>
              <TabsTrigger value="sales">Ventas</TabsTrigger>
              <TabsTrigger value="products">Productos</TabsTrigger>
              <TabsTrigger value="stock">Stock</TabsTrigger>
              <TabsTrigger value="config">Configuración</TabsTrigger>
            </TabsList>
            
            {/* --- SUMMARY TAB --- */}
            <TabsContent value="summary" className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalSales)}</div>
                    <p className="text-xs text-muted-foreground">En el periodo seleccionado</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ganancia Real</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{formatCurrency(totalProfit)}</div>
                    <p className="text-xs text-muted-foreground">
                        {marginPercentage.toFixed(1)}% de margen (Sobre ventas)
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ventas</CardTitle>
                    <ShoppingCart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalOrders}</div>
                    <p className="text-xs text-muted-foreground">Órdenes procesadas</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Ticket Promedio</CardTitle>
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                        {totalOrders > 0 ? formatCurrency(totalSales / totalOrders) : "$0.00"}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Quick Filters for Summary */}
              <div className="flex gap-2 mb-4">
                 <Select value={accountFilter} onValueChange={setAccountFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Cuenta" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las cuentas</SelectItem>
                      {accounts.map(acc => (
                        <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                      ))}
                    </SelectContent>
                 </Select>
                 <Select value={dateFilter} onValueChange={setDateFilter}>
                    <SelectTrigger className="w-[180px]">
                      <SelectValue placeholder="Periodo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Hoy</SelectItem>
                      <SelectItem value="week">Esta Semana</SelectItem>
                      <SelectItem value="month">Este Mes</SelectItem>
                      <SelectItem value="custom">Personalizado</SelectItem>
                    </SelectContent>
                 </Select>
              </div>

              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                  <CardHeader>
                    <CardTitle>Últimas Ventas</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {/* Mobile View - Cards */}
                    <div className="md:hidden space-y-3">
                        {filteredSales.slice(0, 5).map((sale) => (
                            <div key={sale.order_id} className="border rounded-md p-3">
                                <div className="flex justify-between items-start mb-2">
                                    <div>
                                        <div className="text-xs text-muted-foreground">{format(new Date(sale.date_created), 'dd/MM HH:mm')}</div>
                                        <div className="font-medium text-sm">{sale.account_name}</div>
                                    </div>
                                    <div className="font-bold text-right">{formatCurrency(sale.total_amount)}</div>
                                </div>
                                <div className="text-sm truncate text-muted-foreground">
                                    {sale.items?.[0]?.title || 'Producto'}
                                    {sale.items && sale.items.length > 1 && ` (+${sale.items.length - 1})`}
                                </div>
                            </div>
                        ))}
                         {filteredSales.length === 0 && (
                            <div className="text-center text-muted-foreground py-8">
                                No se encontraron ventas en este periodo.
                            </div>
                        )}
                    </div>



                  <div className="hidden md:block">
                  <Table>
                        <TableHeader>
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Cuenta</TableHead>
                                <TableHead>Producto</TableHead>
                                <TableHead className="text-right">Total</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {filteredSales.slice(0, 5).map((sale) => (
                                <TableRow key={sale.order_id}>
                                    <TableCell>{format(new Date(sale.date_created), 'dd/MM HH:mm')}</TableCell>
                                    <TableCell>{sale.account_name}</TableCell>
                                    <TableCell className="max-w-[200px] truncate">
                                        {sale.items?.[0]?.title || 'Producto'}
                                        {sale.items && sale.items.length > 1 && ` (+${sale.items.length - 1})`}
                                    </TableCell>
                                    <TableCell className="text-right">{formatCurrency(sale.total_amount)}</TableCell>
                                </TableRow>
                            ))}
                            {filteredSales.length === 0 && (
                                <TableRow>
                                    <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                                        No se encontraron ventas en este periodo.
                                    </TableCell>
                                </TableRow>
                            )}
                        </TableBody>
                    </Table>
                  </div>
                  </CardContent>
                </Card>
                <Card className="col-span-3">
                  <CardHeader>
                    <CardTitle>Cuentas Activas</CardTitle>
                    <CardDescription>
                      Estado de conexión
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {accounts.map(acc => (
                        <div key={acc.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                          <div className="space-y-1">
                            <p className="text-sm font-medium leading-none">{acc.name}</p>
                            <p className="text-xs text-muted-foreground">ID: {acc.seller_id}</p>
                          </div>
                          <Badge variant="outline" className="text-green-600 bg-green-50 border-green-200">
                             Conectado
                          </Badge>
                        </div>
                      ))}
                      {accounts.length === 0 && (
                        <div className="text-sm text-muted-foreground">No hay cuentas configuradas</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* --- SALES TAB --- */}
            <TabsContent value="sales" className="space-y-4">
               <Card>
                 <CardHeader>
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle>Historial de Ventas</CardTitle>
                            <CardDescription>Detalle de transacciones de MercadoLibre</CardDescription>
                        </div>
                        <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Exportar
                        </Button>
                    </div>
                 </CardHeader>
                 <CardContent>
                    {/* Filters */}
                    <div className="flex flex-col md:flex-row gap-4 mb-6 p-4 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                            <Label className="mb-2 block">Cuenta</Label>
                            <Select value={accountFilter} onValueChange={setAccountFilter}>
                                <SelectTrigger>
                                <SelectValue placeholder="Cuenta" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="all">Todas las cuentas</SelectItem>
                                {accounts.map(acc => (
                                    <SelectItem key={acc.id} value={acc.name}>{acc.name}</SelectItem>
                                ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex-1">
                            <Label className="mb-2 block">Periodo</Label>
                            <Select value={dateFilter} onValueChange={setDateFilter}>
                                <SelectTrigger>
                                <SelectValue placeholder="Periodo" />
                                </SelectTrigger>
                                <SelectContent>
                                <SelectItem value="today">Hoy</SelectItem>
                                <SelectItem value="week">Esta Semana</SelectItem>
                                <SelectItem value="month">Este Mes</SelectItem>
                                <SelectItem value="custom">Personalizado</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        {dateFilter === 'custom' && (
                             <div className="flex-1">
                                <Label className="mb-2 block">Desde</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-normal">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {dateRange.from ? format(dateRange.from, "dd/MM/yyyy") : <span>Seleccionar</span>}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0">
                                        <Calendar mode="single" selected={dateRange.from} onSelect={d => setDateRange({...dateRange, from: d})} initialFocus />
                                    </PopoverContent>
                                </Popover>
                             </div>
                        )}
                    </div>

                    {/* Mobile View - Cards */}
                    <div className="md:hidden space-y-4">
                        {filteredSales.map((sale) => (
                            <div key={sale.order_id} className="border rounded-lg p-4 bg-card text-card-foreground shadow-sm">
                                <div className="flex justify-between items-start mb-3 border-b pb-2">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="font-mono text-xs text-muted-foreground">#{sale.order_id}</span>
                                            <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'} className="text-[10px] h-5">
                                                {sale.status}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-muted-foreground mt-1">{format(new Date(sale.date_created), 'dd/MM/yyyy HH:mm')}</div>
                                    </div>
                                    <div className="text-right">
                                        <div className="font-bold text-lg">{formatCurrency(sale.total_amount)}</div>
                                        <Badge variant="outline" className="text-[10px]">{sale.account_name}</Badge>
                                    </div>
                                </div>
                                
                                <div className="space-y-2 mb-3">
                                    {sale.items?.map((item: any, i: number) => (
                                        <div key={i} className="text-sm flex justify-between">
                                            <span className="truncate max-w-[70%]">{item.quantity}x {item.title}</span>
                                            <span className="text-muted-foreground text-xs">{formatCurrency(item.unit_cost || 0)} c/u</span>
                                        </div>
                                    ))}
                                </div>
                                
                                <div className="flex justify-between items-center pt-2 border-t bg-muted/20 -mx-4 -mb-4 p-3 rounded-b-lg">
                                    <div className="text-xs text-muted-foreground">
                                        Costo: {formatCurrency(sale.total_cost)}
                                    </div>
                                    <div className={`font-bold text-sm flex items-center gap-1 ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        Ganancia: {formatCurrency(sale.profit)}
                                        {sale.has_warning && (
                                            <span title="Costo de inventario faltante o cero" className="text-yellow-500">⚠️</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                         {filteredSales.length === 0 && (
                            <div className="text-center text-muted-foreground py-8 border rounded-lg border-dashed">
                                No hay ventas que coincidan con los filtros.
                            </div>
                        )}
                    </div>

                    {/* Table */}
                    <div className="hidden md:block rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Orden</TableHead>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Cuenta</TableHead>
                                    <TableHead>Items</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead className="text-right">Costo</TableHead>
                                    <TableHead className="text-right">Ganancia</TableHead>
                                    <TableHead className="text-right">Total</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredSales.map((sale) => (
                                    <TableRow key={sale.order_id}>
                                        <TableCell className="font-medium">{sale.order_id}</TableCell>
                                        <TableCell>{format(new Date(sale.date_created), 'dd/MM/yyyy HH:mm')}</TableCell>
                                        <TableCell>
                                            <Badge variant="outline">{sale.account_name}</Badge>
                                        </TableCell>
                                        <TableCell>
                                            <div className="text-sm">
                                                {sale.items?.map((item: any, i: number) => (
                                                    <div key={i} className="mb-2 last:mb-0">
                                                        <div>{item.quantity}x {item.title}</div>
                                                        <div className="text-xs text-muted-foreground">
                                                            Costo unitario: {formatCurrency(item.unit_cost || 0)}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Badge variant={sale.status === 'paid' ? 'default' : 'secondary'}>
                                                {sale.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-muted-foreground">
                                            {formatCurrency(sale.total_cost)}
                                        </TableCell>
                                        <TableCell className={`text-right font-medium ${sale.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {formatCurrency(sale.profit)}
                                            {sale.has_warning && (
                                                <span title="Costo de inventario faltante o cero" className="ml-2 text-yellow-500 cursor-help">⚠️</span>
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right font-bold">
                                            {formatCurrency(sale.total_amount)}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {filteredSales.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={8} className="text-center h-24 text-muted-foreground">
                                            No hay ventas que coincidan con los filtros.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                 </CardContent>
               </Card>
            </TabsContent>

            <TabsContent value="config">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Cuentas</CardTitle>
                  <CardDescription>
                    Agrega tus cuentas de MercadoLibre. Necesitas el Refresh Token inicial.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-4 py-4">
                     {/* Add Account Form */}
                     <div className="grid grid-cols-4 items-center gap-4">
                       <Label htmlFor="name" className="text-right">Nombre</Label>
                       <Input 
                         id="name" 
                         placeholder="Ej: Cuenta Principal" 
                         className="col-span-3" 
                         value={newAccount.name}
                         onChange={e => setNewAccount({...newAccount, name: e.target.value})}
                       />
                     </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                       <Label htmlFor="seller_id" className="text-right">Seller ID</Label>
                       <Input 
                         id="seller_id" 
                         placeholder="123456789" 
                         className="col-span-3" 
                         value={newAccount.seller_id}
                         onChange={e => setNewAccount({...newAccount, seller_id: e.target.value})}
                       />
                     </div>
                     <div className="grid grid-cols-4 items-center gap-4">
                       <Label htmlFor="token" className="text-right">Refresh Token</Label>
                       <Input 
                         id="token" 
                         type="password" 
                         placeholder="TG-..." 
                         className="col-span-3" 
                         value={newAccount.refresh_token}
                         onChange={e => setNewAccount({...newAccount, refresh_token: e.target.value})}
                       />
                     </div>
                     <div className="flex justify-end">
                        <Button onClick={handleAddAccount} disabled={addingAccount}>
                          {addingAccount ? "Conectando..." : "Conectar Cuenta"}
                        </Button>
                     </div>
                  </div>
                  
                  <div className="mt-8">
                    <h3 className="text-lg font-medium">Tablas de Datos</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Estado de las tablas del módulo.
                    </p>
                    {/* Schema Check Info */}
                    {dbReady ? (
                        <div className="flex items-center gap-2">
                           <CheckCircle className="h-4 w-4 text-green-500" />
                           <span className="text-sm">Tablas de Rentabilidad (rt_*) detectadas y operativas.</span>
                        </div>
                    ) : (
                        <div className="space-y-4 border border-red-200 bg-red-50 p-4 rounded-md">
                            <div className="flex items-center gap-2 text-red-700 font-medium">
                                <AlertTriangle className="h-4 w-4" />
                                <span>Error: Faltan tablas en la base de datos</span>
                            </div>
                            <div className="text-xs text-red-600 space-y-1">
                                <p>El sistema no puede guardar los datos porque faltan tablas.</p>
                                {dbStatus && Object.entries(dbStatus).map(([table, exists]) => (
                                    !exists && <div key={table}>- Falta tabla: {table}</div>
                                ))}
                            </div>
                            <div className="pt-2">
                                <Label className="text-xs font-semibold">Ejecuta este SQL en Supabase:</Label>
                                <div className="mt-1 p-2 bg-slate-900 text-slate-50 text-xs font-mono rounded overflow-auto max-h-32 select-all">
                                    {`-- Copia y pega esto en el SQL Editor de Supabase
CREATE TABLE IF NOT EXISTS rt_ml_accounts (id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), name TEXT NOT NULL, seller_id BIGINT UNIQUE, refresh_token TEXT NOT NULL, access_token TEXT, access_expires_at TIMESTAMP WITH TIME ZONE, created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
CREATE TABLE IF NOT EXISTS rt_ml_orders (account_id UUID REFERENCES rt_ml_accounts(id), order_id BIGINT NOT NULL, status TEXT, date_created TIMESTAMP WITH TIME ZONE, total_amount NUMERIC(20, 2), paid_amount NUMERIC(20, 2), buyer_id BIGINT, shipment_id BIGINT, payment_ids JSONB, raw JSONB, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (account_id, order_id));
CREATE TABLE IF NOT EXISTS rt_ml_order_items (id SERIAL PRIMARY KEY, account_id UUID REFERENCES rt_ml_accounts(id), order_id BIGINT, sku TEXT, item_id TEXT, variation_id BIGINT, title TEXT, quantity INTEGER, unit_price NUMERIC(20, 2), discount NUMERIC(20, 2), raw JSONB, FOREIGN KEY (account_id, order_id) REFERENCES rt_ml_orders(account_id, order_id));
CREATE TABLE IF NOT EXISTS rt_stock_current (account_id UUID REFERENCES rt_ml_accounts(id), sku TEXT NOT NULL, qty INTEGER, status TEXT, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), PRIMARY KEY (account_id, sku));
CREATE TABLE IF NOT EXISTS rt_ml_sku_map (account_id UUID REFERENCES rt_ml_accounts(id), sku TEXT NOT NULL, item_id TEXT NOT NULL, variation_id BIGINT, last_resolved_at TIMESTAMP WITH TIME ZONE, last_error TEXT, PRIMARY KEY (account_id, sku));
CREATE TABLE IF NOT EXISTS rt_jobs (name TEXT PRIMARY KEY, cursor JSONB, locked_at TIMESTAMP WITH TIME ZONE, last_error TEXT, updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW());
`}
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="mt-6 border-t pt-6">
                        <h4 className="text-md font-semibold mb-2 flex items-center gap-2">
                            <Database className="h-4 w-4" />
                            Acciones Avanzadas
                        </h4>
                        <p className="text-sm text-muted-foreground mb-4">
                            Utiliza estas opciones solo si es necesario descargar todo el historial antiguo.
                        </p>
                        <Button variant="outline" onClick={handleFullSync} disabled={fullSyncing}>
                            {fullSyncing ? "Descargando..." : "Descargar Historial Completo (2024)"}
                        </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="products" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventario de Productos</CardTitle>
                  <CardDescription>
                    Comparación de inventario local vs MercadoLibre
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Producto</TableHead>
                        <TableHead>SKU</TableHead>
                        <TableHead>Stock ML</TableHead>
                        <TableHead>Estado ML</TableHead>
                        <TableHead>Conexión</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((item) => (
                        <TableRow key={item.sku}>
                          <TableCell className="flex items-center gap-2">
                             {(item.ml_thumbnail || item.thumbnail) && (
                               <img src={item.ml_thumbnail || item.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                             )}
                             <div className="flex flex-col">
                               <span className="font-medium text-sm">{item.name || item.ml_title || item.sku}</span>
                               <span className="text-xs text-muted-foreground">{item.description}</span>
                             </div>
                          </TableCell>
                          <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                          <TableCell className="font-bold">{item.ml_qty}</TableCell>
                          <TableCell>
                             <Badge variant={item.ml_qty > 0 ? "default" : "secondary"}>
                               {item.ml_status}
                             </Badge>
                          </TableCell>
                          <TableCell>
                            {item.ml_connected ? (
                                <div className="flex flex-wrap gap-1">
                                    {item.ml_accounts.map((acc: string, i: number) => (
                                        <Badge key={i} variant="outline" className="text-xs border-green-200 text-green-700 bg-green-50">
                                            {acc}
                                        </Badge>
                                    ))}
                                </div>
                            ) : (
                                <Badge variant="outline" className="text-yellow-600 bg-yellow-50 border-yellow-200">
                                    No conectado
                                </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                      {products.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No se encontraron productos.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>
            
            <TabsContent value="stock">
                <Card>
                    <CardHeader>
                        <CardTitle>Stock en Vivo</CardTitle>
                        <CardDescription>Sincronizado desde MercadoLibre</CardDescription>
                </CardHeader>
                <CardContent>
                    {/* Mobile View - Cards */}
                    <div className="md:hidden space-y-3">
                        {stock.map((item) => (
                            <div key={item.sku} className="border rounded-md p-3 bg-white shadow-sm">
                                <div className="flex gap-3">
                                    {item.thumbnail && (
                                        <img src={item.thumbnail} alt="" className="w-12 h-12 rounded object-cover border" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-sm truncate">{item.title || item.sku}</div>
                                        <div className="text-xs font-mono text-muted-foreground mb-1">{item.sku}</div>
                                        <div className="flex justify-between items-end mt-2">
                                            <div className="flex flex-col">
                                                <span className="text-xs text-muted-foreground">Cantidad</span>
                                                <span className="font-bold text-lg">{item.qty}</span>
                                            </div>
                                            <div className="flex flex-col text-right">
                                                <span className="text-xs text-muted-foreground">Costo</span>
                                                <span className="font-medium">{formatCurrency(item.cost || 0)}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <div className="mt-3 pt-2 border-t flex justify-between items-center">
                                    <div className="flex flex-wrap gap-1">
                                        {item.accounts.map((acc: string, i: number) => (
                                            <Badge key={i} variant="outline" className="text-[10px]">
                                                {acc}
                                            </Badge>
                                        ))}
                                    </div>
                                    <Badge variant={item.qty > 0 ? "default" : "destructive"} className="text-[10px]">
                                        {item.status}
                                    </Badge>
                                </div>
                            </div>
                        ))}
                         {stock.length === 0 && (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay datos de stock sincronizados.
                            </div>
                        )}
                    </div>

                    <div className="hidden md:block">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto / SKU</TableHead>
                                    <TableHead>Cuentas</TableHead>
                                    <TableHead>Cantidad</TableHead>
                                    <TableHead>Costo</TableHead>
                                    <TableHead>Estado</TableHead>
                                    <TableHead>Actualizado</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {stock.map((item) => (
                                    <TableRow key={item.sku}>
                                        <TableCell>
                                           <div className="flex items-center gap-2">
                                             {item.thumbnail && (
                                                <img src={item.thumbnail} alt="" className="w-8 h-8 rounded object-cover" />
                                             )}
                                             <div className="flex flex-col">
                                                 <span className="font-medium">{item.sku}</span>
                                                 {item.title && <span className="text-xs text-muted-foreground max-w-[200px] truncate">{item.title}</span>}
                                             </div>
                                           </div>
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex flex-wrap gap-1">
                                                {item.accounts.map((acc: string, i: number) => (
                                                    <Badge key={i} variant="outline" className="text-xs">
                                                        {acc}
                                                    </Badge>
                                                ))}
                                            </div>
                                        </TableCell>
                                        <TableCell className="font-bold text-lg">{item.qty}</TableCell>
                                        <TableCell>{formatCurrency(item.cost || 0)}</TableCell>
                                        <TableCell>
                                            <Badge variant={item.qty > 0 ? "default" : "destructive"}>
                                                {item.status}
                                            </Badge>
                                        </TableCell>
                                        <TableCell>{format(new Date(item.updated_at), 'dd/MM HH:mm')}</TableCell>
                                    </TableRow>
                                ))}
                                {stock.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                                            No hay datos de stock sincronizados.
                                            <br />
                                            Asegúrate de ejecutar la sincronización.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </CardContent>
                </Card>
            </TabsContent>
          </Tabs>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
