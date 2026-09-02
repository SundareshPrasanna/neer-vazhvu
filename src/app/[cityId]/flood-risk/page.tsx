import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { tryGetPlaceConfig } from "@/lib/cities";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import {
  FloodRiskContent,
  type FloodConfig,
} from "./flood-risk-content";
import { FloodRiskBangaloreContent } from "./flood-risk-bangalore-content";
import { FloodRiskMumbaiContent } from "./flood-risk-mumbai-content";
import { InteractiveFloodContent } from "./interactive-flood-content";

interface PageProps {
  params: Promise<{ cityId: string }>;
}

// Per-city SEO description - the fallback must stay city-neutral (the old
// Madurai-specific "Vaigai dam release thresholds" text leaked into every
// other city's search snippet).
const FLOOD_META_DESC: Record<string, string> = {
  chennai:
    "Chennai flood risk - interactive ward map, historical floods, drainage and encroachment layers.",
  madurai:
    "Vaigai dam release thresholds, historical floods, and external monitoring sources for Madurai.",
  bangalore:
    "Bengaluru flood risk - KSRSAC flood hotspots, rajakaluve drainage network, and historical inundation.",
  mumbai:
    "Mumbai flood risk - BMC chronic-flooding register, the 26/7/2005 reference layer, and WRD red/blue flood-line sheets.",
  kolkata:
    "Kolkata flood risk - Victorian drains rated for 6 mm of rain an hour, KMC's live weekly waterlogging register, and the combined sewer system that ties flooding to river pollution.",
  delhi:
    "Delhi flood risk - Yamuna barrage-release thresholds at the Old Railway Bridge, the 2023 record flood, and Hathnikund lead-time context.",
  hyderabad:
    "Hyderabad flood risk - the GHMC nala network, major water-logging locations, and the encroachment data the city defines but does not publish.",
  pune:
    "Pune flood risk - 1,014 km of PMC nalla network, the 1961 Panshet breach with no official death toll, and statutory flood lines that exist only as scanned paper sheets.",
  surat:
    "Surat flood risk - the Ukai release chain, the weir-cum-causeway, five khadis against SMC's published danger levels, and what the corporation does not publish.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Flood Risk | Neer Vazhvu" };
  return {
    title: `${config.displayName} Flood Risk | Neer Vazhvu`,
    description:
      FLOOD_META_DESC[cityId] ??
      `Flood risk, historical floods, and monitoring sources for ${config.displayName}.`,
    alternates: { canonical: `/${cityId}/flood-risk` },
  };
}

