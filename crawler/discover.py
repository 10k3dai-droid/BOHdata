"""
discover.py — Discover ASIN top từ Keepa theo Keyword / Category / Dòng sản phẩm.

Luồng job-based:
  - Web ghi 1 row vào discover_jobs (status=pending) với mode + tiêu chí.
  - Crawler chạy run_pending_discover_jobs(): dùng product_finder / best_sellers → ra danh sách ASIN,
    lấy chi tiết (title/ảnh/giá/BSR/sales), LỌC bắt buộc có ảnh + link, insert vào asins (keepa_finder),
    ghi snapshot hôm nay, và lưu preview kết quả vào job.result_asins để web hiển thị ngay.

Ba mode:
  - keyword       : product_finder lọc theo title chứa keyword (cũng dùng cho "dòng sản phẩm").
  - category      : product_finder theo categories_include (category node).
  - best_sellers  : best_sellers_query của category node.
"""
from __future__ import annotations

import logging
from datetime import date
from typing import Any, Optional

from config import KEEPA_DOMAIN, MAX_TRACKED_ASINS
from db import Database
from keepa_client import KeepaClient, _extract_image_url

logger = logging.getLogger(__name__)

# Số ASIN tối đa lấy về mỗi lần discover (giữ nhỏ để tiết kiệm token).
DEFAULT_DISCOVER_LIMIT = 30


def _build_finder_selection(filters: dict[str, Any]) -> dict[str, Any]:
    """
    Chuyển filter đơn giản của tool → selection cho Keepa product_finder.
    filters (đều optional): bsr_max, price_min, price_max, rating_min, monthly_sold_min.
    (revenue_min lọc hậu kỳ sau khi có price*sales_est.)
    """
    selection: dict[str, Any] = {
        # Chỉ sản phẩm chuẩn (loại variation-parent/invalid không có data giá).
        "productType": [0],
        # Sắp theo sales rank tăng dần → sản phẩm bán chạy nhất lên đầu.
        "sort": [["current_SALES", "asc"]],
    }

    if filters.get("bsr_max") is not None:
        selection["current_SALES_lte"] = int(filters["bsr_max"])
    if filters.get("price_min") is not None:
        selection["current_NEW_gte"] = int(round(float(filters["price_min"]) * 100))
    if filters.get("price_max") is not None:
        selection["current_NEW_lte"] = int(round(float(filters["price_max"]) * 100))
    if filters.get("rating_min") is not None:
        selection["current_RATING_gte"] = int(round(float(filters["rating_min"]) * 10))
    if filters.get("monthly_sold_min") is not None:
        selection["monthlySold_gte"] = int(filters["monthly_sold_min"])

    return selection


def discover_by_keyword(
    keepa_client: KeepaClient,
    db: Database,
    keyword: str,
    filters: dict[str, Any],
    captured_on: date,
    limit: int = DEFAULT_DISCOVER_LIMIT,
) -> list[dict[str, Any]]:
    """Tìm ASIN top theo keyword (khớp title). Trả về list preview (đã có ảnh + link)."""
    selection = _build_finder_selection(filters)
    selection["title"] = keyword
    selection["perPage"] = limit  # QUAN TRỌNG: perPage ghi đè n_products → phải set để giới hạn thật
    logger.info("Discover keyword='%s' selection=%s", keyword, selection)
    asins = keepa_client.api.product_finder(
        selection, domain=KEEPA_DOMAIN, wait=True, n_products=limit
    )
    logger.info("product_finder (keyword) trả %d ASIN.", len(asins or []))
    return _fetch_process_insert(keepa_client, db, asins or [], "keepa_finder", captured_on, filters)


def discover_by_category(
    keepa_client: KeepaClient,
    db: Database,
    category_node: str,
    filters: dict[str, Any],
    captured_on: date,
    limit: int = DEFAULT_DISCOVER_LIMIT,
) -> list[dict[str, Any]]:
    """Tìm ASIN top theo category node + filter. Trả về list preview."""
    selection = _build_finder_selection(filters)
    selection["perPage"] = limit  # giới hạn số kết quả thật (perPage ghi đè n_products)
    try:
        selection["categories_include"] = [int(category_node)]
    except (TypeError, ValueError):
        logger.warning("category_node '%s' không phải số — bỏ qua lọc category.", category_node)
    logger.info("Discover category=%s selection=%s", category_node, selection)
    asins = keepa_client.api.product_finder(
        selection, domain=KEEPA_DOMAIN, wait=True, n_products=limit
    )
    logger.info("product_finder (category) trả %d ASIN.", len(asins or []))
    return _fetch_process_insert(keepa_client, db, asins or [], "keepa_finder", captured_on, filters)


