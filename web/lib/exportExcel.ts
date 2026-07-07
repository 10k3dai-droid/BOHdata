// exportExcel.ts — Xuất dữ liệu dashboard đang hiển thị ra file .xlsx (SheetJS).
// Chạy phía client (dùng trong nút Export).
import * as XLSX from "xlsx";
import type { DashboardRow } from "./types";

/**
 * Xuất danh sách dòng dashboard (đã lọc/sort) ra Excel.
 * @param rows  các dòng đang hiển thị
 * @param date  ngày đang chọn (đưa vào tên file)
 */
export function exportDashboardToExcel(rows: DashboardRow[], date: string): void {
  const data = rows.map(({ asin, snapshot }) => ({
    ASIN: asin.asin,
    Title: asin.title ?? "",
    Category: asin.category ?? "",
    Brand: asin.brand ?? "",
    Source: asin.source,
    BSR: snapshot?.bsr ?? "",
    Price: snapshot?.price ?? "",
    "Sales/mo": snapshot?.sales_est ?? "",
    "Revenue/mo": snapshot?.revenue_est ?? "",
    Reviews: snapshot?.review_count ?? "",
    Rating: snapshot?.rating ?? "",
    Sellers: snapshot?.seller_count ?? "",
    Fulfillment: snapshot?.fulfillment ?? "",
    "Buy Box": snapshot?.buy_box_price ?? "",
    "Captured On": snapshot?.captured_on ?? "",
    "Amazon URL": asin.product_url ?? `https://www.amazon.com/dp/${asin.asin}`,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  // Set độ rộng cột cho dễ đọc.
  ws["!cols"] = [
    { wch: 12 }, { wch: 40 }, { wch: 18 }, { wch: 16 }, { wch: 12 },
    { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    { wch: 8 }, { wch: 8 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, { wch: 36 },
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "ASINs");

  const filename = `asin-tracker_${date}.xlsx`;
  XLSX.writeFile(wb, filename);
}
