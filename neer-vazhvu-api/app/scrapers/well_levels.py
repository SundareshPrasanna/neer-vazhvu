"""
Quality rules for groundwater level series, shared by every well feed.

A reading is kept when it is not a placeholder and its depth below ground, read
in the station's own sign convention, sits inside the physical envelope. The
sign comes from the station's median, never abs(): the feeds publish depth as
negative below ground, and some stations flip sign mid-series. The envelope is
the district atlas's (scripts/lib/tn_district_basin.py GWL_ENVELOPE_M), so a
deep borewell at 120 m survives where the old 50 m cut dropped it.
"""

from bisect import bisect_left, bisect_right
from collections.abc import Sequence
from datetime import date, timedelta
from statistics import median

ENVELOPE_M = (-5.0, 200.0)  # metres below ground level
WIMS_PLACEHOLDERS = frozenset({0.0, 1.0})  # WIMS writes these for a missed reading
# A well whose depth sits metres down does not flow above ground; such a reading
# is a sign-flipped record, not artesian water.
ARTESIAN_LIMIT_M = 2.0
SPIKE_M = 10.0  # departure from the station's rolling median that no observation well makes in a day
SPIKE_WINDOW_DAYS = 15
STUCK_RANGE_M = 0.10  # under 10 cm of movement ...
STUCK_WINDOW_DAYS = 60  # ... across 60 days marks a sensor that stopped moving
STUCK_MIN_DAYS = 30  # readings needed in the window before calling it stuck


def station_sign(values: Sequence[float]) -> float:
    """-1 when the station publishes depth as negative below ground, else 1."""
    return -1.0 if median(values) < 0 else 1.0


def keep_mask(
    values: Sequence[float], placeholders: frozenset[float] = WIMS_PLACEHOLDERS
) -> list[bool]:
    """Which of one station's readings are plausible water levels."""
    real = [v for v in values if v not in placeholders]
    if not real:
        return [False] * len(values)
    sign = station_sign(real)
    ok = [
        v not in placeholders and ENVELOPE_M[0] <= sign * v <= ENVELOPE_M[1]
        for v in values
    ]
    kept = [sign * v for v, k in zip(values, ok) if k]
    if kept and median(kept) > ARTESIAN_LIMIT_M:
        ok = [k and sign * v >= 0 for v, k in zip(values, ok)]
    return ok


def spike_mask(days: Sequence[date], depths: Sequence[float]) -> list[bool]:
    """False for a reading far from its station's median over the days around it.

    `days` must be sorted; one station's readings, several a day allowed.
    """
    span = timedelta(days=SPIKE_WINDOW_DAYS)
    out = []
    for d, v in zip(days, depths):
        near = depths[bisect_left(days, d - span) : bisect_right(days, d + span)]
        out.append(abs(v - median(near)) <= SPIKE_M)
    return out


def stuck_days(series: dict[date, float]) -> set[date]:
    """Days on which the station had moved under 10 cm across the previous 60 days."""
    days = sorted(series)
    span = timedelta(days=STUCK_WINDOW_DAYS)
    stuck = set()
    for i, d in enumerate(days):
        window = [series[x] for x in days[bisect_right(days, d - span) : i + 1]]
        if len(window) >= STUCK_MIN_DAYS and max(window) - min(window) < STUCK_RANGE_M:
            stuck.add(d)
    return stuck
