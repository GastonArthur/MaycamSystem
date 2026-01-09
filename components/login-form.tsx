"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Eye, EyeOff, LogIn, Package, AlertCircle, ShieldCheck } from "lucide-react"
import { login, verify2FALogin } from "@/lib/auth"
import { toast } from "@/hooks/use-toast"
import { logError } from "@/lib/logger"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"

interface LoginFormProps {
  onLoginSuccess: () => void
}

export function LoginForm({ onLoginSuccess }: LoginFormProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [require2FA, setRequire2FA] = useState(false)
  const [userId, setUserId] = useState<number | null>(null)
  const [code, setCode] = useState("")

  const handleVerify2FA = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!userId || code.length !== 6) return

    setIsLoading(true)
    setError("")

    try {
      const result = await verify2FALogin(userId, code)

      if (result.success && result.user) {
        toast({
          title: "¡Bienvenido!",
          description: `Hola ${result.user.name}`,
        })
        onLoginSuccess()
      } else {
        setError(result.error || "Código inválido")
      }
    } catch (error) {
      logError("Error en verificación 2FA:", error)
      setError("Error interno del servidor")
    } finally {
      setIsLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (require2FA) {
      return handleVerify2FA(e)
    }

    if (!email.trim() || !password.trim()) {
      setError("Por favor ingrese email y contraseña")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const result = await login(email.trim(), password)

      if (result.success) {
        if (result.require2FA && result.userId) {
          setRequire2FA(true)
          setUserId(result.userId)
          setIsLoading(false)
          return
        }
        
        if (result.user) {
          toast({
            title: "¡Bienvenido!",
            description: `Hola ${result.user.name}`,
          })
          onLoginSuccess()
        }
      } else {
        setError(result.error || "Credenciales inválidas")
      }
    } catch (error) {
      logError("Error en login:", error)
      setError("Error interno del servidor")
    } finally {
      if (!require2FA) setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-zinc-900 via-slate-900 to-slate-800 p-6">
      <Card className="w-full max-w-md bg-zinc-900/95 border border-zinc-800 rounded-2xl shadow-2xl">
        <CardHeader className="text-center space-y-4 pb-6">
          <div className="mx-auto w-16 h-16 rounded-xl bg-zinc-900 border border-zinc-700 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.35)] ring-1 ring-indigo-500/40">
            <Package className="w-8 h-8 text-white" />
          </div>
          <div>
            <CardTitle className="text-3xl font-extrabold text-white tracking-wide uppercase">
              MAYCAM
            </CardTitle>
            <CardDescription className="text-zinc-400 mt-1">Sistema de Gestión Integral</CardDescription>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {error && (
            <Alert variant="destructive" className="bg-red-900/20 border-red-500/40 text-red-200">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {require2FA ? (
              <div className="space-y-4 flex flex-col items-center">
                <div className="bg-blue-50 p-4 rounded-full mb-2">
                  <ShieldCheck className="w-8 h-8 text-blue-600" />
                </div>
                <div className="text-center space-y-2">
                  <h3 className="font-semibold text-lg text-white">Verificación de Dos Pasos</h3>
                  <p className="text-sm text-zinc-400">Ingrese el código de 6 dígitos de su aplicación autenticadora.</p>
                </div>
                
                <div className="flex justify-center py-4">
                  <InputOTP
                    maxLength={6}
                    value={code}
                    onChange={(value) => setCode(value)}
                  >
                    <InputOTPGroup>
                      <InputOTPSlot index={0} />
                      <InputOTPSlot index={1} />
                      <InputOTPSlot index={2} />
                    </InputOTPGroup>
                    <div className="w-2" />
                    <InputOTPGroup>
                      <InputOTPSlot index={3} />
                      <InputOTPSlot index={4} />
                      <InputOTPSlot index={5} />
                    </InputOTPGroup>
                  </InputOTP>
                </div>
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-zinc-300 font-medium">
                    Correo electrónico
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 text-base bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                    disabled={isLoading}
                    autoComplete="email"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-zinc-300 font-medium">
                    Contraseña
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="h-11 text-base pr-10 bg-zinc-800 border-zinc-700 text-zinc-100 placeholder:text-zinc-500"
                      disabled={isLoading}
                      autoComplete="current-password"
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-zinc-400"
                      onClick={() => setShowPassword(!showPassword)}
                      disabled={isLoading}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </>
            )}

            <Button
              type="submit"
              className="w-full h-12 text-base bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg transform hover:scale-[1.02] transition-all rounded-lg"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  {require2FA ? "Verificando..." : "Iniciando sesión..."}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  {require2FA ? <ShieldCheck className="w-4 h-4" /> : <LogIn className="w-4 h-4" />}
                  {require2FA ? "Verificar Código" : "Iniciar Sesión"}
                </div>
              )}
            </Button>
            
            {require2FA && (
              <Button 
                type="button" 
                variant="ghost" 
                className="w-full text-zinc-400"
                onClick={() => {
                  setRequire2FA(false)
                  setUserId(null)
                  setCode("")
                  setError("")
                }}
              >
                Cancelar y volver
              </Button>
            )}
          </form>

          {!require2FA && (
            <div className="text-center text-sm text-zinc-500 border-t border-zinc-800 pt-4 space-y-1">
              <p className="font-medium text-zinc-400">© 2025 Sistema MAYCAM. Todos los derechos reservados.</p>
              <p className="text-xs">Versión 2.0</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
