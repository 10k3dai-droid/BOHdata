"use client";

// JobsList — hiển thị các discover job gần đây + kết quả (ảnh + link).
// Tự poll trạng thái mỗi 4s khi còn job pending/running (để thấy crawler chạy xong).
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import type { DiscoverJob } from "@/lib/types";
import { fmtInt, fmtMoney, fmtRating } from "@/lib/format";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-white/5 text-ink-soft",
  running: "bg-accent/15 text-accent",
  done: "bg-good/15 text-good",
  error: "bg-bad/15 text-bad",
};

const STATUS_LABEL: Record<string, string> = {
  pending: "Chờ crawler",
  running: "Đang chạy",
  done: "Xong",
  error: "Lỗi",
};

export function JobsList({
  initialJobs,
  refreshSignal = 0,
}: {
  initialJobs: DiscoverJob[];
  refreshSignal?: number;
}) {
  const [jobs, setJobs] = useState<DiscoverJob[]>(initialJobs);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/api/discover/jobs", { cache: "no-store" });
      const json = await res.json();
      if (res.ok) setJobs(json.data ?? []);
    } catch {
      /* im lặng, thử lại lần poll sau */
    }
  }, []);

  // Refresh ngay khi có job mới được tạo (refreshSignal đổi).
  useEffect(() => {
    if (refreshSignal > 0) refresh();
  }, [refreshSignal, refresh]);

  const hasActive = jobs.some((j) => j.status === "pending" || j.status === "running");

  useEffect(() => {
    // Chỉ poll khi có job đang chạy.
    if (hasActive) {
      timer.current = setInterval(refresh, 4000);
      return () => {
        if (timer.current) clearInterval(timer.current);
      };
    }
  }, [hasActive, refresh]);

  if (jobs.length === 0) {
    return (
      <div className="card px-6 py-10 text-center text-sm text-ink-soft">
        Chưa có lượt tìm nào. Tạo job ở trên rồi chạy crawler để thấy kết quả.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-ink">Kết quả tìm gần đây</h2>
        <button onClick={refresh} className="text-xs text-ink-soft hover:text-accent">
          ↻ Làm mới
        </button>
      </div>

      {jobs.map((job) => (
        <div key={job.id} className="card p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[job.status]}`}>
              {STATUS_LABEL[job.status]}
            </span>
            <span className="text-sm font-medium text-ink">
              {job.mode === "keyword"
                ? `Keyword: "${job.keyword}"`
                : job.mode === "best_sellers"
                  ? `Best sellers: cat ${job.category_node}`
                  : `Category: ${job.category_node}`}
            </span>
            {job.result_count != null && (
              <span className="text-xs text-ink-faint">· {job.result_count} ASIN</span>
            )}
            <span className="ml-auto text-xs text-ink-faint">
              {new Date(job.created_at).toLocaleString("vi-VN")}
            </span>
          </div>

          {job.status === "error" && job.error_message && (
            <p className="mt-2 text-sm text-bad">{job.error_message}</p>
          )}

          {(job.status === "pending" || job.status === "running") && (
            <p className="mt-2 text-sm text-ink-soft">
              Đang chờ crawler xử lý. Chạy <code className="text-ink">python main.py --only-discover</code> ở terminal.
            </p>
          )}

          {job.status === "done" && (job.result_asins?.length ?? 0) > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {job.result_asins!.map((r) => (
                <a
                  key={r.asin}
                  href={r.product_url ?? `https://www.amazon.com/dp/${r.asin}`}
                  target="_blank"
                  rel="noreferrer"
                  className="group rounded-lg border border-line bg-bg-soft p-2 transition-colors hover:border-accent/50 hover:bg-bg-hover"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={r.image_url ?? ""}
                    alt=""
                    className="mb-2 h-28 w-full rounded-md border border-line bg-white object-contain"
                  />
                  <div className="line-clamp-2 text-xs font-medium text-ink group-hover:text-accent">
                    {r.title ?? r.asin}
                  </div>
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-soft">
                    <span className="font-mono">{r.asin}</span>
                    {r.price != null && <span className="text-good">{fmtMoney(r.price)}</span>}
                    {r.bsr != null && <span>BSR {fmtInt(r.bsr)}</span>}
                    {r.sales_est != null && <span>{fmtInt(r.sales_est)}/mo</span>}
                    {r.rating != null && <span>{fmtRating(r.rating)}</span>}
                  </div>
                  <div className="mt-1">
                    <Link
                      href={`/asin/${r.asin}`}
                      onClick={(e) => e.stopPropagation()}
                      className="text-[11px] text-accent hover:underline"
                    >
                      Chi tiết →
                    </Link>
                  </div>
                </a>
              ))}
            </div>
          )}

          {job.status === "done" && (job.result_asins?.length ?? 0) === 0 && (
            <p className="mt-2 text-sm text-ink-soft">Không tìm thấy ASIN nào đạt tiêu chí (hoặc thiếu ảnh).</p>
          )}
        </div>
      ))}
    </div>
  );
}
