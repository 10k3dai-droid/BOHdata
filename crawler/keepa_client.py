"""
keepa_client.py — Wrapper quanh library `keepa`.

Nhiệm vụ:
  1. Khởi tạo kết nối Keepa (marketplace US).
  2. Query 1 batch ASIN với wait=True (library tự chờ khi thiếu token).
  3. Map response Keepa → dict snapshot đúng schema bảng `snapshots`.

Ghi chú parse Keepa (đã kiểm chứng với data thật, xem README/CLAUDE.md):
  - Giá trị metric hiện tại đọc từ `stats.current` (mảng theo chỉ số CSV type của Keepa).
    Giá & buy box ở đơn vị **CENT** → chia 100. Giá trị < 0 (-1 = no data, -2 = không request) → None.
  - BSR: stats.current[SALES] (index 3); fallback salesRanks.
  - Rating: stats.current[16] thang 0..50 → chia 10 (cần bật rating khi query).
  - Reviews: stats.current[17] (cần bật rating).
  - Buy box: stats.buyBoxPrice + buyBoxIsAmazon/buyBoxIsFBA (cần bật buybox).
  - Ảnh: field `images` (list dict, lấy `l`=large); fallback `imagesCSV`.
  - sales_est: field `monthlySold` (units/tháng) ở top-level.
  - ASIN variation-parent / invalid (productType 4) không có data → các field sẽ là None (ghi log).
"""
from __future__ import annotations

import json
import logging
from datetime import date
from typing import Any, Optional

import keepa

from config import (
    KEEPA_DOMAIN,
    KEEPA_STATS_DAYS,
    KEEPA_WITH_BUYBOX,
    KEEPA_WITH_RATING,
)

logger = logging.getLogger(__name__)

# --- Chỉ số cột trong mảng Keepa "stats.current" (theo tài liệu Keepa CSV type) ---
IDX_AMAZON = 0        # giá do Amazon bán
IDX_NEW = 1           # giá NEW thấp nhất
IDX_SALES = 3         # sales rank (BSR)
IDX_COUNT_NEW = 11    # số offer NEW
IDX_RATING = 16       # rating (0..50) — cần bật rating
IDX_COUNT_REVIEWS = 17  # số review — cần bật rating
IDX_BUY_BOX_SHIPPING = 18  # giá buy box (gồm ship) — cần bật buybox

# productType Keepa: 4 = variation parent / invalid → không có data giá riêng.
PRODUCT_TYPE_NO_DATA = {4}

# Host ảnh Amazon.
IMAGE_HOST = "https://images-na.ssl-images-amazon.com/images/I/"


def _json_safe(obj: Any) -> Any:
    """
    Chuyển product Keepa thành cấu trúc JSON-safe để ghi vào cột jsonb `raw`.
    Library keepa nhét datetime (và numpy nếu history=True) vào response → supabase serialize sẽ lỗi.
    Dùng json.dumps(default=str) để ép các kiểu không chuẩn về string, rồi load lại thành dict thuần.
    """
    return json.loads(json.dumps(obj, default=str))


def _clean(value: Any) -> Optional[float]:
    """Chuẩn hóa 1 giá trị Keepa: None hoặc < 0 (-1/-2) → None; còn lại giữ nguyên (float)."""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    return None if v < 0 else v


def _cents_to_price(value: Any) -> Optional[float]:
    """Đổi giá dạng cent (Keepa) sang đơn vị tiền; giá trị âm/None → None."""
    v = _clean(value)
    return round(v / 100.0, 2) if v is not None else None


def _stat_current(product: dict[str, Any], index: int) -> Any:
    """Lấy stats.current[index] an toàn."""
    stats = product.get("stats") or {}
    current = stats.get("current") or []
    if 0 <= index < len(current):
        return current[index]
    return None


def _extract_bsr(product: dict[str, Any]) -> Optional[int]:
    """BSR: ưu tiên stats.current[SALES]; fallback salesRanks (rank mới nhất của category đầu tiên)."""
    bsr = _clean(_stat_current(product, IDX_SALES))
    if bsr is not None:
        return int(bsr)

    sales_ranks = product.get("salesRanks") or {}
    for _cat, series in sales_ranks.items():
        # series dạng [time0, rank0, time1, rank1, ...] → rank cuối cùng.
        if isinstance(series, list) and len(series) >= 2:
            cleaned = _clean(series[-1])
            if cleaned is not None:
                return int(cleaned)
    return None


def _extract_image_url(product: dict[str, Any]) -> Optional[str]:
    """
    Ảnh: Keepa mới trả field `images` (list dict có 'l'=large, 'm'=medium filename).
    Fallback field cũ `imagesCSV` (chuỗi token ngăn cách dấu phẩy).
    """
    images = product.get("images")
    if isinstance(images, list) and images:
        first = images[0]
        if isinstance(first, dict):
            name = first.get("l") or first.get("m")
            if name:
                return f"{IMAGE_HOST}{name}"

    images_csv = product.get("imagesCSV")
    if images_csv:
        token = str(images_csv).split(",")[0].strip()
        if token:
            return f"{IMAGE_HOST}{token}"
    return None


