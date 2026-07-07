// POST /api/discover — lưu 1 discover job (status=pending) để crawler xử lý.
// Hỗ trợ 3 mode: keyword | category | best_sellers.
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";
import type { DiscoverFilters } from "@/lib/types";

function toNum(v: unknown): number | null {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const mode: string =
      body?.mode === "keyword" || body?.mode === "best_sellers" ? body.mode : "category";

    const keyword = body?.keyword ? String(body.keyword).trim() : null;
    const category_node = body?.category_node ? String(body.category_node).trim() : null;

    // Validate theo mode.
    if (mode === "keyword" && !keyword) {
      return NextResponse.json({ error: "Nhập keyword để tìm." }, { status: 400 });
    }
    if ((mode === "category" || mode === "best_sellers") && !category_node) {
      return NextResponse.json({ error: "Nhập category node." }, { status: 400 });
    }

    const filters: DiscoverFilters = {
      bsr_max: toNum(body?.filters?.bsr_max),
      price_min: toNum(body?.filters?.price_min),
      price_max: toNum(body?.filters?.price_max),
      revenue_min: toNum(body?.filters?.revenue_min),
      rating_min: toNum(body?.filters?.rating_min),
      monthly_sold_min: toNum(body?.filters?.monthly_sold_min),
    };

    const { data, error } = await getSupabaseServer()
      .from("discover_jobs")
      .insert({ mode, keyword, category_node, filters, status: "pending" })
      .select()
      .single();
    if (error) throw error;

    return NextResponse.json({ data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
