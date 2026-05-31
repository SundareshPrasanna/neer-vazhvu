# Neer Vazhvu deliverables

Self-contained data + brief artifacts produced for press, research, and partnership requests. Each bundle is dated and self-cites; no live-page dependency.

## 2026-05-25 - Chennai data centres and water

Water-stress and disclosure data tied to Chennai data centre locations.

**Bundle:**
- `2026-05-25-chennai-dc-water-data.csv` - one row per named Chennai DC (~28 rows); 21 columns covering operator-verified location, CGWB 2024 block classification, operator water disclosure status, and an inferred-consumption range with the WUE bands made visible.
- `2026-05-25-chennai-dc-water-brief.md` - markdown source for the 4-6 page brief that accompanies the spreadsheet.
- `2026-05-25-chennai-dc-water-brief.pdf` - rendered PDF (regenerate via `pandoc 2026-05-25-chennai-dc-water-brief.md -o 2026-05-25-chennai-dc-water-brief.pdf --pdf-engine=xelatex`).

**Data sources used:**
- DC inventory verified against operator pages (cited per row) cross-checked against DataCenterMap.
- Operator water disclosures pulled from each operator's latest sustainability report / BRSR / ESG (linked from each row); cross-checked against Down To Earth's "India's Digital Thirst" series (Nov 2025) and Earth Journalism Network's parallel audit.
- CGWB block classification + 2024 development_pct from the platform's own `public/data/gwr-blocks.json` (fetched 27 Mar 2026 from India WRIS / CGWB).
- Ward / zone mappings from `public/data/chennai-localities.json`.
- Inferred water consumption uses three WUE bands: AWS 2024 global 0.15 L/kWh (low), STT GDC India 2020-2024 average 0.73 L/kWh (central), LBNL 2024 US DC industry average 1.8 L/kWh (high). Load factor 0.7. Methodology section in the brief.

**What the bundle does NOT include (named gaps; see brief Section "Named gaps"):**
- The full firka-level CGWB classification list for the Tamil Nadu Water Resources Department GO of 7 March 2024. The platform dataset is block-level (Chennai district only). Firka-level coverage for Tiruvallur / Kanchipuram / Chengalpattu requires the CGWB Tamil Nadu 2022 state volume PDF or RTI to TN WRD.
- Per-facility TNPCB OCMMS consent (CTE/CTO) PDFs declaring water source, daily KLD, STP capacity, and ZLD claim. The OCMMS portal is interactive; consents are not surfaced via search-engine indexing. RTI required.
- WRIS station-level latest readings within 5 km of each cluster centroid. Requires interactive portal capture or CGWB district profile pull.

**Provenance conventions used in the CSV:**
- `Disclosed` - published by the operator on its own page, cited with source URL.
- `Inferred` - computed from operator-disclosed inputs; methodology in brief.
- `Pending` - we do not have this cell; the bundle does not hide gaps.
- `Not computable` - operator does not publish the input needed to derive the cell (e.g. Microsoft Azure South India MW not disclosed).
- `No-primary-disclosure` - operator publishes nothing on this; the absence is the data point.

**Regeneration:**
The bundle can be regenerated end-to-end from public sources by anyone with web access; the brief lists every primary URL. If you want to update the bundle, the workflow is: refresh the CSV row-by-row against the cited operator pages; regenerate the PDF via pandoc. No code dependency.

**Updates and corrections:**
If a number changes, an operator publishes a new disclosure, or a gap is filled, do not edit this bundle in place. Create a dated successor bundle in the same directory (e.g. `2026-MM-DD-chennai-dc-water-brief.md`) and update this README to point to the latest version.

**Contact:** Neer Vazhvu, https://neervazhvu.org
