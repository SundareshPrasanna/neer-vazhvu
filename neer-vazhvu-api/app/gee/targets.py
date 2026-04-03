from __future__ import annotations

import json
from dataclasses import asdict, dataclass
from typing import Any

from app.gee.config import PHASE1_TARGETS_PATH, REPO_ROOT


RESTORATION_PRIORITY_PATH = REPO_ROOT / "public" / "data" / "restoration-priority.json"

HIGH_PRIORITY_LEVELS = {"critical", "high"}
EXCLUDED_NAME_PATTERNS = (
    "flyash",
    "fly ash",
    "ash pond",
    "oxidation pond",
    "wastewater",
    "waste water",
    "effluent",
    "settling pond",
    "cooling pond",
    "stp",
)
EXCLUDED_WATER_TYPES = {"wastewater", "ditch", "drain"}
ALLOWED_UNNAMED_WATER_TYPES = {"reservoir", "lake", "water", "marsh"}
RESERVOIR_NAME_PATTERNS = (
    "poondi",
    "red hills",
    "puzhal",
    "chembarambakkam",
    "cholavaram",
    "veeranam",
    "kannankottai",
    "thervoy",
)
WETLAND_NAME_PATTERNS = ("marsh", "wetland", "backwater", "creek")


@dataclass(slots=True)
class Phase1WaterBodyTarget:
    gee_target_id: str
    osm_id: int | None
    census_id: int | None
    name: str
    water_type: str
    area_ha: float
    priority_level: str
    priority_score: float
    centroid: list[float]
    include_reason: str


def _normalized_name(name: str | None) -> str:
    return (name or "").strip()


def _is_excluded(name: str, water_type: str) -> bool:
    lowered = name.lower()
    if any(pattern in lowered for pattern in EXCLUDED_NAME_PATTERNS):
        return True
    return water_type.lower() in EXCLUDED_WATER_TYPES


def determine_include_reason(row: dict[str, Any]) -> str | None:
    if row.get("osm_id") is None:
        return None

    name = _normalized_name(row.get("name"))
    water_type = str(row.get("water_type") or "")
    area_ha = float(row.get("area_ha") or 0.0)
    priority_level = str(row.get("priority_level") or "")
    lowered = name.lower()
    normalized_water_type = water_type.lower()

    if _is_excluded(name, water_type):
        return None

    if name and any(pattern in lowered for pattern in RESERVOIR_NAME_PATTERNS):
        return "named_reservoir"

    if name and any(pattern in lowered for pattern in WETLAND_NAME_PATTERNS):
        return "named_wetland"

    if priority_level in HIGH_PRIORITY_LEVELS and name and area_ha >= 1:
        return "priority"

    if (
        priority_level in HIGH_PRIORITY_LEVELS
        and not name
        and area_ha >= 25
        and normalized_water_type in ALLOWED_UNNAMED_WATER_TYPES
    ):
        return "priority_large_unnamed"

    if area_ha >= 10 and bool(name):
        return "named_large"

    if (
        area_ha >= 50
        and normalized_water_type in ALLOWED_UNNAMED_WATER_TYPES
    ):
        return "large_unnamed"

    return None


def _sort_key(target: Phase1WaterBodyTarget) -> tuple[int, float, str, str]:
    priority_rank = {"critical": 0, "high": 1, "moderate": 2, "low": 3}.get(
        target.priority_level, 9
    )
    display_name = target.name or "(unnamed)"
    return (priority_rank, -target.area_ha, display_name.lower(), target.gee_target_id)


def build_phase1_targets() -> list[Phase1WaterBodyTarget]:
    data = json.loads(RESTORATION_PRIORITY_PATH.read_text(encoding="utf-8"))
    targets: list[Phase1WaterBodyTarget] = []

    for row in data.get("water_bodies", []):
        include_reason = determine_include_reason(row)
        if not include_reason:
            continue

        target = Phase1WaterBodyTarget(
            gee_target_id=str(row["id"]),
            osm_id=row.get("osm_id"),
            census_id=row.get("census_id"),
            name=_normalized_name(row.get("name")),
            water_type=str(row.get("water_type") or ""),
            area_ha=float(row.get("area_ha") or 0.0),
            priority_level=str(row.get("priority_level") or ""),
            priority_score=float(row.get("priority_score") or 0.0),
            centroid=list(row.get("centroid") or []),
            include_reason=include_reason,
        )
        targets.append(target)

    targets.sort(key=_sort_key)
    return targets


def write_phase1_target_manifest() -> dict[str, Any]:
    targets = build_phase1_targets()
    payload = {
        "manifest_version": 1,
        "selection_rules": {
            "priority_levels": sorted(HIGH_PRIORITY_LEVELS),
            "min_named_area_ha": 10,
            "min_large_unnamed_area_ha": 50,
            "min_priority_area_ha": 1,
            "min_priority_large_unnamed_area_ha": 25,
            "excluded_name_patterns": list(EXCLUDED_NAME_PATTERNS),
            "excluded_water_types": sorted(EXCLUDED_WATER_TYPES),
        },
        "target_count": len(targets),
        "targets": [asdict(target) for target in targets],
    }
    PHASE1_TARGETS_PATH.write_text(
        json.dumps(payload, indent=2, ensure_ascii=True) + "\n",
        encoding="utf-8",
    )
    return payload
