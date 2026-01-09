"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Download, DollarSign, Filter, X, Settings, Trash2, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { logActivity, hasPermission, getCurrentUser } from "@/lib/auth"
import { logError } from "@/lib/logger"
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
  company: string
  channel: string
  date_entered: string
  stock_status: string
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

interface PreciosPublicarProps {
  inventory: InventoryItem[]
  suppliers: Supplier[]
  brands: Brand[]
  cuotasConfig: {
    cuotas_3_percentage: number
    cuotas_6_percentage: number
    cuotas_9_percentage: number
    cuotas_12_percentage: number
  }
  onUpdateCuotasConfig: (newConfig: {
    cuotas_3_percentage: number
    cuotas_6_percentage: number
    cuotas_9_percentage: number
    cuotas_12_percentage: number
  }) => Promise<void>
}

export function PreciosPublicar({
  inventory,
  suppliers,
  brands,
  cuotasConfig,
  onUpdateCuotasConfig,
}: PreciosPublicarProps) {
  const currentUser = getCurrentUser()
  const isReadOnly = currentUser?.role === "viewer"

  const [promociones, setPromociones] = useState<{ [key: string]: number }>({})

  const [filters, setFilters] = useState({
    searchSku: "",
    supplier: "all",
    brand: "all",
    company: "all",
  })

  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage, setItemsPerPage] = useState(50)

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, itemsPerPage])

  useEffect(() => {
    // Cargar promociones guardadas desde localStorage
    const savedPromociones = localStorage.getItem("maycam-promociones")
    if (savedPromociones) {
      try {
        const parsedPromociones = JSON.parse(savedPromociones)
        setPromociones(parsedPromociones)
      } catch (error) {
        logError("Error al cargar promociones guardadas:", error)
      }
    }
  }, [])

  const getFilteredInventory = () => {
    let filtered = [...inventory]

    if (filters.searchSku && filters.searchSku.trim()) {
      filtered = filtered.filter((item) => item.sku.toLowerCase().includes(filters.searchSku.toLowerCase().trim()))
    }

    if (filters.supplier && filters.supplier !== "all") {
      filtered = filtered.filter((item) => item.supplier_id?.toString() === filters.supplier)
    }

    if (filters.brand && filters.brand !== "all") {
      filtered = filtered.filter((item) => item.brand_id?.toString() === filters.brand)
    }

    if (filters.company && filters.company !== "all") {
      filtered = filtered.filter((item) => item.company === filters.company)
    }

    return filtered
  }

  const calculatePriceWithPromotion = (basePrice: number, promoPercentage: number) => {
    return basePrice * (1 - promoPercentage / 100)
  }

  const calculateInstallmentPrice = (basePrice: number, installmentPercentage: number) => {
    return basePrice * (1 + installmentPercentage / 100)
  }

  const handlePromocionChange = (id: number, sku: string, value: string) => {
    const percentage = Number.parseFloat(value) || 0
    const previousPercentage = promociones[id] || 0
    const newPromociones = {
      ...promociones,
      [id]: percentage,
    }
    setPromociones(newPromociones)

    // Guardar en localStorage
    localStorage.setItem("maycam-promociones", JSON.stringify(newPromociones))

    // Registrar en el log solo si hay un cambio significativo
    if (Math.abs(percentage - previousPercentage) > 0) {
      const action = percentage > 0 ? "PROMOCION_APLICADA" : "PROMOCION_REMOVIDA"
      const description =
        percentage > 0
          ? `Promoción aplicada: ${percentage}% de descuento en SKU ${sku} (ID: ${id})`
          : `Promoción removida del SKU ${sku} (ID: ${id})`

      logActivity(
        action,
        null,
        null,
        null,
        {
          sku: sku,
          product_id: id,
          previous_percentage: previousPercentage,
          new_percentage: percentage,
          module: "precios_publicar",
        },
        description,
      )
    }
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

  const exportPreciosToExcel = () => {
    if (!hasPermission("EXPORT")) {
      toast({
        title: "Sin permisos",
        description: "No tiene permisos para exportar datos",
        variant: "destructive",
      })
      return
    }

    const filtered = getFilteredInventory()

    const headers = [
      "SKU",
      "EAN",
      "Nombre",
      "Costo c/IVA",
      "PVP c/IVA",
      "Cantidad",
      "Empresa",
      "3 Cuotas",
      "6 Cuotas",
      "9 Cuotas",
      "12 Cuotas",
      "Promoción %",
    ]

    const csvRows = filtered.map((item) => {
      const promocion = promociones[item.id] || 0
      const basePrice = item.pvp_with_tax
      const priceWithPromo = calculatePriceWithPromotion(basePrice, promocion)

      return [
        item.sku,
        item.ean || "",
        item.description,
        `$${item.cost_with_tax.toFixed(2)}`,
        `$${basePrice.toFixed(2)}`,
        item.quantity,
        item.company,
        `$${calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_3_percentage).toFixed(2)}`,
        `$${calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_6_percentage).toFixed(2)}`,
        `$${calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_9_percentage).toFixed(2)}`,
        `$${calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_12_percentage).toFixed(2)}`,
        promocion > 0 ? `${promocion}%` : "",
      ]
    })

    const excelContent = `
<html>
<head>
<meta charset="utf-8">
<style>
.header { 
  background-color: #F59E0B; 
  color: white; 
  font-weight: bold; 
  text-align: center; 
  padding: 8px;
  border: 1px solid #D97706;
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
.promocion { background-color: #FEF3C7; font-weight: bold; }
</style>
</head>
<body>
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
    return `<tr>
    <td class="data">${row[0]}</td>
    <td class="data">${row[1]}</td>
    <td class="data">${row[2]}</td>
    <td class="data-number">${row[3]}</td>
    <td class="data-number">${row[4]}</td>
    <td class="data-center">${row[5]}</td>
    <td class="data-center ${empresaClass}">${row[6]}</td>
    <td class="data-number">${row[7]}</td>
    <td class="data-number">${row[8]}</td>
    <td class="data-number">${row[9]}</td>
    <td class="data-number">${row[10]}</td>
    <td class="data-center ${promociones[item.id] > 0 ? "promocion" : ""}">${row[11]}</td>
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
    a.download = `precios_publicar_maycam_${new Date().toISOString().split("T")[0]}.xls`
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
      { count: filtered.length, type: "precios_publicar" },
      `Exportación de precios a publicar: ${filtered.length} productos`,
    )

    toast({
      title: "Exportación completada",
      description: `Se exportaron ${filtered.length} productos con precios de publicación`,
    })
  }

  const filteredInventory = getFilteredInventory()
  
  // Lógica de paginación
  const totalPages = Math.ceil(filteredInventory.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const endIndex = startIndex + itemsPerPage
  const currentItems = filteredInventory.slice(startIndex, endIndex)

  return (
    <div className="space-y-6">
      {/* Header con zócalo amarillo */}
      <Card className="shadow-lg border-0 bg-gradient-to-r from-yellow-400 to-amber-500 text-white">
        <CardHeader className="pb-4 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-3 text-2xl font-bold">
              <DollarSign className="w-8 h-8" />
              Precios a Publicar
            </CardTitle>
            <p className="text-yellow-100 text-lg mt-1">
              Gestione los precios de venta con cuotas y promociones para publicación
            </p>
          </div>
          <Button
            onClick={exportPreciosToExcel}
            className="bg-white text-amber-600 hover:bg-yellow-50 font-bold shadow-md"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar precios
          </Button>
        </CardHeader>
      </Card>

      {/* Filtros */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <Filter className="w-3.5 h-3.5 text-slate-500" />
          <h3 className="text-sm font-semibold text-slate-700">Filtros de Precios</h3>
          <div className="ml-auto flex gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                setFilters({
                  searchSku: "",
                  supplier: "all",
                  brand: "all",
                  company: "all",
                })
              }
              className="h-6 text-xs text-slate-400 hover:text-red-500 px-2"
            >
              <X className="w-3 h-3 mr-1" />
              Limpiar Filtros
            </Button>
            {!isReadOnly && (
              <Button
                onClick={() => {
                  setPromociones({})
                  localStorage.removeItem("maycam-promociones")
                  toast({
                    title: "Promociones limpiadas",
                    description: "Todas las promociones han sido eliminadas",
                  })
                }}
                variant="ghost"
                size="sm"
                className="h-6 text-xs text-orange-400 hover:text-orange-600 px-2"
              >
                <Trash2 className="w-3 h-3 mr-1" />
                Limpiar Promos
              </Button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
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
              Buscar SKU
            </Label>
            <Input
              id="searchSku"
              type="text"
              placeholder="Buscar por SKU..."
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
        </div>
      </div>

      {/* Tabla de Precios */}
      <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
        <CardHeader className="bg-gradient-to-r from-amber-50 to-yellow-50 rounded-t-lg">
          <CardTitle className="text-amber-800">
            Lista de Precios a Publicar ({filteredInventory.length} productos)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-gradient-to-r from-yellow-500 to-amber-600">
                  <TableHead className="font-bold text-white text-center border border-slate-300">SKU</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">EAN</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">
                    Nombre
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    Costo c/IVA
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">PVP c/IVA</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">Cantidad</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">Empresa</TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">
                    3 Cuotas (+{cuotasConfig.cuotas_3_percentage}%)
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    6 Cuotas (+{cuotasConfig.cuotas_6_percentage}%)
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    9 Cuotas (+{cuotasConfig.cuotas_9_percentage}%)
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300 hidden md:table-cell">
                    12 Cuotas (+{cuotasConfig.cuotas_12_percentage}%)
                  </TableHead>
                  <TableHead className="font-bold text-white text-center border border-slate-300">
                    Promoción (%)
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentItems.map((item) => {
                  const promocion = promociones[item.id] || 0
                  const basePrice = item.pvp_with_tax
                  const priceWithPromo = calculatePriceWithPromotion(basePrice, promocion)

                  return (
                    <TableRow key={item.id} className="hover:bg-slate-50/50">
                      <TableCell className="font-medium border border-slate-200">{item.sku}</TableCell>
                      <TableCell className="border border-slate-200 hidden md:table-cell">{item.ean || "-"}</TableCell>
                      <TableCell className="border border-slate-200 max-w-xs">{item.description}</TableCell>
                      <TableCell className="border border-slate-200 text-center hidden md:table-cell">
                        {formatCurrency(item.cost_with_tax)}
                      </TableCell>
                      <TableCell className="border border-slate-200 text-center">
                        {promocion > 0 ? (
                          <div className="space-y-1">
                            <div className="line-through text-gray-500 text-sm">{formatCurrency(basePrice)}</div>
                            <div className="text-green-600 font-bold">{formatCurrency(priceWithPromo)}</div>
                          </div>
                        ) : (
                          <div>{formatCurrency(basePrice)}</div>
                        )}
                      </TableCell>
                      <TableCell className="border border-slate-200 text-center">{item.quantity}</TableCell>
                      <TableCell className="border border-slate-200 text-center hidden md:table-cell">
                        <Badge variant="outline" className={getCompanyBadgeColor(item.company)}>
                          {item.company}
                        </Badge>
                      </TableCell>
                      <TableCell className="border border-slate-200 text-center font-medium text-blue-600">
                        {formatCurrency(calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_3_percentage))}
                      </TableCell>
                      <TableCell className="border border-slate-200 text-center font-medium text-blue-600 hidden md:table-cell">
                        {formatCurrency(calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_6_percentage))}
                      </TableCell>
                      <TableCell className="border border-slate-200 text-center font-medium text-blue-600 hidden md:table-cell">
                        {formatCurrency(calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_9_percentage))}
                      </TableCell>
                      <TableCell className="border border-slate-200 text-center font-medium text-blue-600 hidden md:table-cell">
                        {formatCurrency(calculateInstallmentPrice(priceWithPromo, cuotasConfig.cuotas_12_percentage))}
                      </TableCell>
                      <TableCell className="border border-slate-200">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          placeholder="0"
                          value={promociones[item.id] || ""}
                          onChange={(e) => handlePromocionChange(item.id, item.sku, e.target.value)}
                          className="w-20 text-center"
                          disabled={isReadOnly}
                        />
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </div>
          
          {/* Controles de Paginación */}
          <div className="flex items-center justify-between px-4 py-4 border-t border-slate-200 bg-slate-50 rounded-b-lg">
            <div className="text-sm text-slate-500">
              Mostrando {filteredInventory.length > 0 ? startIndex + 1 : 0} a {Math.min(endIndex, filteredInventory.length)} de {filteredInventory.length} productos
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
