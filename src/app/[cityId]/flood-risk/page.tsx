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
  madurai: {
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
        parityVerdict="HARD"
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
