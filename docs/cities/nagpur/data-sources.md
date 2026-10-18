# Data Sources - Nagpur

Nagpur is the platform's third Maharashtra city. It reuses the state-wide upstreams Pune and Mumbai
registered (IN-GRES Maharashtra, the WRD Pravah bulletin's parser, MPCB's water-quality reports, the
WRD Government Resolutions and flood-line register) and adds NMC's own reports, budgets and GIS,
MRSAC's PM Gati Shakti layers, the final ward notification of 4 October 2025, the state water
regulator's 2018 order on NMC's Pench water, and the court and tribunal record on the city's lakes.
Every upstream is in `scripts/source-registry/nagpur-*.json` with its traps; this page is the
reading guide. Research and build pass 2026-10-15.

## Supply: NMC's Environment Status Report and budget

The source of record is **NMC's Environment Status Report (ESR) 2023-24**, prepared by CSIR-NEERI,
section 6.2.1, printed pp.132-134 (PDF pp.133-135): five treatment plants of 786 MLD (Pench I to IV
136, 175, 120 and 115; Kanhan 240), 73 command areas in ten distribution zones, and the 2023-24
water balance (706 MLD supplied, 410 MLD billed, 41.91% lost from source to consumer). The current
structure figures are **NMC Budget 2026-27, Commissioner's speech, pp.B-3 to B-4** (published May 2026; the speech prints no date): 4.50
lakh connections, 106 water tanks, 4,650 km of mains, 37 tankers. `build_nagpur_supply.py --verify
<dir>` re-reads every text-layer figure on its cited page.

**Traps.** The 2026-27 budget is a scan with no text layer: every figure was checked on the page
image, and its OCR misreads digits (1,115.22 read as 1,114.22; package 3 read as 4). ESR Table 6.2's
257.642 Mcum is the supplied total (706 MLD over 365 days, 704 over the 366 days of 2023-24), not the
billed volume, though the report's sentence pairs it with the billed 410 MLD. The 2022-23 ESR
states a 47% loss while its own table's figures (250.679 Mcum supplied, 377.454 MLD billed) give
45.0% on our arithmetic, and its monthly rows add to 250.672 against a
printed 250.679. The tanker baseline of 346 is dated 2016 by the ESRs and 2018 by the budgets. The
2026-27 speech reports revenue "to January 2027" (read as January 2026). NMC's public-notices page
keeps no ESR index, so the edition watch is a 90-day human review, not a link-set.

