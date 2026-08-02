# Parivesh EC water pilot: method and findings

Captured **2026-07-31**. Verified by **Sundaresh Chandran**, full cohort, full
document. Artifact: `public/data/corridors/sriperumbudur/parivesh-ec-water.json`.

**This is a dated manual snapshot, not a maintained pipeline.** Nineteen SEIAA
Tamil Nadu Environmental Clearance letters for the Sriperumbudur-Oragadam
industrial corridor, read by hand and shipped as a single NVDM artifact. There is
no producer script in this repository and no scheduled refresh. Re-doing it means
repeating the capture and the reading.

The question it was built to answer: **would a generalized extractor survive a run
across ~3,000 documents?** It answers that, and the answer is no. That result is
the durable output of this work, more than the 19 records are.

## Nothing here is a measurement

Every figure is a **proponent-asserted quantity as stated in the EC/EIA
submission** and restated in the SEIAA letter. Not metered, not audited, not
independently verified. Several letters contradict themselves; those
contradictions are preserved rather than tidied. Verification means the
transcription faithfully reflects the letter, never that the letter is correct.

## How the cohort was captured

1. **Discovery.** The undocumented `advanceSearchData` API returns all Tamil Nadu
   EC proposals (5,180 rows on 2026-07-31). Free-text search caps at 40 rows, so
   the whole state was dumped and filtered locally on corridor toponyms. Recipe
   is recorded in the registry entry, `scripts/source-registry/corridors.json`.
2. **Download.** The 19 certificate PDFs for granted ECs in the corridor.
3. **Reading.** Each letter read field by field against its `pdftotext -layout`
   rendering, with the EC date and EC identification number matched against the
   letter, and the six amendment/corrigendum letters confirmed water-free by a
   zero-hit search for `KLD` across the whole document.
4. **Ambiguity rule.** Where a table's labels and values are misaligned by the
   layout, the reading was settled by the letter's **own component arithmetic**
   (sub-rows reproducing a stated subtotal exactly), never by eyeballing.
   Unsettled cases ship as `null` with the text quoted verbatim, never
   back-calculated.

The raw PDFs are **not in this repository**. The Parivesh licence is UNVERIFIED,
so there is no established right to redistribute them, and `scripts/.cache/` stays
git-ignored as a licence guardrail. `provenance.input_digests` in the artifact
carries the sha256 of the exact bytes read, so anyone re-retrieving from
parivesh.nic.in can confirm they hold the same documents.

**Reproducibility is therefore conditional.** The hashes identify the exact source
documents, but a fresh clone cannot regenerate the artifact from repository
contents, because those documents are absent by design.

## The finding: 0 clean / 13 manual / 6 absent

| class | n | meaning |
|---|---|---|
| clean auto-extract | **0** | agreed with the human reading on every field it emits |
| needed manual handling | **13** | at least one value wrong, missed, or invented |
| no water table at all | 6 | amendment / corrigendum letters |
| letters with **invented** values | **4** | extractor emits a figure the letter does not state |

**No letter in this cohort survived unattended extraction.** The failures are not
OCR noise, they are semantics. SEIAA letters stack three row labels against two
printed numbers, move the After-Expansion column around, and mislabel rows
outright. The regex read 1303.6 as Yamaha's fresh water (it is the *total*),
15426.98 for Guindy (also the total), and 30.6 for NSK (that is *recycled*). Each
is a plausible-looking number wrong by a category, not by a digit.

Scoring counted three failure modes equally: **wrong**, **missed**, and
**invented**, across every field the extractor emits, *including fields where the
human reading is deliberately null*. That last case is the one that matters and
the easiest to hide. Score only the fields that carry values and Knorr-Bremse
looks clean, while the extractor is reporting a 137 KLD total its letter never
states.

### The four invented cases

| Letter | Fields the extractor fabricated |
|---|---|
| Knorr-Bremse, SIPCOT Mambakkam | `operation_total_kld` |
| Mobile-phone enclosure plant, Walajabad | `wastewater_domestic_kld` |
| Hyundai Motor India, Irungattukottai | `wastewater_domestic_kld` |
| Indospace Vallam II | `etp_capacity_kld`, `operation_total_kld`, `trade_effluent_kld` |