def discover_best_sellers(
    keepa_client: KeepaClient,
    db: Database,
    category_node: str,
    captured_on: date,
    limit: int = DEFAULT_DISCOVER_LIMIT,
) -> list[dict[str, Any]]:
    """Lấy best sellers của category node. Trả về list preview."""
    logger.info("best_sellers category_node=%s", category_node)
    best = keepa_client.api.best_sellers_query(category_node, domain=KEEPA_DOMAIN, wait=True)
    best = (best or [])[:limit]
    logger.info("best_sellers trả %d ASIN.", len(best))
    return _fetch_process_insert(keepa_client, db, best, "keepa_finder", captured_on, {})


def _fetch_process_insert(
    keepa_client: KeepaClient,
    db: Database,
    asins: list[str],
    source: str,
    captured_on: date,
    filters: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Lấy chi tiết ASIN → LỌC bắt buộc có ảnh → insert asins + ghi snapshot → trả preview.
    Áp dụng revenue_min (lọc hậu kỳ) nếu có.
    """
    if not asins:
        return []

    # Không vượt quá giới hạn theo dõi.
    existing_count = len(db.get_tracked_asins())
    room = MAX_TRACKED_ASINS - existing_count
    if room <= 0:
        logger.warning("Đã đạt giới hạn %d ASIN — không thêm mới.", MAX_TRACKED_ASINS)
        return []
    asins = asins[:room]

    products = keepa_client.query_batch(asins)
    revenue_min = filters.get("revenue_min")

    asin_rows: list[dict[str, Any]] = []
    previews: list[dict[str, Any]] = []
    # Lưu tạm snapshot theo asin để ghi sau khi có asin_id.
    snapshot_by_asin: dict[str, dict[str, Any]] = {}

    for p in products:
        asin = p.get("asin")
        if not asin:
            continue
        image_url = _extract_image_url(p)
        if not image_url:
            # YÊU CẦU: kết quả bắt buộc có ảnh → bỏ ASIN không có ảnh.
            logger.info("Bỏ ASIN %s (không có ảnh).", asin)
            continue

        row = keepa_client.map_product_to_asin_row(p, source=source)
        row["image_url"] = image_url  # đảm bảo có ảnh
        snap = keepa_client.map_product_to_snapshot(p, asin_id="", captured_on=captured_on)

        # Lọc revenue tối thiểu (hậu kỳ) nếu người dùng đặt.
        if revenue_min is not None:
            rev = snap.get("revenue_est")
            if rev is None or rev < float(revenue_min):
                continue

        asin_rows.append(row)
        snapshot_by_asin[asin] = snap
        previews.append({
            "asin": asin,
            "title": row.get("title"),
            "image_url": image_url,
            "product_url": row.get("product_url") or f"https://www.amazon.com/dp/{asin}",
            "price": snap.get("price"),
            "bsr": snap.get("bsr"),
            "sales_est": snap.get("sales_est"),
            "rating": snap.get("rating"),
        })

    if not asin_rows:
        logger.info("Không có ASIN nào đạt tiêu chí (hoặc thiếu ảnh).")
        return []

    # Insert asins, lấy id, rồi ghi snapshot tương ứng.
    inserted = db.upsert_asins(asin_rows)
    id_by_asin = {r["asin"]: r["id"] for r in inserted}

    snapshots = []
    for asin, snap in snapshot_by_asin.items():
        asin_id = id_by_asin.get(asin)
        if asin_id:
            snap = {**snap, "asin_id": asin_id}
            snapshots.append(snap)
    db.upsert_snapshots(snapshots)

    logger.info("Discover: thêm %d ASIN (đủ ảnh) + ghi snapshot.", len(asin_rows))
    return previews


def run_pending_discover_jobs(
    keepa_client: KeepaClient, db: Database, captured_on: date
) -> int:
    """
    Đọc discover_jobs status=pending (web tạo), chạy từng job theo mode, cập nhật kết quả + preview.
    Trả về số job đã xử lý.
    """
    jobs = db.get_pending_discover_jobs()
    if not jobs:
        logger.info("Không có discover job pending.")
        return 0

    for job in jobs:
        job_id = job["id"]
        db.update_discover_job(job_id, status="running")
        try:
            filters = job.get("filters") or {}
            mode = job.get("mode")
            if mode == "keyword":
                keyword = (job.get("keyword") or "").strip()
                if not keyword:
                    raise ValueError("Job keyword rỗng.")
                previews = discover_by_keyword(keepa_client, db, keyword, filters, captured_on)
            elif mode == "best_sellers":
                previews = discover_best_sellers(keepa_client, db, job.get("category_node"), captured_on)
            else:  # category
                previews = discover_by_category(
                    keepa_client, db, job.get("category_node"), filters, captured_on
                )

            db.update_discover_job(
                job_id,
                status="done",
                result_count=len(previews),
                result_asins=previews,
            )
            logger.info("Job %s xong: %d ASIN.", job_id, len(previews))
        except Exception as exc:  # noqa: BLE001 — log & đánh dấu lỗi, không chết cả loop
            logger.exception("Job discover %s lỗi: %s", job_id, exc)
            db.update_discover_job(job_id, status="error", error_message=str(exc)[:500])

    return len(jobs)
