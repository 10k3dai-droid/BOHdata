# CLAUDE.md — asin-tracker

Rules & context để các phiên Claude Code sau làm việc nhất quán trên repo này.

## Tổng quan
Internal tool theo dõi & discover ASIN bán tốt trên **Amazon US**, nguồn data chính là **Keepa API**.
Monorepo 3 phần: `crawler/` (Python), `web/` (Next.js 14), `supabase/` (SQL). Dev 1 mình — ưu tiên đơn giản, chạy được thật.

## Ràng buộc BẤT BIẾN (không được vi phạm)
- Marketplace: **Amazon US** (domain amazon.com, zip 10001, Keepa domain `US`).
- Tối đa **500 ASIN** theo dõi — kiểm tra giới hạn trước khi insert ASIN mới.
- Keepa: gói €49/tháng, **20 token/phút**, 1 token = 1 product, token hết hạn sau 60 phút. Luôn dùng `wait=True` của library `keepa` để tự chờ token.
- **KHÔNG** scrape trực tiếp amazon.com. **KHÔNG** tự động thao tác UI Helium 10.
- Helium 10 Diamond không có API → chỉ **import CSV thủ công** (Black Box/Cerebro/Xray), source `h10_csv`.

## Schema DB (Supabase/Postgres) — nguồn chân lý ở `supabase/migrations/0001_init.sql`
- `asins`: id(uuid pk), asin(unique), title, image_url, product_url, category, brand, source(`keepa_finder`|`h10_csv`|`manual`), created_at.
- `snapshots`: id, asin_id(fk→asins, cascade), captured_on(date), bsr, price, sales_est, revenue_est, review_count, rating, seller_count, fulfillment(FBA/FBM/AMZ), buy_box_price, raw(jsonb), created_at. **UNIQUE (asin_id, captured_on)**.
- `watchlists`: id, name, owner, keyword, created_at.
- `watchlist_asins`: (watchlist_id, asin_id) pk kép.
- `discover_jobs` (mở rộng): mode, category_node, filters(jsonb), status(pending|running|done|error), result_count… — web ghi `pending`, crawler đọc & chạy.
- RLS bật, policy đơn giản: `service_role` full (crawler & web-server), `authenticated` read; snapshots chỉ crawler ghi.

## Quy ước Crawler (Python) — đã kiểm chứng với data thật
- Chạy trên **Python 3.14** (venv `crawler/.venv`), toàn bộ lib có wheel cp314.
- Idempotent: UPSERT snapshot theo `(asin_id, captured_on)`.
- Batch query nhiều ASIN/lần (`KEEPA_BATCH_SIZE`). Retry + logging ra file utf-8 (`crawler/logs/`) + stdout.
- **Query params** (`keepa_client.query_batch`): `stats=30, history=False, rating=True, buybox=True, wait=True`.
  - `history=False` để tránh numpy array trong response (không cần history cho snapshot).
  - `raw` phải qua `_json_safe()` (json.dumps default=str) vì response chứa datetime → jsonb sẽ lỗi nếu ghi thẳng.
- **Parse (đọc `stats.current`, KHÔNG dùng csv):** giá & buy box ở **cent → /100**; giá trị `< 0` (-1 no data, -2 not requested) → None.
  - price = current[1] NEW (fallback current[0] AMAZON); BSR = current[3] SALES (fallback salesRanks).
  - rating = current[16]/10 (cần `rating=True`); review_count = current[17] (cần `rating=True`).
  - buy_box_price = `stats.buyBoxPrice` (cần `buybox=True`), fallback giá NEW; fulfillment từ `buyBoxIsAmazon`/`buyBoxIsFBA`.
  - seller_count = `stats.totalOfferCount` (fallback current[11]); sales_est = top-level `monthlySold`.
  - **Ảnh: field `images`** (list dict, lấy `l`=large filename) → `IMAGE_HOST + name`; `imagesCSV` thường None (fallback).
  - **productType 4 = variation-parent/invalid** → không có data giá; log warning, nên track ASIN con.
