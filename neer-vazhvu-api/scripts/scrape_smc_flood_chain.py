#!/usr/bin/env python3
"""
Scrape Surat Municipal Corporation's live flood chain.

WHY THIS EXISTS
Surat impounds nothing of its own. It draws run-of-river from the Tapi at a
weir-cum-causeway, and the water that fills it or drowns it is released from
Ukai dam, which SMC does not operate. So the city's honest headline is not
storage but headroom: how much room is left at each link of the chain that
runs rain -> dam -> weir -> creek -> street.

SMC publishes that entire chain on one plain HTML page, free, unauthenticated,
and - the part that matters - WITH THE THRESHOLDS. Ukai's full reservoir level,
the causeway's overflow level, and a danger level for each of five urban
khadis. A reading without a threshold is trivia; a reading against a published
threshold is a warning. This is the only city on the platform where the
publisher hands us both halves.

WHY IT IS URGENT
The page shows a ROLLING WINDOW of roughly ten readings and nothing else. There
is no archive, no dated URL, no API. Every day this does not run is a day of
history that cannot be recovered from any source. That is the entire argument
for putting it in the daily launchd job on day one of the branch rather than
waiting for the UI to be ready.

WHAT IT DOES NOT DO
It does not compute a "days of water left". Surat has no storage to run down,
so that number is undefined rather than merely awkward (the same reason Kolkata
ships drainage-capacity). It also does not compare the live release against the
2006 flood peak: that figure is currently only secondary-sourced, and per the
defensible-numbers rule it stays out of the product until it is replaced from
the People's Committee or Surat Citizens' Council Trust reports.

SOURCE + LICENCE
https://www.suratmunicipal.gov.in/Home/RainfallInfo - a public government
website. The dam and weir rows carry SMC's own attribution line, "Source -
Irrigation Dept/Collector Office"; the rainfall and khadi rows are SMC's.

Run:
  cd neer-vazhvu-api && python3 scripts/scrape_smc_flood_chain.py \
      --out ../public/data/surat-flood-chain.json \
      --history ../public/data/surat-flood-chain-history.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any

SMC_URL = "https://www.suratmunicipal.gov.in/Home/RainfallInfo"

IST = timezone(timedelta(hours=5, minutes=30))

# A browser UA: the site serves a trimmed page to some default agents.
UA = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
)

# Panes on the page, by their anchor id.
PANE_UKAI = "UkaiDam"
PANE_WEIR = "Causeway"
PANE_RAIN = "RainFall"
PANE_TOTAL = "TotalRainFall"
PANE_KHADI = "KhadiWaterLevel"

# "14/08/2026 &nbsp;&nbsp; 12:00" -> date + hour. SMC writes midnight as 24:00,
# which datetime refuses, so it is normalised to 00:00 of the following day.
_DT = re.compile(r"(\d{2})/(\d{2})/(\d{4})\s*(\d{1,2}):(\d{2})")

# "Kakara Khadi Udhana Zone (D.L.- 8.48 MT)" - name, zone and the published
# danger level, all inside one <th>.
_KHADI_HEAD = re.compile(
    r"(?P<name>[A-Za-z][A-Za-z\s]*?Khadi)\s*(?P<zone>[A-Za-z]+)\s*Zone\s*"
    r"\(\s*D\.?L\.?\s*-?\s*(?P<dl>\d+(?:\.\d+)?)\s*MT\s*\)",
    re.I,
)

# SMC wraps the threshold numbers in their own tags ("Causeway overflow at
# <span>6.0 mt.</span>"), so these patterns tolerate markup between the label
# and the value. Matching the bare label-then-digits fails on the live page.
_TAGS = r"(?:\s|<[^>]*>)*"
_FRL = re.compile(
    rf"Ukai{_TAGS}Full{_TAGS}Reservoir{_TAGS}Level{_TAGS}-{_TAGS}(\d+(?:\.\d+)?){_TAGS}ft", re.I
)
_OVERFLOW = re.compile(
    rf"Causeway{_TAGS}overflow{_TAGS}at{_TAGS}(\d+(?:\.\d+)?){_TAGS}mt", re.I
)
_CAUSEWAY_STATE = re.compile(r"Causeway\s+is\s*<[^>]*>\s*([A-Z]+)", re.I)
_LAST_UPDATED = re.compile(r"Last\s+Updated\s+on\s*<[^>]*>\s*([0-9\-]+\s+[0-9:]+\s*[AP]M)", re.I)


def fetch(url: str = SMC_URL, timeout: int = 60) -> str:
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        return resp.read().decode("utf-8", errors="replace")


def _pane(html: str, pane_id: str) -> str:
    """Return the markup of one tab pane.

    The panes are siblings, so slicing from this id to the next id= that names
    another pane is both simpler and more robust than balancing divs.
    """
    start = html.find(f'id="{pane_id}"')
    if start < 0:
        return ""
    others = [p for p in (PANE_UKAI, PANE_WEIR, PANE_RAIN, PANE_TOTAL, PANE_KHADI) if p != pane_id]
    end = len(html)
    for other in others:
        idx = html.find(f'id="{other}"', start + 1)
        if 0 < idx < end:
            end = idx
    return html[start:end]


def _cells(row: str) -> list[str]:
    """Text of each <td>/<th> in a row, tags and entities stripped."""
    out = []
    for raw in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", row, re.S | re.I):
        txt = re.sub(r"<[^>]+>", " ", raw)
        txt = txt.replace("&nbsp;", " ").replace("&amp;", "&")
        out.append(re.sub(r"\s+", " ", txt).strip())
    return out


def _rows(pane: str) -> list[list[str]]:
    return [_cells(r) for r in re.findall(r"<tr[^>]*>(.*?)</tr>", pane, re.S | re.I)]


def _ts(text: str) -> str | None:
    """Parse SMC's date/time into an ISO-8601 IST timestamp."""
    m = _DT.search(text)
    if not m:
        return None
    dd, mm, yyyy, hh, mi = (int(g) for g in m.groups())
    # SMC writes midnight as 24:00 of the PREVIOUS day.
    extra_day = 0
    if hh == 24:
        hh, extra_day = 0, 1
    try:
        dt = datetime(yyyy, mm, dd, hh, mi, tzinfo=IST) + timedelta(days=extra_day)
    except ValueError:
        return None
    return dt.isoformat()


