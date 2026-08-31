#!/usr/bin/env python3
"""Attach India-WRIS flow/level series to a basin's flow-stations family
(station-readings contract v1 - docs/specs/flow-stations-contract.md).

Pulls River Water Discharge + River Water Level from the WRIS Dataset API
(district-looped, year-chunked, cached), joins rows to flow-stations by the
station NAME the API uses (its CDBNG-style codes never match classic CWC site
codes), precomputes every series kind, and writes:
  - <basin-dir>/readings/<stationKey>.json   (one pack per station)
  - <basin-dir>/flow-stations.geojson        (hasReadings/readingsFrom/To updated,
                                              reservoir gauges appended from config)

Generic: a new basin is a new flow-config, not new code.

Usage:
    python3 scripts/build_basin_flow_readings.py \
        public/data/basins/kabini scripts/basin-sources/kabini-flow.json
"""

from __future__ import annotations

import datetime as dt
import json
import statistics
import sys
import time
import urllib.parse
import urllib.request
from collections import defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import merge_envelope, write_artifact  # noqa: E402  (envelopes survive re-runs)
from registry_license import registry_license  # noqa: E402

API = "https://indiawris.gov.in/Dataset/"
SOURCE_LABEL = "India-WRIS Dataset API, CWC hydrological observations"
SOURCE_URL = "https://indiawris.gov.in/wris/"
PAGE_SIZE = 9000
MAX_PAGES = 12

DISCHARGE_TYPES = {"QOB", "QCO"}  # observed preferred over computed per day
LEVEL_TYPES = {"HHS", "HZS", "HHT", "HZF"}


# When the Dataset API stops answering, every remaining request still costs a
# full timeout - 72 of them on this basin, which is over an hour of waiting to
# learn something the third failure already told us. After this many
# consecutive transport failures the run stops asking and falls back to the
# packs already on disk.
OUTAGE_AFTER = 3
_consecutive_failures = 0
_source_down = False


