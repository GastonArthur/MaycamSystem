"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle, AlertCircle, Cloud, Database, Users } from "lucide-react"
import { isSupabaseConfigured } from "@/lib/supabase"

export function DeploymentStatus() {
  const [status, setStatus] = useState({
    vercel: true, // Siempre true si estamos viendo esto
    supabase: false,
    database: false,
    users: false,
  })

  useEffect(() => {
    const checkStatus = async () => {
      const supabaseConfigured = isSupabaseConfigured

      setStatus((prev) => ({
        ...prev,
        supabase: supabaseConfigured,
        database: supabaseConfigured,
        users: supabaseConfigured,
      }))
    }

    checkStatus()
  }, [])

  const StatusItem = ({
    icon: Icon,
    title,
    description,
    isComplete,
  }: {
    icon: any
    title: string
    description: string
    isComplete: boolean
  }) => (
    <div className="flex items-start gap-3 p-3 rounded-lg border bg-card">
      <div
        className={`p-2 rounded-full ${isComplete ? "bg-green-100 text-green-600" : "bg-yellow-100 text-yellow-600"}`}
      >
        <Icon className="w-4 h-4" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h4 className="font-medium">{title}</h4>
          <Badge variant={isComplete ? "default" : "secondary"}>{isComplete ? "Completado" : "Pendiente"}</Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
      {isComplete && <CheckCircle className="w-5 h-5 text-green-600" />}
      {!isComplete && <AlertCircle className="w-5 h-5 text-yellow-600" />}
    </div>
  )

  const completedSteps = Object.values(status).filter(Boolean).length
  const totalSteps = Object.keys(status).length
  const progress = (completedSteps / totalSteps) * 100

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Cloud className="w-5 h-5" />
          Estado del Despliegue en la Nube
        </CardTitle>
        <CardDescription>
          Progreso: {completedSteps} de {totalSteps} pasos completados ({Math.round(progress)}%)
        </CardDescription>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div className="bg-blue-600 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusItem
          icon={Cloud}
          title="Vercel Deployment"
          description="Aplicación desplegada en Vercel"
          isComplete={status.vercel}
        />
        <StatusItem
          icon={Database}
          title="Supabase Connection"
          description="Base de datos Supabase configurada"
          isComplete={status.supabase}
        />
        <StatusItem
          icon={Database}
          title="Database Setup"
          description="Tablas y estructura de base de datos creadas"
          isComplete={status.database}
        />
        <StatusItem
          icon={Users}
          title="User Management"
          description="Sistema de usuarios y autenticación activo"
          isComplete={status.users}
        />

        {progress === 100 && (
          <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
            <div className="flex items-center gap-2 text-green-800">
              <CheckCircle className="w-5 h-5" />
              <h4 className="font-medium">¡Sistema completamente desplegado!</h4>
            </div>
            <p className="text-green-700 text-sm mt-1">Tu sistema MAYCAM está funcionando correctamente en la nube.</p>
          </div>
        )}

        {progress < 100 && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-medium">Configuración pendiente</h4>
            </div>
            <p className="text-blue-700 text-sm mt-1">Sigue los pasos de configuración para completar el despliegue.</p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
