"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { PunePageDescriptions } from "./pune-pages";

/** Pune's About-page content: the slots of the shared About frame that
 *  are specific to Pune. A slot not listed renders the frame's default. */

export default function PuneAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <PunePageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="PMC Draft Environment Status Report 2025-26"
                url="https://webadmin.pmc.gov.in/sites/default/files/2026-08/PMC%20Draft%20ESR%202025-26_compressed.pdf"
                description="The corporation's own current-year environment report - the supply, sewage and per-source figures the facts page cites."
                frequency="annual"
              />
              <DataSource
                name="PMC daily tanker delivery registers (JSON:API)"
                url="https://webadmin.pmc.gov.in/en/jsonapi/node/water_tanker"
                description="A spreadsheet per filling point per working day, one row per tanker sent. Aggregated to counts and shares; the source rows carry recipient addresses and phone numbers and none of that is republished."
                frequency="daily registers, aggregated on build"
              />
              <DataSource
                name="Maharashtra WRD Pravah daily dam-safety bulletin"
                url="https://mwrdpravah.in/damsafety/control/pdfLatestReportEng"
                description="The state's daily all-dams bulletin, from which the Khadakwasla chain's four dams are read for the reservoir surfaces."
                frequency="daily"
              />
              <DataSource
                name="MWRRA allocation orders (19/2018 and 01/2025)"
                url="https://mwrra.maharashtra.gov.in/"
                description="The regulator's orders on Pune's water entitlement, with PMC's and WRD's affidavits on record - the paper trail behind the allocation surfaces."
                frequency="episodic (orders)"
              />
              <DataSource
                name="IN-GRES groundwater assessment (2025-2026 edition)"
                url="https://ingres.iith.ac.in/"
                description="District and taluka assessment for Pune. IN-GRES publishes per-state editions on different cycles, so the vintage is stated on the page rather than assumed."
                frequency="annual (per-state editions)"
              />
              <DataSource
                name="India-WRIS / NWDP groundwater level telemetry (Maharashtra)"
                url="https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-6-hourly-maharashtra"
                description="Six-hourly telemetric depth-to-water for the point map."
                frequency="6-hourly telemetry"
              />
              <DataSource
                name="CPCB Polluted River Stretches (October 2025)"
                url="https://cpcb.gov.in/openpdffile.php?id=UmVwb3J0RmlsZXMvMTc3N18xNzYwNjgxNDA4X21lZGlhcGhvdG80MzkyLnBkZg=="
                description="The Mula-Mutha's priority classification in CPCB's national polluted-stretches list."
                frequency="episodic (CPCB updates)"
              />
              <DataSource
                name="Maharashtra WRD flood line maps"
                url="https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps"
                description="The statewide register of red and blue flood-line sheets - scanned PDFs organised by river, with Pune's Mula, Mutha, Pawna and Indrayani sheets inside it. Nothing in it is machine-readable, which is why no flood-line layer can be drawn for Pune."
                frequency="as published (scans)"
              />
              <DataSource
                name="OpenStreetMap water bodies"
                url="https://www.openstreetmap.org/copyright"
                description="Every lake, tank and reservoir polygon on the Pune map is OSM (ODbL 1.0), because no government register exists to use instead - PMC's only water-body file is twelve polygons of river channel."
                frequency="as edited (ODbL)"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
