"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { DelhiPageDescriptions } from "./delhi-pages";

/** Delhi's About-page content: the slots of the shared About frame that
 *  are specific to Delhi. A slot not listed renders the frame's default. */

export default function DelhiAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <DelhiPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="DPCC monthly analysis reports - Yamuna stations + drain network"
                url="https://dpcc.delhi.gov.in/dpcc/analysis-reports"
                description="Delhi Pollution Control Committee's monthly lab reports: 8 Yamuna river stations and the ~39-point drain network, sampled monthly and published around the 25th. This is the highest-cadence public river feed of any city here - everywhere else is on annual CPCB NWMP. The drain table is the verification instrument for the commitment to trap all 39 major drains: a trapped drain reads NO FLOW. WATCH THIS: the listing is a rolling three-month window, no one mirrors it, and the Internet Archive has never captured it - a month not saved while it is listed is gone for good."
                frequency="monthly (rolling 3-month listing)"
              />
              <DataSource
                name="DPCC CETP monthly archive (via OpenCity)"
                url="https://data.opencity.in/dataset/delhi-cetp-monthly-water-quality-data-2022-2024"
                description="Per-plant analysis reports for Delhi's 13 Common Effluent Treatment Plants, 2019-2024, mirrored by OpenCity as monthly PDF bundles. We read each plant's design capacity against its MEASURED monthly inflow, which is how the industrial layer works: Delhi built 213.8 MLD of effluent-treatment capacity and receives about a third of it in a median month. The PDFs are image scans, so figures are OCR-extracted and validated against a hand-transcribed page. Series ends November 2024."
                frequency="monthly (archival - ends Nov 2024)"
              />
              <DataSource
                name="India-WRIS Ground Water Level - CGWB observation wells"
                url="https://indiawris.gov.in/wris/"
                description="237 Central Ground Water Board observation wells across all 11 Delhi districts, 2015-2025, behind the WRIS dataset API. This is what gives Delhi groundwater at points rather than only the 11-district assessment polygons. Depth sign differs by installing programme, so it is resolved per station and cross-checked against known hydrogeology (ridge wells ~68 m against floodplain wells ~2 m). The network stops reporting 20 September 2025."
                frequency="was 6-hourly telemetric; stopped 20 Sep 2025"
              />
              <DataSource
                name="CGWB Dynamic Ground Water Resources + IN-GRES"
                url="https://ingres.iith.ac.in/"
                description="The annual groundwater assessment behind the district choropleth. Delhi is assessed by DISTRICT, not by block as most states are: 2024-25 puts New Delhi at 123.2% of annual recharge, Shahdara 112.2%, North East 106.0% and South 103.4%. IN-GRES is IIT-Hyderabad hosted and reachable where the NIC-hosted portals are not; the 2022-23 cycle is mirrored nowhere else and was taken from it directly."
                frequency="annual"
              />
              <DataSource
                name="CAG performance audit of Delhi Jal Board (Report No. 3 of 2025)"
                url="https://cag.gov.in/en/audit-report"
                description="Tabled 23 March 2026. The audited numbers behind the dashboard: 51-53% non-revenue water, Rs 4,988 crore revenue impact, Rs 66,595 crore debt, and only 40% of production billed. Where the Delhi Economic Survey's claimed availability and the CAG's audited production disagree, both are shown rather than one being quietly preferred."
                frequency="episodic (audit reports)"
              />
              <DataSource
                name="DUSIB - JJ basti roster and coordinates"
                url="https://delhishelterboard.in/main/?page_id=3644"
                description="The Delhi Urban Shelter Improvement Board's register of 675 JJ bastis (306,521 households), published as two separate PDFs - the household roster and, separately, the latitude/longitude list. They use different serial numbering, so households are joined to positions on location name and every row records whether that match was exact. 642 clusters fall inside an MCD ward; the 33 that do not are in NDMC or the Cantonment, which are outside the 250-ward delimitation."
                frequency="episodic (2019 roster, 2022 coordinates)"
              />
              <DataSource
                name="SEC Delhi ward delimitation 2022 (via OpenCity)"
                url="https://data.opencity.in/"
                description="All 250 post-unification MCD wards - the current delimitation, not the pre-merger 272 or the commonly-cited 270. OpenCity's digitisation was delisted, so the copy in use was verified byte-for-byte against the Internet Archive's capture of the original download before it was trusted. Every ward number joins the December 2022 election results with no name mismatches."
                frequency="per delimitation (2022)"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
