"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { User, LogOut, Activity, ChevronDown, Settings } from "lucide-react"
import { getCurrentUser, logout, hasPermission, updateUser } from "@/lib/auth"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { ActivityLogs } from "@/components/activity-logs"
import { UserManagement } from "@/components/user-management"

interface UserHeaderProps {
  onLogout: () => void
  setActiveTab: (tab: string) => void
}

export function UserHeader({ onLogout, setActiveTab }: UserHeaderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)
  const [isLogsOpen, setIsLogsOpen] = useState(false)
  const [isUsersOpen, setIsUsersOpen] = useState(false)
  const [profileData, setProfileData] = useState({
    name: "",
    email: "",
    password: "",
  })
  const dropdownRef = useRef<HTMLDivElement>(null)
  const user = getCurrentUser()

  useEffect(() => {
    if (user) {
      setProfileData({
        name: user.name,
        email: user.email,
        password: "",
      })
    }
  }, [user, isProfileOpen])

  // Cerrar dropdown al hacer clic fuera
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [])

  if (!user) return null

  const handleLogout = async () => {
    setIsOpen(false)
    await logout()
    onLogout()
  }

  const handleShowLogs = () => {
    setIsOpen(false)
    setIsLogsOpen(true)
  }

  const handleShowUsers = () => {
    setIsOpen(false)
    setIsUsersOpen(true)
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

  const handleSaveProfile = async () => {
    if (!user) return

    try {
      const result = await updateUser(user.id, {
        name: profileData.name,
        email: profileData.email,
        password: profileData.password || undefined,
      })

      if (result.success) {
        toast({
          title: "Perfil actualizado",
          description: "Los cambios se han guardado correctamente.",
        })
        setIsProfileOpen(false)
        setProfileData((prev) => ({ ...prev, password: "" }))
      } else {
        toast({
          title: "Error",
          description: result.error || "No se pudo actualizar el perfil",
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Ocurrió un error inesperado",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="flex items-center gap-3">
        <div className="text-right hidden md:block">
          <p className="text-sm font-medium text-slate-900">{user.name}</p>
          <p className="text-xs text-slate-500">{user.email}</p>
        </div>
        <Badge variant="outline" className={getRoleColor(user.role)}>
          {getRoleLabel(user.role)}
        </Badge>
      </div>

      <div className="relative" ref={dropdownRef}>
        <Button
          variant="ghost"
          className="relative h-10 px-3 rounded-full border border-slate-200 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          onClick={() => setIsOpen(!isOpen)}
        >
          <div className="flex items-center gap-2">
            <Avatar className="h-8 w-8">
              <AvatarFallback className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm">
                {user.name.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
            />
          </div>
        </Button>

        {isOpen && (
          <div className="absolute right-0 top-full mt-2 w-56 bg-white border border-slate-200 rounded-md shadow-lg z-50 animate-in fade-in-0 zoom-in-95">
            {/* Header del dropdown */}
            <div className="px-3 py-3 border-b border-slate-200">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none text-slate-900">{user.name}</p>
                <p className="text-xs leading-none text-slate-500">{user.email}</p>
                <div className="flex gap-1 mt-2">
                  <Badge variant="outline" className={`${getRoleColor(user.role)} w-fit text-xs`}>
                    {getRoleLabel(user.role)}
                  </Badge>

                </div>
              </div>
            </div>

            {/* Items del menú */}
            <div className="py-1">
              {hasPermission("VIEW_LOGS") && (
                <button
                  onClick={handleShowLogs}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center text-slate-700 transition-colors"
                >
                  <Activity className="mr-2 h-4 w-4 text-slate-600" />
                  <span>Ver Logs de Actividad</span>
                </button>
              )}



              {user.role === "admin" && (
                <button
                  onClick={handleShowUsers}
                  className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center text-slate-700 transition-colors"
                >
                  <User className="mr-2 h-4 w-4 text-slate-600" />
                  <span>Gestionar Usuarios</span>
                </button>
              )}

              <button
                onClick={() => {
                  setIsOpen(false)
                  setIsProfileOpen(true)
                }}
                className="w-full px-3 py-2 text-left hover:bg-slate-50 flex items-center text-slate-700 transition-colors"
              >
                <Settings className="mr-2 h-4 w-4 text-slate-600" />
                <span>Editar Perfil</span>
              </button>

              <div className="border-t border-slate-200 my-1"></div>

              <button
                onClick={handleLogout}
                className="w-full px-3 py-2 text-left hover:bg-red-50 flex items-center text-red-600 transition-colors"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Cerrar Sesión</span>
              </button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Editar Perfil</DialogTitle>
            <DialogDescription>
              Actualiza tu información personal aquí.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="name" className="text-right">
                Nombre
              </Label>
              <Input
                id="name"
                value={profileData.name}
                onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="email" className="text-right">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={profileData.email}
                onChange={(e) => setProfileData({ ...profileData, email: e.target.value })}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="password" className="text-right">
                Nueva Clave
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Opcional"
                value={profileData.password}
                onChange={(e) => setProfileData({ ...profileData, password: e.target.value })}
                className="col-span-3"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" onClick={handleSaveProfile}>Guardar cambios</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isLogsOpen} onOpenChange={setIsLogsOpen}>
        <DialogContent className="max-w-[90vw] h-[90vh] overflow-y-auto">
          <ActivityLogs />
        </DialogContent>
      </Dialog>

      <Dialog open={isUsersOpen} onOpenChange={setIsUsersOpen}>
        <DialogContent className="max-w-[90vw] h-[90vh] overflow-y-auto">
          <UserManagement />
        </DialogContent>
      </Dialog>
    </div>
  )
}
