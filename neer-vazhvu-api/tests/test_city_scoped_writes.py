"""Reads and writes name their city rather than leaning on the tables' old
DEFAULT 'chennai' (migration 035), which migration 050 dropped."""

import asyncio
from types import SimpleNamespace

from app.gee import reservoir_context, water_bodies
from app.intelligence import briefing, risk_scorer


class FakeSupabase:
    def __init__(self, data: dict[str, list[dict]]):
        self.data = data
        self.eqs: list[tuple[str, str, object]] = []
        self.upserts: list[tuple[str, list[dict]]] = []
        self.conflicts: list[str | None] = []

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
        self.db.conflicts.append(on_conflict)
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
    assert db.conflicts == ["city_id,ward_number,computed_date"]


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
    assert db.conflicts == ["city_id,briefing_date"]


def test_gee_writers_send_their_city(monkeypatch):
    db = FakeSupabase({})
    monkeypatch.setattr("app.db.get_supabase", lambda: db)
    reservoir_context.upsert_reservoir_context(
        [
            reservoir_context.ReservoirCatchmentContextRow(
                city_id="chennai",
                reservoir="poondi",
                context_date="2026-08-31",
                window_days=7,
                rain_total_mm=11.28,
                baseline_mm=32.99,
                anomaly_pct=-65.81,
                context_level="well_below",
            )
        ]
    )
    water_bodies.upsert_water_body_summaries(
        [
            water_bodies.WaterBodySatelliteSummaryRow(
                city_id="madurai", gee_target_id="osm:1", summary_date="2026-10-05"
            )
        ]
    )
    assert [(t, r["city_id"]) for t, rs in db.upserts for r in rs] == [
        ("reservoir_catchment_context", "chennai"),
        ("water_body_satellite_summary", "madurai"),
    ]
    assert db.conflicts == [
        "city_id,reservoir,context_date,window_days",
        "city_id,gee_target_id,summary_date",
    ]


def test_water_body_backfill_keeps_the_requested_city(monkeypatch):
    seen: list[str | None] = []

    def compute(**kwargs):
        seen.append(kwargs.get("city_id"))
        raise RuntimeError("no imagery")

    fc = SimpleNamespace(geometry=lambda: SimpleNamespace(bounds=lambda: None))
    monkeypatch.setattr(water_bodies, "load_phase1_target_features", lambda **_: [])
    monkeypatch.setattr(water_bodies, "initialize_earth_engine", lambda: None)
    monkeypatch.setattr(water_bodies, "_build_target_feature_collection", lambda *_: fc)
    monkeypatch.setattr(
        water_bodies, "compute_jrc_monthly_baselines", lambda *_, **__: {}
    )
    monkeypatch.setattr(water_bodies, "compute_water_body_summary_rows", compute)
    water_bodies.backfill_water_body_summaries(city_id="madurai", months_back=1)
    assert seen and set(seen) == {"madurai"}
