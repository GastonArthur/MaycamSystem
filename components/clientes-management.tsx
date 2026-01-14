"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Search, Edit, Trash2, Plus, Mail, Phone, RefreshCw, Users } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import { getCurrentUser } from "@/lib/auth"
import { logError } from "@/lib/logger"
import { supabase, isSupabaseConfigured } from "@/lib/supabase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type ClientType = "mayorista" | "minorista"

type UnifiedClient = {
  id: number
  original_id: number // ID in the source table
  type: ClientType
  name: string
  identifier: string // CUIT or DNI
  email: string
  phone: string // WhatsApp or Phone
  address: string
  city: string
  province: string
  created_at: string
  // Specific fields
  business_name?: string
  contact_person?: string
  zip_code?: string
}

type ClientesManagementProps = {}

export function ClientesManagement() {
  const currentUser = getCurrentUser()
  const isReadOnly = currentUser?.role === "viewer"

  const [clients, setClients] = useState<UnifiedClient[]>([])
  const [filteredClients, setFilteredClients] = useState<UnifiedClient[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "mayorista" | "minorista">("all")

  const [showClientForm, setShowClientForm] = useState(false)
  const [editingClient, setEditingClient] = useState<UnifiedClient | null>(null)
  const [viewingClient, setViewingClient] = useState<UnifiedClient | null>(null)

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    identifier: "",
    email: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    business_name: "",
    contact_person: "",
    zip_code: "",
    type: "minorista" as ClientType,
  })

  useEffect(() => {
    loadClients()
  }, [])

  useEffect(() => {
    filterClients()
  }, [clients, searchTerm, typeFilter])

  const loadClients = async () => {
    setIsLoading(true)
    const allClients: UnifiedClient[] = []

    try {
      if (isSupabaseConfigured) {
        // Fetch Wholesale Clients
        const { data: wholesaleData, error: wholesaleError } = await supabase.from("wholesale_clients").select("*")

        if (wholesaleError) throw wholesaleError

        if (wholesaleData) {
          wholesaleData.forEach((c: any) => {
            allClients.push({
              id: c.id + 1000000, // Offset to avoid ID collision in UI
              original_id: c.id,
              type: "mayorista",
              name: c.name,
              identifier: c.cuit,
              email: c.email,
              phone: c.whatsapp,
              address: c.address,
              city: c.city || "",
              province: c.province,
              created_at: c.created_at,
              business_name: c.business_name,
              contact_person: c.contact_person,
            })
          })
        }

        // Fetch Retail Clients
        const { data: retailData, error: retailError } = await supabase.from("retail_clients").select("*")

        if (retailError) throw retailError

        if (retailData) {
          retailData.forEach((c: any) => {
            allClients.push({
              id: c.id, // Keep original ID for retail
              original_id: c.id,
              type: "minorista",
              name: c.name,
              identifier: c.dni_cuit,
              email: c.email,
              phone: c.phone,
              address: c.address,
              city: c.city,
              province: c.province,
              created_at: c.created_at,
              zip_code: c.zip_code,
            })
          })
        }
      } else {
        // Offline mock data
        allClients.push(
          {
            id: 1000001,
            original_id: 1,
            type: "mayorista",
            name: "Distribuidora Norte",
            identifier: "30-12345678-9",
            email: "juan@norte.com",
            phone: "1123456789",
            address: "Av Libertador 123",
            city: "CABA",
            province: "Buenos Aires",
            created_at: new Date().toISOString(),
            business_name: "Distribuidora Norte S.A.",
            contact_person: "Juan Perez",
          },
          {
            id: 1,
            original_id: 1,
            type: "minorista",
            name: "Maria Gonzalez",
            identifier: "27-87654321-0",
            email: "maria@gmail.com",
            phone: "1198765432",
            address: "Calle Falsa 123",
            city: "La Plata",
            province: "Buenos Aires",
            created_at: new Date().toISOString(),
            zip_code: "1900",
          },
        )
      }

      setClients(allClients)
    } catch (error) {
      logError("Error loading clients", error)
      toast({
        title: "Error",
        description: "No se pudieron cargar los clientes",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const filterClients = () => {
    let filtered = [...clients]

    if (searchTerm) {
      const lowerTerm = searchTerm.toLowerCase()
      filtered = filtered.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerTerm) ||
          c.identifier.includes(searchTerm) ||
          c.email.toLowerCase().includes(lowerTerm) ||
          c.business_name?.toLowerCase().includes(lowerTerm),
      )
    }

    if (typeFilter !== "all") {
      filtered = filtered.filter((c) => c.type === typeFilter)
    }

    setFilteredClients(filtered)
  }

  const handleSwitchType = async (client: UnifiedClient) => {
    if (isReadOnly) return

    const newType = client.type === "mayorista" ? "minorista" : "mayorista"

    if (!confirm(`¿Está seguro de cambiar a ${client.name} de ${client.type} a ${newType}?`)) {
      return
    }

    setIsLoading(true)

    try {
      if (isSupabaseConfigured) {
        // 1. Insert into new table
        if (newType === "mayorista") {
          // Retail -> Wholesale
          const { error: insertError } = await supabase.from("wholesale_clients").insert({
            name: client.name,
            business_name: client.name, // Default
            cuit: client.identifier,
            address: client.address,
            city: client.city,
            province: client.province,
            contact_person: client.name, // Default
            email: client.email,
            whatsapp: client.phone,
          })

          if (insertError) throw insertError
        } else {
          // Wholesale -> Retail
          const { error: insertError } = await supabase.from("retail_clients").insert({
            name: client.name,
            dni_cuit: client.identifier,
            email: client.email,
            phone: client.phone,
            province: client.province,
            city: client.city,
            zip_code: client.zip_code || "",
            address: client.address,
          })

          if (insertError) throw insertError
        }

        // 2. Delete from old table
        const table = client.type === "mayorista" ? "wholesale_clients" : "retail_clients"
        const { error: deleteError } = await supabase.from(table).delete().eq("id", client.original_id)

        if (deleteError) {
          // Warning: Data duplicated but not deleted
          toast({
            title: "Advertencia",
            description: "El cliente se copió pero no se pudo eliminar del origen.",
            variant: "destructive",
          })
        } else {
          toast({
            title: "Cambio exitoso",
            description: `Cliente movido a ${newType} correctamente.`,
          })
        }

        // Reload
        await loadClients()
      } else {
        // Mock update
        const updatedClients = clients.map((c) => {
          if (c.id === client.id) {
            return {
              ...c,
              type: newType,
            }
          }
          return c
        })
        setClients(updatedClients)
        toast({
          title: "Cambio exitoso (Offline)",
          description: `Cliente movido a ${newType} correctamente.`,
        })
      }
    } catch (error) {
      logError("Error switching client type", error)
      toast({
        title: "Error",
        description: "No se pudo cambiar el tipo de cliente",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async (client: UnifiedClient) => {
    if (isReadOnly) return
    if (!confirm(`¿Eliminar cliente ${client.name}?`)) return

    try {
      if (isSupabaseConfigured) {
        const table = client.type === "mayorista" ? "wholesale_clients" : "retail_clients"
        const { error } = await supabase.from(table).delete().eq("id", client.original_id)

        if (error) throw error

        toast({ title: "Cliente eliminado" })
        loadClients()
      } else {
        setClients((prev) => prev.filter((c) => c.id !== client.id))
        toast({ title: "Cliente eliminado (Offline)" })
      }
    } catch (error) {
      logError("Error deleting client", error)
      toast({ title: "Error", description: "No se pudo eliminar el cliente", variant: "destructive" })
    }
  }

  const handleSaveClient = async () => {
    if (!formData.name || !formData.identifier) {
      toast({ title: "Error", description: "Nombre e Identificador son requeridos", variant: "destructive" })
      return
    }

    try {
      if (isSupabaseConfigured) {
        if (editingClient) {
          // Update
          if (editingClient.type === "mayorista") {
            const { error } = await supabase
              .from("wholesale_clients")
              .update({
                name: formData.name,
                business_name: formData.business_name,
                cuit: formData.identifier,
                email: formData.email,
                whatsapp: formData.phone,
                address: formData.address,
                city: formData.city,
                province: formData.province,
                contact_person: formData.contact_person,
              })
              .eq("id", editingClient.original_id)
            if (error) throw error
          } else {
            const { error } = await supabase
              .from("retail_clients")
              .update({
                name: formData.name,
                dni_cuit: formData.identifier,
                email: formData.email,
                phone: formData.phone,
                province: formData.province,
                city: formData.city,
                zip_code: formData.zip_code,
                address: formData.address,
              })
              .eq("id", editingClient.original_id)
            if (error) throw error
          }
        } else {
          // Create
          if (formData.type === "mayorista") {
            const { error } = await supabase.from("wholesale_clients").insert({
              name: formData.name,
              business_name: formData.business_name,
              cuit: formData.identifier,
              email: formData.email,
              whatsapp: formData.phone,
              address: formData.address,
              city: formData.city,
              province: formData.province,
              contact_person: formData.contact_person,
            })
            if (error) throw error
          } else {
            const { error } = await supabase.from("retail_clients").insert({
              name: formData.name,
              dni_cuit: formData.identifier,
              email: formData.email,
              phone: formData.phone,
              province: formData.province,
              city: formData.city,
              zip_code: formData.zip_code,
              address: formData.address,
            })
            if (error) throw error
          }
        }
        loadClients()
      } else {
        // Offline
        toast({ title: "Guardado (Offline)" })
        // Implement offline logic if needed
      }

      setShowClientForm(false)
      setEditingClient(null)
      toast({ title: "Cliente guardado exitosamente" })
    } catch (error) {
      logError("Error saving client", error)
      toast({ title: "Error", description: "No se pudo guardar el cliente", variant: "destructive" })
    }
  }

  const openEdit = (client: UnifiedClient) => {
    setEditingClient(client)
    setFormData({
      name: client.name,
      identifier: client.identifier,
      email: client.email,
      phone: client.phone,
      address: client.address,
      city: client.city,
      province: client.province,
      business_name: client.business_name || "",
      contact_person: client.contact_person || "",
      zip_code: client.zip_code || "",
      type: client.type,
    })
    setShowClientForm(true)
  }

  const openNew = () => {
    setEditingClient(null)
    setFormData({
      name: "",
      identifier: "",
      email: "",
      phone: "",
      address: "",
      city: "",
      province: "",
      business_name: "",
      contact_person: "",
      zip_code: "",
      type: "minorista",
    })
    setShowClientForm(true)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-4 flex flex-col">
        <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm">
          <CardHeader className="bg-gradient-to-r from-cyan-50 to-sky-50 rounded-t-lg">
            <CardTitle className="flex items-center gap-2 text-sky-800">
              <Users className="w-5 h-5 text-sky-600" />
              Clientes
            </CardTitle>
            <CardDescription>Administre todos los clientes mayoristas y minoristas en un solo lugar</CardDescription>
          </CardHeader>
        </Card>
        {/* </CHANGE> */}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2">
          <Card className="bg-blue-600 text-white border-none shadow-md">
            <CardContent className="p-6">
              <div className="text-sm font-medium opacity-90">Total Clientes</div>
              <div className="text-3xl font-bold">{clients.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-purple-600 text-white border-none shadow-md">
            <CardContent className="p-6">
              <div className="text-sm font-medium opacity-90">Mayoristas</div>
              <div className="text-3xl font-bold">{clients.filter((c) => c.type === "mayorista").length}</div>
            </CardContent>
          </Card>
          <Card className="bg-emerald-500 text-white border-none shadow-md">
            <CardContent className="p-6">
              <div className="text-sm font-medium opacity-90">Minoristas</div>
              <div className="text-3xl font-bold">{clients.filter((c) => c.type === "minorista").length}</div>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-col gap-4 flex-1">
          {/* Filters */}
          <div className="bg-white p-4 rounded-lg border flex flex-wrap gap-4 items-center">
            <div className="relative w-64">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-gray-500" />
              <Input
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8"
              />
            </div>

            <Select value={typeFilter} onValueChange={(val: any) => setTypeFilter(val)}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Tipo de Cliente" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="mayorista">Mayoristas</SelectItem>
                <SelectItem value="minorista">Minoristas</SelectItem>
              </SelectContent>
            </Select>

            <Button onClick={openNew} className="ml-auto bg-purple-600 hover:bg-purple-700">
              <Plus className="w-4 h-4 mr-2" />
              Nuevo Cliente
            </Button>
          </div>

          {/* Table */}
          <div className="flex-1 overflow-auto border rounded-md hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Identificador</TableHead>
                  <TableHead>Contacto</TableHead>
                  <TableHead>Ubicación</TableHead>
                  <TableHead>Datos Adicionales</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClients.map((client) => (
                  <TableRow key={client.id}>
                    <TableCell className="font-medium">
                      <Button
                        variant="link"
                        className="p-0 h-auto font-medium text-purple-700 hover:text-purple-900 text-left whitespace-normal"
                        onClick={() => setViewingClient(client)}
                      >
                        {client.name}
                      </Button>
                      {client.business_name && <div className="text-xs text-gray-500">{client.business_name}</div>}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={client.type === "mayorista" ? "default" : "secondary"}
                        className="cursor-pointer hover:opacity-80"
                        onClick={() => handleSwitchType(client)}
                        title="Click para cambiar tipo"
                      >
                        {client.type === "mayorista" ? "Mayorista" : "Minorista"}
                        <RefreshCw className="w-3 h-3 ml-1 inline-block" />
                      </Badge>
                    </TableCell>
                    <TableCell>{client.identifier}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {client.email && (
                          <div className="flex items-center gap-1">
                            <Mail className="w-3 h-3" /> {client.email}
                          </div>
                        )}
                        {client.phone && (
                          <div className="flex items-center gap-1">
                            <Phone className="w-3 h-3" /> {client.phone}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">
                        {client.city && <span>{client.city}, </span>}
                        {client.province}
                        {client.address && <div className="text-xs text-gray-500">{client.address}</div>}
                      </div>
                    </TableCell>
                    <TableCell>
                      {client.type === "mayorista" && client.contact_person && (
                        <div className="text-xs">Contacto: {client.contact_person}</div>
                      )}
                      {client.type === "minorista" && client.zip_code && (
                        <div className="text-xs">CP: {client.zip_code}</div>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {!isReadOnly && (
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(client)}>
                            <Edit className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(client)}>
                            <Trash2 className="w-4 h-4 text-red-500" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
                {filteredClients.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No se encontraron clientes.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          <div className="md:hidden space-y-4">
            {filteredClients.map((client) => (
              <Card key={client.id} className="shadow-sm">
                <CardHeader className="p-4 pb-2">
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle
                        className="text-base font-bold text-purple-700"
                        onClick={() => setViewingClient(client)}
                      >
                        {client.name}
                      </CardTitle>
                      <CardDescription className="text-xs">{client.identifier}</CardDescription>
                    </div>
                    <Badge variant={client.type === "mayorista" ? "default" : "secondary"}>
                      {client.type === "mayorista" ? "M" : "m"}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="p-4 pt-2 text-sm space-y-2">
                  {client.email && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Mail className="w-3 h-3" /> <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-2 text-slate-600">
                      <Phone className="w-3 h-3" /> <span>{client.phone}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mt-2">
                    {client.city}, {client.province}
                  </div>
                  <div className="flex justify-end gap-2 pt-2 border-t">
                    <Button variant="outline" size="sm" className="h-7 bg-transparent" onClick={() => openEdit(client)}>
                      <Edit className="w-3 h-3" />
                    </Button>
                    <Button variant="destructive" size="sm" className="h-7" onClick={() => handleDelete(client)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {filteredClients.length === 0 && (
              <div className="text-center py-8 text-gray-500 bg-white rounded-lg border">
                No se encontraron clientes.
              </div>
            )}
          </div>
        </div>

        {/* Form Dialog */}
        <Dialog open={showClientForm} onOpenChange={setShowClientForm}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar Cliente" : "Nuevo Cliente"}</DialogTitle>
              <DialogDescription>
                Complete los datos del formulario para {editingClient ? "editar el" : "crear un nuevo"} cliente.
              </DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-4 py-4">
              <div className="col-span-2">
                <Label>Tipo de Cliente</Label>
                <Select
                  value={formData.type}
                  onValueChange={(val: ClientType) => setFormData((prev) => ({ ...prev, type: val }))}
                  disabled={!!editingClient}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="mayorista">Mayorista</SelectItem>
                    <SelectItem value="minorista">Minorista</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Nombre *</Label>
                <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} />
              </div>

              <div>
                <Label>{formData.type === "mayorista" ? "CUIT *" : "DNI/CUIT *"}</Label>
                <Input
                  value={formData.identifier}
                  onChange={(e) => setFormData({ ...formData, identifier: e.target.value })}
                />
              </div>

              {formData.type === "mayorista" && (
                <div>
                  <Label>Razón Social</Label>
                  <Input
                    value={formData.business_name}
                    onChange={(e) => setFormData({ ...formData, business_name: e.target.value })}
                  />
                </div>
              )}

              {formData.type === "mayorista" && (
                <div>
                  <Label>Persona de Contacto</Label>
                  <Input
                    value={formData.contact_person}
                    onChange={(e) => setFormData({ ...formData, contact_person: e.target.value })}
                  />
                </div>
              )}

              <div>
                <Label>Email</Label>
                <Input value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} />
              </div>

              <div>
                <Label>{formData.type === "mayorista" ? "WhatsApp" : "Teléfono"}</Label>
                <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
              </div>

              <div>
                <Label>Provincia</Label>
                <Input
                  value={formData.province}
                  onChange={(e) => setFormData({ ...formData, province: e.target.value })}
                />
              </div>

              <div>
                <Label>Ciudad</Label>
                <Input value={formData.city} onChange={(e) => setFormData({ ...formData, city: e.target.value })} />
              </div>

              <div>
                <Label>Dirección</Label>
                <Input
                  value={formData.address}
                  onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                />
              </div>

              {formData.type === "minorista" && (
                <div>
                  <Label>Código Postal</Label>
                  <Input
                    value={formData.zip_code}
                    onChange={(e) => setFormData({ ...formData, zip_code: e.target.value })}
                  />
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setShowClientForm(false)}>
                Cancelar
              </Button>
              <Button onClick={handleSaveClient} className="bg-purple-600 hover:bg-purple-700">
                Guardar
              </Button>
            </div>
          </DialogContent>
        </Dialog>
        {viewingClient && (
          <Dialog open={!!viewingClient} onOpenChange={(open) => !open && setViewingClient(null)}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Información del Cliente</DialogTitle>
                <DialogDescription>Detalles completos del cliente {viewingClient.type}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={viewingClient.type === "mayorista" ? "default" : "secondary"}>
                    {viewingClient.type === "mayorista" ? "Mayorista" : "Minorista"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Nombre</Label>
                    <div className="font-medium">{viewingClient.name}</div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Identificador</Label>
                    <div className="font-medium">{viewingClient.identifier || "-"}</div>
                  </div>
                </div>

                {viewingClient.type === "mayorista" && (
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-xs text-gray-500">Razón Social</Label>
                      <div className="font-medium">{viewingClient.business_name || "-"}</div>
                    </div>
                    <div>
                      <Label className="text-xs text-gray-500">Persona de Contacto</Label>
                      <div className="font-medium">{viewingClient.contact_person || "-"}</div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-gray-500">Email</Label>
                    <div className="font-medium truncate" title={viewingClient.email}>
                      {viewingClient.email || "-"}
                    </div>
                  </div>
                  <div>
                    <Label className="text-xs text-gray-500">Teléfono/WhatsApp</Label>
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

                {viewingClient.type === "minorista" && (
                  <div>
                    <Label className="text-xs text-gray-500">Código Postal</Label>
                    <div className="font-medium">{viewingClient.zip_code || "-"}</div>
                  </div>
                )}

                <div className="flex justify-end pt-4">
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
