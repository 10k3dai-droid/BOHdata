"use client";

// DiscoverSearch — tìm ASIN top theo Keyword / Category / Dòng sản phẩm + bộ lọc.
// Tạo discover job (pending); crawler xử lý và trả kết quả vào JobsList.
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { ProductLine } from "@/lib/types";

type Mode = "keyword" | "category" | "product_line";

interface Filters {
  bsr_max: string;
  price_min: string;
  price_max: string;
  revenue_min: string;
  rating_min: string;
  monthly_sold_min: string;
}

const EMPTY_FILTERS: Filters = {
  bsr_max: "",
  price_min: "",
  price_max: "",
  revenue_min: "",
  rating_min: "",
  monthly_sold_min: "",
};

export function DiscoverSearch({
  productLines,
  onSubmitted,
}: {
  productLines: ProductLine[];
  onSubmitted: () => void;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("keyword");
  const [keyword, setKeyword] = useState("");
  const [categoryNode, setCategoryNode] = useState("");
  const [bestSellers, setBestSellers] = useState(false);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [status, setStatus] = useState<{ ok?: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  function updF(key: keyof Filters, v: string) {
    setFilters((p) => ({ ...p, [key]: v }));
  }

  // Gửi 1 job discover với keyword cho trước (dùng cho cả keyword & product line).
  async function submitKeyword(kw: string) {
    if (!kw.trim()) {
      setStatus({ ok: false, msg: "Nhập keyword để tìm." });
      return;
    }
    await postJob({ mode: "keyword", keyword: kw, filters });
  }

  async function submitCategory() {
    if (!categoryNode.trim()) {
      setStatus({ ok: false, msg: "Nhập category node (số Keepa)." });
      return;
    }
    await postJob({
      mode: bestSellers ? "best_sellers" : "category",
      category_node: categoryNode,
      filters,
    });
  }

  async function postJob(payload: Record<string, unknown>) {
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/discover", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Tạo job thất bại.");

      // Thông báo theo trạng thái kích hoạt crawler cloud (GitHub Actions).
      const d = json?.dispatch;
      let msg: string;
      if (d?.ok) {
        msg = "✅ Đã tạo job & kích hoạt crawler cloud (GitHub Actions). Kết quả sẽ hiện bên dưới sau vài phút.";
      } else if (d?.configured) {
        msg = `Đã tạo job nhưng kích hoạt cloud lỗi (${d.error ?? "?"}). Vào GitHub → Actions → Run workflow "Run discover".`;
      } else {
        msg =
          "Đã tạo job (pending). Chạy crawler để lấy kết quả: GitHub Actions → 'Run discover' → Run workflow, hoặc local `python main.py --only-discover`.";
      }
      setStatus({ ok: true, msg });
      onSubmitted();
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Lỗi không xác định" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4 p-4">
      {/* Chọn mode */}
      <div className="inline-flex flex-wrap rounded-lg border border-line bg-bg-soft p-1">
        {(
          [
            ["keyword", "Theo Keyword"],
            ["product_line", "Theo Dòng sản phẩm"],
            ["category", "Theo Category"],
          ] as [Mode, string][]
        ).map(([m, label]) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              mode === m ? "bg-bg-hover text-ink" : "text-ink-soft hover:text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Mode: Keyword */}
      {mode === "keyword" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[240px] flex-1">
            <label className="label">Keyword (khớp trong tên sản phẩm)</label>
            <input
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitKeyword(keyword)}
              className="input w-full"
              placeholder="vd: dad birthday gift, funny cat sticker..."
            />
          </div>
          <button onClick={() => submitKeyword(keyword)} disabled={loading} className="btn btn-accent">
            {loading ? "Đang tạo..." : "Tìm ASIN top"}
          </button>
        </div>
      )}

      {/* Mode: Product line */}
      {mode === "product_line" && (
        <ProductLinePanel
          productLines={productLines}
          loading={loading}
          onPick={(kw) => submitKeyword(kw)}
          onChanged={() => router.refresh()}
        />
      )}

      {/* Mode: Category */}
      {mode === "category" && (
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="label">Category node (số Keepa)</label>
            <input
              value={categoryNode}
              onChange={(e) => setCategoryNode(e.target.value)}
              className="input w-full"
              placeholder="vd: 172282 (Electronics)"
            />
          </div>
          <label className="flex items-center gap-2 pb-2 text-sm text-ink-soft">
            <input type="checkbox" checked={bestSellers} onChange={(e) => setBestSellers(e.target.checked)} />
            Best sellers
          </label>
          <button onClick={submitCategory} disabled={loading} className="btn btn-accent">
            {loading ? "Đang tạo..." : "Tìm ASIN top"}
          </button>
        </div>
      )}

      {/* Bộ lọc chung (áp cho keyword & category, best_sellers bỏ qua) */}
      {mode !== "product_line" && (
        <details className="rounded-lg border border-line bg-bg-soft p-3">
          <summary className="cursor-pointer text-sm font-medium text-ink-soft">Bộ lọc nâng cao</summary>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <F label="BSR ≤" v={filters.bsr_max} on={(v) => updF("bsr_max", v)} ph="5000" />
            <F label="Giá min ($)" v={filters.price_min} on={(v) => updF("price_min", v)} ph="10" />
            <F label="Giá max ($)" v={filters.price_max} on={(v) => updF("price_max", v)} ph="60" />
            <F label="Revenue min ($/mo)" v={filters.revenue_min} on={(v) => updF("revenue_min", v)} ph="20000" />
            <F label="Rating min" v={filters.rating_min} on={(v) => updF("rating_min", v)} ph="4.0" />
            <F label="Sales min (units/mo)" v={filters.monthly_sold_min} on={(v) => updF("monthly_sold_min", v)} ph="300" />
          </div>
        </details>
      )}

      {status && <p className={`text-sm ${status.ok ? "text-good" : "text-bad"}`}>{status.msg}</p>}
    </div>
  );
}

function F({ label, v, on, ph }: { label: string; v: string; on: (v: string) => void; ph?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input value={v} onChange={(e) => on(e.target.value)} inputMode="decimal" className="input w-full" placeholder={ph} />
    </div>
  );
}

// ---- Panel dòng sản phẩm: bấm preset để tìm + quản lý thêm/xóa ---------------
function ProductLinePanel({
  productLines,
  loading,
  onPick,
  onChanged,
}: {
  productLines: ProductLine[];
  loading: boolean;
  onPick: (keyword: string) => void;
  onChanged: () => void;
}) {
  const [newName, setNewName] = useState("");
  const [newKeyword, setNewKeyword] = useState("");
  const [busy, setBusy] = useState(false);

  async function addLine(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setBusy(true);
    try {
      await fetch("/api/product-lines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName, keyword: newKeyword || newName }),
      });
      setNewName("");
      setNewKeyword("");
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  async function removeLine(id: string) {
    setBusy(true);
    try {
      await fetch(`/api/product-lines?id=${id}`, { method: "DELETE" });
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <div className="label">Bấm 1 dòng sản phẩm để tìm ASIN top (dùng keyword đó)</div>
        <div className="flex flex-wrap gap-2">
          {productLines.length === 0 && (
            <span className="text-sm text-ink-faint">Chưa có preset — thêm bên dưới.</span>
          )}
          {productLines.map((pl) => (
            <span key={pl.id} className="group inline-flex items-center overflow-hidden rounded-lg border border-line bg-bg-soft">
              <button
                onClick={() => onPick(pl.keyword)}
                disabled={loading}
                className="px-3 py-1.5 text-sm font-medium text-ink transition-colors hover:bg-bg-hover"
                title={`Tìm keyword: ${pl.keyword}`}
              >
                {pl.name}
              </button>
              <button
                onClick={() => removeLine(pl.id)}
                disabled={busy}
                className="border-l border-line px-2 py-1.5 text-ink-faint transition-colors hover:bg-bad/15 hover:text-bad"
                title="Xóa preset"
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* Thêm preset mới */}
      <form onSubmit={addLine} className="flex flex-wrap items-end gap-2 border-t border-line/60 pt-3">
        <div>
          <label className="label">Tên dòng</label>
          <input value={newName} onChange={(e) => setNewName(e.target.value)} className="input w-40" placeholder="Tumbler" />
        </div>
        <div>
          <label className="label">Keyword (tùy chọn)</label>
          <input value={newKeyword} onChange={(e) => setNewKeyword(e.target.value)} className="input w-48" placeholder="tumbler" />
        </div>
        <button type="submit" disabled={busy || !newName.trim()} className="btn">
          + Thêm dòng
        </button>
      </form>
    </div>
  );
}
