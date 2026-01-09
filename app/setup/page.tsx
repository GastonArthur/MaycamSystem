"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/hooks/use-toast"
import { supabase } from "@/lib/supabase"
import { hash } from "bcryptjs"

export default function SetupPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Hash password
      const hashedPassword = await hash(password, 10)

      // 1. Crear usuario admin
      const { data: userData, error: userError } = await supabase
        .from("users")
        .upsert({
          email,
          password_hash: hashedPassword,
          name: "Administrador",
          role: "admin",
          is_active: true,
          can_view_logs: true,
          can_view_wholesale: true
        })
        .select()
        .single()

      if (userError) throw userError

      toast({
        title: "Setup completado",
        description: "Usuario administrador creado correctamente",
      })

      router.push("/")
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-[400px]">
        <CardHeader>
          <CardTitle>Configuración Inicial</CardTitle>
          <CardDescription>Crea tu usuario administrador</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSetup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Configurando..." : "Completar Setup"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
