import type { Metadata } from "next";
import { notFound } from "next/navigation";
import fs from "node:fs";
import path from "node:path";
import { tryGetPlaceConfig } from "@/lib/cities";
import { isFeatureSupportedForCity } from "@/lib/cities/routing";
import { basinsForCity, tryGetBasinManifest, type BasinInventory } from "@/lib/basins";
import { FeatureNotYetAvailable } from "@/components/layout/feature-not-yet-available";
import { riversVariant } from "@/lib/cities/data-paths";
import RiversClient, { type RiverInfo } from "./rivers-client";
import ChennaiRiversClient from "./chennai-rivers-client";

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

// Per-city SEO description - the fallback must stay city-neutral (the old
// Madurai-specific text leaked "Vaigai / Mullaperiyar" into every other
// city's search snippet).
const RIVERS_META_DESC: Record<string, string> = {
  chennai:
    "River-system map for Chennai - Adyar, Cooum and Kosasthalaiyar, with pollution status from official monitoring.",
  madurai:
    "River-system map for Madurai - Vaigai mainstem, tributaries, and the cross-state Mullaperiyar feeder.",
  bangalore:
    "River-system map for Bengaluru - Vrishabhavathi, Arkavathi and the Cauvery lifeline, with pollution status from official monitoring.",
  mumbai:
    "River-system map for Mumbai - Mithi, Dahisar, Poisar, Oshiwara and the regional Ulhas, with MPCB water-quality status.",
  kolkata:
    "River-system map for Kolkata - the Hooghly, the Adi Ganga through south Kolkata, the Bidyadhari and the Saraswati, with WBPCB tidal-paired water-quality status.",
  delhi:
    "River-system map for Delhi - the Yamuna's 22-km city stretch, the Munak carrier, the Najafgarh and Shahdara drains, with DPCC monthly water-quality status.",
};

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) return { title: "Rivers | Neer Vazhvu" };
  return {
    title: `${config.displayName} Rivers | Neer Vazhvu`,
    description:
      RIVERS_META_DESC[cityId] ??
      `River-system map for ${config.displayName} - mainstem rivers, tributaries, and pollution status from official monitoring.`,
    alternates: { canonical: `/${cityId}/rivers` },
  };
}

