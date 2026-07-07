-- =============================================================================
-- asin-tracker — Migration khởi tạo schema
-- Marketplace: Amazon US. Tối đa 500 ASIN theo dõi. Nguồn data chính: Keepa API.
-- Chạy file này trong Supabase SQL Editor (hoặc supabase db push).
-- =============================================================================

-- Extension để sinh uuid (Supabase thường đã bật sẵn, để idempotent thì cứ ensure).
create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- Bảng asins: danh mục sản phẩm đang/được theo dõi.
-- source cho biết ASIN được nạp từ đâu: Keepa product_finder, CSV Helium 10, hay thêm tay.
-- -----------------------------------------------------------------------------
create table if not exists public.asins (
  id          uuid primary key default gen_random_uuid(),
  asin        text not null unique,                 -- mã ASIN, duy nhất
  title       text,
  image_url   text,
  product_url text,
  category    text,
  brand       text,
  source      text not null default 'manual'
              check (source in ('keepa_finder', 'h10_csv', 'manual')),
  created_at  timestamptz not null default now()
);

comment on table public.asins is 'Danh mục ASIN theo dõi (tối đa ~500).';
comment on column public.asins.source is 'Nguồn nạp ASIN: keepa_finder | h10_csv | manual';

-- -----------------------------------------------------------------------------
-- Bảng snapshots: dữ liệu metric của 1 ASIN tại 1 NGÀY cụ thể.
-- Mỗi lần crawler chạy trong ngày sẽ UPSERT theo (asin_id, captured_on) → không trùng ngày.
-- Cột raw giữ nguyên response Keepa để về sau parse lại field mới mà không phải crawl lại.
-- -----------------------------------------------------------------------------
create table if not exists public.snapshots (
  id             uuid primary key default gen_random_uuid(),
  asin_id        uuid not null references public.asins(id) on delete cascade,
  captured_on    date not null,                     -- ngày chụp snapshot (giờ VN)
  bsr            integer,                            -- Best Sellers Rank (category chính)
  price          numeric,                            -- giá hiện tại
  sales_est      integer,                            -- ước tính units bán / tháng (Keepa monthlySold)
  revenue_est    numeric,                            -- ước tính doanh thu / tháng = price * sales_est
  review_count   integer,
  rating         numeric,                            -- 0..5
  seller_count   integer,
  fulfillment    text,                               -- FBA | FBM | AMZ
  buy_box_price  numeric,
  raw            jsonb,                              -- response gốc từ Keepa
  created_at     timestamptz not null default now(),

  -- Chống ghi trùng: 1 ASIN chỉ có tối đa 1 snapshot mỗi ngày.
  constraint uq_snapshot_asin_day unique (asin_id, captured_on)
);

comment on table public.snapshots is 'Metric của từng ASIN theo ngày; UNIQUE (asin_id, captured_on) chống trùng.';

-- Index phục vụ truy vấn dashboard (lọc/sort theo ngày, join asin).
create index if not exists idx_snapshots_captured_on on public.snapshots (captured_on desc);
create index if not exists idx_snapshots_asin_id     on public.snapshots (asin_id);
-- Index tổng hợp cho query "snapshot mới nhất của mỗi asin".
create index if not exists idx_snapshots_asin_day    on public.snapshots (asin_id, captured_on desc);

-- -----------------------------------------------------------------------------
-- Bảng watchlists: nhóm ASIN theo niche hoặc người phụ trách.
-- -----------------------------------------------------------------------------
create table if not exists public.watchlists (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  owner      text,                                   -- người phụ trách: Cường / Tú / Ánh...
  keyword    text,                                   -- niche liên quan
  created_at timestamptz not null default now()
);

comment on table public.watchlists is 'Nhóm ASIN theo niche / người phụ trách.';

-- -----------------------------------------------------------------------------
-- Bảng watchlist_asins: quan hệ nhiều-nhiều giữa watchlist và asin (pk kép).
-- -----------------------------------------------------------------------------
create table if not exists public.watchlist_asins (
  watchlist_id uuid not null references public.watchlists(id) on delete cascade,
  asin_id      uuid not null references public.asins(id) on delete cascade,
  primary key (watchlist_id, asin_id)
);

comment on table public.watchlist_asins is 'Bảng nối watchlist ↔ asin.';

-- -----------------------------------------------------------------------------
-- (Tùy chọn nhưng hữu ích) Bảng discover_jobs: lưu tiêu chí discover từ web.
-- Web ghi 1 job (status=pending), crawler đọc job pending để chạy discover.
-- Ở bản đầu web chỉ cần INSERT tiêu chí; phần crawler đọc job là TODO nối sau.
-- -----------------------------------------------------------------------------
create table if not exists public.discover_jobs (
  id            uuid primary key default gen_random_uuid(),
  mode          text not null default 'category'
                check (mode in ('category', 'best_sellers')),
  category_node text,
  filters       jsonb,                               -- { bsr_max, price_min, price_max, revenue_min, rating_min }
  status        text not null default 'pending'
                check (status in ('pending', 'running', 'done', 'error')),
  result_count  integer,
  error_message text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.discover_jobs is 'Hàng đợi tiêu chí discover; web ghi pending, crawler xử lý (TODO nối crawler).';

-- =============================================================================
-- Row Level Security — internal tool, policy đơn giản.
--   * service_role (crawler dùng SUPABASE_SERVICE_KEY): full quyền, BYPASS RLS mặc định.
--   * authenticated (web đăng nhập): được READ toàn bộ, và ghi ở vài bảng do người dùng thao tác
--     (watchlists, watchlist_asins, discover_jobs, thêm asin thủ công).
-- Lưu ý: service_role tự bypass RLS nên không cần policy riêng cho crawler.
-- =============================================================================

alter table public.asins           enable row level security;
alter table public.snapshots       enable row level security;
alter table public.watchlists      enable row level security;
alter table public.watchlist_asins enable row level security;
alter table public.discover_jobs   enable row level security;

-- READ cho authenticated ở tất cả bảng.
create policy "auth read asins"           on public.asins           for select to authenticated using (true);
create policy "auth read snapshots"       on public.snapshots       for select to authenticated using (true);
create policy "auth read watchlists"      on public.watchlists      for select to authenticated using (true);
create policy "auth read watchlist_asins" on public.watchlist_asins for select to authenticated using (true);
create policy "auth read discover_jobs"   on public.discover_jobs   for select to authenticated using (true);

-- WRITE cho authenticated ở các bảng do người dùng thao tác trực tiếp trên web.
-- (asins: cho phép thêm ASIN thủ công / qua import CSV từ web.)
create policy "auth write asins"           on public.asins           for all to authenticated using (true) with check (true);
create policy "auth write watchlists"      on public.watchlists      for all to authenticated using (true) with check (true);
create policy "auth write watchlist_asins" on public.watchlist_asins for all to authenticated using (true) with check (true);
create policy "auth write discover_jobs"   on public.discover_jobs   for all to authenticated using (true) with check (true);

-- snapshots: web chỉ đọc, việc ghi do crawler (service_role) đảm nhiệm → không tạo write policy cho authenticated.
