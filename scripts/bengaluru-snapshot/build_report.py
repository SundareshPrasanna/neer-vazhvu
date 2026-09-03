"""The snapshot report (build step 11): branded HTML with a print stylesheet,
figures as inline SVG drawn from the data files, and a PDF through headless
Chrome. Every number carries n, a band and a confidence class; lakes are ordered
within the city as the funding unit; government-facing language throughout.

Inputs (docs/research/bengaluru-lakes/data/): gba-lakes-ranking.csv,
gba-lakes-unassessed.csv, lakes/<spine_id>.json, gba-lakes-footprints.geojson,
lake-passes.csv.gz, the params files, kspcb-lakes-2026-06.csv; the platform's
corporation outlines for the map.

Outputs (docs/research/bengaluru-lakes/): bengaluru-lakes-snapshot-2026.html and .pdf

Run: /Users/sundaresh/Documents/health_safety/neer-vazhvu/neer-vazhvu-api/.venv/bin/python \
       scripts/bengaluru-snapshot/build_report.py [--no-pdf]
"""
from __future__ import annotations

import argparse
import csv
import gzip
import html
import json
import statistics
import subprocess
from collections import Counter, defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

from pyproj import Transformer
from shapely.geometry import shape
from shapely.ops import transform as shp_transform

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / "docs/research/bengaluru-lakes/data"
OUTDIR = ROOT / "docs/research/bengaluru-lakes"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
TO_UTM = Transformer.from_crs("EPSG:4326", "EPSG:32643", always_xy=True).transform

# palette (dataviz reference instance, validated 2026-09-03: 3 categorical slots
# all-pairs, blue ordinal ramp for the A to E bands)
C_BLUE, C_ORANGE, C_AQUA = "#2a78d6", "#eb6834", "#1baf7a"
RAMP = {"A": "#86b6ef", "B": "#5598e7", "C": "#2a78d6", "D": "#1c5cab", "E": "#0d366b"}
GRAY, GRID, INK, INK2, INK3, SURFACE = "#c9c8c3", "#e6e5e1", "#0b0b0b", "#52514e", "#8a8985", "#ffffff"
NEED_COLOUR = {"Fund now": C_ORANGE, "Co-fund": C_BLUE, "Design first": C_AQUA}
CONF_SHORT = {"high": "H", "medium": "M", "low": "L", "insufficient": "I", "": ""}
SEASON_ORDER = ["winter", "pre_monsoon", "monsoon", "post_monsoon"]


def esc(s) -> str:
    return html.escape(str(s if s is not None else ""))


def pct(v, digits=0):
    return "" if v in ("", None) else f"{100 * float(v):.{digits}f}%"


def pts(v):
    return "" if v in ("", None) else f"{100 * float(v):.0f}"


# ---- SVG helpers -----------------------------------------------------------------
def svg_open(w, h, cls="fig"):
    return f'<svg class="{cls}" viewBox="0 0 {w} {h}" width="{w}" height="{h}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif" font-size="10">'


def text(x, y, s, size=10, fill=INK2, anchor="start", weight="normal", extra=""):
    return f'<text x="{x:.1f}" y="{y:.1f}" font-size="{size}" fill="{fill}" text-anchor="{anchor}" font-weight="{weight}" {extra}>{esc(s)}</text>'


