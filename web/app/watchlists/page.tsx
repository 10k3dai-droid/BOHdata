// Watchlists (/watchlists) — tạo/xem nhóm ASIN theo niche hoặc người phụ trách.
import Link from "next/link";
import { CreateWatchlist } from "@/components/CreateWatchlist";
import { EmptyState, SourceBadge } from "@/components/ui";
import { getWatchlists } from "@/lib/queries";

export const dynamic = "force-dynamic";

export default async function WatchlistsPage() {
  const watchlists = await getWatchlists();

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-ink">Watchlists</h1>
        <p className="mt-0.5 text-sm text-ink-soft">Nhóm ASIN theo niche hoặc người phụ trách.</p>
      </div>

      <CreateWatchlist />

      {watchlists.length === 0 ? (
        <EmptyState title="Chưa có watchlist" hint="Tạo watchlist đầu tiên ở form phía trên." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {watchlists.map((w) => (
            <div key={w.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold text-ink">{w.name}</h3>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-ink-soft">
                    {w.owner && <span>👤 {w.owner}</span>}
                    {w.keyword && <span>· {w.keyword}</span>}
                  </div>
                </div>
                <span className="rounded-md bg-bg-soft px-2 py-0.5 text-xs text-ink-soft">
                  {w.asins.length} ASIN
                </span>
              </div>

              {w.asins.length > 0 && (
                <ul className="mt-3 divide-y divide-line/60">
                  {w.asins.map((a) => (
                    <li key={a.id} className="flex items-center gap-3 py-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={a.image_url ?? "data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw=="}
                        alt=""
                        className="h-9 w-9 flex-none rounded border border-line bg-white object-contain"
                      />
                      <Link href={`/asin/${a.asin}`} className="min-w-0 flex-1 truncate text-sm text-ink hover:text-accent">
                        {a.title ?? a.asin}
                      </Link>
                      <SourceBadge source={a.source} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
