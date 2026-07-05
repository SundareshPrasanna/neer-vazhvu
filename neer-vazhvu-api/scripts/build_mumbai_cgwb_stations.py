#!/usr/bin/env python3
"""
Build public/data/mumbai-cgwb-stations.json from CGWB Ground Water Year Books
of Maharashtra + the CGWB Maharashtra groundwater-quality report.

Mumbai City + Mumbai Suburban are EXCLUDED from CGWB's Dynamic Ground Water
Resources Assessment (no safe/critical/over-exploited block class), so the
groundwater page cannot show a block-exploitation choropleth. Instead we
surface the CGWB National Hydrograph Network wells as the authoritative point
overlay - the same `cgwbStations: true` pattern as Madurai, conforming to the
CgwbStationsFile shape in src/types/groundwater.ts.

Unlike the earlier WRIS-API build (which only returned ~9 wells, stale at
May 2023), this transcribes the published CGWB Year Books directly, which are
both richer and more current:

  LEVELS - depth-to-water (m bgl), four seasons per Year Book:
    * 2024-25 edition (publication id 2016, posted 24 Mar 2026): 25 Mumbai
      wells (6 City + 19 Suburban), May/Aug/Nov 2024 + Jan 2025. This is the
      CURRENT monitoring network and the canonical station list here.
      https://cgwb.gov.in/cgwbpnm/download/2016
    * 2022-23 edition (1703237300342091479file.pdf): 23 wells, May/Aug/Nov
      2022 + Jan 2023. Stitched on by site name to give a multi-year
      hydrograph where the well still exists in the 2024-25 network.
      https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1703237300342091479file.pdf

  QUALITY - major-ion chemistry, CGWB "Trend Report on Ground Water Quality of
    Maharashtra", Annexure IX (NHS 2022-23, pre-monsoon May 2022 sampling):
    EC, TDS, hardness, Ca/Mg/Na, chloride, sulphate, nitrate, fluoride for 12
    Mumbai stations; plus Annexure VIII (NHS 2019-20) Fe/As/U where non-trace.
    https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1707983103489626080file.pdf

No city renders groundwater chemistry yet, so `quality` is a new optional
field on CgwbStation. The honest headline it supports: Mumbai's monitored
shallow groundwater is broadly fresh (EC 428-1371 uS/cm, all well under the
3000 salinity threshold), low-nitrate, low-fluoride, with mild coastal
mineralisation only at the NW creek edge (Manori, Gorai). It is NOT the
seawater-poisoned aquifer one might assume for a coastal megacity.

Run:  cd neer-vazhvu-api && python scripts/build_mumbai_cgwb_stations.py
"""

import json
import os
import re

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT_PATH = os.path.join(REPO_ROOT, "public", "data", "mumbai-cgwb-stations.json")

# --- 2024-25 Year Book: WRIS code | district | site | May24 Aug24 Nov24 Jan25
# Station codes encode location: W DDMMSS(lat) DDDMMSS(lng). Blank = not read.
LEVELS_2425 = """
W185555072495201|Mumbai City|Bombay (Church Gate)|2.10|0.90|1.50|3.92
W185348072484001|Mumbai City|Colaba (Dandi)|4.21|2.60|3.10|3.92
W185617072501201|Mumbai City|Colaba (Dandi) II|2.50|1.53|1.80|1.56
W190130072504001|Mumbai City|Mahim|4.61|2.80|3.32|4.40
W185809072503801|Mumbai City|Mazgaon|12.81|5.00|7.40|5.28
W185954072490701|Mumbai City|Varli|1.16|1.20|1.16|1.15
W190807072531401|Mumbai Suburban|A.M.C. Colony|11.61|4.80|8.82|12.28
W190222072553401|Mumbai Suburban|Agarwadi|6.33|1.30|4.67|
W190757072502101|Mumbai Suburban|Amboli|3.24|1.20|2.63|2.95
W190318072535001|Mumbai Suburban|Chembur|2.68|1.80|2.31|2.34
W191506072515101|Mumbai Suburban|Dahisar|8.34|6.20|7.60|9.10
W190947072531701|Mumbai Suburban|Film City-Habale Pada|1.41|0.70|1.32|2.65
W191434072470701|Mumbai Suburban|Gorai|5.24|2.20|2.64|3.15
W190956072512701|Mumbai Suburban|Goregaon|2.76|0.20|2.01|1.23
W190429072492401|Mumbai Suburban|Khardanda|6.83|3.92|4.93|5.53
W190141072534801|Mumbai Suburban|Laxminagar-Mahul|1.80|0.01|0.01|0.65
W190830072472301|Mumbai Suburban|Madh|4.56|0.30|0.71|0.35
W191146072483501|Mumbai Suburban|Malvani|3.80|0.80|2.40|1.94
W191251072470601|Mumbai Suburban|Manori|7.30|0.10|2.30|3.48
W190949072571501|Mumbai Suburban|Mulund|3.37|1.80|3.24|4.37
W185845072500501|Mumbai Suburban|Ranicha Bagh|8.35|1.40|3.70|8.35
W190157072565301|Mumbai Suburban|Trombay|3.80|1.90|2.95|3.70
W190450072513101|Mumbai Suburban|Vakola|3.30|1.70|2.51|2.15
W190820072482501|Mumbai Suburban|Varsowa|4.98|2.31|3.98|4.57
W190551072503501|Mumbai Suburban|Vile Parle West|4.21|1.50|2.21|2.58
"""