// Per-city river narrative. Keyed by river_id from the geojson's properties.
// Madurai uses Vaigai-system scope (basin-wide) per
// project_madurai_scope_decision.md - Periyar (Kerala feeder) and the Vaigai
// downstream stretch through Sivagangai/Ramanathapuram are in scope.
const RIVER_INFO_BY_CITY: Record<string, Record<string, RiverInfo>> = {
  surat: {
    tapi: {
      display_name: "Tapi",
      color: "stroke-blue-600",
      length_km_geom: 724,
      description:
        "Surat's only raw-water source and its principal flood risk, in the same channel. The city abstracts from a weir-cum-causeway pond at Singanpor; the water that fills it is released from Ukai dam about 100 km upstream, which the Gujarat Water Resources Department operates rather than the corporation. The Tapi is one of only three major peninsular rivers to flow west, and it reaches the Arabian Sea about 20 km past the city.",
      upstream_terminus: "Ukai dam (Tapi district), operated by the Gujarat Water Resources Department",
      downstream_terminus: "Arabian Sea at the Hazira estuary",
      feeds: "All nine SMC zones, via six water works",
      status:
        "The pollution story here is the opposite of the usual one. CPCB's 2022 monitoring finds BOD at or below detection limit at most Surat stations, so the Tapi is not organically polluted through the city. What climbs is conductivity: 369-513 umhos/cm at Ukai, 363-7,656 at Kathore, and 1,537-49,720 at the ONGC bridge at Hazira, which is seawater. Surat's river problem is salinity and the estuary, not sewage.",
      cpcb_nwmp_stations: [
        "Ukai, Sherula Bridge (upstream)",
        "Mandavi",
        "Near Bardoli, Kapp Bridge (Kakrapar)",
        "Kathore, NH-8 Bridge (upstream of Surat)",
        "Surat upstream of Kathore (Limdeshwar Mahadev)",
        "Rander Bridge, Surat",
        "ONGC Bridge, Hazira (estuary)",
      ],
    },
    mindhola: {
      display_name: "Mindhola",
      color: "stroke-orange-700",
      length_km_geom: 130,
      description:
        "The textile belt's river. It runs south of the city past the Sachin and Pandesara industrial estates, where several hundred dyeing and printing houses sit, and it carries what the common effluent treatment plants there discharge. Monitored by CPCB at the state highway bridge at Sachin.",
      upstream_terminus: "Western Ghats foothills, Tapi district",
      downstream_terminus: "Arabian Sea, south of the Tapi mouth",
      feeds: "No municipal abstraction; receives industrial and municipal discharge",
      status:
        "Monitored at one station only. GPCB and the Gujarat Environment Management Institute publish discharge-point monitoring for the Pandesara and Sachin CETPs separately; that series has not yet been ingested here.",
      cpcb_nwmp_stations: ["State Highway Bridge, Sachin"],
    },
  },
  // Kolkata's channels are TIDAL, which is why WBPCB samples each Adi Ganga
  // point separately at high and low tide - a distinction no other city on this
  // platform has. Station lists below are WBPCB EMIS stations, not CPCB NWMP.
  kolkata: {
    hooghly: {
      display_name: "Hooghly",
      display_name_bn: "\u09b9\u09c1\u0997\u09b2\u09bf",
      length_km_geom: 140,
      description:
        "The distributary of the Ganga that Kolkata was built on, and the source of essentially all its drinking water. KMC abstracts at Palta, about 22 km north in Barrackpore, and at Garden Reach downstream - run-of-river, with no impounded storage anywhere in the system. The river is tidal this far inland, so quality readings swing with the tide.",
      upstream_terminus: "Farakka Barrage feeder canal (via the Bhagirathi)",
      downstream_terminus: "Bay of Bengal, ~130 km downstream",
      feeds: "Palta (Indira Gandhi WTP), Garden Reach, Jorabagan, Watgunge; bulk sales to Bidhannagar and Budge Budge",
      status: "Comparatively healthy at the city's intakes - DO 5.6-6.3 mg/l, BOD ~2.1-2.2, faecal coliform 46,000-48,000 MPN/100ml (WBPCB, Jul 2026). The pollution story is not the mainstem, it is the Adi Ganga.",
      cpcb_nwmp_stations: ["Ganga at Palta (intake)", "Ganga at Dakshineswar", "Ganga at Garden Reach"],
      color: "stroke-blue-600",
    },
    "adi-ganga": {
      display_name: "Adi Ganga",
      display_name_bn: "\u0986\u09a6\u09bf \u0997\u0999\u09cd\u0997\u09be",
      length_km_geom: 39,
      description:
        "The original course of the Ganga, running through south Kolkata past Kalighat, now largely an engineered channel also known as Tolly's Nullah. WBPCB samples it at six points, each SEPARATELY at high tide and low tide - the only tidal station pairing on this platform, and the correct way to measure a channel that reverses twice a day.",
      upstream_terminus: "Hooghly offtake at Hastings",
      downstream_terminus: "Rejoins the tidal creek system towards the Sundarbans",
      feeds: "Nothing - it is a drainage and sewage channel, not a supply source",
      status:
        "Dead. Dissolved oxygen NIL at every monitored point in the latest round, faecal coliform 3.4 to 11 million MPN/100ml, water recorded by WBPCB's own observers as 'Blackish' and 'Pungent'. Low tide is consistently worse than high: at Bansdroni, BOD 14.53 against 10.75 and faecal coliform 8.4m against 4.9m on the same day.",
      cpcb_nwmp_stations: [
        "Bansdroni (high + low tide)",
        "Jirat Bridge (high + low tide)",
        "Kalighat (high + low tide)",
        "Karunamoyee (high + low tide)",
        "Kudghat (high + low tide)",
        "Sahid Kshudiram (high + low tide)",
      ],
      color: "stroke-red-600",
    },
    bidyadhari: {
      display_name: "Bidyadhari",
      display_name_bn: "\u09ac\u09bf\u09a6\u09cd\u09af\u09be\u09a7\u09b0\u09c0",
      length_km_geom: 38,
      description:
        "The channel that drains the East Kolkata Wetlands eastward towards the Sundarbans. It carried Kolkata's drainage until it silted up in the early twentieth century - the failure that created the wetland fishery system now treating 910 MLD of the city's sewage.",
      upstream_terminus: "East Kolkata Wetlands outfall",
      downstream_terminus: "Raimangal estuary / Sundarbans",
      feeds: "Wetland fisheries; no drinking-water abstraction",
      status: "No public WBPCB series at the city end; monitored upstream at Haroa Bridge in North 24 Parganas.",
      cpcb_nwmp_stations: ["U/S of Bidyadhari river at Haroa Bridge"],
      color: "stroke-amber-600",
    },
    saraswati: {
      display_name: "Saraswati",
      display_name_bn: "\u09b8\u09b0\u09b8\u09cd\u09ac\u09a4\u09c0",
      length_km_geom: 67,
      description:
        "A former principal channel of the Ganga west of the Hooghly, now a much-reduced watercourse through Howrah and Hooghly districts. Included as basin context: it is part of the deltaic braid the city sits in, not a Kolkata supply or drainage arm.",
      upstream_terminus: "Hooghly offtake near Tribeni",
      downstream_terminus: "Rejoins the Hooghly near Sankrail",
      feeds: "No Kolkata abstraction",
      status: "No dedicated WBPCB station on this reach; shown for basin context. The line renders in two pieces with a 10.6 km break: through that stretch OpenStreetMap maps the channel not as the Saraswati but as the 'Kana' (Bengali for blind or dead) and as unnamed 'khal' ditches. We do not join them, because that would assert an identity the map itself does not make - the break is where the river stopped being called a river.",
      cpcb_nwmp_stations: [],
      color: "stroke-slate-500",
    },
  },
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
        "The famous foam-and-fire river. Flows south-west out of central BBMP through the Vrishabhavathi Valley, picking up the untreated overflow from the V Valley STPs (180 + 150 MLD design) plus the Mailasandra catchment. Discharges into Byramangala reservoir (348 ha) before joining the Arkavathi, then the Cauvery. The 2015 May Bellandur foam-fire event was downstream of the same sewerage system.",
      description_ta: "",
      upstream_terminus: "Central BBMP (Vrishabhavathi Valley)",
      upstream_terminus_ta: "",
      downstream_terminus: "Byramangala reservoir, then Arkavathi / Cauvery",
      downstream_terminus_ta: "",
      feeds: "Byramangala reservoir; downstream Cauvery via Arkavathi",
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
      display_name: "Arkavathi",
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
  mumbai: {
    mithi: {
      display_name: "Mithi River",
      length_km_geom: 18,
      description:
        "Mumbai's principal river - rises from the Vihar and Powai lake overflows in the Sanjay Gandhi National Park and runs ~18 km south-west through Saki Naka, Kurla, Dharavi and Mahim to the Arabian Sea at Mahim Creek. Walled and channelised, it carries largely untreated sewage and industrial effluent, and it was the river that overflowed in the 26 July 2005 deluge.",
      upstream_terminus: "Vihar / Powai lake overflows (Sanjay Gandhi NP)",
      downstream_terminus: "Mahim Creek / Arabian Sea",
      feeds: "Mahim Creek estuary",
      status: "CPCB Priority-I polluted stretch; MRDPA jurisdiction; 2025 ED desilting probe",
      cpcb_nwmp_stations: [
        "Mithi at Powai (origin)",
        "Mithi at Kurla (CST Road bridge)",
        "Mithi at Mahim Creek (mouth)",
      ],
      color: "stroke-red-600",
    },
    dahisar: {
      display_name: "Dahisar River",
      length_km_geom: 12,
      description:
        "Rises from Tulsi Lake in the Sanjay Gandhi National Park and flows ~12 km west through Dahisar to the Gorai/Manori Creek and the Arabian Sea; reduced to a sewage-fed channel through built-up Dahisar.",
      upstream_terminus: "Tulsi Lake (Sanjay Gandhi NP)",
      downstream_terminus: "Gorai / Manori Creek",
      feeds: "Manori Creek",
      status: "CPCB Priority-I polluted stretch; BMC rejuvenation STPs under trial (2025)",
      cpcb_nwmp_stations: [],
      color: "stroke-amber-600",
    },
    poisar: {
      display_name: "Poisar River",
      length_km_geom: 7,
      description:
        "Originates in the Sanjay Gandhi National Park and runs ~7 km through Kandivali to the Marve Creek; largely a storm-water and sewage channel through built-up Kandivali.",
      upstream_terminus: "Sanjay Gandhi National Park",
      downstream_terminus: "Marve Creek",
      feeds: "Marve Creek",
      status: "CPCB Priority-I polluted stretch; BMC rejuvenation programme",
      cpcb_nwmp_stations: [],
      color: "stroke-violet-600",
    },
    oshiwara: {
      display_name: "Oshiwara River",
      length_km_geom: 7,
      description:
        "Rises near the Aarey Milk Colony and the Sanjay Gandhi National Park and flows ~7 km through Goregaon and Jogeshwari to the Malad Creek; heavily encroached and sewage-fed through its urban course.",
      upstream_terminus: "Aarey / Sanjay Gandhi National Park",
      downstream_terminus: "Malad Creek",
      feeds: "Malad Creek",
      status: "CPCB Priority-I polluted stretch; BMC rejuvenation programme",
      cpcb_nwmp_stations: [],
      color: "stroke-blue-600",
    },
  },
  // Delhi: Yamuna-basin scope. river_ids match delhi-rivers.geojson. The
  // "stations" listed are DPCC's monthly monitoring points (the highest-
  // cadence feed on the platform: public/data/dpcc-monthly-wq-delhi.json),
  // not CPCB NWMP - Delhi's own committee out-monitors the national
  // programme. NAMING DECISION (documented in data-sources.md): OSM maps
  // most of the Najafgarh drain's course as the Sahibi's engineered reach,
  // so the `sahibi` geometry carries the natural-river framing and the
  // `najafgarh` entry carries the drain story; the two entries cross-
  // reference each other rather than pretending to be separate waters.
  // Hyderabad. The page was stubbed for want of THIS block, not for want of
  // data: hyderabad-rivers.geojson has been in the repo since 26 Jul, and the
  // shared client treats river-quality / river-events / industrial-sources as
  // optional overlays ("404 is expected and silent"), which is how Delhi
  // renders with no industrial-sources file at all.
  //
  // length_km_geom values are COMPUTED from the in-repo OSM geometry
  // (public/geojson/hyderabad-rivers.geojson, fetch-rivers-osm-hyderabad.ts),
  // the same basis every other city uses - not quoted from a secondary source.
  hyderabad: {
    musi: {
      display_name: "Musi",
      display_name_te: "\u0c2e\u0c42\u0c38\u0c40 \u0c28\u0c26\u0c3f",
      length_km_geom: 244,
      description:
        "The river Hyderabad was founded on, dammed to survive, and then discharged into. Osman Sagar (begun 1913, completed 1918) impounds it upstream of the city, built as flood control first and water supply second after the Great Musi Flood of 28 September 1908 took roughly 59,000 houses and breached 221 of the 788 tanks strung along the river. Below the city the Musi carries the sewage load: the state's own interception programme covers a 34 km reach from Bapu Ghat to Gowrelly, and the Musi Riverfront Development programme covers 55 km from Gandipet to Gowrelly. The tank cascade the river once organised is still traceable - 428 tanks linked by 411 flow paths, chains running up to nine deep.",
      upstream_terminus: "Anantagiri hills, Vikarabad district; Osman Sagar impounds the upper reach",
      downstream_terminus: "Joins the Krishna downstream of the city, in Nalgonda district",
      feeds: "Osman Sagar (Gandipet) - one of six HMWSSB sources, ~4-7% of daily city draw",
      status:
        "CPCB Priority-I polluted stretch (Hyderabad to Nalgonda); DO at or below 0.5 mg/L through the city every year 2019-2024",
      cpcb_nwmp_stations: [
        "U/s of Musi at Gandipet, Osman Sagar (1172)",
        "River Musi at Nagole (2339)",
        "D/s of Musi at Pratapasingaram (1173)",
        "River Musi at Kasaniguda (3082)",
      ],
      color: "stroke-blue-600",
    },
    esi: {
      display_name: "Esi",
      display_name_te: "\u0c08\u0c38\u0c40 \u0c28\u0c26\u0c3f",
      length_km_geom: 10,
      description:
        "The Musi's tributary, and the reason Hyderabad has two protected catchments rather than one. Himayat Sagar was built on the Esi after Osman Sagar, completing the pair of impounding reservoirs M. Visvesvaraya proposed in 1909 to hold back 'all floods in excess of what the river channel could carry'. Only 10 km of its course falls inside the mapped extent here, which is why it reads as a short line rather than a river system.",
      upstream_terminus: "Rises west of the city; Himayat Sagar impounds it",
      downstream_terminus: "Joins the Musi below the twin reservoirs",
      feeds: "Himayat Sagar - one of six HMWSSB sources",
      status:
        "Catchment protected by GO 111 (1996), repealed 2022; the twins have been drawn on every day since 2020",
      cpcb_nwmp_stations: [],
      color: "stroke-cyan-600",
    },
    haldi: {
      display_name: "Haldi",
      length_km_geom: 57,
      description:
        "Mapped here because OpenStreetMap carries 57 km of it inside our extent, and a river drawn on the map with nothing behind it is worse than one that says so. We hold no monitoring, no narrative and no programme for the Haldi: it appears in no CPCB NWMP station list we have parsed, in no Telangana pollution-board return, and in none of the state's polluted-stretch classifications. The line is OSM geometry and nothing more.",
      upstream_terminus: "Not established from public sources",
      downstream_terminus: "Not established from public sources",
      feeds: "No HMWSSB source draws from it",
      status: "No monitoring data located; OSM geometry only",
      cpcb_nwmp_stations: [],
      color: "stroke-slate-400",
    },
    manjira: {
      display_name: "Manjira",
      display_name_te: "\u0c2e\u0c02\u0c1c\u0c40\u0c30\u0c3e \u0c28\u0c26\u0c3f",
      length_km_geom: 174,
      description:
        "Not a Hyderabad river but a Hyderabad supply line: a Godavari tributary carrying two of HMWSSB's six sources, the Manjira and Singur reservoirs, from well outside the city. It is the oldest of the long-distance transfers the city now runs on, and the reason the twin reservoirs stopped being the whole story long before GO 111 was repealed.",
      upstream_terminus: "Rises in the Western Ghats, Maharashtra; Singur reservoir on the middle reach",
      downstream_terminus: "Joins the Godavari",
      feeds: "Singur (29,917 mcft) and Manjira (1,500 mcft) - two of six HMWSSB sources",
      status:
        "CPCB Priority-II stretch (Gowdicherla to Nakkavagu); DO holds near 6 mg/L either side of the confluence",
      cpcb_nwmp_stations: [
        "U/s Manjeera at Gowdicharla, before Nakkavagu confluence (2374)",
        "D/s Manjeera at Gowdicherla, after Nakkavagu confluence (2375)",
      ],
      color: "stroke-emerald-600",
    },
  },
  delhi: {
    yamuna: {
      display_name: "Yamuna",
      display_name_hi: "यमुना नदी",
      length_km_geom: 499,
      description:
        "The one river of Delhi's water story. Enters NCT at Palla meeting bathing-class BOD limits, absorbs the city's drains across the 22-km Wazirabad-Okhla stretch, and exits at Asgarpur with BOD 15-30x the limit and dissolved oxygen at NIL - the 2% of the river's length that carries ~80% of its pollution load. The reach mapped here runs from the Hathnikund barrage (Haryana) to the Okhla exit, the same span the flood page's 36-72 hour lead time is measured over.",
      upstream_terminus: "Hathnikund barrage (Haryana); Delhi entry at Palla",
      downstream_terminus: "Okhla barrage -> Agra canal / downstream Yamuna",
      feeds: "Wazirabad pond (Wazirabad + Chandrawal WTPs); religious and floodplain use",
      status: "DPCC monthly: DO NIL at 5-6 of 8 stations; exit faecal coliform 124-160x max-permissible. HC denied Chhath rituals on the bank (Nov 2024)",
      cpcb_nwmp_stations: [
        "Palla (entry)",
        "Wazirabad",
        "ISBT Bridge",
        "ITO Bridge",
        "Nizamuddin Bridge",
        "Hindon Cut",
        "Okhla Barrage",
        "Asgarpur (exit)",
      ],
      color: "stroke-blue-600",
    },
    wyc_munak: {
      display_name: "Western Yamuna Canal / Munak carrier",
      display_name_hi: "पश्चिमी यमुना नहर (मुनक)",
      length_km_geom: 302,
      description:
        "Not a river but Delhi's lifeline: the WYC system diverts Yamuna water at Hathnikund into Haryana's canal network, and the 102-km Munak carrier (Carrier-Lined Channel + Delhi Sub-Branch) delivers ~70% of Delhi's raw water to the Haiderpur, Nangloi, Bawana, Dwarka and Okhla WTPs. Its flow is fixed on paper (~1,050 cusecs, 2018 Standing Committee) and unmeasured in public - carriage numbers surface only when a crisis reaches court, as in June 2024.",
      upstream_terminus: "Hathnikund barrage / Munak headworks (Haryana)",
      downstream_terminus: "Haiderpur (Delhi); branches to west-Delhi WTPs",
      feeds: "5 of Delhi's 9 WTPs (~70% of raw water)",
      status: "No public flow data - the biggest measurement gap in Delhi's supply (see Allocation Ledger)",
      cpcb_nwmp_stations: [],
      color: "stroke-cyan-600",
    },
    najafgarh: {
      display_name: "Najafgarh drain",
      display_name_hi: "नजफ़गढ़ नाला",
      length_km_geom: 57,
      description:
        "The largest single source of the Yamuna's pollution: a 57-km engineered channel carrying roughly two-thirds of Delhi's sewage from the Najafgarh Jheel outfall through west and north Delhi to the river above Wazirabad. It is also a river in disguise - this is the Sahibi's colonial-era drainage channel (see the Sahibi entry). Mission Sahibi (2026) is dredging ~9.1 million cubic metres of silt from its bed; 12 decentralised STPs (Rs 860 cr) are approved along its length.",
      upstream_terminus: "Najafgarh Jheel regulator (Delhi-Haryana border)",
      downstream_terminus: "Yamuna at Wazirabad (Supplementary drain junction)",
      feeds: "Nothing - it drains; with Shahdara it delivers 84% of Delhi's Yamuna load",
      status: "DPCC monthly (May 2026): BOD 64 mg/l vs 30 standard at outfall; subdrains (Mungeshpur, Bupania) run 135-140",
      cpcb_nwmp_stations: [
        "Najafgarh drain outfall",
        "Najafgarh Jheel upstream / downstream",
        "L1 / L2 / L3 subdrains",
        "Mungeshpur drain",
        "Bupania drain",
      ],
      color: "stroke-red-600",
    },
    sahibi: {
      display_name: "Sahibi (the buried river)",
      display_name_hi: "साहिबी नदी",
      length_km_geom: 52,
      description:
        "The river Delhi forgot it had. The Sahibi rises in Rajasthan's Aravallis, once terminated in the 226-sq-km Najafgarh Jheel, and its lower course was converted into the Najafgarh drain in the 1860s-1960s - which is why OSM maps this reach as 'Sahibi' while Delhi calls it a nala. The mapped geometry here is the surviving named reach; the jheel's 601-ha remnant is the largest water body in NCT.",
      upstream_terminus: "Aravalli hills (Rajasthan/Haryana)",
      downstream_terminus: "Najafgarh Jheel -> Najafgarh drain (engineered continuation)",
      feeds: "Najafgarh Jheel wetland (remnant)",
      status: "Functionally extinguished as a river in Delhi; survives as the drain's alignment and the jheel",
      cpcb_nwmp_stations: [],
      color: "stroke-amber-600",
    },
    hindon: {
      display_name: "Hindon (UP tributary)",
      display_name_hi: "हिंडन नदी",
      length_km_geom: 319,
      description:
        "The Yamuna's left-bank tributary through western UP (Saharanpur to Noida), joining below Delhi - and connected to the city by the engineered Hindon Cut, which routes Yamuna water across to the Hindon system. Its own pollution load (Ghaziabad/Noida industry and sewage) re-enters Delhi's reach via the confluence; DPCC monitors the UP outfall drains (Sahibabad, Banthala, Indrapuri) that ride this system into the Shahdara drain.",
      upstream_terminus: "Upper Shivalik foothills (Saharanpur, UP)",
      downstream_terminus: "Yamuna confluence below Okhla (Noida)",
      feeds: "Hindon Cut interlink; UP canal system",
      status: "Severely polluted through Ghaziabad/Noida; UP outfall drains into Delhi's Shahdara system run BOD 95-110 (DPCC May 2026)",
      cpcb_nwmp_stations: ["Hindon Cut (DPCC river station)", "Sahibabad drain", "Banthala drain", "Indrapuri drain"],
      color: "stroke-violet-600",
    },
  },
  // Pune. Every BOD figure below is CPCB's own, from the October 2025
  // "Polluted River Stretches for Restoration of Water Quality (Updated
  // Version)": the priority class from Table 3.17 (2022-23 monitoring) and
  // the 2024 readings from Annexure XIV of the same report. The two vintages
  // are labelled separately and never merged - see
  // public/data/river-quality-pune.json.
  //
  // THE FINDING IS THAT THE REPORT CONTRADICTS ITSELF. It records the Mula as
  // IMPROVED (Priority I to II) while its own annexure puts the Mula at
  // Bopodi at 102.5 mg/L in 2024 - the sixth-highest of 756 locations
  // nationally, above the worst Delhi Yamuna station (85.0) and above the
  // Mithi at Mahim (80.0).
  pune: {
    mutha: {
      display_name: "Mutha",
      display_name_mr: "\u092e\u0941\u0920\u093e",
      length_km_geom: 34.9,
      description:
        "Pune's own river, and the one the city drinks. It rises in the Western Ghats behind Temghar, is impounded four times over - Temghar, Warasgaon and Panshet all release into Khadakwasla - and enters the city below the dam. CPCB measured it at 4.1 mg/L of BOD at Khadakwasla in 2024 and at 50.2 mg/L at Veer Savarkar Bhavan, roughly fifteen kilometres downstream. The river does not arrive polluted.",
      upstream_terminus: "Western Ghats above Temghar dam",
      downstream_terminus: "Sangam, where it meets the Mula",
      feeds: "PMC's entire piped supply, via the Khadakwasla chain and the Mutha Right Bank Canal",
      status:
        "CPCB Priority II (2022-23 monitoring), improved from Priority I in 2018. Measured 2024: 4.1 mg/L at Khadakwasla dam, 32.5 at Deccan Bridge, 35.0 at Sangam, 50.2 at Veer Savarkar Bhavan.",
      cpcb_nwmp_stations: [
        "2680 Khadakwasla Dam (4.1 mg/L, 2024)",
        "2679 Deccan Bridge (32.5)",
        "2191 Sangam Bridge, Shivajinagar (35.0)",
        "2678 Veer Savarkar Bhavan (50.2)",
      ],
      color: "stroke-blue-600",
    },
    mula: {
      display_name: "Mula",
      display_name_mr: "\u092e\u0941\u0933\u093e",
      length_km_geom: 57.2,
      description:
        "Comes down from Mulshi, takes the Pavana at Bopodi, and meets the Mutha at the Sangam. At that confluence CPCB recorded 102.5 mg/L of BOD in 2024 - the sixth-highest reading among 756 locations in India, and higher than any Yamuna station CPCB publishes for Delhi. The same report classifies this stretch as improved.",
      upstream_terminus: "Mulshi dam (Tata hydro), Western Ghats",
      downstream_terminus: "Sangam, Pune",
      feeds: "Joins the Mutha to form the Mula-Mutha",
      status:
        "CPCB Priority II (2022-23), down from Priority I in 2018 - while the same report's 2024 annexure records 102.5 mg/L at Bopodi.",
      cpcb_nwmp_stations: [
        "2194 Harrison Bridge, Mula-Pawana Sangam, Bopodi (102.5 mg/L, 2024)",
        "2193 Aundh Bridge (25.6)",
      ],
      color: "stroke-red-600",
    },
    "mula-mutha": {
      display_name: "Mula-Mutha",
      display_name_mr: "\u092e\u0941\u0933\u093e-\u092e\u0941\u0920\u093e",
      length_km_geom: 36.0,
      description:
        "The combined river below the Sangam, and the one the JICA pollution-abatement programme is named for. PMC generates 980 MLD of sewage against 477 MLD of operating treatment capacity, so roughly 503 MLD - about half the city's sewage - reaches this channel untreated. The eleven plants of the JICA programme would add 396 MLD.",
      upstream_terminus: "Sangam, Pune",
      downstream_terminus: "Bhima confluence near Ranjangaon",
      feeds: "The Bhima, and through it the Krishna",
      status:
        "CPCB Priority II, unchanged since 2018. Measured 2024: 22.0 mg/L at Mundhawa Bridge, 18.4 downstream of Theur.",
      cpcb_nwmp_stations: [
        "2192 Mundhawa Bridge (22.0 mg/L, 2024)",
        "2677 Downstream of Theur (18.4)",
      ],
      color: "stroke-orange-600",
    },
    pavana: {
      display_name: "Pavana",
      display_name_mr: "\u092a\u0935\u0928\u093e",
      length_km_geom: 58.1,
      description:
        "Pimpri-Chinchwad's river and its water supply in one channel. PCMC lifts its raw water from the Ravet intake near the top of this reach and receives the industrial belt's effluent along the rest of it. CPCB's 2024 readings climb steadily downstream: 7.4 mg/L at Ravet weir, 36.0 at Kasarwadi.",
      upstream_terminus: "Pavana dam, Maval",
      downstream_terminus: "Mula confluence at Bopodi/Dapodi",
      feeds: "PCMC's Nigdi Sector 23 treatment plants; then the Mula",
      status:
        "CPCB Priority II, unchanged since 2018. Measured 2024: 7.4 at Ravet Weir, 17.6 Chinchwadgaon, 28.3 Pimprigaon, 30.0 Sangavigaon, 33.0 Dapodi Bridge, 36.0 Kasarwadi.",
      cpcb_nwmp_stations: [
        "2692 Ravet Weir (7.4 mg/L, 2024)",
        "2693 Chinchwadgaon (17.6)",
        "2694 Pimprigaon (28.3)",
        "2196 Sangavigaon (30.0)",
        "2691 Dapodi Bridge (33.0)",
        "2690 Kasarwadi (36.0)",
      ],
      color: "stroke-amber-600",
    },
    indrayani: {
      display_name: "Indrayani",
      display_name_mr: "\u0907\u0902\u0926\u094d\u0930\u093e\u092f\u0923\u0940",
      length_km_geom: 61.4,
      description:
        "The pilgrimage river, past Dehu and Alandi, and the one that periodically runs under a metre of white foam at the Alandi ghats. MPCB attributes the foaming to detergent; PCMC attributes it to the Chakan, Dehu and Talegaon industrial estates. No surfactant measurement has been published either way, which is why this page states the dispute rather than settling it.",
      upstream_terminus: "Kurvande, Western Ghats near Lonavala",
      downstream_terminus: "Bhima confluence at Tulapur",
      feeds: "The Bhima",
      status:
        "CPCB Priority III, improved from Priority II in 2018. Measured 2024: 13.2 mg/L above and below Moshi, 16.1 at Alandigaon.",
      cpcb_nwmp_stations: [
        "2669 Upstream Moshigaon (13.2 mg/L, 2024)",
        "2668 Downstream Moshi (13.2)",
        "2197 Alandigaon (16.1)",
      ],
      color: "stroke-emerald-600",
    },
    bhima: {
      display_name: "Bhima",
      display_name_mr: "\u092d\u0940\u092e\u093e",
      length_km_geom: 73.6,
      description:
        "The river everything above eventually drains into, and a Krishna tributary. CPCB files two Pune city stations under the Bhima, and its own label for the first reads \u201cRiver Bhima at Pune (Mutha River)\u201d - the board flagging that the water at Vithalwadi is the Mutha before it is anything else.",
      upstream_terminus: "Bhimashankar, Western Ghats",
      downstream_terminus: "Ujjani reservoir and on to the Krishna",
      feeds: "The Krishna, via Ujjani",
      status:
        "CPCB Priority II in 2025, having been Priority I in 2022. Measured 2024: 32.0 mg/L upstream Vithalwadi, 34.0 downstream Bundgarden.",
      cpcb_nwmp_stations: [
        "1189 Upstream Vithalwadi, Shankar Mandir (32.0 mg/L, 2024)",
        "1190 Downstream Bundgarden, Yerwada (34.0)",
      ],
      color: "stroke-slate-600",
    },
    ramnadi: {
      display_name: "Ramnadi",
      display_name_mr: "\u0930\u093e\u092e\u0928\u0926\u0940",
      length_km_geom: 15.2,
      description:
        "A 15-km urban stream through Bavdhan, Pashan and Aundh into the Mula. It carries no CPCB station, so it has no published water quality at all - but it is one of the few Pune streams with its own sanctioned Maharashtra WRD flood-line map, which makes it a rare case of a small urban nala being formally mapped.",
      upstream_terminus: "Bhugaon hills, west of the city",
      downstream_terminus: "Mula confluence near Baner",
      feeds: "The Mula",
      status:
        "No CPCB NWMP station and no published water-quality series. Carried here because it is mapped: WRD publishes a sanctioned flood-line sheet for it (Haveli, chainage 0 to 13,600 m).",
      cpcb_nwmp_stations: [],
      color: "stroke-teal-600",
    },
    "mutha-canal": {
      display_name: "Mutha Right Bank Canal",
      display_name_mr: "\u092e\u0941\u0920\u093e \u0909\u091c\u0935\u093e \u0915\u093e\u0932\u0935\u093e",
      length_km_geom: 45.6,
      description:
        "Not a river. This is the irrigation canal that carries Khadakwasla water east to Daund and Indapur, and it is the other claimant in Pune's entitlement dispute: the Khadakwasla Complex is an irrigation project, 22.55 TMC of its 33.77 TMC of use is the irrigation provision, and MWRRA found in 2018 that the farmers on it \u201care deprived of their share\u201d. It is drawn because Pune's water argument is unreadable without it.",
      upstream_terminus: "Khadakwasla dam",
      downstream_terminus: "The Daund and Indapur command",
      feeds: "About 77,000 ha of planned irrigation command",
      status:
        "Infrastructure, not a monitored water body. No CPCB station applies.",
      cpcb_nwmp_stations: [],
      color: "stroke-yellow-700",
    },
  },
};

