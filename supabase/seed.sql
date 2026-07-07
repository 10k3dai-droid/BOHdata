-- =============================================================================
-- seed.sql — Dữ liệu mẫu để test web/crawler khi chưa có data thật.
-- Chạy SAU khi đã apply 0001_init.sql.
-- Idempotent: dùng ON CONFLICT để chạy lại nhiều lần không lỗi.
-- =============================================================================

-- --- ASIN mẫu (source=manual) --------------------------------------------------
insert into public.asins (asin, title, image_url, product_url, category, brand, source) values
  ('B08N5WRWNW', 'Echo Dot (4th Gen) Smart speaker with Alexa',
   'https://images-na.ssl-images-amazon.com/images/I/61Mb2AQVdvL.jpg',
   'https://www.amazon.com/dp/B08N5WRWNW', 'Electronics', 'Amazon', 'manual'),
  ('B07FZ8S74R', 'Echo Dot (3rd Gen) Smart speaker',
   'https://images-na.ssl-images-amazon.com/images/I/61u48FEs2GL.jpg',
   'https://www.amazon.com/dp/B07FZ8S74R', 'Electronics', 'Amazon', 'manual'),
  ('B09B8V1LZ3', 'Stainless Steel Insulated Water Bottle 32oz',
   'https://images-na.ssl-images-amazon.com/images/I/71J5C6tGvNL.jpg',
   'https://www.amazon.com/dp/B09B8V1LZ3', 'Home & Kitchen', 'GenericBrand', 'h10_csv')
on conflict (asin) do nothing;

-- --- Snapshot mẫu cho 3 ngày gần đây ------------------------------------------
-- Dùng subquery lấy asin_id theo asin; ON CONFLICT (asin_id, captured_on) để idempotent.
with a as (
  select id, asin from public.asins
  where asin in ('B08N5WRWNW', 'B07FZ8S74R', 'B09B8V1LZ3')
)
insert into public.snapshots
  (asin_id, captured_on, bsr, price, sales_est, revenue_est, review_count, rating, seller_count, fulfillment, buy_box_price)
select a.id, s.captured_on, s.bsr, s.price, s.sales_est,
       (s.price * s.sales_est) as revenue_est,
       s.review_count, s.rating, s.seller_count, s.fulfillment, s.price
from a
join (values
  -- asin,           ngày,                     bsr,   price, sales, reviews, rating, sellers, fulfil
  ('B08N5WRWNW', current_date - 2, 120,   49.99, 8500,  120000, 4.7, 3, 'AMZ'),
  ('B08N5WRWNW', current_date - 1, 110,   39.99, 9200,  121500, 4.7, 3, 'AMZ'),
  ('B08N5WRWNW', current_date - 0, 95,    39.99, 9800,  122000, 4.7, 3, 'AMZ'),
  ('B07FZ8S74R', current_date - 2, 540,   29.99, 4300,  60000,  4.6, 5, 'AMZ'),
  ('B07FZ8S74R', current_date - 1, 505,   24.99, 4600,  60300,  4.6, 5, 'AMZ'),
  ('B07FZ8S74R', current_date - 0, 480,   24.99, 4750,  60500,  4.6, 5, 'AMZ'),
  ('B09B8V1LZ3', current_date - 2, 2100,  21.95, 1800,  3400,   4.4, 12, 'FBA'),
  ('B09B8V1LZ3', current_date - 1, 1980,  19.95, 1950,  3550,   4.4, 12, 'FBA'),
  ('B09B8V1LZ3', current_date - 0, 1875,  19.95, 2050,  3600,   4.5, 11, 'FBA')
) as s(asin, captured_on, bsr, price, sales_est, review_count, rating, seller_count, fulfillment)
  on a.asin = s.asin
on conflict (asin_id, captured_on) do update
  set bsr = excluded.bsr,
      price = excluded.price,
      sales_est = excluded.sales_est,
      revenue_est = excluded.revenue_est,
      review_count = excluded.review_count,
      rating = excluded.rating,
      seller_count = excluded.seller_count,
      fulfillment = excluded.fulfillment,
      buy_box_price = excluded.buy_box_price;

-- --- Watchlist mẫu ------------------------------------------------------------
insert into public.watchlists (name, owner, keyword) values
  ('Smart Home Q3', 'Cường', 'smart speaker alexa'),
  ('Kitchen Niche', 'Tú', 'insulated water bottle')
on conflict do nothing;

-- Gán ASIN vào watchlist mẫu.
insert into public.watchlist_asins (watchlist_id, asin_id)
select w.id, a.id
from public.watchlists w
join public.asins a on (
  (w.name = 'Smart Home Q3' and a.asin in ('B08N5WRWNW', 'B07FZ8S74R')) or
  (w.name = 'Kitchen Niche' and a.asin in ('B09B8V1LZ3'))
)
on conflict do nothing;
