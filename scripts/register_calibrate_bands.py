#!/usr/bin/env python3
"""Calibration pass for the Restoration Register bands (M0).

Reads every rich-body record already computed on this branch and applies the
register's initial band thresholds to it, so the thresholds are set against bodies
whose condition we know (Bellandur, Jakkur, Vihar, Hesaraghatta, Ulsoor...) rather
than against a blank page. Prints a table and writes the calibration appendix that
ships with the public methodology.

Computed per body, from files that already exist (no Earth Engine call):

  C1  extent retained, % of the observed high-water reference. Reference = mean of
      the five highest JRC annual any-water fractions of the primary zone (1984-2021,
      years with at least 80% valid coverage). Retained = Dynamic World 2022-2025 mean
      divided by the reference (banded), with the JRC 2017-2021 figure alongside.
      The first calibration pass used a 1988-1992 mean baseline and it failed: sparse
      Landsat 5 coverage makes that window read near-zero water over India (Ulsoor
      4%, Najafgarh 0.3%), so 35 of 38 bodies banded A including Bellandur. Kept as
      a column for the record.
  C3  built-up inside the footprint, %: Dynamic World built fraction, primary zone,
      last full year; Overture and Open Buildings counts inside the footprint as the
      structure cross-check.
  U1  extent trend, pp/yr: least-squares slope of JRC any-water 2012-2021.
  U2  halo pressure, pp: Dynamic World built fraction in the 1 km halo, last full
      year minus 2016.
  S1  size class from the polygon area.
  S4  routed load : area from the cascade graph where the body is a node.

Bands follow the Wetland Health Card convention: A best ... E worst, I insufficient.

Usage:
  python3 scripts/register_calibrate_bands.py                # table to stdout
  python3 scripts/register_calibrate_bands.py --write        # also writes docs/methodology/restoration-register-calibration.md
"""
import argparse
import json
import re
import sys
from pathlib import Path
from statistics import mean

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "scripts"))
RB = ROOT / "public/data/rich-bodies"
GJ = ROOT / "public/geojson/rich-bodies"
CASCADE = ROOT / "public/data/cascade"
REGISTRY = ROOT / "src/lib/water-bodies/rich-body-registry.ts"
OUT_MD = ROOT / "docs/methodology/restoration-register-calibration.md"

BODY = "Body (primary)"
HALO = "Halo: 1km buffer - body"
BASELINE = range(1988, 1993)
JRC_RECENT = range(2017, 2022)
DW_RECENT = range(2022, 2026)
TREND_YEARS = range(2012, 2022)

# ---- thresholds: shared with the screen engine, see scripts/register_thresholds.py
from register_thresholds import (  # noqa: E402
    C1_BANDS, C1_REF_MIN_COVERAGE, C1_REF_TOP_N_30M, C3_BANDS, C3_CORROBORATION_PCT,
    SIZE_CLASSES, TREND_FLOOR_10M_HA, TREND_FLOOR_30M_PX, U1_EASING_PP_YR, U1_RISING_PP_YR,
)
REF_TOP_N, REF_MIN_COVERAGE = C1_REF_TOP_N_30M, C1_REF_MIN_COVERAGE
U1_RISING, U1_EASING = U1_RISING_PP_YR, U1_EASING_PP_YR
EXTENT_FLOOR_HA, EXTENT_FLOOR_PX = TREND_FLOOR_10M_HA, TREND_FLOOR_30M_PX


def band_from(value, table, worst="E", higher_is_worse=True):
    if value is None:
        return "I"
    for cut, b in table:
        if (value < cut) if higher_is_worse else (value > cut):
            return b
    return worst


def size_class(ha):
    for cut, label in SIZE_CLASSES:
        if ha < cut:
            return label
    return "over 200"


def load(path):
    return json.load(open(path)) if path.exists() else None


def geom_area_ha(geom):
    """Planar area at the polygon's own latitude; adequate for a size class."""
    import math
    def ring_area(ring):
        lat0 = sum(c[1] for c in ring) / len(ring)
        kx, ky = 111320 * math.cos(math.radians(lat0)), 110574
        a = 0.0
        for i in range(len(ring) - 1):
            x1, y1 = ring[i][0] * kx, ring[i][1] * ky
            x2, y2 = ring[i + 1][0] * kx, ring[i + 1][1] * ky
            a += x1 * y2 - x2 * y1
        return abs(a) / 2
    polys = geom["coordinates"] if geom["type"] == "MultiPolygon" else [geom["coordinates"]]
    total = 0.0
    for poly in polys:
        total += ring_area(poly[0]) - sum(ring_area(r) for r in poly[1:])
    return total / 10000


def high_water_reference(series):
    """Mean of the top-N annual any-water fractions over well-observed years."""
    vals = []
    for y, row in series.items():
        v, tot, valid = row.get("any_water_pct"), row.get("total_pixels") or 0, row.get("valid_pixels") or 0
        if v is not None and tot and valid / tot >= REF_MIN_COVERAGE:
            vals.append(v)
    vals.sort(reverse=True)
    return (mean(vals[:REF_TOP_N]), len(vals)) if len(vals) >= REF_TOP_N else (None, len(vals))


