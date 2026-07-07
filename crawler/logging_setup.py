"""
logging_setup.py — Cấu hình logging chung: ghi ra stdout + file (crawler/logs/crawler.log).
Gọi setup_logging() một lần ở entrypoint.
"""
from __future__ import annotations

import logging
import os
import sys
from logging.handlers import RotatingFileHandler

_LOG_DIR = os.path.join(os.path.dirname(__file__), "logs")
_LOG_FILE = os.path.join(_LOG_DIR, "crawler.log")

_FORMAT = "%(asctime)s | %(levelname)-7s | %(name)s | %(message)s"


def setup_logging(level: int = logging.INFO) -> None:
    """Khởi tạo root logger với 2 handler: console + file xoay vòng (5MB x 3)."""
    os.makedirs(_LOG_DIR, exist_ok=True)

    # Ép stdout/stderr sang utf-8 để log tiếng Việt không vỡ font trên console Windows.
    for stream in (sys.stdout, sys.stderr):
        try:
            stream.reconfigure(encoding="utf-8")  # type: ignore[attr-defined]
        except (AttributeError, ValueError):
            pass  # môi trường không hỗ trợ reconfigure → bỏ qua, file log vẫn utf-8

    root = logging.getLogger()
    root.setLevel(level)

    # Tránh add handler trùng khi gọi lại nhiều lần (vd trong test).
    if root.handlers:
        return

    formatter = logging.Formatter(_FORMAT)

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)

    file_handler = RotatingFileHandler(
        _LOG_FILE, maxBytes=5 * 1024 * 1024, backupCount=3, encoding="utf-8"
    )
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)
