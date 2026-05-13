"""Cascade health scoring.

Joins three data sources to produce a per-cascade health score and
priority class for the dashboard's at-risk panel:

  1. Documented cascade chains from
     public/data/cascade/{district}-cascades-documented.json (curated,
     source-cited; the 8 chains seeded in Commit 8).

  2. Algorithm output from
     public/data/cascade/{district}-cascade-{nodes,edges}.geojson
     (the terrain-derived graph).

  3. Lost / severely-reduced tanks from
     public/data/water-bodies-lost-{district}.json (where present).
     Madurai has this; Chennai's equivalent is currently inlined in
     about-content.tsx and will be migrated in a follow-up. The
     scorer treats a missing lost-bodies file as 'no lost-tank
     signal available' rather than failing.

The two cascade-class outputs:

  - **Documented cascades**: scored using citation-anchored chain
    structure (tank presence in current OSM, edge reproduction by
    algorithm, average edge confidence, lost-tank intersections,
    external-pressure anchors like court PILs).

  - **Auto-derived cascades**: every weakly-connected component of
    size >= 3 in the algorithm output. Scored using only
    algorithmic signals (avg edge confidence, non-isolated ratio,
    size, lost-tank name overlap). Each auto cascade also tries to
    join against a documented cascade by OSM-ID overlap, lifting
    the documented narrative into the auto cascade's card when one
    matches.

Health score is on 0-100 (higher = less fragile). Priority is bucketed:

  - CRITICAL: health < 25
  - HIGH:     25 <= health < 45
  - MEDIUM:   45 <= health < 70
  - LOW:      health >= 70

Weights are documented inline below; tune by adjusting the
constants. The accompanying tests pin the formula so weight
changes are explicit, traceable commits.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from app.cascade import publish
from app.cascade.districts import (
    CASCADE_OUTPUT_DIR,
    DistrictCascadeConfig,
)


# Health-score weight constants. All weights sum to 1.0 within their
# section. Tuning here is a public, traceable knob; see the
# methodology section in the about page for the rationale.
DOCUMENTED_WEIGHT_TANK_PRESENCE = 0.40
DOCUMENTED_WEIGHT_EDGE_REPRODUCTION = 0.40
DOCUMENTED_WEIGHT_EDGE_CONFIDENCE = 0.20
DOCUMENTED_LOST_TANK_PENALTY_PER_HIT = 10
DOCUMENTED_LOST_TANK_PENALTY_CAP = 40

AUTO_WEIGHT_EDGE_CONFIDENCE = 0.60
AUTO_WEIGHT_NON_ISOLATED = 0.40
AUTO_LOST_TANK_PENALTY_PER_HIT = 5
AUTO_LOST_TANK_PENALTY_CAP = 30
AUTO_MIN_COMPONENT_SIZE = 3

# Confidence-string -> numeric mapping for averaging edge confidence
# into a 0-1 score. Mirrors the HIGH/MEDIUM/LOW buckets from
# topology.classify_edge_confidence; "unspecified" defaults to medium
# so legacy edges from before the confidence field landed don't
# silently pull scores down.
EDGE_CONFIDENCE_NUMERIC: dict[str, float] = {
    "high": 1.0,
    "medium": 0.5,
    "low": 0.2,
    "unspecified": 0.5,
}

# Priority bands.
PRIORITY_CRITICAL_MAX = 25
PRIORITY_HIGH_MAX = 45
PRIORITY_MEDIUM_MAX = 70


def _classify_priority(health: float) -> str:
    if health < PRIORITY_CRITICAL_MAX:
        return "CRITICAL"
    if health < PRIORITY_HIGH_MAX:
        return "HIGH"
    if health < PRIORITY_MEDIUM_MAX:
        return "MEDIUM"
    return "LOW"


# ----- I/O helpers -----


def _public_data_dir() -> Path:
    """Return the public/data directory regardless of cwd.

    publish.CASCADE_OUTPUT_DIR points at public/data/cascade. Walk
    one level up to get the public/data root where the lost-tank
    JSONs sit.
    """
    return CASCADE_OUTPUT_DIR.parent


def _load_json(path: Path) -> dict[str, Any] | None:
    if not path.exists():
        return None
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return None


def _load_documented_cascades(district_id: str) -> list[dict[str, Any]]:
    path = CASCADE_OUTPUT_DIR / f"{district_id}-cascades-documented.json"
    payload = _load_json(path)
    if not payload:
        return []
    return list(payload.get("cascades", []))


def _load_lost_tank_names(district_id: str) -> set[str]:
    """Return the set of lost-tank names for the district.

    Schema currently only exists for Madurai
    (water-bodies-lost-madurai.json). Other cities return an empty
    set; the scorer treats this as 'no lost-tank intersection signal
    available' rather than failing.
    """
    path = _public_data_dir() / f"water-bodies-lost-{district_id}.json"
    payload = _load_json(path)
    if not payload:
        return set()
    bodies = payload.get("lost_bodies") or []
    names: set[str] = set()
    for entry in bodies:
        name = (entry.get("name") or "").strip()
        if name:
            names.add(name)
    return names


# ----- Name matching for lost-tank intersection -----


def _normalise_name(name: str) -> str:
    """Strip common suffixes / honorifics so 'Tallakulam tank' matches
    'Reservoir near Tallakulam (5.2 ha)'.
    """
    if not name:
        return ""
    cleaned = name.lower()
    for suffix in (
        " tank",
        " lake",
        " kanmai",
        " kanmoi",
        " kulam",
        " reservoir",
        " pond",
        " teppakulam",
    ):
        if cleaned.endswith(suffix):
            cleaned = cleaned[: -len(suffix)]
    # Drop area annotations like "(5.2 ha)" and leading "reservoir near "
    if cleaned.startswith("reservoir near "):
        cleaned = cleaned[len("reservoir near ") :]
    if cleaned.startswith("tank near "):
        cleaned = cleaned[len("tank near ") :]
    paren_idx = cleaned.find("(")
    if paren_idx >= 0:
        cleaned = cleaned[:paren_idx]
    return cleaned.strip()


def _intersects_lost(node_name: str, lost_names: set[str]) -> str | None:
    """If node_name plausibly matches any lost-tank name, return the
    matched lost name. Otherwise None.
    """
    if not node_name or not lost_names:
        return None
    norm_node = _normalise_name(node_name)
    if not norm_node:
        return None
    for lost in lost_names:
        norm_lost = _normalise_name(lost)
        if not norm_lost:
            continue
        # Either side fully contained in the other (case-insensitive).
        if norm_lost == norm_node:
            return lost
        if len(norm_lost) >= 4 and norm_lost in norm_node:
            return lost
        if len(norm_node) >= 4 and norm_node in norm_lost:
            return lost
    return None


# ----- Documented cascade scoring -----


def score_documented_cascade(
    cascade: dict[str, Any],
    *,
    current_node_osm_ids: set[int],
    edges_by_pair: dict[tuple[int, int], dict[str, Any]],
    lost_tank_names: set[str],
) -> dict[str, Any]:
    """Score a single documented cascade.

    Returns the cascade dict augmented with health_score, priority,
    and a `components` block detailing each scoring component.
    """
    tanks = cascade.get("tanks_in_order", []) or []
    edges = cascade.get("edges", []) or []

    total_tanks = len(tanks)
    resolved_in_osm = sum(
        1
        for t in tanks
        if t.get("osm_id") is not None and int(t["osm_id"]) in current_node_osm_ids
    )
    tank_presence_ratio = resolved_in_osm / total_tanks if total_tanks else 0.0

    matched_edges: list[dict[str, Any]] = []
    for e in edges:
        from_idx = int(e.get("from_index", -1))
        to_idx = int(e.get("to_index", -1))
        if not (0 <= from_idx < total_tanks and 0 <= to_idx < total_tanks):
            continue
        from_t = tanks[from_idx]
        to_t = tanks[to_idx]
        if from_t.get("osm_id") is None or to_t.get("osm_id") is None:
            continue
        key = (int(from_t["osm_id"]), int(to_t["osm_id"]))
        if key in edges_by_pair:
            matched_edges.append(edges_by_pair[key])

    edge_reproduction_ratio = (
        len(matched_edges) / len(edges) if edges else 0.0
    )

    if matched_edges:
        avg_conf = sum(
            EDGE_CONFIDENCE_NUMERIC.get(
                str(e.get("confidence", "unspecified")).lower(),
                EDGE_CONFIDENCE_NUMERIC["unspecified"],
            )
            for e in matched_edges
        ) / len(matched_edges)
    else:
        avg_conf = 0.0

    lost_hits: list[str] = []
    for t in tanks:
        matched = _intersects_lost(t.get("name") or "", lost_tank_names)
        if matched and matched not in lost_hits:
            lost_hits.append(matched)

    raw_health = (
        DOCUMENTED_WEIGHT_TANK_PRESENCE * tank_presence_ratio
        + DOCUMENTED_WEIGHT_EDGE_REPRODUCTION * edge_reproduction_ratio
        + DOCUMENTED_WEIGHT_EDGE_CONFIDENCE * avg_conf
    ) * 100
    penalty = min(
        DOCUMENTED_LOST_TANK_PENALTY_CAP,
        len(lost_hits) * DOCUMENTED_LOST_TANK_PENALTY_PER_HIT,
    )
    health = max(0.0, round(raw_health - penalty, 1))

    return {
        "cascade_id": cascade.get("cascade_id"),
        "name": cascade.get("name"),
        "short_name": cascade.get("short_name"),
        "narrative": cascade.get("narrative"),
        "transfer_type": cascade.get("transfer_type"),
        "historical_era": cascade.get("historical_era"),
        "confidence": cascade.get("confidence"),
        "is_engineered_control": bool(cascade.get("is_engineered_control")),
        "source": cascade.get("source"),
        "court_anchor": cascade.get("court_anchor"),
        "restoration_anchor": cascade.get("restoration_anchor"),
        "tanks_in_order": tanks,
        "edges": edges,
        "health_score": health,
        "priority": _classify_priority(health),
        "components": {
            "tank_presence": {
                "resolved_in_osm": resolved_in_osm,
                "total": total_tanks,
                "ratio": round(tank_presence_ratio, 3),
            },
            "edge_reproduction": {
                "reproduced": len(matched_edges),
                "total_documented": len(edges),
                "ratio": round(edge_reproduction_ratio, 3),
            },
            "avg_edge_confidence": round(avg_conf, 3),
            "lost_tank_intersections": lost_hits,
            "court_anchor_present": cascade.get("court_anchor") is not None,
            "restoration_anchor_present": (
                cascade.get("restoration_anchor") is not None
            ),
            "engineered_control": bool(cascade.get("is_engineered_control")),
        },
    }


# ----- Auto cascade derivation + scoring -----


def find_connected_components(
    node_osm_ids: set[int],
    edge_pairs: list[tuple[int, int]],
) -> list[set[int]]:
    """Union-find over the directed edge graph treated as undirected.

    Returns the set of weakly connected components. Pure function;
    no I/O.
    """
    parent: dict[int, int] = {n: n for n in node_osm_ids}

    def find(x: int) -> int:
        while parent[x] != x:
            parent[x] = parent[parent[x]]
            x = parent[x]
        return x

    def union(a: int, b: int) -> None:
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    for u, v in edge_pairs:
        if u in parent and v in parent:
            union(u, v)

    components: dict[int, set[int]] = {}
    for n in node_osm_ids:
        components.setdefault(find(n), set()).add(n)
    return list(components.values())


def score_auto_cascade(
    component: set[int],
    *,
    nodes_by_id: dict[int, dict[str, Any]],
    component_edges: list[dict[str, Any]],
    lost_tank_names: set[str],
) -> dict[str, Any]:
    """Score an auto-derived cascade (weakly connected component).

    Returns the score dict; caller filters out components below
    AUTO_MIN_COMPONENT_SIZE.
    """
    size = len(component)
    if component_edges:
        avg_conf = sum(
            EDGE_CONFIDENCE_NUMERIC.get(
                str(e.get("confidence", "unspecified")).lower(),
                EDGE_CONFIDENCE_NUMERIC["unspecified"],
            )
            for e in component_edges
        ) / len(component_edges)
    else:
        avg_conf = 0.0

    isolated_count = sum(
        1
        for nid in component
        if (nodes_by_id.get(nid) or {}).get("isolation_reason")
    )
    non_iso_ratio = 1.0 - (isolated_count / size) if size else 0.0

    total_area_ha = sum(
        float((nodes_by_id.get(nid) or {}).get("area_ha") or 0.0)
        for nid in component
    )

    lost_hits: list[str] = []
    for nid in component:
        props = nodes_by_id.get(nid) or {}
        matched = _intersects_lost(props.get("name") or "", lost_tank_names)
        if matched and matched not in lost_hits:
            lost_hits.append(matched)

    raw_health = (
        AUTO_WEIGHT_EDGE_CONFIDENCE * avg_conf
        + AUTO_WEIGHT_NON_ISOLATED * non_iso_ratio
    ) * 100
    penalty = min(
        AUTO_LOST_TANK_PENALTY_CAP,
        len(lost_hits) * AUTO_LOST_TANK_PENALTY_PER_HIT,
    )
    health = max(0.0, round(raw_health - penalty, 1))

    representative_name = None
    largest_area = 0.0
    for nid in component:
        props = nodes_by_id.get(nid) or {}
        name = (props.get("name") or "").strip()
        area = float(props.get("area_ha") or 0.0)
        if name and area > largest_area:
            representative_name = name
            largest_area = area

    return {
        "size": size,
        "tank_osm_ids": sorted(component),
        "representative_tank_name": representative_name,
        "total_area_ha": round(total_area_ha, 2),
        "edge_count": len(component_edges),
        "avg_edge_confidence": round(avg_conf, 3),
        "isolated_count": isolated_count,
        "non_isolated_ratio": round(non_iso_ratio, 3),
        "lost_tank_intersections": lost_hits,
        "health_score": health,
        "priority": _classify_priority(health),
    }


# ----- Orchestrator -----


def compute_cascade_health(district: DistrictCascadeConfig) -> dict[str, Any]:
    """Read cascade outputs + documented chains + lost-tanks, score
    everything, write `{district}-cascades-health.json`.

    Returns the payload that was written.
    """
    publish._ensure_dirs()

    nodes = publish._load_feature_collection(
        district.cascade_nodes_geojson_path()
    )
    edges = publish._load_feature_collection(
        district.cascade_edges_geojson_path()
    )
    documented = _load_documented_cascades(district.district_id)
    lost_names = _load_lost_tank_names(district.district_id)

    nodes_by_id: dict[int, dict[str, Any]] = {}
    for node in nodes:
        props = node.get("properties") or {}
        try:
            osm_id = int(props.get("osm_id"))
        except (TypeError, ValueError):
            continue
        nodes_by_id[osm_id] = props
    node_osm_ids: set[int] = set(nodes_by_id)

    edges_by_pair: dict[tuple[int, int], dict[str, Any]] = {}
    edge_pairs: list[tuple[int, int]] = []
    for e in edges:
        props = e.get("properties") or {}
        try:
            f = int(props.get("from_osm_id"))
            t = int(props.get("to_osm_id"))
        except (TypeError, ValueError):
            continue
        edges_by_pair[(f, t)] = props
        edge_pairs.append((f, t))

    # Score documented cascades.
    documented_scored = [
        score_documented_cascade(
            c,
            current_node_osm_ids=node_osm_ids,
            edges_by_pair=edges_by_pair,
            lost_tank_names=lost_names,
        )
        for c in documented
    ]

    # Derive + score auto cascades.
    components = find_connected_components(node_osm_ids, edge_pairs)
    auto_scored: list[dict[str, Any]] = []
    component_idx = 0
    for component in components:
        if len(component) < AUTO_MIN_COMPONENT_SIZE:
            continue
        component_edges = [
            edges_by_pair[(u, v)]
            for (u, v) in edges_by_pair
            if u in component and v in component
        ]
        scored = score_auto_cascade(
            component,
            nodes_by_id=nodes_by_id,
            component_edges=component_edges,
            lost_tank_names=lost_names,
        )
        scored["cascade_id"] = (
            f"auto-{district.district_id}-{component_idx:03d}"
        )

        # Join against documented cascades by OSM-ID overlap.
        overlap: dict[str, Any] | None = None
        best_overlap = 0
        for doc in documented_scored:
            doc_osm_ids = {
                int(t["osm_id"])
                for t in (doc.get("tanks_in_order") or [])
                if t.get("osm_id") is not None
            }
            shared = doc_osm_ids & component
            if len(shared) > best_overlap:
                best_overlap = len(shared)
                overlap = {
                    "documented_cascade_id": doc["cascade_id"],
                    "documented_name": doc["name"],
                    "shared_tank_count": len(shared),
                }
        scored["documented_overlap"] = overlap
        auto_scored.append(scored)
        component_idx += 1

    # Sort outputs: by priority (CRITICAL first) then by size desc.
    priority_rank = {"CRITICAL": 0, "HIGH": 1, "MEDIUM": 2, "LOW": 3}
    documented_scored.sort(
        key=lambda c: (priority_rank.get(c["priority"], 9), -c["components"]["tank_presence"]["total"])
    )
    auto_scored.sort(
        key=lambda c: (priority_rank.get(c["priority"], 9), -c["size"])
    )

    summary = {
        "documented_count": len(documented_scored),
        "auto_count": len(auto_scored),
        "documented_by_priority": _count_by_priority(documented_scored),
        "auto_by_priority": _count_by_priority(auto_scored),
        "min_component_size": AUTO_MIN_COMPONENT_SIZE,
    }

    payload: dict[str, Any] = {
        "district_id": district.district_id,
        "label": district.label,
        "_meta": publish._build_meta(district),
        "summary": summary,
        "documented_cascades": documented_scored,
        "auto_cascades": auto_scored,
    }

    out_path = CASCADE_OUTPUT_DIR / f"{district.district_id}-cascades-health.json"
    out_path.write_text(
        json.dumps(payload, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )

    return payload


def _count_by_priority(cascades: list[dict[str, Any]]) -> dict[str, int]:
    counts = {"CRITICAL": 0, "HIGH": 0, "MEDIUM": 0, "LOW": 0}
    for c in cascades:
        priority = c.get("priority", "LOW")
        if priority in counts:
            counts[priority] += 1
    return counts