# --- 2022-23 Year Book: site | May22 Aug22 Nov22 Jan23 (stitched by name)
LEVELS_2223 = """
Bombay (Church Gate)|2.8|1.1|1.85|1.7
Mahim|5.45|3.35|3.85|5.2
Varli_Naka|3.22|1|1.5|1.2
Mazgaon|9.05|13.6|7.45|7.9
A.M.C. Colony|4.25|4.5|5.7|6.1
Vile Parle West|3.3|1.95|2.95|1.7
Amboli_Sarota Pada|3.38|1.55|3.4|2.5
Madh|5.7|0.7|0.7|0.95
Malwani|5.5|1.1|4.1|4.38
Dahisar-1|9.85|4.1|9.4|9.8
Film City-Habale Pada|3.2|0.9|1.4|2.3
Goregaon|3.8|0.5|2.4|2.4
Mulund_East||2.1|4.9|5.2
Chembur_Gaothan|3.2|2|2.4|2.68
Laxminagar-Mahul|2.1|0.7|0.56|0.8
Trombay-Koliwada|3.12|1.95|3.2|2.8
Agarwadi|3.86|1.4|3.95|4.2
Vakola|3.12|2.1|2.65|2.4
Rani cha Bagh|8.31|1.25|6.8|6.4
Gorai Beach|3.5|2.05|3.15|4.26
Manori|5.6|0.75|2.3|3.47
"""

# --- Quality, verbatim Annexure IX rows (NHS 2022-23, May 2022 sampling).
# Columns: SNo District Site Lat Lng pH EC TDS TH Ca Mg Na K CO3 HCO3 Cl SO4 NO3 F U SAR RSC
QUALITY_RAW = """
595    MUMBAI   A.M.C. Colony           19.135  72.887  7.97  1274  815  300  50  43  141  16.9  0  458  181  23  15  0.30  0.65  3.55   1.5
596    MUMBAI   Bombay (Church Gate)    18.932  72.831  7.59   473  303  180  50  13   24   4.1  0  183   43  17  16  0.34  0.09  0.76  -0.6
597    MUMBAI   Mahim                   19.025  72.844  7.94   704  450  245  50  29   35   9.5  0  336   28  20   7  0.32  0.40  0.97   0.6
598    MUMBAI   Vile Parle West         19.098  72.843  7.73   935  598  250  60  24   81   3.8  0  366   82  24   7  0.44  0.70  2.23   1.0
599    MUMBAI   Amboli_Sarota Pada      19.133  72.839  7.87   968  620  200  50  18  101  23.9  0  293  128  31  35  0.40  0.59  3.11   0.8
600    MUMBAI   Film City-Habale Pada   19.163  72.888  7.87   428  274  135  30  15   21   7.3  0  171   32  12  10  0.35  0.08  0.77   0.1
601    MUMBAI   Vakola                  19.081  72.859  7.85   704  451  190  34  26   57   8.5  0  299   46  17  20  0.35  0.21  1.80   1.1
602    MUMBAI   Mazgaon                 18.969  72.844  7.78   658  421  275  70  24   15   6.2  0  305   25  10   6  0.54  0.29  0.40  -0.5
603    MUMBAI   Ranicha Bagh            18.979  72.835  8.08   962  615  240  82   9  101   4.1  0  403   53  27   8  0.32  0.34  2.83   1.8
604    MUMBAI   Gorai Beach             19.243  72.785  7.82  1008  645  300  70  30   81   6.3  0  397   96  21   5  0.48  1.94  2.04   0.5
605    MUMBAI   Manori                  19.214  72.785  7.70  1371  877  370  76  44  116  11.1  0  336  280  13  10  0.38  1.42  2.62  -1.9
606    MUMBAI   Madh                    19.142  72.790  7.75   756  484  250  60  24   53   0.7  0  299   57  46   4  0.36  0.12  1.46  -0.1
"""

