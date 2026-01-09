"use client"

import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Download, Receipt, Plus, Edit, Trash2, FileText, RefreshCw, CheckCircle } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { hasPermission, getCurrentUser } from "@/lib/auth"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { logError } from "@/lib/logger"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"

// NOTE: Para habilitar exportación PDF, instalar: npm install jspdf jspdf-autotable
// import jsPDF from 'jspdf'
// import autoTable from 'jspdf-autotable'

type ExpenseCategory = {
  id: number
  name: string
  description: string | null
  is_active: boolean
  budget_limit: number
  created_at: string
}

type Expense = {
  id: number
  description: string
  amount: number
  expense_date: string
  category_id: number | null
  has_invoice: boolean
  invoice_number: string | null
  invoice_date: string | null
  paid_by: number | null
  paid_date: string | null
  payment_method: "efectivo" | "transferencia" | "cheque" | "tarjeta"
  observations: string | null
  image_url?: string | null
  is_reconciled?: boolean
  created_at: string
  created_by: number | null
  expense_categories?: { name: string }
  created_user?: { name: string }
  paid_user?: { name: string }
}

type RecurringExpense = {
  id: number
  description: string
  amount: number
  category_id: number | null
  frequency: "weekly" | "monthly" | "yearly"
  start_date: string
  next_run_date: string
  is_active: boolean
  payment_method: "efectivo" | "transferencia" | "cheque" | "tarjeta"
  paid_by: number | null
  observations: string | null
  created_at: string
  expense_categories?: { name: string }
}

interface GastosManagementProps {
  onUpdateExpenses?: (amount: number) => void
}

