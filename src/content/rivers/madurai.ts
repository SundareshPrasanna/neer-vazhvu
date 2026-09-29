import type { CityRiversContent } from "./types";

export const RIVERS: CityRiversContent = {
  metaDescription:
    "River-system map for Madurai - Vaigai mainstem, tributaries, and the cross-state Mullaperiyar feeder.",
  header: { scopeLabel: "Vaigai system" },
  riverInfo: {
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
      color: "#2563eb",
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
      color: "#7c3aed",
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
      color: "#0891b2",
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
      color: "#059669",
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
      color: "#d97706",
    },
  },
};
