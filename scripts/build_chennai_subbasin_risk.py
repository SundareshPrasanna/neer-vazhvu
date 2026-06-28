#!/usr/bin/env python3
"""Build public/geojson/chennai-sub-basins-risk.geojson.

Data source: TNGCC and CEEW. 2026. "Towards Climate-resilient River Systems in
Chennai: Assessing Risks at the Sub-basin Level and Advancing a Circular Economy
Approach." (CC BY-NC 4.0). Risk index = Hazard x Exposure x Vulnerability
(IPCC AR5), 33 indicators, Jenks classification.

Geometry provenance (two tiers, tagged per feature via `boundary_quality`):
  - "derived"      : Cooum / Adyar / Kosasthalaiyar reuse the existing
                     GEE/HydroSHEDS hybas_12 channel-upstream-union catchments
                     already in public/data/basins/chennai-rivers/sub-hydrosheds.geojson.
  - "approximate"  : Araniyar / Gummidipoondi / Kovalam are coarse polygons
                     anchored to their real geographic extent (the report does
                     not publish a shapefile; these are placeholders pending the
                     official TNGCC/CEEW boundaries). Fine for a city-zoom
                     choropleth; not authoritative boundaries.

Risk CLASS per sub-basin (overall) is taken verbatim from report Figures
ES6-ES11 (each sub-basin's single risk label). Component classes
(hazard/exposure/vulnerability) are assigned from the report's ranking text
(Figs 3/4/5: "highest in X, followed by Y, Z ...") onto the 5-class Jenks scale.
Top-5 drivers per component are transcribed from Figures ES6-ES11.
Per-sub-basin unmet demand (MCM) is given by the report only for Adyar,
Araniyar, Kosasthalaiyar (Table 4); others are null.
"""
import json
import os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_SHEDS = os.path.join(ROOT, "public/data/basins/chennai-rivers/sub-hydrosheds.geojson")
OUT = os.path.join(ROOT, "public/geojson/chennai-sub-basins-risk.geojson")

# shedId in sub-hydrosheds.geojson -> our sub_basin name
DERIVED = {"COOUM": "Cooum", "ADYAR": "Adyar", "KOSAS": "Kosasthalaiyar"}

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

# Approximate polygons (lon,lat) for the 3 sub-basins not in sub-hydrosheds.geojson.
# Anchored to real geography: Gummidipoondi (far-north coast), Araniyar (north/
# inland, drains to Pulicat), Kovalam (south coast). Coarse placeholders.
APPROX_GEOM = {
    "Gummidipoondi": [[[80.00, 13.40], [80.08, 13.62], [80.28, 13.59], [80.31, 13.45], [80.22, 13.36], [80.04, 13.36], [80.00, 13.40]]],
    "Araniyar": [[[79.55, 13.46], [79.72, 13.63], [80.02, 13.60], [80.02, 13.39], [79.76, 13.35], [79.55, 13.46]]],
    "Kovalam": [[[80.00, 12.78], [80.06, 12.87], [80.27, 12.85], [80.31, 12.62], [80.16, 12.55], [80.02, 12.62], [80.00, 12.78]]],
}

CREDIT = "Risk index & scores: TNGCC and CEEW 2026 (CC BY-NC 4.0). Boundaries: Cooum/Adyar/Kosasthalaiyar from HydroSHEDS-derived catchments; Araniyar/Gummidipoondi/Kovalam approximate."


def feature(name, geometry, boundary_quality):
    m = META[name]
    props = {
        "sub_basin": name,
        "boundary_quality": boundary_quality,
        "credit": CREDIT,
        **{k: m[k] for k in ("risk_class", "hazard_class", "exposure_class", "vulnerability_class", "risk_score", "unmet_mcm_2020", "unmet_mcm_2050")},
        "drivers": m["drivers"],
    }
    return {"type": "Feature", "properties": props, "geometry": geometry}


def main():
    sheds = json.load(open(SRC_SHEDS))
    feats = []
    for f in sheds["features"]:
        shed = f["properties"]["shedId"]
        if shed in DERIVED:
            feats.append(feature(DERIVED[shed], f["geometry"], "derived"))
    for name, coords in APPROX_GEOM.items():
        feats.append(feature(name, {"type": "Polygon", "coordinates": coords}, "approximate"))

    # order by descending risk for stable legend/reading
    order = ["very_high", "high", "moderate", "low", "very_low"]
    feats.sort(key=lambda f: order.index(f["properties"]["risk_class"]))

    fc = {"type": "FeatureCollection", "name": "chennai-sub-basins-risk", "features": feats}
    with open(OUT, "w") as fh:
        json.dump(fc, fh)
    print(f"wrote {len(feats)} features -> {OUT}")
    for f in feats:
        p = f["properties"]
        print(f"  {p['sub_basin']:15} risk={p['risk_class']:10} ({p['boundary_quality']})")


if __name__ == "__main__":
    main()
