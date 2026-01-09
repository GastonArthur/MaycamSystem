export interface RT_ML_Account {
  id: string;
  name: string;
  seller_id: number;
  refresh_token: string;
  access_token: string | null;
  access_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RT_ML_SKU_Map {
  account_id: string;
  sku: string;
  item_id: string;
  variation_id: number | null;
  last_resolved_at: string | null;
  last_error: string | null;
}

export interface RT_Stock_Current {
  account_id: string;
  sku: string;
  qty: number | null;
  status: string;
  updated_at: string;
}

export interface RT_ML_Order {
  account_id: string;
  order_id: number;
  status: string;
  date_created: string;
  total_amount: number;
  paid_amount: number | null;
  buyer_id: number | null;
  shipment_id: number | null;
  payment_ids: any | null;
  raw: any;
  updated_at: string;
}

export interface RT_Sale {
  id: string;
  channel: string;
  account_id: string | null;
  external_order_id: string | null;
  status: string | null;
  sold_at: string | null;
  gross_income: number | null;
  net_income: number | null;
  created_at: string;
  updated_at: string;
}

export interface RT_Sale_Item {
  id: string;
  sale_id: string;
  sku: string | null;
  qty: number | null;
  sale_unit_price: number | null;
  sale_unit_discount: number | null;
  cost_unit_at_sale: number | null;
  product_name_snapshot: string | null;
}

export interface RT_Sale_Profit {
  sale_id: string;
  gross_income: number | null;
  cogs: number | null;
  total_charges: number | null;
  real_profit: number | null;
  profit_pct: number | null;
  computed_at: string;
}

export interface RT_Sale_Charge {
  id: string;
  sale_id: string;
  type: string;
  amount: number | null;
  source: string | null;
  external_ref: string | null;
  occurred_at: string | null;
  raw: any;
}
