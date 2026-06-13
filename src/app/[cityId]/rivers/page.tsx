import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetPlaceConfig } from "@/lib/cities";
import { basinsForCity, type BasinInventory } from "@/lib/basins";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import RiversClient, { type RiverInfo } from "./rivers-client";

function loadBasinInventory(basinId: string): BasinInventory | null {
  const fp = path.join(process.cwd(), "public", "data", "basins", basinId, "inventory.json");
  try {
    return JSON.parse(fs.readFileSync(fp, "utf-8")) as BasinInventory;
  } catch {
    return null;
  }
}

interface PageProps {
  params: Promise<{ cityId: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Rivers | Neer Vazhvu" };
  return {
    title: `${config.displayName} Rivers | Neer Vazhvu`,
    description: `River-system map for ${config.displayName} - Vaigai mainstem, tributaries, and the cross-state Mullaperiyar feeder.`,
    alternates: { canonical: `/${cityId}/rivers` },
  };
}

// Per-city river narrative. Keyed by river_id from the geojson's properties.
// Madurai uses Vaigai-system scope (basin-wide) per
// project_madurai_scope_decision.md - Periyar (Kerala feeder) and the Vaigai
// downstream stretch through Sivagangai/Ramanathapuram are in scope.
const RIVER_INFO_BY_CITY: Record<string, Record<string, RiverInfo>> = {
  madurai: {
    vaigai: {
      display_name: "Vaigai",
      display_name_ta: "வைகை",
      length_km_geom: 304,
      description:
        "Madurai's mainstem river. Receives ~80% of its flow from the Mullaperiyar trans-basin tunnel; less than 20% comes from its own catchment in the Megamalai/Cumbum hills. Drains 7,009 sq km across Theni, Dindigul, Madurai, Sivagangai, Ramanathapuram before reaching the Bay of Bengal.",
      description_ta:
        "மதுரையின் முதன்மை ஆறு. ~80% பாய்ச்சல் முல்லைப் பெரியார் சுரங்கப்பாதை மூலம் வருகிறது; 20%-க்கும் குறைவாகவே மேகமலை/கம்பம் மலையில் உள்ள தனது சொந்த நீர்ப்பிடிப்பிலிருந்து. தேனி, திண்டுக்கல், மதுரை, சிவகங்கை, ராமநாதபுரம் வழியாக 7,009 சதுர கி.மீ. வடிகட்டி வங்காள விரிகுடாவில் கலக்கிறது.",
      upstream_terminus: "Periyar / Vaigai dam (Andipatti, Theni district)",
      upstream_terminus_ta: "பெரியார் / வைகை அணை (ஆண்டிபட்டி, தேனி மாவட்டம்)",
      downstream_terminus: "Bay of Bengal at Ramanathapuram (estuarine)",
      downstream_terminus_ta: "வங்காள விரிகுடா, ராமநாதபுரம் (கழிமுகம்)",
      feeds: "Madurai city water supply; downstream irrigation command",
      feeds_ta: "மதுரை நகர நீர் வழங்கல்; கீழ்ப்பகுதி நீர்ப்பாசனம்",
      status: "CPCB NWMP Priority III polluted stretch (Madurai-Manamadurai); textile-dyeing + sewage outfalls",
      status_ta: "CPCB NWMP முன்னுரிமை III மாசுபட்ட பகுதி (மதுரை-மானாமதுரை); ஜவுளி சாயமிடல் + கழிவுநீர் வெளியேற்றங்கள்",
      cpcb_nwmp_stations: [
        "Vaigai dam reservoir",
        "Sellur (Madurai upstream)",
        "Anuppanadi (Madurai downstream)",
        "Andipatti",
        "Manamadurai (Sivagangai)",
        "Ramanathapuram (estuarine)",
      ],
      cpcb_nwmp_stations_ta: [
        "வைகை அணை நீர்த்தேக்கம்",
        "செல்லூர் (மதுரை மேற்பகுதி)",
        "அனுப்பானடி (மதுரை கீழ்பகுதி)",
        "ஆண்டிபட்டி",
        "மானாமதுரை (சிவகங்கை)",
        "ராமநாதபுரம் (கழிமுகம்)",
      ],
      color: "stroke-blue-600",
    },
    periyar: {
      display_name: "Periyar (Kerala feeder)",
      display_name_ta: "பெரியார் (கேரளா ஊட்டி)",
      length_km_geom: 121,
      description:
        "Kerala-side river that feeds Vaigai through the 1886 Mullaperiyar tunnel. The 999-year lease deed makes Periyar a TN-operated source even though the reservoir sits in Kerala's Idukki district. ~80% of Vaigai's annual yield originates here.",
      description_ta:
        "1886 முல்லைப் பெரியார் சுரங்கப்பாதை வழியாக வைகையை ஊட்டும் கேரளப் பக்க ஆறு. 999-ஆண்டு குத்தகை உடன்பாடு பெரியாரை தமிழ்நாடு-இயக்கும் ஆதாரமாக ஆக்குகிறது, ஆனால் நீர்த்தேக்கம் கேரளாவின் இடுக்கி மாவட்டத்தில் உள்ளது. வைகையின் ஆண்டுப் பாய்ச்சலில் ~80% இங்கிருந்துதான் தோன்றுகிறது.",
      upstream_terminus: "Western Ghats (Idukki, Kerala)",
      upstream_terminus_ta: "மேற்குத் தொடர்ச்சி மலை (இடுக்கி, கேரளா)",
      downstream_terminus: "Mullaperiyar reservoir / Vaigai tunnel",
      downstream_terminus_ta: "முல்லைப் பெரியார் நீர்த்தேக்கம் / வைகை சுரங்கப்பாதை",
      feeds: "Vaigai dam via the Periyar tunnel diversion",
      feeds_ta: "பெரியார் சுரங்கப்பாதை திருப்பல் வழியாக வைகை அணை",
      status: "Politically charged - Kerala-TN dispute since 1979; SC 2014 caps storage at 142 ft",
      status_ta: "அரசியல் ரீதியாக சச்சரவு - 1979 முதல் கேரளா-தமிழ்நாடு தகராறு; உச்சநீதிமன்றம் 2014 சேமிப்பை 142 அடியாக கட்டுப்படுத்தியது",
      cpcb_nwmp_stations: [],
      color: "stroke-violet-600",
    },
    suruliyaru: {
      display_name: "Suruliyaru",
      display_name_ta: "சுருளியாறு",
      length_km_geom: 72,
      description:
        "Tributary of Vaigai joining from the south (Theni district hills). Carries Western Ghats runoff during the SW monsoon, contributing to Vaigai dam inflows.",
      description_ta:
        "தெற்கிலிருந்து வைகையில் சேரும் கிளை ஆறு (தேனி மாவட்ட மலைகள்). தென்மேற்கு பருவமழையில் மேற்குத் தொடர்ச்சி மலை ஓட்ட நீரை கொண்டு வந்து வைகை அணை உள்வரத்துக்கு பங்களிக்கிறது.",
      upstream_terminus: "Suruli falls / Cumbum valley (Theni)",
      upstream_terminus_ta: "சுருளி அருவி / கம்பம் பள்ளத்தாக்கு (தேனி)",
      downstream_terminus: "Joins Vaigai upstream of Vaigai dam",
      downstream_terminus_ta: "வைகை அணைக்கு மேற்பகுதியில் வைகையுடன் சேருகிறது",
      feeds: "Vaigai mainstem",
      feeds_ta: "வைகை முதன்மை ஆறு",
      status: "Less monitored; key SW-monsoon contributor",
      status_ta: "குறைவாகக் கண்காணிக்கப்படுகிறது; தென்மேற்கு பருவமழையில் முக்கிய பங்களிப்பாளர்",
      cpcb_nwmp_stations: [],
      color: "stroke-cyan-600",
    },
    manjalar: {
      display_name: "Manjalar",
      display_name_ta: "மஞ்சளாறு",
      length_km_geom: 27,
      description:
        "Short Vaigai-basin tributary with its own dam (Manjalar Dam, Theni district) used for irrigation. Tilapia fishery noted in the reservoir.",
      description_ta:
        "சொந்த அணையுடன் (மஞ்சளாறு அணை, தேனி மாவட்டம்) நீர்ப்பாசனத்திற்குப் பயன்படும் வைகை-பேசின் கிளை ஆறு. நீர்த்தேக்கத்தில் திலாப்பியா மீன் வளர்ப்பு குறிக்கப்பட்டுள்ளது.",
      upstream_terminus: "Theni hills",
      upstream_terminus_ta: "தேனி மலைகள்",
      downstream_terminus: "Joins Vaigai system via Manjalar Dam",
      downstream_terminus_ta: "மஞ்சளாறு அணை வழியாக வைகை அமைப்பில் சேருகிறது",
      feeds: "Manjalar Dam command area",
      feeds_ta: "மஞ்சளாறு அணை கட்டளைப் பகுதி",
      status: "Operational reservoir; minor monitoring",
      status_ta: "செயல்பாட்டில் உள்ள நீர்த்தேக்கம்; சிறிய கண்காணிப்பு",
      cpcb_nwmp_stations: [],
      color: "stroke-emerald-600",
    },
    varaha: {
      display_name: "Varaha (Varaha Nadhi)",
      display_name_ta: "வராகா (வராக நதி)",
      length_km_geom: 117,
      description:
        "Vaigai-basin tributary; dammed at Sothuparai (Periyakulam taluk, Theni). Sothuparai is NOT on the daily TN Agri ARS portal so live storage data is PWD-memo-only.",
      description_ta:
        "வைகை-பேசின் கிளை ஆறு; சோத்துப்பாறையில் (பெரியகுளம் தாலுகா, தேனி) அணை கட்டப்பட்டுள்ளது. சோத்துப்பாறை தினசரி TN Agri ARS போர்ட்டலில் இல்லை, எனவே நேரடி சேமிப்புத் தரவு PWD-நினைவுக்குறிப்பு மட்டுமே.",
      upstream_terminus: "Theni hills (Periyakulam side)",
      upstream_terminus_ta: "தேனி மலைகள் (பெரியகுளம் பக்கம்)",
      downstream_terminus: "Joins Vaigai system via Sothuparai dam",
      downstream_terminus_ta: "சோத்துப்பாறை அணை வழியாக வைகை அமைப்பில் சேருகிறது",
      feeds: "Sothuparai reservoir, downstream agriculture",
      feeds_ta: "சோத்துப்பாறை நீர்த்தேக்கம், கீழ்ப்பகுதி வேளாண்மை",
      status: "Operational; data gap on daily storage",
      status_ta: "செயல்பாட்டில்; தினசரி சேமிப்பில் தரவு இடைவெளி",
      cpcb_nwmp_stations: [],
      color: "stroke-amber-600",
    },
  },
  // Bengaluru is a ridge city across three drainage divides; its
  // "river system" is really three small rivers (Vrishabhavathi west,
  // Arkavati north-west, Dakshina Pinakini east) that the city's
  // sewerage discharges into rather than being fed by.
  bangalore: {
    vrishabhavathi: {
      display_name: "Vrishabhavathi",
      display_name_ta: "ವೃಷಭಾವತಿ ನದಿ",
      length_km_geom: 68,
      description:
        "The famous foam-and-fire river. Flows south-west out of central BBMP through the Vrishabhavathi Valley, picking up the untreated overflow from the V Valley STPs (180 + 150 MLD design) plus the Mailasandra catchment. Discharges into Byramangala reservoir (348 ha) before joining the Arkavati, then the Cauvery. The 2015 May Bellandur foam-fire event was downstream of the same sewerage system.",
      description_ta: "",
      upstream_terminus: "Central BBMP (Vrishabhavathi Valley)",
      upstream_terminus_ta: "",
      downstream_terminus: "Byramangala reservoir, then Arkavati / Cauvery",
      downstream_terminus_ta: "",
      feeds: "Byramangala reservoir; downstream Cauvery via Arkavati",
      feeds_ta: "",
      status: "KSPCB priority polluted stretch; V Valley STPs over capacity",
      status_ta: "",
      cpcb_nwmp_stations: [
        "Vrishabhavathi at Kengeri (upstream)",
        "Vrishabhavathi downstream of K&C Valley STP discharge",
      ],
      cpcb_nwmp_stations_ta: [],
      color: "stroke-amber-600",
    },
    arkavati: {
      display_name: "Arkavati",
      display_name_ta: "ಅರ್ಕಾವತಿ ನದಿ",
      length_km_geom: 102,
      description:
        "Cauvery tributary that gave Bengaluru its first piped water supplies - Hesaraghatta lake (1894, Chamarajendra Water Works) and Tippagondanahalli reservoir (1933, Chamaraja Sagara). Both impoundments are now defunct as freshwater sources due to upstream urbanisation. TG Halli is being repurposed as a 110 MLD indirect-potable-reuse pilot with SUEZ.",
      description_ta: "",
      upstream_terminus: "Nandi Hills / Doddaballapur (Chikballapur)",
      upstream_terminus_ta: "",
      downstream_terminus: "Joins Cauvery downstream of Kanakapura",
      downstream_terminus_ta: "",
      feeds: "Hesaraghatta + TG Halli reservoirs; downstream irrigation",
      feeds_ta: "",
      status: "Catchment built over; reservoirs effectively dead; TG Halli IPR pilot under SUEZ",
      status_ta: "",
      cpcb_nwmp_stations: [],
      cpcb_nwmp_stations_ta: [],
      color: "stroke-blue-600",
    },
    "dakshina-pinakini": {
      display_name: "Dakshina Pinakini",
      display_name_ta: "ದಕ್ಷಿಣ ಪಿನಾಕಿನಿ",
      length_km_geom: 99,
      description:
        "East-flowing river that originates in BBMP south and exits into Tamil Nadu, where it is called Ponnaiyar. Drains the Koramangala-Challaghatta valley downstream of Bellandur Lake. Carries the cumulative discharge of K&C Valley sewerage to the state border.",
      description_ta: "",
      upstream_terminus: "Chennasandra / Begur area, BBMP south",
      upstream_terminus_ta: "",
      downstream_terminus: "Tamil Nadu border (becomes Ponnaiyar)",
      downstream_terminus_ta: "",
      feeds: "Downstream irrigation in TN's Krishnagiri / Tiruvannamalai",
      feeds_ta: "",
      status: "Sewage-dominated downstream of Bellandur",
      status_ta: "",
      cpcb_nwmp_stations: [],
      cpcb_nwmp_stations_ta: [],
      color: "stroke-violet-600",
    },
  },
};

// Per-city map framing for the rivers page. Madurai needs the Vaigai
// system view; Bangalore needs the city-centred ridge view.
const RIVERS_SCOPE_LABEL: Record<string, string> = {
  madurai: "Vaigai system",
  bangalore: "Bengaluru ridge (3 drainage valleys)",
};

export default async function CityRiversPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  const riverInfo = RIVER_INFO_BY_CITY[cityId];
  if (!riverInfo) {
    return (
      <FeatureNotYetAvailable
        config={config}
        feature="Rivers"
        scope="basin-system"
        parityVerdict="EASY"
        whatItShowsForChennai="3 rivers (Cooum, Adyar, Kosasthalaiyar) with CPCB NWMP annual quality samples, sewage inlets, pollution overlays from industrial sources"
        dataGapNote="No curated river-info config for this city yet."
        relatedLinks={[
          { href: `/${cityId}`, label: `${config.displayName} home` },
          { href: `/${cityId}/water-bodies`, label: "Water bodies map" },
        ]}
      />
    );
  }

