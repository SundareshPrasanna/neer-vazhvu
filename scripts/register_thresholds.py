"""Restoration Register thresholds, floors, lens weights and rules: ONE source.

Every number the public methodology publishes (docs/methodology/
restoration-register-indicators.md) lives here and nowhere else. The calibration
script and the screen engine both import from this module, so a threshold cannot
drift between the table that justified it and the edition that applies it. A change
here is a new version of the methodology, never a silent edit.
"""
from __future__ import annotations

VERSION = "0.1"

# Band letters follow the Wetland Health Card convention: A best ... E worst; I = insufficient.
BANDS = ("A", "B", "C", "D", "E")
BAND_SCORE = {"A": 0, "B": 1, "C": 2, "D": 3, "E": 4}

# ---- floors (hectares unless stated)
TREND_FLOOR_30M_HA = 9.0        # 100 valid JRC pixels
TREND_FLOOR_30M_PX = 100
TREND_FLOOR_10M_HA = 2.0
TREND_FLOOR_10M_PX = 200
COMPOSITION_FLOOR_HA = 1.0
QUALITY_FLOOR_OPEN_WATER_HA = 5.0
PRESENCE_FLOOR_HA = 0.25
PRESENCE_FLOOR_PX = 25

# ---- C1 extent retained (% of the observed high-water reference); higher is better
C1_BANDS = [(85, "A"), (70, "B"), (50, "C"), (30, "D")]      # value >= cut -> band; else E
C1_REF_TOP_N_30M, C1_REF_MIN_COVERAGE = 5, 0.80             # JRC yearly, 1984-2021
C1_REF_TOP_N_10M = 3                                         # 10 m record, 2016-2021
C1_CURRENT_YEARS = (2023, 2024, 2025)

# ---- C2 hydroperiod: months wet lost vs the body's own 2017-2019 baseline; lower loss is better
C2_BASELINE_YEARS = (2017, 2018, 2019)
C2_LOSS_BANDS = [(1, "A"), (2, "B"), (3, "C"), (5, "D")]     # loss < cut -> band; else E
C2_PERENNIAL_MIN_MONTHS_E = 3

# ---- C3 converted surface inside the fixed footprint (%), Health Card "area converted"
C3_BANDS = [(1, "A"), (5, "B"), (10, "C"), (20, "D")]        # value < cut -> band; else E
C3_INNER_RING_M = 30
C3_CORROBORATION_PCT = 5                                     # under this with no structure -> A

# ---- C4 vegetation choke (% of footprint with dry-season NDVI over C4_NDVI), Health Card macrophyte
C4_NDVI = 0.25
C4_BANDS = [(10, "A"), (20, "B"), (30, "C"), (40, "D")]      # value < cut -> band; else E
C4_EXEMPT_TYPES = {"wetland", "marsh", "swamp"}

# ---- C6 storage loss (%), census
C6_BANDS = [(10, "A"), (25, "B"), (40, "C"), (60, "D")]
CENSUS_AREA_DEPTH_TOLERANCE = 1.05

# ---- C7 fragmentation (patch count ratio), C8 froth events per year
C7_BANDS = [(1.05, "A"), (1.5, "B"), (2.0, "C"), (3.0, "D")]
C8_BANDS = [(1, "A"), (3, "B"), (6, "C"), (10, "D")]

# ---- K (small-body set)
K_PRESENCE_WATER_PCT = 20       # a month counts as wet for the body when this share of it reads water
K_WET_SEASON_MONTHS = (10, 11, 12, 1)
K_DRY_SEASON_MONTHS = (4, 5, 6)
K4_BUILT_E_PCT = 50

# ---- T3 connectivity (share of inlets and outlets choked), Health Card inlet-outlet ratio
T3_BANDS = [(0.2, "A"), (0.4, "B"), (0.6, "C"), (0.8, "D")]

# ---- U urgency
U1_RISING_PP_YR, U1_EASING_PP_YR = -1.0, 1.0
U1_WINDOW_YEARS = 10
U3_IRREVERSIBILITY_PCT = 30

# ---- S1 size classes
SIZE_CLASSES = [(0.4, "under 0.4"), (2, "0.4-2"), (10, "2-10"), (50, "10-50"), (100, "50-100"), (200, "100-200")]

# ---- lenses: weights over (condition, urgency, stakes) and the stakes indicators emphasised
LENSES = {
    "restoration-need": {"condition": 0.45, "urgency": 0.25, "stakes": 0.30, "emphasis": ["S1", "S2"]},
    "flood": {"condition": 0.30, "urgency": 0.25, "stakes": 0.45, "emphasis": ["S4", "S2"]},
    "drinking-water-recharge": {"condition": 0.35, "urgency": 0.20, "stakes": 0.45, "emphasis": ["S3", "S6", "C6"]},
    "ecology": {"condition": 0.40, "urgency": 0.20, "stakes": 0.40, "emphasis": ["S5", "C2", "C4"]},
    "livelihoods": {"condition": 0.35, "urgency": 0.20, "stakes": 0.45, "emphasis": ["S6", "T1"]},
}
DEFAULT_LENS = "restoration-need"
CLASS_SCORE = {"High": 2, "Medium": 1, "Low": 0, "Unknown": 0}
URGENCY_SCORE = {"Rising": 2, "Steady": 1, "Easing": 0, "I": 0}

NEED_CLASS_ORDER = ["Fund now", "Co-fund", "Intervene early", "Design first", "Watch / verify", "Maintain", "Steward", "Unassessed"]


def band_lt(value, table, worst="E"):
    """Band for a 'lower is better' value: first cut the value is BELOW."""
    if value is None:
        return "I"
    for cut, b in table:
        if value < cut:
            return b
    return worst


def band_ge(value, table, worst="E"):
    """Band for a 'higher is better' value: first cut the value is AT OR ABOVE."""
    if value is None:
        return "I"
    for cut, b in table:
        if value >= cut:
            return b
    return worst


def size_class(ha: float | None) -> str | None:
    if ha is None:
        return None
    for cut, label in SIZE_CLASSES:
        if ha < cut:
            return label
    return "over 200"


def condition_band(c_bands: dict[str, str]) -> str:
    """Worse of (median of computable C bands, worst single band if two or more are E)."""
    vals = [BAND_SCORE[b] for b in c_bands.values() if b in BAND_SCORE]
    if not vals:
        return "I"
    vals.sort()
    med = vals[len(vals) // 2] if len(vals) % 2 else round((vals[len(vals) // 2 - 1] + vals[len(vals) // 2]) / 2)
    if sum(1 for v in vals if v == 4) >= 2:
        med = max(med, 4)
    return BANDS[int(med)]


def need_class(cond: str, tract: str, urg: str, programme: str, moved: bool, protected: bool, stakes: str) -> str:
    degraded = cond in ("D", "E")
    if cond == "I":
        return "Unassessed"
    if programme == "works underway" or moved:
        if degraded and programme in ("dpr", "works underway"):
            return "Co-fund"
        return "Watch / verify"
    if degraded and programme in ("dpr", "works underway"):
        return "Co-fund"
    if degraded and tract == "High" and programme in ("none", "proposed"):
        return "Fund now"
    if degraded and tract in ("Low", "Unknown"):
        return "Design first"
    if degraded:
        return "Design first"
    if cond == "C" and urg == "Rising":
        return "Intervene early"
    if cond in ("A", "B") and (programme == "completed" or stakes == "High"):
        return "Maintain"
    if cond in ("A", "B") and protected and urg in ("Steady", "Easing"):
        return "Steward"
    if cond == "C":
        return "Watch / verify"
    return "Maintain"