// Per-city header framing for the rivers page. Madurai needs the Vaigai
// system view; Bengaluru's framing follows Paani Earth's Phase-1 review:
// river-system language, no station/source tally, atlas CTA phrased as the
// state of the river systems (docs/specs/arkavathi-phase2-feedback.md A1-A2).
const RIVERS_HEADER_BY_CITY: Record<
  string,
  { scopeLabel: string; showStats?: boolean; atlasCtaLabel?: string; overviewBasinId?: string }
> = {
  surat: { scopeLabel: "Lower Tapi and the Mindhola" },
  madurai: { scopeLabel: "Vaigai system" },
  bangalore: {
    scopeLabel: "Two river systems (Arkavathi and Dakshina Pinakini)",
    showStats: false,
    atlasCtaLabel: "State of Bengaluru's River Systems",
    // The basin ABOVE this city's rivers: a header entry point into the
    // Cauvery (Karnataka) overview, whose Arkavati cell drills back down
    // into the deep dive (docs/specs/cauvery-basin-hierarchy.md §2).
    overviewBasinId: "cauvery-ka",
  },
  mumbai: { scopeLabel: "MMR rivers (urban + eastern Ulhas corridor + source rivers)" },
  // Basin-scoped per the Delhi audit: the reach runs Hathnikund -> Palla ->
  // the 22-km city stretch -> Okhla exit, plus the engineered channels
  // (Munak carrier in, Najafgarh/Shahdara drains out).
  delhi: { scopeLabel: "Yamuna basin scope (Hathnikund to Okhla, with carriers and drains)" },
  // Five rivers plus the canal that is the other claimant on the same water.
  pune: { scopeLabel: "Mula-Mutha system, with the Pavana, Indrayani and the Khadakwasla canal" },
};

