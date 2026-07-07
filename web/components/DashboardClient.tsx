"use client";

// DashboardClient — bảng ASIN + search/sort/filter + KPI tổng + export Excel.
// Nhận rows từ server (theo ngày đang chọn), xử lý lọc/sort/tìm kiếm in-memory cho mượt.
import Link from "next/link";
import { useMemo, useState } from "react";
import type { DashboardRow, SortDir, SortKey } from "@/lib/types";
import { fmtInt, fmtMoney, fmtMoneyCompact, fmtRating } from "@/lib/format";
import { exportDashboardToExcel } from "@/lib/exportExcel";
import { FulfillmentBadge, KpiCard, SourceBadge } from "@/components/ui";

interface Props {
  rows: DashboardRow[];
  date: string;
}

const COLUMNS: { key: SortKey; label: string; align?: "right" }[] = [
  { key: "title", label: "Sản phẩm" },
  { key: "bsr", label: "BSR", align: "right" },
  { key: "price", label: "Giá", align: "right" },
  { key: "sales_est", label: "Sales/mo", align: "right" },
  { key: "revenue_est", label: "Revenue/mo", align: "right" },
  { key: "review_count", label: "Reviews", align: "right" },
  { key: "rating", label: "Rating", align: "right" },
];

function snapValue(row: DashboardRow, key: SortKey): number | string | null {
  if (key === "title") return (row.asin.title ?? row.asin.asin).toLowerCase();
  return row.snapshot ? (row.snapshot[key as keyof typeof row.snapshot] as number | null) : null;
}