def _num(text: str) -> float | None:
    m = re.search(r"-?\d+(?:\.\d+)?", text.replace(",", ""))
    return float(m.group(0)) if m else None


def parse_ukai(html: str) -> tuple[list[dict[str, Any]], float | None]:
    """Ukai dam: level ft, estimated inflow and outflow in cusec."""
    pane = _pane(html, PANE_UKAI)
    frl_m = _FRL.search(pane) or _FRL.search(html)
    frl = float(frl_m.group(1)) if frl_m else None
    readings = []
    for cells in _rows(pane):
        if len(cells) < 4:
            continue
        ts = _ts(cells[0])
        if not ts:
            continue
        readings.append(
            {
                "observedAt": ts,
                "levelFt": _num(cells[1]),
                "inflowCusec": _num(cells[2]),
                "outflowCusec": _num(cells[3]),
            }
        )
    readings.sort(key=lambda r: r["observedAt"], reverse=True)
    return readings, frl


def parse_weir(html: str) -> tuple[list[dict[str, Any]], float | None, str | None]:
    """Weir-cum-causeway: level m and estimated outflow cusec."""
    pane = _pane(html, PANE_WEIR)
    ov_m = _OVERFLOW.search(pane) or _OVERFLOW.search(html)
    overflow = float(ov_m.group(1)) if ov_m else None
    st_m = _CAUSEWAY_STATE.search(pane) or _CAUSEWAY_STATE.search(html)
    state = st_m.group(1).upper() if st_m else None
    readings = []
    for cells in _rows(pane):
        if len(cells) < 3:
            continue
        ts = _ts(cells[0])
        if not ts:
            continue
        readings.append(
            {
                "observedAt": ts,
                "levelM": _num(cells[1]),
                "outflowCusec": _num(cells[2]),
            }
        )
    readings.sort(key=lambda r: r["observedAt"], reverse=True)
    return readings, overflow, state