def zone_series(d, zone):
    if not d:
        return {}
    for zname, series in d.get("by_zone", {}).items():
        if zname == zone:
            return series
    return {}


def mean_pct(series, years, key="any_water_pct"):
    vals = [series[str(y)][key] for y in years if str(y) in series and series[str(y)].get(key) is not None]
    return (mean(vals), len(vals)) if vals else (None, 0)


def slope(series, years, key="any_water_pct"):
    pts = [(y, series[str(y)][key]) for y in years if str(y) in series and series[str(y)].get(key) is not None]
    if len(pts) < 5:
        return None
    n = len(pts)
    sx = sum(p[0] for p in pts)
    sy = sum(p[1] for p in pts)
    sxx = sum(p[0] ** 2 for p in pts)
    sxy = sum(p[0] * p[1] for p in pts)
    den = n * sxx - sx * sx
    return (n * sxy - sx * sy) / den if den else None


def registry_cities():
    txt = REGISTRY.read_text() if REGISTRY.exists() else ""
    out = {}
    for m in re.finditer(r'\bid:\s*"([a-z0-9-]+)"(.*?)\bcity_id:\s*"([a-z]+)"', txt, re.S):
        out.setdefault(m.group(1), m.group(3))
    return out


def cascade_index():
    idx = {}
    for p in CASCADE.glob("*-cascade-lakes.geojson"):
        city = p.name.split("-cascade-lakes")[0]
        for f in json.load(open(p))["features"]:
            pr = f["properties"]
            if pr.get("osm_id") is not None:
                idx[(city, int(pr["osm_id"]))] = pr
    return idx


def region_count(d, zone):
    if not d:
        return None
    for r in d.get("regions", []):
        if r.get("region") == zone:
            return r.get("building_count")
    return None


def body_record(body_id, cities, casc):
    poly = load(GJ / f"{body_id}.geojson")
    feat = (poly["features"][0] if poly and poly.get("features") else poly) if poly else None
    props = (feat.get("properties") or {}) if feat else {}
    area = props.get("area_ha")
    if area is None and feat and feat.get("geometry"):
        area = round(geom_area_ha(feat["geometry"]), 1)
    osm_id = props.get("osm_id")
    city = cities.get(body_id, "?")

    jrc = zone_series(load(RB / f"{body_id}-jrc-water-trend.json"), BODY)
    dw = zone_series(load(RB / f"{body_id}-dw-water-trend.json"), BODY)
    built = load(RB / f"{body_id}-dynamic-world-built-trend.json")
    built_body, built_halo = zone_series(built, BODY), zone_series(built, HALO)
    overture = load(RB / f"{body_id}-overture-buildings.json")
    ob = load(RB / f"{body_id}-open-buildings-verification.json")

    base, nbase = mean_pct(jrc, BASELINE)
    rec, nrec = mean_pct(jrc, JRC_RECENT)
    dwrec, ndw = mean_pct(dw, DW_RECENT)
    valid_px = max((jrc[str(y)].get("valid_pixels", 0) for y in JRC_RECENT if str(y) in jrc), default=0)
    floor_ok = (area or 0) >= EXTENT_FLOOR_HA and valid_px >= EXTENT_FLOOR_PX

    ref, nref = high_water_reference(jrc)
    ret_dw = (100 * dwrec / ref) if (ref and dwrec is not None and floor_ok) else None
    ret_jrc = (100 * rec / ref) if (ref and rec is not None and floor_ok) else None
    old_c1 = (rec - base) if (base is not None and rec is not None and floor_ok) else None
    u1 = slope(jrc, TREND_YEARS) if floor_ok else None

    last_full = max((int(y) for y in built_body if int(y) <= 2025), default=None)
    c3 = built_body[str(last_full)]["built_fraction_pct"] if last_full else None
    ob_n, ov_n = region_count(ob, BODY), region_count(overture, BODY)
    structures = (ob_n or 0) + (ov_n or 0)
    c3_band = band_from(c3, C3_BANDS)
    # Corroboration: a built fraction under 5% with no mapped structure inside the
    # footprint is the bund ring and its road reading as built; that is the tank, not
    # encroachment. Band A until a structure corroborates it.
    if c3 is not None and c3 < C3_CORROBORATION_PCT and structures == 0:
        c3_band = "A"
    halo_now = built_halo.get(str(last_full), {}).get("built_fraction_pct") if last_full else None
    halo_2016 = built_halo.get("2016", {}).get("built_fraction_pct")
    u2 = (halo_now - halo_2016) if (halo_now is not None and halo_2016 is not None) else None

    cz = casc.get((city, int(osm_id))) if osm_id is not None else None
    load_ratio = None
    if cz and cz.get("lake_area_sqkm"):
        load_ratio = cz.get("total_upstream_sqkm", 0) / cz["lake_area_sqkm"]

    return {
        "id": body_id, "city": city, "area_ha": area, "size": size_class(area or 0),
        "floor_ok": floor_ok, "valid_px": valid_px,
        "ref_pct": ref, "jrc_recent_pct": rec, "dw_recent_pct": dwrec,
        "ret_dw": ret_dw, "c1_band": band_from(ret_dw, C1_BANDS, higher_is_worse=False) if floor_ok else "I",
        "ret_jrc": ret_jrc, "old_c1_pp": old_c1,
        "u1_pp_yr": u1, "u1_class": ("I" if u1 is None else "Rising" if u1 <= U1_RISING else "Easing" if u1 >= U1_EASING else "Steady"),
        "c3_pct": c3, "c3_band": c3_band,
        "ob_body": ob_n, "ov_body": ov_n,
        "halo_now": halo_now, "u2_pp": u2,
        "cascade_pos": cz.get("cascade_position") if cz else None, "load_ratio": load_ratio,
    }


