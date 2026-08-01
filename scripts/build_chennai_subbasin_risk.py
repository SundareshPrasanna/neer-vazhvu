#!/usr/bin/env python3
"""Build public/geojson/chennai-sub-basins-risk.geojson.

Joins the CEEW risk attributes (classes, drivers, unmet demand) onto the
HydroBASINS-derived catchment geometry produced by
derive_chennai_subbasins_hydrobasins.py (-> chennai-sub-basins-risk-geom.json).

Data source: TNGCC and CEEW. 2026. "Towards Climate-resilient River Systems in
Chennai" (CC BY-NC 4.0). Risk index = Hazard x Exposure x Vulnerability
(IPCC AR5), 33 indicators, Jenks classification.

Geometry: all six sub-basins are hydrological catchments derived from
WWF/HydroSHEDS hybas_12 by grouping units by the coastal outlet they drain to
(NEXT_DOWN topology) and clipping to the Tamil Nadu basin window. This is a
genuine drainage delineation (so e.g. Pulicat/Ponneri fall in Araniyar, the
Arani catchment - not Gummidipoondi). Over flat coastal terrain HydroBASINS is
imperfect, so the small coastal sub-basins (Kovalam, Gummidipoondi) and the
TN/AP northern edge are approximate; the official TNGCC/CEEW boundaries would
supersede these.

Run derive_chennai_subbasins_hydrobasins.py first (needs GEE), then this.

Overall risk CLASS per sub-basin is verbatim from report Figures ES6-ES11.
Component classes (hazard/exposure/vulnerability) are assigned from the report's
ranking text (Figs 3/4/5). Top-5 drivers per component are transcribed from
Figures ES6-ES11. Per-sub-basin unmet demand (MCM) is given by the report only
for Adyar, Araniyar, Kosasthalaiyar (Table 4); others are null.
"""
from pathlib import Path
import json

sys.path.insert(0, str(Path(__file__).resolve().parent))
from nvdm_write import write_artifact  # noqa: E402
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_GEOM = os.path.join(ROOT, "public/geojson/chennai-sub-basins-risk-geom.json")
OUT = os.path.join(ROOT, "public/geojson/chennai-sub-basins-risk.geojson")

