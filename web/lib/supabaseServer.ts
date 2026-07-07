// supabaseServer.ts — Client Supabase phía SERVER (Server Components + Route Handlers).
// Dùng SERVICE_KEY để đọc/ghi bỏ qua RLS (internal tool). KHÔNG import file này vào client component.
//
// Khởi tạo LAZY: chỉ đọc env & tạo client khi thực sự gọi (request-time), không phải lúc import.
// Nhờ vậy `next build` không cần env (page force-dynamic không pre-render tại build).
import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

export function getSupabaseServer(): SupabaseClient {
  if (_client) return _client;

  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_KEY;

  if (!url) {
    throw new Error("Thiếu SUPABASE_URL (hoặc NEXT_PUBLIC_SUPABASE_URL) trong env.");
  }
  if (!serviceKey) {
    throw new Error(
      "Thiếu SUPABASE_SERVICE_KEY trong env. Web dùng service key ở server để đọc/ghi data (internal tool)."
    );
  }

  _client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}
