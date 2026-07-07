"use client";

// CsvImport — import ASIN từ CSV Helium 10 (Black Box/Cerebro/Xray).
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { extractAsinsFromCsv } from "@/lib/parseCsv";

export function CsvImport() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [asins, setAsins] = useState<string[]>([]);
  const [fileName, setFileName] = useState("");
  const [status, setStatus] = useState<{ ok?: boolean; msg: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    setStatus(null);
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    const parsed = extractAsinsFromCsv(text);
    setAsins(parsed);
    if (parsed.length === 0) {
      setStatus({ ok: false, msg: "Không tìm thấy ASIN hợp lệ trong file." });
    }
  }

  async function confirmImport() {
    if (asins.length === 0) return;
    setLoading(true);
    setStatus(null);
    try {
      const res = await fetch("/api/import-csv", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ asins }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Import thất bại.");
      setStatus({
        ok: true,
        msg: `Đã thêm ${json.inserted} ASIN (source=h10_csv)${
          json.skipped_over_limit ? `, bỏ ${json.skipped_over_limit} do vượt giới hạn 500` : ""
        }. Chạy crawler để lấy snapshot.`,
      });
      setAsins([]);
      setFileName("");
      if (inputRef.current) inputRef.current.value = "";
      router.refresh();
    } catch (err) {
      setStatus({ ok: false, msg: err instanceof Error ? err.message : "Lỗi không xác định" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card space-y-4 p-4">
      <div>
        <label className="label">File CSV export từ Helium 10 (Black Box / Cerebro / Xray)</label>
        <input
          ref={inputRef}
          type="file"
          accept=".csv,text/csv"
          onChange={onFile}
          className="block w-full text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-accent file:px-4 file:py-2 file:text-sm file:font-semibold file:text-bg hover:file:brightness-110"
        />
      </div>

      {asins.length > 0 && (
        <div className="rounded-lg border border-line bg-bg-soft p-3">
          <div className="mb-2 text-sm text-ink">
            Tìm thấy <span className="font-semibold text-accent">{asins.length}</span> ASIN trong{" "}
            <span className="text-ink-soft">{fileName}</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {asins.slice(0, 40).map((a) => (
              <span key={a} className="rounded bg-bg px-2 py-0.5 font-mono text-xs text-ink-soft">
                {a}
              </span>
            ))}
            {asins.length > 40 && <span className="px-2 py-0.5 text-xs text-ink-faint">+{asins.length - 40} nữa…</span>}
          </div>
        </div>
      )}

      {status && <p className={`text-sm ${status.ok ? "text-good" : "text-bad"}`}>{status.msg}</p>}

      <button onClick={confirmImport} disabled={loading || asins.length === 0} className="btn btn-accent">
        {loading ? "Đang thêm..." : `Xác nhận thêm ${asins.length || ""} ASIN vào track`}
      </button>
    </div>
  );
}
