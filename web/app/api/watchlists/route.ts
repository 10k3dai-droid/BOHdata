// POST /api/watchlists — tạo watchlist mới.
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").toString().trim();
    if (!name) {
      return NextResponse.json({ error: "Tên watchlist bắt buộc." }, { status: 400 });
    }
    const { data, error } = await getSupabaseServer()
      .from("watchlists")
      .insert({
        name,
        owner: body?.owner ? String(body.owner).trim() : null,
        keyword: body?.keyword ? String(body.keyword).trim() : null,
      })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
