import { createClient, type SupabaseClient } from "@supabase/supabase-js"

/**
 * Helper that returns a working Supabase client even if the required
 * environment variables are missing while **previewing** the project
 * in v0/next-lite.
 *
 * •  In real deployments you MUST set
 *    NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.
 * •  During local preview we fall back to a dummy URL / key so the
 *    app can compile and render without throwing “supabaseUrl is required”.
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Helper to validate URL
const isValidUrl = (url: string | undefined) => {
  if (!url) return false
  try {
    new URL(url)
    return true
  } catch (e) {
    return false
  }
}

export const isSupabaseConfigured = isValidUrl(SUPABASE_URL) && !!SUPABASE_ANON_KEY

let client: SupabaseClient

if (!isSupabaseConfigured) {
  // Warn the developer and create a placeholder client
  /* eslint-disable no-console */
  console.warn(
    "[Supabase] Variables de entorno faltantes o inválidas. " +
      "Usando credenciales dummy sólo para modo preview.\n" +
      "Configura NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY " +
      "en tu .env.local / Vercel dashboard para conectar a tu proyecto real.",
  )

  client = createClient(
    // Dummy values – won’t connect but evita throw en tiempo de build
    "https://dummy.supabase.co",
    "public-anon-key",
  )
} else {
  // We know SUPABASE_URL is defined and valid here because of isSupabaseConfigured check
  client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!)
}

export const supabase = client
