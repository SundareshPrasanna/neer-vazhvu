"""Cascade sensitivity analysis.

Rebuilds the topology under varied parameter settings and reports
how node count, edge count, isolation count, and max cascade depth
respond. Used to populate the parameter-rationale tables in the
methodology section + the PDF appendix that hydrologists will read.

Re-uses the pure builder `_build_graph_from_polygons_with_elevations`
with elevation + flow-direction values pulled out of the already-
published `{city}-cascade-nodes.geojson`, so no GEE credentials are
needed to run a sweep on existing data.

Limitations:

  - The min_tank_area_ha sweep can only raise the bar above the
    default (1.0). Below it the elevation + flow-direction data
    points haven't been sampled, so a sweep value < default is
    silently skipped with a note in the output.

  - The cone half-angle is a module-level constant in topology.py;
    the sweeper monkey-patches it during the sweep run and restores
    it afterwards. Pure within the sweep; do not parallelise.
"""

from __future__ import annotations

import dataclasses
import json
from typing import Any

from app.cascade import publish, topology
from app.nvdm_io import merge_envelope
from app.cascade.districts import (
    CASCADE_OUTPUT_DIR,
    DistrictCascadeConfig,
)


# Sweep value sets. Each is (parameter_name, default_value, list_of_values).
# Defaults match the DistrictCascadeConfig / topology module defaults.
SWEEP_MAX_DOWNSTREAM_DISTANCE_KM = (
    "max_downstream_distance_km",
    3.0,
    [1.5, 2.0, 3.0, 4.0, 5.0],
)
SWEEP_CONE_HALFANGLE_DEG = (
    "cone_halfangle_deg",
    67.5,
    [22.5, 45.0, 67.5, 90.0],
)
SWEEP_MIN_TANK_AREA_HA = (
    "min_tank_area_ha",
    1.0,
    [1.0, 2.0, 5.0, 10.0],  # below 1.0 not testable; we don't have data
)
SWEEP_MAX_RIVER_OUTLET_DISTANCE_KM = (
    "max_river_outlet_distance_km",
    2.0,
    [1.0, 2.0, 3.0],
)


