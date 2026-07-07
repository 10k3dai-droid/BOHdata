"use client";

// CreateWatchlist — form tạo watchlist mới, POST /api/watchlists rồi refresh.
import { useRouter } from "next/navigation";
import { useState } from "react";

export function CreateWatchlist() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [owner, setOwner] = useState("");
  const [keyword, setKeyword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError("Nhập tên watchlist.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/watchlists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, owner, keyword }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error ?? "Tạo watchlist thất bại.");
      setName("");
      setOwner("");
      setKeyword("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi không xác định");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={submit} className="card p-4">
      <h2 className="mb-3 text-sm font-semibold text-ink">Tạo watchlist mới</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div>
          <label className="label">Tên *</label>
          <input value={name} onChange={(e) => setName(e.target.value)} className="input w-full" placeholder="Smart Home Q3" />
        </div>
        <div>
          <label className="label">Người phụ trách</label>
          <input value={owner} onChange={(e) => setOwner(e.target.value)} className="input w-full" placeholder="Cường / Tú / Ánh" />
        </div>
        <div>
          <label className="label">Keyword / niche</label>
          <input value={keyword} onChange={(e) => setKeyword(e.target.value)} className="input w-full" placeholder="smart speaker alexa" />
        </div>
      </div>
      {error && <p className="mt-2 text-sm text-bad">{error}</p>}
      <div className="mt-3">
        <button type="submit" disabled={loading} className="btn btn-accent">
          {loading ? "Đang tạo..." : "Tạo watchlist"}
        </button>
      </div>
    </form>
  );
}