const FLOOD_CONFIG_BY_CITY: Record<string, FloodConfig> = {
  // Hyderabad is the first narrative city whose flooding is NOT
  // dam-release-driven, which is why dam_release_threshold_cusecs is now
  // optional. Its floods are rainfall landing on a drain network that is
  // built over: the 2020 events were attributed to blocked and encroached
  // nalas rather than to unprecedented rain. Every figure below is either
  // in-repo or carries its source; no threshold is invented.
  hyderabad: {
    scope_label: { en: "Musi basin + GHMC nala network" },
    cross_links: {
      home_desc: { en: "Daily draw from six sources, and the twelve-year record behind it" },
      rivers_label: { en: "Musi river system" },
      rivers_desc: { en: "The Musi and the Esi - the rivers the twin reservoirs impound, and the channel the city discharges into" },
      water_bodies_desc: { en: "2,978 gazetted lakes, of which 1,626 have no final boundary notification - unsettled edges are where encroachment happens" },
    },
    headline: {
      en: "Hyderabad's flood risk is drainage-driven, not release-driven. The city sits on a tank cascade that was engineered to slow water down, and its 96 mapped nalas carry 245 km of what is left of that drainage. GHMC's own data layer defines fields for encroachments on each nala - government, private and religious, plus cases in court - and publishes all five as zero for all 96 drains. In the city that created HYDRAA in 2024 specifically to demolish encroachments, that is an unfilled column, not a clean record.",
    },
    // Both layers are GHMC's OWN registers, held in the repo since the data
    // acquisition pass and previously rendered nowhere. The 3,960-segment
    // canals-drains file is deliberately NOT mounted here: 3,926 of its
    // features are unnamed generic "Stream" segments from a different source
    // and would bury the 96 named nalas under noise.
    drainage_map: {
      heading: { en: "The drainage network, and where it backs up" },
      note: {
        en: "GHMC's 96 named storm-water nalas carry 245 km across five zones, and GHMC separately publishes 23 major water-logging locations. Plotting them together shows what the narrative above describes: the recurring flood points sit on the nala network, not away from it. Names are GHMC's own; the water-logging register carries no dates or depths, so these are locations rather than a severity ranking.",
      },
      zoom: 11,
      layers: [
        {
          url: "/geojson/hyderabad-nalas.geojson",
          label: "Storm-water nalas",
          kind: "line",
          color: "#2563eb",
          nameProp: "Nala_Name",
        },
        {
          url: "/geojson/hyderabad-waterlogging.geojson",
          label: "Major water-logging points",
          kind: "point",
          color: "#dc2626",
          nameProp: "name",
        },
        {
          // TGDPS automatic weather stations - a live feed, not a static
          // layer. 161 gauges inside one city is the densest urban rain
          // network on the platform; most Indian cities are measured by a
          // single IMD grid square.
          url: "/data/hyderabad-aws-stations.json",
          label: "Rain gauges (TGDPS)",
          kind: "point",
          color: "#059669",
          nameProp: "location",
          arrayProp: "stations",
          latProp: "latitude",
          lngProp: "longitude",
        },
      ],
    },
    historical_events: [
      {
        year: 2020,
        trigger: {
          en: "Extreme October rainfall over a drainage network narrowed by construction on nalas and lake beds",
        },
        impact: {
          en: "The floods that put nala encroachment at the centre of Hyderabad's water politics and led, four years later, to the creation of HYDRAA with powers to demolish structures in lake full-tank-level and buffer zones.",
        },
        source_url: "https://www.thehansindia.com/news/cities/hyderabad/hydbad-set-for-epoch-making-milestone-in-sewage-treatment-1009747",
        source_label: "Contemporary reporting on the post-2020 response",
      },
      {
        year: 1908,
        trigger: {
          en: "The Great Musi Flood, 28 September 1908 - and a cascade failure, not simply a rainfall event",
        },
        impact: {
          en: "Roughly 59,000 houses damaged, and 221 of the 788 tanks strung along the Musi breached - the chain failing link by link, each collapse feeding the next. M. Visvesvaraya was appointed Special Consulting Engineer on 15 April 1909 and proposed impounding reservoirs to hold back 'all floods in excess of what the river channel could carry'. Osman Sagar was begun in 1913 and completed in 1918; Himayat Sagar followed on the Esi. Both were built as flood control first and water supply second.",
        },
        source_url: "https://en.wikipedia.org/wiki/Great_Musi_Flood_of_1908",
        source_label: "Great Musi Flood of 1908",
      },
    ],
    external_sources: [
      {
        name: "TGDPS automatic weather stations",
        url: "https://tgdps.telangana.gov.in/GHMC.jsp",
        cadence: "daily",
        description: {
          en: "161 rain gauges inside the city, each with coordinates and a daily cumulative total. Every other city on this platform infers rainfall from a single 0.25-degree grid cell about 28 km across; for localised flooding that is the difference between seeing a storm and averaging it away.",
        },
      },
      {
        name: "GHMC nala network and major water-logging locations",
        url: "https://data.opencity.in/dataset/hyderabad-canals-drains-and-tanks-lakes",
        cadence: "undated extract",
        description: {
          en: "96 named nalas totalling 245,238 m, plus 23 designated major water-logging points and 3,960 canal and drain segments. Republished by OpenCity; the KMLs carry no edition date, so treat as an undated GHMC extract rather than current-year.",
        },
      },
      {
        name: "HMDA gazetted lake register - full tank levels and buffer zones",
        url: "https://lakes.hmda.gov.in/",
        cadence: "episodic (notifications issued in batches)",
        description: {
          en: "A lake without a final FTL notification has no legally settled boundary to prosecute building against. 1,626 of 2,978 are in that state, and the weakest coverage - 34.5% - is Rangareddy, the Outer Ring Road growth corridor.",
        },
      },
    ],
    data_gaps: [
      {
        en: "GHMC's per-nala encroachment counts are published as a schema and left empty: Govt_Encr, Pvt_Encr, Rel_Encr, Total_Encr and Court_Case all read zero for all 96 drains. Those fields are stripped from our data rather than rendered, because showing them would read as 'zero encroachments'. Because the city has already specified the schema, this is an unusually precise thing to request.",
      },
      {
        en: "No public flood-hazard model. There is no Hyderabad equivalent of Chennai's CFLOWS return-period zones or Mumbai's iFLOWS, so this page carries no modelled inundation extent.",
      },
      {
        en: "No stated drainage design capacity. Kolkata publishes that its sewers were built for 6 mm of rain an hour, which makes rainfall directly comparable against the network. No equivalent figure has been found for Hyderabad's nalas.",
      },
      {
        en: "The 23 water-logging points are locations, not a time series - there is no public record of how often each floods, so they cannot be ranked by frequency.",
      },
    ],
  },
  // Kolkata is the first city here whose flood trigger is NOT a dam or barrage
  // release. It impounds nothing and there is no upstream gate to watch: the
  // trigger is rainfall INTENSITY against a drainage system's stated design
  // capacity. Hence `primary_trigger` rather than dam_release_*.
  kolkata: {
    scope_label: { en: "KMC drainage area" },
    // The independent check on the hero. The hero says reanalysis rainfall beat
    // the 6 mm/h standard for N hours a year; this says which streets actually
    // flooded and where KMC actually sent a machine. Modelled exceedance and
    // observed failure are different evidence and the page carries both.
    live_register: {
      heading: { en: "Where the city actually flooded, this week" },
      note: {
        en: "KMC's Mechanical Sewer Cleansing wing publishes, every week, the waterlogging pockets it sent de-silting machines to, with a borough and ward attribution on every row. KMC overwrites the file in place, so no upstream archive exists and our weekly capture is the only record of past weeks.",
      },
      src: "/data/kolkata-waterlogging-register.json",
      sourceLabel: "KMC Weekly Drainage Activity Chart",
      sourceHref:
        "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf",
    },
    headline: {
      en: "Kolkata's flood risk is drainage-capacity-driven, not release-driven. KMC's own sewerage document states the main network 'was designed to discharge a rainfall of 6 mm. per hour' - across 180 km of century-old brick sewer, with most drainage pumping stations built 50 to 100 years ago. Measured hourly rainfall beat that standard for a mean of 31.8 hours a year over 2000-2025, and the record splits sharply: 19.2 hours a year in 2000-2012 against 44.5 in 2013-2025. Most of the core city is on a COMBINED system, carrying sewage and stormwater in one conduit, which is the single fact tying the city's flooding, its river pollution and its dependence on the East Kolkata Wetlands together.",
    },
    primary_trigger: {
      value: 6,
      unit: { en: "mm of rain per hour" },
      label: { en: "Drainage design standard" },
      note: {
        en: "Above roughly 6 mm in an hour the sewers cannot carry the flow and it backs up into the streets. The standard is a design property quoted from KMC's 2009 Sewerage and Drainage document, and KMC scopes it precisely: to the British-era brick trunk network, 180 km of it, not to every drain in the city. No design standard is published for the areas added since, so read this as a statement about the core city. The wettest hour on record delivered 40.2 mm - 6.7 times capacity.",
      },
    },
    historical_events: [
      {
        year: 2026,
        trigger: { en: "Routine monsoon week, 20-26 July" },
        impact: {
          en: "KMC's own weekly register names waterlogging pockets across most of the city's boroughs in an ordinary week, machine deployments and all. The current week's counts are above, read from the register itself. Kolkata's flooding is not an event, it is a weekly operating condition.",
        },
        source_url: "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf",
        source_label: "KMC Weekly Drainage Activity Chart, 20-26 Jul 2026",
      },
      {
        year: 2021,
        trigger: { en: "Cyclone Yaas plus a spring tide on the Hooghly" },
        impact: {
          en: "Tidal surge up the Hooghly overtopped embankments and flooded low-lying areas, a reminder that Kolkata's flood exposure is coastal-surge as well as rainfall. Storm surge needs a different framing from the drainage standard and is not yet modelled here.",
        },
        source_url: "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf",
        source_label: "Context: KMC Sewerage and Drainage",
      },
      {
        year: 2009,
        trigger: { en: "KMC's own account of why the city floods every year" },
        impact: {
          en: "KMC lists the causes itself: siltation, collapsing brick sewers, destruction of wetlands increasing runoff, century-old pumps, and silted outfall canals. Storm-water drainage pumping stations went from 1 (Southern Avenue) in 2004-05 to 4 by 2009.",
        },
        source_url: "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf",
        source_label: "KMC, Sewerage and Drainage (2009)",
      },
    ],
    external_sources: [
      {
        name: "KMC Weekly Drainage Activity Chart",
        cadence: "Weekly (Mon-Sun), overwritten in place",
        description: {
          en: "The live weekly register of waterlogging pockets KMC sent de-silting machines to, with a borough/ward attribution on every row. KMC overwrites it in place each week, so no upstream archive exists - our weekly capture is the only record of past weeks.",
        },
        url: "https://www.kmcgov.in/KMCPortal/downloads/Weekly_Drainage_Activity_Chart.pdf",
      },
      {
        name: "KEIIP Early Warning System (kflood.in) - OFFLINE",
        description: {
          en: "KEIIP's own programme site links a flood Early Warning System at kflood.in. The domain does not resolve - NXDOMAIN, checked 26 July 2026. A flood early-warning system built under a publicly-funded programme, still advertised by the programme that built it, with nothing behind the link. Kolkata therefore has no public real-time flood warning surface at all.",
        },
        url: "https://www.keiip.in/",
        cadence: "Dead link - domain does not resolve",
      },
      {
        name: "West Bengal flood-line map sheets",
        cadence: "Static scanned sheets, not georeferenced",
        description: {
          en: "West Bengal's legal red/blue flood-boundary map sheets exist as scanned A0 plots and are not georeferenced, so they cannot be rendered as a hazard layer here.",
        },
        url: "https://www.kmcgov.in/KMCPortal/downloads/SewerageAndDrainage.pdf",
      },
    ],
    data_gaps: [
      {
        en: "No public flood model. There is no CFLOWS-equivalent hazard-zone or return-period modelling for Kolkata, so this page carries no hazard choropleth and no 5/10/25/50/100-year extents.",
      },
      {
        en: "The storm-water drain network is PDF-only. KMC publishes 80 per-ward drainage maps as PDFs; the vector network exists on paper but not as data. The 182 drain segments shown come from OpenStreetMap, against Chennai's 10,308 surveyed segments.",
      },
      {
        en: "Rainfall intensity is reanalysis, not gauges. ERA5-family products smooth short convective bursts, so exceedance counts are a LOWER BOUND on the true figure. Kolkata has no public sub-daily rain-gauge network comparable to Hyderabad's 185 stations.",
      },
      {
        en: "Cyclone and storm-surge exposure is real but unframed. The 2021 Yaas surge showed tidal flooding is a second, separate mechanism; it needs its own source and method rather than being folded into the drainage standard.",
      },
      {
        en: "The register records where KMC SENT machines, not everywhere the city flooded. It is an operational log, and reading it as a complete flood inventory would understate the problem.",
      },
      {
        en: "There is no working public flood early-warning system. KEIIP's programme site still links one at kflood.in, but the domain does not resolve (checked 26 July 2026). A city that floods as a weekly operating condition has no live public warning surface.",
      },
    ],
    cross_links: {
      home_desc: { en: "The drainage-capacity hero: how often the sky beats 6 mm an hour" },
      rivers_label: { en: "Kolkata river system" },
      rivers_desc: { en: "The Hooghly, and the Adi Ganga at zero dissolved oxygen" },
      water_bodies_desc: { en: "5,526 OSM water bodies against KMC's 1993 departmental tank list" },
    },
  },
  madurai: {
    scope_label: { en: "Vaigai system scope", ta: "வைகை அமைப்பு எல்லை" },
    headline: {
      en: "Madurai's flood risk is dam-release-driven, not rainfall-driven. The Vaigai's natural catchment is small (2,253 sq km); urban inundation tracks Vaigai-dam outflows on a 12-24 hour lag. There is no public CFM-DSS-equivalent sensor mesh - upstream context comes from CWC and the dam-level scrape.",
      ta: "மதுரையின் வெள்ள ஆபத்து மழையால் அல்ல, அணை-திறப்பால் ஏற்படுகிறது. வைகையின் இயற்கை நீர்ப்பிடிப்பு பகுதி சிறியது (2,253 சதுர கி.மீ.); நகர மூழ்கல் வைகை அணை வெளியேற்றத்தைத் தொடர்ந்து 12-24 மணி நேரத் தாமதத்தில் நடக்கிறது. பொது CFM-DSS போன்ற சென்சார் வலையமைப்பு இல்லை - மேற்பகுதி சூழல் CWC மற்றும் அணை-மட்ட தரவுச் சேகரிப்பிலிருந்து வருகிறது.",
    },
    dam_release_threshold_cusecs: 6000,
    dam_release_note: {
      en: "~6,000 cusec releases from Vaigai dam saturate the downtown channel between Albert Victor bridge and Anuppanadi. Below this threshold the Vaigai bed absorbs the flow; above it, low-lying wards (Sellur, Avaniyapuram, Anuppanadi) start flooding.",
      ta: "வைகை அணையிலிருந்து ~6,000 க்யூசெக்ஸ் வெளியேற்றம் ஆல்பர்ட் விக்டர் பாலத்திற்கும் அனுப்பானடிக்கும் இடையே உள்ள நகர மைய ஓடையை நிரப்புகிறது. இந்த வரம்புக்குக் கீழே வைகை படுகை ஓட்டத்தை உறிஞ்சுகிறது; அதற்கு மேலே, தாழ்வான வார்டுகள் (செல்லூர், அவனியாபுரம், அனுப்பானடி) வெள்ளத்தில் மூழ்கத் தொடங்குகின்றன.",
    },
    historical_events: [
      {
        year: 2023,
        trigger: {
          en: "6,000 cusec release from Vaigai dam during NE monsoon",
          ta: "வடகிழக்கு பருவமழையில் வைகை அணையிலிருந்து 6,000 க்யூசெக்ஸ் வெளியேற்றம்",
        },
        impact: {
          en: "Downtown Madurai inundated; Avaniyapuram and Sellur worst-hit; release coincided with peak rainfall in the catchment.",
          ta: "மதுரை நகர மையம் வெள்ளத்தில் மூழ்கியது; அவனியாபுரம் மற்றும் செல்லூர் கடுமையாக பாதிக்கப்பட்டன; நீர்ப்பிடிப்பு பகுதியில் உச்ச மழையுடன் வெளியேற்றம் ஒத்துப்போனது.",
        },
        // Source omitted: The Hindu article (article67517428.ece) was
        // removed from thehindu.com after publication. Event itself is
        // well-attested in contemporary regional press; we'd rather
        // drop the dead link than substitute one.
      },
      {
        year: 2018,
        trigger: {
          en: "Sustained NE monsoon + Periyar tunnel diversions",
          ta: "தொடர்ச்சியான வடகிழக்கு பருவமழை + பெரியார் சுரங்கப் பாதை திருப்பல்",
        },
        impact: {
          en: "Significant Vaigai-bed inundation; upstream-tank cascade overflow into peri-urban kanmoi.",
          ta: "கணிசமான வைகை-படுகை மூழ்கல்; மேற்பகுதி கண்மாய் அடுக்கு வழிந்தோடி நகர்ப்புற கண்மாய்களில் சேர்ந்தது.",
        },
        source_url:
          "https://www.sciencedirect.com/science/article/abs/pii/S0045653521020439",
        source_label: "ScienceDirect (Vaigai flood-frequency analysis)",
      },
    ],
    external_sources: [
      {
        name: "CWC Flood Forecast Dashboard",
        url: "https://cwc.gov.in/ffm_dashboard",
        description: {
          en: "Central Water Commission dam-gauge readings including Vaigai (Andipatti). Live during NE monsoon; the single best public flood signal.",
          ta: "வைகை (ஆண்டிபட்டி) உட்பட மத்திய நீர் ஆணையத்தின் அணை-மானி வாசிப்புகள். வடகிழக்கு பருவமழையின் போது நேரடி; சிறந்த ஒரே பொது வெள்ள சமிக்ஞை.",
        },
        cadence: "live",
      },
      // Removed 2026-05-08: three external sources whose URLs broke
      // or pointed at the wrong host. We chose to drop rather than
      // replace because we couldn't verify alternatives at audit time.
      // Re-add with verified URLs when:
      //   - TNSDMA hazard map: previously at tnsdma.tn.gov.in/app/webroot/tnsdma_map/
      //   - Madurai LPA Master Plan 2024-2044: previously a PDF at madurailpa.com
      //   - Tamil Nadu CWC / WRD basin portal: previously misrouted to ffs.tamcnhp.com
      {
        name: "Smart City Madurai ICCC",
        url: "https://iccc.smartcities.gov.in/icc/city-details/c44058eab38fd0805b98b267e8f831a5",
        description: {
          en: "Integrated Command Control Centre - city water-supply monitoring. Public flood EWS not exposed.",
          ta: "ஒருங்கிணைந்த கட்டளை மற்றும் கட்டுப்பாட்டு மையம் - நகர நீர் வழங்கல் கண்காணிப்பு. பொது வெள்ள முன்னெச்சரிக்கை அமைப்பு வெளிப்படுத்தப்படவில்லை.",
        },
        cadence: "internal-only",
      },
    ],
    data_gaps: [
      {
        en: "No CFM-DSS-equivalent sensor mesh (Chennai has ARG/AWS/AWLR/gate sensor network; Madurai does not)",
        ta: "CFM-DSS போன்ற சென்சார் வலையமைப்பு இல்லை (சென்னையில் ARG/AWS/AWLR/கதவு சென்சார் வலையமைப்பு உள்ளது; மதுரையில் இல்லை)",
      },
      {
        en: "No public flood hazard zone GeoJSON (5/10/25/50/100/200-year return period polygons)",
        ta: "பொது வெள்ள ஆபத்து மண்டல GeoJSON இல்லை (5/10/25/50/100/200 ஆண்டு திரும்பும் காலகட்ட பலகோணங்கள்)",
      },
      {
        en: "No public 2018/2023 hotspot inventory (RTI-needed from MMC)",
        ta: "பொது 2018/2023 அதிக ஆபத்து இடப்பட்டியல் இல்லை (MMC-யிடமிருந்து RTI தேவை)",
      },
      {
        en: "Flood inundation depth raster - not modeled publicly for Madurai",
        ta: "வெள்ள மூழ்கல் ஆழம் ராஸ்டர் - மதுரைக்கு பொதுவில் மாதிரியாக்கப்படவில்லை",
      },
    ],
  },
  // Delhi: barrage-release + embankment-gap driven, like Madurai's shape
  // (release threshold + lag), unlike Chennai's modeled-hazard-zone shape.
  // English-only for now; hi strings land with the translation pass and
  // fall back to en until then. Sources verified live 2026-07-20 (Delhi
  // audit refresh). The contested Sept-2025 Hathnikund peak figure
  // (3,29,313 vs 29,313 cusecs across sources) is deliberately not stated.
  delhi: {
    scope_label: { en: "Yamuna basin scope" },
    cross_links: {
      home_desc: { en: "Supply chain, allocation ledger and the CAG scoreboard" },
      rivers_label: { en: "Yamuna river system" },
      rivers_desc: { en: "5 channels in scope - the river, the Munak carrier and the great drains" },
      water_bodies_desc: { en: "893 census water bodies + the floodplain wetlands that buffer (or amplify) inundation" },
    },
    headline: {
      en: "Delhi's flood risk is barrage-release-driven with a 36-72 hour fuse: water released at Hathnikund (Haryana) takes two to three days to reach the Old Railway Bridge gauge, where 204.50 m means warning, 205.33 m danger, and 206.00 m evacuation. Only ~7% of the floodplain length is embanked, and the 2018 Drainage Master Plan that was meant to fix internal drainage remains largely on paper.",
    },
    dam_release_threshold_cusecs: 100000,
    dam_release_note: {
      en: "The first flood warning is issued when Hathnikund barrage discharge crosses ~1,00,000 cusecs (Flood Control Order 2026). The July 2023 record showed the thresholds can fail conservative: the river hit 208.66 m - 1.17 m above the 1978 record - at releases the CWC's own post-mortem called moderate, with the ITO barrage's jammed gates deepening the flooding in central Delhi.",
    },
    historical_events: [
      {
        year: 2025,
        trigger: {
          en: "September 2025 monsoon spell with very high Hathnikund discharge",
        },
        impact: {
          en: "A July-2023-like flood spell repeated within two years - evacuations along the floodplain and renewed questions about why 2023's lessons had not changed outcomes (SANDRP's analysis is the sharpest public account).",
        },
        source_url: "https://sandrp.in/2025/09/09/sept-2025-why-yamuna-repeated-july-2023-like-flood-spell-in-delhi/",
        source_label: "SANDRP - Sept 2025 repeat flood analysis",
      },
      {
        year: 2023,
        trigger: {
          en: "Record 153 mm July rainfall + sustained Hathnikund releases; ITO barrage gates 1, 2 and 5 jammed shut",
        },
        impact: {
          en: "Yamuna peaked at 208.66 m on 13 July - highest since records began in 1963, breaking 1978's 207.49 m. Ring Road, Civil Lines, ITO and Rajghat inundated; ~27,000 evacuated. CWC's case study is the official post-mortem.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC - Delhi Floods 2023 case study",
      },
      {
        year: 2013,
        trigger: {
          en: "Mid-June upper-basin downpour - an unusually early-season Hathnikund surge",
        },
        impact: {
          en: "207.32 m at the Old Railway Bridge - the highest level between 1978 and 2023 (the comparison every 2023 report reached for). Floodplain settlements evacuated; an early-monsoon warning the 2023 post-mortems would cite.",
        },
        source_url: "https://www.tribuneindia.com/news/delhi/yamuna-at-all-time-high-delhi-on-edge-as-low-lying-areas-flooded-525092",
        source_label: "The Tribune (2023 all-time-high report with historical levels)",
      },
      {
        year: 2010,
        trigger: {
          en: "Sustained September flows in a strong-monsoon year, weeks before the Commonwealth Games",
        },
        impact: {
          en: "Annual peak discharge ~3,466 cumecs at the Delhi Railway Bridge (the CWC's model-calibration flood). The river flooded the low floodplain beside the Games-readied embankments, putting the Games Village's floodplain siting into the national argument it has stayed in since.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (annual peak-discharge table; 2010 calibration event)",
      },
      {
        year: 1995,
        trigger: {
          en: "September peak releases from Tajewala (pre-Hathnikund barrage)",
        },
        impact: {
          en: "Annual peak discharge ~7,028 cumecs - the largest flow between 1978 and 2023 in the CWC's series. Trans-Yamuna colonies flooded; with 1988 it pushed the embankment-extension debate.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (annual peak-discharge table)",
      },
      {
        year: 1988,
        trigger: {
          en: "Late-September basin-wide rain - the sharpest late-80s surge",
        },
        impact: {
          en: "Annual peak discharge ~5,642 cumecs; large evacuations from the floodplain and trans-Yamuna. With 1995 it defines the high-flow band the river revisited for three decades before 2023 broke the level record outright.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (annual peak-discharge table)",
      },
      {
        year: 1978,
        trigger: {
          en: "Peak monsoon flows in the undammed upper Yamuna (pre-Tehri era)",
        },
        impact: {
          en: "The benchmark flood: 207.49 m at the Old Railway Bridge, a record that stood 45 years until 2023. Model city planning still references the 1978 flood line.",
        },
        source_url: "https://cwc.gov.in/sites/default/files/delhi-floods-2023-case-study.pdf",
        source_label: "CWC case study (historical benchmark section)",
      },
    ],
    external_sources: [
      {
        name: "CWC Flood Forecasting (Old Railway Bridge gauge)",
        url: "https://ffs.india-water.gov.in/",
        description: {
          en: "India's oldest flood-forecast station (operating since 1958). Live levels + forecasts during monsoon; the single best public flood signal for Delhi.",
        },
        cadence: "live (monsoon)",
      },
      {
        name: "DDMA - flood preparedness & alerts",
        url: "https://ddma.delhi.gov.in/ddma/floods",
        description: {
          en: "Delhi Disaster Management Authority's flood page: thresholds, helpline (1077), and seasonal orders. No machine-readable feed.",
        },
        cadence: "seasonal",
      },
      {
        name: "Delhi Drainage Master Plan (IIT Delhi, 2018)",
        url: "https://ifc.delhi.gov.in/sites/default/files/inline-files/main_report_dmp_version51.pdf",
        description: {
          en: "The 153-page plan for Delhi's 3,737 km of drains across 11 agencies - the reference document for internal (rainfall) flooding, still largely unimplemented.",
        },
        cadence: "one-shot (2018)",
      },
    ],
    data_gaps: [
      {
        en: "No public real-time Hathnikund release feed - the 36-72 h lead-time signal exists only in news reports and alerts (highest-leverage RTI target)",
      },
      {
        en: "No public flood model or inundation forecast for Delhi (no iFLOWS/CFM-DSS equivalent)",
      },
      {
        en: "No public hotspot inventory with geometry; NRSC's 2023 satellite inundation maps sit behind a NICNET-only portal",
      },
      {
        en: "The internal-drainage story (waterlogging) has no live data: 11 agencies, no unified drain-condition feed",
      },
    ],
  },
  // PUNE. The fourth narrative city, and the second whose flooding is drainage
  // driven rather than release driven - so like Hyderabad it renders neither a
  // dam_release_threshold_cusecs nor a primary_trigger. Pune HAS four dams
  // upstream and discharge from Khadakwasla is a real mechanism, but no public
  // release-to-inundation threshold exists for it, and inventing one would be
  // exactly the failure those optional fields were made to avoid.
  //
  // The route was OFF until this landed, on the recorded reason that Maharashtra
  // WRD publishes Pune's statutory flood lines only inside a statewide register
  // of SCANNED PDF SHEETS with no vector form, so the hazard layer does not exist. That reason was about the
  // wrong variant: the narrative stack needs no hazard polygons, and Pune holds
  // 1,014 km of nalla geometry that was rendering nowhere. The flood-line gap
  // stays, as a data gap on the page.
  pune: {
    scope_label: { en: "PMC nalla network + the Mula-Mutha" },
    cross_links: {
      home_desc: { en: "PMC's own water budget, and why the shortfall is smaller than the leak" },
      rivers_label: { en: "Mula-Mutha river system" },
      rivers_desc: { en: "Seven rivers and the canal, with CPCB's priority classes and the 2024 readings behind them" },
      water_bodies_desc: { en: "791 lakes, tanks and reservoirs, from OpenStreetMap because no authority publishes a register for this city" },
    },
    headline: {
      en: "Pune's flood risk is drainage-driven, and the city cannot see it happen. PMC's nalla network is 3,075 open storm-water channels carrying 1,014 km, and every flood in the record below came down one of them. What the city lacks is instruments and maps. Dattawadi, the ONLY telemetric gauge inside Pune city, has an 84-day recording hole running 29 May to 22 August 2024, so it did not capture the 25 July 2024 flood at all - a gauge at Nighoje outside the city did, peaking at 568.92 m against a 563.02 m median. And Maharashtra's water resources department publishes the city's statutory red and blue flood lines only as scanned map sheets inside a statewide register - organised by river, no vector file behind any of them - so the legal boundary of the floodplain cannot be drawn on any map, including this one.",
    },
    drainage_map: {
      heading: { en: "The nalla network, and the rivers it drains into" },
      note: {
        en: "PMC's own storm-water layer: 3,075 nalla segments totalling 1,014 km, plotted against the seven rivers and the canal they discharge into. Segment lengths here are computed from the geometry and agree with PMC's own length column to 0.4%, which is a check on the geometry rather than a restatement of it. TWO HONEST LIMITS ON THIS MAP. Not one of the 3,075 segments is named in the source, so Ambil Odha - the nalla the 2019 flash flood came down - cannot be picked out of it. And this is the OPEN drainage only: PMC publishes a further 141,341 buried pipe segments, left off deliberately because they are far too dense to draw and answer a maintenance question rather than a flooding one.",
      },
      zoom: 11,
      layers: [
        {
          url: "/geojson/pune-drainage.geojson",
          label: "Nalla network (3,075 segments, 1,014 km)",
          kind: "line",
          color: "#2563eb",
          nameProp: "nalla_id",
        },
        {
          url: "/geojson/pune-rivers.geojson",
          label: "Rivers and the Mutha Right Bank Canal",
          kind: "line",
          color: "#0891b2",
          nameProp: "name",
        },
      ],
    },
    // Dates and mechanisms only. No casualty or damage figures: Pune has no
    // per-event impact register, and the one number that circulates for 1961
    // is explicitly not an official count (see the gaps below, and
    // /pune/origins chapter 3).
    historical_events: [
      {
        year: 1961,
        trigger: {
          en: "The Panshet dam breached on the morning of 12 July while still under construction, sending its reservoir down the Ambi into the Mutha and through the city.",
        },
        impact: {
          en: "Contemporary accounts describe close to half the built city inundated. HOW MANY PEOPLE DIED IS NOT KNOWN, and that is the state's own position rather than a gap in our research: the Government of Maharashtra's current Pune District Disaster Management Plan records the disaster and states that no official casualty figure exists. A round number has circulated in retellings for sixty-five years and has never been anybody's official count.",
        },
        source_label: "Government of Maharashtra, Pune District Disaster Management Plan",
      },
      {
        year: 2019,
        trigger: {
          en: "A cloudburst over the Ambil Odha, a nalla running through the south of the city, on 25 September.",
        },
        impact: {
          en: "The flood came down the drain rather than the river, which is the mechanism this page exists to show. The Ambil Odha is in PMC's nalla layer above, but unnamed there like every other segment, so it cannot be highlighted.",
        },
      },
      {
        year: 2024,
        trigger: {
          en: "Heavy rainfall over the Khadakwasla catchment with discharge from the dam, on 25 July and again on 4 August.",
        },
        impact: {
          en: "The city's own instrumentation missed it. Dattawadi, the only gauge inside Pune city, was in an 84-day recording hole from 29 May to 22 August 2024 and captured nothing; Khadakwasla_1 had a 96-day hole over the same window. Nighoje on the Indrayani did record the event, peaking at 568.92 m on 25 July against a 563.02 m median.",
        },
        source_label: "India-WRIS / NWDP groundwater level telemetry, Maharashtra",
        source_url: "https://nwdp.nwic.gov.in/dataset/ground-water-level-telemetry-6-hourly-maharashtra",
      },
      {
        year: 2025,
        trigger: { en: "Intense rainfall on 21 August." },
        impact: {
          en: "The most recent event in the register. In June of the same year the Bombay High Court ordered Pune's flood lines redrawn, which is the process that would eventually produce the vector hazard layer this page cannot show.",
        },
      },
    ],
    external_sources: [
      {
        name: "Maharashtra WRD flood line maps",
        description: {
          en: "The statutory red (100-year) and blue (25-year) flood lines, published as one statewide register of scanned PDF map sheets (513 as of September 2026, all districts, organised by river) with Pune's sheets inside it. No vector form - see the data gaps below.",
        },
        url: "https://wrd.maharashtra.gov.in/Site/1315/Flood-Line-Maps",
        cadence: "irregular",
      },
      {
        name: "Maharashtra WRD Pravah dam-safety bulletin",
        description: {
          en: "Daily storage and discharge for the Khadakwasla chain. This is the feed behind the reservoir cards on the Pune dashboard, and discharge from Khadakwasla is the upstream half of the city's flood mechanism.",
        },
        url: "https://mwrdpravah.in/damsafety/control/pdfLatestReportEng",
        cadence: "daily",
      },
    ],
    data_gaps: [
      {
        en: "NO VECTOR FLOOD LINE, and this is the largest gap on the page. Maharashtra WRD publishes its statutory red and blue flood lines as one statewide register of scanned PDF map sheets - 513 sheets across all districts as of September 2026, organised by river, with Pune's Mula, Mutha, Pawna and Indrayani sheets inside it - and no shapefile, GeoJSON or KML anywhere; text extraction returns no characters at all from the Mutha sheets. So the legal floodplain boundary cannot be drawn, joined to a ward, or compared against what is built inside it. Digitising the raster sheets is a project rather than a fetch. Retire this gap when the redraw the Bombay High Court ordered in June 2025 produces a vector file.",
      },
      {
        en: "NO NAMED NALLAS. PMC's storm-water layer carries an id, an object id, a project phase and a length, and no name on any of its 3,075 segments. Ambil Odha, Nagzari and Bhairoba nalla are what the flood reporting is about, and none of them can be identified in the data.",
      },
      {
        en: "NO DRAINAGE DESIGN STANDARD. Kolkata publishes that its sewers were built to carry 6 mm of rain an hour, which makes measured rainfall directly comparable against the network and is what that city's hero is built on. No equivalent published figure has been found for Pune's nallas, so this page carries no capacity threshold.",
      },
      {
        en: "NO MODELLED INUNDATION. There is no Pune equivalent of Chennai's CFLOWS return-period zones or Mumbai's iFLOWS, so no hazard choropleth and no depth or return-period extents.",
      },
      {
        en: "NO PER-EVENT IMPACT REGISTER. The dates and mechanisms above are well attested; deaths, displacement and damage are not published per event in any source found. The event cards therefore carry no casualty or damage figures rather than repeating numbers from news retellings.",
      },
      {
        en: "THE CITY GAUGE IS UNRELIABLE. Beyond the 84-day 2024 hole at Dattawadi, Pimpale Gurav sits at exactly 555.16 m for ten consecutive days and then jumps 18 m. Pune district has 120 telemetric groundwater stations and exactly one inside the corporation, so there is almost no redundancy when one fails.",
      },
    ],
  },

  // SURAT. The one city on the platform whose publisher states an operational
  // threshold at every link of the chain - Ukai's full reservoir level, the
  // weir-cum-causeway's overflow level, and a danger level for each of five
  // khadis - and the one whose flood story is therefore ALREADY on the
  // dashboard, as the flood-headroom hero. Not repeated here.
  //
  // NO THRESHOLD CARD ON PURPOSE. primary_trigger and
  // dam_release_threshold_cusecs are both config numbers, and the hero's
  // honesty contract is that no threshold rendered anywhere for Surat is ours:
  // every one is read from surat-flood-chain.json at render, so config and
  // source cannot drift apart silently. Restating 6.00 m here would break
  // exactly that. The khadis are named below without their numbers.
  //
  // NO EVENT LIST. August 2006 is Surat's defining flood and every figure for
  // it currently traces to news coverage or advocacy reporting, so it is held
  // out under the defensible-numbers rule rather than printed. That is why the
  // events card is guarded on length in flood-risk-content.
  surat: {
    scope_label: { en: "Tapi basin + the Ukai release chain" },
    headline: {
      en: "Surat's flooding arrives from upstream. Rain lands on eight municipal zones, Ukai decides what passes downstream, the weir-cum-causeway inside the city is either under water or not, and five khadis - Kakara and Bhedwad in Udhana, Mithi and Bhatena in Limbayat, Simada in Varachha - carry it to the streets. The corporation publishes a live reading and its own trigger level at every one of those links, which is what the dashboard's headroom card is built on. This page carries the rest: where to watch during an event, and what is not published at all.",
    },
    historical_events: [],
    external_sources: [
      {
        name: "Surat Municipal Corporation - live rainfall, dam, weir and khadi levels",
        description: {
          en: "The operational feed. Five tables through the day in monsoon: Ukai's level and inflow/outflow, the weir-cum-causeway and whether the causeway is open, zone-wise rainfall across the eight zones, the season total, and each khadi against its published danger level. This is the source behind the headroom hero.",
        },
        url: "https://www.suratmunicipal.gov.in/Home/RainfallInfo",
        cadence: "Through the day in monsoon",
      },
      {
        name: "Narmada, Water Resources, Water Supply and Kalpsar Department, Government of Gujarat",
        description: {
          en: "Ukai is not the corporation's dam. SMC attributes its dam and weir rows to the Irrigation Department and the Collector's office, and the release decision that sets Surat's flood risk is taken at state level, in this department.",
        },
        url: "https://guj-nwrws.gujarat.gov.in/",
        cadence: "Departmental, no fixed cadence",
      },
      {
        name: "India Meteorological Department",
        description: {
          en: "Nowcasts and district rainfall warnings for Surat, upstream of anything SMC's own gauges record. The corporation reports rain that has already fallen on the city; a release decision at Ukai is made against rain that has fallen on the catchment.",
        },
        url: "https://mausam.imd.gov.in/",
        cadence: "Multiple times daily",
      },
      {
        name: "Central Water Commission - flood forecast",
        description: {
          en: "The national flood-forecast portal. Listed as the place to look rather than as a known feed: no level or inflow forecast station for the Tapi at Surat has been identified on it, which is itself recorded as a gap below.",
        },
        url: "https://ffs.india-water.gov.in/",
        cadence: "Daily in flood season",
      },
    ],
    data_gaps: [
      {
        en: "NO MODELLED INUNDATION. There is no Surat equivalent of Chennai's CFLOWS return-period zones or Mumbai's iFLOWS. No hazard choropleth, no depth extents, no return-period map, and no published waterlogging-spot register. This route therefore carries no map at all rather than an empty one.",
      },
      {
        en: "NO KHADI GEOMETRY. SMC publishes a danger level for each of the five monitored khadis and a live reading against it, and no centreline, no catchment and no cross-section for any of them. The numbers are precise and the creeks cannot be drawn.",
      },
      {
        en: "NO WARD GEOMETRY. Three competing ward schemes exist for Surat and none has downloadable boundaries: WFS is disabled on the corporation's own GIS server. Every ward-keyed surface on this platform is therefore off for Surat, not thinned.",
      },
      {
        en: "NO STORM-WATER NETWORK, NO DESIGN STANDARD. Neither the drainage geometry nor a published carrying capacity has been found. Kolkata publishes that its sewers were built for 6 mm of rain an hour, which is what makes measured rainfall comparable against a network; no equivalent figure is available here.",
      },
      {
        en: "THE LIVE FEED HAS NO ARCHIVE. SMC's page holds a rolling window of about ten readings, with no dated URL, no API and no download. Every day the scraper does not run is lost permanently, so the series on this platform starts the day it first ran and never implies a longer record than that.",
      },
      {
        en: "NO CWC FORECAST STATION IDENTIFIED for the Tapi at Surat. The release that drives the city's flooding is decided upstream at Ukai, and no public forecast of it - as opposed to a reading of what has already been released - has been found.",
      },
      {
        en: "AUGUST 2006 IS NOT PRIMARY-SOURCED. Surat's defining flood, and the obvious thing to render today's release against, is deliberately absent. Every figure for it currently traces to Wikipedia, news coverage or advocacy reports. It returns from the People's Committee on Gujarat Floods report or the Surat Citizens' Council Trust report, and not before.",
      },
    ],
    cross_links: {
      home_desc: {
        en: "The live chain link by link, and how much room is left at the tightest point on it",
      },
      rivers_label: { en: "Tapi and Mindhola" },
      rivers_desc: {
        en: "Six editions of CPCB monitoring across eight stations, and two CETPs against their own consent conditions",
      },
      water_bodies_desc: {
        en: "805 mapped bodies inside SMC limits from the SAC wetland atlas, and the naming gap that comes with them",
      },
    },
  },
};

export default async function CityFloodRiskPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Renderer is selected by declared variant, not city id (see
  // docs/specs/multi-city-component-discipline.md rule 3). Any city can
  // adopt any variant by setting `flood.variant` in its config.
  //
  //  - 'interactive': full interactive flood map (4 view modes -
  //    hazard/historical/drainage/sewerage, legend, detail panel, ward
  //    search, stats bar). City-agnostic; reads `<cityId>-flood-*`.
  //    The same content component also backs the flat /flood-risk route.
  //  - 'bangalore': distinct map-based page (KSRSAC hotspots + BBMP
  //    rajakaluve network) whose data shape differs from the interactive
  //    map (no single dam-release threshold; rainfall + drainage capacity
  //    is the driver).
  //  - 'narrative' / undefined: the Madurai-style narrative card stack
  //    (FLOOD_CONFIG_BY_CITY) or the not-yet-available placeholder.
  const variant = config.flood?.variant;

  if (variant === "interactive") {
    return <InteractiveFloodContent cityId={cityId} />;
  }

  if (variant === "bangalore") {
    return <FloodRiskBangaloreContent cityDisplayName={config.displayName} />;
  }

  // Mumbai's flooding is rainfall + high-tide + drainage driven (not a
  // dam-release threshold), with a distinct chronic-spot map - its own
  // component rather than the Madurai dam-release config shape.
  if (cityId === "mumbai") {
    return <FloodRiskMumbaiContent cityDisplayName={config.displayName} />;
  }

  const cfg = FLOOD_CONFIG_BY_CITY[cityId];
  if (!cfg) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Flood risk"
        scope="basin-system"
        routeKey="flood-risk"
        whatItShowsForChennai="modeled flood hazard zones (5/10/25/50/100/200-year), 2015 + 2020 hotspots, drainage + sewerage overlays"
        dataGapNote="No flood-config data for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/groundwater`, label: "Groundwater stress map" },
        ]}
      />
    );
  }

  return (
    <FloodRiskContent
      cityId={cityId}
      cityDisplayName={config.displayName}
      cfg={cfg}
    />
  );
}
