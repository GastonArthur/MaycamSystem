import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const isSupabaseConfigured =
  !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

export const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

export const convertScientificNotation = (value: any): string => {
  if (!value) return ""
  const strVal = String(value)

  // Detectar si es notación científica (contiene E+ o E-)
  if (strVal.includes("E+") || strVal.includes("E-") || strVal.includes("e+") || strVal.includes("e-")) {
    try {
      // Convertir a número y luego a string para obtener el valor completo
      const num = Number.parseFloat(strVal)
      if (!isNaN(num)) {
        // Usar toFixed(0) para números enteros grandes
        return num.toFixed(0)
      }
    } catch (error) {
      console.warn("Error converting scientific notation:", value, error)
    }
  }
  return strVal
}