def parse_zone_rainfall(html: str) -> list[dict[str, Any]]:
    """Zone-wise rainfall, mm per two-hour slot.

    NOTE the vintage conflict recorded in the spec: this feed reports EIGHT
    zones (a single South Zone) while SMC's Zones page lists NINE (South split
    into A and B). Zone names are carried through verbatim from the feed rather
    than remapped, so the artifact never asserts a structure the source does
    not use.
    """
    pane = _pane(html, PANE_RAIN)
    rows = _rows(pane)
    if not rows:
        return []
    header = rows[0]
    zones = [re.sub(r"\s*\(mm\)\s*", "", h).strip() for h in header[1:]]
    out = []
    for cells in rows[1:]:
        if len(cells) < 2:
            continue
        ts = _ts(cells[0])
        if not ts:
            continue
        values = {}
        for zone, cell in zip(zones, cells[1:]):
            v = _num(cell)
            if v is not None:
                values[zone] = v
        if values:
            out.append({"observedAt": ts, "zonesMm": values})
    out.sort(key=lambda r: r["observedAt"], reverse=True)
    return out


def parse_total_rainfall(html: str) -> list[dict[str, Any]]:
    """Cumulative season rainfall as SMC reports it."""
    pane = _pane(html, PANE_TOTAL)
    out = []
    for cells in _rows(pane):
        if len(cells) < 2:
            continue
        ts = _ts(cells[0])
        if not ts:
            continue
        v = _num(cells[1])
        if v is not None:
            out.append({"observedAt": ts, "totalMm": v})
    out.sort(key=lambda r: r["observedAt"], reverse=True)
    return out


def parse_khadis(html: str) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    """Five urban creeks, each with SMC's published danger level.

    Returns (stations, readings). The danger level is the reason this table is
    the most valuable one on the page: it turns a level into a distance-to-harm
    without us choosing the threshold.
    """
    pane = _pane(html, PANE_KHADI)
    rows = _rows(pane)
    if not rows:
        return [], []
    stations = []
    for head in rows[0][1:]:
        m = _KHADI_HEAD.search(head)
        if not m:
            continue
        stations.append(
            {
                "id": re.sub(r"[^a-z0-9]+", "-", m.group("name").lower()).strip("-"),
                "name": m.group("name").strip(),
                "zone": f"{m.group('zone').strip()} Zone",
                "dangerLevelM": float(m.group("dl")),
            }
        )
    readings = []
    for cells in rows[1:]:
        if len(cells) < 2:
            continue
        ts = _ts(cells[0])
        if not ts:
            continue
        levels = {}
        for station, cell in zip(stations, cells[1:]):
            v = _num(cell)
            if v is not None:
                levels[station["id"]] = v
        if levels:
            readings.append({"observedAt": ts, "levelsM": levels})
    readings.sort(key=lambda r: r["observedAt"], reverse=True)
    return stations, readings


def build(html: str) -> dict[str, Any]:
    ukai, frl = parse_ukai(html)
    weir, overflow, causeway_state = parse_weir(html)
    zone_rain = parse_zone_rainfall(html)
    total_rain = parse_total_rainfall(html)
    khadi_stations, khadi_readings = parse_khadis(html)

    lu = _LAST_UPDATED.search(html)

    latest_ukai = ukai[0] if ukai else None
    latest_weir = weir[0] if weir else None
    latest_khadi = khadi_readings[0] if khadi_readings else None
    latest_zone = zone_rain[0] if zone_rain else None

    khadis = []
    for st in khadi_stations:
        level = (latest_khadi or {}).get("levelsM", {}).get(st["id"])
        khadis.append(
            {
                **st,
                "levelM": level,
                "headroomM": (
                    round(st["dangerLevelM"] - level, 2) if level is not None else None
                ),
                "observedAt": (latest_khadi or {}).get("observedAt"),
            }
        )

    return {
        "_doc": [
            "Surat's live flood chain, scraped from SMC's public rainfall page.",
            "Every threshold here is SMC's own published figure, not ours: the",
            "Ukai full reservoir level, the causeway overflow level, and the",
            "danger level for each khadi. Headroom is the only derived number",
            "and it is a subtraction.",
            "The source page keeps a rolling window of ~10 readings with no",
            "archive, so `history` accumulates only from the day this scraper",
            "first ran and can never be backfilled.",
        ],
        "generatedAt": datetime.now(IST).isoformat(),
        "source": {
            "publisher": "Surat Municipal Corporation",
            "url": SMC_URL,
            "licence": "Public government website",
            "attribution": "Dam and weir rows: SMC cites Irrigation Dept / Collector Office.",
            "lastUpdatedOnPage": lu.group(1).strip() if lu else None,
        },
        "ukai": {
            "name": "Ukai dam",
            "fullReservoirLevelFt": frl,
            "levelFt": (latest_ukai or {}).get("levelFt"),
            "inflowCusec": (latest_ukai or {}).get("inflowCusec"),
            "outflowCusec": (latest_ukai or {}).get("outflowCusec"),
            "headroomFt": (
                round(frl - latest_ukai["levelFt"], 2)
                if frl is not None and latest_ukai and latest_ukai.get("levelFt") is not None
                else None
            ),
            "observedAt": (latest_ukai or {}).get("observedAt"),
            "operatedBy": "Gujarat Water Resources Department (not SMC)",
        },
        "weir": {
            "name": "Weir-cum-causeway",
            "overflowLevelM": overflow,
            "levelM": (latest_weir or {}).get("levelM"),
            "outflowCusec": (latest_weir or {}).get("outflowCusec"),
            "headroomM": (
                round(overflow - latest_weir["levelM"], 2)
                if overflow is not None and latest_weir and latest_weir.get("levelM") is not None
                else None
            ),
            "causewayState": causeway_state,
            "observedAt": (latest_weir or {}).get("observedAt"),
        },
        "khadis": khadis,
        "rainfall": {
            "zonesMm": (latest_zone or {}).get("zonesMm", {}),
            "observedAt": (latest_zone or {}).get("observedAt"),
            "seasonTotalMm": (total_rain[0]["totalMm"] if total_rain else None),
            "seasonTotalObservedAt": (total_rain[0]["observedAt"] if total_rain else None),
        },
        "window": {
            "ukai": ukai,
            "weir": weir,
            "zoneRainfall": zone_rain,
            "totalRainfall": total_rain,
            "khadiReadings": khadi_readings,
        },
    }


