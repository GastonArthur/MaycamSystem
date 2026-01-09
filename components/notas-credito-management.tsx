"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FileText, Search, Plus, Download, Edit, Trash2, Check } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { formatCurrency } from "@/lib/utils"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"

// Tipos de datos
type CreditNoteStatus = "disponible" | "utilizada"

interface CreditNote {
  id: number
  number: string
  supplier: string
  items_count: number
  total: number
  date: string
  status: CreditNoteStatus
  description?: string
  imageUrl?: string
  created_at?: string
}

// Datos de ejemplo
const MOCK_DATA: CreditNote[] = [
  {
    id: 1,
    number: "NC-001-2024",
    supplier: "Proveedor A",
    items_count: 2,
    total: 5500.0,
    date: "2024-01-14",
    status: "disponible",
    description: "Devolución de mercadería dañada",
    imageUrl: "nc-001.jpg",
  },
  {
    id: 2,
    number: "NC-002-2024",
    supplier: "Proveedor B",
    items_count: 1,
    total: 1200.5,
    date: "2024-01-15",
    status: "utilizada",
    description: "Descuento por pronto pago",
    imageUrl: "nc-002.pdf",
  },
]

export function NotasCreditoManagement() {
  const [notes, setNotes] = useState<CreditNote[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const [supplierFilter, setSupplierFilter] = useState<string>("all")
  const [isNewNoteOpen, setIsNewNoteOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [imageFile, setImageFile] = useState<File | null>(null)

  // Estado para nueva nota
  const [newNote, setNewNote] = useState<Partial<CreditNote>>({
    number: "",
    supplier: "",
    total: 0,
    items_count: 1,
    status: "disponible",
    date: new Date().toISOString().split("T")[0],
    imageUrl: "",
  })

  useEffect(() => {
    loadNotes()
  }, [])

  const loadNotes = async () => {
    if (!isSupabaseConfigured) {
      setNotes(MOCK_DATA)
      return
    }
    try {
      const { data, error } = await supabase.from("credit_notes").select("*").order("created_at", { ascending: false })
      if (error) throw error
      setNotes(data || [])
    } catch (err) {
      toast({
        title: "Error al cargar",
        description: "No se pudieron cargar las notas de crédito.",
        variant: "destructive",
      })
    }
  }

  // Estadísticas
  const totalNotes = notes.length
  const totalAmount = notes.reduce((acc, note) => acc + note.total, 0)
  const availableNotes = notes.filter((n) => n.status === "disponible")
  const availableAmount = availableNotes.reduce((acc, note) => acc + note.total, 0)
  const usedNotes = notes.filter((n) => n.status === "utilizada")
  const usedAmount = usedNotes.reduce((acc, note) => acc + note.total, 0)

  // Filtrado
  const filteredNotes = notes.filter((note) => {
    const matchesSearch =
      note.number.toLowerCase().includes(searchTerm.toLowerCase()) ||
      note.supplier.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === "all" || note.status === statusFilter
    const matchesSupplier = supplierFilter === "all" || note.supplier === supplierFilter

    return matchesSearch && matchesStatus && matchesSupplier
  })

  // Manejadores
  const handleUseNote = async (id: number) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("credit_notes").update({ status: "utilizada" }).eq("id", id)
        if (error) throw error
        await loadNotes()
      } catch {
        toast({ title: "Error", description: "No se pudo marcar como utilizada", variant: "destructive" })
        return
      }
    } else {
      setNotes(notes.map((note) => (note.id === id ? { ...note, status: "utilizada" } : note)))
    }
    toast({
      title: "Nota de crédito utilizada",
      description: "La nota de crédito ha sido marcada como utilizada.",
      variant: "default",
    })
  }

  const handleDeleteNote = async (id: number) => {
    if (isSupabaseConfigured) {
      try {
        const { error } = await supabase.from("credit_notes").delete().eq("id", id)
        if (error) throw error
        await loadNotes()
      } catch {
        toast({ title: "Error", description: "No se pudo eliminar la nota", variant: "destructive" })
        return
      }
    } else {
      setNotes(notes.filter((note) => note.id !== id))
    }
    toast({
      title: "Nota eliminada",
      description: "La nota de crédito ha sido eliminada correctamente.",
    })
  }

  const handleSaveNote = async () => {
    // Imagen opcional de momento (sin storage integrado)
    const finalImageUrl = imageFile ? imageFile.name : newNote.imageUrl

    const payload = {
      number: newNote.number || `NC-${Date.now()}`,
      supplier: newNote.supplier || "Sin proveedor",
      items_count: newNote.items_count || 1,
      total: newNote.total || 0,
      date: newNote.date || new Date().toISOString().split("T")[0],
      status: newNote.status || "disponible",
      description: newNote.description || null,
      image_url: finalImageUrl || null,
    }

    try {
      if (isSupabaseConfigured) {
        if (editingId) {
          const { error } = await supabase
            .from("credit_notes")
            .update({
              number: payload.number,
              supplier: payload.supplier,
              items_count: payload.items_count,
              total: payload.total,
              date: payload.date,
              status: payload.status,
              description: payload.description,
              image_url: payload.image_url,
            })
            .eq("id", editingId)
          if (error) throw error
          toast({ title: "Nota actualizada", description: "La nota de crédito ha sido modificada correctamente." })
        } else {
          const { error } = await supabase.from("credit_notes").insert([payload])
          if (error) throw error
          toast({ title: "Nota creada", description: "La nueva nota de crédito ha sido registrada." })
        }
        await loadNotes()
      } else {
        if (editingId) {
          setNotes(
            notes.map((note) =>
              note.id === editingId
                ? {
                    ...note,
                    number: payload.number,
                    supplier: payload.supplier,
                    items_count: payload.items_count,
                    total: payload.total,
                    date: payload.date,
                    status: payload.status as CreditNoteStatus,
                    description: payload.description || undefined,
                    imageUrl: payload.image_url || undefined,
                  }
                : note,
            ),
          )
          toast({ title: "Nota actualizada", description: "La nota de crédito ha sido modificada correctamente." })
        } else {
          const note: CreditNote = {
            id: Math.max(...notes.map((n) => n.id), 0) + 1,
            number: payload.number,
            supplier: payload.supplier,
            items_count: payload.items_count,
            total: payload.total,
            date: payload.date,
            status: payload.status as CreditNoteStatus,
            description: payload.description || undefined,
            imageUrl: payload.image_url || undefined,
          }
          setNotes([...notes, note])
          toast({ title: "Nota creada", description: "La nueva nota de crédito ha sido registrada." })
        }
      }
      handleCloseDialog()
    } catch (err) {
      toast({ title: "Error", description: "No se pudo guardar la nota de crédito.", variant: "destructive" })
    }
  }

  const handleCloseDialog = () => {
    setIsNewNoteOpen(false)
    setEditingId(null)
    setImageFile(null)
    setNewNote({
      number: "",
      supplier: "",
      total: 0,
      items_count: 1,
      status: "disponible",
      date: new Date().toISOString().split("T")[0],
      imageUrl: "",
    })
  }

  const handleEditNote = (note: CreditNote) => {
    setEditingId(note.id)
    setNewNote({
      number: note.number,
      supplier: note.supplier,
      total: note.total,
      items_count: note.items_count,
      status: note.status,
      date: note.date,
      description: note.description,
      imageUrl: note.imageUrl,
    })
    setIsNewNoteOpen(true)
  }

  return (
    <div className="space-y-6 p-4">
      <div className="bg-gradient-to-r from-pink-50 to-rose-50 rounded-lg p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          <FileText className="h-5 w-5 text-pink-600" />

        </div>
        <p className="text-sm text-muted-foreground">
          Control completo de notas de crédito de proveedores con múltiples productos
        </p>
      </div>

      {/* Tarjetas de Resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="bg-pink-600 text-white border-none shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
            <p className="text-pink-100 text-sm">Total Notas</p>
            <div className="text-2xl font-bold">{totalNotes}</div>
            <p className="text-xs text-pink-100">
              {formatCurrency(totalAmount)}
              <span className="block mt-1 opacity-80">{notes.length} items</span>
            </p>
          </CardContent>
        </Card>

        <Card className="bg-emerald-500 text-white border-none shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
            <p className="text-emerald-100 text-sm">Disponibles</p>
            <div className="text-2xl font-bold">{availableNotes.length}</div>
            <p className="text-xs text-emerald-100">{formatCurrency(availableAmount)}</p>
          </CardContent>
        </Card>

        <Card className="bg-slate-600 text-white border-none shadow-md">
          <CardContent className="p-6 flex flex-col items-center justify-center text-center min-h-[120px]">
            <p className="text-slate-100 text-sm">Utilizadas</p>
            <div className="text-2xl font-bold">{usedNotes.length}</div>
            <p className="text-xs text-slate-100">{formatCurrency(usedAmount)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Barra de Herramientas */}
      <div className="flex flex-col md:flex-row gap-4 items-end md:items-center justify-between bg-white p-4 rounded-lg border shadow-sm">
        <div className="flex flex-col md:flex-row gap-4 flex-1 w-full">
          <div className="w-full md:w-96 relative">
            <Label htmlFor="search" className="sr-only">
              Buscar
            </Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                id="search"
                placeholder="Número, proveedor, SKU..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="w-40">
              <Select value={supplierFilter} onValueChange={setSupplierFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Proveedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {Array.from(new Set(notes.map((n) => n.supplier))).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-40">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Estado" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="disponible">Disponible</SelectItem>
                  <SelectItem value="utilizada">Utilizada</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <Dialog open={isNewNoteOpen} onOpenChange={(open) => !open && handleCloseDialog()}>
            <DialogTrigger asChild>
              <Button className="bg-pink-600 hover:bg-pink-700 text-white" onClick={() => setIsNewNoteOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva Nota
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? "Editar Nota de Crédito" : "Nueva Nota de Crédito"}</DialogTitle>
                <DialogDescription>
                  {editingId
                    ? "Modifique los detalles de la nota de crédito."
                    : "Ingrese los detalles de la nueva nota de crédito."}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="number" className="text-right">
                    Número
                  </Label>
                  <Input
                    id="number"
                    value={newNote.number}
                    onChange={(e) => setNewNote({ ...newNote, number: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="supplier" className="text-right">
                    Proveedor
                  </Label>
                  <Input
                    id="supplier"
                    value={newNote.supplier}
                    onChange={(e) => setNewNote({ ...newNote, supplier: e.target.value })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="total" className="text-right">
                    Total
                  </Label>
                  <Input
                    id="total"
                    type="number"
                    value={newNote.total}
                    onChange={(e) => setNewNote({ ...newNote, total: Number(e.target.value) })}
                    className="col-span-3"
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="image" className="text-right">
                    Imagen *
                  </Label>
                  <div className="col-span-3">
                    <div className="flex items-center gap-2">
                      <Input
                        id="image"
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                        className="cursor-pointer"
                      />
                    </div>
                    {newNote.imageUrl && !imageFile && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Imagen actual: {newNote.imageUrl.split("/").pop()}
                      </p>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  Cancelar
                </Button>
                <Button onClick={handleSaveNote} className="bg-pink-600 hover:bg-pink-700">
                  Guardar
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" className="text-pink-600 border-pink-200 hover:bg-pink-50 bg-transparent">
            <Download className="mr-2 h-4 w-4" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Tabla */}
      <Card>
        <CardHeader>
          <CardTitle>Notas de Crédito ({filteredNotes.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Número</TableHead>
                <TableHead>Proveedor</TableHead>
                <TableHead className="text-center">Items</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Fecha Emisión</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredNotes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No se encontraron notas de crédito.
                  </TableCell>
                </TableRow>
              ) : (
                filteredNotes.map((note) => (
                  <TableRow key={note.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Plus className="h-3 w-3 text-muted-foreground cursor-pointer" />
                        {note.number}
                      </div>
                    </TableCell>
                    <TableCell>{note.supplier}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="rounded-full px-2">
                        {note.items_count}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-bold">{formatCurrency(note.total)}</TableCell>
                    <TableCell>{new Date(note.date).toLocaleDateString()}</TableCell>
                    <TableCell>
                      <Badge
                        className={
                          note.status === "disponible"
                            ? "bg-emerald-500 hover:bg-emerald-600"
                            : "bg-slate-500 hover:bg-slate-600"
                        }
                      >
                        {note.status === "disponible" ? "Disponible" : "Utilizada"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        {note.status === "disponible" && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-emerald-600 border-emerald-200 hover:bg-emerald-50 bg-transparent"
                            onClick={() => handleUseNote(note.id)}
                          >
                            <Check className="h-4 w-4 mr-1" />
                            Usar
                          </Button>
                        )}
                        {note.status !== "utilizada" && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={() => handleEditNote(note)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDeleteNote(note.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
