# Mithi waterway page: editorial constitution and decisions

Waterway 3, and the first outside Chennai. The constitution the canal and
the Cooum wrote still governs: progressive disclosure (W2),
receipts-on-every-number (W3), banned corrected figures (W4),
attributed-never-averaged capacities (W5), no scorecards (W6),
width-confidence tiers (W7 addendum). Recorded here are only the
decisions this river forced.

Status 27 Aug 2026: M1 complete (geometry + widths). M2 (satellite) and
M3 (curation) not started. The page does not build yet: it has no
curation layer, and it must not be given one by invention.

## Decisions

- **M1 Extent.** The full river as OSM maps it: relation **6245575**, ten
  member ways forming one unbroken chain (exactly two free endpoints, no
  gap to bridge, unlike the canal's 1.4 km jump). Vihar Lake outlet
  (19.1440, 72.8998) to the Mahim Causeway mouth (19.0487, 72.8369).

- **M2 Length is 17.84 km, and the number has one honest derivation.**
  The chained centerline measures 17.84 km, which matches MCGM's
  published 17.84 km exactly. Two WRONG derivations both give 18.20 km
  and must never be used: summing the member ways' raw lengths, and
  reading `public/geojson/mumbai-rivers.geojson`. Both double-count
  shared endpoints. An earlier note in this project quoted 18.20 km and
  was corrected on measurement.

- **M3 Chain on longitude, not latitude.** The final 300 m below Mahim
  Causeway runs west and slightly NORTH, so the mouth endpoint
  (lat 19.048725) sits at a *higher* latitude than the junction just
  upstream of it (19.048071). A lat-axis chain therefore picks that
  junction as its extreme, walks straight out to the mouth and
  terminates after five points, yielding a 0.3 km "river". Longitude is
  monotonic end to end (72.8998 at Vihar down to 72.8369 at the mouth).
  Chainage zero at Vihar, increasing to the mouth.

- **M4 The tidal limit is DECLARED at km 10, not inferred.** OSM tags the
  entire course `water=river` with no distinction, so nothing in the data
  flags the change. Below km 10 (19.0855, 72.8787, the Kurla / CST Road
  area) the Mithi is tidal and becomes Mahim Creek, and the mapped water
  surface encloses intertidal flats: one inner ring of relation/2310505
  is tagged `wetland=tidalflat`. Consequences, all binding on curation:
  widths below km 10 are an INTERTIDAL ENVELOPE and are labelled as
  such; they are never compared against the widening programme's design
  widths; and no single river-wide median is published, because the
  river measures two different quantities.
  The measured step is unambiguous: km 0-9 medians run 19-42 m, km 10
  onward 56-149 m.

- **M5 `open_water_m` is deliberately NOT the instrument for M4.**
  Considered and rejected. The measured widths run continuously from
  56 m to 242 m through the tidal reach with no natural break, so any
  threshold slices the distribution arbitrarily (199 m kept, 200 m
  flagged) and discards a real, separable measurement. The tidal reach
  is a defined channel between banks; it is wide, not un-separable. This
  is unlike the canal's Ennore km 0-13, which genuinely railed inside a
  creek/salt-pan complex and correctly read OPEN_WATER. The boundary is
  carried by the reach table and stated in curation instead.

- **M6 Reach table (8 reaches), with km 10 as a hard boundary:**
  r1 0-2.5, r2 2.5-5, r3 5-8, r4 8-10 (channel);
  r5 10-12, r6 12-14.5, r7 14.5-16.5, r8 16.5-17.84 (tidal).
  Measured 27 Aug 2026: 357 transects at 50 m, 341 OK (95%), median
  40.3 m overall - a figure that is itself only meaningful split at
  km 10 (channel median 27.1 m, tidal median 89.3 m).

- **M7 The photo layer will ship short of parity, and says so.**
  Commons holds six usable Mithi frames; five are by one photographer on
  one day, 13 September 2008, which predates the post-2005 widening and
  walling, so they show a channel that no longer exists. Against the
  canal's 13 photos from 11 authors this is a real gap, and it is named
  in the methods panel the way every other gap is, with each frame
  date-stamped. A field shoot completes parity later without a rebuild.
  EXCLUDED by provenance rule: `Mithi river.jpg`, credited "hindustan
  times" but uploaded CC BY-SA 4.0 - a newspaper photograph is not the
  uploader's to license.

- **M8 Water quality is one station and it is three years old.** MPCB
  monitors a single Mithi point (2168, Mithi Bridge / Kurla). Verified
  live 27 Aug 2026: mpcb.gov.in water-quality editions run 2011-12 to
  2023-24 with nothing newer, so there is no live monthly series of the
  kind that leads the Cooum page (C6). The Today panel is therefore
  satellite-led, and the WQ series is presented with its vintage on its
  face. Dahisar, Poisar and Oshiwara are unmonitored entirely.

- **M9 Desilting is a ledger, not a scandal.** The desilting programme
  has published annual volumes and is the natural occupant of the
  `silt_ledger` slot. The press frame is an EOW/ED matter; ours is the
  ledger and the works programme. Standing rule: government-facing prose
  never reads as lapse or blame.

- **M10 Last-edit is not an imagery date.** The reaches carry tracing
  vintage resolved from each multipolygon's OUTER rings (see the W7
  addendum). That is a bound, not a survey date: km 10-11 rests on
  way/123262828, which reads v10 / 2026 while tagged `source=Yahoo`, an
  imagery source retired around 2011. The 272 m reading at km 10.95 sits
  on that way and is already OFFSET-flagged. Spot-QA against current
  sub-metre imagery stays a listed curation task.

## Open, before anything ships

- M3 curation has no research base yet. Claims must come from a sourced
  dossier, not from this file.
- A 350 m unmapped gap at km 9.45-9.80 (NO_POLYGON) sits exactly at the
  tidal transition. Tracing it into OSM is the durable fix.
- The spectral width calibration (#301 machinery) has not been run; it is
  the mechanical check on the tidal reach.
- No verified Maharashtra equivalent of TN's OCMMS consent sweep.
