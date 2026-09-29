"""The Chennai service's reads and writes name their city rather than leaning
on the tables' DEFAULT 'chennai' (migration 035)."""

import asyncio
from types import SimpleNamespace

from app.intelligence import briefing, risk_scorer


class FakeSupabase:
    def __init__(self, data: dict[str, list[dict]]):
        self.data = data
        self.eqs: list[tuple[str, str, object]] = []
        self.upserts: list[tuple[str, list[dict]]] = []

    def table(self, name: str) -> "FakeQuery":
        return FakeQuery(self, name)


class FakeQuery:
    def __init__(self, db: FakeSupabase, table: str):
        self.db, self.table = db, table

    def eq(self, col, val):
        self.db.eqs.append((self.table, col, val))
        return self

    def upsert(self, rows, on_conflict=None):
        self.db.upserts.append((self.table, rows if isinstance(rows, list) else [rows]))
        return self

    def execute(self):
        return SimpleNamespace(data=self.db.data.get(self.table, []))

    def __getattr__(self, _name):
        return lambda *a, **k: self


def _filtered(db: FakeSupabase, table: str) -> bool:
    return (table, "city_id", "chennai") in db.eqs


def test_risk_scores_read_and_write_chennai(monkeypatch):
    db = FakeSupabase(
        {
            "groundwater_monthly": [
                {"ward_number": 1, "depth_to_water_m": 8.0, "year": 2026, "month": 5}
            ],
            "water_estimate_daily": [{"storage_pct": 40.0}],
        }
    )
    monkeypatch.setattr(risk_scorer, "get_supabase", lambda: db)
    asyncio.run(risk_scorer.compute_risk_scores())
    assert _filtered(db, "groundwater_monthly") and _filtered(
        db, "water_estimate_daily"
    )
    rows = [r for t, rs in db.upserts if t == "ward_risk_score" for r in rs]
    assert rows and all(r["city_id"] == "chennai" for r in rows)


def test_briefing_reads_and_writes_chennai(monkeypatch):
    db = FakeSupabase(
        {
            "water_estimate_daily": [
                {
                    "storage_pct": 40.0,
                    "avg_inflow_mcft_day": 10.0,
                    "days_left_pessimistic": 100,
                    "days_left_moderate": 150,
                    "days_left_optimistic": 200,
                }
            ],
            "ward_risk_score": [{"risk_level": "high"}],
        }
    )
    monkeypatch.setattr(briefing, "get_supabase", lambda: db)
    out = asyncio.run(briefing.generate_briefing())
    assert _filtered(db, "water_estimate_daily") and _filtered(db, "ward_risk_score")
    assert [
        r["city_id"] for t, rs in db.upserts if t == "daily_briefing" for r in rs
    ] == ["chennai"]
    assert "city_id" not in out
