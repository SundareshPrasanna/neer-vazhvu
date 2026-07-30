"""Build public/data/delhi-ward-representatives.json from the MCD 2022
election results (OpenCity-hosted CSV, TCPD-style schema: one row per
candidate; Position=1 is the winner).

Output: one entry per ward (1-250, the post-unification delimitation) with
the winning councillor, party, reservation category, votes and turnout.
Static snapshot of the December 2022 general election to the unified MCD -
by-elections, defections and disqualifications since are NOT reflected
(note carried in-file; refresh path is a re-download + re-run when OpenCity
updates, or a manual patch list).

MLA/MP columns are deferred: the ward->AC mapping lives in the blocked
2022 ward geometry (WNo_SEC/AC_No attributes), so they join in one step
once the OpenCity wards file is restored.

Run: python scripts/build_delhi_ward_reps.py
"""

from __future__ import annotations

import csv
import io
import sys
import urllib.request
from datetime import date
from pathlib import Path

CSV_URL = (
    "https://data.opencity.in/dataset/48981afb-6542-4d34-bc16-bea319ad01a3/"
    "resource/e5f38174-12fc-40e4-88b4-9e34fea0693c/download/"
    "cf14d147-8120-4c97-a76c-50ace78597c5.csv"
)
REPO = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(REPO / "scripts"))
from nvdm_write import write_artifact  # noqa: E402

OUT = REPO / "public/data/delhi-ward-representatives.json"


def num(s: str):
    s = (s or "").strip()
    if not s:
        return None
    try:
        return int(s)
    except ValueError:
        try:
            return round(float(s), 3)
        except ValueError:
            return None


def main() -> None:
    req = urllib.request.Request(
        CSV_URL, headers={"User-Agent": "neer-vazhvu/delhi-onboarding"}
    )
    raw = urllib.request.urlopen(req, timeout=120).read().decode("utf-8-sig")
    rows = list(csv.DictReader(io.StringIO(raw)))
    winners = [r for r in rows if (r.get("Position") or "").strip() == "1"]
    print(f"{len(rows)} candidate rows, {len(winners)} winners")

    wards = []
    for r in sorted(winners, key=lambda r: int(r["Ward_No"])):
        wards.append(
            {
                "ward_no": int(r["Ward_No"]),
                "ward_name": r["Ward_Name"].strip().title(),
                "reservation": (r.get("Ward_Reservation") or "").strip() or None,
                "councillor": {
                    "name": r["Candidate_Name"].strip().title(),
                    "party": r["Party_Name"].strip().title(),
                    "gender": (r.get("Gender") or "").strip() or None,
                    "votes": num(r.get("Votes")),
                    "vote_share_pct": num(r.get("Vote_Share_Percentage")),
                },
                "electors": num(r.get("Total_Electors")),
                "turnout_pct": num(r.get("Voter_Turnout_Percentage")),
            }
        )

    parties: dict[str, int] = {}
    for w in wards:
        p = w["councillor"]["party"]
        parties[p] = parties.get(p, 0) + 1

    # Shape per RepsFile in src/lib/hooks/use-ward-representatives.ts:
    # {meta, wards: {"<ward_no>": {councillor: {...}}}}. MLA/MP are omitted -
    # the ward->AC mapping exists in the ward geometry, but the assembly and
    # parliamentary result sets are not ingested yet, and the component
    # renders councillor-only cleanly.
    keyed = {
        str(w["ward_no"]): {
            "councillor": {
                "name": w["councillor"]["name"],
                "party": w["councillor"]["party"],
                "reservation": w["reservation"],
            }
        }
        for w in wards
    }
    out = {
        "meta": {
            "councillor_election": "2022-12-04",
            "last_updated": date.today().isoformat(),
            "sources": {
                "councillors": "https://data.opencity.in/dataset/delhi-mcd-elections-2022",
            },
        },
        "wards": keyed,
        "place_id": "delhi",
        "compiled_at": date.today().isoformat(),
        "election": "Municipal Corporation of Delhi general election, 4 December 2022 (first post-unification, 250 wards)",
        "note": (
            "Winners as of the Dec 2022 general election - by-elections/defections since are NOT reflected. "
            "MLA/MP columns join once the 2022 ward geometry (with AC mapping) is restored. "
            "Source data digitized in the TCPD-style schema and hosted by OpenCity."
        ),
        "source": {
            "publisher": "State Election Commission, NCT of Delhi (results); OpenCity (hosting)",
            "url": "https://data.opencity.in/dataset/delhi-mcd-elections-2022",
            "retrieved": date.today().isoformat(),
            "builder": "neer-vazhvu-api/scripts/build_delhi_ward_reps.py",
        },
        "summary": {
            "wards": len(wards),
            "party_seats": dict(sorted(parties.items(), key=lambda kv: -kv[1])),
        },
        "wards_detail": wards,
    }
    write_artifact(OUT, out)
    print(f"wrote {OUT}")
    print("party seats:", out["summary"]["party_seats"])


if __name__ == "__main__":
    main()
