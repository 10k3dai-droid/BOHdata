// types.ts — Kiểu dữ liệu dùng chung cho web, khớp schema Supabase.

export type AsinSource = "keepa_finder" | "h10_csv" | "manual";

export interface Asin {
  id: string;
  asin: string;
  title: string | null;
  image_url: string | null;
  product_url: string | null;
  category: string | null;
  brand: string | null;
  source: AsinSource;
  created_at: string;
}

export interface Snapshot {
  id: string;
  asin_id: string;
  captured_on: string; // YYYY-MM-DD
  bsr: number | null;
  price: number | null;
  sales_est: number | null;
  revenue_est: number | null;
  review_count: number | null;
  rating: number | null;
  seller_count: number | null;
  fulfillment: string | null;
  buy_box_price: number | null;
  created_at: string;
}

// Dòng dashboard = ASIN + snapshot của ngày đang chọn (có thể null nếu ngày đó chưa crawl).
export interface DashboardRow {
  asin: Asin;
  snapshot: Snapshot | null;
}

export interface Watchlist {
  id: string;
  name: string;
  owner: string | null;
  keyword: string | null;
  created_at: string;
}

export interface WatchlistWithAsins extends Watchlist {
  asins: Asin[];
}

export interface DiscoverFilters {
  bsr_max?: number | null;
  price_min?: number | null;
  price_max?: number | null;
  revenue_min?: number | null;
  rating_min?: number | null;
  monthly_sold_min?: number | null;
}

export type SortKey = "title" | "bsr" | "price" | "sales_est" | "revenue_est" | "review_count" | "rating";
export type SortDir = "asc" | "desc";

// ---- Discover ----
export type DiscoverMode = "keyword" | "category" | "best_sellers";
export type DiscoverStatus = "pending" | "running" | "done" | "error";

export interface ProductLine {
  id: string;
  name: string;
  keyword: string;
  created_at: string;
}

// Preview 1 ASIN tìm được (crawler ghi vào discover_jobs.result_asins).
export interface DiscoverResultAsin {
  asin: string;
  title: string | null;
  image_url: string | null;
  product_url: string | null;
  price: number | null;
  bsr: number | null;
  sales_est: number | null;
  rating: number | null;
}

export interface DiscoverJob {
  id: string;
  mode: DiscoverMode;
  keyword: string | null;
  category_node: string | null;
  filters: DiscoverFilters | null;
  status: DiscoverStatus;
  result_count: number | null;
  result_asins: DiscoverResultAsin[] | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}
