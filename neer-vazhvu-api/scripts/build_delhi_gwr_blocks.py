"""Build Delhi's CGWB groundwater-assessment layer from NON-blocked sources.

The WRIS ArcGIS polygon service is NICNET-gated, but everything needed is
publicly downloadable:
  - Assessment VALUES: CGWB Dynamic GWR national compilations, Delhi cuts
    hosted by OpenCity (2025 district-wise CSV + 2022 CSV for history).
  - Assessment-unit POLYGONS: the 2025 assessment reports Delhi by
    DISTRICT; Delhi Districts Map KML hosted by OpenCity.

Outputs (the shapes CityGroundwaterClient already consumes):
  - public/geojson/delhi-gwr-blocks.geojson  (props: block/class/sgw_dev_pe/na_gwa/agwd_tot)
  - public/data/gwr-blocks-delhi.json        ({name, history:[{year,class,development_pct,availability_ham,draft_total_ham}]})

Notes:
  - 'Nazul Land' is a non-spatial assessment row (government estate lands
    across districts) - carried in the data file, absent from the map, and
    noted so the map legend can say so.
  - CSV headers say '(bcm)' but values are hectare-metres (the file's own
    Total(Ham) row confirms); recorded as ham.
  - Classification per CGWB bands: >100 Over Exploited, 90-100 Critical,
    70-90 Semi-Critical, <=70 Safe.

Run: python scripts/build_delhi_gwr_blocks.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import urllib.request
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

CSV_2025 = "https://data.opencity.in/dataset/3e28a58b-22d4-4f6a-89ac-9738693eb745/resource/8e39cc66-06a4-417b-8a4f-dbd4a9495ed6/download"
CSV_2022 = "https://data.opencity.in/dataset/80115826-a49b-45fc-8050-92b275e153aa/resource/feb08d82-1bed-4e20-9101-afe253154233/download"
KML_DISTRICTS = "https://data.opencity.in/dataset/2ae48270-ab28-4786-abf1-e36a00f0c761/resource/323dac5c-5783-4241-8e86-84e4a2b88b98/download/e55976b2-ff45-4133-827b-b993fde9e271.kml"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "neer-vazhvu/delhi-onboarding"})
    return urllib.request.urlopen(req, timeout=120).read()


def classify(stage: float) -> str:
    if stage > 100:
        return "Over Exploited"
    if stage > 90:
        return "Critical"
    if stage > 70:
        return "Semi Critical"
    return "Safe"


def norm(name: str) -> str:
    n = re.sub(r"[^a-z]", "", name.lower())
    # The OpenCity districts KML spells Shahdara as SHAHADRA.
    return {"shahadra": "shahdara"}.get(n, n)


def parse_assessment(raw: bytes, year: int, fields: dict[str, str]) -> dict[str, dict]:
    out: dict[str, dict] = {}
    for row in csv.DictReader(io.StringIO(raw.decode("utf-8-sig"))):
        name = (row.get(fields["name"]) or "").strip()
        if not name or name.lower().startswith("total"):
            continue
        try:
            stage = float(row[fields["stage"]])
            avail = float(row[fields["avail"]])
            draft = float(row[fields["draft"]])
        except (KeyError, ValueError):
            continue
        out[norm(name)] = {
            "year": year,
            "name": name,
            "class": classify(stage),
            "development_pct": round(stage, 2),
            "availability_ham": round(avail, 2),
            "draft_total_ham": round(draft, 2),
        }
    return out


def parse_kml_districts(kml: str) -> list[dict]:
    feats = []
    for pm in re.findall(r"<Placemark>[\s\S]*?</Placemark>", kml):
        props = dict(re.findall(r'<SimpleData name="([^"]+)">([\s\S]*?)</SimpleData>', pm))
        name = None
        for k, v in props.items():
            if "dist" in k.lower() or k.lower() in ("name", "district"):
                name = v.strip()
                break
        if not name:
            m = re.search(r"<name>([^<]+)</name>", pm)
            name = m.group(1).strip() if m else None
        if not name:
            continue
        polys = []
        for poly_block in re.findall(r"<Polygon>[\s\S]*?</Polygon>", pm):
            outer = re.search(r"<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)</coordinates>", poly_block)
            if not outer:
                continue
            ring = []
            for token in outer.group(1).split():
                parts = token.split(",")
                if len(parts) >= 2:
                    ring.append([round(float(parts[0]), 6), round(float(parts[1]), 6)])
            if len(ring) >= 4:
                polys.append([ring])
        if not polys:
            continue
        geometry = (
            {"type": "Polygon", "coordinates": polys[0]}
            if len(polys) == 1
            else {"type": "MultiPolygon", "coordinates": polys}
        )
        feats.append({"name": name, "geometry": geometry})
    return feats


def main() -> None:
    a2025 = parse_assessment(
        fetch(CSV_2025), 2025,
        {"name": "Name of District", "stage": "Stage of GW extraction (%)",
         "avail": "Annual Extractable Groundwater Resource", "draft": "Total Annual Extraction"},
    )
    raw22 = fetch(CSV_2022).decode("utf-8-sig")
    hdr = next(csv.reader(io.StringIO(raw22)))
    def col(sub: str) -> str:
        for h in hdr:
            if sub.lower() in h.lower():
                return h
        raise KeyError(sub)
    a2022 = parse_assessment(
        raw22.encode(), 2022,
        {"name": hdr[1], "stage": col("stage"), "avail": col("extractable"), "draft": col("total") if "extraction" in col("total").lower() else col("total annual")},
    )
    print(f"2025 units: {len(a2025)} | 2022 units: {len(a2022)}")

    districts = parse_kml_districts(fetch(KML_DISTRICTS).decode("utf-8", errors="ignore"))
    print(f"district polygons: {len(districts)}: {[d['name'] for d in districts]}")

    features = []
    matched = set()
    for d in districts:
        key = norm(d["name"])
        rec = a2025.get(key)
        if rec is None:
            # KML may spell e.g. "North West Delhi" - try containment both ways.
            for k, v in a2025.items():
                if k in key or key in k:
                    rec = v
                    key = k
                    break
        if rec is None:
            print(f"  UNMATCHED polygon: {d['name']}")
            continue
        matched.add(key)
        features.append({
            "type": "Feature",
            "geometry": d["geometry"],
            "properties": {
                "block": rec["name"],
                "class": rec["class"],
                "sgw_dev_pe": rec["development_pct"],
                "na_gwa": rec["availability_ham"],
                "agwd_tot": rec["draft_total_ham"],
            },
        })

    unmatched_rows = [v["name"] for k, v in a2025.items() if k not in matched]
    geo = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "CGWB Dynamic Ground Water Resources 2025, Delhi district table (values) + Delhi Districts Map (polygons), both via OpenCity",
            "assessment_year": 2025,
            "non_spatial_units": unmatched_rows,
            "note": "Assessment values are hectare-metres (the CSV's bcm header is mislabeled - its own Total(Ham) row confirms). 'Nazul Land' is a non-spatial assessment unit and appears only in the data file.",
            "built": date.today().isoformat(),
            "script": "neer-vazhvu-api/scripts/build_delhi_gwr_blocks.py",
        },
        "features": features,
    }
    (REPO / "public/geojson/delhi-gwr-blocks.geojson").write_text(json.dumps(geo, separators=(",", ":")))

    blocks = []
    for k, rec in sorted(a2025.items(), key=lambda kv: kv[1]["name"]):
        history = []
        if k in a2022:
            h = a2022[k]
            history.append({"year": 2022, "class": h["class"], "development_pct": h["development_pct"],
                            "availability_ham": h["availability_ham"], "draft_total_ham": h["draft_total_ham"]})
        history.append({"year": 2025, "class": rec["class"], "development_pct": rec["development_pct"],
                        "availability_ham": rec["availability_ham"], "draft_total_ham": rec["draft_total_ham"]})
        # ward-map.tsx consumes {blocks:[{name, history, latest}]} - latest
        # precomputed, class labels spaced ("Semi Critical").
        blocks.append({"name": rec["name"], "history": history,
                       "latest": {kk: history[-1][kk] for kk in ("class", "development_pct", "availability_ham", "draft_total_ham")}})
    payload = {
        "source": "CGWB Dynamic Ground Water Resources - Delhi district assessments 2022 + 2025 (via OpenCity national-compilation datasets)",
        "source_url": "https://data.opencity.in/dataset/national-compilation-of-dynamic-ground-water-resources-of-india-2025",
        "place_id": "delhi",
        "fetched_at": date.today().isoformat(),
        "years": [2022, 2025],
        "note": "'Nazul Land' is a non-spatial assessment unit (government estate lands) - in this file but not on the map. Values in hectare-metres.",
        "blocks": blocks,
    }
    (REPO / "public/data/gwr-blocks-delhi.json").write_text(json.dumps(payload, indent=1))
    data = blocks

    oe = [f["properties"]["block"] for f in features if f["properties"]["class"] == "Over Exploited"]
    print(f"wrote {len(features)} polygons + {len(data)} data units | Over Exploited: {oe}")


if __name__ == "__main__":
    main()
