"use client";

import { getPlaceConfig } from "@/lib/cities";
import { DataSource } from "@/components/about/primitives";
import type { CityAboutSlotProps } from "@/components/about/city-about";
import { MumbaiPageDescriptions } from "./mumbai-pages";

/** Mumbai's About-page content: the slots of the shared About frame that
 *  are specific to Mumbai. A slot not listed renders the frame's default. */

export default function MumbaiAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  const config = getPlaceConfig(cityId);
  const cityName = config.displayName;
  switch (slot) {
    case "pages-1":
      return (
        <>
            <MumbaiPageDescriptions cityId={config.cityId} cityName={cityName} />
          
        </>
      );
    case "data-sources-2":
      return (
        <>
            <>
              <DataSource
                name="Maharashtra WRD Pravah - daily dam-safety bulletin"
                url="https://mwrdpravah.in/damsafety/control/main"
                description="The state Water Resources Department's daily all-Maharashtra bulletin (139 dams). We parse Bhatsa, Upper and Middle Vaitarna, Modak Sagar and Tansa - about 97% of the BMC lake system's capacity. Vihar and Tulsi (BMC-owned) appear in no public feed anywhere, a named gap the dashboard states. The bulletin's same-date-last-year column is harvested too, so the history grows at both ends every day."
                frequency="daily (morning bulletin)"
              />
              <DataSource
                name="CWC weekly Reservoir Storage Bulletins (2015-2025 backfill)"
                url="https://cwc.gov.in/reservoirs-storage-bulletin"
                description="527 Central Water Commission weekly bulletin PDFs mined one-off for the decade of history the daily feed is too young to hold: ~1,000 weekly readings for Bhatsa and Upper Vaitarna, April 2015 to May 2025 where the archive ends. Insert-only - the backfill never overwrites the live feed. Roughly 20 weeks of 2022 are missing on CWC's own server."
                frequency="one-off backfill (archive ended May 2025)"
              />
            </>
          
        </>
      );
    case "data-sources-4":
      return (
        <>
            <>
              <DataSource
                name="CGWB Ground Water Year Book of Maharashtra"
                url="https://cgwb.gov.in/cgwbpnm/"
                description="~53 National Hydrograph Network wells across Mumbai / Thane / Palghar / Raigad transcribed from the Year Book to January 2025, with water chemistry (EC, chloride, nitrate) - the honest signal for a city excluded from the Dynamic Assessment. India-WRIS also lists ~24 manual wells for the city, but they end in May 2023; we document them rather than plot a stale layer."
                frequency="annual (per Year Book release)"
              />
            </>
          
        </>
      );
    case "data-sources-5":
      return (
        <>
            <>
              <DataSource
                name="Bombay HC / NGT water-body orders (LawBeat, SANDRP, Live Law)"
                url={`/${config.cityId}/lake-restoration`}
                description="Six court anchors curated from legal reporting: the NGT Powai sewage matter (a recommended Rs 5 lakh-per-inlet monthly penalty on BMC), the Banganga Talao immersion refusal, the statewide artificial-ponds immersion order, Lotus Lake (Nerul) protection, the NRI-wetland golf-course reclamation ban, and the Goregaon wetland landfilling notices."
                frequency="incident-driven (court orders)"
              />
              <DataSource
                name="Lake catchment atlas (FABDEM terrain derivation)"
                url={`/${config.cityId}/water-bodies?mode=catchments`}
                description="Forest-and-buildings-removed DEM (FABDEM) + flow-direction analysis derives each BMC lake's contributing catchment - the same pipeline as the other cities. Lives as the Catchments view on the water-bodies page."
                frequency="static (regenerate on pipeline updates)"
              />
            </>
          
        </>
      );
    case "data-sources-6":
      return (
        <>
            <>
              <DataSource
                name="MPCB annual Water Quality Status reports"
                url="https://mpcb.gov.in/water-quality"
                description="Five editions mined (the 2019-20 report was never published - a named gap). Powers the Mithi BOD series at station 2168: 45.3 -> 18.3 -> 28.2 -> 37.3 -> 53.0 mg/l annual averages to 2023-24 (WQI 32), and the consistently clean Ulhas mainstem. The Waldhuni has no MPCB station at all - no public series exists. Fecal-coliform units are inconsistent across editions, so we treat FC as directional only."
                frequency="annual"
              />
              <DataSource
                name="CPCB Polluted River Stretches for Restoration - 2025"
                url="https://cpcb.gov.in/water-quality-data/"
                description="The October 2025 national PRS list (on 2022-23 data): the Mithi at Mahim is Priority I with max BOD 210 mg/l - India's single worst river stretch. The Ulhas is Priority V (least severe). Dahisar, Poisar, Oshiwara and Waldhuni do not appear in the national list."
                frequency="periodic (PRS assessment cycles)"
              />
            </>
          
        </>
      );
    case "data-sources-7":
      return (
        <>
            <DataSource
              name="GEE MNDWI shoreline transects (Landsat + Sentinel-2)"
              url={`/${config.cityId}/shoreline`}
              description="Our own west-coast shoreline-change measurement, 1990-2026: MNDWI water-index shorelines from annual dry-season composites, sampled along fixed transects. Corroborated against the published record (NCCR's 1990-2016 district table; Maharashtra Shoreline Management Plan 2017 risk grades) because no rate-publishing paper exists for Mumbai. Mumbai's ~3-5 m spring tides add positional noise Chennai's microtidal coast lacks - the page says to lean on the pattern, not single-transect absolutes."
              frequency="yearly (post dry-season)"
            />
          
        </>
      );
    case "data-sources-8":
      return (
        <>
            <DataSource
              name="DataMeet - Mumbai administrative-ward boundaries"
              url="https://datameet.org/"
              description="The 24 BMC administrative-ward polygons (2023 vintage) that anchor ward-level joins, plus the 2024 corporation boundaries for the nine-corporation regional view. The other eight corporations' wards have no known public geometry (State Election Commission delimitation PDFs only) - a named gap."
              frequency="static"
            />
          
        </>
      );
    case "source-imd-rainfall":
      return (
        <>
          <DataSource
            name="IMD Gridded Rainfall (via imdlib)"
            url="https://imdlib.readthedocs.io/"
            description="India Meteorological Department 0.25-degree gridded rainfall, 1970-present. Mumbai grid cell at 19.0 deg N, 73.0 deg E. The authoritative backbone and normals for the rainfall chart; publishes with a weeks-to-a-year lag, so a daily Open-Meteo provisional layer fills the gap through yesterday."
            frequency="monthly archive"
          />
        </>
      );
    case "source-wris-gwr":
      return (
        <>
          <DataSource
            name="India WRIS / CGWB - block-level Dynamic GWR"
            url="https://indiawris.gov.in/"
            description="Annual block-level Dynamic Groundwater Resource Assessment (Safe / Semi Critical / Critical / Over Exploited). Mumbai City and Mumbai Suburban are the only 2 of Maharashtra's 35 districts EXCLUDED from this assessment - no exploitation categories exist for the city, so the groundwater page says so instead of synthesizing one."
            frequency="annual"
          />
        </>
      );
    case "flood-infrastructure":
      return (
        <>
            <>
              <DataSource
                name="BMC Disaster Management - chronic flood-spot register"
                url={`/${config.cityId}/flood-risk`}
                description="BMC's own register of monitored waterlogging spots, refreshed weekly in season. 110 spots carry locations; the full pre-monsoon list (496 in 2026, grown from 386 in 2024) is published only as counts - the ward-wise list is an RTI follow-up. No other MMR corporation publishes an equivalent register (a named gap on the flood page)."
                frequency="weekly (in-season register scrape)"
              />
              <DataSource
                name="Maharashtra WRD red/blue flood-line map sheets"
                url="https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps"
                description="The legal river-floodplain boundaries (blue = 25-year level, construction prohibited; red = 100-year, restricted): 41 sheets covering 6 MMR rivers including the Ulhas 0-84 km flood corridor, from WRD's 494-sheet statewide list. Scanned A0 plots, not georeferenced - linked as cited documents; georeferencing into a map overlay is a logged follow-up. BMC publishes no equivalent for the city's own rivers (Mithi, Dahisar, Poisar, Oshiwara)."
                frequency="static (official map sheets)"
              />
              <DataSource
                name="Chitale Fact-Finding Committee - 26/7/2005 record"
                url={`/${config.cityId}/flood-risk`}
                description="The official inquiry into the 26 July 2005 deluge (944 mm in 24 hours) anchors the reference layer. Point coordinates are estimated locality centroids - no reviewed source publishes exact coordinates, and no official GIS inundation extent is public."
                frequency="static (historical record)"
              />
              <DataSource
                name="iFLOWS-Mumbai (documented transparency gap)"
                url={`/${config.cityId}/flood-risk`}
                description="The Mumbai flood-forecast model built with public money briefs officials only - no public dashboard, API or archive. Documented as a transparency gap rather than silently omitted."
                frequency="data gap"
              />
            </>
          
        </>
      );
    default:
      return <>{fallback}</>;
  }
}
