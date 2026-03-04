"""Timezone helpers for Chennai (IST) business-date logic."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def ist_now() -> datetime:
    """Current time in IST."""
    return datetime.now(IST)


def ist_today() -> date:
    """Current business date in IST."""
    return ist_now().date()
