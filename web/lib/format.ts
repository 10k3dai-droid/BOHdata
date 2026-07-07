// format.ts — Helper format số/tiền/ngày cho UI (locale en-US, tiền USD).

export function fmtInt(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

export function fmtMoney(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(n);
}

export function fmtMoneyCompact(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

export function fmtRating(n: number | null | undefined): string {
  if (n === null || n === undefined) return "—";
  return `${n.toFixed(1)}★`;
}

export function fmtDate(d: string | null | undefined): string {
  if (!d) return "—";
  return d; // đã là YYYY-MM-DD
}

// Ngày hôm nay theo giờ VN (UTC+7) dạng YYYY-MM-DD — đồng bộ với crawler.
export function todayVN(): string {
  const now = new Date();
  const vn = new Date(now.getTime() + 7 * 60 * 60 * 1000);
  return vn.toISOString().slice(0, 10);
}
