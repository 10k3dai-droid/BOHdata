-- =============================================================================
-- Migration 0002 — Nâng cấp Discover: tìm theo Keyword / Category / Dòng sản phẩm.
-- Chạy SAU 0001_init.sql. Idempotent.
-- =============================================================================

-- --- discover_jobs: thêm keyword + lưu kết quả preview ------------------------
alter table public.discover_jobs
  add column if not exists keyword      text,
  add column if not exists result_asins jsonb;   -- preview ASIN tìm được: [{asin,title,image_url,product_url,price,bsr,sales_est,rating}]

comment on column public.discover_jobs.keyword is 'Từ khóa tìm (mode=keyword hoặc dòng sản phẩm).';
comment on column public.discover_jobs.result_asins is 'Kết quả preview để web hiển thị ngay (crawler ghi sau khi chạy).';

-- Mở rộng mode để có 'keyword'.
alter table public.discover_jobs drop constraint if exists discover_jobs_mode_check;
alter table public.discover_jobs
  add constraint discover_jobs_mode_check
  check (mode in ('category', 'best_sellers', 'keyword'));

-- --- product_lines: preset "dòng sản phẩm" (Sticker/Ornament/Jar/Tumbler...) --
-- Người dùng thêm/xóa preset từ web; mỗi preset = 1 keyword search.
create table if not exists public.product_lines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,   -- nhãn hiển thị (vd "Sticker")
  keyword    text not null,          -- từ khóa search trong title (vd "sticker")
  created_at timestamptz not null default now()
);

comment on table public.product_lines is 'Preset dòng sản phẩm cho Discover; mỗi dòng = 1 keyword.';

alter table public.product_lines enable row level security;
create policy "auth read product_lines"  on public.product_lines for select to authenticated using (true);
create policy "auth write product_lines" on public.product_lines for all    to authenticated using (true) with check (true);

-- Seed các dòng khởi đầu (xóa/bổ sung được từ web).
insert into public.product_lines (name, keyword) values
  ('Sticker', 'sticker'),
  ('Ornament', 'ornament'),
  ('Jar', 'jar'),
  ('Tumbler', 'tumbler'),
  ('Mug', 'mug'),
  ('T-Shirt', 't-shirt'),
  ('Blanket', 'blanket'),
  ('Keychain', 'keychain')
on conflict (name) do nothing;
