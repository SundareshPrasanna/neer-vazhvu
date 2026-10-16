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
    case "source-wris-gwr":
      return (
        <DataSource
          name="IN-GRES - Dynamic Ground Water Resources (West Bengal, by district)"
          url="https://ingres.iith.ac.in/"
          description="The annual national groundwater assessment, read here for Kolkata and the five districts around it across four assessment years. It does not place Kolkata district, or South 24 Parganas, anywhere from safe to over-exploited: it classes both as salinity, a water-quality category, so they carry no extraction figures. The other four districts are assessed on extraction."
          frequency="annual"
        />
      );
    case "data-sources-4":
      return (
        <DataSource
          name="India-WRIS Ground Water Level - CGWB observation wells"
          url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
          description="703 Central Ground Water Board observation wells across the metropolitan area, 2010 to 2026. Some wells have automatic recorders that read every 6 hours and others are read by hand; the groundwater page shows them as monthly means. Howrah has no reading after 30 April 2023 and Hooghly none after 30 November 2022."
          frequency="6-hourly and manual, shown monthly"
        />
      );
    case "river-status-footnote":
      return (
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 italic">
          Status thresholds follow CPCB&apos;s published Designated Best-Use criteria; readings are from the West Bengal Pollution Control Board&apos;s EMIS portal (41 stations, sampled each quarter at high and low tide).
        </p>
      );
    default:
      return <>{fallback}</>;
  }
}
