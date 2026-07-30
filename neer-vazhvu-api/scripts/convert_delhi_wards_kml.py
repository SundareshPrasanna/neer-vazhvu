"""Convert the recovered OpenCity delhi_wards.kml (2022 delimitation, 250
wards) into public/geojson/delhi-wards-2022.geojson with the platform's
normalized ward properties (ward_no / ward_name / ward_label + Delhi
extras: AC mapping and the delimitation-file population columns).

PROVENANCE: original publisher SEC Delhi (Delimitation Order 2022);
digitization OpenCity ("Delhi Wards Information" dataset, delisted ~2025);
file recovered COMPLETE from the owner's local copy on 2026-07-24 and
verified byte-identical to the Internet Archive's (truncated) capture of
the OpenCity download URL over its full 5,242,880 bytes - i.e. the same
origin file, integrity proven. sha256 of the source KML recorded in
docs/cities/delhi/data-sources.md.

The KML carries one Ward_No=0 record (non-ward remainder geometry - NDMC/
Cantonment area outside MCD wards); it is EXCLUDED from the output and
noted, so the file holds exactly 250 ward features.

Run: python scripts/convert_delhi_wards_kml.py /path/to/delhi_wards.kml
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

OUT = REPO / "public/geojson/delhi-wards-2022.geojson"


def parse_coords(blob: str) -> list[list[float]]:
    ring = []
    for token in blob.strip().split():
        parts = token.split(",")
        if len(parts) >= 2:
            ring.append([round(float(parts[0]), 6), round(float(parts[1]), 6)])
    return ring


def main() -> None:
    src = Path(sys.argv[1])
    text = src.read_text(encoding="utf-8", errors="ignore")
    placemarks = re.findall(r"<Placemark>[\s\S]*?</Placemark>", text)
    print(f"{len(placemarks)} placemarks")

    features = []
    skipped = []
    for pm in placemarks:
        props_raw = dict(
            re.findall(r'<SimpleData name="([^"]+)">([\s\S]*?)</SimpleData>', pm)
        )
        ward_no = int(props_raw.get("Ward_No", "-1"))
        if ward_no < 1:
            skipped.append(props_raw.get("WardName") or props_raw.get("FID") or "?")
            continue

        polys = []
        for poly_block in re.findall(r"<Polygon>[\s\S]*?</Polygon>", pm):
            outer = re.search(
                r"<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)</coordinates>",
                poly_block,
            )
            if not outer:
                continue
            rings = [parse_coords(outer.group(1))]
            for inner in re.findall(
                r"<innerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)</coordinates>",
                poly_block,
            ):
                rings.append(parse_coords(inner))
            polys.append(rings)
        if not polys:
            skipped.append(f"ward {ward_no} (no polygon)")
            continue

        geometry = (
            {"type": "Polygon", "coordinates": polys[0]}
            if len(polys) == 1
            else {"type": "MultiPolygon", "coordinates": polys}
        )

        name = (props_raw.get("WardName") or "").strip().title()
        ward = {
            "ward_no": ward_no,
            "ward_name": name,
            "ward_label": f"{ward_no} - {name}",
            "ac_no": int(props_raw["AC_No"])
            if props_raw.get("AC_No", "").isdigit()
            else None,
            "ac_name": (props_raw.get("AC_Name") or "").strip().title() or None,
            "wno_sec": (props_raw.get("WNo_SEC") or "").strip() or None,
            "total_pop": int(props_raw["TotalPop"])
            if props_raw.get("TotalPop", "").isdigit()
            else None,
            "sc_pop": int(props_raw["SC_Pop"])
            if props_raw.get("SC_Pop", "").isdigit()
            else None,
        }
        features.append({"type": "Feature", "geometry": geometry, "properties": ward})

    features.sort(key=lambda f: f["properties"]["ward_no"])
    out = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "SEC Delhi Delimitation Order 2022 (250 wards), digitized by OpenCity (delisted dataset 'Delhi Wards Information')",
            "recovery": "complete local copy, verified byte-identical to the Internet Archive capture of the OpenCity file over its full extent",
            "converted": "neer-vazhvu-api/scripts/convert_delhi_wards_kml.py",
            "excluded": f"{len(skipped)} non-ward record(s): {skipped}",
        },
        "features": features,
    }
    write_artifact(OUT, out, compact=True)
    pops = [f["properties"]["total_pop"] or 0 for f in features]
    print(f"wrote {OUT.name}: {len(features)} wards, skipped {skipped}")
    print(f"population sum: {sum(pops):,} | min ward {min(pops):,} max {max(pops):,}")


if __name__ == "__main__":
    main()
