"""Build Hyderabad's CGWB groundwater-assessment layer from non-blocked sources.

Same shape as Delhi's builder and the same reasoning: the WRIS ArcGIS polygon
service is NICNET-gated, but the assessment VALUES and the assessment-unit
POLYGONS are both publicly downloadable from OpenCity mirrors of the CGWB
national compilations.

  - VALUES:   CGWB Dynamic Ground Water Resources national compilations,
              Telangana district-wise CSV cuts (2022, 2024, 2025).
  - POLYGONS: "Telangana Districts Map" KML, same OpenCity dataset Delhi used
              for its district polygons.

Telangana assesses by DISTRICT in all three editions, so the series joins
cleanly - no repeat of the Madurai firka-to-block unit change or Delhi's
tehsil-to-district shift.

TWO SOURCE QUIRKS, both verified 2026-07-26
-------------------------------------------
1. **The 2025 Telangana cut is mislabelled on OpenCity as "Tamil Nadu - State
   of GW Extraction".** Its filename is `tg_gw_2025.csv` (TG = Telangana,
   TN = Tamil Nadu) and its first districts are Adilabad and Bhadradri
   Kothagudem, which are Telangana. We use it as Telangana and assert the
   district set matches the 2024 and 2022 cuts, so a genuine Tamil Nadu file
   appearing at that URL later would fail the build rather than silently
   publish the wrong state.
2. **Units.** The 2025 header says "(bcm)" but the district values are
   hectare-metres - the file's own total row reads "Total(Bcm) 7.34" against
   district values in the tens of thousands. Recorded as ham, exactly as
   Delhi's builder documents.

Classification per CGWB bands: >100 Over-Exploited, 90-100 Critical,
70-90 Semi-Critical, <=70 Safe.

Outputs (the shapes CityGroundwaterClient already consumes):
  - public/geojson/hyderabad-gwr-blocks.geojson
  - public/data/gwr-blocks-hyderabad.json

Run: python scripts/build_hyderabad_gwr_blocks.py
"""

from __future__ import annotations

import csv
import io
import json
import re
import sys
import urllib.request
import xml.etree.ElementTree as ET
from datetime import date
from pathlib import Path

REPO = Path(__file__).resolve().parents[2]

# NOTE on CSV_2025: labelled "Tamil Nadu" on OpenCity, but it is Telangana.
# See quirk 1 in the module docstring; the build asserts the district set.
CSV_2025 = "https://data.opencity.in/dataset/3e28a58b-22d4-4f6a-89ac-9738693eb745/resource/8000309b-59d7-4b5e-aeb1-befaaab9c0f8/download/tg_gw_2025.csv"
CSV_2024 = "https://data.opencity.in/dataset/0e2e0a1c-649c-4139-a6ed-a251f7ffca85/resource/b69fbc07-5d1c-4f73-9394-7252c65f9300/download/490caf70-d1ea-482b-9fae-f525cf6aedc0.csv"
CSV_2022 = "https://data.opencity.in/dataset/80115826-a49b-45fc-8050-92b275e153aa/resource/fb1eb432-28fc-43ac-a03d-11fecd8a5939/download/e0fcd147-a19d-4329-806e-f29679093cb0.csv"
KML_DISTRICTS = "https://data.opencity.in/dataset/2ae48270-ab28-4786-abf1-e36a00f0c761/resource/6427c711-1618-4672-bb98-79a76bce47b9/download/60b75813-e07f-46a7-a36f-80769f4432c2.kml"

EDITIONS = [(2025, CSV_2025), (2024, CSV_2024), (2022, CSV_2022)]

# Column positions in the district rows (all three editions share the layout).
COL_DISTRICT = 1
COL_AVAILABILITY = 8   # Annual Extractable Groundwater Resource (ham)
COL_EXTRACTION = 12    # Total Annual Extraction (ham)
COL_STAGE = 15         # Stage of GW extraction (%)

# Districts that make up the Hyderabad metropolitan footprint. The Core Urban
# Region sits inside Hyderabad + Rangareddy + Medchal-Malkajgiri + Sangareddy;
# Medak, Siddipet and Vikarabad are the wider HMDA ring, kept for context the
# way Bangalore keeps its Rural blocks.
METRO_DISTRICTS = {
    "hyderabad",
    "rangareddy",
    "ranga reddy",
    "medchal malkajgiri",
    "medchal-malkajgiri",
    "sangareddy",
    "medak",
    "siddipet",
    "vikarabad",
}

KML_NS = "{http://www.opengis.net/kml/2.2}"


