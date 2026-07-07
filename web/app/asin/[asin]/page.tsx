// Chi tiết ASIN (/asin/[asin]) — ảnh lớn, link amazon, biểu đồ xu hướng theo thời gian.
import Link from "next/link";
import { notFound } from "next/navigation";
import { AsinTrendChart } from "@/components/AsinTrendChart";
import { SourceBadge, FulfillmentBadge, KpiCard } from "@/components/ui";
import { getAsinByCode, getSnapshotsForAsin } from "@/lib/queries";
import { fmtInt, fmtMoney, fmtRating } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AsinDetailPage({
  params,
}: {
  params: { asin: string };
}) {
  const asin = await getAsinByCode(params.asin);
  if (!asin) notFound();

  const snapshots = await getSnapshotsForAsin(asin.id);
  const latest = snapshots.length ? snapshots[snapshots.length - 1] : null;
  const amazonUrl = asin.product_url ?? `https://www.amazon.com/dp/${asin.asin}`;

  return (
    <div className="space-y-5">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        Về Dashboard
      </Link>

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">
        {/* Cột trái: ảnh + thông tin */}
        <div className="space-y-4">
          <div className="card grid place-items-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={asin.image_url ?? "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="}
              alt={asin.title ?? asin.asin}
              className="max-h-[260px] w-full rounded-lg border border-line bg-white object-contain"
            />
          </div>
          <div className="card space-y-2 p-4">
            <h1 className="text-base font-semibold leading-snug text-ink">
              {asin.title ?? asin.asin}
            </h1>
            <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft">
              <SourceBadge source={asin.source} />
              {asin.brand && <span>· {asin.brand}</span>}
              {asin.category && <span>· {asin.category}</span>}
            </div>
            <a href={amazonUrl} target="_blank" rel="noreferrer" className="btn btn-accent w-full">
              Xem trên Amazon
            </a>
            <div className="pt-1 text-center font-mono text-xs text-ink-faint">{asin.asin}</div>
          </div>
        </div>

        {/* Cột phải: KPI mới nhất + biểu đồ */}
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <KpiCard label="BSR" value={fmtInt(latest?.bsr)} />
            <KpiCard label="Giá" value={fmtMoney(latest?.price)} />
            <KpiCard label="Sales/mo" value={fmtInt(latest?.sales_est)} />
            <KpiCard label="Revenue/mo" value={fmtMoney(latest?.revenue_est)} />
            <KpiCard label="Reviews" value={fmtInt(latest?.review_count)} />
            <KpiCard label="Rating" value={latest?.rating != null ? fmtRating(latest.rating) : "—"} />
            <KpiCard label="Sellers" value={fmtInt(latest?.seller_count)} />
            <div className="card flex flex-col justify-center p-4">
              <div className="text-xs font-medium uppercase tracking-wide text-ink-soft">Fulfillment</div>
              <div className="mt-1.5"><FulfillmentBadge value={latest?.fulfillment ?? null} /></div>
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Xu hướng theo thời gian</h2>
              <span className="text-xs text-ink-faint">{snapshots.length} snapshot</span>
            </div>
            <AsinTrendChart snapshots={snapshots} />
          </div>
        </div>
      </div>
    </div>
  );
}
