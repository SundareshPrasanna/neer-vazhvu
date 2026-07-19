#!/usr/bin/env python3
"""Build wq-stations.geojson + scoreboard WQ metrics for cauvery-tn from
TNPCB's stretch-wise monthly water-quality reports (2023 - the last year
TNPCB published; the series is a CLOSED archive and the UI says so).

Post-ingest step, like build_basin_wq_readings.py for cauvery-ka: re-running
scripts/ingest_basin_overview.py regenerates scoreboard.json and wipes these
metrics - re-run this script (and build_basin_prs_points.py) afterwards.

Reads config scripts/basin-sources/cauvery-tn-wq.json; the PDFs live in the
gitignored docs/research/ tree (outputs are committed, sources are not).
Class letters (DBU use-based class, A best - E worst) are parsed per station
row per monthly page; worst + latest are derived, never hand-entered.

Usage: python3 scripts/build_cauvery_tn_wq.py
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CFG = ROOT / "scripts" / "basin-sources" / "cauvery-tn-wq.json"

MONTH_RE = re.compile(r"([A-Z][a-z][a-z])-2[0-9]")
MONTH_ORDER = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


def point_in_geom(lon, lat, geom):
    def in_ring(ring):
        inside = False
        n = len(ring)
        for i in range(n):
            x1, y1 = ring[i][0], ring[i][1]
            x2, y2 = ring[(i + 1) % n][0], ring[(i + 1) % n][1]
            if (y1 > lat) != (y2 > lat) and lon < (x2 - x1) * (lat - y1) / (y2 - y1) + x1:
                inside = not inside
        return inside

    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    return any(in_ring(p[0]) and not any(in_ring(h) for h in p[1:]) for p in polys)


def classes_on_line(line: str, code: str, pdf_name: str) -> list[str]:
    """Single-letter A-E tokens strictly AFTER the station-code token.
    Code-token matching only: name matching is too loose ("Bhavani" appears
    inside Bhavanisagar's rows and in page headers)."""
    toks = line.split()
    if code not in toks:
        return []
    start = toks.index(code) + 1
    # the code sits right after row-number + station-name tokens; short codes
    # ("31", "50") also occur later as data values - reject those matches
    if start > 6:
        return []
    return [t for t in toks[start:] if t in ("A", "B", "C", "D", "E")]


def main():
    from pypdf import PdfReader

    cfg = json.loads(CFG.read_text())
    basin_dir = ROOT / "public" / "data" / "basins" / cfg["basinId"]
    pdf_dir = ROOT / cfg["pdfDir"]
    sub_basins = json.loads((basin_dir / "sub-basins.geojson").read_text())

    # page texts per pdf, with the months each page carries (for latest-class)
    pages_by_pdf: dict[str, list[tuple[list[str], list[str]]]] = {}
    for key, fname in cfg["pdfs"].items():
        path = pdf_dir / fname
        if not path.exists():
            sys.exit(f"missing source PDF: {path} (docs/research is local-only; fetch it first)")
        out = []
        for page in PdfReader(str(path)).pages:
            text = page.extract_text() or ""
            out.append((MONTH_RE.findall(text), text.split("\n")))
        pages_by_pdf[key] = out

    features = []
    worst_by_sub: dict[str, str] = {}
    count_by_sub: dict[str, int] = {}
    for st in cfg["stations"]:
        # collect (month_rank, classes) so "latest" follows the calendar, not page order
        monthly: list[tuple[int, str]] = []
        all_classes: list[str] = []
        for months, lines in pages_by_pdf[st["pdf"]]:
            ranks = sorted(MONTH_ORDER.index(m) for m in set(months) if m in MONTH_ORDER)
            for line in lines:
                cls = classes_on_line(line, st["code"], st["pdfName"])
                if cls:
                    all_classes.extend(cls)
                    # page-local class order matches its month columns loosely;
                    # tie latest to the page's max month
                    if ranks:
                        monthly.append((max(ranks), cls[-1]))
        if not all_classes:
            sys.exit(f"no class letters parsed for station {st['code']} ({st['name']}) - check the PDF row match")
        worst = max(all_classes)  # A < B < ... < E lexically
        latest = max(monthly)[1] if monthly else worst

        hits = [f["properties"]["code"] for f in sub_basins["features"]
                if point_in_geom(st["lon"], st["lat"], f["geometry"])]
        if len(hits) != 1:
            sys.exit(f"station {st['name']} ({st['lon']},{st['lat']}) PIP -> {hits}; fix coords before shipping")
        sub = hits[0]
        count_by_sub[sub] = count_by_sub.get(sub, 0) + 1
        if worst > worst_by_sub.get(sub, ""):
            worst_by_sub[sub] = worst

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [st["lon"], st["lat"]]},
            "properties": {
                "name": st["name"],
                "river": st["river"],
                "stationCode": st["code"],
                "subBasin": sub,
                "worstClass": worst,
                "latestClass": latest,
                "monthsParsed": len(all_classes),
                "readingsPeriod": cfg["readingsPeriod"],
                "agency": cfg["agency"],
                "locationBasis": "town centroid (OSM Nominatim)",
            },
        })

    out = basin_dir / "wq-stations.geojson"
    out.write_text(json.dumps({"type": "FeatureCollection", "features": features}, ensure_ascii=False))
    print(f"wrote {out.relative_to(ROOT)}: {len(features)} stations")
    for sub in sorted(count_by_sub):
        print(f"  sub {sub}: {count_by_sub[sub]} stations, worst {worst_by_sub[sub]}")

    # scoreboard metrics (post-step: survives until the next ingest re-run)
    sb_path = basin_dir / "scoreboard.json"
    sb = json.loads(sb_path.read_text())
    for sub, entry in sb["subBasins"].items():
        if sub in count_by_sub:
            entry["metrics"]["wqStationCount"] = {
                "value": count_by_sub[sub], "unit": "count", "asOf": "2023-12",
                "source": cfg["source"], "verified": True,
            }
            entry["metrics"]["wqWorstClass"] = {
                "value": worst_by_sub[sub], "unit": "DBU class (A best - E worst)", "asOf": "2023-12",
                "source": cfg["source"] + " - worst monthly use-based class, Jan-Dec 2023 (last published year)",
                "verified": True,
            }
    sb_path.write_text(json.dumps(sb, ensure_ascii=False, indent=1))
    print(f"updated {sb_path.relative_to(ROOT)}")

    # inventory entry
    inv_path = basin_dir / "inventory.json"
    inv = json.loads(inv_path.read_text())
    inv["families"]["wq-stations"] = {
        "featureCount": len(features),
        "bytes": out.stat().st_size,
        "sources": [{
            "file": "wq-stations.geojson", "kind": None, "count": len(features),
            "provenance": cfg["source"] + ". " + cfg["locationNote"] + " " + cfg["seriesNote"],
        }],
    }
    inv_path.write_text(json.dumps(inv, ensure_ascii=False, indent=1))
    print(f"updated {inv_path.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
