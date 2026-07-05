#!/usr/bin/env python3
"""
Scrape daily live-storage for the MMR's non-BMC source dams from the
Maharashtra Water Resources Department "Pravah" dam-safety feed.

This is the data-acquisition half of the MMR regional supply dashboard
(docs/specs/mumbai-mmr.md). BMC's 7 lakes already have a daily feed; Pravah is
how we get live storage for the OTHER corporations' sources - the eastern
corridor's Barvi dam (Thane/Kalyan/Ulhasnagar/Bhiwandi/Navi-Mumbai via MIDC)
and the western Surya scheme (Dhamni dam + Kawdas weir -> Vasai-Virar +
Mira-Bhayandar). It also carries Bhatsa + the Vaitarna-system BMC dams, useful
as a cross-check.

Feed: a single daily, timestamped, all-Maharashtra PDF (139 dams by revenue
region; the MMR dams sit in the Konkan section). There is NO JSON API and the
dated URLs 404 - only the "latest" endpoint works, and it needs TLS verification
disabled (the cert chain is incomplete). So: fetch the latest PDF with an
unverified SSL context, extract text, and parse the dam rows.

Row layout (whitespace-delimited after the dam name):
  <name> <DD/MM/YYYY> <hh:mm AM> <a> <live_cap> <gross_cap> <cur_live> <ly_live> <cur_%> <ly_%>
where storage is in Mcum and cur_% = cur_live / live_cap. Morbe (Navi Mumbai)
and Hetawane (Panvel/CIDCO) are NOT in this feed - they are CIDCO/NMMC-operated.

Run:  cd neer-vazhvu-api && python3 scripts/scrape_pravah_dams.py
Emits JSON to stdout (and --out writes a file). DB ingestion into
reservoir_daily_v2 is wired in P2 once the dams are registered as MMR sources.
"""

import argparse
import json
import re
import ssl
import subprocess
import sys
import tempfile
import urllib.request
from datetime import date

PRAVAH_URL = "https://mwrdpravah.in/damsafety/control/pdfLatestReportEng"
MCUM_PER_TMC = 28.3168  # 1 thousand-million-cubic-feet = 28.3168 Mm3

# Pravah dam name (as printed) -> our canonical source_code + the corporations
# it serves. Names matched case-insensitively against the row's leading label.
DAMS = {
    "barvi": ("barvi", ["tmc", "kdmc", "umc", "bncmc", "nmmc"]),
    "dhamni": ("surya", ["vvcmc", "mbmc"]),  # Surya scheme raw source
    "kawdas": ("kawdas", ["vvcmc", "mbmc"]),  # Surya scheme weir
    "bhatsa": ("bhatsa", ["bmc"]),  # cross-check vs BMC feed
    "upper vaitarna": ("upper_vaitarna", ["bmc"]),
    "middle vaitarna": ("middle_vaitarna", ["bmc"]),
    "modaksagar": ("modak_sagar", ["bmc"]),
    "tansa": ("tansa", ["bmc"]),
}

_NUM = r"-?\d+(?:\.\d+)?"
# name | date | time | a | live_cap | gross | cur_live | ly_live | cur_% | ly_%
_ROW = re.compile(
    r"^(?P<name>.+?)\s+(?P<date>\d{2}/\d{2}/\d{4})\s+\d{1,2}:\d{2}\s*[AP]M\s+"
    + r"(?P<a>%s)\s+(?P<live_cap>%s)\s+(?P<gross>%s)\s+" % (_NUM, _NUM, _NUM)
    + r"(?P<cur>%s)\s+(?P<ly>%s)\s+(?P<cur_pct>%s)\s*%%\s+(?P<ly_pct>%s)\s*%%"
    % (_NUM, _NUM, _NUM, _NUM)
)


def _fetch_pdf(path: str) -> None:
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE  # Pravah's cert chain is incomplete
    req = urllib.request.Request(
        PRAVAH_URL, headers={"User-Agent": "Mozilla/5.0 neervazhvu-pravah"}
    )
    with urllib.request.urlopen(req, timeout=90, context=ctx) as resp:
        data = resp.read()
    if not data.startswith(b"%PDF"):
        raise RuntimeError("Pravah did not return a PDF")
    with open(path, "wb") as fh:
        fh.write(data)


