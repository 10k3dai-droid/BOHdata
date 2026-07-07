// queries.ts — Truy vấn dữ liệu phía server (dùng service key qua getSupabaseServer()).
// Tập trung mọi câu query để component gọn và dễ test.
import "server-only";
import { getSupabaseServer } from "./supabaseServer";
import type {
  Asin,
  DashboardRow,
  DiscoverJob,
  ProductLine,
  Snapshot,
  Watchlist,
  WatchlistWithAsins,
} from "./types";

/** Danh sách ngày (captured_on) đã có snapshot — cho date picker. Mới nhất trước. */
export async function getAvailableDates(): Promise<string[]> {
  const { data, error } = await getSupabaseServer()
    .from("snapshots")
    .select("captured_on")
    .order("captured_on", { ascending: false });
  if (error) throw error;
  const set = new Set<string>((data || []).map((r: { captured_on: string }) => r.captured_on));
  return Array.from(set);
}

/** Ngày snapshot mới nhất hiện có (fallback về hôm nay nếu DB trống). */
export async function getLatestDate(): Promise<string | null> {
  const { data, error } = await getSupabaseServer()
    .from("snapshots")
    .select("captured_on")
    .order("captured_on", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data?.captured_on ?? null;
}

/**
 * Dashboard rows: TẤT CẢ asin đang track, kèm snapshot của đúng `date` (nếu có).
 * Dùng embedded filter để left-join: asin luôn trả về, snapshot lọc theo ngày.
 */
export async function getDashboardRows(date: string): Promise<DashboardRow[]> {
  const { data, error } = await getSupabaseServer()
    .from("asins")
    .select("*, snapshots(*)")
    .eq("snapshots.captured_on", date)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return (data || []).map((row: Asin & { snapshots: Snapshot[] }) => {
    const { snapshots, ...asin } = row;
    return {
      asin: asin as Asin,
      snapshot: snapshots && snapshots.length > 0 ? snapshots[0] : null,
    };
  });
}

/** Lấy 1 ASIN theo mã asin. */
export async function getAsinByCode(asin: string): Promise<Asin | null> {
  const { data, error } = await getSupabaseServer()
    .from("asins")
    .select("*")
    .eq("asin", asin)
    .maybeSingle();
  if (error) throw error;
  return (data as Asin) ?? null;
}

/** Toàn bộ snapshot của 1 ASIN theo thời gian tăng dần — cho biểu đồ chi tiết. */
export async function getSnapshotsForAsin(asinId: string): Promise<Snapshot[]> {
  const { data, error } = await getSupabaseServer()
    .from("snapshots")
    .select("*")
    .eq("asin_id", asinId)
    .order("captured_on", { ascending: true });
  if (error) throw error;
  return (data as Snapshot[]) || [];
}

/** Danh sách watchlist + ASIN trong mỗi list. */
export async function getWatchlists(): Promise<WatchlistWithAsins[]> {
  const { data, error } = await getSupabaseServer()
    .from("watchlists")
    .select("*, watchlist_asins(asins(*))")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data || []).map(
    (w: Watchlist & { watchlist_asins: { asins: Asin }[] }) => {
      const { watchlist_asins, ...rest } = w;
      const asins = (watchlist_asins || [])
        .map((wa) => wa.asins)
        .filter(Boolean) as Asin[];
      return { ...(rest as Watchlist), asins };
    }
  );
}

/** Tổng số ASIN đang track (để hiển thị so với giới hạn 500). */
export async function getTrackedCount(): Promise<number> {
  const { count, error } = await getSupabaseServer()
    .from("asins")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Danh sách preset dòng sản phẩm (Sticker/Ornament/...). */
export async function getProductLines(): Promise<ProductLine[]> {
  const { data, error } = await getSupabaseServer()
    .from("product_lines")
    .select("*")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data as ProductLine[]) || [];
}

/** Các discover job gần đây (cho danh sách + kết quả). */
export async function getRecentDiscoverJobs(limit = 10): Promise<DiscoverJob[]> {
  const { data, error } = await getSupabaseServer()
    .from("discover_jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data as DiscoverJob[]) || [];
}
