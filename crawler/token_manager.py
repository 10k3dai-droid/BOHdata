"""
token_manager.py — Theo dõi token Keepa và ước tính thời gian chạy.

Keepa: 1 token = 1 product. Gói €49 ~ 20 token/phút. Token refill dần theo thời gian,
hết hạn sau 60 phút. Library keepa có cơ chế wait=True tự chờ khi thiếu token —
module này KHÔNG thay thế cơ chế đó, mà bổ sung logging + ước tính để người vận hành biết.
"""
from __future__ import annotations

import logging
from dataclasses import dataclass

from config import TOKENS_PER_MINUTE

logger = logging.getLogger(__name__)


@dataclass
class TokenStatus:
    tokens_left: int
    refill_rate_per_min: int


class TokenManager:
    """Log token còn lại và ước tính thời gian crawl N sản phẩm."""

    def __init__(self, keepa_api) -> None:
        # keepa_api: instance keepa.Keepa (đã có thuộc tính tokens_left).
        self._api = keepa_api

    def status(self) -> TokenStatus:
        """Đọc token hiện tại từ library keepa."""
        # Library keepa cập nhật self.tokens_left sau mỗi request; đọc an toàn nếu chưa có.
        tokens_left = int(getattr(self._api, "tokens_left", 0) or 0)
        return TokenStatus(tokens_left=tokens_left, refill_rate_per_min=TOKENS_PER_MINUTE)

    def log_status(self, context: str = "") -> None:
        """Ghi log token còn lại."""
        st = self.status()
        prefix = f"[{context}] " if context else ""
        logger.info("%sToken Keepa còn lại: %d (refill ~%d/phút).",
                    prefix, st.tokens_left, st.refill_rate_per_min)

    def estimate_minutes(self, n_products: int) -> float:
        """
        Ước tính số PHÚT để crawl n_products, tính cả token đang có sẵn.
        Nếu token sẵn đủ → coi như tức thời (0 phút chờ refill).
        """
        st = self.status()
        needed = max(0, n_products - st.tokens_left)
        minutes = needed / TOKENS_PER_MINUTE if TOKENS_PER_MINUTE else float("inf")
        return round(minutes, 1)

    def log_estimate(self, n_products: int) -> None:
        """Log ước tính thời gian chạy cho n_products."""
        minutes = self.estimate_minutes(n_products)
        st = self.status()
        logger.info(
            "Cần %d token cho %d sản phẩm; đang có %d. Ước tính chờ refill ~%.1f phút "
            "(library tự chờ nhờ wait=True).",
            n_products, n_products, st.tokens_left, minutes,
        )