def fetch_year(cache_dir: Path, dataset: str, state: str, district: str, year: int) -> list[dict]:
    """One (dataset, district, year) pull, paginated + cached.

    Closed years are cached forever; the current AND previous year are always
    re-fetched - CWC publishes discharge in arrears, so both can still grow.
    Without this, a scheduled re-run would serve the stale cache and never see
    new data (docs/specs/deep-dive-maintenance-model.md)."""
    global _consecutive_failures, _source_down
    # State is part of the key: the stateDistricts loop can query the same
    # district name under two states, and a cache hit across them would serve
    # the wrong state's rows.
    key = f"{dataset.replace(' ', '_')}--{state.replace(' ', '_')}--{district.replace(' ', '_')}--{year}"
    cf = cache_dir / f"{key}.json"
    if cf.exists() and year < dt.date.today().year - 1:
        return json.loads(cf.read_text())
    if _source_down:
        return json.loads(cf.read_text()) if cf.exists() else []
    rows: list[dict] = []
    for page in range(MAX_PAGES):
        qs = urllib.parse.urlencode({
            "stateName": state, "districtName": district, "agencyName": "CWC",
            "startdate": f"{year}-01-01", "enddate": f"{year}-12-31",
            "download": "false", "page": page, "size": PAGE_SIZE,
        })
        req = urllib.request.Request(f"{API}{urllib.parse.quote(dataset)}?{qs}",
                                     method="POST", headers={"accept": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=90) as r:
                batch = json.loads(r.read().decode()).get("data") or []
        except Exception as e:  # noqa: BLE001 - a failed year is retried next run
            print(f"    ! {dataset} {district} {year} p{page}: {e}")
            _consecutive_failures += 1
            if _consecutive_failures >= OUTAGE_AFTER:
                _source_down = True
                print(f"    ! {_consecutive_failures} requests in a row failed - "
                      f"treating India-WRIS as down and using what is already cached")
            return rows  # do NOT cache partial years
        _consecutive_failures = 0
        rows += batch
        if len(batch) < PAGE_SIZE:
            break
        time.sleep(0.3)
    cf.write_text(json.dumps(rows))
    time.sleep(0.3)
    return rows


def water_year(d: dt.date, start_month: int) -> str:
    y = d.year if d.month >= start_month else d.year - 1
    return f"{y}-{str(y + 1)[2:]}"


def month_key(d: dt.date) -> str:
    return f"{d.year}-{d.month:02d}"


def build_series(daily_q: dict, level_rows: list, cfg: dict, today: dt.date) -> list[dict]:
    """Precompute every series kind from per-day discharge + raw level rows."""
    series: list[dict] = []
    wy_start = cfg.get("waterYearStartMonth", 6)
    freshness = cfg.get("levelFreshnessNote")

    if daily_q:
        days = sorted(daily_q)
        values = [daily_q[d] for d in days]

        by_month: dict[str, list[float]] = defaultdict(list)
        by_cal_month: dict[int, list[float]] = defaultdict(list)
        by_wy: dict[str, list[float]] = defaultdict(list)
        for d in days:
            by_month[month_key(d)].append(daily_q[d])
            by_cal_month[d.month].append(daily_q[d])
            by_wy[water_year(d, wy_start)].append(daily_q[d])

        # Aggregated points carry the day-count behind each value as a third
        # element: a month averaged from 3 readings is not a month averaged
        # from 31, and the chart should let a reader tell them apart
        # (Madhuri review, 31 Aug 2026).
        series.append({
            "kind": "discharge-monthly", "unit": "cumec", "verified": True,
            "label": "Monthly mean discharge",
            "note": "Mean of daily CWC observed/computed discharge; months with any data shown - hover for how many daily readings each month holds.",
            "points": [[m, round(statistics.fmean(v), 2), len(v)] for m, v in sorted(by_month.items())],
        })

        cutoff = today.replace(year=today.year - 3)
        recent = [(d, q) for d, q in zip(days, values) if d >= cutoff]
        if recent:
            series.append({
                "kind": "discharge-daily", "unit": "cumec", "verified": True,
                "label": "Daily discharge (last 3 years)",
                "note": "CWC publishes discharge in arrears - recent months may be empty at the source.",
                "points": [[d.isoformat(), round(q, 2)] for d, q in recent],
            })

        months = []
        for m in range(1, 13):
            vals = sorted(by_cal_month.get(m, []))
            if len(vals) < 5:
                continue
            months.append({"m": m,
                           "p25": round(vals[len(vals) // 4], 2),
                           "median": round(statistics.median(vals), 2),
                           "p75": round(vals[(3 * len(vals)) // 4], 2),
                           "n": len(vals)})
        if months:
            series.append({
                "kind": "climatology-monthly", "unit": "cumec", "verified": True,
                "label": "Seasonality (daily discharge by calendar month)",
                "note": f"p25/median/p75 of daily discharge, {days[0].year}-{days[-1].year}.",
                "months": months,
            })

        ranked = sorted(values, reverse=True)
        n = len(ranked)
        if n >= 50:
            exceed = []
            for pct in (1, 5, 10, 20, 30, 40, 50, 60, 70, 80, 90, 95, 99):
                exceed.append([pct, round(ranked[min(n - 1, max(0, int(n * pct / 100) - 1))], 2)])
            series.append({
                "kind": "flow-duration", "unit": "cumec", "verified": True,
                "label": "Flow-duration curve",
                "note": f"Exceedances calculated from {n:,} daily flow observations, "
                        f"{days[0].year}-{days[-1].year}.",
                "exceedance": exceed,
            })

        wy_pts = [[wy, round(statistics.fmean(v), 2), len(v)]
                  for wy, v in sorted(by_wy.items()) if len(v) >= 60]
        if len(wy_pts) >= 2:
            lta = round(statistics.fmean(p[1] for p in wy_pts), 2)
            series.append({
                "kind": "annual-water-year", "unit": "cumec", "verified": True,
                "label": "Water-year mean discharge vs long-term average",
                "note": f"Water year starts 01-{wy_start:02d}; long-term average {lta} cumec "
                        "over the years shown (dashed line); years with under 60 daily "
                        "readings omitted.",
                "points": wy_pts,
            })

    if level_rows:
        by_month_lvl: dict[str, list[float]] = defaultdict(list)
        for row in level_rows:
            d = dt.date.fromisoformat(row["dataTime"][:10])
            by_month_lvl[month_key(d)].append(row["dataValue"])
        pts = [[m, round(statistics.fmean(v), 2), len(v)] for m, v in sorted(by_month_lvl.items())]
        if pts:
            series.append({
                "kind": "gauge-level-monthly", "unit": "m", "verified": True,
                "label": "Monthly mean gauge level",
                "note": freshness or "Hourly CWC telemetry averaged per month.",
                "points": pts,
            })
    return series


def main() -> None:
    if len(sys.argv) < 3:
        sys.exit("usage: build_basin_flow_readings.py <basin-dir> <flow-config.json>")
    basin_dir = REPO / sys.argv[1]
    cfg = json.loads((REPO / sys.argv[2]).read_text())
    stations_fp = basin_dir / "flow-stations.geojson"
    fc = json.loads(stations_fp.read_text())
    today = dt.date.today()

    cache_dir = REPO / ".cache" / "wris-flow" / basin_dir.name
    cache_dir.mkdir(parents=True, exist_ok=True)

    # stationKey -> the name the WRIS API uses (join is by name, never by code).
    name_of = {s["stationKey"]: s["wrisName"] for s in cfg["stations"]}
    # Config coordinates are authoritative: they place each extra station at
    # insertion, and backfill a feature that predates that rule. The API's row
    # coordinates only place stations the config leaves without any.
    cfg_coords = {s["stationKey"]: s["coordinates"]
                  for s in cfg.get("extraStations", []) if s.get("coordinates")}

    # Reservoir gauges etc. that the partner file does not carry: append them.
    existing = {f["properties"]["stationKey"] for f in fc["features"]}
    for extra in cfg.get("extraStations", []):
        if extra["stationKey"] not in existing:
            # Config coordinates are used AT INSERTION, not just as an API
            # fallback: a station added during a source outage would otherwise
            # ship with null geometry and never reach the map at all.
            coords = extra.get("coordinates")
            props = {"stationKey": extra["stationKey"], "name": extra["name"],
                     "agency": "CWC", "siteType": extra.get("siteType", ""),
                     "river": extra.get("river", ""), "hasReadings": False}
            for k in ("state", "note"):
                if extra.get(k):
                    props[k] = extra[k]
            fc["features"].append({
                "type": "Feature",
                "geometry": {"type": "Point", "coordinates": coords} if coords else None,
                "properties": props,
            })
            name_of[extra["stationKey"]] = extra["wrisName"]

    # Pull everything once, bucketing rows per WRIS station name.
    start_q = int(cfg.get("dischargeFrom", "2015")[:4])
    start_l = int(cfg.get("levelFrom", "2023")[:4])
    q_rows: dict[str, list] = defaultdict(list)
    l_rows: dict[str, list] = defaultdict(list)
    wanted = {v.upper() for v in name_of.values()}
    basin_name = cfg.get("majorBasin", "Cauvery")

    # A basin can cross a state line, so the query loops states as well as
    # districts. cfg["state"]/["districts"] stay the single-state shorthand.
    state_districts = cfg.get("stateDistricts") or {cfg["state"]: cfg["districts"]}
    for _state, _districts in state_districts.items():
     for district in _districts:
        for dataset, start, sink in (("River Water Discharge", start_q, q_rows),
                                     ("River Water Level", start_l, l_rows)):
            for year in range(start, today.year + 1):
                rows = fetch_year(cache_dir, dataset, _state, district, year)
                n = 0
                for row in rows:
                    if row.get("majorBasin") != basin_name:
                        continue
                    nm = (row.get("stationName") or "").upper()
                    if nm in wanted and isinstance(row.get("dataValue"), (int, float)):
                        sink[nm].append(row)
                        n += 1
                if rows:
                    print(f"  {dataset[:23]:23} {district:14} {year}: {len(rows):6} rows, {n:5} kept")

    (basin_dir / "readings").mkdir(exist_ok=True)
    fetched = today.isoformat()
    for feat in fc["features"]:
        props = feat["properties"]
        wname = (name_of.get(props["stationKey"]) or "").upper()
        rows_q = q_rows.get(wname, [])
        rows_l = l_rows.get(wname, [])
        pack_path = basin_dir / "readings" / f"{props['stationKey']}.json"

        if not rows_q and not rows_l:
            # Nothing came back. That is either a station WRIS has no data for,
            # or - as on 23 Aug 2026, when the Dataset API stopped answering
            # altogether - a source outage. If a pack is already on disk, carry
            # it forward rather than leaving the station flagged as having no
            # readings with an orphaned pack beside it. The pack's own
            # source.fetched still records when the data was really pulled, so
            # nothing here claims to be fresher than it is.
            if pack_path.exists():
                prev = json.loads(pack_path.read_text())
                period = prev.get("period") or {}
                props["hasReadings"] = True
                props["readingsFrom"] = period.get("from")
                props["readingsTo"] = period.get("to")
                # A pack exists, so the pending flag and the config note (which
                # explains why the series are missing) are stale here too.
                props.pop("readingsPending", None)
                props.pop("note", None)
                if feat.get("geometry") is None:
                    coords = (cfg_coords or {}).get(props["stationKey"])
                    if coords:
                        feat["geometry"] = {"type": "Point", "coordinates": coords}
                print(f"  keep {props['stationKey']:12} {props['name']:22} "
                      f"existing pack, fetched {prev.get('source', {}).get('fetched', '?')} "
                      f"(no rows from the API this run)")
            continue

        if feat.get("geometry") is None:
            r0 = (rows_q or rows_l)[0]
            feat["geometry"] = {"type": "Point",
                                "coordinates": [round(r0["longitude"], 5), round(r0["latitude"], 5)]}

        # One value per day: observed (QOB) wins over computed (QCO).
        daily: dict[dt.date, float] = {}
        pref: dict[dt.date, str] = {}
        for row in rows_q:
            if row.get("datatypeCode") not in DISCHARGE_TYPES:
                continue
            d = dt.date.fromisoformat(row["dataTime"][:10])
            code = row["datatypeCode"]
            if d not in daily or (code == "QOB" and pref[d] != "QOB"):
                daily[d], pref[d] = float(row["dataValue"]), code

        level = [r for r in rows_l if r.get("datatypeCode") in LEVEL_TYPES]
        series = build_series(daily, level, cfg, today)
        if not series:
            continue

        all_dates = sorted([d.isoformat() for d in daily] +
                           [r["dataTime"][:10] for r in level])
        pack = {
            "schemaVersion": 1,
            "station": {"stationKey": props["stationKey"], "name": props["name"],
                        "agency": props.get("agency", "CWC"),
                        "siteType": props.get("siteType"), "river": props.get("river")},
            "source": {"label": SOURCE_LABEL, "url": SOURCE_URL,
                       "fetched": fetched, "licence": registry_license("wris-live-services")},
            "period": {"from": all_dates[0], "to": all_dates[-1],
                       "waterYear": f"starts month {cfg.get('waterYearStartMonth', 6):02d}"},
            "series": series,
        }
        pack_path = basin_dir / "readings" / f"{props['stationKey']}.json"
        pack_path.write_text(json.dumps(merge_envelope(pack_path, pack), separators=(",", ":")))
        props["hasReadings"] = True
        props["readingsFrom"], props["readingsTo"] = all_dates[0], all_dates[-1]
        # The readings attached: drop the pending flag from any earlier run,
        # and the config note that explained the series' absence.
        props.pop("readingsPending", None)
        props.pop("note", None)
        print(f"  pack {props['stationKey']:12} {props['name']:22} "
              f"{len(series)} series, {len(daily):5} discharge days, {len(level):6} level rows")

    # Configured stations with no series yet DO ship, marked pending, so the
    # map shows the gauge network as it exists rather than only the parts we
    # managed to fetch. They render hollow and their panel says why - the
    # absence is ours (the source was unreachable), not the register's.
    keys = {e["stationKey"] for e in cfg.get("extraStations", [])}
    pending = [f for f in fc["features"]
               if not f["properties"].get("hasReadings") and f["properties"]["stationKey"] in keys]
    for f in pending:
        f["properties"]["readingsPending"] = True
        print(f"  PENDING {f['properties']['name']:20s} shipped without readings "
              f"(source unreachable); a re-run attaches them")

    stations_fp.write_text(json.dumps(merge_envelope(stations_fp, fc), separators=(",", ":")))
    # This script owns flow-stations.geojson, so it owns that family's TOTALS
    # (featureCount/bytes - the map showed 3 stations under a label saying 2
    # until it did; review, 27 Aug) and one source row: the gauges it appends
    # from the flow config. The rows the ingest wrote for staged files keep
    # their own counts and provenance - that text carries each basin's own
    # citations, which are the ingest manifest's to state, not this script's
    # to rewrite.
    inv_fp = basin_dir / "inventory.json"
    if inv_fp.exists():
        inv = json.loads(inv_fp.read_text())
        fam = inv.get("families", {}).get("flow-stations")
        if fam is not None:
            fam["featureCount"] = len(fc["features"])
            fam["bytes"] = stations_fp.stat().st_size
            sources = fam.setdefault("sources", [])
            cfg_name = Path(sys.argv[2]).name
            extras = [f for f in fc["features"] if f["properties"]["stationKey"] in keys]
            row = next((s for s in sources if s.get("file") == cfg_name), None)
            if extras:
                if row is None:
                    row = {"file": cfg_name, "kind": None}
                    sources.append(row)
                held = (f" {len(pending)} of them ship{'s' if len(pending) == 1 else ''} "
                        "pending readings; a re-run attaches the series once India-WRIS "
                        "answers.") if pending else ""
                row["count"] = len(extras)
                row["provenance"] = (
                    f"Gauges appended from scripts/basin-sources/{cfg_name} - stations the "
                    "staged partner file does not carry. hasReadings and the readings packs "
                    "are attached by scripts/build_basin_flow_readings.py from India-WRIS "
                    "pulls." + held)
            elif row is not None:
                sources.remove(row)
            write_artifact(inv_fp, inv, indent=1)
            print(f"  inventory: flow-stations featureCount -> {len(fc['features'])}")

    n_ready = sum(1 for f in fc["features"] if f["properties"].get("hasReadings"))
    print(f"\n{n_ready}/{len(fc['features'])} stations have readings -> {stations_fp.relative_to(REPO)}")
    if _source_down:
        print("India-WRIS did not answer this run. Existing packs were carried "
              "forward unchanged; re-run when the source is back to refresh them.")


if __name__ == "__main__":
    main()
