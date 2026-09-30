"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { HyderabadPageDescriptions } from "./hyderabad-pages";

/** Hyderabad's About-page content: the slots of the shared About frame that
 *  are specific to Hyderabad. A slot not listed renders the frame's default. */

export default function HyderabadAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <HyderabadPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="HMWSSB daily reservoir statement"
                url="https://bms.hyderabadwater.gov.in/wlrreport/showreport1.aspx"
                description="Level, storage and draw-off per source, published daily by the water board with a 12.5-year archive. This is the series behind the draw-growth fact and the GO 111 dependence figure: the twin reservoirs' share of the city's draw is computed from the publisher's own rows, not asserted."
                frequency="daily"
              />
              <DataSource
                name="HMWSSB tanker bookings (data.telangana.gov.in)"
                url="https://data.telangana.gov.in/dataset/hyderabad-metropolitan-water-supply-and-sewerage-board-hmwssb-water-tankers-data"
                description="HMWSSB's own monthly tanker bookings and deliveries by division and section, from January 2022, read from the Telangana Open Data Portal. Powers the tanker surfaces and the tanker facts: demand concentrates in Kondapur, Madhapur and Manikonda, not the old city. HMWSSB re-cut its sections in February 2026, so section rankings are given before and after that month."
                frequency="monthly"
              />
              <DataSource
                name="HMWSSB billing and collection ledger (data.telangana.gov.in)"
                url="https://data.telangana.gov.in/dataset/hyderabad-metropolitan-water-supply-and-sewerage-board-hmwssb-billing-and-collection-data"
                description="Monthly billed demand against collection per division, January 2022 to June 2026, under GODL-India. The collection-efficiency fact is a straight division of the board's own columns."
                frequency="monthly"
              />
              <DataSource
                name="HMDA Lake Protection Committee gazetted lake register"
                url="https://lakes.hmda.gov.in/"
                description="The register of 2,978 gazetted lakes with each one's FTL notification status - preliminary versus final - and district. Powers the water-bodies and restoration surfaces, including the lake-register and Rangareddy facts. FTL boundaries themselves are published as raster sheets, not vectors."
                frequency="register (read July 2026)"
              />
              <DataSource
                name="TGRAC study of ORR water-body encroachment, 2014-2023"
                url="https://www.siasat.com/171-lakes-encroached-in-hyderabad-betwee-2014-and-2023-report-3109650/"
                description="The Telangana Remote Sensing Applications Centre compared imagery of all 920 water bodies inside the ORR between 2014 and 2023. The report was submitted to the Deputy Chief Minister and is not itself published; the figures here come from press reporting of that submission and are labelled accordingly."
                frequency="one-time study (reported October 2024)"
              />
              <DataSource
                name="TGPCB sewage treatment plant monitoring (data.telangana.gov.in)"
                url="https://data.telangana.gov.in/dataset/telangana-pollution-control-board-stp-sewage-treatment-plant-data"
                description="Per-plant treated-effluent readings under GODL-India, through November 2024 - the series behind the Amberpet effluent fact."
                frequency="monthly (through Nov 2024)"
              />
              <DataSource
                name="CGWB / IN-GRES groundwater assessment + India-WRIS levels"
                url="https://ingres.iith.ac.in/"
                description="The annual district assessment - Hyderabad is Telangana's one Critical district, at 98.32% extraction in 2025 - plus CGWB observation-well levels from the India-WRIS API for the point map."
                frequency="annual assessment; well levels as published"
              />
              <DataSource
                name="GHMC storm-water drain (nala) layer (via OpenCity)"
                url="https://data.opencity.in/dataset/hyderabad-canals-drains-and-tanks-lakes"
                description="96 nalas with per-nala encroachment fields in the schema. The fields are empty in the published extract, which the flood page states as a data gap rather than papering over. The extract itself is undated."
                frequency="undated extract"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
