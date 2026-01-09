"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Activity, Search, Eye, RefreshCw, Trash2 } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getActivityLogs, hasPermission, clearLogs, type ActivityLog } from "@/lib/auth"
import { logError } from "@/lib/logger"
import { formatCurrency } from "@/lib/utils"
import { format } from "date-fns"
import { es } from "date-fns/locale"
import type { JSX } from "react"

interface ActivityLogsProps {
  // Removed isOpen and onClose as they are no longer needed for modal control
}

export function ActivityLogs() {
  const [logs, setLogs] = useState<ActivityLog[]>([])
  const [filteredLogs, setFilteredLogs] = useState<ActivityLog[]>([])
  const [loading, setLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState("all")
  const [selectedLog, setSelectedLog] = useState<ActivityLog | null>(null)

  useEffect(() => {
    loadLogs()
  }, [])

  useEffect(() => {
    filterLogs()
  }, [logs, searchTerm, actionFilter])

  const loadLogs = async () => {
    setLoading(true)
    try {
      const data = await getActivityLogs(500)
      setLogs(data)
    } catch (error) {
      logError("Error cargando logs:", error)
    } finally {
      setLoading(false)
    }
  }

  const filterLogs = () => {
    let filtered = logs

    if (searchTerm) {
      filtered = filtered.filter(
        (log) =>
          log.user_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.user_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
          log.action.toLowerCase().includes(searchTerm.toLowerCase()),
      )
    }

    if (actionFilter !== "all") {
      filtered = filtered.filter((log) => log.action === actionFilter)
    }

    setFilteredLogs(filtered)
  }

  const getActionColor = (action: string) => {
    switch (action.toLowerCase()) {
      case "login":
        return "bg-green-100 text-green-800 border-green-200"
      case "logout":
        return "bg-gray-100 text-gray-800 border-gray-200"
      case "create":
      case "create_item":
      case "create_supplier":
      case "create_brand":
      case "create_user":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "update":
      case "edit_item":
      case "edit_supplier":
      case "edit_brand":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "delete":
      case "delete_item":
      case "delete_supplier":
      case "delete_brand":
        return "bg-red-100 text-red-800 border-red-200"
      case "import":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "export":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getActionLabel = (action: string) => {
    const labels: { [key: string]: string } = {
      LOGIN: "Inicio de Sesión",
      LOGOUT: "Cierre de Sesión",
      CREATE_ITEM: "Crear Producto",
      EDIT_ITEM: "Editar Producto",
      DELETE_ITEM: "Eliminar Producto",
      CREATE_SUPPLIER: "Crear Proveedor",
      EDIT_SUPPLIER: "Editar Proveedor",
      DELETE_SUPPLIER: "Eliminar Proveedor",
      CREATE_BRAND: "Crear Marca",
      EDIT_BRAND: "Editar Marca",
      DELETE_BRAND: "Eliminar Marca",
      CREATE_USER: "Crear Usuario",
      IMPORT: "Importar Datos",
      EXPORT: "Exportar Datos",
    }
    return labels[action] || action
  }

  const uniqueActions = Array.from(new Set(logs.map((log) => log.action)))

  const renderChanges = (oldData: any, newData: any): JSX.Element[] => {
    const changes: JSX.Element[] = []
    const allKeys = new Set([...Object.keys(oldData || {}), ...Object.keys(newData || {})])

    // Mapeo de nombres de campos a etiquetas amigables
    const fieldLabels: { [key: string]: string } = {
      sku: "SKU",
      ean: "EAN",
      description: "Nombre",
      cost_without_tax: "Costo sin IVA",
      cost_with_tax: "Costo con IVA",
      pvp_without_tax: "PVP sin IVA",
      pvp_with_tax: "PVP con IVA",
      quantity: "Cantidad",
      company: "Empresa",
      channel: "Canal",
      stock_status: "Estado de Stock",
      supplier_id: "Proveedor",
      brand_id: "Marca",
      invoice_number: "Número de Factura",
      observations: "Observaciones",
      name: "Nombre",
      contact_info: "Información de Contacto",
      is_active: "Activo",
      email: "Email",
      role: "Rol",
      can_view_logs: "Puede Ver Logs",
    }

    // Campos que no queremos mostrar en los cambios
    const excludeFields = ["id", "created_at", "updated_at", "created_by", "updated_by"]

    allKeys.forEach((key) => {
      if (excludeFields.includes(key)) return

      const oldValue = oldData?.[key]
      const newValue = newData?.[key]

      // Solo mostrar si hay cambio
      if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
        const fieldLabel = fieldLabels[key] || key.charAt(0).toUpperCase() + key.slice(1)

        changes.push(
          <div key={key} className="flex flex-col sm:flex-row gap-2 p-3 bg-gray-50 rounded border">
            <div className="font-medium text-gray-700 min-w-[120px]">{fieldLabel}:</div>
            <div className="flex-1 space-y-1">
              {oldValue !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">Anterior</span>
                  <span className="text-red-700 line-through">{formatFieldValue(key, oldValue)}</span>
                </div>
              )}
              {newValue !== undefined && (
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded">Nuevo</span>
                  <span className="text-green-700 font-medium">{formatFieldValue(key, newValue)}</span>
                </div>
              )}
            </div>
          </div>,
        )
      }
    })

    return changes.length > 0 ? (
      changes
    ) : (
      [<div key="no-changes" className="text-gray-500 italic p-3 bg-gray-50 rounded">No se detectaron cambios específicos</div>]
    )
  }

  const formatFieldValue = (field: string, value: any): string => {
    if (value === null || value === undefined) return "Sin asignar"
    if (value === "") return "Vacío"

    // Formatear valores booleanos
    if (typeof value === "boolean") {
      return value ? "Sí" : "No"
    }

    // Formatear números monetarios
    if (["cost_without_tax", "cost_with_tax", "pvp_without_tax", "pvp_with_tax"].includes(field)) {
      return formatCurrency(Number(value))
    }

    // Formatear estado de stock
    if (field === "stock_status") {
      const statusLabels: { [key: string]: string } = {
        normal: "Normal",
        low: "Bajo",
        out: "Agotado",
        discontinued: "Descontinuado",
      }
      return statusLabels[value] || value
    }

    // Formatear roles
    if (field === "role") {
      const roleLabels: { [key: string]: string } = {
        admin: "Administrador",
        user: "Usuario",
        viewer: "Visualizador",
      }
      return roleLabels[value] || value
    }

    return String(value)
  }

  const renderDataPreview = (data: any) => {
    const previewFields = ["sku", "ean", "description", "name", "email"]
    const preview = previewFields
      .filter((field) => data[field])
      .map((field) => `${field}: ${data[field]}`)
      .join(", ")

    return preview || "Datos del registro"
  }

  const handleClearLogs = async () => {
    if (!confirm("¿Estás seguro de que deseas eliminar todos los logs? Esta acción no se puede deshacer.")) {
      return
    }

    setLoading(true)
    try {
      const result = await clearLogs()
      if (result.success) {
        toast({
          title: "Logs eliminados",
          description: "El historial de actividad ha sido limpiado correctamente.",
        })
        loadLogs()
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudieron eliminar los logs.",
          variant: "destructive",
        })
      }
    } catch (error) {
      logError("Error limpiando logs:", error)
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <div className="space-y-4">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="w-5 h-5" />
            <h2 className="text-xl font-semibold">Logs de Actividad del Sistema</h2>
          </div>
          <p className="text-sm text-gray-500 mb-4">Registro completo de todas las acciones realizadas por los usuarios</p>

          <div className="space-y-4">
            {/* Filtros */}
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex gap-3 items-center">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 transform -translate-y-1/2 text-slate-400 w-3.5 h-3.5" />
                <Input
                  placeholder="Buscar por usuario, email, descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-8 h-8 text-sm bg-white"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-48 h-8 text-sm bg-white">
                  <SelectValue placeholder="Filtrar por acción" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas las acciones</SelectItem>
                  {uniqueActions.map((action) => (
                    <SelectItem key={action} value={action}>
                      {getActionLabel(action)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={loadLogs} variant="outline" size="sm" disabled={loading} className="h-8 bg-white">
                <RefreshCw className={`w-3.5 h-3.5 mr-2 ${loading ? "animate-spin" : ""}`} />
                Actualizar
              </Button>
              {hasPermission("ADMIN") && (
                <Button onClick={handleClearLogs} variant="destructive" size="sm" disabled={loading} className="h-8">
                  <Trash2 className="w-3.5 h-3.5 mr-2" />
                  Limpiar
                </Button>
              )}
            </div>

            {/* Tabla de logs */}
            <ScrollArea className="h-[500px]">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fecha/Hora</TableHead>
                    <TableHead>Usuario</TableHead>
                    <TableHead>Acción</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell className="font-mono text-sm">
                        {format(new Date(log.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                      </TableCell>
                      <TableCell>
                        <div>
                          <div className="font-medium">{log.user_name}</div>
                          <div className="text-sm text-gray-500 hidden md:block">{log.user_email}</div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActionColor(log.action)}>
                          {getActionLabel(log.action)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md truncate">{log.description}</TableCell>
                      <TableCell>
                        {(log.old_data || log.new_data) && (
                          <Button variant="ghost" size="sm" onClick={() => setSelectedLog(log)} className="h-8 w-8 p-0">
                            <Eye className="w-4 h-4" />
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLogs.length === 0 && !loading && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                        No se encontraron logs que coincidan con los filtros
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>

            <div className="text-sm text-gray-500 text-center">
              Mostrando {filteredLogs.length} de {logs.length} registros
            </div>
          </div>
        </div>

      {/* Modal de detalles del log */}
      <Dialog open={!!selectedLog} onOpenChange={() => setSelectedLog(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Detalles del Log</DialogTitle>
            <DialogDescription>Información completa de la acción realizada</DialogDescription>
          </DialogHeader>
          {selectedLog && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <strong>Usuario:</strong> {selectedLog.user_name}
                </div>
                <div>
                  <strong>Email:</strong> {selectedLog.user_email}
                </div>
                <div>
                  <strong>Acción:</strong> {getActionLabel(selectedLog.action)}
                </div>
                <div>
                  <strong>Fecha:</strong>{" "}
                  {format(new Date(selectedLog.created_at), "dd/MM/yyyy HH:mm:ss", { locale: es })}
                </div>
                <div>
                  <strong>Tabla:</strong> {selectedLog.table_name || "N/A"}
                </div>
                <div>
                  <strong>ID Registro:</strong> {selectedLog.record_id || "N/A"}
                </div>
              </div>
              <div>
                <strong>Descripción:</strong>
                <p className="mt-1 p-2 bg-gray-50 rounded">{selectedLog.description}</p>
              </div>
              {selectedLog.old_data && selectedLog.new_data && (
                <div>
                  <strong>Cambios Realizados:</strong>
                  <div className="mt-2 space-y-2">{renderChanges(selectedLog.old_data, selectedLog.new_data)}</div>
                </div>
              )}
              {selectedLog.old_data && !selectedLog.new_data && (
                <div>
                  <strong>Datos Eliminados:</strong>
                  <div className="mt-1 p-3 bg-red-50 border border-red-200 rounded">
                    {renderDataPreview(selectedLog.old_data)}
                  </div>
                </div>
              )}
              {!selectedLog.old_data && selectedLog.new_data && (
                <div>
                  <strong>Datos Creados:</strong>
                  <div className="mt-1 p-3 bg-green-50 border border-green-200 rounded">
                    {renderDataPreview(selectedLog.new_data)}
                  </div>
                </div>
              )}
              {selectedLog.user_agent && (
                <div>
                  <strong>Navegador:</strong>
                  <p className="mt-1 p-2 bg-gray-50 rounded text-sm">{selectedLog.user_agent}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
