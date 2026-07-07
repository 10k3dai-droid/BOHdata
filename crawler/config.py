"""
config.py — Load & validate biến môi trường cho crawler.
Fail fast: thiếu key bắt buộc thì raise ngay khi khởi động, không để lỗi mơ hồ về sau.
"""
from __future__ import annotations

import os
import sys
from dataclasses import dataclass

from dotenv import load_dotenv

# Nạp .env ở thư mục gốc project (../.env so với crawler/) và cả .env cạnh crawler nếu có.
load_dotenv()  # .env ở cwd
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))  # .env ở root repo

# Amazon US — theo ràng buộc project (domain amazon.com).
KEEPA_DOMAIN = "US"

# Keepa: 20 token/phút theo gói €49. Dùng để token_manager ước tính thời gian.
TOKENS_PER_MINUTE = 20

# Giới hạn số ASIN theo dõi (ràng buộc project).
MAX_TRACKED_ASINS = 500

# Batch size mỗi lần gọi Keepa product API. Keepa cho phép nhiều ASIN/call;
# giữ vừa phải để mỗi batch không chờ token quá lâu.
KEEPA_BATCH_SIZE = 20

# Số ngày để Keepa tính stats (avg...). "current" luôn là giá trị hiện tại, không phụ thuộc.
KEEPA_STATS_DAYS = 30

# Lấy rating + review_count. Keepa tính thêm token/sản phẩm khi bật rating.
# ĐANG TẮT để tiết kiệm token (tài khoản free 1 token/phút). Bật lại True khi có gói €49.
KEEPA_WITH_RATING = False

# Lấy buy box price + fulfillment (FBA/FBM/AMZ). Cũng tốn thêm token/sản phẩm.
# ĐANG TẮT để tiết kiệm token; buy_box_price fallback về giá NEW, fulfillment=None. Bật lại True khi có gói €49.
KEEPA_WITH_BUYBOX = False


@dataclass(frozen=True)
class Settings:
    keepa_api_key: str
    supabase_url: str
    supabase_service_key: str


def _require(name: str) -> str:
    """Lấy biến môi trường bắt buộc, thiếu thì thoát với thông báo rõ ràng."""
    value = os.getenv(name)
    if not value:
        print(
            f"[config] THIẾU biến môi trường bắt buộc: {name}. "
            f"Hãy điền vào file .env (xem .env.example).",
            file=sys.stderr,
        )
        raise SystemExit(1)
    return value


def load_settings() -> Settings:
    """Đọc và validate toàn bộ config crawler."""
    return Settings(
        keepa_api_key=_require("KEEPA_API_KEY"),
        supabase_url=_require("SUPABASE_URL"),
        supabase_service_key=_require("SUPABASE_SERVICE_KEY"),
    )
