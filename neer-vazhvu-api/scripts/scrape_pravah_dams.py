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

Row layout (whitespace-delimited after the dam name), taken from the PDF's own
column header rather than guessed:

  <name> <DD/MM/YYYY> <hh:mm AM> <dead> <live_cap> <gross_cap>
         <cur_live> <cur_gross> <cur_%> <ly_%>

Storage is in Mcum. Columns 5-7 are DESIGNED storage (dead / live / gross);
columns 8-9 are TODAY'S storage (live / gross); column 10 is today's live as a
percentage of designed live; column 11 is the SAME DATE LAST YEAR on the same
percentage basis.

THE COLUMN THAT WAS READ WRONG, and it reached the database. Column 9 is
today's GROSS storage. This parser captured it as `ly`, last year's LIVE
storage, and --supabase upserted it into reservoir_daily_v2 dated a year back.
Gross exceeds live by the dead storage, so that wrote a year-old reading that
is always too high and is often impossible: on the 17/08/2026 bulletin it puts
Modaksagar at 204.93 Mcum against a live capacity of 128.92 - 159% full - and
Tansa at 106%. Last year's live storage is never printed as a volume, only as
column 11's percentage, so it is RECONSTRUCTED here as ly_% x live_cap, which
is the arithmetic the bulletin itself used to produce that percentage.

Morbe (Navi Mumbai) and Hetawane (Panvel/CIDCO) are NOT in this feed - they are
CIDCO/NMMC-operated.

PUNE. The same daily PDF carries a "Pune" revenue region of 35 dams, which is
where the Khadakwasla chain sits - Khadakwasla, Panshet, Warasgaon and Temghar,
the four that supply Pune city - plus Pawana (PCMC's source) and Bhama Askhed
(PMC's eastern scheme). A second city therefore comes off a feed already
fetched daily. The capacities cross-check independently against the CWC weekly
reservoir bulletin to under 1% on every dam CWC also carries: Khadakwasla 55.91
Mcum vs CWC's 0.056 BCM, Panshet 301.61 vs 0.302, Bhama Askhed 217.10 vs 0.217,
Chaskaman 214.50 vs 0.215, Nira Deoghar 332.13 vs 0.332, Dimbhe 353.75 vs
0.354. Two independent government sources, agreeing.

Run:  cd neer-vazhvu-api && python3 scripts/scrape_pravah_dams.py --city mumbai
      cd neer-vazhvu-api && python3 scripts/scrape_pravah_dams.py --city pune
Emits JSON to stdout (and --out writes a file).
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
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent.parent / "scripts"))
from nvdm_write import write_artifact  # noqa: E402
from registry_license import registry_license  # noqa: E402

PRAVAH_URL = "https://mwrdpravah.in/damsafety/control/pdfLatestReportEng"
MCUM_PER_TMC = 28.3168  # 1 thousand-million-cubic-feet = 28.3168 Mm3

# Pravah dam name (as printed) -> our canonical source_code + the corporations
# it serves. Names matched case-insensitively against the row's leading label.
MMR_DAMS = {
    "barvi": ("barvi", ["tmc", "kdmc", "umc", "bncmc", "nmmc"]),
    "dhamni": ("surya", ["vvcmc", "mbmc"]),  # Surya scheme raw source
    "kawdas": ("kawdas", ["vvcmc", "mbmc"]),  # Surya scheme weir
    "bhatsa": ("bhatsa", ["bmc"]),  # cross-check vs BMC feed
    "upper vaitarna": ("upper_vaitarna", ["bmc"]),
    "middle vaitarna": ("middle_vaitarna", ["bmc"]),
    "modaksagar": ("modak_sagar", ["bmc"]),
    "tansa": ("tansa", ["bmc"]),
}

# Pune. The first four ARE the Khadakwasla chain - the operational unit PMC
# draws on and the one every WRD release announcement is phrased in terms of.
# Pawana is PCMC's, and Bhama Askhed is PMC's eastern scheme, so all three
# corporations that matter are here.
#
# SPELLING: the bulletin prints "Warasgaon", not the Varasgaon that most
# secondary writing uses, and "Khadakwasla" here against India-WRIS's
# "Khadakwasala_1" and CWC's "KHADAKVASLA". Three government sources, three
# spellings of one dam - match on the substring the bulletin actually prints.
#
# Mulshi is Tata's hydro reservoir, not a municipal source, and is carried for
# context only. It is also the ONE dam where Pravah and CWC disagree materially
# (live 522.76 Mcum here against CWC's 0.572 BCM), which is a further reason not
# to put it in a supply total.
PUNE_DAMS = {
    "khadakwasla": ("khadakwasla", ["pmc"]),
    "panshet": ("panshet", ["pmc"]),
    "warasgaon": ("warasgaon", ["pmc"]),
    "temghar": ("temghar", ["pmc"]),
    "pawana": ("pawana", ["pcmc"]),
    "bhama askhed": ("bhama_askhed", ["pmc"]),
    "mulshi tata": ("mulshi", []),  # context only, not a municipal source
}

