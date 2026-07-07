"""
main.py — Entrypoint crawler. Chạy 1 lần: chụp snapshot cho TOÀN BỘ ASIN đang track.

Luồng:
  1. Load config + logging.
  2. (Tùy chọn) chạy các discover job pending do web tạo → nạp ASIN mới.
  3. Lấy danh sách ASIN đang track từ Supabase.
  4. Query Keepa theo batch (wait=True tự chờ token), map → snapshot.
  5. UPSERT snapshot theo (asin_id, captured_on) — idempotent trong ngày.

Cách dùng:
    python main.py                 # chụp snapshot toàn bộ ASIN (giờ VN hôm nay)
    python main.py --with-discover # chạy thêm discover job pending trước khi snapshot
    python main.py --date 2026-07-01  # ghi đè ngày captured_on (test/backfill)

Đặt cron 7h sáng giờ VN mỗi ngày — xem README.
"""
from __future__ import annotations

import argparse
import logging
from datetime import date, datetime, timedelta, timezone

from config import KEEPA_BATCH_SIZE, load_settings
from db import Database
from discover import run_pending_discover_jobs
from keepa_client import KeepaClient
from logging_setup import setup_logging
from token_manager import TokenManager

logger = logging.getLogger(__name__)

# Giờ VN = UTC+7 → dùng để xác định "hôm nay" theo giờ Việt Nam.
VN_TZ = timezone(timedelta(hours=7))


def _today_vn() -> date:
    """Ngày hiện tại theo giờ VN (UTC+7)."""
    return datetime.now(VN_TZ).date()


def _chunk(items: list, size: int) -> list[list]:
    """Chia list thành các batch kích thước size."""
    return [items[i : i + size] for i in range(0, len(items), size)]


def run_snapshot(
    captured_on: date,
    with_discover: bool = False,
    only_discover: bool = False,
    limit: int | None = None,
) -> int:
    """Chạy toàn bộ pipeline snapshot cho 1 ngày. Trả về số snapshot đã ghi.

    with_discover: chạy discover job pending trước khi snapshot toàn bộ.
    only_discover: CHỈ chạy discover job rồi kết thúc (không crawl lại 500 ASIN — tiết kiệm token).
    limit: nếu đặt, chỉ crawl tối đa `limit` ASIN đầu (hữu ích để test tiết kiệm token).
    """
    settings = load_settings()
    db = Database(settings)
    keepa_client = KeepaClient(settings.keepa_api_key)
    token_mgr = TokenManager(keepa_client.api)

    # Xử lý discover job do web tạo (ASIN tìm được đã được ghi snapshot ngay trong discover).
    if with_discover or only_discover:
        logger.info("== Chạy discover job pending ==")
        run_pending_discover_jobs(keepa_client, db, captured_on)
        if only_discover:
            logger.info("== --only-discover: kết thúc, không snapshot toàn bộ ==")
            return 0

    # Bước 3: lấy ASIN đang track.
    tracked = db.get_tracked_asins()
    if not tracked:
        logger.warning("Không có ASIN nào đang track. Kết thúc.")
        return 0
    if limit is not None and limit > 0:
        tracked = tracked[:limit]
        logger.info("Giới hạn --limit: chỉ crawl %d ASIN đầu.", len(tracked))
    logger.info("== Chụp snapshot cho %d ASIN, ngày %s ==", len(tracked), captured_on.isoformat())
    token_mgr.log_status("bắt đầu")
    token_mgr.log_estimate(len(tracked))

    # map asin → id để ghi snapshot.
    id_by_asin = {row["asin"]: row["id"] for row in tracked}
    all_asins = list(id_by_asin.keys())

    total_written = 0
    batches = _chunk(all_asins, KEEPA_BATCH_SIZE)
    for bi, batch in enumerate(batches, start=1):
        logger.info("-- Batch %d/%d (%d ASIN) --", bi, len(batches), len(batch))
        try:
            products = keepa_client.query_batch(batch)
        except Exception as exc:  # noqa: BLE001 — 1 batch lỗi không nên chết cả run
            logger.exception("Batch %d lỗi, bỏ qua: %s", bi, exc)
            continue

        snapshots = []
        for product in products:
            asin = product.get("asin")
            asin_id = id_by_asin.get(asin)
            if not asin_id:
                logger.warning("ASIN %s không có trong map (bỏ qua).", asin)
                continue
            snapshots.append(
                keepa_client.map_product_to_snapshot(product, asin_id, captured_on)
            )

        total_written += db.upsert_snapshots(snapshots)
        token_mgr.log_status(f"sau batch {bi}")

    logger.info("== HOÀN TẤT: ghi %d snapshot cho ngày %s ==", total_written, captured_on.isoformat())
    return total_written


def _parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Crawler snapshot ASIN từ Keepa.")
    parser.add_argument(
        "--with-discover",
        action="store_true",
        help="Chạy các discover job pending trước khi snapshot toàn bộ.",
    )
    parser.add_argument(
        "--only-discover",
        action="store_true",
        help="CHỈ chạy discover job pending rồi kết thúc (không snapshot lại toàn bộ ASIN).",
    )
    parser.add_argument(
        "--date",
        type=str,
        default=None,
        help="Ghi đè ngày captured_on (YYYY-MM-DD). Mặc định: hôm nay giờ VN.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Chỉ crawl tối đa N ASIN đầu (test tiết kiệm token).",
    )
    return parser.parse_args()


def main() -> None:
    setup_logging()
    args = _parse_args()

    captured_on = _today_vn()
    if args.date:
        try:
            captured_on = datetime.strptime(args.date, "%Y-%m-%d").date()
        except ValueError:
            logger.error("Định dạng --date sai, dùng YYYY-MM-DD. Nhận: %s", args.date)
            raise SystemExit(2)

    run_snapshot(
        captured_on,
        with_discover=args.with_discover,
        only_discover=args.only_discover,
        limit=args.limit,
    )


if __name__ == "__main__":
    main()
