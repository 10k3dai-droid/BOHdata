"""
db.py — Wrapper quanh Supabase Python client cho crawler.
Dùng SERVICE_KEY (bypass RLS) để ghi asins/snapshots.
Cung cấp các helper: lấy ASIN đang track, insert ASIN mới, upsert snapshot (idempotent theo ngày).
"""
from __future__ import annotations

import logging
from typing import Any, Iterable

from supabase import Client, create_client

from config import Settings

logger = logging.getLogger(__name__)


class Database:
    """Bọc supabase client + các thao tác asin-tracker cần dùng."""

    def __init__(self, settings: Settings) -> None:
        # service_role key → full quyền, bỏ qua RLS. KHÔNG expose key này ra web.
        self.client: Client = create_client(
            settings.supabase_url, settings.supabase_service_key
        )

    # ---- ASINS ---------------------------------------------------------------

    def get_tracked_asins(self) -> list[dict[str, Any]]:
        """Lấy toàn bộ ASIN đang theo dõi (id + asin) để crawler chụp snapshot."""
        resp = self.client.table("asins").select("id, asin").execute()
        return resp.data or []

    def get_asin_id_map(self) -> dict[str, str]:
        """Trả dict {asin: id} để map nhanh khi ghi snapshot."""
        return {row["asin"]: row["id"] for row in self.get_tracked_asins()}

    def upsert_asins(self, rows: Iterable[dict[str, Any]]) -> list[dict[str, Any]]:
        """
        Thêm/cập nhật ASIN vào bảng asins, chống trùng theo cột unique `asin`.
        rows: list dict có ít nhất key 'asin', kèm title/image_url/... nếu có.
        Trả về các bản ghi sau upsert (đã có id).
        """
        rows = list(rows)
        if not rows:
            return []
        resp = (
            self.client.table("asins")
            .upsert(rows, on_conflict="asin", ignore_duplicates=False)
            .execute()
        )
        logger.info("Upsert %d ASIN vào bảng asins.", len(rows))
        return resp.data or []

    # ---- SNAPSHOTS -----------------------------------------------------------

    def upsert_snapshots(self, rows: Iterable[dict[str, Any]]) -> int:
        """
        UPSERT snapshot theo (asin_id, captured_on) — chạy lại trong ngày không tạo dòng trùng.
        Trả về số bản ghi đã ghi.
        """
        rows = list(rows)
        if not rows:
            logger.warning("Không có snapshot nào để ghi.")
            return 0
        self.client.table("snapshots").upsert(
            rows, on_conflict="asin_id,captured_on", ignore_duplicates=False
        ).execute()
        logger.info("Upsert %d snapshot (idempotent theo asin_id + captured_on).", len(rows))
        return len(rows)

    # ---- DISCOVER JOBS (nối web ↔ crawler) -----------------------------------

    def get_pending_discover_jobs(self) -> list[dict[str, Any]]:
        """Lấy các job discover trạng thái pending do web tạo."""
        resp = (
            self.client.table("discover_jobs")
            .select("*")
            .eq("status", "pending")
            .order("created_at")
            .execute()
        )
        return resp.data or []

    def update_discover_job(self, job_id: str, **fields: Any) -> None:
        """Cập nhật trạng thái/kết quả 1 job discover."""
        self.client.table("discover_jobs").update(fields).eq("id", job_id).execute()
