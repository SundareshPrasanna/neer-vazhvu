"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { KolkataPageDescriptions } from "./kolkata-pages";

/** Kolkata's About-page content: the slots of the shared About frame that
 *  are specific to Kolkata. A slot not listed renders the frame's default. */

export default function KolkataAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <KolkataPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="KMC District Environment Plan 2021"
                url="https://www.kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf"
                description="The corporation's own statutory environment plan: the 1,400 MLD sewage balance, the East Kolkata Wetlands' 910 MLD share, and the resident-plus-floating population figures behind the contested-denominator fact."
                frequency="one-time (2021 edition)"
              />
              <DataSource
                name="KMC, Sewerage and Drainage (2009)"
                url="https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf"
                description="States the main network 'was designed to discharge a rainfall of 6 mm. per hour' - the design standard the drainage page measures hourly rainfall against, paired with Open-Meteo ERA5."
                frequency="one-time (2009)"
              />
              <DataSource
                name="WBPCB EMIS surface-water quality"
                url="http://emis.wbpcb.gov.in/waterquality/showwqprevdatachoosedist.do"
                description="Twelve years of quarterly samples, taken separately at high and low tide - which is how the Adi Ganga's NIL dissolved oxygen at Bansdroni is visible tide by tide."
                frequency="quarterly"
              />
              <DataSource
                name="KMC Water Supply Department"
                url="http://www.kmc-wd.com/"
                description="Treatment capacities, the run-of-river supply chain from Palta, and the 'static population' the department frames demand against. Kolkata impounds nothing, so there is no reservoir feed to scrape - the structural fact the dashboard leads with."
                frequency="static pages"
              />
              <DataSource
                name="KMC Weekly Drainage Activity Chart"
                url="https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf"
                description="Replaced in place every week with no archive kept upstream, so the series exists only because it is captured here weekly."
                frequency="weekly (captured; no upstream archive)"
              />
              <DataSource
                name="East Kolkata Wetlands Management Authority"
                url="http://ekwma.in/ek/index.php"
                description="The Ramsar-site authority for the wetland that does most of the city's sewage treatment - boundary and management context for the EKW surfaces."
                frequency="manual"
              />
              <DataSource
                name="British Geological Survey / ADB groundwater study (2018)"
                url="https://www.adb.org/sites/default/files/linked-documents/49107-006-sd-01.pdf"
                description="Groundwater context built on PHED IMIS records to April 2016 - the best public depth picture for the city's tube-well belt."
                frequency="one-time (2018)"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