def _reconstruct_polygons_from_nodes(
    district: DistrictCascadeConfig,
    nodes: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Build pseudo-polygons + parallel elevation/flow lists from the
    already-published cascade-nodes GeoJSON.

    Each node feature already carries osm_id, name, area_ha,
    water_type, elevation_m, and flow_direction_d8 in its
    `properties`. We synthesise a single-point "polygon" for it (a
    tiny square around the published centroid coordinate) so the
    builder's centroid extraction returns the same lat/lon.

    Returns three parallel lists: polygons, elevations, flow_directions.
    """
    polygons: list[dict[str, Any]] = []
    elevations: list[float | None] = []
    flow_directions: list[int | None] = []

    half = 0.0001  # very small square; centroid stays correct
    for node in nodes:
        props = node.get("properties") or {}
        try:
            osm_id = int(props.get("osm_id"))
        except (TypeError, ValueError):
            continue
        geometry = node.get("geometry") or {}
        if geometry.get("type") != "Point":
            continue
        coords = geometry.get("coordinates") or []
        if len(coords) < 2:
            continue
        lon, lat = float(coords[0]), float(coords[1])
        area_ha = float(props.get("area_ha") or 0.0)

        polygons.append(
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [
                        [
                            [lon - half, lat - half],
                            [lon + half, lat - half],
                            [lon + half, lat + half],
                            [lon - half, lat + half],
                            [lon - half, lat - half],
                        ]
                    ],
                },
                "properties": {
                    "osm_id": osm_id,
                    "name": props.get("name") or "",
                    "name_ta": props.get("name_ta") or "",
                    "area_ha": area_ha,
                    "water_type": props.get("water_type") or "",
                },
            }
        )
        elev = props.get("elevation_m")
        elevations.append(None if elev is None else float(elev))
        flow = props.get("flow_direction_d8")
        try:
            flow_directions.append(None if flow is None else int(flow))
        except (TypeError, ValueError):
            flow_directions.append(None)

    return polygons, elevations, flow_directions  # type: ignore[return-value]


def _summarise_graph(graph: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    nodes = graph["nodes"]
    edges = graph["edges"]
    river_outlets = graph.get("river_outlets", [])

    max_depth = 0
    isolated_count = 0
    confidence_counts = {"high": 0, "medium": 0, "low": 0}
    for n in nodes:
        p = n.get("properties") or {}
        try:
            depth = int(p.get("cascade_position") or 0)
        except (TypeError, ValueError):
            depth = 0
        if depth > max_depth:
            max_depth = depth
        if (
            int(p.get("degree_in") or 0) == 0
            and int(p.get("degree_out") or 0) == 0
            and not p.get("drains_to_river")
        ):
            isolated_count += 1
    for e in edges:
        p = e.get("properties") or {}
        c = str(p.get("confidence") or "").lower()
        if c in confidence_counts:
            confidence_counts[c] += 1

    return {
        "node_count": len(nodes),
        "edge_count": len(edges),
        "river_outlet_count": len(river_outlets),
        "isolated_count": isolated_count,
        "max_cascade_depth": max_depth,
        "edge_confidence_counts": confidence_counts,
    }


def _sweep_one_parameter(
    parameter_name: str,
    values: list[float],
    *,
    base_district: DistrictCascadeConfig,
    polygons: list[dict[str, Any]],
    elevations: list[float | None],
    flow_directions: list[int | None],
    river_segments: list[Any],
) -> list[dict[str, Any]]:
    results: list[dict[str, Any]] = []
    for value in values:
        # min_tank_area_ha below the published default cannot be tested
        # because we have no elevation/flow sample for sub-default
        # polygons; skip with a note.
        if (
            parameter_name == "min_tank_area_ha"
            and value < base_district.min_tank_area_ha
        ):
            results.append(
                {
                    "value": value,
                    "skipped": True,
                    "note": (
                        "values below the default min_tank_area_ha cannot be "
                        "tested without re-running GEE on additional polygons"
                    ),
                }
            )
            continue

        if parameter_name == "cone_halfangle_deg":
            original_cone = topology.FLOW_DIRECTION_CONE_HALFANGLE_DEG
            topology.FLOW_DIRECTION_CONE_HALFANGLE_DEG = float(value)
            try:
                graph = topology._build_graph_from_polygons_with_elevations(
                    polygons=polygons,
                    elevations=elevations,
                    district=base_district,
                    flow_directions=flow_directions,
                    river_segments=river_segments,
                )
            finally:
                topology.FLOW_DIRECTION_CONE_HALFANGLE_DEG = original_cone
        elif parameter_name == "min_tank_area_ha":
            mod_district = dataclasses.replace(
                base_district, min_tank_area_ha=float(value)
            )
            # Filter the polygon set + parallel elevations/flow_directions
            # to honour the new min-area threshold.
            kept_polygons: list[dict[str, Any]] = []
            kept_elevations: list[float | None] = []
            kept_flows: list[int | None] = []
            for p, e, f in zip(polygons, elevations, flow_directions, strict=True):
                area = float((p.get("properties") or {}).get("area_ha") or 0.0)
                if area >= float(value):
                    kept_polygons.append(p)
                    kept_elevations.append(e)
                    kept_flows.append(f)
            graph = topology._build_graph_from_polygons_with_elevations(
                polygons=kept_polygons,
                elevations=kept_elevations,
                district=mod_district,
                flow_directions=kept_flows,
                river_segments=river_segments,
            )
        else:
            kwargs = {parameter_name: float(value)}
            mod_district = dataclasses.replace(base_district, **kwargs)
            graph = topology._build_graph_from_polygons_with_elevations(
                polygons=polygons,
                elevations=elevations,
                district=mod_district,
                flow_directions=flow_directions,
                river_segments=river_segments,
            )

        summary = _summarise_graph(graph)
        results.append({"value": value, "skipped": False, **summary})

    return results


def run_sensitivity_analysis(
    district: DistrictCascadeConfig,
) -> dict[str, Any]:
    """Sweep all four parameters, summarise each result, write
    `{district}-cascade-sensitivity.json`.

    Returns the payload that was written.
    """
    publish._ensure_dirs()
    nodes = publish._load_feature_collection(district.cascade_nodes_geojson_path())
    polygons, elevations, flow_directions = _reconstruct_polygons_from_nodes(
        district, nodes
    )
    river_segments = topology._load_river_segments(district)

    sweeps: list[dict[str, Any]] = []
    for parameter_name, default, values in (
        SWEEP_MAX_DOWNSTREAM_DISTANCE_KM,
        SWEEP_CONE_HALFANGLE_DEG,
        SWEEP_MIN_TANK_AREA_HA,
        SWEEP_MAX_RIVER_OUTLET_DISTANCE_KM,
    ):
        results = _sweep_one_parameter(
            parameter_name,
            values,
            base_district=district,
            polygons=polygons,
            elevations=elevations,
            flow_directions=flow_directions,
            river_segments=river_segments,
        )
        sweeps.append(
            {
                "parameter": parameter_name,
                "default": default,
                "values": values,
                "results": results,
            }
        )

    payload: dict[str, Any] = {
        "district_id": district.district_id,
        "label": district.label,
        "_meta": publish._build_meta(district),
        "sweeps": sweeps,
    }

    out_path = CASCADE_OUTPUT_DIR / f"{district.district_id}-cascade-sensitivity.json"
    out_path.write_text(
        json.dumps(merge_envelope(out_path, payload), indent=2, ensure_ascii=False)
        + "\n",
        encoding="utf-8",
    )
    return payload
