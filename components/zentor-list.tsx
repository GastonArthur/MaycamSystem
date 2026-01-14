"use client"

import { useState, useMemo, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Download, Package, Filter, X, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { logActivity, hasPermission } from "@/lib/auth"
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

type ZentorItem = {
  sku: string
  description: string
  cost_without_tax: number
  pvp_with_tax: number
  latest_date: string
  price_change: {
    cost_changed: boolean
    pvp_changed: boolean
    cost_percentage: number
    pvp_percentage: number
  }
  company: string
  brand_name: string
  supplier_name: string
}

interface ZentorListProps {
  inventory: InventoryItem[]
  suppliers: Supplier[]
  brands: Brand[]
}

export function ZentorList({ inventory, suppliers, brands }: ZentorListProps) {
  const [filters, setFilters] = useState({
    searchSku: "",
    supplier: "all",
    brand: "all",
    company: "all",
    priceChanges: "all", // all, cost_changed, pvp_changed, both_changed
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, itemsPerPage])



  // Procesar inventario para obtener SKUs únicos con información consolidada
  const zentorData = useMemo(() => {
    const skuGroups: { [key: string]: InventoryItem[] } = {}

    // Agrupar por SKU
    inventory.forEach((item) => {
      if (!skuGroups[item.sku]) {
        skuGroups[item.sku] = []
      }
      skuGroups[item.sku].push(item)
    })

    const zentorItems: ZentorItem[] = []

    Object.keys(skuGroups).forEach((sku) => {
      const items = skuGroups[sku].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
      const latestItem = items[items.length - 1]
      const firstItem = items[0]

      // Calcular cambios de precio
      let cost_changed = false
      let pvp_changed = false
      let cost_percentage = 0
      let pvp_percentage = 0

      if (items.length > 1) {
        const oldCost = firstItem.cost_without_tax
        const newCost = latestItem.cost_without_tax
        const oldPvp = firstItem.pvp_with_tax
        const newPvp = latestItem.pvp_with_tax

        if (oldCost !== newCost && oldCost > 0) {
          cost_changed = true
          cost_percentage = ((newCost - oldCost) / oldCost) * 100
        }

        if (oldPvp !== newPvp && oldPvp > 0) {
          pvp_changed = true
          pvp_percentage = ((newPvp - oldPvp) / oldPvp) * 100
        }
      }

      zentorItems.push({
        sku: sku,
        description: latestItem.description,
        cost_without_tax: latestItem.cost_without_tax,
        pvp_with_tax: latestItem.pvp_with_tax,
        latest_date: latestItem.created_at,
        price_change: {
          cost_changed,
          pvp_changed,
          cost_percentage,
          pvp_percentage,
        },
        company: latestItem.company,
        brand_name: latestItem.brands?.name || "Sin marca",
        supplier_name: latestItem.suppliers?.name || "Sin proveedor",
      })
    })

    return zentorItems.sort((a, b) => new Date(b.latest_date).getTime() - new Date(a.latest_date).getTime())
  }, [inventory])

  const getFilteredZentorData = () => {
    let filtered = [...zentorData]

    if (filters.searchSku && filters.searchSku.trim()) {
      filtered = filtered.filter(
        (item) =>
          item.sku.toLowerCase().includes(filters.searchSku.toLowerCase().trim()) ||
          item.description.toLowerCase().includes(filters.searchSku.toLowerCase().trim()),
      )
    }

    if (filters.supplier && filters.supplier !== "all") {
      const supplierName = suppliers.find((s) => s.id.toString() === filters.supplier)?.name
      if (supplierName) {
        filtered = filtered.filter((item) => item.supplier_name === supplierName)
      }
    }

    if (filters.brand && filters.brand !== "all") {
      const brandName = brands.find((b) => b.id.toString() === filters.brand)?.name
      if (brandName) {
        filtered = filtered.filter((item) => item.brand_name === brandName)
      }
    }

    if (filters.company && filters.company !== "all") {
      filtered = filtered.filter((item) => item.company === filters.company)
    }

    if (filters.priceChanges && filters.priceChanges !== "all") {
      switch (filters.priceChanges) {
        case "cost_changed":
          filtered = filtered.filter((item) => item.price_change.cost_changed)
          break
        case "pvp_changed":
          filtered = filtered.filter((item) => item.price_change.pvp_changed)
          break
        case "both_changed":
          filtered = filtered.filter((item) => item.price_change.cost_changed && item.price_change.pvp_changed)
          break
      }
    }

    return filtered
  }

  const getCompanyBadgeColor = (company: string) => {
    switch (company) {
      case "MAYCAM":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "BLUE DOGO":
        return "bg-indigo-100 text-indigo-800 border-indigo-200"
      case "GLOBOBAZAAR":
        return "bg-purple-100 text-purple-800 border-purple-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const exportZentorToExcel = () => {
    if (!hasPermission("EXPORT")) {
      toast({
        title: "Sin permisos",
        description: "No tiene permisos para exportar datos",
        variant: "destructive",
      })
      return
    }

    const filtered = getFilteredZentorData()

    const headers = [
      "SKU",
      "Descripción",
      "Costo s/IVA",
      "PVP c/IVA",
      "Empresa",
      "Marca",
      "Proveedor",
      "Cambio Costo",
      "Cambio PVP",
      "Última Actualización",
    ]

    const csvRows = filtered.map((item) => [
      item.sku,
      item.description,
      `$${item.cost_without_tax.toFixed(2)}`,
      `$${item.pvp_with_tax.toFixed(2)}`,
      item.company,
      item.brand_name,
      item.supplier_name,
      item.price_change.cost_changed
        ? `${item.price_change.cost_percentage > 0 ? "+" : ""}${item.price_change.cost_percentage.toFixed(1)}%`
        : "Sin cambio",
      item.price_change.pvp_changed
        ? `${item.price_change.pvp_percentage > 0 ? "+" : ""}${item.price_change.pvp_percentage.toFixed(1)}%`
        : "Sin cambio",
      new Date(item.latest_date).toLocaleDateString("es-ES"),
    ])

    const excelContent = `
<html>
<head>
<meta charset="utf-8">
<style>
.header { 
  background-color: #374151; 
  color: white; 
  font-weight: bold; 
  text-align: center; 
  padding: 8px;
  border: 1px solid #1F2937;
}
.data { 
  text-align: left; 
  padding: 6px;
  border: 1px solid #E5E7EB;
  vertical-align: top;
}
.data-center { 
  text-align: center; 
  padding: 6px;
  border: 1px solid #E5E7EB;
}
.data-number { 
  text-align: right; 
  padding: 6px;
  border: 1px solid #E5E7EB;
}
table { 
  border-collapse: collapse; 
  width: 100%; 
  font-family: Arial, sans-serif;
  font-size: 12px;
}
.empresa-maycam { background-color: #DBEAFE; }
.empresa-bluedogo { background-color: #E0E7FF; }
.empresa-globobazaar { background-color: #EDE9FE; }
.price-increase { background-color: #FEE2E2; color: #DC2626; font-weight: bold; }
.price-decrease { background-color: #D1FAE5; color: #059669; font-weight: bold; }
.no-change { background-color: #F3F4F6; color: #6B7280; }
</style>
</head>
<body>
<h2 style="text-align: center; color: #374151; margin-bottom: 20px;">LISTA ZENTOR - SKUs Únicos</h2>
<table>
<tr>
${headers.map((h) => `<th class="header">${h}</th>`).join("")}
</tr>
${csvRows
  .map((row, index) => {
    const item = filtered[index]
    const empresaClass =
      item.company === "MAYCAM"
        ? "empresa-maycam"
        : item.company === "BLUE DOGO"
          ? "empresa-bluedogo"
          : "empresa-globobazaar"

    const costChangeClass = item.price_change.cost_changed
      ? item.price_change.cost_percentage > 0
        ? "price-increase"
        : "price-decrease"
      : "no-change"

    const pvpChangeClass = item.price_change.pvp_changed
      ? item.price_change.pvp_percentage > 0
        ? "price-increase"
        : "price-decrease"
      : "no-change"

    return `<tr>
    <td class="data">${row[0]}</td>
    <td class="data">${row[1]}</td>
    <td class="data-number">${row[2]}</td>
    <td class="data-number">${row[3]}</td>
    <td class="data-center ${empresaClass}">${row[4]}</td>
    <td class="data">${row[5]}</td>
    <td class="data">${row[6]}</td>
    <td class="data-center ${costChangeClass}">${row[7]}</td>
    <td class="data-center ${pvpChangeClass}">${row[8]}</td>
    <td class="data-center">${row[9]}</td>
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
    a.download = `zentor_skus_unicos_${new Date().toISOString().split("T")[0]}.xls`
    a.style.display = "none"
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    window.URL.revokeObjectURL(url)

    // Registrar log de exportación
    logActivity(
      "EXPORT",
      null,
      null,
      null,
      { count: filtered.length, type: "zentor_list" },
      `Exportación ZENTOR: ${filtered.length} SKUs únicos`,
    )

    toast({
      title: "Exportación ZENTOR completada",
      description: `Se exportaron ${filtered.length} SKUs únicos con información consolidada`,
    })
  }

  const filteredData = getFilteredZentorData()

  // Lógica de paginación
  const totalPages = Math.ceil(filteredData.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredData.slice(startIndex, endIndex)


  return (
    <div className="space-y-6">
      {/* Header con estilo consistente */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-50 rounded-t-lg flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-slate-800">
              <Package className="w-5 h-5 text-slate-600" />
              Lista ZENTOR
            </CardTitle>
            <CardDescription>SKUs únicos con información consolidada y seguimiento de cambios de precios</CardDescription>
          </div>
          <Button
            onClick={exportZentorToExcel}
            className="bg-slate-700 text-white hover:bg-slate-800 font-bold shadow-sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar ZENTOR
          </Button>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Filtros ZENTOR</h3>
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setFilters({
                searchSku: "",
                supplier: "all",
                brand: "all",
                company: "all",
                priceChanges: "all",
              })
            }
            className="ml-auto h-6 text-xs text-slate-400 hover:text-red-500 px-2"
          >
            <X className="w-3 h-3 mr-1" />
            Limpiar
          </Button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
          <div>
            <Label htmlFor="itemsPerPage" className="text-xs text-slate-500 mb-1 block">
              Items por página
            </Label>
            <Select
              value={itemsPerPage.toString()}
              onValueChange={(value) => setItemsPerPage(Number(value))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="50" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="50">50</SelectItem>
                <SelectItem value="100">100</SelectItem>
                <SelectItem value="200">200</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="searchSku" className="text-xs text-slate-500 mb-1 block">
              Buscar SKU/Nombre
            </Label>
            <Input
              id="searchSku"
              type="text"
              placeholder="Buscar..."
              value={filters.searchSku}
              onChange={(e) => setFilters((prev) => ({ ...prev, searchSku: e.target.value }))}
              className="h-8 text-sm"
            />
          </div>
          <div>
            <Label htmlFor="filterSupplier" className="text-xs text-slate-500 mb-1 block">
              Proveedor
            </Label>
            <Select
              value={filters.supplier}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, supplier: value }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {suppliers.map((supplier) => (
                  <SelectItem key={supplier.id} value={supplier.id.toString()}>
                    {supplier.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filterBrand" className="text-xs text-slate-500 mb-1 block">
              Marca
            </Label>
            <Select
              value={filters.brand}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, brand: value }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                {brands.map((brand) => (
                  <SelectItem key={brand.id} value={brand.id.toString()}>
                    {brand.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filterCompany" className="text-xs text-slate-500 mb-1 block">
              Empresa
            </Label>
            <Select
              value={filters.company}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, company: value }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas</SelectItem>
                <SelectItem value="MAYCAM">MAYCAM</SelectItem>
                <SelectItem value="BLUE DOGO">BLUE DOGO</SelectItem>
                <SelectItem value="GLOBOBAZAAR">GLOBOBAZAAR</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="filterPriceChanges" className="text-xs text-slate-500 mb-1 block">
              Cambios de Precio
            </Label>
            <Select
              value={filters.priceChanges}
              onValueChange={(value) => setFilters((prev) => ({ ...prev, priceChanges: value }))}
            >
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="cost_changed">Solo cambios en Costo</SelectItem>
                <SelectItem value="pvp_changed">Solo cambios en PVP</SelectItem>
                <SelectItem value="both_changed">Cambios en ambos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Estadísticas rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-r from-gray-600 to-slate-700 text-white shadow-lg">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-gray-200 text-sm">Total SKUs Únicos</p>
              <p className="text-2xl font-bold">{zentorData.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-red-500 to-red-600 text-white shadow-lg">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-red-100 text-sm">Cambios en Costo</p>
              <p className="text-2xl font-bold">{zentorData.filter((item) => item.price_change.cost_changed).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-lg">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-blue-100 text-sm">Cambios en PVP</p>
              <p className="text-2xl font-bold">{zentorData.filter((item) => item.price_change.pvp_changed).length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-r from-green-500 to-green-600 text-white shadow-lg">
          <CardContent className="p-4">
            <div className="text-center">
              <p className="text-green-100 text-sm">Filtrados</p>
              <p className="text-2xl font-bold">{filteredData.length}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla ZENTOR */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-slate-50 to-gray-100 rounded-t-lg">
          <CardTitle className="text-slate-800">Lista ZENTOR - SKUs Únicos ({filteredData.length} productos)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-gray-700 to-slate-800">
                  <TableHead className="font-bold text-white text-center border border-slate-300">SKU</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">
                    Nombre
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    Costo s/IVA
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">PVP c/IVA</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">Marca</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">Proveedor</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    Cambio Costo
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">Cambio PVP</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    Última Actualización
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((item) => (
                  <TableRow key={item.sku} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium border border-slate-200">{item.sku}</TableCell>
                    <TableCell className="border border-slate-200 max-w-xs">{item.description}</TableCell>
                    <TableCell className="border border-slate-200 text-center font-medium hidden md:table-cell">
                      {formatCurrency(item.cost_without_tax)}
                    </TableCell>
                    <TableCell className="border border-slate-200 text-center font-medium">
                      {formatCurrency(item.pvp_with_tax)}
                    </TableCell>
                    <TableCell className="border border-slate-200 text-center hidden md:table-cell">
                      <Badge variant="outline" className={getCompanyBadgeColor(item.company)}>
                        {item.company}
                      </Badge>
                    </TableCell>
                    <TableCell className="border border-slate-200 hidden md:table-cell">{item.brand_name}</TableCell>
                    <TableCell className="border border-slate-200 hidden md:table-cell">{item.supplier_name}</TableCell>
                    <TableCell className="border border-slate-200 text-center hidden md:table-cell">
                      {item.price_change.cost_changed ? (
                        <div className="flex items-center justify-center gap-1">
                          {item.price_change.cost_percentage > 0 ? (
                            <TrendingUp className="w-4 h-4 text-red-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-green-500" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              item.price_change.cost_percentage > 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {item.price_change.cost_percentage > 0 ? "+" : ""}
                            {item.price_change.cost_percentage.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Sin cambio
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="border border-slate-200 text-center hidden md:table-cell">
                      {item.price_change.pvp_changed ? (
                        <div className="flex items-center justify-center gap-1">
                          {item.price_change.pvp_percentage > 0 ? (
                            <TrendingUp className="w-4 h-4 text-red-500" />
                          ) : (
                            <TrendingDown className="w-4 h-4 text-green-500" />
                          )}
                          <span
                            className={`text-sm font-medium ${
                              item.price_change.pvp_percentage > 0 ? "text-red-600" : "text-green-600"
                            }`}
                          >
                            {item.price_change.pvp_percentage > 0 ? "+" : ""}
                            {item.price_change.pvp_percentage.toFixed(1)}%
                          </span>
                        </div>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          Sin cambio
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="border border-slate-200 text-center hidden md:table-cell">
                      {new Date(item.latest_date).toLocaleDateString("es-ES")}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredData.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={10} className="text-center py-8 text-gray-500">
                      No se encontraron SKUs que coincidan con los filtros
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          
          {/* Controles de Paginación */}
          <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
            <div className="text-sm text-slate-500">
              Mostrando {filteredData.length > 0 ? startIndex + 1 : 0} a {Math.min(endIndex, filteredData.length)} de {filteredData.length} productos
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
    </div>
  )
}