CITIES = {
    "mumbai": {
        "dams": MMR_DAMS,
        "out_default": "public/data/mmr-dam-storage.json",
        "note": (
            "Live storage for MMR source dams. BMC's 7 lakes come from the BMC "
            "feed; Pravah adds Barvi (eastern corridor) + Dhamni/Kawdas (Surya "
            "scheme, western corridor). Morbe + Hetawane are NOT in this feed."
        ),
        # Only the BMC lakes are city-of-Mumbai reservoir sources; the regional
        # dams are corporation-card data.
        "db_filter": lambda r: r["corporations"] == ["bmc"],
        "source_id": "wrd-pravah-dam-feed",
        "dataset_stem": "mmr-dam-storage",
    },
    "pune": {
        "dams": PUNE_DAMS,
        "out_default": "public/data/pune-dam-storage.json",
        "note": (
            "Live storage for Pune's source dams from the Maharashtra WRD daily "
            "bulletin. The Khadakwasla chain (Khadakwasla, Panshet, Warasgaon, "
            "Temghar) is what PMC draws on; Pawana is PCMC's source and Bhama "
            "Askhed is PMC's eastern scheme. Mulshi Tata is hydro, carried for "
            "context and excluded from any supply total."
        ),
        "db_filter": lambda r: bool(r["corporations"]),
        "source_id": "wrd-pravah-pune-dams",
        "dataset_stem": "dam-storage",
    },
}

