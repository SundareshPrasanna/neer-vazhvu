"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { GurugramPageDescriptions } from "./gurugram-pages";

/** Gurugram's About-page content: the slots of the shared About frame that
 *  are specific to Gurugram. A slot not listed renders the frame's default. */

export default function GurugramAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <GurugramPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="GMDA OneMap asset register (ArcGIS REST)"
                url="https://onemapdepts.gmda.gov.in/server/rest/services"
                description="The authority's own GIS: treatment plants with capacities (Chandu Budhera 300 + Basai 272 MLD), the network, ward boundaries, and the water-body register with its own 1956/2012 cross-survey flags. Capacities are read from this register at build time rather than transcribed, so the dashboard cannot drift from what GMDA publishes; where the press says 670 MLD, both figures appear with their sourcing. No licence is served with the directory and gmda.gov.in asserts all rights reserved - open to read, unlicensed to reuse, so derived aggregates only."
                frequency="read at build time"
              />
              <DataSource
                name="GMDA Water Tanker MIS (bulk-water sales ledger)"
                url="https://www.gmda.gov.in/onlineservices/water-tanker.html"
                description="Every tanker load GMDA sold - date, buyer, volume, price - one XLSX per year across three years. Aggregated on build and never republished row-for-row: counts, sums and shares only, the delivery-address column dropped, buyers as a ranked top-15 by volume."
                frequency="annual XLSX, aggregated on build"
              />
              <DataSource
                name="IN-GRES groundwater assessment (Haryana districts)"
                url="https://ingres.iith.ac.in/"
                description="Extraction against availability, stage and category per district across every published assessment year. This is not depth-to-water - measured levels are a separate India-WRIS series."
                frequency="annual"
              />
              <DataSource
                name="India-WRIS Ground Water Level API"
                url="https://indiawris.gov.in/wris/"
                description="CGWB observation-well depth readings for the point map."
                frequency="as published"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