def fig_map(fps, ranking, corps) -> str:
    """Footprints coloured by Need class on the corporation outlines; top ten numbered."""
    need = {r["spine_id"]: r for r in ranking}
    geoms = {sid: shp_transform(TO_UTM, shape(g)) for sid, g in fps.items()}
    cg = [shp_transform(TO_UTM, shape(f["geometry"])) for f in corps]
    # frame = the corporation outlines padded 3 km; the SVG takes the frame's own
    # aspect so the map fills the page width; lakes beyond the frame are named
    xs, ys = [], []
    for g in cg:
        b = g.bounds; xs += [b[0], b[2]]; ys += [b[1], b[3]]
    pad = 2000
    x0, x1, y0, y1 = min(xs) - pad, max(xs) + pad, min(ys) - pad, max(ys) + pad
    W = 700
    H = int(W * (y1 - y0) / (x1 - x0))
    sc = (W - 20) / (x1 - x0)
    def P(x, y):
        return (10 + (x - x0) * sc, H - 10 - (y - y0) * sc)
    outside = []
    for sid, g in list(geoms.items()):
        c = g.centroid
        if not (x0 <= c.x <= x1 and y0 <= c.y <= y1):
            r = need.get(sid)
            outside.append(f"{r['name']} ({r['need_class']})" if r else sid)
            del geoms[sid]
    def path(g):
        d = []
        polys = g.geoms if hasattr(g, "geoms") else [g]
        for p in polys:
            for ring in [p.exterior] + list(p.interiors):
                pts_ = [P(*c) for c in ring.coords]
                d.append("M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts_) + " Z")
        return " ".join(d)
    out = [svg_open(W, H)]
    for g in cg:
        out.append(f'<path d="{path(g)}" fill="none" stroke="{GRID}" stroke-width="1"/>')
    for sid, g in geoms.items():
        r = need.get(sid)
        col = NEED_COLOUR.get(r["need_class"], GRAY) if r else GRAY
        if g.area >= 2e5:
            out.append(f'<path d="{path(g)}" fill="{col}" fill-opacity="0.9" stroke="{SURFACE}" stroke-width="0.6"/>')
        else:   # under 20 ha a polygon is sub-pixel at this scale: a 7 px mark at the centroid
            c = g.centroid; x, y = P(c.x, c.y)
            out.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="{col}" fill-opacity="0.9" stroke="{SURFACE}" stroke-width="1"/>')
    for r in ranking[:10]:
        g = geoms.get(r["spine_id"])
        if g is None:
            continue
        c = g.centroid; x, y = P(c.x, c.y)
        out.append(f'<circle cx="{x:.1f}" cy="{y - 9:.1f}" r="7" fill="{SURFACE}" stroke="{INK}" stroke-width="0.8"/>')
        out.append(text(x, y - 6, r["rank"], 8, INK, "middle", "bold"))
    # legend
    lx, ly = 14, 16
    for i, (k, col) in enumerate(list(NEED_COLOUR.items()) + [("Other classes", GRAY)]):
        out.append(f'<rect x="{lx}" y="{ly + i * 14 - 8}" width="10" height="10" rx="2" fill="{col}"/>')
        out.append(text(lx + 14, ly + i * 14, k, 9, INK2))
    out.append(text(lx, ly + 4 * 14 + 2, "Numbers mark the first ten in the ordered list; lakes under 20 ha are drawn as dots", 8, INK3))
    if outside:
        out.append(text(lx, H - 6, "Beyond the frame: " + "; ".join(outside), 8, INK3))
    out.append("</svg>")
    return "".join(out)


def fig_columns(items, title_y, W=320, H=150, colour=C_BLUE, ylabel="lakes", labels=True):
    """Single-series columns with values on the caps."""
    n = len(items); mx = max((v for _, v in items), default=1) or 1
    L, R, T, B = 28, 8, 26, 26
    pw = W - L - R; band = pw / n; bw = min(24, band * 0.6)
    out = [svg_open(W, H)]
    for k in range(1, 4):
        y = T + (H - T - B) * (1 - k / 3)
        out.append(f'<line x1="{L}" y1="{y:.1f}" x2="{W - R}" y2="{y:.1f}" stroke="{GRID}" stroke-width="1"/>')
        out.append(text(L - 4, y + 3, f"{mx * k / 3:.0f}", 8, INK3, "end"))
    base = H - B
    out.append(f'<line x1="{L}" y1="{base}" x2="{W - R}" y2="{base}" stroke="{GRID}"/>')
    for i, (lab, v) in enumerate(items):
        x = L + band * i + (band - bw) / 2
        h = (H - T - B) * v / mx
        out.append(f'<path d="M{x:.1f},{base} v{-h + 4 if h > 4 else 0:.1f} q0,-4 4,-4 h{bw - 8:.1f} q4,0 4,4 v{h - 4 if h > 4 else 0:.1f} z" fill="{colour}"/>')
        if labels:
            out.append(text(x + bw / 2, base - h - 3, f"{v:g}", 9, INK, "middle"))
        out.append(text(x + bw / 2, base + 11, lab, 8, INK2, "middle"))
    out.append(text(L, 9, title_y, 8, INK3))
    out.append("</svg>")
    return "".join(out)


def fig_stacked_area(series, W=560, H=170, title="") -> str:
    """series: list of (label, colour, {ym: share}); shares of a common month list."""
    months = sorted({m for _, _, d in series for m in d})
    if not months:
        return ""
    L, R, T, B = 30, 8, 30, 22
    pw, ph = W - L - R, H - T - B
    xi = {m: L + pw * i / max(1, len(months) - 1) for i, m in enumerate(months)}
    out = [svg_open(W, H)]
    for k in (0.25, 0.5, 0.75, 1.0):
        y = T + ph * (1 - k)
        out.append(f'<line x1="{L}" y1="{y:.1f}" x2="{W - R}" y2="{y:.1f}" stroke="{GRID}"/>')
        out.append(text(L - 4, y + 3, f"{int(k * 100)}%", 8, INK3, "end"))
    cum = {m: 0.0 for m in months}
    for label, col, d in series:
        top, bot = [], []
        for m in months:
            v = d.get(m)
            if v is None:
                continue
            bot.append((xi[m], T + ph * (1 - cum[m])))
            cum[m] += v
            top.append((xi[m], T + ph * (1 - min(1.0, cum[m]))))
        if not top:
            continue
        pts_ = top + bot[::-1]
        out.append(f'<path d="M' + " L".join(f"{x:.1f},{y:.1f}" for x, y in pts_) + f' Z" fill="{col}" fill-opacity="0.85" stroke="{SURFACE}" stroke-width="1"/>')
    years = sorted({m[:4] for m in months})
    for y in years:
        m0 = next(m for m in months if m.startswith(y))
        out.append(text(xi[m0], H - 6, y, 8, INK2, "start"))
    lx = L
    for label, col, _ in series:
        out.append(f'<rect x="{lx}" y="6" width="9" height="9" rx="2" fill="{col}"/>')
        out.append(text(lx + 12, 14, label, 8, INK2))
        lx += 12 + 5 * len(label) + 16
    out.append("</svg>")
    return "".join(out)


def fig_line(points, W=560, H=140, colour=C_BLUE, ylabel="open water share of the footprint", marks=None) -> str:
    """points: list of (date, value 0-1)."""
    if not points:
        return ""
    L, R, T, B = 30, 8, 22, 24
    pw, ph = W - L - R, H - T - B
    d0 = date.fromisoformat(points[0][0]); d1 = date.fromisoformat(points[-1][0])
    span = max(1, (d1 - d0).days)
    X = lambda d: L + pw * (date.fromisoformat(d) - d0).days / span
    Y = lambda v: T + ph * (1 - v)
    out = [svg_open(W, H)]
    for k in (0.0, 0.5, 1.0):
        out.append(f'<line x1="{L}" y1="{Y(k):.1f}" x2="{W - R}" y2="{Y(k):.1f}" stroke="{GRID}"/>')
        out.append(text(L - 4, Y(k) + 3, f"{int(k * 100)}%", 8, INK3, "end"))
    out.append(f'<path d="M' + " L".join(f"{X(d):.1f},{Y(v):.1f}" for d, v in points) + f'" fill="none" stroke="{colour}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>')
    for d, v in points:
        out.append(f'<circle cx="{X(d):.1f}" cy="{Y(v):.1f}" r="3.5" fill="{colour}" stroke="{SURFACE}" stroke-width="2"/>')
    for d, v in (marks or []):
        out.append(text(min(max(X(d), L + 40), W - R - 40), T + 10, f"{date.fromisoformat(d).strftime('%-d %b %Y')}: {int(v * 100)}%", 8, INK, "middle"))
    m = d0.replace(day=1)
    while m <= d1:
        out.append(text(X(m.isoformat()), H - 6, m.strftime("%b %y"), 8, INK2, "middle"))
        m = date(m.year + (m.month == 12), (m.month % 12) + 1, 1)
    out.append(text(L, 9, ylabel, 8, INK3))
    out.append("</svg>")
    return "".join(out)


def fig_scatter(points, W=320, H=240, xl="vegetated share of the footprint", yl="chlorophyll proxy on the open-water core") -> str:
    L, R, T, B = 34, 8, 12, 26
    pw, ph = W - L - R, H - T - B
    ys = [y for _, y, _ in points] or [0, 1]
    ymin, ymax = min(-0.2, min(ys)), max(0.6, max(ys))
    X = lambda x: L + pw * x
    Y = lambda y: T + ph * (1 - (y - ymin) / (ymax - ymin))
    out = [svg_open(W, H)]
    for k in (0.0, 0.25, 0.5, 0.75, 1.0):
        out.append(f'<line x1="{X(k):.1f}" y1="{T}" x2="{X(k):.1f}" y2="{T + ph}" stroke="{GRID}"/>')
        out.append(text(X(k), H - 14, f"{int(k * 100)}%", 8, INK3, "middle"))
    for yv in (-0.2, 0.0, 0.2, 0.4, 0.6):
        if ymin <= yv <= ymax:
            out.append(f'<line x1="{L}" y1="{Y(yv):.1f}" x2="{W - R}" y2="{Y(yv):.1f}" stroke="{GRID}"/>')
            out.append(text(L - 4, Y(yv) + 3, f"{yv:.1f}", 8, INK3, "end"))
    for x, y, conf in points:
        op = {"high": 0.95, "medium": 0.75, "low": 0.45}.get(conf, 0.3)
        out.append(f'<circle cx="{X(x):.1f}" cy="{Y(y):.1f}" r="3.5" fill="{C_BLUE}" fill-opacity="{op}" stroke="{SURFACE}" stroke-width="1.5"/>')
    out.append(text(W / 2, H - 3, xl, 8, INK2, "middle"))
    out.append(text(L, 8, yl + " (lighter dots: lower confidence)", 8, INK3))
    out.append("</svg>")
    return "".join(out)


# ---- data ------------------------------------------------------------------------------
def monthly_composition(passes, sid, start="2019-01"):
    by = defaultdict(lambda: defaultdict(list))
    for r in passes.get(sid, []):
        if r["pass_class"] != "clear" or r.get("comp_ok") != "True" or r["date"][:7] < start:
            continue
        for k in ("frac_open_water", "frac_algae", "frac_bed", "frac_froth"):
            by[r["date"][:7]][k].append(float(r[k]))
    out = {k: {} for k in ("frac_open_water", "frac_algae", "frac_bed", "frac_froth")}
    for ym, d in by.items():
        if len(d["frac_open_water"]) >= 2:      # note 7.7: a month with fewer than two clear passes is a gap
            for k in out:
                out[k][ym] = statistics.median(d[k])
    return out


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-pdf", action="store_true")
    ap.add_argument("--title", default="Bengaluru Lakes Snapshot, monsoon 2026")
    args = ap.parse_args()

    ranking = list(csv.DictReader(open(DATA / "gba-lakes-ranking.csv")))
    for r in ranking:
        r["rank"] = int(r["rank"])
    unassessed = list(csv.DictReader(open(DATA / "gba-lakes-unassessed.csv")))
    fps_geo = json.load(open(DATA / "gba-lakes-footprints.geojson"))["features"]
    fps = {f["properties"]["spine_id"]: f["geometry"] for f in fps_geo}
    fpp = {f["properties"]["spine_id"]: f["properties"] for f in fps_geo}
    lakes = {p.stem: json.load(open(p)) for p in (DATA / "lakes").glob("*.json")}
    corps = json.load(open(ROOT / "public/geojson/bangalore-corporations-2025.geojson"))["features"]
    state_params = json.load(open(DATA / "state-params.json"))
    fp_params = json.load(open(DATA / "footprint-params.json"))
    rank_params = json.load(open(DATA / "ranking-params.json"))
    clf = json.load(open(DATA / "classifier-validation.json"))
    kspcb = list(csv.DictReader(open(DATA / "kspcb-lakes-2026-06.csv")))
    passes = defaultdict(list)
    with gzip.open(DATA / "lake-passes.csv.gz", "rt") as f:
        for r in csv.DictReader(f):
            passes[r["spine_id"]].append(r)
    spine = list(csv.DictReader(open(DATA / "gba-lakes-spine.csv")))

    n_custody = sum(1 for r in spine if r["match_method"] != "duplicate")
    n_ranked, n_unassessed = len(ranking), len(unassessed)
    need_counts = Counter(r["need_class"] for r in ranking)
    cond_counts = Counter(r["condition_band"] for r in ranking)
    ha_de = sum(float(r["footprint_ha"]) for r in ranking if r["condition_band"] in "DE")
    ha_all = sum(float(r["footprint_ha"]) for r in ranking)
    seasons = Counter(r["season"] for r in ranking)
    main_season = seasons.most_common(1)[0][0] if seasons else ""
    conf_counts = Counter(r["confidence"] for r in ranking)
    kspcb_counts = Counter(r["use_based_class"] for r in kspcb)
    joined_kspcb = sum(1 for r in ranking if r["kspcb_class"])
    never = [p for p in fpp.values() if "no_water_observed" in p["flags"]]
    fundable = [r for r in ranking if r["need_class"] in ("Fund now", "Co-fund")]
    as_of = state_params.get("computed_at", "")[:10]
    last_scene = max((r["date"] for rs in passes.values() for r in rs), default="")

    # figures
    f_map = fig_map(fps, ranking, corps)
    f_cond = fig_columns([(b, cond_counts.get(b, 0)) for b in "ABCDE"], "lakes by Condition band (A best to E)", W=300)
    f_need = fig_columns([(k.replace(" / ", "/"), need_counts.get(k, 0)) for k in ["Fund now", "Co-fund", "Intervene early", "Design first", "Watch / verify", "Maintain", "Steward"]], "lakes by Need class", W=420)
    series_figs = []
    for sid, name in (("gba-bda-001", "Bellandur (BDA)"), ("gba-bda-002", "Varthur (BDA)"), ("gba-bbmp-155", "Jakkur (BBMP)")):
        mc = monthly_composition(passes, sid)
        other = {m: mc["frac_bed"].get(m, 0) + mc["frac_froth"].get(m, 0) for m in mc["frac_bed"]}
        series_figs.append((name, fig_stacked_area([("open water", C_BLUE, mc["frac_open_water"]), ("bed, froth and other", C_ORANGE, other), ("vegetation (mats, emergent, bloom scum)", C_AQUA, mc["frac_algae"])], title=name)))
    uls = [(r["date"], float(r["frac_open_water"])) for r in passes.get("gba-bbmp-052", []) if r["pass_class"] == "clear" and r.get("comp_ok") == "True" and "2025-11-01" <= r["date"] <= "2026-08-31"]
    f_ulsoor = fig_line(uls, marks=[uls[0], min(uls, key=lambda t: t[1])] if uls else None) if uls else ""
    # coverage: median across lakes of clear passes per month
    cov = defaultdict(lambda: defaultdict(int))
    for sid, rs in passes.items():
        for r in rs:
            if r["pass_class"] == "clear":
                cov[r["date"][:7]][sid] += 1
    months = sorted(m for m in cov if m >= "2019-01")
    cov_items = [(m[2:4] if m.endswith("-01") else "", statistics.median(cov[m].values()) if cov[m] else 0) for m in months]
    f_cov = fig_columns(cov_items, "median clear passes per lake per month (year labels at January)", W=700, H=150, labels=False)
    sc_pts = []
    for r in ranking:
        if r["W2"] and r["Q1"]:
            sc_pts.append((float(r["W2"]), float(r["Q1"]), r["confidence"]))
    f_scatter = fig_scatter(sc_pts)

    # ---- HTML ------------------------------------------------------------------------
    def band_cell(v, band, n, conf, digits=0, unit="%"):
        if v in ("", None):
            return '<td class="num muted">insufficient</td>'
        if unit == "%":
            return f'<td class="num">{100 * float(v):.{digits}f}<span class="pm">±{100 * float(band):.0f}</span> <span class="meta">n{n} {CONF_SHORT.get(conf, "")}</span></td>'
        return f'<td class="num">{float(v):.2f}<span class="pm">±{float(band):.2f}</span> <span class="meta">n{n} {CONF_SHORT.get(conf, "")}</span></td>'

    def row_html(r):
        d = lakes.get(r["spine_id"], {}); k = d.get("kpis", {})
        w1 = k.get("W1", {}); w2 = k.get("W2", {}); q1 = k.get("Q1", {})
        prog = r["programme"] if r["programme"] != "none" else ""
        cls = "fund" if r["need_class"] in ("Fund now", "Co-fund") else ""
        return (f'<tr class="{cls}"><td class="num">{r["rank"]}</td><td><b>{esc(r["name"])}</b><br><span class="meta">{esc(r["custodian"])} - {esc(r["corporation"]) or "outside the 2025 ward layer"} - {float(r["footprint_ha"]):.1f} ha</span></td>'
                f'<td>{esc(r["need_class"])}</td><td class="cond band-{r["condition_band"]}">{r["condition_band"]}<br><span class="meta">{esc(r["condition_inputs"])}</span></td>'
                + band_cell(w1.get("value"), w1.get("band", {}).get("total"), w1.get("n"), w1.get("confidence"))
                + band_cell(w2.get("value"), w2.get("band", {}).get("total"), w2.get("n"), w2.get("confidence"))
                + band_cell(q1.get("value"), q1.get("band", {}).get("total"), q1.get("n"), q1.get("confidence"), 2, "idx")
                + f'<td class="num">{esc(r["kspcb_class"])}</td><td class="small">{esc(prog)}</td><td class="num">{CONF_SHORT.get(r["confidence"], "")}</td></tr>')

    rows_html = "\n".join(row_html(r) for r in ranking)
    unassessed_html = "\n".join(f'<tr><td><b>{esc(u["name"])}</b> <span class="meta">{esc(u["custodian"])} - {esc(u["corporation"])}</span></td><td class="small">{esc(u["queue_reason"])}</td></tr>' for u in unassessed)

    def tile(label, value, sub=""):
        return f'<div class="tile"><div class="label">{esc(label)}</div><div class="value">{esc(value)}</div><div class="sub">{esc(sub)}</div></div>'

    top = fundable[:10]
    top_html = "".join(f'<li><b>{esc(r["name"])}</b> ({esc(r["custodian"])}, {float(r["footprint_ha"]):.0f} ha): {esc(r["need_class"])}, Condition {r["condition_band"]}' + (f', KSPCB Class {esc(r["kspcb_class"])}' if r["kspcb_class"] else "") + f', confidence {r["confidence"]}</li>' for r in top)
    never_html = ", ".join(sorted(p["ktcda_name"] for p in never))

    page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{esc(args.title)}</title>
<style>
@page {{ size: A4; margin: 14mm 14mm 18mm 14mm; @bottom-left {{ content: "Neer Vazhvu - {esc(args.title)}"; font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: {INK3}; }} @bottom-right {{ content: "neervazhvu.in"; font-family: Helvetica, Arial, sans-serif; font-size: 8px; color: {INK3}; }} }}
* {{ box-sizing: border-box; }}
body {{ font-family: -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif; color: {INK}; margin: 0; font-size: 10.5px; line-height: 1.4; background: {SURFACE}; }}
h1 {{ font-size: 26px; margin: 0 0 4px; letter-spacing: -0.01em; }}
h2 {{ font-size: 15px; margin: 18px 0 6px; padding-top: 6px; border-top: 2px solid {INK}; }}
h3 {{ font-size: 11.5px; margin: 12px 0 4px; }}
p {{ margin: 0 0 6px; }}
.brand {{ display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: 13px; margin-bottom: 14px; }}
.brand svg {{ width: 22px; height: 22px; }}
.sub {{ color: {INK2}; }}
.meta, .muted {{ color: {INK3}; font-size: 9px; }}
.small {{ font-size: 9px; }}
.tiles {{ display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin: 10px 0; }}
.tile {{ border: 1px solid {GRID}; border-radius: 6px; padding: 8px 10px; }}
.tile .label {{ font-size: 9.5px; color: {INK2}; }}
.tile .value {{ font-size: 22px; font-weight: 600; line-height: 1.2; margin: 2px 0; }}
.tile .sub {{ font-size: 8.5px; }}
.cols {{ display: grid; grid-template-columns: 1fr 1fr; gap: 14px; }}
.box {{ border: 1px solid {GRID}; border-radius: 6px; padding: 8px 10px; margin: 8px 0; }}
table {{ width: 100%; border-collapse: collapse; font-size: 9px; }}
th {{ text-align: left; font-weight: 600; border-bottom: 1px solid {INK}; padding: 3px 4px; vertical-align: bottom; }}
td {{ border-bottom: 1px solid {GRID}; padding: 3px 4px; vertical-align: top; }}
td.num, th.num {{ text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }}
td.cond {{ text-align: right; white-space: normal; max-width: 70px; }} td.cond .meta {{ font-size: 7.5px; }}
tr.fund td {{ background: #fff7f2; }}
.pm {{ color: {INK3}; font-size: 8px; margin-left: 2px; }}
td.band-E, td.band-D {{ font-weight: 700; }}
thead {{ display: table-header-group; }}
tr {{ page-break-inside: avoid; }}
.pb {{ page-break-before: always; }}
.fig {{ max-width: 100%; height: auto; display: block; }}
.cap {{ font-size: 9px; color: {INK2}; margin: 2px 0 10px; }}
p {{ orphans: 2; widows: 2; }}
ol.top li {{ margin-bottom: 2px; }}
ul {{ margin: 2px 0 6px 16px; padding: 0; }} li {{ margin-bottom: 2px; }}
.key span {{ display: inline-block; margin-right: 10px; }}
</style></head><body>

<div class="brand">{open(ROOT / "src/app/icon.svg").read()} Neer Vazhvu <span class="sub" style="font-weight:400">- India's Water Intelligence</span></div>
<h1>{esc(args.title)}</h1>
<p class="sub">Every lake on the Greater Bengaluru custody lists, read from Sentinel-2 at Tier 1 (relative, uncalibrated), with an order of priority for restoration funding. Reading window: <b>{esc(main_season)}</b> for {seasons.get(main_season, 0)} of {n_ranked} assessed lakes (each lake's own window is named in the list). Archive 28 March 2017 to {esc(date.fromisoformat(last_scene).strftime("%-d %B %Y"))}; observed passes only, nothing interpolated. A post-monsoon edition follows in November 2026 from the same pipeline.</p>

<div class="tiles">
{tile("Custody lakes on the KTCDA lists", f"{n_custody}", "BBMP, BDA, Forest Department, BMRCL; one duplicate row removed")}
{tile("Assessed at open resolution", f"{n_ranked}", f"{n_unassessed} unassessed: no polygon at 10 m, or below the evidence floors")}
{tile("Condition D or E", f"{cond_counts.get('D', 0) + cond_counts.get('E', 0)}", f"{ha_de:,.0f} of {ha_all:,.0f} ha of assessed footprint")}
{tile("Fundable now", f"{need_counts.get('Fund now', 0) + need_counts.get('Co-fund', 0)}", f"Fund now {need_counts.get('Fund now', 0)} and Co-fund {need_counts.get('Co-fund', 0)}; Design first {need_counts.get('Design first', 0)}")}
</div>

<div class="cols">
<div>
<h3>How to read a number in this report</h3>
<p>Each value is a seasonal median of clear satellite passes, shown as <b>value ± band</b> with <b>n</b> passes and a confidence class <b>H / M / L</b>. The band is the reading's own uncertainty (sampling and classification for shares, spread across passes for indices). A Health Card band is assigned only where the band is wider than the error; otherwise both candidate bands are listed. Nothing below an evidence floor is shown as a value.</p>
<h3>What this snapshot cannot say</h3>
<p>Dissolved oxygen, BOD, COD, nutrients, coliform, metals and toxins have no optical signature; the regulator's Use Based Class (KSPCB, June 2026) is shown beside the satellite reading for {joined_kspcb} lakes and is never recomputed. Chlorophyll and turbidity are relative indices until a field calibration exists; no calibrated concentration appears here. The vegetation share includes floating mats and emergent reeds inside the footprint. Encroachment is read at 10 m from Dynamic World and needs a survey sketch or a sub-metre scene before any claim. Boundaries are OpenStreetMap polygons united with the observed water extent, not survey boundaries.</p>
</div>
<div>
<h3>The first ten in the order</h3>
<ol class="top">{top_html}</ol>
<p class="meta">Order: Need class (Fund now, Co-fund, Intervene early, Design first, then the rest), Condition band, the published Need index, confidence, footprint area. Lakes are ordered within the city as the funding unit; custodians are not compared.</p>
</div>
</div>

<div class="pb"></div>
<h2>The city in one view</h2>
<div style="width:78%">{f_map}</div><p class="cap">Fixed footprints of the {n_ranked} assessed lakes on the five 2025 corporation outlines, coloured by Need class. Footprint = mapped boundary united with the observed water extent since 2017.</p>
<div class="cols">
<div>{f_cond}<p class="cap">Condition band = the worse of the median and, where two or more inputs read E, the worst input; inputs are the share of the observed maximum held (C1), built share inside the footprint (C3), vegetated share (C4), the chlorophyll proxy (C5), froth events (C8) and the regulator's class (G2).</p></div>
<div>{f_need}<p class="cap">Need class by the register's rules (plan section 7.2): Condition D or E with a tractable boundary and no works on record reads Fund now (a budget line alone does not change it); with works on record, Co-fund; with a boundary or built-up question, or no water held in the window, Design first; a single severe input against an otherwise sound reading is a flag for a closer read (Watch / verify), not a verdict.</p>
<p><b>The regulator's view, June 2026:</b> KSPCB classed {kspcb_counts.get('D', 0)} monitored lakes D (wildlife and fisheries) and {kspcb_counts.get('E', 0)} E (irrigation and industrial cooling), none A to C; {joined_kspcb} of those stations join a custody lake here.</p>
<p><b>Lakes with no open water observed in nine years:</b> {esc(never_html)}. These read as dry, vegetated or built over at 10 m and are listed with Low boundary confidence.</p>
</div>
</div>

<div class="pb"></div>
<h2>The ordered list, fundable now first</h2>
<p class="meta">W1 open water and W2 vegetated share are shares of the footprint in the lake's reading window (percent ± points); Q1 is the chlorophyll proxy on the open-water core (index units ± half the spread across passes). n = clear passes with a value. H / M / L = confidence class. Rows shaded orange are Fund now and Co-fund. Condition inputs: C1 storage, C3 built, C4 vegetated, C5 chlorophyll proxy, C8 froth, G2 regulator; a band followed by candidates in brackets, such as D(C/D), means the error band straddles a boundary and the value's band is shown with both candidates.</p>
<table>
<thead><tr><th class="num">#</th><th>Lake</th><th>Need class</th><th class="num">Condition (inputs)</th><th class="num">W1 open water</th><th class="num">W2 vegetated</th><th class="num">Q1 chlorophyll proxy</th><th class="num">KSPCB</th><th>Programme on record</th><th class="num">Conf.</th></tr></thead>
<tbody>{rows_html}</tbody></table>

<div class="pb"></div>
<h2>What continuous monitoring looks like</h2>
<p>Three lakes with named sub-zones, monthly medians of the surface composition from 2019 (a month with fewer than two clear passes is a gap, not a value). The monsoon months are thin on every lake, which is what an honest optical record looks like.</p>
{"".join(f'<h3>{esc(n)}</h3>{s}' for n, s in series_figs)}
<p class="cap">Surface classes per pass: open water, vegetation (mats and emergent growth; bloom water stays open water and shows in the chlorophyll proxy), froth, and exposed bed. Sentinel-2, 10 m.</p>
<h3>Ulsoor, November 2025 to August 2026</h3>
{f_ulsoor}
<p class="cap">Open-water share of the footprint per clear pass. The lake was drained from February 2026 for its NDMF desilting works; the series will show the refill.</p>

<div class="pb"></div>
<h3>Coverage, 2019 to date</h3>
{f_cov}<p class="cap">Median clear passes per lake per month. The monsoon gap is reported, never filled; the archive over Bengaluru is dense from 2019.</p>
<div class="cols">
<div>{f_scatter}<p class="cap">Assessed lakes with a computable chlorophyll proxy: vegetated share against the chlorophyll proxy on the open-water core, reading window medians. Two groups: mat-covered lakes and bloom-prone open lakes; both are eutrophication, with different measures.</p></div>
<div><h3>Confidence</h3><p>Assessed lakes by the weakest of their open-water, vegetation and chlorophyll readings: {", ".join(f"{k} {v}" for k, v in sorted(conf_counts.items()))}.</p>
<p>A confidence class is the weakest of six components: pixels inside the lake after the shoreline ring, the share of the lake close to shore, clear passes in the window, the length of the lake's own record, validation of the surface classes on the lake's type, and the boundary's provenance. High needs every component High, which a 10 m sensor cannot give a lake under about 20 ha and a mapped boundary cannot give any lake; Medium is the ceiling for the large lakes until a surveyed boundary and field calibration exist. The monsoon window also thins the clear passes; the post-monsoon edition will lift the pass component for most lakes.</p></div>
</div>

<div class="pb"></div>
<h2>Method, in brief</h2>
<p><b>Universe.</b> The Karnataka Tank Conservation and Development Authority custody lists for Bengaluru (BBMP, BDA, Forest Department, BMRCL): {n_custody} lakes, each joined to a mapped boundary, the BBMP Lake Management System point, the 2025 ward and corporation, the platform's cascade layer, the regulator's June 2026 station, and the programme rows on record.</p>
<p><b>Sensor.</b> Copernicus Sentinel-2 (10 m, a pass every two to three days over Bengaluru), every scene from March 2017 to the reading date, cloud-masked pixel by pixel; observed passes only, nothing interpolated.</p>
<p><b>Per lake, per pass.</b> A fixed footprint (the mapped boundary united with the observed water extent); the share of the footprint reading as open water, vegetation (mats and emergent growth), froth and exposed bed; and on the open water, relative indices for chlorophyll, turbidity, coloured organic matter and apparent colour. These are Tier 1 (relative) readings: comparable across lakes and years, not concentrations.</p>
<p><b>Per lake, per window.</b> Seasonal medians with their spread, percentile against the lake's own same-season history, water area and share of the observed maximum, froth events per year, built share inside the footprint, and the confidence class. Health Card bands are assigned only where the band is wider than the error.</p>
<p><b>Need class and order.</b> The register's published rules over four axes (Condition, Stakes, Tractability, Urgency) with the programme on record; lakes are ordered within the city as the funding unit. The full method, error model and rule set are in the Neer Vazhvu methodology note, available on request.</p>

<h2>Unassessed at open resolution ({n_unassessed})</h2>
<p class="meta">Listed after the ordered list with the queue reason, per the register rule. A hand-digitised boundary or a sub-metre scene moves a lake into the assessed set.</p>
<table><thead><tr><th>Lake</th><th>Queue reason</th></tr></thead><tbody>{unassessed_html}</tbody></table>

<h2>Sources</h2>
<ul>
<li>KTCDA, List of Lakes in Bengaluru (BBMP, BDA, Forest Department, BMRCL custody lists), downloaded 3 September 2026.</li>
<li>BBMP Lake Management System, lake locations (lms.bbmpgov.in), 3 September 2026.</li>
<li>KSPCB, Water Quality Data of Bengaluru Lakes for the Month of June 2026 (130 stations); Classification of Water Quality under NWMP, April 2025 to February 2026.</li>
<li>Copernicus Sentinel-2 Level-2A (COPERNICUS/S2_SR_HARMONIZED) and Cloud Score+ on Google Earth Engine; Dynamic World V1.</li>
<li>OpenStreetMap water polygons (ODbL); Greater Bengaluru 2025 ward and corporation layers; the platform's cascade layer.</li>
<li>KTCDA, List of Lakes in Bengaluru: ktcda.karnataka.gov.in/28/list-of-lakes-in-bengaluru/en.</li>
<li>Programme rows: Deccan Herald, 17 July 2025, "BBMP allocates Rs 50 crore to develop 24 lakes"; 21 June 2025, "Karnataka Govt approves Rs 80 crore to resume desilting work" (Bellandur); 17 November 2025, "Bellandur Lake rejuvenation pushed to March 2026"; 27 February 2026, "Authority plans revival of drained city lakes"; Citizen Matters, 3 March 2020, "BDA concretises restoration of Bellandur Lake"; Newsfirst, 18 February 2026, "Ulsoor Lake drained for Rs 4-crore mega desilting"; SANDRP, 10 February 2026, "Bengaluru Lakes 2025"; NGT OA 125/2017, orders of 6 December 2018 and 12 March 2021.</li>
<li>Methodology: Neer Vazhvu, Satellite monitoring of Bengaluru lakes, methodology note v0 (3 September 2026); the national restoration register plan, section 7.</li>
</ul>
</body></html>"""
    OUTDIR.mkdir(exist_ok=True)
    out_html = OUTDIR / "bengaluru-lakes-snapshot-2026.html"
    out_html.write_text(page)
    print(f"wrote {out_html} ({len(page) // 1024} KB)")
    if not args.no_pdf:
        out_pdf = OUTDIR / "bengaluru-lakes-snapshot-2026.pdf"
        subprocess.run([CHROME, "--headless=new", "--disable-gpu", "--no-pdf-header-footer", f"--print-to-pdf={out_pdf}", f"file://{out_html}"], check=True, capture_output=True)
        info = subprocess.run(["pdfinfo", str(out_pdf)], capture_output=True, text=True).stdout
        print(f"wrote {out_pdf}: " + " ".join(l.strip() for l in info.splitlines() if l.startswith(("Pages", "Page size"))))


if __name__ == "__main__":
    main()