def merge_history(existing: dict[str, Any] | None, snapshot: dict[str, Any]) -> dict[str, Any]:
    """Append the scraped window to the durable series, keyed by timestamp.

    Idempotent: re-running on the same day adds nothing new. This is what turns
    a rolling ten-row window into an archive.
    """
    hist = existing or {}
    series = hist.get("series") or {}
    for key in ("ukai", "weir", "zoneRainfall", "totalRainfall", "khadiReadings"):
        by_ts = {r["observedAt"]: r for r in series.get(key, [])}
        for reading in snapshot["window"].get(key, []):
            by_ts[reading["observedAt"]] = reading
        series[key] = sorted(by_ts.values(), key=lambda r: r["observedAt"])
    return {
        "_doc": [
            "Durable archive of SMC's rolling flood-chain window.",
            "SMC publishes ~10 readings and no archive, so this file is the",
            "only record that the readings before today ever existed. It grows",
            "by whatever the daily job catches and has no pre-history.",
        ],
        "stations": snapshot.get("khadis", []),
        "firstObserved": min(
            (s[0]["observedAt"] for s in series.values() if s), default=None
        ),
        "lastObserved": max(
            (s[-1]["observedAt"] for s in series.values() if s), default=None
        ),
        "series": series,
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True, help="snapshot artifact path")
    ap.add_argument("--history", help="durable append-only series path")
    ap.add_argument("--from-file", help="parse a saved HTML file instead of fetching")
    args = ap.parse_args()

    html = (
        open(args.from_file, encoding="utf-8", errors="replace").read()
        if args.from_file
        else fetch()
    )

    snapshot = build(html)

    if snapshot["ukai"]["levelFt"] is None and not snapshot["khadis"]:
        print("ERROR: parsed neither a dam level nor any khadi - page shape changed", file=sys.stderr)
        return 1

    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(snapshot, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    print(f"wrote {args.out}")

    if args.history:
        try:
            with open(args.history, encoding="utf-8") as fh:
                existing = json.load(fh)
        except FileNotFoundError:
            existing = None
        merged = merge_history(existing, snapshot)
        with open(args.history, "w", encoding="utf-8") as fh:
            json.dump(merged, fh, indent=2, ensure_ascii=False)
            fh.write("\n")
        counts = {k: len(v) for k, v in merged["series"].items()}
        print(f"wrote {args.history} ({counts})")

    u, w = snapshot["ukai"], snapshot["weir"]
    print(f"  Ukai {u['levelFt']} ft (FRL {u['fullReservoirLevelFt']}), outflow {u['outflowCusec']} cusec")
    print(f"  Weir {w['levelM']} m (overflow {w['overflowLevelM']}), causeway {w['causewayState']}")
    for k in snapshot["khadis"]:
        print(f"  {k['name']}: {k['levelM']} m, danger {k['dangerLevelM']} m, headroom {k['headroomM']} m")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
