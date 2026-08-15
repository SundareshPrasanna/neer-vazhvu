#!/usr/bin/env python3
"""
Build Gurugram's supply overview from GMDA's OWN asset register.

WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN JSON. Every supply figure in
circulation for this city is press-sourced, and the two most-quoted ones are
contradicted by the authority's own GIS. Reading the capacities out of that GIS
at build time means the artifact cannot drift from what GMDA publishes, and a
future change on their side shows up as a diff rather than as a number nobody
can source.

THE DISAGREEMENT THIS ARTIFACT EXISTS TO STATE HONESTLY
-------------------------------------------------------
GMDA's OneMap asset layer `Wet_Infrastructure_caching/WTP Location` publishes:

    Chandu Budhera Water Treatment Plant    300 MLD
    Basai Water Treatment Plant             272 MLD
                                            --- 572 MLD installed

Press coverage consistently reports 400 + 270 = 670 MLD, and describes a fifth
unit at Chandu Budhera taking it to 500 MLD by March 2026. Those cannot both be
current.

We publish GMDA's own figure as the headline because it is the authority's own
asset register rather than a newspaper's summary, and we say plainly that the
GIS layer carries no revision date, so it may predate the fifth unit. What we do
NOT do is average them, pick the bigger one, or quietly prefer the press number
because it is more recent-sounding. Both are on the page with their sourcing.

NO DEMAND FIGURE, THEREFORE NO DEFICIT. The "675-700 MLD peak demand" that
circulates has no primary source we have been able to reach: GMDA's Final
Development Plan and Social Infrastructure Development Plan are scanned PDFs
with no text layer, and no GMDA page publishes a demand series. So this artifact
carries supply and infrastructure only. A supply-minus-demand gap is exactly the
kind of number that would get quoted back at us, and we cannot stand behind
either side of that subtraction.

Run
---
    cd neer-vazhvu-api
    python3 scripts/build_gurugram_supply.py \
        --out ../public/data/gurugram-supply-overview.json
"""

from __future__ import annotations

import argparse
import json
import ssl
import sys
import urllib.parse
import urllib.request
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[2] / "scripts"))
from registry_license import registry_license  # noqa: E402
from nvdm_write import write_artifact  # noqa: E402

SOURCE_ID = "gmda-onemap-arcgis"
BASE = "https://onemapdepts.gmda.gov.in/server/rest/services"
WET = "Wet_Infrastructure_caching/MapServer"

# Same narrow TLS concession as harvest_arcgis_rest.py: this host does not
# implement RFC 5746 renegotiation. Certificate and hostname verification stay
# fully on, asserted below.
_CTX = ssl.create_default_context()
_CTX.options |= getattr(ssl, "OP_LEGACY_SERVER_CONNECT", 0x4)
assert _CTX.verify_mode == ssl.CERT_REQUIRED
assert _CTX.check_hostname


def _query(layer: int, fields: str = "*") -> list[dict]:
    q = urllib.parse.urlencode(
        {"where": "1=1", "outFields": fields, "returnGeometry": "false", "f": "json"}
    )
    req = urllib.request.Request(
        f"{BASE}/{WET}/{layer}/query?{q}",
        headers={"User-Agent": "neervazhvu-ggm-supply"},
    )
    with urllib.request.urlopen(req, timeout=120, context=_CTX) as r:
        doc = json.loads(r.read())
    if doc.get("error"):
        raise RuntimeError(f"ArcGIS error: {doc['error'].get('message')}")
    return [f["attributes"] for f in doc.get("features", [])]


