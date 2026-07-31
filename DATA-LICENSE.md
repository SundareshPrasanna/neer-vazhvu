# Data licence notice

This is the data-specific notice referred to in [`LICENSE`](LICENSE) and
[`README.md`](README.md). It is a statement of what the data carries. It is not
legal advice and it does not assert a position on what you may do with it.

## Code and data are licensed separately

**The code is MIT.** Application source, scripts, schemas, configuration and the
documentation of the code are covered by [`LICENSE`](LICENSE), unchanged.

**The data is not.** The corpus under `public/data/` and `public/geojson/`, and
the inputs under `pipeline-inputs/`, are compiled from many upstream publishers.
Each dataset carries the licence of its own upstream source or sources. The MIT
grant in `LICENSE` does not reach it and never did.

This matters in both directions. Some artefacts derive from inputs that are
**non-commercial**, and some from inputs that are **ShareAlike**, which requires
derivatives to be redistributed under the same terms. Neither condition is
compatible with an unqualified MIT grant, so this file states the separation
plainly rather than leaving it implied.

## Where the authoritative record lives

Per artefact, in two places:

- the artifact's **NVDM envelope**, at `provenance.sources[].license` (schema in
  [`schemas/nvdm/`](schemas/nvdm/)). This is the record for that one file,
  including its lineage through `provenance.internal_inputs`;
- the **Headwaters source registry**, [`scripts/source-registry/`](scripts/source-registry/),
  which records each upstream source, its publisher, its URL and its licence
  terms, with the evidence and the verification date in the entry's `notes`.

**Consult the envelope before reuse.** Do not infer a dataset's terms from this
page, from a sibling file, or from the repository licence.

To read the position mechanically:

```sh
python3 scripts/build_dataset_catalogue.py      # refresh the catalogue
python3 scripts/nvdm-encumbrance-report.py      # per-artifact licence buckets
python3 scripts/nvdm-encumbrance-report.py --list nc
```

The report buckets every enveloped artifact as `restricted`, `nc`,
`share-alike`, `third-party`, `vague`, `gov-attribution` or `clean-open`, and it
propagates the worst bucket through declared lineage. It fails closed: an
unrecognised licence string is a loud error, never a silent pass.

## Notable restricted inputs

Not exhaustive. These are the inputs whose terms most change what a reuser must
do. The registry entry for each carries the full wording and the verification
date.

| Source | Terms | What they require |
|---|---|---|
| `fabdem-dem` (FABDEM, Fathom / Univ. of Bristol) | CC BY-NC-SA 4.0 | Non-commercial use only, **and** ShareAlike: anything built on it must be redistributed under the same licence. Reaches the whole `public/data/cascade/` family and the elevation-band layers. Carries the Copernicus notice below. |
| `hydrosheds-basins` (HydroBASINS, WWF) | Bespoke WWF licence, HydroSHEDS v1 Appendix A | Not an open licence. Free for non-commercial and commercial use (tech doc s.7.1), but no distribution "as a stand-alone product" (s.2.1.2), mandatory Exhibit B attribution (s.2.2, reproduced below), and WWF asserts ownership of modifications "however developed" (s.3). |
| `merit-hydro` (MERIT Hydro, Univ. of Tokyo) | Dual: CC BY-NC 4.0 **or** ODbL 1.0 | Under ODbL, commercial use is permitted but derived data must be published under ODbL. Which arm this repo's trace used is unrecorded. |
| `tngcc-ceew-basin-risk` (CEEW + TN Climate Change Mission) | CC BY-NC 4.0 | Non-commercial only. |
| `iisc-groundwater-outlook` (IISc, via OpenCity) | CC BY-NC | Non-commercial only. Feeds the Bengaluru groundwater layer. |
| `opencity-bengaluru-tanker-survey` (OpenCity) | CC BY-NC-SA 4.0 | Non-commercial and ShareAlike. |
| `praja-civic-issues-mumbai` (Praja Foundation) | CC BY-NC, and third-party copyright | Non-commercial, and the underlying report is Praja's own copyrighted work, not ours to relicense or mirror. |
| `cpcb-nwmp-annual`, `cpcb-prs-report` (CPCB) | Permission required | CPCB's website policy permits material to be downloaded to file or printer; "Any other proposed use of the material is subject to the approval of competent authority of CPCB." |
| `dpcc-monthly-analysis-delhi` (DPCC) | Permission required | "Contents of this website may not be reproduced partially or fully, without due permission." |
| `osm-overpass`, `overture-buildings`, `google-open-buildings` | ODbL 1.0 (Overture varies by theme) | Commercial use permitted. ShareAlike applies to a redistributed derivative database, not to a rendered map or report. |
| `datameet-mumbai-spatial` (DataMeet) | CC BY-SA 2.5 IN | ShareAlike. |
| `ingres-gw-assessment-*` (IN-GRES) | None published | The IN-GRES portal publishes no terms of use, disclaimer or licence anywhere. CGWB is the upstream authority. |