def fmt(v, nd=1):
    return "" if v is None else (f"{v:.{nd}f}" if isinstance(v, float) else str(v))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    args = ap.parse_args()

    ids = sorted(p.name.replace("-imagery-manifest.json", "") for p in RB.glob("*-imagery-manifest.json"))
    cities, casc = registry_cities(), cascade_index()
    rows = [body_record(i, cities, casc) for i in ids]
    rows.sort(key=lambda r: (r["city"], -(r["area_ha"] or 0)))

    hdr = ["body", "city", "ha", "size", "floor", "ref%", "jrc17-21%", "dw22-25%", "retained%", "C1", "ret jrc%", "old C1 pp", "U1 pp/yr", "U1", "C3 %", "C3", "OB", "OV", "halo%", "U2 pp", "cascade", "load:area"]
    lines = ["| " + " | ".join(hdr) + " |", "|" + "---|" * len(hdr)]
    for r in rows:
        lines.append("| " + " | ".join([
            r["id"], r["city"], fmt(r["area_ha"]), r["size"], "ok" if r["floor_ok"] else "below",
            fmt(r["ref_pct"]), fmt(r["jrc_recent_pct"]), fmt(r["dw_recent_pct"]),
            fmt(r["ret_dw"]), r["c1_band"], fmt(r["ret_jrc"]), fmt(r["old_c1_pp"]), fmt(r["u1_pp_yr"], 2), r["u1_class"],
            fmt(r["c3_pct"]), r["c3_band"], fmt(r["ob_body"]), fmt(r["ov_body"]),
            fmt(r["halo_now"]), fmt(r["u2_pp"]), fmt(r["cascade_pos"]), fmt(r["load_ratio"], 0),
        ]) + " |")
    table = "\n".join(lines)

    def dist(key):
        d = {}
        for r in rows:
            d[r[key]] = d.get(r[key], 0) + 1
        return ", ".join(f"{k} {v}" for k, v in sorted(d.items()))

    summary = (f"Bodies: {len(rows)} across {len(set(r['city'] for r in rows))} cities; "
               f"at or above the extent floor: {sum(r['floor_ok'] for r in rows)}.\n"
               f"C1 bands: {dist('c1_band')}.\nC3 bands: {dist('c3_band')}.\nU1 classes: {dist('u1_class')}.")
    print(table)
    print()
    print(summary)

    if args.write:
        OUT_MD.parent.mkdir(parents=True, exist_ok=True)
        OUT_MD.write_text(
            "# Restoration Register: band calibration on the measured cohort\n\n"
            "Generated by `scripts/register_calibrate_bands.py` from the rich-body records on this\n"
            "branch. Every value is read from a committed JSON; nothing is typed in.\n\n"
            "Columns. ref% is the observed high-water reference: the mean of the five highest JRC\n"
            "annual any-water fractions of the primary zone, 1984-2021, over years with at least 80%\n"
            "valid coverage. jrc17-21% and dw22-25% are the recent means from JRC and Dynamic World.\n"
            "retained% is dw22-25 as a share of ref, banded A (85 and above), B (70-85), C (50-70),\n"
            "D (30-50), E (under 30); ret jrc% is the same on JRC 2017-2021 for comparison across the\n"
            "classifier splice. old C1 pp is the first pass's metric (JRC 2017-21 minus 1988-92) kept\n"
            "for the record of why it was dropped. U1 is the JRC slope 2012-2021 in pp per year\n"
            "(Rising at or below -1, Easing at or above +1). C3 is Dynamic World built fraction inside\n"
            "the footprint in the last full year on the Wetland Health Card 'area converted'\n"
            "thresholds, held at A when under 5% with no mapped structure inside the footprint (the\n"
            "bund ring reading as built). OB and OV are Open Buildings v3 (2023) and Overture building\n"
            "counts inside the footprint; halo% and U2 are the 1 km halo built fraction now and its\n"
            "change since 2016; cascade and load:area come from the city cascade graph where the body\n"
            "is a node. 'below' in the floor column means under 2 ha or under 100 valid JRC pixels,\n"
            "and the extent columns are then I (insufficient), whatever the numbers say.\n\n"
            f"{table}\n\n{summary}\n")
        print(f"\nwrote {OUT_MD.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