**Gaps, stated:** no supply by source after NMC's draft 2017-18 report, whose table is headed
'present' and gives no year (the dashboard's source split is capacity); no
citywide hours of supply (only the count of command areas with dark zones, 36 of 73 in 2023-24); no
current population (Census 2011 is the last count; the ESR's estimate cites a commercial website).

## Allocations: the regulator's order and the State's resolutions

**MWRRA Order 13/2018 (Case 8 of 2017, 12 Sep 2018)**, a scan read on its page images, carries the
history of NMC's Pench reservation: 112 Mcum (NMC's account of a State letter of 29 Mar 1965), 78
more sanctioned on 21 Mar 1998 as temporary (the petition prints 31 Mar 1998), made permanent in
2008 on conditions the regulator records as not yet met, continued in 2010 as a temporary
reservation until further orders, and held "legal and intact as on today" under section 31B. **WRD GR of 19 Mar
2020** (code 202003191442414827, Marathi, table on p.2 of 3) re-plans the complex: NMC 190 Mcum a
year in phase 1 (equal to 112 + 78; the GR prints only the totals), 341 in phase 2 with the Lohghogari tunnel (GR of 18 Sep 2019). The GR of 18 Apr
2023 (Kolar-Kanhan barrage, Rohana scheme) returned 404 at the official path on 15 Oct 2026 and was
read from the orgpedia mahGRs mirror; the ledger says so.

**Trap: the only per-source draw is from a mirror.** ESR 2017-18 (draft) Tables 4.3 and 4.4 give
billed draws (Pench 143.00 Mcum, Kanhan 43.80, Gorewada 6.80), read as 2017-18 from the report's
edition (Table 4.3 is headed 'present' drawal and gives no year; its drawal rows add to 193.60
against a printed 217.60), and exist only on a third-party WordPress copy; no NMC-hosted copy was found. The MWRRA order's own quota line prints
139.03 for 118.05 + 21.01 (which add to 139.06). Table 4.4 (treated water, same page) does not
match the bills: the four Pench plants treated 456 MLD (about 166 Mcum a year), the Kanhan plant 185
MLD (about 67.5 Mcum, more than its 43.80 bill and its 55.00 reservation) and Old Gorewada 16 MLD
(below its 20 MLD bill). One rule for all three rows: where the bill and the treated output disagree,
the ledger shows no delivery figure ('unreported') and gives both figures in the note (the Pench note
also carries the 139.03 quota; both Pench figures sit below the 190 entitlement, but they put the gap
at about 47 or about 24 Mcum, so no gap is printed). The Kanhan has four figures (55.00, 58 and 60
Mcum a year, and 65.71 in a 2023 GR that states no period) in four documents and no reservation order.

## Reservoirs: Pravah every morning, the Marathi archive behind it

The **WRD Pravah bulletin** (`mwrdpravah.in`, TLS chain incomplete: verify off) is one
all-Maharashtra PDF a day. `scrape_pravah_dams.py --city nagpur` reads the five dams of the
**Nagpur district block** by whole name (Totladoh, Kamthi Khairy, Khindsi, Nand, Wadgaon). It
writes nothing if Totladoh or Kamthi Khairy is missing; a missing context dam (Khindsi, Nand,
Wadgaon) prints a WARNING and the rest is still written. Only Totladoh and Kamthi Khairy (as
`navegaon_khairi`) reach `reservoir_daily_v2`. Storage is live storage against designed live capacity (1,016.93 and 141.98
Mcum, equal to NRLD-2019's effective storage to the cubic metre). The refresh runs from the local scheduled job, never
from GitHub (the runners cannot reach the host).

Traps: Nand and Wadgaon are short names, so a statewide substring match would be fragile; the
scraper matches whole names inside the Nagpur block; the same-date-last-year column becomes a back-dated row, and it was printed 0.0% for both
Pench dams in the 01-04-2024 archive file. For Nagpur (`ly_insert_only`) those back-dated rows are
sent insert-only (a date already stored keeps its value) and a printed 0.0 is not sent, so a real
empty day stays a gap rather than a possible misprint; the old code built "YYYY-02-29" for a non-leap year, which Postgres refuses for the whole
batch (fixed: 29 Feb maps to 28 Feb). The **WRD dated Marathi archive**: first copy found 25 Feb 2024 (1 Feb and 15-24 Feb 2024 return 404; 2-14 Feb not checked), at about 83 s a request; `backfill_pravah_marathi_archive.py` is insert-only, with a
dry-run-to-file mode, and has not been run against the database. It stores each row under the
file (report) date, as the live scraper does; the per-dam reading date is kept in the dry-run file
only.

Not used: the National Water Data Portal's CWC daily level for Totladoh (from June 2019) is under a
non-commercial licence. Totladoh's FRL (490.00 m) is from CWC's weekly bulletin; no source used here
gives Kamthi Khairy's.

## Groundwater: IN-GRES to taluka, NWDP for levels

IN-GRES assesses Nagpur district by taluka: 14 units over six editions (2019-2020 to 2025-2026),
unit polygons from IN-GRES's GeoServer (`gec:indgec_ver_mahar`, year 2021). Spellings drift beyond
case (HINGANA/Hingna, KAMTEE/Kamptee, MOUDA/Mauda, NAGPUR/Nagpur (Rural), WFS "NAGPUR CITY"), so
`build_ingres_gwr.py` maps them through `drill.aliases`. **Nagpur (Urban)** first appears in
IN-GRES's 2023-2024 area figures with 22,457 ha, the same total by which three units' assessed areas
fall (6,277 + 16,081 + 99); no IN-GRES text calls it a transfer, and the KAMTEE polygon does not
change. The older NAGPUR unit continues as Nagpur (Rural). The producer asserts the district's
2024-2025 figures against CGWB's National Compilation 2025 (printed p.161, PDF p.187, 45.68%) and
stops if they differ.

**Trap: the 2025-2026 city figure is computed on different inputs (a 206 ha command area against
16,081 ha the year before).** Its non-command figures repeat the 2024-2025 values, so its stage
rises from 33.10% to 54.62%, in effect the non-command part's stage alone. Its printed rainfall
(336.66 mm, 1,146.98 the year before) is an average over the re-split areas, not a different
reading. The category (Safe in all three editions) is the steadier comparison; the panel carries a
per-unit caveat.

Levels: NWDP telemetry from GSDA (91 wells) and CGWB (10) resources, monthly means after the shared
quality rules, placed by coordinates in the IN-GRES polygons. Three stand inside NMC, all CGWB
semi-confined piezometers; CGWB's feed stops between 2 and 19 June 2026. Not fixed upstream: level
steps at Khairi (Kh) (about 34 m to about 9 m in May-June 2023, back to about 31 m in February 2024)
and Paradsinga_1 drifting above ground (six negative monthly means, July 2025 and May-September
2026). Both series are kept, and each carries a `quality_note` (CITIES['nagpur']['quality_notes'] in
build_nwdp_gw_stations.py) that the station panel shows.
No ward depth surface: the city's piezometers and GSDA's long-record dug wells read different
aquifers.

## Rivers: MPCB monthly below the city, NMC's sampling inside it

**MPCB's per-river PDFs** ("Latest Water Quality As per Assessment Targeted": Kanhan, Kolar,
Wainganga) carry monthly pH, DO, BOD, faecal and total coliform for NWMP stations 2170, 2171, 1909,
1908 and 1910, January 2017 to December 2024, parsed by column position into
`pipeline-inputs/nagpur/river-mpcb-monthly-2017-2024.csv`. For 2021 to 2024 the months reproduce
CPCB's yearly min and max exactly (FC after CPCB's half-up rounding); for 2018 and 2019 they do not,
and CPCB's figures for those years are not shown. **NMC ESR 2023-24 Tables 6.13 to 6.16** (printed
pp.161-166) give 23 sites on the Nag, the Pili and the Pora, one monsoon 2023 round.

