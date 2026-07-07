// GET /api/discover/jobs — trả các discover job gần đây (cho web poll trạng thái + kết quả).
import { NextResponse } from "next/server";
import { getRecentDiscoverJobs } from "@/lib/queries";

export async function GET() {
  try {
    const jobs = await getRecentDiscoverJobs(10);
    return NextResponse.json({ data: jobs });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Lỗi không xác định";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
