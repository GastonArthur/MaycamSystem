"use client"

import {
  Package,
  BarChart3,
  Users,
  Tag,
  DollarSign,
  ShoppingBag,
  ShoppingCart,
  Receipt,
  LayoutDashboard,
  FileSpreadsheet,
  Settings,
  LogOut,
  UserCircle,
  TrendingUp,
  ShieldCheck,
  FileText,
  ChevronDown,
  ChevronRight,
  ChevronLeft,
  Store
} from "lucide-react"
import Link from "next/link"
import { useState, useEffect } from "react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuBadge,
  SidebarMenuItem,
  SidebarSeparator,
  SidebarTrigger,
  useSidebar,
} from "@/components/ui/sidebar"
import { Button } from "@/components/ui/button"

export type SidebarNavigationProps = {
  activeTab: string
  setActiveTab: (tab: string) => void
  onLogout: () => void
  userEmail?: string
  isOnline?: boolean
  lastSync?: Date | null
}

export function AppSidebar({
  activeTab,
  setActiveTab,
  onLogout,
  userEmail,
  isOnline = true,
  lastSync
}: SidebarNavigationProps) {

  const { state, toggleSidebar } = useSidebar()
  const isCollapsed = state === "collapsed"

  const handleNavigation = (tab: string) => {
    setActiveTab(tab)
  }
  const [gestionOpen, setGestionOpen] = useState(false)
  const [ventasOpen, setVentasOpen] = useState(false)
  const [finanzasOpen, setFinanzasOpen] = useState(false)
  const [catalogosOpen, setCatalogosOpen] = useState(false)

  useEffect(() => {
    try {
      const raw = localStorage.getItem("sidebar:sections")
      if (raw) {
        const s = JSON.parse(raw)
        if (typeof s.gestionOpen === "boolean") setGestionOpen(s.gestionOpen)
        if (typeof s.ventasOpen === "boolean") setVentasOpen(s.ventasOpen)
        if (typeof s.finanzasOpen === "boolean") setFinanzasOpen(s.finanzasOpen)
        if (typeof s.catalogosOpen === "boolean") setCatalogosOpen(s.catalogosOpen)
      }
    } catch {}
  }, [])

  useEffect(() => {
    try {
      const s = { gestionOpen, ventasOpen, finanzasOpen, catalogosOpen }
      localStorage.setItem("sidebar:sections", JSON.stringify(s))
    } catch {}
  }, [gestionOpen, ventasOpen, finanzasOpen, catalogosOpen])

  return (
    <Sidebar collapsible="icon" className="border-r-0">
      <SidebarHeader className="h-16 border-b border-zinc-700/50 px-4 bg-zinc-900 relative">
        <div className="flex items-center gap-3 w-full group-data-[collapsible=icon]:justify-center">
          <Package className="size-5 text-white shrink-0" strokeWidth={2.5} />
          <div className="flex flex-col group-data-[collapsible=icon]:hidden">
            <span className="text-lg font-bold tracking-tight leading-none text-white">
              Maycam Gestión
            </span>
            <div className="flex items-center gap-2 text-[11px] text-zinc-400 mt-2">
              <span className="inline-flex items-center gap-1">
                <span className={isOnline ? "inline-block size-1.5 rounded-full bg-green-500" : "inline-block size-1.5 rounded-full bg-red-500"} />
                {isOnline ? "En línea" : "Sin conexión"}
              </span>
              {lastSync && (
                <span>
                  • Últ. actualización {new Date(lastSync).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={toggleSidebar}
          className="absolute -right-3 top-1/2 -translate-y-1/2 flex items-center justify-center w-6 h-6 rounded-full bg-zinc-900 border border-zinc-700 text-white hover:bg-zinc-800 transition-colors z-50"
          aria-label={isCollapsed ? "Expandir sidebar" : "Colapsar sidebar"}
        >
          {isCollapsed ? (
            <ChevronRight className="size-3.5" strokeWidth={2.5} />
          ) : (
            <ChevronLeft className="size-3.5" strokeWidth={2.5} />
          )}
        </button>
      </SidebarHeader>
      <SidebarContent className="px-3 py-4 bg-zinc-900 overflow-y-auto">
        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-3 group-data-[collapsible=icon]:gap-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "inventory"}
                  onClick={() => handleNavigation("inventory")}
                  tooltip="Dashboard"
                  className="h-11 px-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-sky-400"
                >
                  <BarChart3 className="size-5 shrink-0" strokeWidth={2} />
                  <span className="text-sm font-medium tracking-tight">Dashboard</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "import"}
                  onClick={() => handleNavigation("import")}
                  tooltip="Productos"
                  className="h-11 px-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-green-400"
                >
                  <Package className="size-5 shrink-0" strokeWidth={2} />
                  <span className="text-sm font-medium tracking-tight">Productos</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={activeTab === "stock"}
                  onClick={() => handleNavigation("stock")}
                  tooltip="Stock"
                  className="h-11 px-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-violet-400"
                >
                  <Store className="size-5 shrink-0" strokeWidth={2} />
                  <span className="text-sm font-medium tracking-tight">Stock</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-3 group-data-[collapsible=icon]:gap-1">
              <SidebarMenuItem>
                <button
                  className="w-full flex items-center h-11 px-3 rounded-none bg-transparent text-zinc-300 hover:text-white transition-colors border-none group-data-[collapsible=icon]:hidden"
                  onClick={() => setCatalogosOpen((v) => !v)}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Monitoreo de precios</span>
                  {catalogosOpen ? (
                    <ChevronDown className="size-4 ml-auto" />
                  ) : (
                    <ChevronRight className="size-4 ml-auto" />
                  )}
                </button>
              </SidebarMenuItem>
              {(catalogosOpen || isCollapsed) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("precios")}
                      isActive={activeTab === "precios"}
                      tooltip="Precios a Publicar"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-yellow-400"
                    >
                      <DollarSign className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Precios a Publicar</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("zentor")}
                      isActive={activeTab === "zentor"}
                      tooltip="Lista ZENTOR"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-purple-400"
                    >
                      <Package className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Lista ZENTOR</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-3 group-data-[collapsible=icon]:gap-1">
              <SidebarMenuItem>
                <button
                  className="w-full flex items-center h-11 px-3 rounded-none bg-transparent text-zinc-300 hover:text-white transition-colors border-none group-data-[collapsible=icon]:hidden"
                  onClick={() => setGestionOpen((v) => !v)}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Configuración</span>
                  {gestionOpen ? (
                    <ChevronDown className="size-4 ml-auto" />
                  ) : (
                    <ChevronRight className="size-4 ml-auto" />
                  )}
                </button>
              </SidebarMenuItem>
              {(gestionOpen || isCollapsed) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("clients")}
                      isActive={activeTab === "clients"}
                      tooltip="Clientes"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-cyan-400"
                    >
                      <Users className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Clientes</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("brands")}
                      isActive={activeTab === "brands"}
                      tooltip="Marcas"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-pink-400"
                    >
                      <Tag className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Marcas</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("suppliers")}
                      isActive={activeTab === "suppliers"}
                      tooltip="Proveedores"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-lime-400"
                    >
                      <Users className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Proveedores</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup className="p-0">
          <SidebarGroupContent>
            <SidebarMenu className="gap-3 group-data-[collapsible=icon]:gap-1">
              <SidebarMenuItem>
                <button
                  className="w-full flex items-center h-11 px-3 rounded-none bg-transparent text-zinc-300 hover:text-white transition-colors border-none group-data-[collapsible=icon]:hidden"
                  onClick={() => setVentasOpen((v) => !v)}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Ventas</span>
                  {ventasOpen ? (
                    <ChevronDown className="size-4 ml-auto" />
                  ) : (
                    <ChevronRight className="size-4 ml-auto" />
                  )}
                </button>
              </SidebarMenuItem>
              {(ventasOpen || isCollapsed) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("wholesale")}
                      isActive={activeTab === "wholesale"}
                      tooltip="Mayoristas"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-orange-400"
                    >
                      <ShoppingCart className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Mayoristas</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("wholesale-bullpadel")}
                      isActive={activeTab === "wholesale-bullpadel"}
                      tooltip="Mayoristas Bullpadel"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-indigo-400"
                    >
                      <Store className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Mayoristas Bullpadel</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("retail")}
                      isActive={activeTab === "retail"}
                      tooltip="Minoristas"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-teal-400"
                    >
                      <ShoppingBag className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Minoristas</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}

              <SidebarMenuItem>
                <button
                  className="w-full flex items-center h-11 px-3 rounded-none bg-transparent text-zinc-300 hover:text-white transition-colors border-none group-data-[collapsible=icon]:hidden"
                  onClick={() => setFinanzasOpen((v) => !v)}
                >
                  <span className="text-xs font-semibold uppercase tracking-wide">Finanzas</span>
                  {finanzasOpen ? (
                    <ChevronDown className="size-4 ml-auto" />
                  ) : (
                    <ChevronRight className="size-4 ml-auto" />
                  )}
                </button>
              </SidebarMenuItem>
              {(finanzasOpen || isCollapsed) && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      isActive={activeTab === "rentabilidad"}
                      tooltip="Rentabilidad Real"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0"
                    >
                      <Link href="/dashboard/rentabilidad" className="flex items-center gap-2 w-full group-data-[collapsible=icon]:[&>svg]:text-rose-400">
                        <TrendingUp className="size-5 shrink-0" strokeWidth={2} />
                        <span className="text-xs font-medium tracking-tight">Rentabilidad Real</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("gastos")}
                      isActive={activeTab === "gastos"}
                      tooltip="Gastos"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-red-400"
                    >
                      <Receipt className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Gastos</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => handleNavigation("notas-credito")}
                      isActive={activeTab === "notas-credito"}
                      tooltip="Notas de Crédito"
                      className="h-11 pl-8 pr-3 rounded-none text-zinc-300 bg-transparent border-none hover:bg-transparent hover:text-white data-[active=true]:bg-transparent data-[active=true]:text-white transition-colors relative group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:[&>svg]:text-amber-400"
                    >
                      <FileText className="size-5 shrink-0" strokeWidth={2} />
                      <span className="text-xs font-medium tracking-tight">Notas de Crédito</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-zinc-700/50 p-3 bg-zinc-900">
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-3 px-3 py-2 text-sm rounded-none text-white group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:p-2 group-data-[collapsible=icon]:gap-0">
              <UserCircle className="size-5 shrink-0" />
              <span className="truncate font-medium group-data-[collapsible=icon]:hidden">{userEmail || "Usuario"}</span>
            </div>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={onLogout}
              tooltip="Cerrar Sesión"
              className="group/logout text-red-500 hover:text-red-600 hover:bg-transparent border-none rounded-none transition-all duration-200"
            >
              <LogOut className="group-hover/logout:rotate-180 transition-transform duration-500" />
              <span className="font-medium">Cerrar Sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  )
}