Traps: NMC counts coliforms in CFU, not MPN (carried per reading); two Pili sites print FC above TC
(shown as printed); 1910 Ambhora's official positions are about 145 km south (CPCB WQMN list) and
about 53 km north-west (MPCB list) of the village, so its marker is withheld; MPCB prints 1910's
February 2021 values on the line below the year; 1909 August 2021 FC is "<1.8"; MPCB's whole-arcminute
"Old NWMP" coordinates contradict CPCB's for 1909 by about 40 km. MPCB's OCEMS public portal returns
no data, and MPCB gives no coordinates for the industries in its river action plans.

STPs: ESR Table 6.3 (13 plants, 12 operating at 403.5 MLD, Narsala on trial run) joined to MPCB's
January 2026 monthly progress report to NMCG (Sr. 151-162), carried in `nagpur-stps.geojson`.

## Geography: official layers first

- **City outline and zones:** NMC GIS `NMCAdminBoundaries` (layer 3 outline, edited 2023-08-13;
  layer 2, ten zones). The host fails Python TLS: fetch with curl. The outline is frozen as a
  pipeline input; no page draws it. The ten zone outlines are frozen too
  (`pipeline-inputs/nagpur/nmc-zones.geojson`, written by `build_nagpur_wards.py`), and each
  locality takes the zone at its own point from them.
- **Wards:** MRSAC PM Gati Shakti `Gatishakti_DMA/MapServer/2`, 38 polygons whose ward populations
  follow the August 2025 draft, with some typing slips and a different 23/26 split. Populations come
  from the final notification of 4 Oct 2025 (No. 1600-E.D.-NMC-2025, English schedule pp.35-68,
  2,447,494 in all, census year not named), checked against the parsed schedule. The final
  notification moved the lines between wards 6 and 7, 7 and 9, and 8 and 19, and MRSAC's 23/26 line
  differs from both draft and final; wards 6, 7, 8, 9, 19, 23 and 26 carry a `boundary_note`, which
  the ward profiles carry and the my-ward header shows. **Zones:** wards cross the GIS zone lines
  and NMC assigns wards to zone offices administratively, so `zone_name`/`zone_no` are set only where
  one zone holds at least 90% of the ward (20 of 38) and are null for the other 18; `zone_share` is
  the largest share. MRSAC's own zone label (landmark) differs from the area-majority zone for wards
  1, 8, 17, 22, 29, 32, 33 and 35; wards 1, 8 and 33 keep their NMC zone here. `zone_no` is NMC's
  own zone number (1 to 10), not the GIS ZONEID.