export function DashboardClient({ rows, date }: Props) {
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("revenue_est");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [bsrMax, setBsrMax] = useState("");
  const [salesMin, setSalesMin] = useState("");
  const [revenueMin, setRevenueMin] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const bsrMaxN = bsrMax ? Number(bsrMax) : null;
    const salesMinN = salesMin ? Number(salesMin) : null;
    const revenueMinN = revenueMin ? Number(revenueMin) : null;

    let out = rows.filter(({ asin, snapshot }) => {
      if (q) {
        const hay = `${asin.title ?? ""} ${asin.asin}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (bsrMaxN !== null && (snapshot?.bsr == null || snapshot.bsr > bsrMaxN)) return false;
      if (salesMinN !== null && (snapshot?.sales_est == null || snapshot.sales_est < salesMinN)) return false;
      if (revenueMinN !== null && (snapshot?.revenue_est == null || snapshot.revenue_est < revenueMinN)) return false;
      return true;
    });

    out = [...out].sort((a, b) => {
      const va = snapValue(a, sortKey);
      const vb = snapValue(b, sortKey);
      // null luôn xuống cuối bất kể hướng sort.
      if (va == null && vb == null) return 0;
      if (va == null) return 1;
      if (vb == null) return -1;
      if (typeof va === "string" && typeof vb === "string") {
        return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return sortDir === "asc" ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });

    return out;
  }, [rows, search, sortKey, sortDir, bsrMax, salesMin, revenueMin]);

  // KPI tổng trên tập đang hiển thị.
  const totals = useMemo(() => {
    let sales = 0;
    let revenue = 0;
    let ratingSum = 0;
    let ratingCount = 0;
    for (const { snapshot } of filtered) {
      if (snapshot?.sales_est) sales += snapshot.sales_est;
      if (snapshot?.revenue_est) revenue += snapshot.revenue_est;
      if (snapshot?.rating != null) {
        ratingSum += snapshot.rating;
        ratingCount++;
      }
    }
    return {
      count: filtered.length,
      sales,
      revenue,
      avgRating: ratingCount ? ratingSum / ratingCount : null,
    };
  }, [filtered]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "title" ? "asc" : "desc");
    }
  }

  return (
    <div className="space-y-4">
      {/* KPI tổng */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <KpiCard label="ASIN hiển thị" value={fmtInt(totals.count)} />
        <KpiCard label="Tổng Sales/mo" value={fmtInt(totals.sales)} hint="Tổng units ước tính" />
        <KpiCard label="Tổng Revenue/mo" value={fmtMoneyCompact(totals.revenue)} hint={fmtMoney(totals.revenue)} />
        <KpiCard label="Rating TB" value={totals.avgRating != null ? fmtRating(totals.avgRating) : "—"} />
      </div>

      {/* Thanh công cụ: search + filter + export */}
      <div className="card p-3">
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label" htmlFor="search">Tìm kiếm (title / ASIN)</label>
            <input
              id="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="vd: echo dot hoặc B08N5WRWNW"
              className="input w-full"
            />
          </div>
          <div className="w-28">
            <label className="label">BSR ≤</label>
            <input value={bsrMax} onChange={(e) => setBsrMax(e.target.value)} inputMode="numeric" className="input w-full" placeholder="500" />
          </div>
          <div className="w-28">
            <label className="label">Sales ≥</label>
            <input value={salesMin} onChange={(e) => setSalesMin(e.target.value)} inputMode="numeric" className="input w-full" placeholder="1000" />
          </div>
          <div className="w-32">
            <label className="label">Revenue ≥ $</label>
            <input value={revenueMin} onChange={(e) => setRevenueMin(e.target.value)} inputMode="numeric" className="input w-full" placeholder="50000" />
          </div>
          <button
            onClick={() => exportDashboardToExcel(filtered, date)}
            className="btn btn-accent"
            disabled={filtered.length === 0}
            title="Xuất dữ liệu đang hiển thị ra Excel"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4" />
              <path d="M4 21h16" />
            </svg>
            Export Excel
          </button>
        </div>
      </div>

      {/* Bảng */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-collapse">
            <thead className="border-b border-line bg-bg-soft">
              <tr>
                {COLUMNS.map((col) => (
                  <th
                    key={col.key}
                    className={`th cursor-pointer hover:text-ink ${col.align === "right" ? "text-right" : ""}`}
                    onClick={() => toggleSort(col.key)}
                  >
                    <span className="inline-flex items-center gap-1">
                      {col.label}
                      {sortKey === col.key && (
                        <span className="text-accent">{sortDir === "asc" ? "▲" : "▼"}</span>
                      )}
                    </span>
                  </th>
                ))}
                <th className="th text-right">Fulfil</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(({ asin, snapshot }) => (
                <tr key={asin.id} className="border-b border-line/60 transition-colors hover:bg-bg-hover/50">
                  {/* Sản phẩm: ảnh + title + asin */}
                  <td className="td">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asin.image_url ?? "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="}
                        alt=""
                        width={44}
                        height={44}
                        className="h-11 w-11 flex-none rounded-md border border-line bg-white object-contain"
                      />
                      <div className="min-w-0">
                        <Link href={`/asin/${asin.asin}`} className="block truncate text-sm font-medium text-ink hover:text-accent">
                          {asin.title ?? asin.asin}
                        </Link>
                        <div className="mt-0.5 flex items-center gap-2">
                          <a
                            href={asin.product_url ?? `https://www.amazon.com/dp/${asin.asin}`}
                            target="_blank"
                            rel="noreferrer"
                            className="font-mono text-xs text-ink-soft hover:text-accent"
                          >
                            {asin.asin}
                          </a>
                          <SourceBadge source={asin.source} />
                          {asin.category && <span className="truncate text-xs text-ink-faint">· {asin.category}</span>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="td text-right tabular-nums">{fmtInt(snapshot?.bsr)}</td>
                  <td className="td text-right tabular-nums">{fmtMoney(snapshot?.price)}</td>
                  <td className="td text-right tabular-nums">{fmtInt(snapshot?.sales_est)}</td>
                  <td className="td text-right tabular-nums font-medium text-ink">{fmtMoney(snapshot?.revenue_est)}</td>
                  <td className="td text-right tabular-nums">{fmtInt(snapshot?.review_count)}</td>
                  <td className="td text-right tabular-nums">{fmtRating(snapshot?.rating)}</td>
                  <td className="td text-right"><FulfillmentBadge value={snapshot?.fulfillment ?? null} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filtered.length === 0 && (
          <div className="px-6 py-14 text-center text-sm text-ink-soft">
            Không có ASIN nào khớp bộ lọc cho ngày <span className="text-ink">{date}</span>.
          </div>
        )}
      </div>
    </div>
  );
}
