// ui.tsx — Các mảnh UI nhỏ dùng lại: Badge, KpiCard, EmptyState, SourceBadge.
import type { AsinSource } from "@/lib/types";

export function KpiCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="card p-4">
      <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">
        {label}
      </div>
      <div className="mt-1.5 text-2xl font-semibold tracking-tight text-ink">
        {value}
      </div>
      {hint && <div className="mt-0.5 text-xs text-ink-faint">{hint}</div>}
    </div>
  );
}

export function EmptyState({
  title,
  hint,
}: {
  title: string;
  hint?: string;
}) {
  return (
    <div className="card grid place-items-center px-6 py-16 text-center">
      <div className="text-sm font-medium text-ink">{title}</div>
      {hint && <div className="mt-1 max-w-md text-sm text-ink-soft">{hint}</div>}
    </div>
  );
}

const SOURCE_STYLE: Record<AsinSource, string> = {
  keepa_finder: "bg-accent/15 text-accent",
  h10_csv: "bg-teal-400/15 text-accent-teal",
  manual: "bg-white/5 text-ink-soft",
};

const SOURCE_LABEL: Record<AsinSource, string> = {
  keepa_finder: "Keepa",
  h10_csv: "H10 CSV",
  manual: "Manual",
};

export function SourceBadge({ source }: { source: AsinSource }) {
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${SOURCE_STYLE[source]}`}
    >
      {SOURCE_LABEL[source]}
    </span>
  );
}

export function FulfillmentBadge({ value }: { value: string | null }) {
  if (!value) return <span className="text-ink-faint">—</span>;
  const color =
    value === "AMZ"
      ? "bg-warn/15 text-warn"
      : value === "FBA"
        ? "bg-good/15 text-good"
        : "bg-white/5 text-ink-soft";
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-medium ${color}`}>
      {value}
    </span>
  );
}
