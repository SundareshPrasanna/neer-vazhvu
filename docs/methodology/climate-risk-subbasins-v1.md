# Sub-basin climate-risk layer for Chennai

**Surfacing the TNGCC + CEEW (2026) sub-basin climate-risk index on a derived catchment geometry**

Version 1 - Neer Vazhvu - June 2026

---

## Summary

The `/chennai/climate-risk` map shows climate-induced risk to water systems across
the six sub-basins of the Chennai basin - Adyar, Araniyar, Cooum, Gummidipoondi,
Kosasthalaiyar and Kovalam. The risk scores come from a published government study;
the sub-basin **boundaries** are derived by us, because the study publishes none.

- **Risk data:** TNGCC & CEEW, 2026, *Towards Climate-resilient River Systems in
  Chennai: Assessing Risks at the Sub-basin Level and Advancing a Circular Economy
  Approach* (CC BY-NC 4.0). Risk = hazard x exposure x vulnerability (IPCC AR5),
  33 indicators, 5-class Jenks. Cooum and Kosasthalaiyar carry the highest overall
  risk; Araniyar and Gummidipoondi the lowest.
- **Geometry:** true hydrological catchments derived from WWF/HydroSHEDS
  HydroBASINS level 12, grouped by drainage outlet and clipped to the Tamil Nadu
  state boundary. Validated against the official IAMWARM sub-basin DPRs.

All code is in the repo and the layer is offered as a faithful, clearly-caveated
rendering of the CEEW index - not as a new risk assessment.

## 1. The risk index (from CEEW)

We transcribe, per sub-basin, from the report's figures and tables:

- **Overall risk class** - verbatim from the per-sub-basin figures (ES6-ES11):
  Cooum *very high*, Kosasthalaiyar *very high*, Kovalam *high*, Adyar *moderate*,
  Araniyar *very low*, Gummidipoondi *very low*.
- **Component classes** (hazard / exposure / vulnerability) - assigned from the
  report's ranking text and maps (Figures 3/4/5). These are read off the ranking,
  not a published per-sub-basin table, so they are our best reading of the figures.
- **Top-5 driver indicators** per component - transcribed from Figures ES6-ES11.
- **Unmet water demand** (MCM, 2020 -> 2050) - from the WEAP results (Table 4),
  given only for Adyar (17 -> 31), Araniyar (141 -> 169) and Kosasthalaiyar
  (377 -> 439); null elsewhere.
- **Basin water balance** (dashboard tile) - demand 2,479 -> 2,728 MCM; unmet
  546 -> 654 MCM; reuse + micro-irrigation cut 52-93%.

These live in `META` in `scripts/build_chennai_subbasin_risk.py`.

## 2. Deriving the sub-basin boundaries

The CEEW study (and the underlying TN-WRD / IAMWARM scheme it follows) does not
publish sub-basin polygons. We reconstruct them as hydrological catchments:

1. **Source.** WWF/HydroSHEDS HydroBASINS level 12 (`WWF/HydroSHEDS/v1/Basins/hybas_12`),
   read for the Chennai region via Google Earth Engine - the same dataset lineage
   as the existing `chennai-rivers` sub-hydrosheds.
2. **Drainage grouping.** Every hybas-12 unit is followed downstream via its
   `NEXT_DOWN` link to its terminal coastal outlet; units sharing an outlet form
   one drainage group. This is a true, non-overlapping partition.
3. **Assignment.** Each drainage group is assigned to the nearest of five river
   mouths (Kosasthalaiyar->Ennore, Araniyar->Pulicat, Cooum, Adyar, Kovalam) by
   its outlet point, within a distance threshold (so the Palar to the south and
   the Andhra-Pradesh coastal basins to the north are excluded).
4. **State clip.** Catchments are clipped to the real Tamil Nadu boundary
   (geoBoundaries ADM1), since the Arani catchment and the Pulicat lagoon are
   shared with Andhra Pradesh. This replaces an earlier straight-latitude cut with
   the true, irregular border.
5. **Gummidipoondi.** It is a minor far-north coastal sub-basin that cannot be
   split from the Arani catchment by drainage (the Arani drains the Gummidipoondi
   block into Pulicat - see Section 3), so it is taken as the residual TN
   northern-coastal area not claimed by the five, reduced to a single clean polygon.
6. **De-fragment.** Sub-5 km2 slivers and detached blobs (flat-coast routing
   artifacts) are dropped so each sub-basin is a single polygon.

Scripts: `scripts/derive_chennai_subbasins_hydrobasins.py` (GEE) writes
`public/geojson/chennai-sub-basins-risk-geom.json`; `scripts/build_chennai_subbasin_risk.py`
joins the CEEW attributes and writes `public/geojson/chennai-sub-basins-risk.geojson`.

## 3. Validation against the official scheme (IAMWARM DPRs)

The six sub-basins are the TN-WRD / IAMWARM sub-basin scheme. The IAMWARM
Detailed Project Reports define each sub-basin by taluk and area, which we use to
sanity-check the derivation:

- **Araniyar DPR:** 1,470 km2 total, **763 km2 in Tamil Nadu**, covering the
  **Ponneri, Gummidipoondi and Uthukottai** taluks of Tiruvallur district; the
  Arani rises in Chittoor (AP) and confluences at Pulicat.
- This confirms a counterintuitive but correct point: **Gummidipoondi taluk
  belongs to the Araniyar (Arani river) sub-basin.** The separate "Gummidipoondi"
  sub-basin is the small far-north coastal drainage, not the taluk.
- Derived total area ~6,190 km2 vs the study's stated 6,123 km2 TN extent - a good
  match. Individual catchments (e.g. Adyar, Kosasthalaiyar) run larger than CEEW's
  clipped study-area figures because these are the full upstream catchments.

## 4. Caveats

- **Boundaries are derived, not official.** They are hydrological catchments, a
  faithful approximation of the TN-WRD scheme - the official TNGCC/CEEW boundaries
  would supersede them. Every feature is tagged `boundary_quality` and the map's
  info panel states this.
- **Flat-coast uncertainty.** HydroBASINS mis-routes over the flat, canal-cross-linked
  Pulicat coast (the Buckingham Canal physically links several basins), so the small
  **Kovalam** and **Gummidipoondi** sub-basins and the immediate coastal edges are
  approximate.
- **Component classes inferred.** Overall risk classes are verbatim from the report;
  hazard/exposure/vulnerability classes are read from its ranking figures.
- **Licence.** The risk index is CC BY-NC 4.0 - attribute "TNGCC and CEEW 2026" and
  keep usage non-commercial.

## 5. Reproducing

```
# 1. Geometry (needs GEE: pyenv `neer-vazhvu-api` env has ee/pyproj/pyshp;
#    uses the repo service-account key). Run from neer-vazhvu-api so pyenv activates:
cd neer-vazhvu-api && python3 ../scripts/derive_chennai_subbasins_hydrobasins.py

# 2. Join CEEW risk attributes onto the geometry:
python3 scripts/build_chennai_subbasin_risk.py
```

The Tamil Nadu boundary (`public/geojson/tamil-nadu-boundary.geojson`) was fetched
once from geoBoundaries (gbOpen IND ADM1) and is committed; the derivation reads it.
