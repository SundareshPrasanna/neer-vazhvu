"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { SuratPageDescriptions } from "./surat-pages";

/** Surat's About-page content: the slots of the shared About frame that
 *  are specific to Surat. A slot not listed renders the frame's default. */

export default function SuratAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <SuratPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="SMC flood chain page (Ukai, causeway, khadis, zone rainfall)"
                url="https://www.suratmunicipal.gov.in/Home/RainfallInfo"
                description="The city's one live feed, and the only page on this platform where the publisher supplies both the reading and the operational threshold at every link: Ukai's full reservoir level, the causeway's overflow level, and a danger level for each of five khadis. SMC publishes a rolling window of about ten readings with no archive, so the series here starts the day capture began. Dam and weir rows are credited by SMC to the Irrigation Department and the Collector's office."
                frequency="daily (scraped; rolling upstream window)"
              />
              <DataSource
                name="SMC, 'Reuse of Treated Used Water: A Successful Model' (8 March 2024)"
                url="https://cdn.cseindia.org/attachments/0.84371800_1709877539_surat-municipal-corporation.pdf"
                description="The corporation's own account of its reuse programme, presented at a CSE convening: 330 MLD reused across eleven named uses, Rs 496.23 crore cumulative revenue to January 2024, 249 industrial buyers. Dated document figures, labelled with their vintage rather than as live numbers."
                frequency="one-time (Mar 2024)"
              />
              <DataSource
                name="Smart Cities Mission (Surat) water-supply release, data.gov.in"
                url="https://www.data.gov.in/resource/water-supply-surat"
                description="48 monthly rows under GODL-India. Two of its columns are synthetic - 'losses including NRW' is a constant 20% and 'actual supplied' equals total supply on every row - so nothing on this platform is derived from either; the release is cited for what it measures and flagged for what it assumes."
                frequency="monthly release (as published)"
              />
              <DataSource
                name="CPCB National Water Quality Monitoring Programme 2022 (Tapi)"
                url="https://cpcb.gov.in/nwmp-data-2022/"
                description="Seven Gujarat Tapi stations from Ukai to ONGC Hazira forming an upstream-to-sea profile - the conductivity series behind the salinity fact."
                frequency="annual"
              />
              <DataSource
                name="SMC wardwise area and population"
                url="https://www.suratmunicipal.gov.in/TheCity/City/Stml2"
                description="134 ward rows with area and census population 1961-2011 - the record of the city growing fifty-fold onto an estuarine flood plain."
                frequency="per census / annexation"
              />
              <DataSource
                name="India-WRIS groundwater level exports (Surat district)"
                url="https://indiawris.gov.in/Dataset/Ground%20Water%20Level"
                description="About 94 stations and 6,563 readings, 1970 to 2026 - deep in time, thin in space, so the groundwater page renders the points themselves rather than an interpolated surface."
                frequency="as published (manual to telemetric)"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
