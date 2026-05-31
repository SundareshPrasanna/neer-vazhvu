"""Compute documented water bodies surrounding each Chennai data centre.

Inputs:
    public/data/gee-phase1-water-body-targets.json (Chennai water bodies; centroid coordinates)
    docs/deliverables/2026-05-25-chennai-dc-water-data.csv

Output:
    docs/deliverables/2026-05-25-chennai-dc-water-data-v2.csv
        adds columns: nearest_named_water_bodies (top 3 within 8 km, "; " separated),
                      nearest_named_distance_km (km to closest named body)
    stdout: markdown table for the brief, one row per DC, listing surrounding
            water bodies within radius bands.

Method:
    Haversine distance from each DC lat/lng to every named water body centroid.
    Reports the named bodies whose centroid is within 8 km AND ranks the top 3
    nearest of those. If none is within 8 km, reports the single nearest named
    body (with the larger distance shown).

    8 km is a planning-grade radius. It captures water bodies a DC plausibly
    affects (via runoff, drawdown, encroachment) and is plausibly affected by
    (recharge contribution to the same aquifer block). It is not a watershed
    analysis. Body and DC may sit on different sides of a watershed divide
    even within 8 km. Treat as planning-grade not hydrological-grade.
"""

import csv
import json
import math
import os
import sys

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
WATER_BODIES_PATH = os.path.join(REPO, "public", "data", "gee-phase1-water-body-targets.json")
INPUT_CSV = os.path.join(REPO, "docs", "deliverables", "2026-05-25-chennai-dc-water-data.csv")
OUTPUT_CSV = os.path.join(REPO, "docs", "deliverables", "2026-05-25-chennai-dc-water-data-v2.csv")

RADIUS_KM = 8.0
TOP_N = 3


def haversine_km(lat1, lon1, lat2, lon2):
    R = 6371.0
    p1 = math.radians(lat1)
    p2 = math.radians(lat2)
    dp = math.radians(lat2 - lat1)
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(math.sqrt(a))


def surrounding_named_bodies(lat, lng, bodies, radius_km=RADIUS_KM, top_n=TOP_N):
    """Return top-N nearest NAMED bodies within radius_km, sorted by distance.

    If no named body is within radius_km, return the single nearest named body.
    """
    candidates = []
    for b in bodies:
        c = b.get("centroid")
        if not c or len(c) < 2 or c[0] is None or c[1] is None:
            continue
        if not b.get("name"):
            continue
        d = haversine_km(lat, lng, c[0], c[1])
        candidates.append({
            "name": b["name"],
            "distance_km": d,
            "area_ha": b.get("area_ha"),
            "water_type": b.get("water_type"),
            "priority_level": b.get("priority_level"),
        })
    candidates.sort(key=lambda r: r["distance_km"])
    within = [c for c in candidates if c["distance_km"] <= radius_km]
    if within:
        return within[:top_n], False  # in-radius
    return candidates[:1], True  # fallback - single nearest outside radius


def short_body_label(c):
    area = c["area_ha"]
    area_str = f"{area:.0f}ha" if area is not None else "?ha"
    wt = (c["water_type"] or "body")[:8]
    return f"{c['name']} ({wt}, {area_str}, {c['distance_km']:.1f}km)"


def main():
    with open(WATER_BODIES_PATH) as f:
        wb = json.load(f)
    bodies = wb["targets"]
    print(f"Loaded {len(bodies)} water bodies "
          f"({sum(1 for b in bodies if b.get('name'))} named)", file=sys.stderr)

    with open(INPUT_CSV) as f:
        reader = csv.DictReader(f)
        rows = list(reader)
        fieldnames = list(reader.fieldnames)

    new_cols = [
        "nearest_named_water_bodies",
        "nearest_named_distance_km",
    ]
    out_fieldnames = fieldnames + new_cols

    md_lines = [
        "| Facility | Cluster | Surrounding named water bodies (within 8 km) | Closest (km) | Block class 2024 |",
        "|---|---|---|---|---|",
    ]

    for row in rows:
        try:
            lat = float(row["lat"])
            lng = float(row["lng"])
        except (TypeError, ValueError):
            row["nearest_named_water_bodies"] = ""
            row["nearest_named_distance_km"] = ""
            continue

        bodies_near, fallback = surrounding_named_bodies(lat, lng, bodies)
        if not bodies_near:
            row["nearest_named_water_bodies"] = ""
            row["nearest_named_distance_km"] = ""
            continue

        labels = [short_body_label(c) for c in bodies_near]
        if fallback:
            label_str = labels[0] + " (none within 8 km; this is the single nearest named body)"
        else:
            label_str = "; ".join(labels)

        row["nearest_named_water_bodies"] = label_str
        row["nearest_named_distance_km"] = f"{bodies_near[0]['distance_km']:.2f}"

        # Compose brief table row
        bodies_for_md = "; ".join(labels) if not fallback else f"{labels[0]} (none within 8 km)"
        md_lines.append(
            f"| {row['operator']} {row['facility']} | {row['cluster']} | "
            f"{bodies_for_md} | "
            f"{bodies_near[0]['distance_km']:.2f} | {row['block_class_2024']} |"
        )

    with open(OUTPUT_CSV, "w", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=out_fieldnames)
        writer.writeheader()
        writer.writerows(rows)

    print(f"Wrote {OUTPUT_CSV}", file=sys.stderr)
    print("\n".join(md_lines))


if __name__ == "__main__":
    main()
