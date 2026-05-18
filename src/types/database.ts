export type ProductCategory = 'product' | 'addon';

export interface Product {
  id: string;
  name: string;
  category: ProductCategory;
  price: number; // dalam Rupiah
  description?: string;
  created_at: string;
}

export interface InventoryBatch {
  id: string;
  product_id: string;
  production_date: string;
  expiry_date: string;
  initial_quantity: number;
  current_quantity: number;
  created_at: string;
  notes?: string;
  rejected_quantity?: number;
  rejection_reason?: string;
  rejected_at?: string;
  warehouse_rejected_quantity?: number;
  warehouse_rejected_at?: string;
  product?: Product;
}

export interface Rider {
  id: string;
  name: string;
  phone?: string;
  created_at: string;
}

export interface Distribution {
  id: string;
  rider_id: string;
  batch_id: string;
  quantity: number;
  distributed_at: string;
  returned_quantity: number;
  sold_quantity: number;
  rejected_quantity: number;
  rejected_at?: string;
  notes?: string;
  rider?: Rider;
  batch?: InventoryBatch;
}

export interface InventorySummary {
  product_id: string;
  product_name: string;
  category: ProductCategory;
  total_in_inventory: number;
  total_distributed: number;
  total_sold: number;
  total_returned: number;
  total_rejected: number;
  total_warehouse_rejected: number;
  batches: InventoryBatch[];
}

export interface RejectInfo {
  type: 'production' | 'rider' | 'warehouse';
  product_name: string;
  quantity: number;
  reason?: string;
  timestamp: string;
  rider_name?: string;
  batch_info?: string;
}

export interface RejectSummary {
  total_production_reject: number;
  total_rider_reject: number;
  total_reject: number;
  reject_by_product: Array<{
    product_name: string;
    production_reject: number;
    rider_reject: number;
    total_reject: number;
  }>;
  reject_by_rider: Array<{
    rider_name: string;
    rejected_quantity: number;
    rejected_count: number;
  }>;
  reject_details: RejectInfo[];
}

export type CanteenType = 'Kantin Garuda' | 'Kantin BTB AU';

export interface CanteenSale {
  id: string;
  canteen: CanteenType;
  cups_sold: number;
  sale_date: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

export interface DailyReport {
  date: string;
  productions: {
    product_name: string;
    quantity: number;
    production_date: string;
    expiry_date: string;
  }[];
  distributions: {
    rider_name: string;
    product_name: string;
    quantity: number;
    batch_info: string;
  }[];
  summary: {
    total_cups: number;
    total_addons: number;
    products: InventorySummary[];
  };
}