  // Madurai: nudge south-west to fit Vaigai mainstem from Theni dam through
  // Madurai to Manamadurai/Ramanathapuram. Bangalore: city centre is fine -
  // all three rivers (Vrishabhavathi west, Arkavati north-west, Dakshina
  // Pinakini east) fit at the same zoom.
  const mapCenter: [number, number] =
    cityId === "bangalore"
      ? [config.center.lat, config.center.lng]
      : [config.center.lat - 0.1, config.center.lng - 0.2];
  const mapZoom = cityId === "bangalore" ? 10 : 9;
  const scopeLabel = RIVERS_SCOPE_LABEL[cityId] ?? "Basin system";

  // Additive: if a river on this page has a deep basin atlas, hand it down so
  // clicking that river can open the layered basin view. The standard rivers
  // map is unchanged for everyone else.
  const basin = basinsForCity(cityId)[0] ?? null;
  const basinProp = basin
    ? { manifest: basin, inventory: loadBasinInventory(basin.basinId) }
    : null;

  return (
    <RiversClient
      cityId={cityId}
      cityDisplayName={config.displayName}
      mapCenter={mapCenter}
      mapZoom={mapZoom}
      scopeLabel={scopeLabel}
      riverInfo={riverInfo}
      basin={basinProp}
    />
  );
}