- **Token cost:** base 1 + rating +1 + buybox +2 ≈ **3-4 token/sản phẩm**. Tắt `KEEPA_WITH_RATING`/`KEEPA_WITH_BUYBOX` trong config để giảm còn 1 token/sản phẩm nếu cần tiết kiệm.
- Entry: `main.py`. Discover: `discover.py`. Import: `import_h10_csv.py`. Config fail-fast trong `config.py`.

## ⚠️ Thực tế token Keepa (quan trọng)
- Gói €49 = **20 token/phút** (giả định trong thiết kế). Tài khoản test hiện tại refill **1 token/phút** (free tier) → 500 ASIN × ~4 token = ~33h, KHÔNG khả thi. **Cần kích hoạt subscription €49** để crawl 500 ASIN/ngày (~100 phút).
- `TOKENS_PER_MINUTE` trong `config.py` chỉ để ước tính; refill thật đọc từ Keepa lúc chạy.

## Quy ước Web (Next.js 14 App Router + TS + Tailwind)
- Data đọc/ghi qua **server** bằng `SUPABASE_SERVICE_KEY` (lazy init trong `lib/supabaseServer.ts` — `getSupabaseServer()`). KHÔNG import file server vào client component.
- Queries tập trung ở `lib/queries.ts`. Mutations qua API routes (`app/api/*`).
- Trang data để `export const dynamic = "force-dynamic"` (build không cần DB → deploy Vercel OK).
- UI: **dark premium**, Tailwind thuần (token màu trong `tailwind.config.ts`, class dùng lại trong `globals.css`: `.card`, `.btn`, `.input`, `.th`, `.td`). Responsive mobile.
- Export Excel: SheetJS client-side (`lib/exportExcel.ts`), tên file gồm ngày.
- Chart: Chart.js qua `react-chartjs-2` (đăng ký element trong component).
- Next pin **14.x** (đang dùng bản đã vá bảo mật). Không nhảy lên 15 trừ khi được yêu cầu.

## Lệnh hay dùng
- Web: `cd web && npm run dev` | `npm run build`.
- Crawler: `cd crawler && python main.py [--with-discover] [--date YYYY-MM-DD]`.
- Import CSV: `python import_h10_csv.py file.csv`.

## Discover (đã hoàn thiện — job-based)
- 3 mode: **keyword** (product_finder lọc `title`), **category** (`categories_include`), **best_sellers**. "Dòng sản phẩm" = preset keyword lưu ở bảng `product_lines` (thêm/xóa từ web).
- Luồng: web POST `/api/discover` → tạo `discover_jobs` (pending) → crawler `python main.py --only-discover` (hoặc `--with-discover`) chạy `run_pending_discover_jobs(captured_on)` → tìm ASIN, **lọc bắt buộc có ảnh**, insert `asins` (keepa_finder) + ghi snapshot hôm nay, lưu preview vào `discover_jobs.result_asins` → web (JobsList) poll `/api/discover/jobs` hiển thị kết quả (ảnh + link + giá + BSR + sales).
- `product_finder` selection mặc định: `productType=[0]` (loại variation-parent), `sort=[["current_SALES","asc"]]` (bán chạy trước). revenue_min lọc hậu kỳ (`price * sales_est`).
- Token: `product_finder` tốn ~10 token/call + mỗi ASIN chi tiết 1 token (×hệ số rating/buybox nếu bật).

## Style
- Code sạch, comment tiếng Việt ở chỗ logic quan trọng. Không để hàm rỗng trừ chỗ có TODO rõ. Ưu tiên chạy được thật.

---

<details>
<summary>Build prompt gốc (tham chiếu)</summary>

Xây dựng internal tool **asin-tracker** cho team R&D theo dõi/discover ASIN bán tốt trên Amazon US bằng Keepa API.
Kiến trúc: crawler (Python → Keepa → Supabase) + web (Next.js 14 dashboard + export Excel) + supabase (SQL).
Thứ tự làm: schema SQL → crawler → web → docs. Chi tiết đầy đủ xem lịch sử git / README.

</details>