# --- Trace metals (NHS 2019-20, Annexure VIII), only stations with non-blank
# values. site | Fe(mg/l) | As(ug/l) | U(ug/l)
METALS = """
Bombay (Church Gate)||1.200|
Mahim||2.579|
Varli_Naka||2.477|
Amboli_Sarota Pada|0.011||
Gorai Beach||2.979|1.160
Manori|||1.195
"""

# Annexure IX column order after the lat/lng pair.
_Q_COLS = [
    "ph",
    "ec_us_cm",
    "tds_mg_l",
    "hardness_mg_l",
    "calcium_mg_l",
    "magnesium_mg_l",
    "sodium_mg_l",
    "_k",
    "_co3",
    "bicarbonate_mg_l",
    "chloride_mg_l",
    "sulphate_mg_l",
    "nitrate_mg_l",
    "fluoride_mg_l",
    "_u",
    "_sar",
    "_rsc",
]
_Q_KEEP = {
    "ph",
    "ec_us_cm",
    "tds_mg_l",
    "hardness_mg_l",
    "calcium_mg_l",
    "magnesium_mg_l",
    "sodium_mg_l",
    "bicarbonate_mg_l",
    "chloride_mg_l",
    "sulphate_mg_l",
    "nitrate_mg_l",
    "fluoride_mg_l",
}


def _norm(name: str) -> str:
    """Canonicalise a site name so the same well matches across Year Books."""
    n = re.sub(r"[_\-]", " ", name.lower().strip())
    n = re.sub(r"\s+", " ", n)
    aliases = {
        "varli naka": "varli",
        "varli": "varli",
        "versova": "versova",
        "varsowa": "versova",
        "malvani": "malwani",
        "malwani": "malwani",
        "amboli sarota pada": "amboli",
        "amboli": "amboli",
        "mulund east": "mulund",
        "mulund": "mulund",
        "gorai beach": "gorai",
        "gorai": "gorai",
        "dahisar 1": "dahisar",
        "dahisar": "dahisar",
        "ranicha bagh": "rani cha bagh",
        "rani cha bagh": "rani cha bagh",
        "film city habale pada": "film city",
        "film city": "film city",
        "trombay koliwada": "trombay",
        "trombay": "trombay",
        "chembur gaothan": "chembur",
        "chembur": "chembur",
        "a.m.c. colony": "amc colony",
        "amc colony": "amc colony",
        "bombay (church gate)": "church gate",
        "church gate": "church gate",
    }
    return aliases.get(n, n)


def _code_latlng(code: str):
    c = code.lstrip("W")
    lat = int(c[0:2]) + int(c[2:4]) / 60 + int(c[4:6]) / 3600
    lng = int(c[6:9]) + int(c[9:11]) / 60 + int(c[11:13]) / 3600
    return round(lat, 4), round(lng, 4)


def _f(v):
    v = v.strip()
    return float(v) if v else None


