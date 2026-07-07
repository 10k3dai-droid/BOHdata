// POST /api/import-csv — nhận danh sách ASIN (đã parse phía client từ CSV Helium 10)
// và insert vào bảng asins với source='h10_csv'. Lần crawler sau sẽ tự chụp snapshot.
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

const ASIN_RE = /^[A-Z0-9]{10}$/;
const MAX_TRACKED = 500;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const raw: unknown[] = Array.isArray(body?.asins) ? body.asins : [];

    // Chuẩn hóa + validate + loại trùng.
    const seen = new Set<string>();
    const asins: string[] = [];
    for (const a of raw) {
      const v = String(a || "").trim().toUpperCase();
      if (ASIN_RE.test(v) && !seen.has(v)) {
        seen.add(v);
        asins.push(v);
      }
    }
    if (asins.length === 0) {
      return NextResponse.json({ error: "Không có ASIN hợp lệ trong file." }, { status: 400 });
    }

    // Kiểm tra giới hạn 500 ASIN.
    const supabaseServer = getSupabaseServer();
    const { count } = await supabaseServer
      .from("asins")
      .select("*", { count: "exact", head: true });
    const room = MAX_TRACKED - (count ?? 0);
    if (room <= 0) {
      return NextResponse.json(
        { error: `Đã đạt giới hạn ${MAX_TRACKED} ASIN.` },
        { status: 400 }
      );
    }
    const toInsert = asins.slice(0, room).map((asin) => ({
      asin,
      product_url: `https://www.amazon.com/dp/${asin}`,
      source: "h10_csv" as const,
    }));

    const { data, error } = await supabaseServer
      .from("asins")
      .upsert(toInsert, { onConflict: "asin", ignoreDuplicates: false })
      .select("asin");
    if (error) throw error;

    return NextResponse.json({
      inserted: data?.length ?? 0,
      skipped_over_limit: asins.length - toInsert.length,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
