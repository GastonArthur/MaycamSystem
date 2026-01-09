"use client"

import React, { useState, useEffect } from "react"
import { checkSession } from "@/lib/auth"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider, SidebarInset, SidebarTrigger } from "@/components/ui/sidebar"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { ShieldCheck, Lock, Smartphone, CheckCircle, Copy, RefreshCw, MessageSquare } from "lucide-react"
import { toast } from "@/hooks/use-toast"
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

export default function SecurityPage() {
  const [user, setUser] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  
  // 2FA Setup State
  const [isSettingUp, setIsSettingUp] = useState(false)
  const [setupMethod, setSetupMethod] = useState<'app' | 'sms'>('app')
  
  // App (TOTP) State
  const [secret, setSecret] = useState("")
  const [otpAuth, setOtpAuth] = useState("")
  
  // SMS State
  const [phone, setPhone] = useState("")
  const [smsSent, setSmsSent] = useState(false)
  
  // Verification
  const [code, setCode] = useState("")
  const [verifyLoading, setVerifyLoading] = useState(false)

  // Sidebar State (Dummy)
  const [sidebarActiveTab, setSidebarActiveTab] = useState("")
  
  useEffect(() => {
    loadUser()
  }, [])

  const loadUser = async () => {
    const userData = await checkSession()
    setUser(userData)
    if (userData?.phone) {
      setPhone(userData.phone)
    }
    setLoading(false)
  }

  const startAppSetup = async () => {
    try {
      setLoading(true)
      const res = await fetch("/api/auth/2fa/generate", { method: "POST" })
      const data = await res.json()
      
      if (data.error) throw new Error(data.error)
      
      setSecret(data.secret)
      setOtpAuth(data.otpauth)
      setIsSettingUp(true)
      setSetupMethod('app')
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Error al iniciar configuración", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  const startSmsSetup = () => {
    setIsSettingUp(true)
    setSetupMethod('sms')
  }

  const sendSmsCode = async () => {
    if (!phone) {
        toast({ title: "Error", description: "Ingrese un número de teléfono", variant: "destructive" })
        return
    }

    try {
        setLoading(true)
        const res = await fetch("/api/auth/2fa/send-code", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone, method: 'sms' })
        })
        const data = await res.json()
        
        if (data.error) throw new Error(data.error)
        
        setSmsSent(true)
        toast({ title: "Código enviado", description: "Revisa tu teléfono (o consola de servidor para demo)" })
    } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" })
    } finally {
        setLoading(false)
    }
  }

  const verifyAndEnable = async () => {
    if (code.length !== 6) return

    try {
      setVerifyLoading(true)
      const body: any = { code, method: setupMethod }
      
      if (setupMethod === 'app') {
          body.secret = secret
      }

      const res = await fetch("/api/auth/2fa/enable", { 
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      })
      
      const data = await res.json()
      
      if (data.error) throw new Error(data.error)
      
      toast({ 
        title: "¡2FA Activado!", 
        description: "Tu cuenta ahora es más segura.", 
      })
      
      setIsSettingUp(false)
      setSecret("")
      setOtpAuth("")
      setCode("")
      setSmsSent(false)
      
      await loadUser()
      
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Código inválido", 
        variant: "destructive" 
      })
    } finally {
      setVerifyLoading(false)
    }
  }

  const disable2FA = async () => {
    if (!confirm("¿Estás seguro de que quieres desactivar la autenticación de dos pasos? Tu cuenta será menos segura.")) return

    try {
      setLoading(true)
      const res = await fetch("/api/auth/2fa/disable", { method: "POST" })
      const data = await res.json()
      
      if (data.error) throw new Error(data.error)
      
      toast({ 
        title: "2FA Desactivado", 
        description: "La autenticación de dos pasos ha sido desactivada.", 
      })
      
      await loadUser()
    } catch (err: any) {
      toast({ 
        title: "Error", 
        description: err.message || "Error al desactivar", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  const copySecret = () => {
    navigator.clipboard.writeText(secret)
    toast({ description: "Código secreto copiado al portapapeles" })
  }

  const resetSetup = () => {
    setIsSettingUp(false)
    setSecret("")
    setOtpAuth("")
    setCode("")
    setSmsSent(false)
  }

  if (loading && !user) {
    return <div className="flex items-center justify-center h-screen">Cargando...</div>
  }

  return (
    <SidebarProvider>
      <AppSidebar 
        activeTab={sidebarActiveTab}
        setActiveTab={() => {}}
        setShowWholesale={() => {}}
        setShowRetail={() => {}}
        setShowGastos={() => {}}
        setShowClients={() => {}}
        onLogout={() => window.location.href = "/"} 
        userEmail={user?.email} 
      />
      <SidebarInset>
        <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <div className="flex items-center gap-2 text-lg font-semibold">
            <ShieldCheck className="h-5 w-5" />
            Seguridad de la Cuenta
          </div>
        </header>
        
        <div className="flex-1 p-8 pt-6 max-w-4xl mx-auto w-full">
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Autenticación de Dos Pasos (2FA)</h2>
              <p className="text-muted-foreground">
                Añade una capa extra de seguridad a tu cuenta requiriendo un código al iniciar sesión.
              </p>
            </div>

            {user?.two_factor_enabled ? (
              <Card className="border-green-200 bg-green-50/50">
                <CardHeader>
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                    <CardTitle className="text-green-800">2FA está activado</CardTitle>
                  </div>
                  <CardDescription className="text-green-700">
                    Tu cuenta está protegida. 
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-green-800 bg-white/50 p-4 rounded-lg border border-green-100">
                    {user.two_factor_method === 'sms' ? <MessageSquare className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                    <span>
                        {user.two_factor_method === 'sms' 
                            ? `Verificación por SMS (${user.phone})` 
                            : "Usando aplicación autenticadora (Google Authenticator)"}
                    </span>
                  </div>
                </CardContent>
                <CardFooter>
                  <Button variant="destructive" onClick={disable2FA} disabled={loading}>
                    Desactivar 2FA
                  </Button>
                </CardFooter>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>Configurar 2FA</CardTitle>
                  <CardDescription>
                    Selecciona el método de seguridad que prefieras.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {!isSettingUp ? (
                    <Tabs defaultValue="app" className="w-full">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="app">App Autenticadora</TabsTrigger>
                            <TabsTrigger value="sms">SMS / Celular</TabsTrigger>
                        </TabsList>
                        
                        <TabsContent value="app" className="space-y-4 pt-4">
                            <div className="flex flex-col items-center justify-center text-center py-4 space-y-4">
                                <div className="p-4 bg-slate-100 rounded-full">
                                    <Smartphone className="h-8 w-8 text-slate-600" />
                                </div>
                                <div className="max-w-md space-y-2">
                                    <h3 className="font-semibold text-lg">Google Authenticator</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Recomendado. Usa una app como Google Authenticator o Authy para generar códigos, incluso sin internet.
                                    </p>
                                </div>
                                <Button onClick={startAppSetup} disabled={loading}>
                                    Configurar App
                                </Button>
                            </div>
                        </TabsContent>

                        <TabsContent value="sms" className="space-y-4 pt-4">
                            <div className="flex flex-col items-center justify-center text-center py-4 space-y-4">
                                <div className="p-4 bg-slate-100 rounded-full">
                                    <MessageSquare className="h-8 w-8 text-slate-600" />
                                </div>
                                <div className="max-w-md space-y-2">
                                    <h3 className="font-semibold text-lg">Mensaje de Texto (SMS)</h3>
                                    <p className="text-sm text-muted-foreground">
                                        Recibe un código por SMS o WhatsApp cada vez que inicies sesión.
                                    </p>
                                </div>
                                <Button onClick={startSmsSetup} disabled={loading}>
                                    Configurar SMS
                                </Button>
                            </div>
                        </TabsContent>
                    </Tabs>
                  ) : (
                    <div className="space-y-8">
                      {setupMethod === 'app' ? (
                          // APP SETUP FLOW
                          <div className="grid md:grid-cols-2 gap-8">
                            <div className="space-y-4">
                              <div className="flex items-center gap-2 font-medium text-lg">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">1</span>
                                Escanear código QR
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Abre tu aplicación autenticadora y escanea este código QR.
                              </p>
                              <div className="border p-4 rounded-lg bg-white w-fit mx-auto md:mx-0">
                                <img 
                                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(otpAuth)}`} 
                                  alt="QR Code" 
                                  className="w-[200px] h-[200px]"
                                />
                              </div>
                              <div className="text-xs text-muted-foreground">
                                ¿No puedes escanear? Ingresa este código manualmente:
                                <div className="flex items-center gap-2 mt-1 font-mono bg-slate-100 p-2 rounded border">
                                  <span className="flex-1 truncate">{secret}</span>
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={copySecret}>
                                    <Copy className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            </div>

                            <div className="space-y-4">
                              <div className="flex items-center gap-2 font-medium text-lg">
                                <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-600 text-xs font-bold">2</span>
                                Verificar Código
                              </div>
                              <p className="text-sm text-muted-foreground">
                                Ingresa el código de 6 dígitos que aparece en tu aplicación.
                              </p>
                              
                              <div className="py-4">
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

                              <Button 
                                onClick={verifyAndEnable} 
                                disabled={verifyLoading || code.length !== 6}
                                className="w-full"
                              >
                                {verifyLoading ? "Verificando..." : "Activar 2FA"}
                              </Button>
                              
                              <Button 
                                variant="ghost" 
                                onClick={resetSetup}
                                className="w-full"
                              >
                                Cancelar
                              </Button>
                            </div>
                          </div>
                      ) : (
                          // SMS SETUP FLOW
                          <div className="max-w-md mx-auto space-y-6">
                              {!smsSent ? (
                                  <div className="space-y-4">
                                      <div className="space-y-2">
                                          <Label>Número de Celular</Label>
                                          <Input 
                                            type="tel" 
                                            placeholder="+54 9 11 ..." 
                                            value={phone}
                                            onChange={(e) => setPhone(e.target.value)}
                                          />
                                          <p className="text-xs text-muted-foreground">
                                            Ingresa tu número completo con código de país.
                                          </p>
                                      </div>
                                      <Button className="w-full" onClick={sendSmsCode} disabled={loading || !phone}>
                                          Enviar Código de Verificación
                                      </Button>
                                      <Button variant="ghost" className="w-full" onClick={resetSetup}>
                                          Cancelar
                                      </Button>
                                  </div>
                              ) : (
                                  <div className="space-y-4">
                                      <div className="text-center space-y-2">
                                          <h3 className="font-medium">Verificar Teléfono</h3>
                                          <p className="text-sm text-muted-foreground">
                                              Hemos enviado un código a <strong>{phone}</strong>
                                          </p>
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

                                      <Button 
                                        className="w-full" 
                                        onClick={verifyAndEnable}
                                        disabled={verifyLoading || code.length !== 6}
                                      >
                                          {verifyLoading ? "Verificando..." : "Verificar y Activar"}
                                      </Button>
                                      <Button variant="ghost" className="w-full" onClick={() => setSmsSent(false)}>
                                          Cambiar número
                                      </Button>
                                  </div>
                              )}
                          </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}
