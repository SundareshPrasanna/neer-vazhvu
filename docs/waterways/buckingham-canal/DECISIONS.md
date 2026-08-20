# Buckingham Canal waterway page: editorial constitution and decisions

The Waterway page type's first pilot. Pattern parent: the Industrial
Corridor pilot (docs/corridors/sriperumbudur/DECISIONS.md): a waterway is
data, not code - one manifest + a data build; onboarding the Cooum or the
Vaigai later is a new manifest and build, never a new component.

Research base (local-only, gitignored like all research corpora):
docs/research/buckingham-canal/ - dossier.md, sections 01-07,
data-vintages.md, measured data, Sentinel-2 chips, primary-source PDFs.
The tracked editorial layer is `waterway-curation.json` here; the build is
`scripts/build_waterway_buckingham.py`; the publication gate is
`scripts/verify_waterway_buckingham.py`. Full product spec (local):
docs/specs/buckingham-canal-story-build.md.

## Decisions
- **W13 Estimated widths (with the Cooum, 20 Aug 2026).** OFFSET and
  SPECTRAL estimates fill OSM-blind transects, labelled low-confidence,
  never merged into measured numbers; rationale and definitions:
  docs/waterways/cooum/DECISIONS.md C12. On this canal they principally
  serve ETPS-Manali (centreline/polygon misregistration - 50 of 67
  transects snap) and Manali-Kodungaiyur (untraced water surface).
- **W12 50 m densification + methods-as-data (19 Aug 2026 evening, with
  the Cooum).** Transects move from 200 m to 50 m (1,492 cast, 1,012
  measured; global median unchanged at 33 m; the MRTS minimum resolves
  to 6.5 m) and the condition strip from 100 m to 50 m. Tier jitter is
  now defined at ~200 m separation so densification cannot inflate
  confidence. The methods panel is data (curation `methods` array,
  served in reaches.json): this page's method text is its own, and the
  Cooum's is its own. Rationale and source-resolution measurements:
  docs/waterways/cooum/DECISIONS.md C10.


- **W1 Two modes, one URL.** A Story (8 chapters, Ennore to Mahabalipuram,
  scroll = chainage) and a Reach Explorer (18 reaches, the diligence
  atlas). Toggle at top; chapters and reaches deep-link both ways.
- **W2 Progressive disclosure governs.** Four depth levels, one click
  apart: verdicts (L0) -> in-context detail expanders (L1) -> reach
  explorer (L2) -> per-claim source chips (L3). No table renders on the
  Story's first paint; density only arrives by the reader's click.
- **W3 Every number wears its receipt.** All rendered facts come from
  claims.json (source + date + flag: verified / inferred / asserted).
  Verified = checked against the cited document; inferred = our
  synthesis/measurement interpretation, said so; asserted = a named
  party's claim (e.g. the fish-kill attribution is the campaign's until
  TNPCB rules).
- **W4 Corrected figures are BANNED at build time.** The verify gate
  fails on: the unverified "7.51 km" widening figure; the 2010-vintage
  "CPCL 1,280 KLD to canal" as current; the width table attributed to
  The Hindu (real source: HSCTC feasibility ~2012); "242.73 MLD" without
  its all-water-bodies qualifier.
- **W5 Capacity figures are attributed, never averaged.** Three
  incompatible families exist (IIT-M bankfull 42.5 m3/s; the
  5,600-to-2,850-cusec pair; the 3,500/9,000-cusec planning figures).
- **W6 No scorecards.** The governance chapter states custody facts and
  dated events; it grades nobody (infrastructure-not-publisher rule).
- **W7 Width semantics.** Measured widths are WATER SURFACE from OSM
  polygons (2026 snapshot), stated as such; revenue (poramboke) width is
  a named gap pending WRD records. The Ennore reaches (km 0-13) are not
  separable from the creek complex in OSM; satellite effective width is
  the working source there.
  Vintage (verified via Overpass meta, 18 Aug 2026): the 50 water
  features within 150 m of the canal were last edited 2011-2026, 37 of
  50 in 2021 or later; the canal/river-tagged polygons carry edits
  2018 - Mar 2026, many at v2-v11 (actively maintained). Last-edit is
  an upper bound on tracing age; OSM does not record the imagery date.
  Confirmation ladder: (1) cross-checked against IWAI 2014 and HSCTC
  ~2012 patterns (consistent); (2) satellite corroborates order of
  magnitude on wide channel reaches (~0.7x, the expected mixed-pixel
  undercount) but cannot certify tracing; (3) spot-QA against current
  sub-metre imagery is a listed curation task; (4) drone/DGPS survey is
  the pilot's definitive instrument.
- **W8 Licences.** Page images: our Sentinel-2 chips (Copernicus
  attribution) and Wikimedia Commons CC BY-SA/CC0 photos with per-image
  credit. Suzhal Arivom photos only with written permission; news photos
  linked, never embedded. OSM derivatives carry ODbL attribution.
- **W9 Preview-first.** The page ships preview-gated for TWIC before any
  public cutover; public/data here rides the branch until the corpus
  release chain runs at cutover (second-repo rule). CLOSED 19 Aug 2026:
  Sundaresh called the cutover same-day - `enabled: true`, corpus release
  cut, page ships unlinked (no nav entry; that is a separate decision).
- **W11 The works lens.** Per reach: quantities on record, documented
  inflows, interface counts, constraints, survey tasks, and programmes
  touching the reach - framed strictly as "what any DPR must establish",
  with claim chips on sourced lines. It contains NO cost estimates, NO
  reach rankings (scorecard rule), and no "should" sentences.
  Width-confidence tiers (W7 addendum) render beside every median:
  A = >=70% of transects measured, tracing median-year >=2021, adjacent-
  transect jitter <=25%; B = measured but sparse or older tracing;
  C = not channel-measurable (creek complexes, junctions, open water).
  Jitter, not IQR, is the noise proxy: large IQR on reaches that open
  into backwaters is real physical variation.
- **W10 Watch items that must update the page before public cutover:**
  TNPCB fish-kill lab results (pending 18 Aug 2026); CMRL Water Metro RFP
  content (live 19 Aug 2026); Ashok Leyland consent status.
