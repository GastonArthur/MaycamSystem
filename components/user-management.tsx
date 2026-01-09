"use client"

import { useState, useEffect } from "react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Switch } from "@/components/ui/switch"
import { UserPlus, Edit, Trash2, Shield, RefreshCw, Eye, EyeOff } from "lucide-react"
import { getUsers, createUser, updateUser, deleteUser, getCurrentUser, type User } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { logError } from "@/lib/logger"

interface UserManagementProps {
  // Removed props
}

export function UserManagement() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    name: "",
    password: "",
    role: "user" as "admin" | "user" | "viewer",
    can_view_logs: false,
    can_view_wholesale: false,
  })

  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [deleteConfirm, setDeleteConfirm] = useState<{
    show: boolean
    user: User | null
  }>({ show: false, user: null })

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const data = await getUsers()
      setUsers(data)
      console.log("👥 Usuarios cargados:", data)
    } catch (error) {
      logError("Error cargando usuarios:", error)
      toast({
        title: "Error",
        description: "Error al cargar los usuarios",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.email || !newUser.name || !newUser.password) {
      toast({
        title: "Campos requeridos",
        description: "Todos los campos son obligatorios",
        variant: "destructive",
      })
      return
    }

    try {
      const result = await createUser({
        ...newUser,
        can_view_wholesale: newUser.can_view_wholesale,
      })
      if (result.success) {
        toast({
          title: "Usuario creado",
          description: `Usuario ${newUser.name} creado exitosamente`,
        })
        setNewUser({
          email: "",
          name: "",
          password: "",
          role: "user",
          can_view_logs: false,
          can_view_wholesale: false,
        })
        setShowCreateForm(false)
        loadUsers() // Recargar la lista
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al crear usuario",
          variant: "destructive",
        })
      }
    } catch (error) {
      logError("Error creando usuario:", error)
      toast({
        title: "Error",
        description: "Error interno al crear usuario",
        variant: "destructive",
      })
    }
  }

  const handleUpdateUser = async (userId: number, updates: Partial<User>) => {
    try {
      const result = await updateUser(userId, updates)
      if (result.success) {
        toast({
          title: "Usuario actualizado",
          description: "Usuario actualizado exitosamente",
        })
        setEditingUser(null)
        loadUsers() // Recargar la lista
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al actualizar usuario",
          variant: "destructive",
        })
      }
    } catch (error) {
      logError("Error actualizando usuario:", error)
      toast({
        title: "Error",
        description: "Error interno al actualizar usuario",
        variant: "destructive",
      })
    }
  }

  const handleDeleteUser = async (userId: number) => {
    try {
      const result = await deleteUser(userId)
      if (result.success) {
        toast({
          title: "Usuario eliminado",
          description: "Usuario eliminado exitosamente",
        })
        setDeleteConfirm({ show: false, user: null })
        loadUsers() // Recargar la lista
      } else {
        toast({
          title: "Error",
          description: result.error || "Error al eliminar usuario",
          variant: "destructive",
        })
      }
    } catch (error) {
      logError("Error eliminando usuario:", error)
      toast({
        title: "Error",
        description: "Error interno al eliminar usuario",
        variant: "destructive",
      })
    }
  }

  const toggleUserStatus = async (userId: number, currentStatus: boolean) => {
    await handleUpdateUser(userId, { is_active: !currentStatus })
  }

  const toggleLogsAccess = async (userId: number, currentAccess: boolean) => {
    await handleUpdateUser(userId, { can_view_logs: !currentAccess })
  }

  const toggleWholesaleAccess = async (userId: number, currentAccess: boolean) => {
    await handleUpdateUser(userId, { can_view_wholesale: !currentAccess })
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200"
      case "user":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "viewer":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getRoleLabel = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrador"
      case "user":
        return "Usuario"
      case "viewer":
        return "Solo Lectura"
      default:
        return role
    }
  }

  const currentUser = getCurrentUser()

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Shield className="w-5 h-5" />
        <h2 className="text-xl font-semibold">Gestión de Usuarios</h2>
      </div>
      <p className="text-sm text-gray-500 mb-4">Administre los usuarios del sistema y sus permisos</p>

      <div className="space-y-4">
        {/* Botones de acción */}
          <div className="flex gap-4 items-center">
            <Button
              onClick={() => setShowCreateForm(true)}
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700"
            >
              <UserPlus className="w-4 h-4 mr-2" />
              Crear Usuario
            </Button>
            <Button onClick={loadUsers} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
              Actualizar
            </Button>
            <div className="text-sm text-gray-500">Total de usuarios: {users.length}</div>
          </div>

          {/* Tabla de usuarios */}
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead>Rol</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead className="hidden md:table-cell">Ver Logs</TableHead>
                  <TableHead className="hidden md:table-cell">Ver Mayoristas</TableHead>
                  <TableHead className="hidden md:table-cell">Fecha Creación</TableHead>
                  <TableHead>Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">
                      {editingUser?.id === user.id ? (
                        <Input
                          value={editingUser.name}
                          onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                          className="w-full"
                        />
                      ) : (
                        user.name
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {editingUser?.id === user.id ? (
                        <Input
                          type="email"
                          value={editingUser.email}
                          onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                          className="w-full"
                        />
                      ) : (
                        user.email
                      )}
                    </TableCell>
                    <TableCell>
                      {editingUser?.id === user.id ? (
                        <Select
                          value={editingUser.role}
                          onValueChange={(value: "admin" | "user" | "viewer") =>
                            setEditingUser({ ...editingUser, role: value })
                          }
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="viewer">Solo Lectura</SelectItem>
                            <SelectItem value="user">Usuario</SelectItem>
                            <SelectItem value="admin">Administrador</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={getRoleColor(user.role)}>
                          {getRoleLabel(user.role)}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingUser?.id === user.id ? (
                        <Select
                          value={editingUser.is_active ? "active" : "inactive"}
                          onValueChange={(value) => setEditingUser({ ...editingUser, is_active: value === "active" })}
                        >
                          <SelectTrigger className="w-full">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="active">Activo</SelectItem>
                            <SelectItem value="inactive">Inactivo</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant={user.is_active ? "default" : "secondary"}>
                            {user.is_active ? "Activo" : "Inactivo"}
                          </Badge>
                          {user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleUserStatus(user.id, user.is_active)}
                              className={`h-6 px-2 text-xs ${
                                user.is_active
                                  ? "text-orange-600 hover:bg-orange-100"
                                  : "text-green-600 hover:bg-green-100"
                              }`}
                            >
                              {user.is_active ? "Desactivar" : "Activar"}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {editingUser?.id === user.id ? (
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editingUser.can_view_logs}
                            onCheckedChange={(checked) => setEditingUser({ ...editingUser, can_view_logs: checked })}
                          />
                          <Label className="text-sm">{editingUser.can_view_logs ? "Sí" : "No"}</Label>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {user.can_view_logs ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            )}
                            <Badge variant={user.can_view_logs ? "default" : "secondary"} className="text-xs">
                              {user.can_view_logs ? "Sí" : "No"}
                            </Badge>
                          </div>
                          {user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleLogsAccess(user.id, user.can_view_logs)}
                              className={`h-6 px-2 text-xs ${
                                user.can_view_logs
                                  ? "text-red-600 hover:bg-red-100"
                                  : "text-green-600 hover:bg-green-100"
                              }`}
                            >
                              {user.can_view_logs ? "Quitar" : "Dar"}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {editingUser?.id === user.id ? (
                        <div className="flex items-center space-x-2">
                          <Switch
                            checked={editingUser.can_view_wholesale}
                            onCheckedChange={(checked) =>
                              setEditingUser({ ...editingUser, can_view_wholesale: checked })
                            }
                          />
                          <Label className="text-sm">{editingUser.can_view_wholesale ? "Sí" : "No"}</Label>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1">
                            {user.can_view_wholesale ? (
                              <Eye className="w-4 h-4 text-green-600" />
                            ) : (
                              <EyeOff className="w-4 h-4 text-gray-400" />
                            )}
                            <Badge variant={user.can_view_wholesale ? "default" : "secondary"} className="text-xs">
                              {user.can_view_wholesale ? "Sí" : "No"}
                            </Badge>
                          </div>
                          {user.id !== currentUser?.id && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => toggleWholesaleAccess(user.id, user.can_view_wholesale)}
                              className={`h-6 px-2 text-xs ${
                                user.can_view_wholesale
                                  ? "text-red-600 hover:bg-red-100"
                                  : "text-green-600 hover:bg-green-100"
                              }`}
                            >
                              {user.can_view_wholesale ? "Quitar" : "Dar"}
                            </Button>
                          )}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {new Date(user.created_at).toLocaleDateString("es-ES", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        {editingUser?.id === user.id ? (
                          <>
                            <Button
                              size="sm"
                              onClick={() => handleUpdateUser(user.id, editingUser)}
                              className="h-8 px-3 text-xs bg-green-600 hover:bg-green-700 text-white"
                            >
                              Guardar
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => setEditingUser(null)}
                              className="h-8 px-3 text-xs text-gray-600 hover:bg-gray-100"
                            >
                              Cancelar
                            </Button>
                          </>
                        ) : (
                          <>
                            {user.id !== currentUser?.id && (
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingUser(user)}
                                  className="h-8 w-8 p-0 text-blue-600 hover:bg-blue-100"
                                >
                                  <Edit className="w-3 h-3" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setDeleteConfirm({ show: true, user })}
                                  className="h-8 w-8 p-0 text-red-600 hover:bg-red-100"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </Button>
                              </>
                            )}
                            {user.id === currentUser?.id && (
                              <Badge variant="outline" className="text-xs">
                                Tú
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {users.length === 0 && !loading && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                      No hay usuarios registrados
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>

      {/* Modal para crear usuario */}
      <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Crear Nuevo Usuario</DialogTitle>
            <DialogDescription>Complete la información del nuevo usuario</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="newUserName">Nombre completo</Label>
              <Input
                id="newUserName"
                value={newUser.name}
                onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                placeholder="Juan Pérez"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newUserEmail">Email</Label>
              <Input
                id="newUserEmail"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                placeholder="juan@empresa.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newUserPassword">Contraseña</Label>
              <Input
                id="newUserPassword"
                type="password"
                value={newUser.password}
                onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="newUserRole">Rol</Label>
              <Select
                value={newUser.role}
                onValueChange={(value: "admin" | "user" | "viewer") => {
                  setNewUser({
                    ...newUser,
                    role: value,
                    // Auto-asignar acceso a logs y mayoristas si es admin
                    can_view_logs: value === "admin" ? true : newUser.can_view_logs,
                    can_view_wholesale: value === "admin" ? true : newUser.can_view_wholesale,
                  })
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar rol" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">Solo Lectura</SelectItem>
                  <SelectItem value="user">Usuario</SelectItem>
                  <SelectItem value="admin">Administrador</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="newUserCanViewLogs"
                checked={newUser.can_view_logs}
                onCheckedChange={(checked) => setNewUser({ ...newUser, can_view_logs: checked })}
              />
              <Label htmlFor="newUserCanViewLogs" className="text-sm font-medium">
                Puede ver logs de actividad
              </Label>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="newUserCanViewWholesale"
                checked={newUser.can_view_wholesale}
                onCheckedChange={(checked) => setNewUser({ ...newUser, can_view_wholesale: checked })}
              />
              <Label htmlFor="newUserCanViewWholesale" className="text-sm font-medium">
                Puede acceder a Ventas Mayoristas
              </Label>
            </div>
            {newUser.role === "admin" && (
              <div className="text-xs text-blue-600 bg-blue-50 p-2 rounded">
                💡 Los administradores tienen acceso a logs y mayoristas por defecto
              </div>
            )}
          </div>
          <div className="flex justify-end space-x-2">
            <Button type="button" variant="secondary" onClick={() => setShowCreateForm(false)}>
              Cancelar
            </Button>
            <Button type="submit" onClick={handleCreateUser}>
              Crear Usuario
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de confirmación de eliminación */}
      <Dialog open={deleteConfirm.show} onOpenChange={(show) => setDeleteConfirm({ ...deleteConfirm, show })}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Confirmar Eliminación</DialogTitle>
            <DialogDescription>
              ¿Está seguro de que desea eliminar al usuario "{deleteConfirm.user?.name}"? Esta acción no se puede
              deshacer.
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end space-x-2 pt-4">
            <Button type="button" variant="secondary" onClick={() => setDeleteConfirm({ show: false, user: null })}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="destructive"
              onClick={() => {
                if (deleteConfirm.user) {
                  handleDeleteUser(deleteConfirm.user.id)
                }
              }}
            >
              Eliminar Usuario
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