_NUM = r"-?\d+(?:\.\d+)?"
# name | date | time | dead | live_cap | gross_cap | cur_live | cur_gross
#      | cur_% | ly_%
_ROW = re.compile(
    r"^(?P<name>.+?)\s+(?P<date>\d{2}/\d{2}/\d{4})\s+\d{1,2}:\d{2}\s*[AP]M\s+"
    + r"(?P<dead>%s)\s+(?P<live_cap>%s)\s+(?P<gross>%s)\s+" % (_NUM, _NUM, _NUM)
    + r"(?P<cur>%s)\s+(?P<cur_gross>%s)\s+(?P<cur_pct>%s)\s*%%\s+(?P<ly_pct>%s)\s*%%"
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
        help="upsert this city's municipal-source dams into reservoir_daily_v2. "
        "For Mumbai that is the BMC lakes, for which Pravah is the OFFICIAL "
        "daily source for 5 of 7 (~97%% of system capacity); Vihar + Tulsi are "
        "BMC-owned in-city lakes with no public feed. For Pune it is the "
        "Khadakwasla chain plus Pawana and Bhama Askhed. "
        "Needs SUPABASE_URL + SUPABASE_SERVICE_KEY.",
    )
    ap.add_argument("--city", default="mumbai", choices=sorted(CITIES))
    args = ap.parse_args()
    city = CITIES[args.city]
    dams = city["dams"]

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
        match = next((k for k in dams if k in label), None)
        if not match or match in seen:
            continue
        seen.add(match)
        source_code, corporations = dams[match]
        # The row's leading serial number rides along in the name capture.
        pravah_name = re.sub(r"^\d+\s+", "", m.group("name").strip())
        cur = float(m.group("cur"))
        live_cap = float(m.group("live_cap"))
        ly_pct = float(m.group("ly_pct"))
        # Last year's LIVE storage is not printed as a volume anywhere in the
        # bulletin - only as a percentage of designed live storage - so it is
        # reconstructed rather than read. See the module docstring for the
        # column that used to be read in its place.
        ly_mcum = round(ly_pct * live_cap / 100, 2) if live_cap else None
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
                "dead_storage_mcum": round(float(m.group("dead")), 2),
                "storage_tmc": round(cur / MCUM_PER_TMC, 3),
                "storage_pct_live": round(cur / live_cap * 100, 1)
                if live_cap
                else None,
                "last_year_storage_mcum": ly_mcum,
                "last_year_pct_live": round(ly_pct, 1),
            }
        )

    # NVDM envelope. write_artifact is preserve-if-present, so Mumbai's
    # already-enveloped mmr-dam-storage.json keeps the envelope it has and
    # this only takes effect for a city whose artifact does not carry one -
    # i.e. Pune on its first write. A regenerating producer owns its envelope
    # (the lesson from build_ingres_gwr.py, where a separate injector meant a
    # fresh run of the producer emitted a sub-L2 artifact).
    envelope = {
        "nvdm": "1.0",
        # PATH-DERIVED, with the city token stripped: scripts/
        # build_dataset_catalogue.py resolves pune-dam-storage.json to
        # data-root/dam-storage. mmr-dam-storage keeps its stem because "mmr"
        # is not a city token.
        "dataset": f"data-root/{city['dataset_stem']}",
        "scope": {"kind": "city", "id": args.city},
        "provenance": {
            "sources": [
                {
                    "id": city["source_id"],
                    "title": "Maharashtra WRD Pravah daily dam-safety bulletin",
                    "publisher": (
                        "Water Resources Department, Government of Maharashtra"
                    ),
                    "license": registry_license(city["source_id"]),
                }
            ],
            "method": "scrape",
            "produced_at": date.today().isoformat(),
            "produced_by": "neer-vazhvu-api/scripts/scrape_pravah_dams.py",
            "note": (
                "Parsed from the single daily all-Maharashtra PDF. Last year's "
                "live storage is RECONSTRUCTED as ly_pct x live_cap - the "
                "bulletin prints it only as a percentage, and the column that "
                "sits where a volume would go is today's GROSS storage."
            ),
        },
    }

    out = {
        **envelope,
        "_source": "Maharashtra WRD Pravah dam-safety feed",
        "_source_url": PRAVAH_URL,
        "_fetched": date.today().isoformat(),
        "_note": city["note"],
        "dams": sorted(readings, key=lambda r: r["source_code"]),
    }
    if args.out:
        # Envelope-preserving write (scripts/nvdm_write.py): this scraper
        # pushes to main on a daily cron, so it MUST keep the NVDM envelope
        # (the decay bug the helper exists to close).
        write_artifact(Path(args.out), out)

    if args.supabase:
        import os

        from supabase import create_client

        # Rows use the reservoir_daily_v2 ReservoirReading shape
        # (keyed city_id, source_code, date). Only the city's own municipal
        # sources go in, selected by the per-city db_filter: for Mumbai the
        # BMC lakes (the regional Barvi/Surya/Kawdas dams are corporation-card
        # data, not city-of-Mumbai reservoir sources), for Pune the six
        # PMC/PCMC dams (Mulshi is Tata's hydro and is context only).
        #
        # All rows carry the REPORT date (the newest reading in the bulletin),
        # not each dam's own timestamp: Pravah staggers per-dam readings by up
        # to a day, and the dashboard snapshot keys on one latest date per
        # city - per-dam dates would silently drop the older dams from the
        # cards. Exact per-dam timestamps stay in the JSON artifact.
        report_date = max(r["date"] for r in readings)
        # The bulletin also gives each dam's storage on the SAME DATE LAST YEAR
        # (as a percentage; see the docstring) - upsert that too, dated a year
        # back. Every daily run therefore grows the history at both ends (today
        # + today-minus-1-year), so after a year of cron the chart spans two
        # full years from a feed with no queryable archive (Pravah's dated URLs
        # 404).
        y, mo, dd = report_date.split("-")
        ly_date = f"{int(y) - 1}-{mo}-{dd}"
        own = [r for r in readings if city["db_filter"](r)]
        rows = [
            {
                "city_id": args.city,
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
            for r in own
        ] + [
            {
                "city_id": args.city,
                "source_code": r["source_code"],
                "date": ly_date,
                "storage_tmc": round(r["last_year_storage_mcum"] / MCUM_PER_TMC, 3),
                "storage_pct_frl": r["last_year_pct_live"],
                "level_ft": None,
                "inflow_cusecs": None,
                "outflow_cusecs": None,
                "source": "Maharashtra WRD Pravah dam-safety feed (same-date-last-year column)",
                "scraped_from": PRAVAH_URL,
            }
            for r in own
            if r.get("last_year_storage_mcum") is not None
        ]
        if rows:
            sb = create_client(
                os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"]
            )
            sb.table("reservoir_daily_v2").upsert(
                rows, on_conflict="city_id,source_code,date"
            ).execute()
            print(
                f"Upserted {len(rows)} {args.city} rows to reservoir_daily_v2",
                file=sys.stderr,
            )

    found = {r["source_code"] for r in readings}
    missing = {sc for sc, _ in dams.values()} - found
    print(
        f"Pravah: parsed {len(readings)} {args.city} dams "
        f"({', '.join(sorted(found))})"
        + (f" | MISSING: {', '.join(sorted(missing))}" if missing else ""),
        file=sys.stderr,
    )
    if not args.out:
        print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if readings else 1


if __name__ == "__main__":
    raise SystemExit(main())