# --- MMR regional wells (2024-25 Year Book): the other corporations' districts,
# coordinate-filtered to the urban MMR extent (Vasai -> VVCMC, Panvel/Uran ->
# PMC, Thane/Bhiwandi/Kalyan/Ulhasnagar -> TMC/BNCMC/KDMC/UMC). Levels only - the
# chemistry report has not been extracted for these districts yet.
# Format: code | district | taluka | site | May24 | Aug24 | Nov24 | Jan25
REGIONAL_LEVELS = """
W192800072462201|Palghar|Vasai|Agashi|5.04|1.90|2.15|1.06
W192530072470001|Palghar|Vasai|Bramhanwadi|3.28|0.90|1.30|1.51
W192245072473001|Palghar|Vasai|Giraj|6.34|1.20|1.70|2.07
W192746072562101|Palghar|Vasai|Parol|1.45|0.20|1.00|1.35
W192134072482101|Palghar|Vasai|Sandor|4.02|0.60|1.57|2.83
W191649072471101|Palghar|Vasai|Uttan|1.12|0.01|0.45|1.04
W192545072521101|Palghar|Vasai|Vasai|1.12|0.01|0.67|0.95
W193347073061301|Palghar|Wada|Khupari|0.01|0.80|1.42|
W185833073194601|Raigad|Karjat|Chinchawali|3.32|0.25|0.48|2.10
W185445073191001|Raigad|Karjat|Hudhre Budruk (Karjat)|1.28|0.01|0.32|0.45
W185353073152201|Raigad|Khalapur|Hatanoli|1.65|0.35|1.38|2.28
W185908073052401|Raigad|Panvel|Chinchpara|1.57|0.01|1.65|2.85
W185530073070001|Raigad|Panvel|Chinchwad|6.87|0.01|0.35|3.15
W190302073060301|Raigad|Panvel|Navade|4.38|0.20|1.92|4.86
W185202073014501|Raigad|Uran|Mottijui|1.33|0.12|0.15|0.65
W185246072563101|Raigad|Uran|Uran|0.20|0.28|0.25|0.25
W191859073093201|Thane|Bhiwandi|Amangaon|4.85|1.60|2.60|3.53
W192145073102001|Thane|Bhiwandi|Padghe|1.15|0.78|0.57|0.18
W192916073013101|Thane|Bhiwandi|Vajreshwari|3.23|1.05|1.42|1.42
W191012073055501|Thane|Kalyan|Hetutane|1.75|0.22||
W191700073160001|Thane|Kalyan|Kolimb|4.93|1.40|1.32|0.12
W191136073054201|Thane|Kalyan|Pimpleshwar|3.23|2.30|1.12|1.46
W192800073200001|Thane|Shahapur|Cherfully|5.42|1.60|3.50|4.80
W191700072570001|Thane|Thane|Bindarpada|7.60|2.70|5.10|2.62
W190640073035001|Thane|Thane|Dahisar|3.42|2.30|2.30|2.56
W191405072564101|Thane|Thane|Yeur|5.96|0.60|1.68|2.19
W190950073181001|Thane|Ulhasnagar|Katolwadi (Mulgaon)|5.63|0.01|1.00|1.18
W191041073084901|Thane|Ulhasnagar|Navali|1.56|0.95|0.36|
"""


def _seasonal(values, months, ybtag):
    out = []
    for (y, m), v in zip(months, values):
        fv = _f(v)
        if fv is not None:
            out.append({"year": y, "month": m, "depth_m_bgl": fv, "year_book": ybtag})
    return out