def build() -> dict:
    wtps = _query(18, "name,capacity_m")
    tubewells = _query(5, "objectid")
    ugts = _query(3, "objectid")
    network = _query(9, "objectid")

    # The WTP layer mixes true treatment plants with boosting stations. Split
    # on capacity: the two plants are an order of magnitude larger than the
    # 11 MLD boosters, and conflating them would inflate treatment capacity.
    plants, boosters = [], []
    for w in wtps:
        name = (w.get("name") or "").strip()
        try:
            cap = float(str(w.get("capacity_m") or "").strip())
        except ValueError:
            continue
        (boosters if "boosting" in name.lower() else plants).append((name, cap))

    if not plants:
        raise RuntimeError("no treatment plants found - the WTP layer changed shape")

    installed = sum(c for _, c in plants)

    mix = [
        {
            "source": "Yamuna, via the NCR channel and the Gurugram Water Supply Channel",
            "scheme": name,
            "mld": int(cap) if cap == int(cap) else cap,
            "annual_mcft": None,
            "supplies": "GMDA bulk supply to MCG and the sectors",
            "note": (
                "Capacity as published in GMDA's own OneMap asset register "
                "(Wet_Infrastructure_caching / WTP Location). The layer carries no "
                "revision date."
            ),
            "_provenance": "GMDA_ONEMAP",
        }
        for name, cap in sorted(plants, key=lambda p: -p[1])
    ]

    return {
        "_note": (
            "Structural at-a-glance facts for Gurugram's urban water supply. Gurugram has no "
            "river and impounds nothing: its water arrives by canal from the Yamuna, from "
            "municipal tubewells, and by tanker. Capacities here are read at build time from "
            "GMDA's own GIS asset register rather than transcribed, so they cannot drift from "
            "what the authority publishes."
        ),
        # hero_copy, NOT _view_overrides. The cauvery-pumping hero falls back to
        # the pump.* i18n strings, which carry BANGALORE'S narrative - Cauvery,
        # TK Halli, Kempe Gowda's kere network, the three valleys. Omitting this
        # block does not produce a generic hero; it produces Bengaluru's story
        # under Gurugram's name. Verified by rendering: the first draft of this
        # artifact told Gurugram readers their water climbs 500 m from the
        # Cauvery 95 km away.
        "hero_copy": {
            "headline": "Canal water, a dark-zone aquifer, and a tanker market in between",
            "body": (
                "Gurugram has no river. It impounds nothing, and it treats no water it owns: the "
                "Yamuna arrives by canal through the Kakroi headworks and the NCR channel, is "
                "treated at Chandu Budhera and Basai, and is pushed out through GMDA's network. "
                "Everything the pipes do not reach comes out of the ground - the Central Ground "
                "Water Authority declared this a dark zone in 2008, and the district now extracts "
                "194.59% of what recharges it - or arrives on a tanker. That is the whole system: "
                "a canal, an over-drawn aquifer, and a priced market covering the gap between them."
            ),
            "wtp_label": "GMDA treatment capacity",
            "wtp_sub": (
                "Chandu Budhera 300 + Basai 272, as GMDA's own asset register publishes them. "
                "Press reports 670 MLD; see the caveats below."
            ),
            "footer": (
                "Capacities and asset counts are read from GMDA's OneMap asset register at build "
                "time. No demand figure is shown because none is primary-sourced, so no "
                "supply-minus-demand gap is computed."
            ),
        },
        "_data_provenance_caveats": [
            "TREATMENT CAPACITY IS CONTESTED, and this page shows GMDA's own figure rather than "
            f"the widely-quoted one. GMDA's OneMap asset register publishes {int(installed)} MLD "
            "installed (Chandu Budhera 300, Basai 272). Press coverage consistently reports 670 "
            "MLD (400 + 270) and describes a fifth unit at Chandu Budhera raising Chandu Budhera "
            "to 500 MLD by March 2026. Both cannot be current. We publish the authority's own "
            "asset register and flag that it carries no revision date, so it may predate that "
            "fifth unit.",
            "NO DEMAND FIGURE, AND THEREFORE NO DEFICIT. The '675-700 MLD peak demand' that "
            "circulates has no primary source we could reach - GMDA's Final Development Plan and "
            "Social Infrastructure Development Plan are scanned PDFs with no text layer, and no "
            "GMDA page publishes a demand series. Supply minus demand is precisely the number "
            "that would be quoted back at us, so it is absent rather than estimated.",
            "The tubewell count is GMDA's mapped municipal fleet. It is NOT the number of "
            "borewells in Gurugram: private and unauthorised extraction is the larger share and "
            "is unmapped, which is part of why the district sits at 194.59% of recharge.",
        ],
        "supply_chain": [
            "Yamuna at the Kakroi headworks",
            "NCR channel / Gurugram Water Supply Channel",
            "Chandu Budhera and Basai water treatment plants",
            "GMDA master water supply network and boosting stations",
            "MCG distribution, underground tanks, and municipal tubewells",
        ],
        "current_supply_mix_mld": mix,
        "current_supply_total_mld": int(installed),
        "_supply_total_note": (
            f"{int(installed)} MLD = the sum of the two treatment plants' capacities as GMDA's "
            "asset register publishes them. Boosting stations "
            f"({len(boosters)} mapped, {int(sum(c for _, c in boosters))} MLD combined) are "
            "excluded: they re-pressurise treated water rather than treating it, so counting "
            "them would double-count the same litres."
        ),
        "groundwater": {
            "_note": (
                "Gurugram has been a Central Ground Water Authority dark zone since 2008. The "
                "assessment, not the level record, is the current picture: India-WRIS levels for "
                "this district stop in June 2020 and there is no telemetry."
            ),
            "official_label": "IN-GRES dynamic assessment, 2024-25 (CGWB + Haryana)",
            "official_note": (
                "Gurugram district extracts 194.59% of its annual recharge and is categorised "
                "over-exploited. All five assessment blocks are over-exploited; the built city "
                "(GURGAON_URBAN) is worst at 326.26%. Haryana as a whole is 136.75%."
            ),
            "municipal_tubewells": len(tubewells),
            "municipal_tubewells_note": (
                "Tubewells mapped in GMDA's asset register. The layer publishes no per-well "
                "capacity, so no groundwater MLD is derived from it."
            ),
        },
        "distribution": {
            "underground_tanks": len(ugts),
            "master_network_segments": len(network),
            "note": (
                "Counts from GMDA's OneMap asset register. Segment count is a network-extent "
                "measure, not a length in km."
            ),
        },
        "_sources": [
            {
                "id": SOURCE_ID,
                "title": "GMDA OneMap asset register - WTP Location, Tubewell, UGT, Master Water Supply Network",
                "publisher": "Gurugram Metropolitan Development Authority (OneMap GGM)",
                "url": f"{BASE}/{WET}",
            }
        ],
    }


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--out", required=True)
    args = ap.parse_args()

    payload = build()
    envelope = {
        "nvdm": "1.0",
        "dataset": "data-root/supply-overview",
        "scope": {"kind": "city", "id": "gurugram"},
        "provenance": {
            "sources": [
                {
                    "id": SOURCE_ID,
                    "title": "GMDA OneMap asset register (ArcGIS REST)",
                    "publisher": "Gurugram Metropolitan Development Authority (OneMap GGM)",
                    "license": registry_license(SOURCE_ID),
                }
            ],
            "method": "api",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/build_gurugram_supply.py",
            "note": (
                "Capacities and asset counts read from the publisher's own GIS at build time "
                "rather than transcribed. Carries no demand figure: none is primary-sourced, so "
                "no supply-minus-demand gap is computed."
            ),
        },
    }
    write_artifact(Path(args.out), {**envelope, **payload})
    print(
        f"wrote {args.out}: {payload['current_supply_total_mld']} MLD installed across "
        f"{len(payload['current_supply_mix_mld'])} plants, "
        f"{payload['groundwater']['municipal_tubewells']} tubewells",
        file=sys.stderr,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