def fetch(url: str) -> bytes:
    req = urllib.request.Request(url, headers={"User-Agent": "neer-vazhvu/hyderabad-onboarding"})
    return urllib.request.urlopen(req, timeout=180).read()


def norm(name: str) -> str:
    """Normalise a district name for joining across editions and the KML."""
    s = (name or "").strip().lower()
    s = s.replace("&", "and")
    s = re.sub(r"[^a-z]+", " ", s).strip()
    # The CSVs and the KML disagree on spacing/hyphens for these.
    s = s.replace(" ", "")
    # The CSVs and the KML disagree on spelling for several districts, and the
    # KML additionally splits Warangal into RURAL and URBAN where the CSV has a
    # single Warangal (post-2021 Telangana renamed Warangal Urban to
    # Hanumakonda). Mapped explicitly so the join is auditable rather than
    # fuzzy - a fuzzy matcher here could silently pair the wrong district.
    aliases = {
        "rangareddy": "rangareddy",
        "medchalmalkajgiri": "medchalmalkajgiri",
        "yadadribhuvanagiri": "yadadribhuvanagiri",
        # CSV spelling            -> KML spelling
        "jayashankarbhupalpally": "jayashankarbhupalapally",
        "komarambheemasifabad": "kumurambheem",
        "kumurambheemasifabad": "kumurambheem",
        "mulug": "mulugu",
        "peddapalle": "peddapalli",
        "rajannasiricilla": "ranjannasircilla",
        "rajannasircilla": "ranjannasircilla",
        # Hanumakonda was carved out of Warangal Urban; the KML predates the
        # rename and still carries WARANGAL (URBAN).
        "hanumakonda": "warangalurban",
        "warangal": "warangalrural",
    }
    return aliases.get(s, s)


def classify(stage: float | None) -> str:
    if stage is None:
        return "Unknown"
    if stage > 100:
        return "Over Exploited"
    if stage >= 90:
        return "Critical"
    if stage >= 70:
        return "Semi Critical"
    return "Safe"


def _num(v):
    try:
        return float(str(v).replace(",", "").strip())
    except (TypeError, ValueError):
        return None


def parse_edition(raw: bytes) -> dict:
    rows = list(csv.reader(io.StringIO(raw.decode("utf-8-sig", "ignore"))))
    out = {}
    for r in rows[1:]:
        if len(r) <= COL_STAGE:
            continue
        name = (r[COL_DISTRICT] or "").strip()
        if not name or name.lower().startswith("total"):
            continue
        out[norm(name)] = {
            "display": name,
            "availability_ham": _num(r[COL_AVAILABILITY]),
            "extraction_ham": _num(r[COL_EXTRACTION]),
            "stage_pct": _num(r[COL_STAGE]),
        }
    return out


def parse_district_kml(raw: bytes) -> dict:
    root = ET.fromstring(raw)
    polys = {}
    for pm in root.iter(f"{KML_NS}Placemark"):
        props = {sd.get("name"): (sd.text or "").strip() for sd in pm.iter(f"{KML_NS}SimpleData")}
        nm = props.get("district") or props.get("DISTRICT") or props.get("Name") or ""
        if not nm:
            n = pm.find(f"{KML_NS}name")
            nm = (n.text or "").strip() if n is not None else ""
        if not nm:
            continue
        rings = []
        for pg in pm.iter(f"{KML_NS}Polygon"):
            ob = pg.find(f".//{KML_NS}outerBoundaryIs//{KML_NS}coordinates")
            if ob is None or not ob.text:
                continue
            pts = []
            for tok in ob.text.split():
                p = tok.split(",")
                if len(p) >= 2:
                    try:
                        pts.append([round(float(p[0]), 5), round(float(p[1]), 5)])
                    except ValueError:
                        continue
            if len(pts) >= 4:
                rings.append([pts])
        if not rings:
            continue
        geom = (
            {"type": "Polygon", "coordinates": rings[0]}
            if len(rings) == 1
            else {"type": "MultiPolygon", "coordinates": rings}
        )
        polys[norm(nm)] = {"display": nm, "geometry": geom}
    return polys