def _pdf_to_text(pdf_path: str) -> str:
    out = subprocess.run(
        ["pdftotext", "-layout", pdf_path, "-"],
        capture_output=True,
        text=True,
        check=True,
    )
    return out.stdout


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="write JSON here (also prints summary)")
    ap.add_argument(
        "--pdf",
        help="parse this already-downloaded Pravah PDF instead of fetching "
        "(the gov feed is flaky; fetch separately, e.g. via curl -k, then parse)",
    )
    ap.add_argument(
        "--supabase",
        action="store_true",
        help="upsert the BMC lakes into reservoir_daily_v2 (city_id=mumbai). "
        "Pravah is the OFFICIAL daily source for 5 of the 7 BMC lakes (~97%% "
        "of system capacity); Vihar + Tulsi are BMC-owned in-city lakes with "
        "no public feed. Needs SUPABASE_URL + SUPABASE_SERVICE_KEY.",
    )
    args = ap.parse_args()

    if args.pdf:
        pdf_path = args.pdf
    else:
        with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
            pdf_path = tmp.name
        _fetch_pdf(pdf_path)
    text = _pdf_to_text(pdf_path)

    readings = []
    seen = set()
    for line in text.splitlines():
        line = line.strip()
        m = _ROW.match(line)
        if not m:
            continue
        label = re.sub(r"\s+", " ", m.group("name")).strip().lower()
        match = next((k for k in DAMS if k in label), None)
        if not match or match in seen:
            continue
        seen.add(match)
        source_code, corporations = DAMS[match]
        # The row's leading serial number rides along in the name capture.
        pravah_name = re.sub(r"^\d+\s+", "", m.group("name").strip())
        cur = float(m.group("cur"))
        live_cap = float(m.group("live_cap"))
        # Parse Pravah's DD/MM/YYYY into ISO.
        d, mo, y = m.group("date").split("/")
        readings.append(
            {
                "source_code": source_code,
                "pravah_name": pravah_name,
                "corporations": corporations,
                "date": f"{y}-{mo}-{d}",
                "storage_mcum": round(cur, 2),
                "live_capacity_mcum": round(live_cap, 2),
                "gross_capacity_mcum": round(float(m.group("gross")), 2),
                "storage_tmc": round(cur / MCUM_PER_TMC, 3),
                "storage_pct_live": round(cur / live_cap * 100, 1)
                if live_cap
                else None,
                "last_year_storage_mcum": round(float(m.group("ly")), 2),
            }
        )

    out = {
        "_source": "Maharashtra WRD Pravah dam-safety feed",
        "_source_url": PRAVAH_URL,
        "_fetched": date.today().isoformat(),
        "_note": (
            "Live storage for MMR source dams. BMC's 7 lakes come from the BMC "
            "feed; Pravah adds Barvi (eastern corridor) + Dhamni/Kawdas (Surya "
            "scheme, western corridor). Morbe + Hetawane are NOT in this feed."
        ),
        "dams": sorted(readings, key=lambda r: r["source_code"]),
    }
    payload = json.dumps(out, ensure_ascii=False, indent=2)
    if args.out:
        with open(args.out, "w", encoding="utf-8") as fh:
            fh.write(payload)

    if args.supabase:
        import os

        from supabase import create_client

        # Rows use the reservoir_daily_v2 ReservoirReading shape
        # (keyed city_id, source_code, date). Only the BMC lakes go in - the
        # regional dams (Barvi/Surya/Kawdas) are corporation-card data, not
        # city-of-Mumbai reservoir sources.
        #
        # All rows carry the REPORT date (the newest reading in the bulletin),
        # not each dam's own timestamp: Pravah staggers per-dam readings by up
        # to a day, and the dashboard snapshot keys on one latest date per
        # city - per-dam dates would silently drop the older dams from the
        # cards. Exact per-dam timestamps stay in the JSON artifact.
        report_date = max(r["date"] for r in readings)
        # The bulletin also prints each dam's storage on the SAME DATE LAST
        # YEAR - upsert that too, dated a year back. Every daily run therefore
        # grows the history at both ends (today + today-minus-1-year), so after
        # a year of cron the chart spans two full years from a feed with no
        # queryable archive (Pravah's dated URLs 404).
        y, mo, dd = report_date.split("-")
        ly_date = f"{int(y) - 1}-{mo}-{dd}"
        bmc = [r for r in readings if r["corporations"] == ["bmc"]]
        bmc_rows = [
            {
                "city_id": "mumbai",
                "source_code": r["source_code"],
                "date": report_date,
                "storage_tmc": r["storage_tmc"],
                "storage_pct_frl": r["storage_pct_live"],
                "level_ft": None,
                "inflow_cusecs": None,
                "outflow_cusecs": None,
                "source": "Maharashtra WRD Pravah dam-safety feed",
                "scraped_from": PRAVAH_URL,
            }
            for r in bmc
        ] + [
            {
                "city_id": "mumbai",
                "source_code": r["source_code"],
                "date": ly_date,
                "storage_tmc": round(r["last_year_storage_mcum"] / MCUM_PER_TMC, 3),
                "storage_pct_frl": round(
                    r["last_year_storage_mcum"] / r["live_capacity_mcum"] * 100, 1
                )
                if r["live_capacity_mcum"]
                else None,
                "level_ft": None,
                "inflow_cusecs": None,
                "outflow_cusecs": None,
                "source": "Maharashtra WRD Pravah dam-safety feed (same-date-last-year column)",
                "scraped_from": PRAVAH_URL,
            }
            for r in bmc
            if r.get("last_year_storage_mcum") is not None
        ]
        if bmc_rows:
            sb = create_client(
                os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
            )
            sb.table("reservoir_daily_v2").upsert(
                bmc_rows, on_conflict="city_id,source_code,date"
            ).execute()
            print(
                f"Upserted {len(bmc_rows)} BMC-lake rows to reservoir_daily_v2",
                file=sys.stderr,
            )

    found = {r["source_code"] for r in readings}
    missing = {sc for sc, _ in DAMS.values()} - found
    print(
        f"Pravah: parsed {len(readings)} MMR dams "
        f"({', '.join(sorted(found))})"
        + (f" | MISSING: {', '.join(sorted(missing))}" if missing else ""),
        file=sys.stderr,
    )
    if not args.out:
        print(payload)
    return 0 if readings else 1


if __name__ == "__main__":
    raise SystemExit(main())
