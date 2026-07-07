// /api/product-lines — quản lý preset dòng sản phẩm.
//   POST   { name, keyword } → tạo preset mới
//   DELETE ?id=...           → xóa preset
import { NextResponse } from "next/server";
import { getSupabaseServer } from "@/lib/supabaseServer";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const name = (body?.name ?? "").toString().trim();
    // keyword mặc định = name viết thường nếu không nhập riêng.
    const keyword = (body?.keyword ?? name).toString().trim().toLowerCase();
    if (!name) {
      return NextResponse.json({ error: "Nhập tên dòng sản phẩm." }, { status: 400 });
    }
    const { data, error } = await getSupabaseServer()
      .from("product_lines")
      .insert({ name, keyword })
      .select()
      .single();
    if (error) throw error;
    return NextResponse.json({ data });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "Thiếu id." }, { status: 400 });
    }
    const { error } = await getSupabaseServer().from("product_lines").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
