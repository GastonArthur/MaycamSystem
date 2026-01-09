"use client"

import { useEffect, useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { LoginForm } from "@/components/login-form"
import { checkSession } from "@/lib/auth"

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const init = async () => {
      const user = await checkSession()
      if (user) {
        // Si ya hay sesión, redirigir al home o a la url intentada
        const redirect = searchParams.get("redirect") || "/"
        router.push(redirect)
      } else {
        setChecking(false)
      }
    }
    init()
  }, [router, searchParams])

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
      </div>
    )
  }

  return (
    <LoginForm 
      onLoginSuccess={() => {
        // Forzar recarga completa para actualizar cookies y estado
        const redirect = searchParams.get("redirect") || "/"
        window.location.href = redirect
      }} 
    />
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-pulse flex flex-col items-center">
          <div className="h-12 w-12 bg-slate-200 rounded-full mb-4"></div>
          <div className="h-4 w-48 bg-slate-200 rounded"></div>
        </div>
      </div>
    }>
      <LoginContent />
    </Suspense>
  )
}