# Per-sub-basin attributes from the CEEW report.
# classes: very_low | low | moderate | high | very_high
META = {
    "Cooum": {
        "risk_class": "very_high", "hazard_class": "high",
        "exposure_class": "very_high", "vulnerability_class": "very_high",
        "risk_score": 0.62, "unmet_mcm_2020": None, "unmet_mcm_2050": None,
        "drivers": {
            "hazard": ["Difference in annual average future rainfall (2006-60)", "Maximum number of floods", "Frequency of cyclones", "Frequency of extreme rainfall days", "Change in number of very hot days"],
            "exposure": ["Population density", "Stage of groundwater development", "Built-up area (%)", "Gross rainfed area to gross irrigated area", "Forest cover (%)"],
            "adaptive_capacity": ["Per capita gross storage capacity of water structures", "Urban stormwater drainage network", "Households with improved, on-premise & sufficient drinking water", "Density of groundwater stations", "Buildings with rooftop rainwater harvesting (%)"],
            "sensitivity": ["Elevation", "Slope", "Poverty"],
        },
    },
    "Kosasthalaiyar": {
        "risk_class": "very_high", "hazard_class": "very_high",
        "exposure_class": "very_high", "vulnerability_class": "low",
        "risk_score": 0.60, "unmet_mcm_2020": 377, "unmet_mcm_2050": 439,
        "drivers": {
            "hazard": ["Difference in annual average future rainfall (2006-60)", "Maximum number of floods", "Annual average area impacted by floods", "Change in number of very hot days", "Change in magnitude of rainfall"],
            "exposure": ["Gross rainfed area to gross irrigated area", "Groundwater quality index", "Net sown area to total area", "Stage of groundwater development", "Areas under water bodies (%)"],
            "adaptive_capacity": ["Buildings with rooftop rainwater harvesting (%)", "Density of groundwater stations", "Density of surface water stations", "Per capita gross storage capacity of water structures", "Used water treated to used water generated"],
            "sensitivity": ["Slope", "Elevation", "Poverty"],
        },
    },
    "Kovalam": {
        "risk_class": "high", "hazard_class": "moderate",
        "exposure_class": "moderate", "vulnerability_class": "very_high",
        "risk_score": 0.50, "unmet_mcm_2020": None, "unmet_mcm_2050": None,
        "drivers": {
            "hazard": ["Difference in annual average future rainfall (2006-60)", "Maximum number of floods", "Frequency of cyclones", "Number of meteorological droughts", "Annual average area impacted by floods"],
            "exposure": ["Distance to the sea", "Surface water quality index", "Stage of groundwater development", "Built-up area (%)", "Groundwater quality index"],
            "adaptive_capacity": ["Urban stormwater drainage network", "Used water reused to used water treated", "Households with basic sanitation", "Used water treated to used water generated", "Density of surface water stations"],
            "sensitivity": ["Elevation", "Poverty", "Slope"],
        },
    },
    "Adyar": {
        "risk_class": "moderate", "hazard_class": "high",
        "exposure_class": "high", "vulnerability_class": "moderate",
        "risk_score": 0.42, "unmet_mcm_2020": 17, "unmet_mcm_2050": 31,
        "drivers": {
            "hazard": ["Difference in annual average future rainfall (2006-60)", "Maximum number of floods", "Number of meteorological droughts", "Change in magnitude of rainfall", "Annual average area impacted by floods"],
            "exposure": ["Slum area to total area", "Built-up area (%)", "Distance to the sea", "Groundwater quality index", "Surface water quality index"],
            "adaptive_capacity": ["Used water reused to used water treated", "Used water treated to used water generated", "Urban stormwater drainage network", "Per capita gross storage capacity of water structures", "Households with improved, on-premise & sufficient drinking water"],
            "sensitivity": ["Elevation", "Slope", "Poverty"],
        },
    },
    "Araniyar": {
        "risk_class": "very_low", "hazard_class": "very_low",
        "exposure_class": "very_low", "vulnerability_class": "high",
        "risk_score": 0.22, "unmet_mcm_2020": 141, "unmet_mcm_2050": 169,
        "drivers": {
            "hazard": ["Difference in annual average future rainfall (2006-60)", "Change in magnitude of rainfall", "Number of meteorological droughts", "Change in number of rainy days", "Change in number of very hot days"],
            "exposure": ["Groundwater quality index", "Net sown area to total area", "Distance to the sea", "Forest cover (%)", "Gross rainfed area to gross irrigated area"],
            "adaptive_capacity": ["Urban stormwater drainage network", "Used water reused to used water treated", "Used water treated to used water generated", "Buildings with rooftop rainwater harvesting (%)", "Per capita gross storage capacity of water structures"],
            "sensitivity": ["Elevation", "Poverty", "Slope"],
        },
    },
    "Gummidipoondi": {
        "risk_class": "very_low", "hazard_class": "low",
        "exposure_class": "low", "vulnerability_class": "low",
        "risk_score": 0.18, "unmet_mcm_2020": None, "unmet_mcm_2050": None,
        "drivers": {
            "hazard": ["Difference in annual average future rainfall (2006-60)", "Change in number of very hot days", "Change in number of rainy days", "Frequency of extreme rainfall days", "Change in magnitude of rainfall"],
            "exposure": ["Areas under water bodies (%)", "Surface water quality index", "Net sown area to total area", "Gross rainfed area to gross irrigated area", "Distance to the sea"],
            "adaptive_capacity": ["Urban stormwater drainage network", "Per capita gross storage capacity of water structures", "Buildings with rooftop rainwater harvesting (%)", "Used water treated to used water generated", "Used water reused to used water treated"],
            "sensitivity": ["Elevation", "Poverty", "Slope"],
        },
    },
}

CREDIT = "Risk index & scores: TNGCC and CEEW 2026 (CC BY-NC 4.0). Boundaries: hydrological catchments derived from WWF/HydroSHEDS hybas_12 (drainage-grouped, clipped to the TN basin); small coastal sub-basins are approximate over flat terrain."

# Risk order for stable legend/reading.
ORDER = ["very_high", "high", "moderate", "low", "very_low"]


def feature(name, geometry):
    m = META[name]
    props = {
        "sub_basin": name,
        "boundary_quality": "derived",
        "credit": CREDIT,
        **{k: m[k] for k in ("risk_class", "hazard_class", "exposure_class", "vulnerability_class", "risk_score", "unmet_mcm_2020", "unmet_mcm_2050")},
        "drivers": m["drivers"],
    }
    return {"type": "Feature", "properties": props, "geometry": geometry}


def main():
    geom_fc = json.load(open(SRC_GEOM))
    geoms = {f["properties"]["sub_basin"]: f["geometry"] for f in geom_fc["features"]}

    missing = set(META) - set(geoms)
    if missing:
        raise SystemExit(f"geometry missing for {missing}; run derive_chennai_subbasins_hydrobasins.py")

    feats = [feature(name, geoms[name]) for name in META]
    feats.sort(key=lambda f: ORDER.index(f["properties"]["risk_class"]))

    fc = {"type": "FeatureCollection", "name": "chennai-sub-basins-risk", "features": feats}
    write_artifact(Path(OUT), fc, compact=True)
    print(f"wrote {len(feats)} features -> {OUT}")
    for f in feats:
        p = f["properties"]
        print(f"  {p['sub_basin']:15} risk={p['risk_class']}")


if __name__ == "__main__":
    main()
