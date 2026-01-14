"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Download, Filter, X, Search, Calendar, FileText, ChevronLeft, ChevronRight, Package } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { logError } from "@/lib/logger"
import { logActivity } from "@/lib/auth"
import { utils, writeFile } from "xlsx"
import { 
  startOfMonth, 
  endOfMonth, 
  eachMonthOfInterval, 
  subMonths, 
  format, 
  isSameMonth, 
  parseISO, 
  startOfYear 
} from "date-fns"
import { es } from "date-fns/locale"

// Types based on InventoryItem in page.tsx
type InventoryItem = {
  id: number
  sku: string
  description: string
  cost_with_tax: number
  quantity: number
  date_entered: string
  supplier_id: number | null
  invoice_number: string | null
  suppliers?: { name: string }
}

type PurchaseOrder = {
  id: string // Generated ID (e.g., invoice_number + supplier_id)
  date: string
  supplier_name: string
  invoice_number: string
  items_count: number
  total_amount: number
  status: "completed" | "pending" // Derived or assumed
  payment_method: string // Not in inventory table, maybe placeholder
  items: InventoryItem[]
}

export function ComprasManagement() {
  const [loading, setLoading] = useState(false)
  const [purchases, setPurchases] = useState<PurchaseOrder[]>([])
  const [filteredPurchases, setFilteredPurchases] = useState<PurchaseOrder[]>([])
  const [monthlyTotals, setMonthlyTotals] = useState<{ date: Date; total: number }[]>([])
  
  // Filters
  const [filters, setFilters] = useState({
    dateFrom: startOfMonth(new Date()).toISOString().split('T')[0],
    dateTo: endOfMonth(new Date()).toISOString().split('T')[0],
    supplier: "all",
    search: "",
  })
  
  const [suppliers, setSuppliers] = useState<string[]>([])
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseOrder | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)

  // Calendar navigation
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear())

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    applyFilters()
  }, [purchases, filters])

  const loadData = async () => {
    setLoading(true)
    try {
      let data: InventoryItem[] = []

      if (!isSupabaseConfigured) {
        // Mock data for offline mode
        data = [
          {
            id: 1,
            sku: "SKU-001",
            description: "Producto Ejemplo 1",
            cost_with_tax: 1500.50,
            quantity: 10,
            date_entered: new Date().toISOString(),
            supplier_id: 1,
            invoice_number: "FC-0001",
            suppliers: { name: "Proveedor A" }
          },
          {
            id: 2,
            sku: "SKU-002",
            description: "Producto Ejemplo 2",
            cost_with_tax: 2500.00,
            quantity: 5,
            date_entered: new Date().toISOString(),
            supplier_id: 1,
            invoice_number: "FC-0001",
            suppliers: { name: "Proveedor A" }
          },
          {
            id: 3,
            sku: "SKU-003",
            description: "Producto Ejemplo 3",
            cost_with_tax: 800.00,
            quantity: 20,
            date_entered: subMonths(new Date(), 1).toISOString(),
            supplier_id: 2,
            invoice_number: "FC-0002",
            suppliers: { name: "Proveedor B" }
          }
        ]
      } else {
        // Fetch inventory without join to avoid relationship errors
        const { data: inventoryData, error: inventoryError } = await supabase
          .from("inventory")
          .select(`
            id,
            sku,
            description,
            cost_with_tax,
            quantity,
            date_entered,
            supplier_id,
            invoice_number
          `)
          .order("date_entered", { ascending: false })

        if (inventoryError) throw inventoryError

        // Fetch suppliers separately
        const { data: suppliersData, error: suppliersError } = await supabase
          .from("suppliers")
          .select("id, name")

        if (suppliersError) throw suppliersError

        // Map suppliers to inventory items
        const suppliersMap = new Map(suppliersData?.map(s => [s.id, s.name]))
        
        data = inventoryData.map((item: any) => ({
          ...item,
          suppliers: { name: suppliersMap.get(item.supplier_id) || 'Desconocido' }
        }))
      }

      // Process data into Purchase Orders
      const grouped = groupItemsByPurchase(data)
      setPurchases(grouped)
      
      // Extract unique suppliers
      const uniqueSuppliers = Array.from(new Set(grouped.map(p => p.supplier_name))).sort()
      setSuppliers(uniqueSuppliers)

      // Calculate monthly totals for calendar
      calculateMonthlyTotals(grouped)

    } catch (error: any) {
      console.error("Error detailed:", error)
      logError("Error loading purchases:", error)
      toast({
        title: "Error",
        description: `No se pudieron cargar las compras: ${error.message || "Error desconocido"}`,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const groupItemsByPurchase = (items: InventoryItem[]): PurchaseOrder[] => {
    const groups: { [key: string]: PurchaseOrder } = {}

    items.forEach(item => {
      // Create a unique key for grouping: Invoice + Supplier + Date (Day)
      // If no invoice, group by date and supplier
      const date = item.date_entered ? item.date_entered.split('T')[0] : 'Unknown'
      const invoice = item.invoice_number || 'S/F'
      const supplier = item.suppliers?.name || 'Desconocido'
      const key = `${date}-${invoice}-${supplier}`

      if (!groups[key]) {
        groups[key] = {
          id: key,
          date: date,
          supplier_name: supplier,
          invoice_number: invoice,
          items_count: 0,
          total_amount: 0,
          status: "completed", // Assumed
          payment_method: "Cuenta Corriente", // Placeholder
          items: []
        }
      }

      groups[key].items.push(item)
      groups[key].items_count += 1
      // Calculate total cost for this item line (cost * quantity)
      // Note: Inventory usually tracks current quantity, but for purchase history we assume quantity added.
      // However, the inventory table 'quantity' is current stock. Ideally we should have a 'movements' table.
      // We will use 'quantity' as proxy for purchased quantity if no movement table exists.
      groups[key].total_amount += (item.cost_with_tax || 0) * (item.quantity || 1)
    })

    return Object.values(groups).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }

  const calculateMonthlyTotals = (orders: PurchaseOrder[]) => {
    // Generate last 12 months
    const end = endOfMonth(new Date())
    const start = subMonths(startOfMonth(new Date()), 11)
    const months = eachMonthOfInterval({ start, end })

    const totals = months.map(month => {
      const monthTotal = orders
        .filter(order => isSameMonth(parseISO(order.date), month))
        .reduce((sum, order) => sum + order.total_amount, 0)
      
      return {
        date: month,
        total: monthTotal
      }
    }).reverse() // Show newest first

    setMonthlyTotals(totals)
  }

  const applyFilters = () => {
    let result = [...purchases]

    // Date Range
    if (filters.dateFrom) {
      result = result.filter(p => p.date >= filters.dateFrom)
    }
    if (filters.dateTo) {
      result = result.filter(p => p.date <= filters.dateTo)
    }

    // Supplier
    if (filters.supplier !== "all") {
      result = result.filter(p => p.supplier_name === filters.supplier)
    }

    // Search
    if (filters.search) {
      const q = filters.search.toLowerCase()
      result = result.filter(p => 
        p.supplier_name.toLowerCase().includes(q) || 
        p.invoice_number.toLowerCase().includes(q) ||
        p.items.some(i => i.sku.toLowerCase().includes(q))
      )
    }

    setFilteredPurchases(result)
  }

  const handleExportExcel = () => {
    const data = filteredPurchases.map(p => ({
      Fecha: p.date,
      Proveedor: p.supplier_name,
      Factura: p.invoice_number,
      Items: p.items_count,
      Total: p.total_amount,
      Estado: p.status,
      "Método Pago": p.payment_method
    }))

    const ws = utils.json_to_sheet(data)
    const wb = utils.book_new()
    utils.book_append_sheet(wb, ws, "Compras")
    writeFile(wb, "Reporte_Compras.xlsx")
    
    toast({
      title: "Exportado",
      description: "El reporte se ha descargado correctamente",
    })
  }
  
  const handlePrint = () => {
    window.print()
  }

  const totalFiltered = filteredPurchases.reduce((sum, p) => sum + p.total_amount, 0)

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-t-lg">
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Package className="w-5 h-5 text-blue-600" />
            Compras
          </CardTitle>
          <CardDescription>Gestión y seguimiento de compras a proveedores</CardDescription>
        </CardHeader>
      </Card>
      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar: Calendar & Totals */}
        <div className="w-full md:w-80 space-y-4">
          <Card className="bg-white shadow-md border-slate-200">
            <CardHeader className="bg-slate-50 border-b border-slate-100 pb-3">
              <CardTitle className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                Calendario de Compras
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="flex items-center justify-between p-3 border-b border-slate-100">
                <Button variant="ghost" size="sm" onClick={() => setCalendarYear(y => y - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="font-medium text-slate-700">{calendarYear}</span>
                <Button variant="ghost" size="sm" onClick={() => setCalendarYear(y => y + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="max-h-[500px] overflow-y-auto">
                {monthlyTotals.map((monthData, index) => {
                  const isCurrentMonth = isSameMonth(monthData.date, new Date())
                  return (
                    <div 
                      key={index}
                      className={`p-4 border-b border-slate-50 hover:bg-slate-50 transition-colors cursor-pointer ${isCurrentMonth ? 'bg-blue-50/50' : ''}`}
                      onClick={() => {
                        setFilters(prev => ({
                          ...prev,
                          dateFrom: startOfMonth(monthData.date).toISOString().split('T')[0],
                          dateTo: endOfMonth(monthData.date).toISOString().split('T')[0]
                        }))
                      }}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className={`text-sm font-medium ${isCurrentMonth ? 'text-blue-700' : 'text-slate-600'}`}>
                          {format(monthData.date, 'MMMM yyyy', { locale: es })}
                        </span>
                        {isCurrentMonth && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-200">Actual</Badge>}
                      </div>
                      <div className="text-lg font-bold text-slate-800">
                        {formatCurrency(monthData.total)}
                      </div>
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1 space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white">
              <CardContent className="p-4">
                <p className="text-blue-100 text-xs font-medium">Total Compras</p>
                <p className="text-2xl font-bold">{filteredPurchases.length}</p>
              </CardContent>
            </Card>
            <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
              <CardContent className="p-4">
                <p className="text-emerald-100 text-xs font-medium">Monto Total</p>
                <p className="text-2xl font-bold">{formatCurrency(totalFiltered)}</p>
              </CardContent>
            </Card>
            {/* Placeholders for other metrics */}
            <Card className="bg-white border-slate-200 text-slate-700">
              <CardContent className="p-4">
                <p className="text-slate-500 text-xs font-medium">Proveedores</p>
                <p className="text-2xl font-bold text-slate-800">{new Set(filteredPurchases.map(p => p.supplier_name)).size}</p>
              </CardContent>
            </Card>
          </div>

          {/* Filters Bar */}
          <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" />
              <Input
                placeholder="Buscar por proveedor, factura, SKU..."
                className="pl-9 h-9 text-sm"
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              />
            </div>

            <Select value={filters.supplier} onValueChange={(val) => setFilters(prev => ({ ...prev, supplier: val }))}>
              <SelectTrigger className="w-[180px] h-9 text-sm">
                <SelectValue placeholder="Proveedor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los proveedores</SelectItem>
                {suppliers.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex items-center gap-2">
              <Input 
                type="date" 
                className="h-9 w-auto text-sm"
                value={filters.dateFrom}
                onChange={(e) => setFilters(prev => ({ ...prev, dateFrom: e.target.value }))}
              />
              <span className="text-slate-400">-</span>
              <Input 
                type="date" 
                className="h-9 w-auto text-sm"
                value={filters.dateTo}
                onChange={(e) => setFilters(prev => ({ ...prev, dateTo: e.target.value }))}
              />
            </div>

            <Button variant="ghost" size="sm" onClick={() => setFilters({
              dateFrom: startOfMonth(new Date()).toISOString().split('T')[0],
              dateTo: endOfMonth(new Date()).toISOString().split('T')[0],
              supplier: "all",
              search: ""
            })} className="h-9 w-9 p-0 rounded-full">
              <X className="w-4 h-4 text-slate-500" />
            </Button>

            <div className="h-6 w-px bg-slate-200 mx-1" />

            <Button variant="outline" size="sm" className="h-9" onClick={handleExportExcel}>
              <Download className="w-4 h-4 mr-2" />
              Excel
            </Button>
            <Button variant="outline" size="sm" className="h-9" onClick={handlePrint}>
              <FileText className="w-4 h-4 mr-2" />
              PDF / Imprimir
            </Button>
          </div>

          {/* Table */}
          <Card className="shadow-sm border border-slate-200 overflow-hidden">
            <Table>
              <TableHeader className="bg-slate-50">
                <TableRow>
                  <TableHead className="font-semibold text-slate-600">Fecha</TableHead>
                  <TableHead className="font-semibold text-slate-600">Proveedor</TableHead>
                  <TableHead className="font-semibold text-slate-600">Nº Factura</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600">Items</TableHead>
                  <TableHead className="text-right font-semibold text-slate-600">Total</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600">Estado</TableHead>
                  <TableHead className="text-center font-semibold text-slate-600">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8">Cargando...</TableCell>
                  </TableRow>
                ) : filteredPurchases.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-slate-500">
                      No se encontraron compras en este período
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredPurchases.map((purchase) => (
                    <TableRow key={purchase.id} className="hover:bg-slate-50">
                      <TableCell>{format(parseISO(purchase.date), 'dd/MM/yyyy')}</TableCell>
                      <TableCell className="font-medium text-slate-800">{purchase.supplier_name}</TableCell>
                      <TableCell className="text-slate-600 font-mono text-xs">{purchase.invoice_number}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-normal">{purchase.items_count}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-bold text-slate-700">
                        {formatCurrency(purchase.total_amount)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-200">
                          COMPLETADO
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            setSelectedPurchase(purchase)
                            setIsDetailsOpen(true)
                          }}
                        >
                          <Search className="w-4 h-4 text-blue-600" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </div>

      {/* Details Dialog */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Detalle de Compra</DialogTitle>
            <DialogDescription>
              {selectedPurchase?.supplier_name} - {selectedPurchase?.invoice_number}
            </DialogDescription>
          </DialogHeader>
          
          {selectedPurchase && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-lg">
                <div>
                  <p className="text-xs text-slate-500">Fecha</p>
                  <p className="font-medium">{format(parseISO(selectedPurchase.date), 'dd/MM/yyyy')}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total</p>
                  <p className="font-bold text-emerald-600">{formatCurrency(selectedPurchase.total_amount)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Items</p>
                  <p className="font-medium">{selectedPurchase.items_count}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Método Pago</p>
                  <p className="font-medium">{selectedPurchase.payment_method}</p>
                </div>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>SKU</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="text-right">Cantidad</TableHead>
                    <TableHead className="text-right">Costo Unit.</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedPurchase.items.map((item, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono text-xs">{item.sku}</TableCell>
                      <TableCell>{item.description}</TableCell>
                      <TableCell className="text-right">{item.quantity}</TableCell>
                      <TableCell className="text-right">{formatCurrency(item.cost_with_tax)}</TableCell>
                      <TableCell className="text-right font-medium">
                        {formatCurrency(item.cost_with_tax * item.quantity)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
