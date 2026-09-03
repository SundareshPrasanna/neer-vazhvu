"""
Froth SIGNATURE capability (Tier-1, S2 lower-bound) for a rich-data body.
Generic across rich bodies via --body-id.

Turns the curated "foam at the weir" narrative into a measured froth-
frequency signal: how often froth is detected at the weir sub-zone, its
seasonality, and annual trend - from the per-pass froth fractions the
STATE capability already produced (no GEE re-run).

HONEST CEILING: at Sentinel-2 10m a small froth raft is 1-2 mixed pixels,
so this is a LOWER BOUND - it under-counts. Reliable froth quantification
needs high-res (PlanetScope 3m / Cartosat), which is a gated data-access
action (Planet E&R application), NOT done here. NICFI's free Planet
mosaics are monthly and wash out episodic froth, so they do not help.

Output: public/data/rich-bodies/<body_id>-pollution-froth.json

  python scripts/verify_rich_body_pollution_froth.py --body-id bellandur
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent

FROTH_EVENT_THRESH = 0.10   # weir froth fraction >= this => froth event
WEIR_KINDS = {"weir", "outflow"}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--body-id", required=True)
    ap.add_argument("--zone", default="weir", help="sub-zone key to read froth from")
    args = ap.parse_args()

    state_path = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-state.json"
    if not state_path.exists():
        print(f"FAILED: {state_path} missing - run the STATE capability first.", file=sys.stderr)
        sys.exit(1)
    state = json.loads(state_path.read_text())

    scenes = [s for s in state["by_zone"].get(args.zone, {}).get("scenes", [])
              if not s.get("low_confidence") and s.get("frac_froth") is not None]
    if not scenes:
        print(f"No usable {args.zone} scenes with froth data.")
        return
    scenes.sort(key=lambda s: s["date"])

    events = [s for s in scenes if s["frac_froth"] >= FROTH_EVENT_THRESH]

    # annual frequency
    yr_scenes: dict[str, list] = defaultdict(list)
    for s in scenes:
        yr_scenes[s["date"][:4]].append(s)
    annual = {}
    for y, rows in sorted(yr_scenes.items()):
        ev = [r for r in rows if r["frac_froth"] >= FROTH_EVENT_THRESH]
        annual[y] = {
            "n_scenes": len(rows),
            "n_froth_events": len(ev),
            "froth_event_rate_pct": round(100 * len(ev) / len(rows), 1),
            "max_froth_pct": round(100 * max(r["frac_froth"] for r in rows), 1),
        }

    # seasonality (by month)
    mo_froth: dict[int, list] = defaultdict(list)
    for s in scenes:
        mo_froth[int(s["date"][5:7])].append(s["frac_froth"])
    seasonality = {f"{m:02d}": {
        "mean_froth_pct": round(100 * sum(v) / len(v), 1),
        "event_rate_pct": round(100 * sum(1 for x in v if x >= FROTH_EVENT_THRESH) / len(v), 1),
        "n": len(v),
    } for m, v in sorted(mo_froth.items())}

    peak_months = sorted(seasonality, key=lambda m: seasonality[m]["mean_froth_pct"], reverse=True)[:3]

    payload = {
        "body_id": args.body_id,
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "tier": "relative (S2 lower-bound)",
        "zone": args.zone,
        "froth_event_threshold": FROTH_EVENT_THRESH,
        "capability_status": {
            "froth_frequency_s2": "ok (LOWER BOUND - under-counts at 10m)",
            "froth_quantification_highres": "gap: needs PlanetScope/Cartosat - "
                                            "gated on Planet E&R access (not done)",
        },
        "data_source": {
            "from": str(state_path.name),
            "method": f"Froth event = {args.zone} froth fraction >= "
                      f"{FROTH_EVENT_THRESH}; per-pass S2 classification.",
            "known_limitations": [
                "Sentinel-2 10m under-counts small/short froth rafts - this is a lower bound.",
                "Early-2017 froth events have sparse S2 coverage (S2B launched Mar 2017).",
                "High-res (Planet/Cartosat) is the upgrade path; NICFI monthly mosaics do not help.",
            ],
        },
        "n_scenes": len(scenes),
        "n_froth_events": len(events),
        "froth_event_dates": [{"date": s["date"], "froth_pct": round(100 * s["frac_froth"], 1),
                               "valid_px": s["valid_px"]} for s in events],
        "annual": annual,
        "seasonality_by_month": seasonality,
        "headline_for_v0": [
            f"Froth detected at the {args.zone} in {len(events)} of {len(scenes)} clear "
            f"S2 scenes (>={int(100 * FROTH_EVENT_THRESH)}% surface); S2 lower bound.",
            f"Froth concentrates in months {', '.join(peak_months)} "
            f"(mean froth {seasonality[peak_months[0]]['mean_froth_pct']:.0f}% in peak month).",
            "Reliable quantification needs high-res (PlanetScope/Cartosat) - gated on access.",
        ],
    }
    out = ROOT / "public/data/rich-bodies" / f"{args.body_id}-pollution-froth.json"
    out.write_text(json.dumps(payload, indent=2))
    print(f"Wrote {out}\n\n=== Headline ===")
    for line in payload["headline_for_v0"]:
        print(f"  {line}")
    print(f"\nFroth-event dates ({len(events)}):")
    for e in payload["froth_event_dates"]:
        print(f"  {e['date']}  {e['froth_pct']:.0f}%  (valid_px={e['valid_px']})")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        print(f"\nFAILED: {e}", file=sys.stderr)
        sys.exit(1)
