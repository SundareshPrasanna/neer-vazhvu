"""Constants ported from src/lib/utils/constants.ts."""

from enum import StrEnum

# --- Conversion factors ---
MLD_TO_MCFT = 0.0353147
"""1 MLD (million litres/day) = 0.0353147 mcft (million cubic feet)."""

CUSEC_DAY_TO_MCFT = 0.0864
"""1 cusec flowing for 24 hours = 0.0864 mcft."""

# --- Chennai defaults ---
DEFAULT_CONSUMPTION_MLD = 830
DEFAULT_DESALINATION_MLD = 190  # Minjur 100 + Nemmeli 100

# --- Geography ---
CHENNAI_LAT = 13.0827
CHENNAI_LNG = 80.2707

# --- Day Zero reference ---
DAY_ZERO_DATE = "2019-06-19"
DAY_ZERO_STORAGE_MCFT = 19.0

# --- Reservoir capacities ---
# Must match src/lib/utils/constants.ts RESERVOIR_METADATA (per CMWSSB lake
# level page). Cholavaram 881→1081 and Kannankottai 1574→500 corrected
# 2026-08-03 after the values drifted from the TS side (Apr 2026 correction
# landed only there); 13,222 is CMWSSB's published 6-reservoir total.
TOTAL_RESERVOIR_CAPACITY_MCFT = 13_222.0  # All 6 reservoirs


class ReservoirName(StrEnum):
    POONDI = "poondi"
    CHOLAVARAM = "cholavaram"
    REDHILLS = "redhills"
    CHEMBARAMBAKKAM = "chembarambakkam"
    VEERANAM = "veeranam"
    KANNANKOTTAI = "kannankottai"


RESERVOIR_CAPACITY: dict[str, float] = {
    "poondi": 3231.0,
    "cholavaram": 1081.0,
    "redhills": 3300.0,
    "chembarambakkam": 3645.0,
    "veeranam": 1465.0,
    "kannankottai": 500.0,
}

EXPECTED_RESERVOIR_COUNT = len(RESERVOIR_CAPACITY)
"""All reservoirs must report on a date for it to be usable in days-left math."""

# Maps various CMWSSB page names to canonical reservoir names
RESERVOIR_NAME_MAP: dict[str, str] = {
    "poondi": "poondi",
    "cholavaram": "cholavaram",
    "puzhal": "redhills",
    "red hills": "redhills",
    "chembarambakkam": "chembarambakkam",
    "veeranam": "veeranam",
    "kannankottai": "kannankottai",
    "thervoy kandigai": "kannankottai",
}