## Attribution notices

Several upstream licences require attribution and expressly permit it to be
given in one place. This is that place.

### HydroSHEDS / HydroBASINS

Required verbatim by Exhibit B of the HydroSHEDS v1 licence:

> This product [Neer Vazhvu] incorporates data from the HydroSHEDS version 1
> database which is © World Wildlife Fund, Inc. (2006-2022) and has been used
> herein under license. WWF has not evaluated the data as altered and
> incorporated within [Neer Vazhvu], and therefore gives no warranty regarding
> its accuracy, completeness, currency or suitability for any particular
> purpose. Portions of the HydroSHEDS v1 database incorporate data which are the
> intellectual property rights of © USGS (2006-2008), NASA (2000-2005), ESRI
> (1992-1998), CIAT (2004-2006), UNEP-WCMC (1993), WWF (2004), Commonwealth of
> Australia (2007), and Her Royal Majesty and the British Crown and are used
> under license.

Exhibit B also requires the database URL and the scientific citation:
The HydroSHEDS v1 database and more information are available at
https://www.hydrosheds.org. Lehner, B., Verdin, K., Jarvis, A. (2008): New
global hydrography derived from spaceborne elevation data. *Eos, Transactions,
AGU*, 89(10): 93-94.

### FABDEM and Copernicus WorldDEM-30

FABDEM is licensed under **CC BY-NC-SA 4.0** (Hawker et al., University of
Bristol / Fathom). FABDEM is derived from the Copernicus GLO-30 DEM, so the
Copernicus attribution passes down and must appear verbatim:

> produced using Copernicus WorldDEM-30 © DLR e.V. 2010-2014 and © Airbus
> Defence and Space GmbH 2014-2018 provided under COPERNICUS by the European
> Union and ESA; all rights reserved

Citation: Hawker, L., Uhe, P., Paulo, L., Sosa, J., Savage, J., Sampson, C.,
Neal, J. (2022): A 30 m global map of elevation with forests and buildings
removed. *Environmental Research Letters*, 17(2), 024016.

### OpenStreetMap

Water body polygons, river geometry and locality indices derive from
OpenStreetMap. © OpenStreetMap contributors, available under the Open Database
License (ODbL). Printed outputs must print the URL
`https://www.openstreetmap.org/copyright` itself, since a hyperlink is not
available on paper.

### Copernicus / ESA and the JRC Global Surface Water dataset

Contains modified Copernicus Sentinel data. Global Surface Water: *Source: EC
JRC/Google*, with the required citation Pekel, J.-F., Cottam, A., Gorelick, N.,
Belward, A.S. (2016): High-resolution mapping of global surface water and its
long-term changes. *Nature*, 540, 418-422.

### USGS and NASA

Landsat data courtesy of the U.S. Geological Survey. SRTM elevation data
courtesy of NASA/JPL/USGS.

### Government Open Data License - India

`datagovin-waterbodies-census-tn` (First Census of Water Bodies, 2018-19) is
published by the Ministry of Jal Shakti on data.gov.in under the Government Open
Data License - India, which requires attribution to the provider.

### Asian Development Bank

`adb-tnufip-iee` is published by the Asian Development Bank under CC BY 3.0 IGO.

### Government publications cited with attribution

Many sources are Indian central, state, municipal or public-undertaking
publications carrying no licence of their own, used with attribution to the
publishing body. Two carry an express permission that is worth quoting, because
both replace assumptions previously recorded in this repository:

- **CGWB** (`cgwb.gov.in/en/website-policies`): material "may be reproduced free
  of charge in any format or media without requiring specific permission",
  subject to accurate reproduction and prominent acknowledgement of the source.
- **India-WRIS** (`indiawris.gov.in`): the same wording, for material featured
  on the India-WRIS website.

Other publishers acknowledged in the registry include CMWSSB, BWSSB, BMC, DJB,
DUSIB, MPCB, KSPCB, TNPCB, GCC, Madurai City Municipal Corporation, CWC, NMCG,
IMD, TNSWA, CRRT, the Tamil Nadu and Maharashtra Water Resources Departments,
and the state election commissions. Per-source detail is in
[`scripts/source-registry/`](scripts/source-registry/) and in
[`DATA_SOURCES.md`](DATA_SOURCES.md).

## Reporting a licence error

If a licence recorded here or in the registry is wrong, or if you are a
publisher who wants an attribution changed or a dataset removed, open an issue
or write to contact@neervazhvu.org. Corrections are made against the publisher's
own terms text, with the URL and date recorded in the registry entry.