def _extract_fulfillment(product: dict[str, Any]) -> Optional[str]:
    """AMZ nếu Amazon giữ buy box; FBA nếu seller FBA; có buy box nhưng không phải → FBM; không rõ → None."""
    stats = product.get("stats") or {}
    if stats.get("buyBoxIsAmazon"):
        return "AMZ"
    if stats.get("buyBoxIsFBA"):
        return "FBA"
    if _clean(stats.get("buyBoxPrice")) is not None:
        return "FBM"
    return None


def _first_category(product: dict[str, Any]) -> Optional[str]:
    """Tên category cụ thể nhất (categoryTree phần tử cuối); fallback rootCategory."""
    tree = product.get("categoryTree")
    if isinstance(tree, list) and tree and isinstance(tree[-1], dict):
        name = tree[-1].get("name")
        if name:
            return name
    return product.get("category") or product.get("rootCategory")


class KeepaClient:
    """Kết nối & truy vấn Keepa, map sang schema snapshot."""

    def __init__(self, api_key: str) -> None:
        self.api = keepa.Keepa(api_key)
        logger.info("Đã kết nối Keepa. Token còn lại: %s", getattr(self.api, "tokens_left", "?"))

    def query_batch(self, asins: list[str]) -> list[dict[str, Any]]:
        """
        Query 1 batch ASIN. wait=True để library tự chờ khi thiếu token.
        rating/buybox bật theo config (tốn thêm token nhưng lấy đủ review + buy box + fulfillment).
        """
        if not asins:
            return []
        logger.info(
            "Query Keepa %d ASIN (rating=%s, buybox=%s)...",
            len(asins), KEEPA_WITH_RATING, KEEPA_WITH_BUYBOX,
        )
        products = self.api.query(
            asins,
            domain=KEEPA_DOMAIN,
            stats=KEEPA_STATS_DAYS,
            history=False,  # không cần history arrays cho snapshot; tránh numpy + giảm payload
            rating=KEEPA_WITH_RATING,
            buybox=KEEPA_WITH_BUYBOX,
            wait=True,
        )
        logger.info(
            "Nhận %d sản phẩm. Token còn lại: %s",
            len(products or []), getattr(self.api, "tokens_left", "?"),
        )
        return products or []

    def map_product_to_snapshot(
        self, product: dict[str, Any], asin_id: str, captured_on: date
    ) -> dict[str, Any]:
        """Map 1 product Keepa → dict khớp cột bảng snapshots. Giữ nguyên response gốc vào cột raw."""
        asin = product.get("asin")
        if product.get("productType") in PRODUCT_TYPE_NO_DATA:
            logger.warning(
                "ASIN %s là variation-parent/invalid (productType=%s) → không có data giá. "
                "Nên track ASIN con thay vì ASIN cha.",
                asin, product.get("productType"),
            )

        price = _cents_to_price(_stat_current(product, IDX_NEW))
        if price is None:
            price = _cents_to_price(_stat_current(product, IDX_AMAZON))  # fallback giá Amazon

        stats = product.get("stats") or {}
        buy_box_price = _cents_to_price(stats.get("buyBoxPrice"))
        if buy_box_price is None:
            buy_box_price = _cents_to_price(_stat_current(product, IDX_BUY_BOX_SHIPPING))
        if buy_box_price is None:
            buy_box_price = price  # fallback: nếu không có buy box, dùng giá NEW

        rating_raw = _clean(_stat_current(product, IDX_RATING))
        rating = round(rating_raw / 10.0, 1) if rating_raw is not None else None

        review_count = _clean(_stat_current(product, IDX_COUNT_REVIEWS))

        # seller_count: ưu tiên tổng số offer; fallback COUNT_NEW.
        seller_count = _clean(stats.get("totalOfferCount"))
        if seller_count is None:
            seller_count = _clean(_stat_current(product, IDX_COUNT_NEW))

        # sales_est: field monthlySold (units/tháng). Không có → None (không bịa số).
        monthly_sold = _clean(product.get("monthlySold"))
        sales_est = int(monthly_sold) if monthly_sold is not None else None

        revenue_est = None
        if price is not None and sales_est is not None:
            revenue_est = round(price * sales_est, 2)

        return {
            "asin_id": asin_id,
            "captured_on": captured_on.isoformat(),
            "bsr": _extract_bsr(product),
            "price": price,
            "sales_est": sales_est,
            "revenue_est": revenue_est,
            "review_count": int(review_count) if review_count is not None else None,
            "rating": rating,
            "seller_count": int(seller_count) if seller_count is not None else None,
            "fulfillment": _extract_fulfillment(product),
            "buy_box_price": buy_box_price,
            "raw": _json_safe(product),  # jsonb — ép JSON-safe (datetime/numpy → str)
        }

    def map_product_to_asin_row(self, product: dict[str, Any], source: str) -> dict[str, Any]:
        """Map product Keepa → dict cho bảng asins (dùng khi discover chèn ASIN mới)."""
        asin = product.get("asin")
        return {
            "asin": asin,
            "title": product.get("title"),
            "image_url": _extract_image_url(product),
            "product_url": f"https://www.amazon.com/dp/{asin}" if asin else None,
            "category": _first_category(product),
            "brand": product.get("brand"),
            "source": source,
        }