def main() -> int:
    m2425 = [(2024, 5), (2024, 8), (2024, 11), (2025, 1)]
    m2223 = [(2022, 5), (2022, 8), (2022, 11), (2023, 1)]

    # Historical readings keyed by canonical site name.
    hist = {}
    for ln in LEVELS_2223.strip().splitlines():
        p = ln.split("|")
        hist[_norm(p[0])] = _seasonal(p[1:5], m2223, "2022-23")

    # Quality keyed by canonical site name.
    quality = {}
    for ln in QUALITY_RAW.strip().splitlines():
        toks = ln.split()
        # site name is between the district token (MUMBAI) and the lat (a
        # decimal). Re-join multi-word site names.
        lat_i = next(i for i, t in enumerate(toks) if re.match(r"^\d+\.\d+$", t))
        site = " ".join(toks[2:lat_i])
        nums = toks[lat_i + 2 :]  # skip lat, lng
        rec = {}
        for col, val in zip(_Q_COLS, nums):
            if col in _Q_KEEP:
                rec[col] = float(val)
        quality[_norm(site)] = rec
    for ln in METALS.strip().splitlines():
        p = ln.split("|")
        rec = quality.setdefault(_norm(p[0]), {})
        if p[1].strip():
            rec["iron_mg_l"] = float(p[1])
        if p[2].strip():
            rec["arsenic_ug_l"] = float(p[2])
        if p[3].strip():
            rec["uranium_ug_l"] = float(p[3])

    # Build the canonical network from the 2024-25 Year Book.
    wells = []
    n_quality = 0
    latest = ""
    for ln in LEVELS_2425.strip().splitlines():
        code, district, site, *vals = ln.split("|")
        lat, lng = _code_latlng(code)
        reads = _seasonal(vals, m2425, "2024-25")
        key = _norm(site)
        # Stitch 2022-23 history only when the name maps unambiguously (the two
        # Colaba (Dandi) stations share a name in 2024-25, so neither inherits).
        same_name_2425 = sum(
            _norm(x.split("|")[2]) == key for x in LEVELS_2425.strip().splitlines()
        )
        if key in hist and same_name_2425 == 1:
            reads = hist[key] + reads
        reads.sort(key=lambda r: (r["year"], r["month"]))
        if reads:
            latest = max(latest, f"{reads[-1]['year']}-{reads[-1]['month']:02d}")
        well = {
            "name": site,
            "station_code": code,
            "block": district,
            "district": district,
            "lat": lat,
            "lng": lng,
            "well_type": "Dug Well",
            "aquifer": "Unconfined",
            "readings": reads,
        }
        if key in quality:
            well["quality"] = quality[key]
            n_quality += 1
        wells.append(well)

    # MMR regional wells (levels only) for the other corporations' districts.
    n_regional = 0
    for ln in REGIONAL_LEVELS.strip().splitlines():
        code, district, taluka, site, *vals = ln.split("|")
        lat, lng = _code_latlng(code)
        reads = _seasonal(vals, m2425, "2024-25")
        if not reads:
            continue
        latest = max(latest, f"{reads[-1]['year']}-{reads[-1]['month']:02d}")
        wells.append(
            {
                "name": site,
                "station_code": code,
                "block": taluka,
                "district": district,
                "lat": lat,
                "lng": lng,
                "well_type": "Dug Well",
                "aquifer": "Unconfined",
                "readings": reads,
            }
        )
        n_regional += 1

    out = {
        "_note": (
            "CGWB National Hydrograph Network wells in Mumbai City + Mumbai "
            "Suburban, transcribed from the CGWB Ground Water Year Book of "
            "Maharashtra (2024-25 canonical, 2022-23 stitched for multi-year "
            "depth). Mumbai is EXCLUDED from the CGWB Dynamic Ground Water "
            "Resources Assessment (no block safe/critical/over-exploited class), "
            "so these wells - not a block choropleth - are the authoritative "
            "groundwater rendering. Levels run May/Aug/Nov + Jan, four seasons "
            "per Year Book, current to Jan 2025. The `quality` block (where "
            "present) is the major-ion panel from the CGWB Maharashtra "
            "groundwater-quality report (Annexure IX, pre-monsoon May 2022); "
            "trace Fe/As/U from Annexure VIII (NHS 2019-20). All monitored wells "
            "are shallow phreatic dug wells; no DWLR/telemetric stations exist "
            "for Mumbai. REGIONAL (MMR): extended beyond the BMC districts with "
            "Year Book 2024-25 wells across Thane, Palghar (Vasai) and Raigad "
            "(Panvel/Uran), coordinate-filtered to the urban metro, so every "
            "non-BMC corporation has nearby groundwater monitoring (levels only "
            "for the added districts - chemistry not yet extracted there)."
        ),
        "district": "Mumbai City + Suburban + Thane + Palghar + Raigad (MMR)",
        "well_type": "Dug Well",
        "aquifer": "Unconfined / phreatic",
        "depth_unit": "m bgl",
        "source_label": "CGWB Ground Water Year Book of Maharashtra + GW Quality report",
        "source_url": "https://cgwb.gov.in/cgwbpnm/",
        "quality_note": (
            "Pre-monsoon (May 2022) major-ion chemistry. EC in uS/cm; ions in "
            "mg/l; As and U in ug/l. BIS 10500 acceptable limits: chloride 250, "
            "nitrate 45, fluoride 1.0, TDS 500. Salinity (EC > 3000 uS/cm) "
            "threshold: no Mumbai well exceeds it."
        ),
        "year_book_summaries": [
            {
                "year_book": "2024-25",
                "report_id": "2016",
                "publication_date": "2026-03-24",
                "publisher": "Central Ground Water Board, Central Region",
                "source_index_url": "https://cgwb.gov.in/cgwbpnm/",
                "source_url": "https://cgwb.gov.in/cgwbpnm/download/2016",
            },
            {
                "year_book": "2022-23",
                "publisher": "Central Ground Water Board, Central Region",
                "source_url": "https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1703237300342091479file.pdf",
            },
            {
                "year_book": "GW Quality of Maharashtra (May 2022)",
                "publisher": "Central Ground Water Board, Central Region",
                "source_url": "https://cgwb.gov.in/cgwbpnm/public/uploads/documents/1707983103489626080file.pdf",
            },
        ],
        "wells": wells,
    }

    os.makedirs(os.path.dirname(OUT_PATH), exist_ok=True)
    with open(OUT_PATH, "w", encoding="utf-8") as fh:
        json.dump(out, fh, ensure_ascii=False, indent=2)

    total = sum(len(w["readings"]) for w in wells)
    print(
        f"Wrote {len(wells)} wells / {total} readings / {n_quality} with "
        f"chemistry -> {OUT_PATH}\n  latest reading: {latest}",
        flush=True,
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
