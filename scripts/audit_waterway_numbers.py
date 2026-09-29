#!/usr/bin/env python3
"""Pre-publication numeric audit: recompute every pipeline-derived number
on a waterway page independently from the raw inputs and diff against what
the page serves. Exits non-zero on any mismatch.

Usage: python3 scripts/audit_waterway_numbers.py [--waterway <id>]
       (default buckingham-canal; audit_waterway_numbers_cooum.py is the Cooum entry point)

Covers: per-reach width stats + confidence tiers, satellite metrics, veg
hectares, veg-on-water, turbidity, built edge, today tiles, the
condition-strip coverage, the width ledger against the canonical HSCTC
table, identity stats, chainage tiling, and cross-document consistency of
headline numbers. The canal adds its estimated (spectral) widths; the Cooum
adds the numeric needles inside curated reach facts that quote our own
measurements, the ledger's today_line, the live-BOD headline against the
research CSV, the methods text, and its failed spectral gate (none ship).

Reads the gitignored docs/research/<id>/ base, so it runs where that exists.
"""

import argparse
import csv
import json
import statistics
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# What each page claims, and the canonical HSCTC width table its ledger must match.
WATERWAYS = {
    "buckingham-canal": {
        "ok_transects": 1012,
        "median_m": 33,
        "identity_cites": ("1,012 transects", "1,012 transects"),
        "transects": 1492,
        "chainage_end_km": 74.55,
        "n_reaches": 18,
        "built_totals": (6238, 15182),
        "share": ((8, 9, 10, 11, 12), 0.74, 0.78, "'three in four' city share"),
        "ledger_span_from_km": None,
        "canon": {
            "Adyar River - Greenways Road": (107, 116, 25, 31),
            "Greenways Road - Kamaraj Salai": (115, 123, 25, 33),
            "Kamaraj Salai - Venkatakrishna Road": (98, 123, 33, 48),
            "Venkatakrishna Road - St. Mary's Road": (122, 123, 37, 38),
            "St. Mary's Road - Agraharam Road": (133, 143, 28, 38),
            "Agraharam Road - Kutchery Road": (113, 117, 33, 37),
            "Kutchery Road - P.V. Koil Street": (114, 134, 34, 39),
            "P.V. Koil Street - Radhakrishna Street": (117, 133, 25, 38),
            "Radhakrishna Street - Avvai Shanmugam Salai": (120, 122, 30, 32),
            "Avvai Shanmugam Salai - Besant Road": (100, 109, 25, 34),
            "Besant Road - Barathi Salai": (89, 110, 24, 25),
            "Barathi Salai - Wallaja Road": (80, 111, 30, 36),
            "Wallaja Road - Swami Sivanandha Salai": (42, 73, 32, 36),
            "Swami Sivanandha Salai - Cooum River": (80, 93, 25, 28),
        },
    },
    "cooum": {
        "ok_transects": 1049,
        "median_m": 70,
        "identity_cites": ("1,049 of 1,258", "1,049 of 1,258 transects"),
        "transects": 1258,
        "chainage_end_km": 62.85,
        "n_reaches": 13,
        "built_totals": None,  # the tiles quote the recomputed totals
        "share": ((10,), 0.334, 0.45, "'more than one in three' reach-10 share"),
        "ledger_span_from_km": 43.5,
        "canon": {
            "River mouth - Napier Bridge": (151, 151, 151, 151),
            "Napier Bridge - Periyar Bridge": (126, 146, 45, 60),
            "Periyar Bridge - Coolways Bridge": (126, 135, 51, 58),
            "Coolways Bridge - St. Andrew Bridge": (94, 131, 60, 62),
            "St. Andrew Bridge - Harris Bridge": (87, 93, 49, 58),
            "Harris Bridge - Ethiraj Bridge": (82, 98, 46, 51),
            "Ethiraj Bridge - College Bridge": (97, 173, 40, 52),
            "College Bridge - Mc. Nicholas Road": (99, 118, 47, 53),
            "Mc. Nicholas Road - Choolaimedu Bridge": (68, 95, 37, 53),
            "Poonamallee High Road - Anna Arch Road": (71, 102, 43, 45),
            "Anna Arch Road - Anna Nagar 8th Main Road": (79, 150, 62, 64),
            "Anna Nagar 8th Main Road - Inner Ring Road": (71, 95, 44, 101),
            "Inner Ring Road - Mogappair Estate Road": (89, 144, 46, 101),
            "Mogappair Estate Road - Vanagaram Ambattur Road": (76, 110, 46, 92),
        },
    },
}


