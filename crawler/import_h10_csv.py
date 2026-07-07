"""
import_h10_csv.py — Nạp ASIN từ file CSV export của Helium 10 (Black Box / Cerebro / Xray).

Helium 10 Diamond không có API → luồng nạp ASIN phụ này để người dùng import thủ công.
Chỉ lấy cột ASIN, insert vào bảng asins với source='h10_csv'. Lần crawler chạy sau sẽ
tự chụp snapshot cho các ASIN này (không lấy chi tiết ở bước import để tiết kiệm token).

Dùng:
    python import_h10_csv.py path/to/blackbox_export.csv
"""
from __future__ import annotations

import csv
import logging
import re
import sys
from typing import Iterable

from config import load_settings
from db import Database
from logging_setup import setup_logging

logger = logging.getLogger(__name__)

# ASIN Amazon: 10 ký tự chữ HOA + số, thường bắt đầu bằng B0.
_ASIN_RE = re.compile(r"^[A-Z0-9]{10}$")

# Tên cột ASIN có thể gặp trong export H10 (không phân biệt hoa thường).
_ASIN_HEADER_CANDIDATES = {"asin", "asins", "product asin"}


def _find_asin_column(headers: list[str]) -> int | None:
    """Tìm index cột ASIN theo tên header."""
    for i, h in enumerate(headers):
        if h and h.strip().lower() in _ASIN_HEADER_CANDIDATES:
            return i
    return None


def extract_asins_from_csv(path: str) -> list[str]:
    """
    Đọc file CSV, trả về danh sách ASIN hợp lệ, loại trùng, giữ thứ tự.
    Tự dò cột 'ASIN'; nếu không thấy header → quét mọi ô, nhặt giá trị khớp regex ASIN.
    """
    asins: list[str] = []
    seen: set[str] = set()

    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        rows = list(reader)

    if not rows:
        logger.warning("File CSV rỗng: %s", path)
        return []

    headers = rows[0]
    asin_col = _find_asin_column(headers)

    if asin_col is not None:
        logger.info("Tìm thấy cột ASIN ở vị trí %d ('%s').", asin_col, headers[asin_col])
        data_rows: Iterable[list[str]] = rows[1:]
        for row in data_rows:
            if asin_col < len(row):
                _maybe_add(row[asin_col], asins, seen)
    else:
        # Không có header ASIN rõ ràng → quét toàn bộ ô.
        logger.info("Không thấy header ASIN; quét toàn bộ ô để nhặt ASIN hợp lệ.")
        for row in rows:
            for cell in row:
                _maybe_add(cell, asins, seen)

    logger.info("Trích được %d ASIN duy nhất từ %s.", len(asins), path)
    return asins


def _maybe_add(cell: str, asins: list[str], seen: set[str]) -> None:
    """Thêm ASIN nếu ô khớp định dạng và chưa có."""
    value = (cell or "").strip().upper()
    if _ASIN_RE.match(value) and value not in seen:
        seen.add(value)
        asins.append(value)


def import_csv(path: str) -> list[str]:
    """
    Nạp ASIN từ CSV vào bảng asins (source='h10_csv'). Trả về danh sách ASIN đã insert.
    """
    settings = load_settings()
    db = Database(settings)

    asins = extract_asins_from_csv(path)
    if not asins:
        logger.warning("Không có ASIN nào để import.")
        return []

    rows = [{"asin": a, "source": "h10_csv"} for a in asins]
    inserted = db.upsert_asins(rows)
    logger.info("Đã import %d ASIN từ CSV (source=h10_csv).", len(inserted))
    return [r["asin"] for r in inserted]


def main() -> None:
    setup_logging()
    if len(sys.argv) < 2:
        print("Cách dùng: python import_h10_csv.py <đường_dẫn_file.csv>", file=sys.stderr)
        raise SystemExit(2)
    import_csv(sys.argv[1])


if __name__ == "__main__":
    main()