- **Water bodies:** MRSAC `Water_Resources/MapServer/14` ("Waterbodies_10k_2017-2018_MRSAC"),
  district 505 inside the config frame: 1,794 polygons minus 27 islands (WB_TYPE 99) = 1,767.
  **Trap: `Area_ha` holds km2** (asserted against SHAPE_Area for every feature). OSM names and ids
  are joined by mutual-best overlap; unmatched features carry `osm_id` "mrsac:<WB_CODE>" so the map's
  lookups never collide. Overpass mirrors can answer from stale databases (one served 24 Jul 2026 data
  on 15 Oct): the producer refuses a base older than 14 days.
- **Rivers:** MRSAC drainage layer 12 (Nag Nadi, Pili Nadi, Pora Nadi, Kanhan, Kolar, Wainganga),
  frame run east to 79.65 E so the Kanhan meets the Wainganga; the Nag is the first feature so the
  rivers page opens on it.

Neither MRSAC nor NMC GIS states a licence; both are cited as government publications with the
absence recorded in the registry notes.

## Flood: rain gauges, plans and a court record

Event rainfall is the state's revenue-circle gauges (Maharain), which match the Nagpur District
Disaster Management Plan 2024 (p.59); IMD's own reading for 23 Sep 2023 was not found. The four
deaths are the Collector's affidavit as recorded in the Bombay High Court's order of 11 Jul 2024
(PIL 56/2023), read on the order's page image in NMC's NGT filing. NMC's City Disaster Management
Plan 2025-26 (Marathi, read on page images) names 66 places at risk, 77 waterlogging places and 59
basements; the basement list names private persons and is not carried. The **WRD flood-line
register** has 13 sheets for six rivers around the city; the Kolar rows link " map_scan_1.pdf" with
a leading space (the register's own links 404; the files answer without it). The CDP 2041 (March
2015) records about 917 km of storm drains surveyed in 2008; the map of waterlogging areas its text
refers to is absent from the published PDF.

## Lakes and commitments

Five GRs did not open at either official folder on 15 Oct 2026 (Naik and Lendi lakes, AMRUT 2.0
water, the 2023 AMRUT 1.0 pipeline sanction, the Kolar-Kanhan barrage); their text is from the
orgpedia mahGRs mirror and the rows say so. Court and tribunal orders are read on Indian Kanoon; the
court, case number and date are the citation. Where NMC's report, the GR and the AMRUT 2.0 portal
disagree (Naik lake: Rs 12.95 crore sanctioned, Rs 15.95 crore on the portal), all are shown. The
Supreme Court records Futala as "also known as Telangkhedi Tank", so the two are one lake.

## Rich-data deep-zoom panel (7 Nagpur bodies)

| | |
|---|---|
| **Bodies** | Futala, Ambazari, Gorewada, Gandhisagar and Sonegaon in the city; Totladoh and Navegaon Khairi (Kamthi Khairy), the two Pench dams the city draws on |
| **Boundary** | MRSAC's 2017-18 1:10,000 polygon for all seven, the geometry the city map ships: `fetch-rich-body-polygon.ts --from-layer public/geojson/nagpur-water-bodies-current.geojson --match wb_code=<code>` |
| **Pipeline** | Body-agnostic scripts under `scripts/`; per-body entry in [rich-bodies.json](../../../src/lib/water-bodies/rich-bodies.json) |