**The invention rate, not the miss rate, is what should govern a large run.** A
miss is visible downstream. An invention is indistinguishable from data. Indospace
Vallam II alone receives a total, an ETP capacity and a trade effluent from a
letter that states none of them.

### What this implies at 3,000 documents

Viable only as a **candidate generator feeding human verification**, with the
letters' own component arithmetic as the trigger for a second look. Not viable
unattended. If such an effort is ever commissioned, build a new pipeline around
human review rather than reviving this one; the regex experiment has answered its
question and remains recoverable in the history of PR #222.

## Five open readings

Each ships in the artifact with verbatim text, page reference, and an
interpretation with a confidence note. Recorded values follow those
interpretations.

**1. Knorr-Bremse (SIA/TN/INFRA2/561627/2025), p.3 - a one-row label shift that
inverts "fresh".** Three labels, two numbers. Read literally: total 137, fresh
225. Read as a one-row shift: fresh 137 (= 79 + 58) and recycled 225
(= 40 + 98 + 87), both exact against the component rows, with no total printed.
The shifted reading is taken and `total` stays null, since 362 would be inferred.
**Confidence high**, but it inverts the literal reading, which is why it stays
open.

**2. Guindy Warehousing (SIA/TN/INFRA2/502376/2024), p.4 - litres pasted into a
KLD table?** Sub-rows sit three orders of magnitude above their own stated totals
and are read as litres/day mislabelled KLD (484.9 and 187.5). The headline totals
are self-consistent (5000 + 10426.98 = 15426.98) and are what the record carries.
**High for the totals, medium for the sub-rows.**

**3. Guindy Warehousing, p.5 - where is the industrial treatment train?** No ETP
row exists despite 10,426.98 KLD of treated-recycled water. Read as covering only
the domestic STP; the domestic/trade split stays null. **Medium.**

**4. Hyundai Motor (SIA/TN/INFRA2/527678/2025), p.5 - which figure is the granted
total?** 1500 + 4537 = 6037, not the stated 5536. All three recorded verbatim with
an arithmetic flag. Possibly "total" excludes a reuse stream counted inside the
recycled figure. **Transcription high; reconciliation none.**

**5. Saint-Gobain (SIA/TN/INFRA2/499993/2024), p.4 - a units slip or a real
lagoon?** `Rainwater Harvesting Sump Capacity 161200 Cu.m`, two orders of
magnitude above every other letter. Could be genuine storage for a 45-acre glass
campus; unverifiable from the letter. Kept verbatim in the `rwh` text field only,
never as a number. **Low either way.**

## Licence: UNVERIFIED, unresolved

The Parivesh terms-of-use page renders client-side (the served HTML is an app
shell with no terms text), so **the portal's terms were not read** before this
data entered the repo. What this relies on instead: these are statutory EC letters
that the EIA Notification 2006 requires the regulator to publish, served
unauthenticated from `parivesh.nic.in`. That is a reasonable basis for citation
with attribution, **not a verified licence grant**, and it is **not cleared for
commercial or BRSR reuse**. Flagged in the registry entry and in the artifact's
`license` field. Resolve by reading the terms in a real browser or asking MoEFCC.

## Known gaps in the cohort

- **Asian Paints** (SIA/TN/IND3/507163/2024) contributes no water data: the letter
  is an amendment relocating a CSR centre. Its water table lives in a parent EC
  predating this cohort's certificate-url era.
- **Tata Electronics** (SIA/TN/INFRA2/467617/2024) likewise, a built-up-area
  revision only.
- `pdftotext` finds **no "WATER" heading at all** in the two short-form
  logistics-park letters (Indospace Oragadam V, Vallam Phase I); their figures sit
  in a prose salient-features table and were transcribed by hand.
- Category-A projects are absent by construction: the only two granted Category-A
  toponym hits in the dump fall outside the corridor, so the large-project slots
  are B1 anchors (Hyundai, Yamaha, the Guindy electronics campus).
