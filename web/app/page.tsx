// Dashboard (/) — server component: chọn ngày, query snapshot ngày đó, render bảng.
import { DashboardClient } from "@/components/DashboardClient";
import { DatePicker } from "@/components/DatePicker";
import { EmptyState } from "@/components/ui";
import {
  getAvailableDates,
  getDashboardRows,
  getLatestDate,
  getTrackedCount,
} from "@/lib/queries";
import { todayVN } from "@/lib/format";

// Luôn lấy data mới (internal tool, data đổi mỗi ngày).
export const dynamic = "force-dynamic";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: { date?: string };
}) {
  const [availableDates, latest, trackedCount] = await Promise.all([
    getAvailableDates(),
    getLatestDate(),
    getTrackedCount(),
  ]);

  // Ngày đang chọn: ưu tiên query param → ngày mới nhất có data → hôm nay (giờ VN).
  const selectedDate = searchParams.date || latest || todayVN();
  const rows = await getDashboardRows(selectedDate);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-ink">Dashboard</h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            {trackedCount}/500 ASIN đang theo dõi · snapshot ngày{" "}
            <span className="text-ink">{selectedDate}</span>
          </p>
        </div>
        <DatePicker selected={selectedDate} availableDates={availableDates} />
      </div>

      {rows.length === 0 ? (
        <EmptyState
          title="Chưa có ASIN nào"
          hint="Thêm ASIN qua trang Discover (import CSV Helium 10 hoặc discover theo category), rồi chạy crawler để có snapshot."
        />
      ) : (
        <DashboardClient rows={rows} date={selectedDate} />
      )}
    </div>
  );
}