export default async function CityRiversPage({ params }: PageProps) {
  const { cityId } = await params;
  const config = tryGetPlaceConfig(cityId);
  if (!config) notFound();

  // Cities whose FEATURE_AVAILABILITY set omits "rivers" 404 here, the same
  // gate my-ward uses. Without it this page fell through to the generic
  // not-yet-available state, which tells the reader the page "hasn't shipped
  // yet" and lists what is needed to ship it - true for a city awaiting a
  // data layer, FALSE for one that has no river at all. Gurugram is the
  // first: its NWMP stations are all lakes and borewells, and its surface
  // water leaves as drain flow into the Najafgarh jheel. Promising a page
  // that can never exist is the same defect as Delhi's storage chart
  // promising to "fill in automatically" for a city that impounds nothing.
  if (!isFeatureSupportedForCity("/rivers", cityId)) notFound();

  // Renderer is selected by declared data-layout variant, not a city-id
  // branch in render code (see multi-city-component-discipline.md rule 3).
  // Chennai's legacy combined-rivers data layout (CPCB stations + industrial
  // pollution + Cooum sewage inlets + ward search) maps to the richer
  // ChennaiRiversClient; every other city uses the shared RiversClient.
  if (riversVariant(cityId) === "chennai-combined") {
    // Chennai's combined map self-fits to its rivers; centre on the city.
    // Hand down the basin (if any) so the treatment-&-waste gaps atlas can be
    // opened from this richer surface too - same additive wiring as the shared
    // client below, threaded into the Chennai-specific variant.
    const chennaiBasin = basinsForCity(cityId)[0] ?? null;
    return (
      <ChennaiRiversClient
        cityId={cityId}
        cityDisplayName={config.displayName}
        mapCenter={[config.center.lat, config.center.lng]}
        mapZoom={11}
        basin={
          chennaiBasin
            ? { manifest: chennaiBasin, inventory: loadBasinInventory(chennaiBasin.basinId) }
            : null
        }
      />
    );
  }

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
      : cityId === "mumbai"
        ? // MMR spread: BMC rivers in the SW, the Ulhas corridor in the east,
          // and the source rivers (Vaitarna/Bhatsa/Tansa) in the NE.
          [19.35, 73.15]
        : [config.center.lat - 0.1, config.center.lng - 0.2];
  // Bangalore: zoom 11 frames the GBA bbox (~38x41 km) tightly; zoom 10 read as
  // too wide. Others keep 9 (Vaigai/Pinakini mainstems + the MMR spread need
  // the wider frame).
  const mapZoom = cityId === "bangalore" ? 11 : 9;
  const header = RIVERS_HEADER_BY_CITY[cityId] ?? { scopeLabel: "Basin system" };

  // Additive: if a river on this page has a deep basin atlas, hand it down so
  // clicking that river can open the layered basin view. The standard rivers
  // map is unchanged for everyone else.
  const basin = basinsForCity(cityId)[0] ?? null;
  const basinProp = basin
    ? { manifest: basin, inventory: loadBasinInventory(basin.basinId) }
    : null;
  // Optional parent-basin overview entry (e.g. Bengaluru -> Cauvery KA).
  const overviewManifest = header.overviewBasinId ? tryGetBasinManifest(header.overviewBasinId) : null;
  const overviewBasinProp = overviewManifest
    ? { manifest: overviewManifest, inventory: loadBasinInventory(overviewManifest.basinId) }
    : null;

  return (
    <RiversClient
      hasTreatmentDischarge={config.hasTreatmentDischarge ?? false}
      cityId={cityId}
      cityDisplayName={config.displayName}
      mapCenter={mapCenter}
      mapZoom={mapZoom}
      scopeLabel={header.scopeLabel}
      showHeaderStats={header.showStats ?? true}
      atlasCtaLabel={header.atlasCtaLabel}
      riverInfo={riverInfo}
      basin={basinProp}
      overviewBasin={overviewBasinProp}
    />
  );
}
