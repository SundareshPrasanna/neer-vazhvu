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
TOTAL_RESERVOIR_CAPACITY_MCFT = 14_096.0  # All 6 reservoirs


class ReservoirName(StrEnum):
    POONDI = "poondi"
    CHOLAVARAM = "cholavaram"
    REDHILLS = "redhills"
    CHEMBARAMBAKKAM = "chembarambakkam"
    VEERANAM = "veeranam"
    KANNANKOTTAI = "kannankottai"


RESERVOIR_CAPACITY: dict[str, float] = {
    "poondi": 3231.0,
    "cholavaram": 881.0,
    "redhills": 3300.0,
    "chembarambakkam": 3645.0,
    "veeranam": 1465.0,
    "kannankottai": 1574.0,
}

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