def close(a, b, tol=0.051):
    if a is None and b is None:
        return True
    if a is None or b is None:
        return False
    return abs(float(a) - float(b)) <= tol


def main(waterway: str) -> None:
    cfg = WATERWAYS[waterway]
    RESEARCH = ROOT / "docs" / "research" / waterway
    OUT = ROOT / "public" / "data" / "waterways" / waterway
    errors, notes = [], []

    def rows_of(name):
        return list(csv.DictReader(open(RESEARCH / "data" / name)))

    reaches = json.loads((OUT / "reaches.json").read_text())
    today = json.loads((OUT / "today.json").read_text())["today"]
    widths = rows_of("widths.csv")
    sat = {int(r["km"]): r for r in rows_of("reaches-satellite.csv")}
    vegha = {
        int(r["reach_id"]): float(r["veg_ha"]) for r in rows_of("current-veg-area.csv")
    }
    vow = {int(r["reach_id"]): r for r in rows_of("current-veg-on-water.csv")}
    turb = {int(r["reach_id"]): r for r in rows_of("current-turbidity.csv")}
    built = {int(r["reach_id"]): r for r in rows_of("built-edge.csv")}
    surface = rows_of("current-surface.csv")
    osm_meta = json.loads((RESEARCH / "data" / "osm-water-meta.json").read_text())
    way_year = {
        f"{e['type']}/{e['id']}": int(e["timestamp"][:4])
        for e in osm_meta.get("elements", [])
        if "timestamp" in e
    }

    # ---- per-reach recomputation ----
    for r in reaches["reaches"]:
        rid, (a, b) = r["id"], r["km"]
        rows = [w for w in widths if a <= float(w["chainage_km"]) < b]
        ok = sorted(
            float(w["width_m"]) for w in rows if w["width_m"] and w["flag"] == "OK"
        )
        exp = {
            "median_m": ok[len(ok) // 2] if ok else None,
            "min_m": ok[0] if ok else None,
            "max_m": ok[-1] if ok else None,
            "n_measured": len(ok),
        }
        for k, v in exp.items():
            if not close(r["width"][k], v, 0.11):
                errors.append(
                    f"reach {rid} width.{k}: page {r['width'][k]} vs recomputed {v}"
                )
        # confidence tier recompute
        okr = [
            (float(w["chainage_km"]), float(w["width_m"]), w["osm_water_ids"])
            for w in rows
            if w["width_m"] and w["flag"] == "OK"
        ]
        share = len(okr) / len(rows) if rows else 0
        if len(okr) >= 3:
            med = exp["median_m"]
            diffs = []
            for i in range(len(okr)):
                for j in range(i + 1, len(okr)):
                    gap = okr[j][0] - okr[i][0]
                    if gap < 0.15:
                        continue
                    if gap < 0.35:
                        diffs.append(abs(okr[j][1] - okr[i][1]) / med * 100)
                    break
            jit = statistics.median(diffs) if diffs else None
            yrs = [
                way_year[w]
                for _, _, ids in okr
                for w in ids.split(";")
                if w in way_year
            ]
            vin_ok = bool(yrs) and statistics.median(yrs) >= 2021
            tier = (
                "A"
                if (share >= 0.7 and vin_ok and (jit or 99) <= 25)
                else ("B" if share >= 0.4 else "C")
            )
        else:
            tier = "C"
        if r["width"]["confidence"]["tier"] != tier:
            errors.append(
                f"reach {rid} tier: page {r['width']['confidence']['tier']} vs {tier}"
            )
        # satellite fields
        kms = [k for k in sat if a <= k < b]
        for fld in (
            "veg_frac_dry",
            "veg_frac_recent",
            "water_frac_recent",
            "eff_width_m_recent",
        ):
            vs = [float(sat[k][fld]) for k in kms if sat[k][fld] != ""]
            expv = round(sum(vs) / len(vs), 2) if vs else None
            if not close(r["satellite"][fld], expv):
                errors.append(f"reach {rid} sat.{fld}: {r['satellite'][fld]} vs {expv}")
        if not close(r["veg_ha"], vegha.get(rid), 0.051):
            errors.append(f"reach {rid} veg_ha: {r['veg_ha']} vs {vegha.get(rid)}")
        v = vow.get(rid, {})
        expf = float(v["veg_on_water_frac"]) if v.get("veg_on_water_frac") else None
        if not close(r["satellite"]["veg_on_water_frac"], expf, 0.001):
            errors.append(
                f"reach {rid} veg_on_water: {r['satellite']['veg_on_water_frac']} vs {expf}"
            )
        be = built.get(rid)
        if be and r["built_edge"]:
            for k1 in ("buildings_50m", "buildings_100m", "rooftop_m2_50m"):
                if int(r["built_edge"][k1]) != int(be[k1]):
                    errors.append(
                        f"reach {rid} built_edge.{k1}: {r['built_edge'][k1]} vs {be[k1]}"
                    )

    # ---- identity + global stats ----
    all_ok = sorted(
        float(w["width_m"]) for w in widths if w["width_m"] and w["flag"] == "OK"
    )
    stats_txt = json.dumps(reaches["identity"])
    if len(all_ok) != cfg["ok_transects"]:
        errors.append(
            f"global OK transects: {len(all_ok)} (page claims {cfg['ok_transects']:,})"
        )
    gmed = all_ok[len(all_ok) // 2]
    if not close(gmed, cfg["median_m"], 0.6):
        errors.append(f"global median width {gmed} vs claimed {cfg['median_m']} m")
    needle, cites = cfg["identity_cites"]
    if needle not in stats_txt:
        errors.append(f"identity stat no longer cites {cites}")
    n_rows = len(widths)
    if n_rows != cfg["transects"]:
        errors.append(f"transect count {n_rows} != {cfg['transects']}")
    last_km = float(widths[-1]["chainage_km"])
    if not close(last_km, cfg["chainage_end_km"], 0.15):
        errors.append(f"chainage end {last_km} vs {cfg['chainage_end_km']}")

    if waterway == "buckingham-canal":
        # ---- estimated widths: gate, correction and counts ----
        smeta = json.loads(
            (RESEARCH / "data" / "widths-spectral-meta.json").read_text()
        )
        cal = smeta["calibration"]
        assert cal["detect_rate"] >= 0.5 and cal["median_abs_diff_m"] <= 20, (
            "spectral calibration no longer passes the ship gate - rebuild decision needed"
        )
        bias = cal["median_bias_m"] or 0
        scsv = {
            r["chainage_km"]: float(r["w_spectral_m"])
            for r in rows_of("widths-spectral.csv")
            if r["w_spectral_m"]
        }
        wflags = {r["chainage_km"]: r["flag"] for r in widths}
        exp_spectral = {
            k: round(v - bias, 1)
            for k, v in scsv.items()
            if wflags.get(k) in ("NO_POLYGON", "CENTER_DRY")
        }
        got = {}
        for r in reaches["reaches"]:
            for t in r["transects"]:
                if t["flag"] == "SPECTRAL":
                    got[
                        f"{t['km']:.2f}"
                        if str(t["km"]).count(".") != 1
                        else str(t["km"])
                    ] = t["w"]
        # normalize keys via float compare
        gotf = {round(float(k), 2): v for k, v in got.items()}
        expf = {round(float(k), 2): v for k, v in exp_spectral.items()}
        if len(gotf) != len(expf):
            errors.append(
                f"spectral transects shipped {len(gotf)} vs expected {len(expf)}"
            )
        for k, v in expf.items():
            if k in gotf and abs(gotf[k] - v) > 0.051:
                errors.append(f"spectral value at km {k}: {gotf[k]} vs {v}")
        n_offset = sum(1 for r in widths if r["flag"] == "OFFSET")
        n_offset_ship = sum(
            1
            for r in reaches["reaches"]
            for t in r["transects"]
            if t["flag"] == "OFFSET"
        )
        if n_offset != n_offset_ship:
            errors.append(
                f"offset transects: shipped {n_offset_ship} vs csv {n_offset}"
            )
        mtxt = json.dumps(reaches.get("methods", []))
        for needle in (
            str(cal["detected"]),
            f"{cal['median_abs_diff_m']:.1f} m",
            f"{abs(bias):.1f} m",
            str(smeta["estimated"]),
        ):
            if needle not in mtxt:
                errors.append(
                    f"methods estimated-widths numbers drifted: expected '{needle}'"
                )

    # ---- today tiles ----
    tot_veg = round(sum(vegha.values()))
    tot_water = round(sum(float(t["water_ha"]) for t in turb.values()))
    n_ndti = sum(1 for t in turb.values() if t["ndti_mean"] != "")
    t50 = sum(int(b["buildings_50m"]) for b in built.values())
    t100 = sum(int(b["buildings_100m"]) for b in built.values())
    b50, b100 = cfg["built_totals"] or (t50, t100)
    tiles_txt = json.dumps(today["tiles"])
    checks = [
        (f"{tot_veg} ha", "veg total"),
        (f"~{tot_water} ha", "water total"),
        (f"{n_ndti} of {cfg['n_reaches']}", "turbidity reaches"),
        (f"{b50:,}", "built 50m"),
        (f"{b100:,}", "built 100m"),
    ]
    for needle, label in checks:
        if needle not in tiles_txt:
            errors.append(f"today tile missing/changed: {label} expected '{needle}'")
    if (t50, t100) != (b50, b100):
        errors.append(f"built totals recomputed {t50}/{t100} vs {b50:,}/{b100:,}")
    share_ids, lo, hi, share_label = cfg["share"]
    share = sum(int(built[i]["buildings_50m"]) for i in share_ids) / t50
    if not (lo <= share <= hi):
        errors.append(f"{share_label} now {share:.2f}")
    # condition strip covers full chainage
    strip = today["strip"]
    if strip[0]["from"] > 0.01 or abs(strip[-1]["to"] - last_km) > 0.15:
        errors.append("condition strip does not span full chainage")
    if len(surface) != cfg["transects"]:
        notes.append(f"surface points {len(surface)} (expected {cfg['transects']})")

    if waterway == "cooum":
        # ---- curated facts that quote our own measurements ----
        facts_txt = json.dumps(
            [r["facts"] for r in reaches["reaches"]], ensure_ascii=False
        )
        needles = [
            (f"{float(turb[4]['water_ha']):.1f} ha", "reach-4 open water"),
            (f"{float(turb[5]['water_ha']):.1f} ha", "reach-5 open water"),
            (f"{float(turb[3]['water_ha']):.1f} ha", "reach-3 open water"),
            (
                f"{round(float(vow[6]['veg_on_water_frac']) * 100, 1)}%",
                "reach-6 veg-on-water",
            ),
            (
                f"{round(float(vow[3]['veg_on_water_frac']) * 100)}%",
                "reach-3 veg-on-water",
            ),
            (
                f"{round(float(vow[8]['veg_on_water_frac']) * 100)}%",
                "reach-8 veg-on-water",
            ),
            (
                f"{round(float(vow[10]['veg_on_water_frac']) * 100)}%",
                "reach-10 veg-on-water",
            ),
            (
                f"{round(float(vow[5]['veg_on_water_frac']) * 100)}%",
                "reach-5 veg-on-water",
            ),
            (f"{int(built[10]['buildings_50m'])} buildings", "reach-10 built edge"),
            (
                f"{int(built[10]['buildings_100m']):,} within 100 m",
                "reach-10 built 100m",
            ),
            (f"{int(built[8]['buildings_50m'])} buildings", "reach-8 built edge"),
        ]
        for needle, label in needles:
            if needle not in facts_txt:
                errors.append(
                    f"curated fact needle missing/changed: {label} expected '{needle}'"
                )
        # reach-3 per-km median range
        byk = {}
        for w in widths:
            if (
                10.0 <= float(w["chainage_km"]) < 17.5
                and w["width_m"]
                and w["flag"] == "OK"
            ):
                byk.setdefault(int(float(w["chainage_km"])), []).append(
                    float(w["width_m"])
                )
        meds = sorted(sorted(v)[len(v) // 2] for v in byk.values())
        r3_range = f"{meds[0]:.0f} to {meds[-1]:.0f} m"
        if r3_range not in facts_txt:
            errors.append(f"reach-3 per-km median range: expected '{r3_range}'")

    # ---- width ledger vs canonical HSCTC table ----
    wl = reaches.get("width_ledger")
    if not wl or len(wl["rows"]) != 14:
        errors.append("width ledger missing or wrong row count")
    else:
        for row in wl["rows"]:
            c = cfg["canon"].get(row["stretch"])
            if not c:
                errors.append(f"ledger stretch name drift: {row['stretch']}")
                continue
            if (
                row["orig_min"],
                row["orig_max"],
                row["hsctc_min"],
                row["hsctc_max"],
            ) != c:
                errors.append(f"ledger values drift on {row['stretch']}")
        if cfg["ledger_span_from_km"] is not None:
            # today_line median over the ledger span (to the end)
            span = sorted(
                float(w["width_m"])
                for w in widths
                if float(w["chainage_km"]) >= cfg["ledger_span_from_km"]
                and w["width_m"]
                and w["flag"] == "OK"
            )
            if span:
                med = span[len(span) // 2]
                if f"median is {med:.0f} m" not in wl["today_line"]:
                    errors.append(f"ledger today_line median: expected {med:.0f} m")
                if f"{span[0]:.0f} m minimum" not in wl["today_line"]:
                    errors.append(
                        f"ledger today_line minimum: expected {span[0]:.0f} m"
                    )

    if waterway == "cooum":
        # ---- the live-BOD headline vs the research series ----
        latest = rows_of("wq-tn-ngt-mpr-cooum-monthly.csv")[-1]
        lo, hi = [
            s.strip() for s in latest["bod_mgl"].replace("- ", "-").split("-")[:2]
        ]
        if f"{lo}-{hi} mg/L" not in stats_txt or "BOD" not in stats_txt:
            errors.append(
                f"identity BOD stat vs research CSV: expected '{lo}-{hi} mg/L' with a BOD label ({latest['month']} {latest['year']})"
            )
        # ---- methods sections state the real method ----
        mtxt = json.dumps(reaches.get("methods", []))
        for needle, label in [
            ("every 50 m", "methods spacing"),
            (f"{n_rows:,} transects", "methods transect count"),
            ("200 m separation", "methods jitter basis"),
            ("audit_waterway_numbers_cooum.py", "methods audit pointer"),
        ]:
            if needle not in mtxt:
                errors.append(
                    f"methods section missing/changed: {label} expected '{needle}'"
                )
        # ---- estimated widths: the quality gate held (none ship) ----
        n_spec = sum(
            1
            for r in reaches["reaches"]
            for t in r["transects"]
            if t["flag"] == "SPECTRAL"
        )
        if n_spec:
            errors.append(
                f"{n_spec} spectral transects shipped despite the failed calibration gate"
            )
        smeta_p = RESEARCH / "data" / "widths-spectral-meta.json"
        if smeta_p.exists():
            scal = json.loads(smeta_p.read_text())["calibration"]
            for needle in (
                f"{scal['detected']} of {scal['n']}",
                f"{scal['median_abs_diff_m']:.1f} m",
            ):
                if needle not in mtxt:
                    errors.append(
                        f"methods no-estimates numbers drifted: expected '{needle}'"
                    )

    # ---- claims hygiene ----
    claims = json.loads((OUT / "claims.json").read_text())["claims"]
    texts = {}
    for c in claims:
        texts.setdefault(c["text"], []).append(c["id"])
    dups = {t: ids for t, ids in texts.items() if len(ids) > 2}
    if dups:
        notes.append(
            f"{len(dups)} claim texts repeated >2x (review): "
            + "; ".join(list(dups)[:2])
        )

    print(f"AUDIT: {len(errors)} errors, {len(notes)} notes")
    for e in errors:
        print(" ERROR:", e)
    for n in notes:
        print(" note:", n)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--waterway", default="buckingham-canal", choices=sorted(WATERWAYS))
    main(ap.parse_args().waterway)
