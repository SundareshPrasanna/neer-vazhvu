from datetime import datetime

from app.utils import timezone


def test_ist_now_returns_timezone_aware_datetime():
    now = timezone.ist_now()

    assert isinstance(now, datetime)
    assert now.tzinfo == timezone.IST
    assert now.utcoffset().total_seconds() == 5.5 * 60 * 60


def test_ist_today_uses_ist_now(monkeypatch):
    fixed = datetime(2026, 3, 4, 23, 59, 0, tzinfo=timezone.IST)
    monkeypatch.setattr(timezone, "ist_now", lambda: fixed)

    assert timezone.ist_today().isoformat() == "2026-03-04"
