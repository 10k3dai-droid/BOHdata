# asin-tracker

Internal tool cho team R&D theo dõi & discover ASIN bán tốt trên **Amazon US**, dùng **Keepa API** làm nguồn dữ liệu chính.

- **crawler/** — Python: thu thập snapshot từ Keepa, ghi vào Supabase.
- **web/** — Next.js 14 (App Router, TypeScript, Tailwind): dashboard + export Excel.
- **supabase/** — SQL migration + seed.

> Ràng buộc: tối đa 500 ASIN. Keepa 20 token/phút (1 token = 1 product). **Không** scrape amazon.com, **không** tự động thao tác UI Helium 10. Helium 10 → import CSV thủ công.

---

## 0. Yêu cầu môi trường

| Thành phần | Phiên bản |
|-----------|-----------|
| Node.js | ≥ 18 (khuyến nghị 20+) |
| Python | ≥ 3.10 |
| Tài khoản | Supabase (free/pro) + Keepa API key |

---

## 1. Supabase: tạo project & chạy migration

1. Tạo project tại https://supabase.com → lấy **Project URL**, **service_role key**, **anon key** ở *Project Settings → API*.
2. Mở **SQL Editor** trong Supabase, chạy lần lượt:
   - `supabase/migrations/0001_init.sql` (tạo bảng, index, RLS).
   - `supabase/seed.sql` (dữ liệu mẫu để test — có thể bỏ qua khi chạy thật).

Hoặc dùng Supabase CLI:
```bash
supabase link --project-ref <ref>
supabase db push        # áp dụng migration trong supabase/migrations
```

---

## 2. Cấu hình `.env`

Copy mẫu và điền giá trị thật:
```bash
cp .env.example .env
```
Điền: `KEEPA_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, và (tùy chọn) `NEXT_PUBLIC_SUPABASE_*`.

> Web đọc/ghi data qua **server** bằng `SUPABASE_SERVICE_KEY` (internal tool). Key này không có prefix `NEXT_PUBLIC_` nên **không** bị bundle ra client.

---

## 3. Crawler (Python)

```bash
cd crawler
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
```

### Chạy snapshot toàn bộ ASIN đang track
```bash
python main.py                 # snapshot cho hôm nay (giờ VN)
python main.py --with-discover # chạy discover job pending (do web tạo) trước rồi snapshot
python main.py --date 2026-07-01  # ghi đè ngày (backfill/test)
python main.py --limit 10      # chỉ crawl 10 ASIN đầu (test tiết kiệm token)
```

### Chế độ token & tốc độ (QUAN TRỌNG)
- Mỗi sản phẩm tốn **1 token** ở chế độ mặc định hiện tại (`KEEPA_WITH_RATING=False`, `KEEPA_WITH_BUYBOX=False` trong `config.py`) → lấy giá, BSR, sales_est, revenue_est.
- Bật lại 2 flag đó (`True`) để lấy thêm **review/rating + buy box + fulfillment**, nhưng tốn **~3-4 token/sản phẩm**.
- Refill token phụ thuộc gói Keepa: free ~**1 token/phút**, gói €49 = **20 token/phút**. Với 500 ASIN nên dùng gói €49 (~100 phút); free tier chỉ hợp test số lượng nhỏ (dùng `--limit`).

### Import ASIN từ CSV Helium 10 (CLI)
```bash
python import_h10_csv.py path/to/blackbox_export.csv
```
(Import qua web cũng được — xem trang Discover.)

Log ghi ra `crawler/logs/crawler.log` + stdout. Idempotent: chạy lại trong ngày UPSERT theo `(asin_id, captured_on)`, không tạo dòng trùng.

---

## 4. Web dashboard (Next.js 14)

```bash
cd web
npm install
npm run dev        # http://localhost:3000
```
Web cần các biến env (đặt trong `web/.env.local` hoặc lấy từ `.env` root khi deploy):
```
SUPABASE_URL=...
SUPABASE_SERVICE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...        # tùy chọn
NEXT_PUBLIC_SUPABASE_ANON_KEY=...   # tùy chọn
```

Trang:
- `/` — Dashboard: bảng ASIN + snapshot theo **ngày đang chọn** (date picker), sort/filter/search, KPI tổng, **Export Excel**.
- `/asin/[asin]` — Chi tiết: ảnh lớn, link Amazon, biểu đồ xu hướng BSR/giá/sales/review (Chart.js).
- `/watchlists` — Tạo/xem nhóm ASIN theo niche/người phụ trách.
- `/discover` — Thêm ASIN: (a) lưu tiêu chí discover theo category → crawler xử lý; (b) import CSV Helium 10.

Build production:
```bash
npm run build && npm start
```

---

## 5. Đặt cron chạy 7h sáng giờ VN mỗi ngày

Snapshot nên chạy 1 lần/ngày. 7h sáng VN (UTC+7) = **00:00 UTC**.

### Windows Task Scheduler
Tạo task chạy file `.bat`:
```bat
@echo off
cd /d C:\path\to\asin-tracker\crawler
call .venv\Scripts\activate
python main.py --with-discover >> logs\cron.log 2>&1
```
Task Scheduler → Create Task → Trigger *Daily 07:00* (giờ máy VN) → Action: chạy file `.bat` trên.

### Linux crontab (server để giờ UTC)
```cron
# 00:00 UTC = 07:00 giờ VN
0 0 * * * cd /path/to/asin-tracker/crawler && ./.venv/bin/python main.py --with-discover >> logs/cron.log 2>&1
```
(Nếu server để sẵn giờ VN thì dùng `0 7 * * *`.)

---

## 6. Deploy web lên Vercel

1. Push repo lên GitHub.
2. Vercel → New Project → chọn thư mục **`web`** làm Root Directory.
3. Thêm Environment Variables: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
4. Deploy. (Các trang data để `force-dynamic` nên build không cần DB.)

> Crawler **không** deploy lên Vercel (là script batch/cron). Chạy trên máy bạn hoặc 1 VPS/Task Scheduler.

---

## 7. Ước tính thời gian crawl

20 token/phút, 1 token/product. Ví dụ 500 ASIN ≈ 25 phút nếu bắt đầu với 0 token dư. `token_manager` log token còn lại + ước tính mỗi lần chạy; library `keepa` với `wait=True` tự chờ khi thiếu token.

---

## 8. Cấu trúc thư mục

```
asin-tracker/
├── crawler/          # Python — Keepa → Supabase
│   ├── main.py                 # entrypoint snapshot
│   ├── keepa_client.py         # wrapper Keepa + map → schema snapshot
│   ├── discover.py             # product_finder / best_sellers / job runner
│   ├── import_h10_csv.py       # import ASIN từ CSV H10
│   ├── token_manager.py        # log/ước tính token
│   ├── db.py                   # Supabase client + upsert helpers
│   ├── config.py               # load & validate env
│   ├── logging_setup.py        # log ra file + stdout
│   └── requirements.txt
├── web/              # Next.js 14 App Router
│   ├── app/          # pages + API routes
│   ├── components/   # UI components
│   ├── lib/          # queries, types, format, export, parseCsv, supabase server
│   └── ...
├── supabase/
│   ├── migrations/0001_init.sql
│   └── seed.sql
├── .env.example
├── README.md
└── CLAUDE.md         # rules cho các phiên Claude Code sau
```
