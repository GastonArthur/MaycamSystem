"use client"

import { useEffect, useState } from "react"
import { AlertTriangle } from "lucide-react"
import { isSupabaseConfigured } from "@/lib/supabase"

export function OfflineBanner() {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    // Show banner if Supabase is not configured
    if (!isSupabaseConfigured) {
      setIsVisible(true)
    }
  }, [])

  if (!isVisible) return null

  return (
    <div className="bg-amber-100 border-b border-amber-200 text-amber-800 px-4 py-2 text-sm flex items-center justify-center gap-2">
      <AlertTriangle className="w-4 h-4" />
      <span className="font-medium">Modo Offline:</span>
      <span>
        La aplicación está funcionando con datos locales. Configure las variables de entorno para conectar con Supabase.
      </span>
    </div>
  )
}