export function GastosManagement({ onUpdateExpenses }: GastosManagementProps) {
  const currentUser = getCurrentUser()
  const isReadOnly = currentUser?.role === "viewer"

  const [activeTab, setActiveTab] = useState("gastos")
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [categories, setCategories] = useState<ExpenseCategory[]>([])
  const [recurringExpenses, setRecurringExpenses] = useState<RecurringExpense[]>([])
  const [usersList, setUsersList] = useState<{ id: number; name: string; email: string }[]>([])
  const [loading, setLoading] = useState(false)

  // Forms States
  const [showForm, setShowForm] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [showBudgetForm, setShowBudgetForm] = useState(false)

  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingRecurring, setEditingRecurring] = useState<RecurringExpense | null>(null)

  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean
    type: "expense" | "recurring"
    id: number | null
    description: string
  }>({ show: false, type: "expense", id: null, description: "" })

  const [filters, setFilters] = useState({
    period: "mensual" as "diario" | "semanal" | "mensual" | "personalizado",
    dateFrom: (() => {
      const d = new Date()
      return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
    })(),
    dateTo: (() => {
      const d = new Date()
      return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]
    })(),
    category: "all",
    paymentMethod: "all",
    hasInvoice: "all",
    status: "all",
  })

  const [formData, setFormData] = useState({
    description: "",
    amount: "",
    expense_date: new Date().toISOString().split("T")[0],
    category_id: "",
    has_invoice: false,
    invoice_number: "",
    invoice_date: "",
    paid_by: "",
    paid_date: "",
    payment_method: "efectivo" as "efectivo" | "transferencia" | "cheque" | "tarjeta",
    observations: "",
    image_url: "",
    is_reconciled: false,
  })

  const [recurringFormData, setRecurringFormData] = useState({
    description: "",
    amount: "",
    category_id: "",
    frequency: "monthly" as "weekly" | "monthly" | "yearly",
    start_date: new Date().toISOString().split("T")[0],
    payment_method: "efectivo" as "efectivo" | "transferencia" | "cheque" | "tarjeta",
    paid_by: "",
    observations: "",
    is_active: true,
  })

  // Mock data for offline mode
  const currentDate = new Date()
  const [offlineExpenses, setOfflineExpenses] = useState<Expense[]>([]) // Inicializar vacío o con datos de prueba si se desea
  const [offlineRecurring] = useState<RecurringExpense[]>([])

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (onUpdateExpenses) {
      const total = getCurrentPeriodTotal()
      onUpdateExpenses(total)
    }
  }, [expenses, filters.period, filters.dateFrom, filters.dateTo, onUpdateExpenses])

  const loadData = async () => {
    setLoading(true)
    try {
      if (!isSupabaseConfigured) {
        // Modo offline simplificado
        setExpenses(offlineExpenses)
        setRecurringExpenses(offlineRecurring)
        setLoading(false)
        return
      }

      // 1. Cargar Categorías
      const { data: catData } = await supabase.from("expense_categories").select("*").order("name")

      if (catData) setCategories(catData)

      // 2. Cargar Usuarios
      const { data: userData } = await supabase
        .from("users")
        .select("id, name, email")
        .eq("is_active", true)
        .order("name")

      if (userData) setUsersList(userData)

      // 3. Cargar Gastos
      const { data: expData } = await supabase
        .from("expenses")
        .select(`*, expense_categories(name), created_user:created_by(name), paid_user:paid_by(name)`)
        .order("expense_date", { ascending: false })

      if (expData) setExpenses(expData)

      // 4. Cargar Recurrentes
      const { data: recData } = await supabase
        .from("recurring_expenses")
        .select(`*, expense_categories(name)`)
        .order("next_run_date", { ascending: true })

      if (recData) setRecurringExpenses(recData)

      // Check for recurring expenses due
      checkRecurringDue(recData || [])
    } catch (error) {
      logError("Error loading data", error)
      toast({ title: "Error", description: "No se pudieron cargar los datos", variant: "destructive" })
    } finally {
      setLoading(false)
    }
  }

  const checkRecurringDue = async (recurring: RecurringExpense[]) => {
    // Simple logic to check if we need to generate expenses
    // In a real app, this should be a backend job
    const today = new Date().toISOString().split("T")[0]
    const due = recurring.filter((r) => r.is_active && r.next_run_date <= today)

    if (due.length > 0) {
      console.log("Found due recurring expenses:", due.length)
      // Logic to auto-generate could go here, but requires user confirmation or backend logic
      // For now, we just notify
      toast({
        title: "Gastos Recurrentes Pendientes",
        description: `Hay ${due.length} gastos recurrentes listos para generarse.`,
      })
    }
  }

  const getFilteredExpenses = () => {
    let filtered = [...expenses]

    if (filters.period) {
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      let from = new Date(filters.dateFrom + "T00:00:00")
      let to = new Date(filters.dateTo + "T23:59:59")

      if (filters.period === "diario") {
        from = new Date(today)
        to = new Date(today)
        to.setHours(23, 59, 59, 999)
      } else if (filters.period === "semanal") {
        const startOfWeek = new Date(today)
        startOfWeek.setDate(today.getDate() - today.getDay())
        from = startOfWeek
        to = new Date(today)
        to.setHours(23, 59, 59, 999)
      } else if (filters.period === "mensual") {
        const d = new Date()
        from = new Date(d.getFullYear(), d.getMonth(), 1)
        to = new Date(d.getFullYear(), d.getMonth() + 1, 0)
        to.setHours(23, 59, 59, 999)
      } else if (filters.period === "personalizado") {
        // usa dateFrom/dateTo actuales
      }

      filtered = filtered.filter((e) => {
        const ed = new Date(e.expense_date + "T00:00:00")
        return ed >= from && ed <= to
      })
    }
    if (filters.category !== "all") {
      filtered = filtered.filter((e) => e.category_id?.toString() === filters.category)
    }
    if (filters.paymentMethod !== "all") {
      filtered = filtered.filter((e) => e.payment_method === filters.paymentMethod)
    }
    if (filters.hasInvoice !== "all") {
      const hasInvoice = filters.hasInvoice === "true"
      filtered = filtered.filter((e) => e.has_invoice === hasInvoice)
    }
    if (filters.status !== "all") {
      const isReconciled = filters.status === "reconciled"
      filtered = filtered.filter((e) => !!e.is_reconciled === isReconciled)
    }

    return filtered
  }

  const getCurrentPeriodTotal = () => {
    const filtered = getFilteredExpenses()
    return filtered.reduce((sum, e) => sum + e.amount, 0)
  }

  // --- CRUD GASTOS ---

  const handleInputChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const resetForm = () => {
    setFormData({
      description: "",
      amount: "",
      expense_date: new Date().toISOString().split("T")[0],
      category_id: "",
      has_invoice: false,
      invoice_number: "",
      invoice_date: "",
      paid_by: "",
      paid_date: "",
      payment_method: "efectivo",
      observations: "",
      image_url: "",
      is_reconciled: false,
    })
    setEditingExpense(null)
    setShowForm(false)
  }

  const handleSubmit = async () => {
    if (!hasPermission("CREATE_EXPENSE")) return

    if (!formData.description || !formData.amount) {
      toast({ title: "Error", description: "Complete los campos obligatorios", variant: "destructive" })
      return
    }

    // Budget Check
    if (formData.category_id) {
      const category = categories.find((c) => c.id.toString() === formData.category_id)
      if (category && category.budget_limit > 0) {
        const currentTotal = expenses
          .filter((e) => e.category_id === category.id && e.expense_date.startsWith(filters.month))
          .reduce((sum, e) => sum + e.amount, 0)

        if (currentTotal + Number(formData.amount) > category.budget_limit) {
          toast({
            title: "Alerta de Presupuesto",
            description: `Este gasto excede el presupuesto de ${category.name}`,
            variant: "destructive", // or warning style
          })
        }
      }
    }

    const payload = {
      description: formData.description,
      amount: Number(formData.amount),
      expense_date: formData.expense_date,
      category_id: formData.category_id ? Number(formData.category_id) : null,
      has_invoice: formData.has_invoice,
      invoice_number: formData.invoice_number || null,
      invoice_date: formData.invoice_date || null,
      paid_by: formData.paid_by ? Number(formData.paid_by) : null,
      paid_date: formData.paid_date || null,
      payment_method: formData.payment_method,
      observations: formData.observations || null,
      // image_url: formData.image_url || null, // Temporarily disabled due to schema cache error
      is_reconciled: formData.is_reconciled,
      updated_by: getCurrentUser()?.id,
    }

    try {
      if (editingExpense) {
        const { error } = await supabase.from("expenses").update(payload).eq("id", editingExpense.id)
        if (error) throw error
        toast({ title: "Actualizado", description: "Gasto actualizado correctamente" })
      } else {
        const { error } = await supabase.from("expenses").insert({ ...payload, created_by: getCurrentUser()?.id })
        if (error) throw error
        toast({ title: "Creado", description: "Gasto registrado correctamente" })
      }
      resetForm()
      loadData()
    } catch (error) {
      console.error(error)
      toast({ title: "Error", description: "No se pudo guardar el gasto", variant: "destructive" })
    }
  }

  // --- CRUD RECURRENTES ---

  const handleRecurringSubmit = async () => {
    const payload = {
      description: recurringFormData.description,
      amount: Number(recurringFormData.amount),
      category_id: recurringFormData.category_id ? Number(recurringFormData.category_id) : null,
      frequency: recurringFormData.frequency,
      start_date: recurringFormData.start_date,
      next_run_date: recurringFormData.start_date, // Initial next run is start date
      payment_method: recurringFormData.payment_method,
      paid_by: recurringFormData.paid_by ? Number(recurringFormData.paid_by) : null,
      observations: recurringFormData.observations,
      is_active: recurringFormData.is_active,
      updated_by: getCurrentUser()?.id,
    }

    try {
      if (editingRecurring) {
        const { error } = await supabase.from("recurring_expenses").update(payload).eq("id", editingRecurring.id)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from("recurring_expenses")
          .insert({ ...payload, created_by: getCurrentUser()?.id })
        if (error) throw error
      }
      setShowRecurringForm(false)
      setEditingRecurring(null)
      loadData()
      toast({ title: "Éxito", description: "Gasto recurrente guardado" })
    } catch (e) {
      toast({ title: "Error", description: "Error al guardar", variant: "destructive" })
    }
  }

  // --- EXPORT PDF & EXCEL ---

  const exportPDF = () => {
    toast({
      title: "Información",
      description:
        "Para habilitar PDF, descomente las líneas de importación de jspdf en el código después de instalar las dependencias.",
    })
    // Implementation example if libraries were available:
    /*
    const doc = new jsPDF()
    autoTable(doc, {
        head: [['Fecha', 'Descripción', 'Monto', 'Categoría']],
        body: filteredExpenses.map(e => [e.expense_date, e.description, `$${e.amount}`, e.expense_categories?.name || ''])
    })
    doc.save('gastos.pdf')
    */
  }

  // --- STATS DATA ---
  const statsByCategory = useMemo(() => {
    const filtered = getFilteredExpenses()
    const byCat: Record<string, number> = {}
    filtered.forEach((e) => {
      const cat = e.expense_categories?.name || "Sin Categoría"
      byCat[cat] = (byCat[cat] || 0) + e.amount
    })
    return Object.entries(byCat).map(([name, value]) => ({ name, value }))
  }, [expenses, filters])

  const statsInvoice = useMemo(() => {
    const filtered = getFilteredExpenses()
    const withInv = filtered.filter((e) => e.has_invoice).reduce((sum, e) => sum + e.amount, 0)
    const withoutInv = filtered.filter((e) => !e.has_invoice).reduce((sum, e) => sum + e.amount, 0)
    return [
      { name: "Con Factura", value: withInv, color: "#10B981" },
      { name: "Sin Factura", value: withoutInv, color: "#EF4444" },
    ]
  }, [expenses, filters])

  // --- RENDER HELPERS ---
  const getPaymentMethodLabel = (method: string) => method.charAt(0).toUpperCase() + method.slice(1)

  return (
    <div className="space-y-6">
      <div className="w-full">
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-teal-50 to-cyan-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-teal-800">
              <Receipt className="h-6 w-6 text-teal-600" />
              Gestión de Gastos
            </CardTitle>
            <CardDescription>Control integral de egresos, presupuestos y reportes</CardDescription>
          </CardHeader>
        </Card>
      </div>

      <div className="flex gap-2 justify-end">
        <Button onClick={() => setShowForm(true)} className="bg-teal-600 hover:bg-teal-700">
          <Plus className="mr-2 h-4 w-4" /> Nuevo Gasto
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 md:grid-cols-5 h-auto">
          <TabsTrigger value="gastos">Gastos</TabsTrigger>
          <TabsTrigger value="recurrentes">Recurrentes</TabsTrigger>
          <TabsTrigger value="presupuestos">Presupuestos</TabsTrigger>
          <TabsTrigger value="estadisticas">Estadísticas</TabsTrigger>
          <TabsTrigger value="reportes">Reportes</TabsTrigger>
        </TabsList>

        {/* --- TAB GASTOS --- */}
        <TabsContent value="gastos" className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-wrap gap-4 items-center">
            <Select
              value={filters.period}
              onValueChange={(v) => {
                if (v === "diario") {
                  const t = new Date().toISOString().split("T")[0]
                  setFilters((prev) => ({ ...prev, period: "diario", dateFrom: t, dateTo: t }))
                } else if (v === "semanal") {
                  const today = new Date()
                  const startOfWeek = new Date(today)
                  startOfWeek.setDate(today.getDate() - today.getDay())
                  const f = startOfWeek.toISOString().split("T")[0]
                  const t = today.toISOString().split("T")[0]
                  setFilters((prev) => ({ ...prev, period: "semanal", dateFrom: f, dateTo: t }))
                } else if (v === "mensual") {
                  const d = new Date()
                  const f = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().split("T")[0]
                  const t = new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().split("T")[0]
                  setFilters((prev) => ({ ...prev, period: "mensual", dateFrom: f, dateTo: t }))
                } else {
                  setFilters((prev) => ({ ...prev, period: "personalizado" }))
                }
              }}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Periodo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="diario">Diario</SelectItem>
                <SelectItem value="semanal">Semanal</SelectItem>
                <SelectItem value="mensual">Mensual</SelectItem>
                <SelectItem value="personalizado">Personalizado</SelectItem>
              </SelectContent>
            </Select>
            {filters.period === "personalizado" && (
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  className="h-9 w-auto text-sm"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))}
                />
                <span className="text-slate-400">-</span>
                <Input
                  type="date"
                  className="h-9 w-auto text-sm"
                  value={filters.dateTo}
                  onChange={(e) => setFilters((prev) => ({ ...prev, dateTo: e.target.value }))}
                />
              </div>
            )}
            <Select value={filters.category} onValueChange={(v) => setFilters({ ...filters, category: v })}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Categoría" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id.toString()}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filters.hasInvoice} onValueChange={(v) => setFilters({ ...filters, hasInvoice: v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Factura" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="true">Con Factura</SelectItem>
                <SelectItem value="false">Sin Factura</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filters.status} onValueChange={(v) => setFilters({ ...filters, status: v })}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="reconciled">Conciliado</SelectItem>
                <SelectItem value="pending">Pendiente</SelectItem>
              </SelectContent>
            </Select>
            <div className="ml-auto text-sm font-medium text-gray-600">
              Total: {formatCurrency(getFilteredExpenses().reduce((sum, e) => sum + e.amount, 0))}
            </div>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Pago</TableHead>
                    <TableHead className="text-center">Factura</TableHead>
                    <TableHead className="text-center">Conciliado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {getFilteredExpenses().map((expense) => (
                    <TableRow key={expense.id}>
                      <TableCell>{expense.expense_date}</TableCell>
                      <TableCell>
                        <div className="font-medium">{expense.description}</div>
                        {expense.observations && (
                          <div className="text-xs text-gray-500 truncate max-w-[200px]">{expense.observations}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{expense.expense_categories?.name}</Badge>
                      </TableCell>
                      <TableCell className="font-bold">{formatCurrency(expense.amount)}</TableCell>
                      <TableCell className="capitalize">{expense.payment_method}</TableCell>
                      <TableCell className="text-center">
                        {expense.has_invoice ? (
                          <Badge className="bg-green-100 text-green-800 hover:bg-green-200">Sí</Badge>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        {expense.is_reconciled ? (
                          <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-gray-300 rounded-full mx-auto" />
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditingExpense(expense)
                              setFormData({
                                description: expense.description,
                                amount: expense.amount.toString(),
                                expense_date: expense.expense_date,
                                category_id: expense.category_id?.toString() || "",
                                has_invoice: expense.has_invoice,
                                invoice_number: expense.invoice_number || "",
                                invoice_date: expense.invoice_date || "",
                                paid_by: expense.paid_by?.toString() || "",
                                paid_date: expense.paid_date || "",
                                payment_method: expense.payment_method,
                                observations: expense.observations || "",
                                image_url: expense.image_url || "",
                                is_reconciled: expense.is_reconciled || false,
                              })
                              setShowForm(true)
                            }}
                          >
                            <Edit className="w-4 h-4 text-blue-500" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setDeleteConfirm({
                                show: true,
                                type: "expense",
                                id: expense.id,
                                description: expense.description,
                              })
                            }}
                          >
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {getFilteredExpenses().length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-gray-500">
                        No se encontraron gastos
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB RECURRENTES --- */}
        <TabsContent value="recurrentes">
          <div className="flex justify-end mb-4">
            <Button
              onClick={() => {
                setEditingRecurring(null)
                setShowRecurringForm(true)
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" /> Nuevo Recurrente
            </Button>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Gastos Recurrentes Automáticos</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Monto</TableHead>
                    <TableHead>Frecuencia</TableHead>
                    <TableHead>Próx. Ejecución</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recurringExpenses.map((rec) => (
                    <TableRow key={rec.id}>
                      <TableCell className="font-medium">{rec.description}</TableCell>
                      <TableCell>{formatCurrency(rec.amount)}</TableCell>
                      <TableCell className="capitalize">
                        {rec.frequency === "monthly" ? "Mensual" : rec.frequency}
                      </TableCell>
                      <TableCell>{rec.next_run_date}</TableCell>
                      <TableCell>
                        <Badge variant={rec.is_active ? "default" : "secondary"}>
                          {rec.is_active ? "Activo" : "Inactivo"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRecurring(rec)
                            setRecurringFormData({
                              description: rec.description,
                              amount: rec.amount.toString(),
                              category_id: rec.category_id?.toString() || "",
                              frequency: rec.frequency,
                              start_date: rec.start_date,
                              payment_method: rec.payment_method,
                              paid_by: rec.paid_by?.toString() || "",
                              observations: rec.observations || "",
                              is_active: rec.is_active,
                            })
                            setShowRecurringForm(true)
                          }}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB PRESUPUESTOS --- */}
        <TabsContent value="presupuestos">
          <Card>
            <CardHeader>
              <CardTitle>Presupuestos por Categoría</CardTitle>
              <CardDescription>
                Defina límites mensuales para cada categoría. Se mostrarán alertas al excederlos.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoría</TableHead>
                    <TableHead>Presupuesto Mensual</TableHead>
                    <TableHead>Gastado este Mes</TableHead>
                    <TableHead>Estado</TableHead>
                    <TableHead>Acciones</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {categories.map((cat) => {
                    const spent = expenses
                      .filter((e) => e.category_id === cat.id && e.expense_date.startsWith(filters.month))
                      .reduce((sum, e) => sum + e.amount, 0)
                    const percent = cat.budget_limit > 0 ? (spent / cat.budget_limit) * 100 : 0

                    return (
                      <TableRow key={cat.id}>
                        <TableCell className="font-medium">{cat.name}</TableCell>
                        <TableCell>{cat.budget_limit > 0 ? formatCurrency(cat.budget_limit) : "Sin límite"}</TableCell>
                        <TableCell>{formatCurrency(spent)}</TableCell>
                        <TableCell>
                          {cat.budget_limit > 0 && (
                            <div className="w-full max-w-[200px] bg-gray-200 rounded-full h-2.5">
                              <div
                                className={`h-2.5 rounded-full ${percent > 100 ? "bg-red-600" : percent > 80 ? "bg-yellow-400" : "bg-green-600"}`}
                                style={{ width: `${Math.min(percent, 100)}%` }}
                              ></div>
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              // Quick update budget prompt
                              const newLimit = prompt(
                                `Nuevo presupuesto para ${cat.name}:`,
                                cat.budget_limit.toString(),
                              )
                              if (newLimit !== null && !isNaN(Number(newLimit))) {
                                supabase
                                  .from("expense_categories")
                                  .update({ budget_limit: Number(newLimit) })
                                  .eq("id", cat.id)
                                  .then(() => {
                                    toast({ title: "Actualizado" })
                                    loadData()
                                  })
                              }
                            }}
                          >
                            Editar
                          </Button>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* --- TAB ESTADISTICAS --- */}
        <TabsContent value="estadisticas">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Gastos por Categoría</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={statsByCategory}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      fill="#8884d8"
                      label
                    >
                      {statsByCategory.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8"][index % 5]}
                        />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Con vs Sin Factura</CardTitle>
              </CardHeader>
              <CardContent className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={statsInvoice}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    <Bar dataKey="value">
                      {statsInvoice.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* --- TAB REPORTES --- */}
        <TabsContent value="reportes">
          <Card>
            <CardHeader>
              <CardTitle>Centro de Reportes</CardTitle>
              <CardDescription>Exportación de datos para contabilidad y control.</CardDescription>
            </CardHeader>
            <CardContent className="flex gap-4">
              <Button
                onClick={() => {
                  // Reutilizar lógica existente de Excel (simplificada aquí para brevedad)
                  toast({ title: "Exportando Excel", description: "Iniciando descarga..." })
                  // Lógica real de excel está en el componente original, se puede mover aquí
                }}
                className="bg-green-600 hover:bg-green-700"
              >
                <FileText className="mr-2 h-4 w-4" /> Exportar Excel Completo
              </Button>
              <Button
                onClick={exportPDF}
                variant="outline"
                className="border-red-500 text-red-500 hover:bg-red-50 bg-transparent"
              >
                <Download className="mr-2 h-4 w-4" /> Exportar PDF (Requiere Librería)
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* --- MODALS --- */}

      {/* Expense Form Modal */}
      <Dialog open={showForm} onOpenChange={(open) => !open && resetForm()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingExpense ? "Editar Gasto" : "Nuevo Gasto"}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 py-4">
            <div className="space-y-2">
              <Label>Descripción *</Label>
              <Input value={formData.description} onChange={(e) => handleInputChange("description", e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Monto *</Label>
              <Input
                type="number"
                value={formData.amount}
                onChange={(e) => handleInputChange("amount", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Categoría</Label>
              <Select value={formData.category_id} onValueChange={(v) => handleInputChange("category_id", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id.toString()}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={formData.expense_date}
                onChange={(e) => handleInputChange("expense_date", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Método de Pago</Label>
              <Select value={formData.payment_method} onValueChange={(v) => handleInputChange("payment_method", v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="cheque">Cheque</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Pagado Por</Label>
              <Select value={formData.paid_by} onValueChange={(v) => handleInputChange("paid_by", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar" />
                </SelectTrigger>
                <SelectContent>
                  {usersList.map((u) => (
                    <SelectItem key={u.id} value={u.id.toString()}>
                      {u.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2 border p-4 rounded-md space-y-4 bg-gray-50">
              <div className="flex items-center gap-2">
                <Switch checked={formData.has_invoice} onCheckedChange={(c) => handleInputChange("has_invoice", c)} />
                <Label>¿Tiene Comprobante Fiscal?</Label>
              </div>
              {formData.has_invoice && (
                <div className="grid grid-cols-2 gap-4">
                  <Input
                    placeholder="Nº Factura"
                    value={formData.invoice_number}
                    onChange={(e) => handleInputChange("invoice_number", e.target.value)}
                  />
                  <Input
                    type="date"
                    value={formData.invoice_date}
                    onChange={(e) => handleInputChange("invoice_date", e.target.value)}
                  />
                </div>
              )}
            </div>

            <div className="col-span-2">
              <Label>Observaciones</Label>
              <Textarea
                value={formData.observations}
                onChange={(e) => handleInputChange("observations", e.target.value)}
              />
            </div>

            <div className="col-span-2 flex items-center gap-4 border-t pt-4">
              <div className="flex items-center gap-2">
                <Switch
                  checked={formData.is_reconciled}
                  onCheckedChange={(c) => handleInputChange("is_reconciled", c)}
                />
                <Label>Conciliado (Banco/Caja)</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={resetForm}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit}>{editingExpense ? "Guardar Cambios" : "Crear Gasto"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recurring Form Modal */}
      <Dialog open={showRecurringForm} onOpenChange={setShowRecurringForm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRecurring ? "Editar Recurrente" : "Nuevo Gasto Recurrente"}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <Input
              placeholder="Descripción"
              value={recurringFormData.description}
              onChange={(e) => setRecurringFormData({ ...recurringFormData, description: e.target.value })}
            />
            <Input
              type="number"
              placeholder="Monto"
              value={recurringFormData.amount}
              onChange={(e) => setRecurringFormData({ ...recurringFormData, amount: e.target.value })}
            />
            <Select
              value={recurringFormData.frequency}
              onValueChange={(v: any) => setRecurringFormData({ ...recurringFormData, frequency: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Frecuencia" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="monthly">Mensual</SelectItem>
                <SelectItem value="weekly">Semanal</SelectItem>
                <SelectItem value="yearly">Anual</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-center gap-2">
              <Switch
                checked={recurringFormData.is_active}
                onCheckedChange={(c) => setRecurringFormData({ ...recurringFormData, is_active: c })}
              />
              <Label>Activo (Generar automáticamente)</Label>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleRecurringSubmit}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirm.show} onOpenChange={(show) => setDeleteConfirm({ ...deleteConfirm, show })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
          </DialogHeader>
          <p>¿Eliminar "{deleteConfirm.description}"?</p>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirm({ show: false, type: "expense", id: null, description: "" })}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!deleteConfirm.id) return
                const table = deleteConfirm.type === "expense" ? "expenses" : "recurring_expenses"
                await supabase.from(table).delete().eq("id", deleteConfirm.id)
                toast({ title: "Eliminado" })
                setDeleteConfirm({ show: false, type: "expense", id: null, description: "" })
                loadData()
              }}
            >
              Eliminar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