def main() -> int:
    editions = {}
    for year, url in EDITIONS:
        editions[year] = parse_edition(fetch(url))
        print(f"  {year}: {len(editions[year])} districts", file=sys.stderr)

    # Guard against the mislabelled-resource risk (quirk 1). If the "Tamil Nadu"
    # labelled 2025 file is ever replaced with an actual Tamil Nadu cut, the
    # district sets will diverge and this fails loudly instead of publishing
    # the wrong state's groundwater as Hyderabad's.
    base = set(editions[2024])
    overlap = len(base & set(editions[2025])) / max(1, len(base))
    if overlap < 0.8:
        print(
            f"ABORT: the 2025 cut shares only {overlap:.0%} of its districts with 2024. "
            "The OpenCity resource labelled 'Tamil Nadu' may no longer be the Telangana file.",
            file=sys.stderr,
        )
        return 1
    print(f"  district-set overlap 2025 vs 2024: {overlap:.0%} (guard passed)", file=sys.stderr)

    polys = parse_district_kml(fetch(KML_DISTRICTS))
    print(f"  KML: {len(polys)} district polygons", file=sys.stderr)

    names = sorted(set().union(*[set(e) for e in editions.values()]))
    records, features, unmatched = [], [], []
    for key in names:
        hist = []
        display = None
        for year in sorted(editions, reverse=True):
            e = editions[year].get(key)
            if not e:
                continue
            display = display or e["display"]
            hist.append(
                {
                    "year": year,
                    "class": classify(e["stage_pct"]),
                    "development_pct": e["stage_pct"],
                    "availability_ham": e["availability_ham"],
                    "draft_total_ham": e["extraction_ham"],
                }
            )
        if not hist:
            continue
        is_metro = key in {norm(x) for x in METRO_DISTRICTS}
        records.append({"name": display, "metro": is_metro, "history": hist})
        poly = polys.get(key)
        if poly:
            latest = hist[0]
            features.append(
                {
                    "type": "Feature",
                    "geometry": poly["geometry"],
                    "properties": {
                        "block": display,
                        "class": latest["class"],
                        "sgw_dev_pe": latest["development_pct"],
                        "na_gwa": latest["availability_ham"],
                        "agwd_tot": latest["draft_total_ham"],
                        "metro": is_metro,
                    },
                }
            )
        else:
            unmatched.append(display)

    meta_note = (
        "CGWB Dynamic Ground Water Resources, Telangana district-wise cuts of the "
        "national compilations (2022, 2024, 2025), joined to the Telangana Districts "
        "Map KML. Telangana assesses by DISTRICT in all three editions, so the series "
        "joins cleanly. Values are hectare-metres despite the 2025 header saying "
        "'(bcm)' - the file's own total row reads Total(Bcm) 7.34 against district "
        "values in the tens of thousands. NOTE the 2025 resource is MISLABELLED on "
        "OpenCity as 'Tamil Nadu - State of GW Extraction'; its filename is "
        "tg_gw_2025.csv and its districts are Telangana's. The build asserts the "
        "district set against 2024 so a genuine Tamil Nadu file would fail rather "
        "than publish silently."
    )

    (REPO / "public/data/gwr-blocks-hyderabad.json").write_text(
        json.dumps(
            {
                "place_id": "hyderabad",
                "generated_at": date.today().isoformat(),
                "unit_label": "district",
                "source_label": "CGWB Dynamic Ground Water Resources (2022, 2024, 2025) via OpenCity",
                "source_url": "https://data.opencity.in/dataset/national-compilation-of-dynamic-ground-water-resources-of-india-2025",
                "note": meta_note,
                "blocks": records,
            },
            ensure_ascii=False,
            indent=1,
        ),
        encoding="utf-8",
    )
    (REPO / "public/geojson/hyderabad-gwr-blocks.geojson").write_text(
        json.dumps(
            {
                "type": "FeatureCollection",
                "_source": "CGWB Dynamic GWR district assessments via OpenCity",
                "_note": meta_note,
                "features": features,
            },
            ensure_ascii=False,
        ),
        encoding="utf-8",
    )

    metro = [r for r in records if r["metro"]]
    print(
        f"\nwrote {len(records)} districts ({len(features)} with polygons, "
        f"{len(unmatched)} unmatched)",
        file=sys.stderr,
    )
    if unmatched:
        print(f"  unmatched (no polygon): {', '.join(unmatched[:8])}", file=sys.stderr)
    print("\nHyderabad metro districts, latest edition:", file=sys.stderr)
    for r in sorted(metro, key=lambda x: -(x["history"][0]["development_pct"] or 0)):
        h = r["history"][0]
        trend = ""
        if len(r["history"]) > 1 and h["development_pct"] and r["history"][-1]["development_pct"]:
            d = h["development_pct"] - r["history"][-1]["development_pct"]
            trend = f"  ({d:+.1f} pts since {r['history'][-1]['year']})"
        print(
            f"   {r['name']:<22}{h['development_pct']:>7.2f}%  {h['class']:<15}{trend}",
            file=sys.stderr,
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