**Official outlines, chosen per body on measured evidence.** For the two reservoirs OpenStreetMap
carries only unnamed traces of the deep water (about 1,505 ha of Totladoh and 1,318 ha of Navegaon
Khairi), while MRSAC's outlines are 97% and 96% of the areas in CWC's National Register of Large Dams
(2019). OpenStreetMap's extra ground at Gorewada (about 21 ha) and Sonegaon (a 4.6 ha west strip)
reads mostly as trees or built ground in Dynamic World and rarely as water in JRC, so MRSAC's lines
follow the water. Futala's and Gandhisagar's outlines agree with OpenStreetMap's. Ambazari is the
one judgment call: MRSAC's 166 ha takes in a narrow bank rim and a western inlet, against CWC's 153
ha, which OpenStreetMap way 130775582 matches; MRSAC is kept so the cohort has one boundary source.
Each registry `osm_id` is the OpenStreetMap polygon the shipped layer pairs with the MRSAC feature,
because the city map matches a click to a deep-zoom body by that id. The `--from-layer` polygon and
buffer carry their own envelope citing MRSAC, and `nvdm_envelope_rich_bodies.py --refresh` no longer
restamps a boundary whose envelope cites a non-OpenStreetMap source (it had been rewriting
Pallikaranai's TNSWA provenance as OpenStreetMap).

**Two of the cohort's water readings divide differently.** JRC's yearly share divides by the pixels
JRC ever mapped as water inside the outline; Dynamic World's divides by the whole outline. At
Gandhisagar and Sonegaon JRC's mapped pixels cover about four-fifths of the outline in 2021, which
puts the 2021/22 step at 19.9 and 23.6 points; against JRC's water as a share of the whole outline
the steps are 0.1 and 3.3. Both stay under the panel's 25-point limit, so the 1988-92 comparison
shows.

**What the monthly labels show.** For each body we also read Dynamic World's most common label per
calendar month (a clear month has at least 5 scenes and covers 95% of the outline). Ambazari's
dry-season water has fallen each year since 2024 (29.7% of the outline in March 2026) and returns
after the monsoon (94.7% in October 2026); NMC's 2023-24 sampling recorded water hyacinth there and
the classifier cannot tell floating plants from exposed bed, so no cause is given. Gandhisagar read
almost empty in May 2022 and June 2023, the bed labelled bare and built, and water in every clear
month of 2025 and 2026. Totladoh's 1988-92 baseline includes its first filling (completed 1989 in the
register; JRC water on 20% of it in 1988 and 84% in 1990), which the panel states in a badge and a
caveat.

Traps: Totladoh's chips cover four Sentinel-2 tiles (365 to 433 scenes a year), so a 1,200 px
Sentinel-2 chip exceeds Earth Engine's per-request memory. The imagery script then fetches that chip
as 2 x 2 tiles on the single request's pixel grid and stitches them, with no flag needed. In the three
checks where a single request also fits, the stitched file matched it byte for byte. Its tints fit in one request at 1,200 px
(built-gain took 95 s of the 120 s timeout). Landsat 5 holds no scenes over Nagpur for
1984-1987 (both collections), so each body has 39 of 43 yearly chips, and 1988 rests on two scenes.
MRSAC has a second feature named Ambazari (a 10.58 ha tank, wb_code 505040330301348) that is a
different body. The reservoirs' 1 km halos hold backwater beyond MRSAC's line, so no halo water
figure is quoted. The Overture script's area factor assumes Chennai's latitude, so its
`region_area_ha` reads about 2% high here; the built-up fraction is unaffected.

## Rainfall

IMD gridded cell 21.0 N, 79.0 E, the node nearest the Nagpur (Sonegaon) observatory: 1,148.8 mm over
1991-2020 against the observatory's 1,151.2 mm (-0.2%). 1994 (1,744.2 mm) is a real wet year, not a
download fault. Open-Meteo fills the months after IMD's last, on the same point.

## Facts and ward profiles

`build_nagpur_facts.py` reads every card from the artifacts above and stops on a renamed key or a
moved phrase; `build_ward_profiles.py --city nagpur` joins the ward polygons to the water bodies, the
nearest river sampling point (for every ward one of NMC's 2023 sites), the IN-GRES unit and the
nearest telemetry well within 5 km. Re-run both after any input changes, then the catalogue.
