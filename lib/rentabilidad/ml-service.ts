import { createClient } from "@supabase/supabase-js"
import { RT_ML_Account, RT_ML_Order, RT_Stock_Current } from "./types"

const ML_API_URL = "https://api.mercadolibre.com"

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

export class MLService {
  private supabaseUrl: string
  private supabaseKey: string

  constructor(supabaseUrl: string, supabaseKey: string) {
    this.supabaseUrl = supabaseUrl
    this.supabaseKey = supabaseKey
  }

  private getSupabase() {
    return createClient(this.supabaseUrl, this.supabaseKey)
  }

  // --- Auth & Tokens ---

  async refreshAccessToken(account: RT_ML_Account): Promise<string> {
    try {
      const response = await fetch(`${ML_API_URL}/oauth/token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Accept": "application/json"
        },
        body: new URLSearchParams({
          grant_type: "refresh_token",
          client_id: process.env.ML_CLIENT_ID || "", 
          client_secret: process.env.ML_CLIENT_SECRET || "", 
          refresh_token: account.refresh_token,
        }),
      })

      if (!response.ok) {
        throw new Error(`Failed to refresh token: ${response.statusText}`)
      }

      const data = await response.json()
      
      // Update in DB
      const supabase = this.getSupabase()
      await supabase
        .from("rt_ml_accounts")
        .update({
          access_token: data.access_token,
          refresh_token: data.refresh_token, 
          access_expires_at: new Date(Date.now() + data.expires_in * 1000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", account.id)

      return data.access_token
    } catch (error) {
      console.error("Error refreshing token:", error)
      throw error
    }
  }

  async getValidAccessToken(account: RT_ML_Account): Promise<string> {
    if (account.access_token && account.access_expires_at && new Date(account.access_expires_at) > new Date()) {
      return account.access_token
    }
    return this.refreshAccessToken(account)
  }
  
  // --- User Info ---
  
  async getMe(token: string): Promise<any> {
      const res = await fetch(`${ML_API_URL}/users/me`, {
          headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) throw new Error(`Failed to fetch user info: ${res.statusText}`)
      return await res.json()
  }

  // --- Sync Logic ---

  async syncStock(account: RT_ML_Account) {
    const token = await this.getValidAccessToken(account)
    
    // Self-Healing Seller ID Check
    let sellerId = account.seller_id
    try {
        const me = await this.getMe(token)
        if (me.id !== sellerId) {
            console.log(`[Sync] Seller ID mismatch! Config: ${sellerId}, Token owner: ${me.id}. Fixing...`)
            const supabase = this.getSupabase()
            await supabase.from("rt_ml_accounts").update({ seller_id: me.id }).eq("id", account.id)
            sellerId = me.id
        }
    } catch (err) {
        console.error("[Sync] Failed to verify token owner:", err)
    }

    // 1. Get all items
    let offset = 0
    const limit = 50
    let hasMore = true

    const supabase = this.getSupabase()

    while (hasMore) {
      const searchRes = await fetch(`${ML_API_URL}/users/${sellerId}/items/search?limit=${limit}&offset=${offset}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      if (!searchRes.ok) break 

      const searchData = await searchRes.json()
      const itemIds = searchData.results || []

      if (itemIds.length === 0) {
        hasMore = false
        break
      }

      // 2. Get item details (multiget)
      const itemsRes = await fetch(`${ML_API_URL}/items?ids=${itemIds.join(",")}&include_attributes=all`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      
      const itemsData = await itemsRes.json()

      for (const itemWrapper of itemsData) {
        const item = itemWrapper.body
        if (!item || item.error) continue

        const title = item.title
        const thumbnail = item.thumbnail || (item.pictures && item.pictures.length > 0 ? item.pictures[0].url : null)

        // Process Variations
        if (item.variations && item.variations.length > 0) {
          for (const variation of item.variations) {
             const sku = this.extractSku(variation, item)
             if (sku) {
               await this.upsertStock(account.id, sku, variation.available_quantity, item.status, title, thumbnail)
               await this.upsertMapping(account.id, sku, item.id, variation.id)
             }
          }
        } else {
          // Simple item
          const sku = this.extractSku(item, null)
          if (sku) {
            await this.upsertStock(account.id, sku, item.available_quantity, item.status, title, thumbnail)
            await this.upsertMapping(account.id, sku, item.id, null)
          }
        }
      }

      offset += limit
      if (offset >= searchData.paging.total) hasMore = false
    }
  }

  private extractSku(itemOrVar: any, parent: any | null): string | null {
    if (itemOrVar.seller_sku) return itemOrVar.seller_sku
    
    const attrs = itemOrVar.attributes || []
    const skuAttr = attrs.find((a: any) => a.id === "SELLER_SKU")
    if (skuAttr) return skuAttr.value_name

    return null
  }

  private async upsertStock(accountId: string, sku: string, qty: number, status: string, title?: string, thumbnail?: string) {
    const supabase = this.getSupabase()
    
    let stockStatus = "Stock"
    if (qty === 0) stockStatus = "Sin stock"
    if (status === "paused" || status === "closed") stockStatus = "No publicado"

    await supabase.from("rt_stock_current").upsert({
      account_id: accountId,
      sku: sku,
      qty: qty,
      status: stockStatus,
      title: title,
      thumbnail: thumbnail,
      updated_at: new Date().toISOString()
    })
  }
  
  private async upsertMapping(accountId: string, sku: string, itemId: string, variationId: number | null) {
      const supabase = this.getSupabase()
      await supabase.from("rt_ml_sku_map").upsert({
          account_id: accountId,
          sku: sku,
          item_id: itemId,
          variation_id: variationId,
          last_resolved_at: new Date().toISOString()
      }, { onConflict: "account_id, sku" })
  }

  // --- Jobs ---

  async getLastSync(jobName: string): Promise<Date | null> {
    const supabase = this.getSupabase()
    const { data } = await supabase.from("rt_jobs").select("cursor").eq("name", jobName).single()
    if (data && data.cursor && data.cursor.last_date) {
        return new Date(data.cursor.last_date)
    }
    return null
  }

  async updateLastSync(jobName: string, date: Date) {
      const supabase = this.getSupabase()
      await supabase.from("rt_jobs").upsert({
          name: jobName,
          cursor: { last_date: date.toISOString() },
          updated_at: new Date().toISOString()
      })
  }

  // --- Helper Methods ---

  async getAccountBySellerId(sellerId: string | number): Promise<RT_ML_Account | null> {
    const supabase = this.getSupabase()
    // Cast to string to ensure matching
    const { data } = await supabase
      .from("rt_ml_accounts")
      .select("*")
      .eq("seller_id", String(sellerId))
      .single()
    
    return data as RT_ML_Account | null
  }

  private async saveOrder(account: RT_ML_Account, order: any) {
    const supabase = this.getSupabase()
    
    // Upsert Order
    const { error: orderError } = await supabase.from("rt_ml_orders").upsert({
        account_id: account.id,
        order_id: order.id,
        status: order.status,
        date_created: order.date_created,
        total_amount: order.total_amount,
        paid_amount: order.paid_amount,
        buyer_id: order.buyer.id,
        shipment_id: order.shipping.id,
        raw: order,
        updated_at: new Date().toISOString()
    })

    if (orderError) {
        console.error(`[Sync] Error saving order ${order.id}:`, orderError)
        throw new Error(`Failed to save order ${order.id}: ${orderError.message}`)
    }

    // Upsert Items
    // Delete existing items first
    const { error: deleteError } = await supabase.from("rt_ml_order_items").delete().match({ account_id: account.id, order_id: order.id })
    
    if (deleteError) {
         console.error(`[Sync] Error clearing items for order ${order.id}:`, deleteError)
    }

    if (order.order_items && Array.isArray(order.order_items)) {
        for (const item of order.order_items) {
            const sku = item.item.seller_sku || item.item.id 
            
            const { error: itemError } = await supabase.from("rt_ml_order_items").insert({
                account_id: account.id,
                order_id: order.id,
                sku: sku,
                item_id: item.item.id,
                variation_id: item.item.variation_id,
                title: item.item.title,
                quantity: item.quantity,
                unit_price: item.unit_price,
                discount: 0,
                raw: item
            })

            if (itemError) {
                console.error(`[Sync] Error inserting item for order ${order.id}:`, itemError)
            }
        }
    }
  }

  // --- Orders ---
  
  async syncOrderById(sellerId: string | number, orderId: string) {
    const account = await this.getAccountBySellerId(sellerId)
    if (!account) {
        console.error(`[Sync] Account not found for seller_id: ${sellerId}`)
        return
    }

    const token = await this.getValidAccessToken(account)
    console.log(`[Sync] Fetching single order ${orderId} for seller ${sellerId}`)

    const res = await fetch(`${ML_API_URL}/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
    })

    if (!res.ok) {
        const errText = await res.text()
        console.error(`[Sync] Error fetching order ${orderId}: ${res.status} - ${errText}`)
        return
    }

    const order = await res.json()
    await this.saveOrder(account, order)
    console.log(`[Sync] Order ${orderId} synced successfully`)
  }
  
  async syncOrders(account: RT_ML_Account, fullHistory: boolean = false) {
      const token = await this.getValidAccessToken(account)
      const supabase = this.getSupabase()
      
      // Self-Healing Seller ID Check
      let sellerId = account.seller_id
      try {
          const me = await this.getMe(token)
          // Compare as strings to be safe or numbers if consistent
          if (String(me.id) !== String(sellerId)) {
              console.log(`[Sync] Seller ID mismatch! Config: ${sellerId}, Token owner: ${me.id}. Fixing...`)
              await supabase.from("rt_ml_accounts").update({ seller_id: me.id }).eq("id", account.id)
              sellerId = me.id
          }
      } catch (err) {
          console.error("[Sync] Failed to verify token owner:", err)
      }

      // Get last sync date
      const jobName = `orders_${account.id}`
      const lastDate = await this.getLastSync(jobName)
      
      let dateFrom: Date
      
      if (fullHistory) {
          // If full history requested, start from beginning of current year (or earlier if needed)
          // 2024-01-01 is a safe bet for "Complete" relevant history for this system
          dateFrom = new Date('2024-01-01T00:00:00.000Z')
          console.log(`[Sync] Full history requested. Starting from ${dateFrom.toISOString()}`)
      } else if (lastDate) {
          dateFrom = lastDate
      } else {
          // Default to 15 days ago to be safe on first sync
          dateFrom = new Date()
          dateFrom.setDate(dateFrom.getDate() - 15)
      }
      
      const dateFromStr = dateFrom.toISOString()
      
      // LOGGING: Debug what we are sending
      console.log(`[Sync] Fetching orders for ${account.name} (Seller ${sellerId}) from ${dateFromStr}`)
      
      let maxDate = dateFrom
      
      let offset = 0
      const limit = 50
      let hasMore = true
      let totalFetched = 0

      while (hasMore) {
          const url = `${ML_API_URL}/orders/search?seller=${sellerId}&order.date_created.from=${dateFromStr}&sort=date_asc&limit=${limit}&offset=${offset}`
          
          const res = await fetch(url, {
              headers: { Authorization: `Bearer ${token}` }
          })
          
          if (!res.ok) {
              const errText = await res.text()
              console.error(`[Sync] Error fetching orders: ${res.status} - ${errText}`)
              break
          }

          const data = await res.json()
          const orders = data.results || []
          
          if (orders.length === 0) {
              hasMore = false
              break
          }

          console.log(`[Sync] Found ${orders.length} orders (Offset: ${offset})`)

          for (const order of orders) {
              const orderDate = new Date(order.date_created)
              if (orderDate > maxDate) maxDate = orderDate

              // Upsert Order
              try {
                  await this.saveOrder(account, order)
              } catch (err) {
                  console.error(`[Sync] Failed to process order ${order.id}:`, err)
              }
          }
          
          totalFetched += orders.length
          offset += limit
          
          // Safety break: ONLY if NOT full history. If full history, we want everything.
          // However, we must respect ML offset limits.
          // ML usually limits offset to 1000 or so on public search.
          // But /orders/search for owner usually supports more.
          // Let's set a higher safety limit for full history.
          const maxFetchLimit = fullHistory ? 10000 : 1000
          
          if (totalFetched >= maxFetchLimit) {
              console.log(`[Sync] Hit safety limit of ${maxFetchLimit} orders. Stopping.`)
              hasMore = false 
          }
          
          if (offset >= data.paging.total) hasMore = false
          
          // Rate Limiting Protection
          if (hasMore) {
              await wait(300) // 300ms delay between pages
          }
      }
      
      // Update cursor only if we actually fetched something new
      if (totalFetched > 0) {
          console.log(`[Sync] Updating cursor to ${maxDate.toISOString()}`)
          await this.updateLastSync(jobName, maxDate)
      } else {
          console.log(`[Sync] No new orders found. Cursor remains at ${dateFromStr}`)
      }
      
      return totalFetched
  }
}
