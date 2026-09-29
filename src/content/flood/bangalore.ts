import type { CityFloodContent } from "./types";

/** The page's copy, translated (en/ta/kn). */
const T = {
  scope_label: { en: "{city} - Flood risk", ta: "{city} - வெள்ள ஆபத்து", kn: "{city} - ಪ್ರವಾಹ ಅಪಾಯ" },
  summary_counts: { en: "399 hotspots - 163 primary drains - 870 secondary drains - KSRSAC via OpenCity (Nov 2025)", ta: "399 ஹாட்ஸ்பாட்கள் - 163 முதன்மை சாலைகள் - 870 இரண்டாம்நிலை சாலைகள் - OpenCity வழியாக KSRSAC (நவ 2025)", kn: "399 ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು - 163 ಪ್ರಾಥಮಿಕ ಚರಂಡಿಗಳು - 870 ದ್ವಿತೀಯ ಚರಂಡಿಗಳು - OpenCity ಮೂಲಕ KSRSAC (ನವ 2025)" },
  layers: { en: "Layers", ta: "அடுக்குகள்", kn: "ಲೇಯರ್‌ಗಳು" },
  primary_drains: { en: "Primary drains (163)", ta: "முதன்மை சாலைகள் (163)", kn: "ಪ್ರಾಥಮಿಕ ಚರಂಡಿಗಳು (163)" },
  secondary_drains: { en: "Secondary drains (870)", ta: "இரண்டாம்நிலை சாலைகள் (870)", kn: "ದ್ವಿತೀಯ ಚರಂಡಿಗಳು (870)" },
  named_prone: { en: "Named flood-prone (70)", ta: "பெயரிடப்பட்ட வெள்ள-ஆபத்து (70)", kn: "ಹೆಸರಿಸಲಾದ ಪ್ರವಾಹ-ಪೀಡಿತ (70)" },
  named_low_lying: { en: "Named low-lying (129)", ta: "பெயரிடப்பட்ட தாழ்வான (129)", kn: "ಹೆಸರಿಸಲಾದ ತಗ್ಗು-ಪ್ರದೇಶ (129)" },
  vulnerable: { en: "Vulnerable (200, unnamed)", ta: "பாதிக்கப்படக்கூடியவை (200, பெயரிடப்படாத)", kn: "ದುರ್ಬಲ (200, ಹೆಸರಿಲ್ಲದ)" },
  heading: { en: "{city}'s flood risk", ta: "{city}-வின் வெள்ள ஆபத்து", kn: "{city} ನ ಪ್ರವಾಹ ಅಪಾಯ" },
  intro: { en: "Bengaluru sits on a ridge that drains into three valleys - Vrishabhavathi (west), Koramangala-Challaghatta (south-east), and Hebbal-Nagavara (north). When monsoon rainfall exceeds the storm-drain network's capacity, water backs up at the named hotspots on this map. The 2022 monsoon submerged Whitefield / Manyata Tech Park / Outer Ring Road East for days; the 2024 events extended into Yelahanka and Bommanahalli.", ta: "பெங்களூரு மூன்று பள்ளத்தாக்குகளில் வடியும் ஒரு மலையில் உள்ளது - விருஷபாவதி (மேற்கு), கோரமங்கலா-சல்லகட்டா (தென்கிழக்கு), மற்றும் ஹெப்பல்-நாகவாரா (வடக்கு). பருவமழை சாலை வலையமைப்பின் திறனைத் தாண்டும்போது, வரைபடத்தில் பெயரிடப்பட்ட ஹாட்ஸ்பாட்களில் தண்ணீர் தேங்குகிறது.", kn: "ಬೆಂಗಳೂರು ಮೂರು ಕಣಿವೆಗಳಿಗೆ ಹರಿಯುವ ಬೆಟ್ಟದ ಮೇಲೆ ಕುಳಿತಿದೆ - ವೃಷಭಾವತಿ (ಪಶ್ಚಿಮ), ಕೋರಮಂಗಲ-ಚಲ್ಲಘಟ್ಟ (ಆಗ್ನೇಯ), ಮತ್ತು ಹೆಬ್ಬಾಳ-ನಾಗವಾರ (ಉತ್ತರ). ಮುಂಗಾರು ಮಳೆ ಚರಂಡಿ ಜಾಲದ ಸಾಮರ್ಥ್ಯ ಮೀರಿದಾಗ, ಈ ನಕ್ಷೆಯಲ್ಲಿ ಹೆಸರಿಸಲಾದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳಲ್ಲಿ ನೀರು ಸಂಗ್ರಹವಾಗುತ್ತದೆ. 2022 ರ ಮುಂಗಾರು ವೈಟ್‌ಫೀಲ್ಡ್ / ಮನ್ಯಾತಾ ಟೆಕ್ ಪಾರ್ಕ್ / ಔಟರ್ ರಿಂಗ್ ರೋಡ್ ಪೂರ್ವವನ್ನು ದಿನಗಳವರೆಗೆ ಮುಳುಗಿಸಿತು; 2024 ರ ಘಟನೆಗಳು ಯಲಹಂಕ ಮತ್ತು ಬೊಮ್ಮನಹಳ್ಳಿಗೆ ವಿಸ್ತರಿಸಿದವು." },
  what_shows: { en: "What this map shows", ta: "இந்த வரைபடம் காட்டுவது", kn: "ಈ ನಕ್ಷೆ ತೋರಿಸುವುದು" },
  bullet_primary: { en: "163 primary stormwater drains (rajakaluves) - the main BBMP-wide drainage spine, NGT-protected with a 50 m buffer order.", ta: "163 முதன்மை மழைநீர் சாலைகள் (ராஜகலுவைகள்) - BBMP-விரிவான முதன்மை வடிகால் முதுகெலும்பு, 50 மீ தாங்கல் உத்தரவுடன் NGT-பாதுகாக்கப்பட்டது.", kn: "163 ಪ್ರಾಥಮಿಕ ಮಳೆನೀರು ಚರಂಡಿಗಳು (ರಾಜಕಲುವೆಗಳು) - BBMP-ವ್ಯಾಪ್ತಿಯ ಮುಖ್ಯ ಒಳಚರಂಡಿ ಬೆನ್ನೆಲುಬು, 50 ಮೀ ಬಫರ್ ಆದೇಶದೊಂದಿಗೆ NGT-ರಕ್ಷಿತ." },
  bullet_secondary: { en: "870 secondary drains - feeder network connecting wards to the rajakaluves.", ta: "870 இரண்டாம்நிலை சாலைகள் - வார்டுகளை ராஜகலுவைகளுக்கு இணைக்கும் ஊட்டு வலையமைப்பு.", kn: "870 ದ್ವಿತೀಯ ಚರಂಡಿಗಳು - ವಾರ್ಡ್‌ಗಳನ್ನು ರಾಜಕಲುವೆಗಳಿಗೆ ಸಂಪರ್ಕಿಸುವ ಪೂರಕ ಜಾಲ." },
  bullet_named_prone: { en: "70 named flood-prone localities - BBMP's curated list of named hotspots with documented flooding history (e.g. Bhadrappa Layout, Sampangirama Nagar).", ta: "70 பெயரிடப்பட்ட வெள்ள-ஆபத்து இடங்கள் - BBMP-ன் ஆவணப்படுத்தப்பட்ட வெள்ளம் வரலாறு கொண்ட பெயரிடப்பட்ட ஹாட்ஸ்பாட்களின் தொகுக்கப்பட்ட பட்டியல்.", kn: "70 ಹೆಸರಿಸಲಾದ ಪ್ರವಾಹ-ಪೀಡಿತ ಸ್ಥಳಗಳು - BBMP ಯ ದಾಖಲಿತ ಪ್ರವಾಹ ಇತಿಹಾಸದೊಂದಿಗೆ ಹೆಸರಿಸಲಾದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳ ಸಂಗ್ರಹಿತ ಪಟ್ಟಿ (ಉದಾ: ಭದ್ರಪ್ಪ ಬಡಾವಣೆ, ಸಂಪಂಗಿರಾಮ ನಗರ)." },
  bullet_named_low: { en: "129 named low-lying areas - additional KSRSAC dataset of named low-elevation neighbourhoods (e.g. JRD Tata Nagar, Devi Nagara).", ta: "129 பெயரிடப்பட்ட தாழ்வான பகுதிகள் - பெயரிடப்பட்ட குறைந்த-உயரம் சுற்றுப்புறங்களின் கூடுதல் KSRSAC தரவு (உதா: JRD டாடா நகர், தேவி நகர).", kn: "129 ಹೆಸರಿಸಲಾದ ತಗ್ಗು-ಪ್ರದೇಶಗಳು - ಹೆಸರಿಸಲಾದ ಕಡಿಮೆ-ಎತ್ತರದ ನೆರೆಹೊರೆಗಳ ಹೆಚ್ಚುವರಿ KSRSAC ದತ್ತಾಂಶ (ಉದಾ: JRD ಟಾಟಾ ನಗರ, ದೇವಿ ನಗರ)." },
  bullet_vulnerable: { en: "200 unnamed vulnerable points - KSRSAC's broader vulnerability layer; toggle off by default because the unnamed cloud crowds out the named-locality story. Named-locality cross-reference is a follow-up RTI to BBMP.", ta: "200 பெயரிடப்படாத பாதிக்கப்படக்கூடிய புள்ளிகள் - KSRSAC-ன் பரந்த பாதிப்பு அடுக்கு; பெயரிடப்படாத மேகம் பெயரிடப்பட்ட இடங்களைத் தடுப்பதால் இயல்பாக அணைக்கப்பட்டுள்ளது.", kn: "200 ಹೆಸರಿಲ್ಲದ ದುರ್ಬಲ ಬಿಂದುಗಳು - KSRSAC ನ ವಿಶಾಲ ದುರ್ಬಲತೆ ಲೇಯರ್; ಹೆಸರಿಲ್ಲದ ಮೋಡ ಹೆಸರಿಸಲಾದ ಸ್ಥಳಗಳ ಕಥೆಯನ್ನು ಮುಚ್ಚುವ ಕಾರಣ ಪೂರ್ವನಿಯೋಜಿತವಾಗಿ ಆಫ್." },
  gaps_heading: { en: "Data we don't have", ta: "எங்களிடம் இல்லாத தரவு", kn: "ನಮ್ಮಲ್ಲಿ ಇಲ್ಲದ ದತ್ತಾಂಶ" },
  gap_return_period: { en: "5 / 10 / 25 / 50 / 100 / 200-year return-period polygons. The DST-funded IISc-KSNDMC Urban Flood Model (Current Science vol. 120 no. 9, May 2021) produces these by valley but the underlying rasters aren't republished. Acquisition path: RTI / partnership ask through T.V. Ramachandra's group at IISc CES.", ta: "5 / 10 / 25 / 50 / 100 / 200-ஆண்டு திரும்பும் காலத் தளங்கள். DST-நிதியளிக்கப்பட்ட IISc-KSNDMC நகர் வெள்ள மாதிரி இவற்றை பள்ளத்தாக்கு வாரியாக உருவாக்குகிறது ஆனால் அடிப்படை ராஸ்டர்கள் மறுவெளியீடு செய்யப்படவில்லை.", kn: "5 / 10 / 25 / 50 / 100 / 200-ವರ್ಷ ಮರಳುವ ಅವಧಿಯ ಬಹುಭುಜಗಳು. DST-ನಿಧಿಸಿತ IISc-KSNDMC ನಗರ ಪ್ರವಾಹ ಮಾಡೆಲ್ (Current Science ಸಂಪುಟ 120 ಸಂಖ್ಯೆ 9, ಮೇ 2021) ಕಣಿವೆವಾರು ಇವುಗಳನ್ನು ಉತ್ಪಾದಿಸುತ್ತದೆ ಆದರೆ ಆಧಾರ ರಾಸ್ಟರ್‌ಗಳನ್ನು ಮರು-ಪ್ರಕಟಿಸಲಾಗಿಲ್ಲ. ಸ್ವಾಧೀನ ಮಾರ್ಗ: T.V. ರಾಮಚಂದ್ರ ಗುಂಪಿನ ಮೂಲಕ IISc CES ಗೆ RTI / ಪಾಲುದಾರಿಕೆ ಕೇಳಿಕೆ." },
  gap_tertiary: { en: "Tertiary drains (~5,800 features). Available from KSRSAC as a 17 MB GeoJSON - too heavy for raw browser load; queued for a PMTiles follow-up.", ta: "மூன்றாம்நிலை சாலைகள் (~5,800 அம்சங்கள்). KSRSAC-ல் இருந்து 17 MB GeoJSON-ஆக கிடைக்கிறது - கச்சா உலாவி சுமைக்கு மிக கனமானது; PMTiles பின்தொடர்தலுக்கு வரிசையில்.", kn: "ತೃತೀಯ ಚರಂಡಿಗಳು (~5,800 ಲಕ್ಷಣಗಳು). KSRSAC ನಿಂದ 17 MB GeoJSON ಆಗಿ ಲಭ್ಯ - ಕಚ್ಚಾ ಬ್ರೌಸರ್ ಲೋಡ್‌ಗೆ ಭಾರವಾಗಿದೆ; PMTiles ಅನುಸರಣೆಗೆ ಕ್ಯೂನಲ್ಲಿದೆ." },
  gap_live_rainfall: { en: "Live rainfall + SWD water-level. KSNDMC has 100 ARG + 12 AWS + 25 SWD sensors inside BBMP at 15-minute cadence. The Bengaluru Megha Sandesha app surfaces \"now\" only - bulk historical and a public REST feed are partnership-only.", ta: "நேரடி மழைப்பொழிவு + SWD நீர்-நிலை. KSNDMC-ல் BBMP-க்குள் 15-நிமிட இடைவெளியில் 100 ARG + 12 AWS + 25 SWD சென்சார்கள் உள்ளன.", kn: "ನೇರ ಮಳೆ + SWD ನೀರಿನ-ಮಟ್ಟ. KSNDMC ಗೆ BBMP ಒಳಗೆ 15-ನಿಮಿಷದ ಆವರ್ತದಲ್ಲಿ 100 ARG + 12 AWS + 25 SWD ಸಂವೇದಕಗಳಿವೆ. Bengaluru Megha Sandesha ಆ್ಯಪ್ \"ಈಗ\" ಮಾತ್ರ ತೋರಿಸುತ್ತದೆ - ಸಗಟು ಐತಿಹಾಸಿಕ ಮತ್ತು ಸಾರ್ವಜನಿಕ REST ಫೀಡ್ ಪಾಲುದಾರಿಕೆ-ಮಾತ್ರ." },
  gap_bbmp_kaluve: { en: "BBMP rajakaluve survey-number GIS. KSRSAC's primary-drains KML here is the public summary; the underlying survey-number-resolution dataset stays with BBMP SWD Department. RTI ask logged.", ta: "BBMP ராஜகலுவை சர்வே-எண் GIS. இங்குள்ள KSRSAC முதன்மை-சாலை KML பொது சுருக்கம்; அடிப்படை சர்வே-எண்-தீர்மானம் தரவு BBMP SWD துறையில் உள்ளது.", kn: "BBMP ರಾಜಕಲುವೆ ಸರ್ವೆ-ಸಂಖ್ಯೆ GIS. ಇಲ್ಲಿನ KSRSAC ಪ್ರಾಥಮಿಕ-ಚರಂಡಿ KML ಸಾರ್ವಜನಿಕ ಸಾರಾಂಶ; ಆಧಾರ ಸರ್ವೆ-ಸಂಖ್ಯೆ ರೆಸಲ್ಯೂಶನ್ ದತ್ತಾಂಶ BBMP SWD ಇಲಾಖೆಯಲ್ಲಿ ಉಳಿಯುತ್ತದೆ." },
  external_heading: { en: "External monitoring sources", ta: "வெளி கண்காணிப்பு ஆதாரங்கள்", kn: "ಬಾಹ್ಯ ಮೇಲ್ವಿಚಾರಣಾ ಮೂಲಗಳು" },
  ksndmc_note: { en: "100 ARG / 12 AWS / 25 SWD sensors in BBMP, 15-min cadence (live via Megha Sandesha app)", ta: "BBMP-ல் 100 ARG / 12 AWS / 25 SWD சென்சார்கள், 15-நிமிட இடைவெளி (Megha Sandesha செயலி வழியாக நேரடி)", kn: "BBMP ಯಲ್ಲಿ 100 ARG / 12 AWS / 25 SWD ಸಂವೇದಕಗಳು, 15-ನಿಮಿಷ ಆವರ್ತ (Megha Sandesha ಆ್ಯಪ್ ಮೂಲಕ ನೇರ)" },
  bhuvan_note: { en: "satellite flood-inundation layers for major historical events (2005, 2022, 2024)", ta: "முக்கிய வரலாற்று நிகழ்வுகளுக்கான செயற்கைக்கோள் வெள்ள-மூழ்கல் அடுக்குகள் (2005, 2022, 2024)", kn: "ಪ್ರಮುಖ ಐತಿಹಾಸಿಕ ಘಟನೆಗಳಿಗೆ ಉಪಗ್ರಹ ಪ್ರವಾಹ-ಮುಳುಗುವ ಲೇಯರ್‌ಗಳು (2005, 2022, 2024)" },
  wb_note: { en: "Karnataka Water Security & Resilience Program ($426M, 2025) - references 372 flood hotspots 2013-2020 + 183 lakes as balancing reservoirs", ta: "கர்நாடகா நீர் பாதுகாப்பு & மீள்தன்மை திட்டம் ($426M, 2025) - 372 வெள்ள ஹாட்ஸ்பாட்களை குறிப்பிடுகிறது 2013-2020 + 183 ஏரிகள் சமநிலை நீர்த்தேக்கங்களாக", kn: "ಕರ್ನಾಟಕ ಜಲ ಭದ್ರತೆ ಮತ್ತು ಸ್ಥಿತಿಸ್ಥಾಪಕತೆ ಕಾರ್ಯಕ್ರಮ ($426M, 2025) - 372 ಪ್ರವಾಹ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು 2013-2020 + 183 ಕೆರೆಗಳನ್ನು ಸಮತೋಲನ ಜಲಾಶಯಗಳಾಗಿ ಉಲ್ಲೇಖಿಸುತ್ತದೆ" },
  iisc_note: { en: "valley-wise catchment + low-lying-ward analysis (ETR114 / ETR123 / ETR131)", ta: "பள்ளத்தாக்கு-வாரியாக நீர்பிடிப்புப் பகுதி + தாழ்வான-வார்டு பகுப்பாய்வு (ETR114 / ETR123 / ETR131)", kn: "ಕಣಿವೆವಾರು ಜಲಾನಯನ + ತಗ್ಗು-ಪ್ರದೇಶ-ವಾರ್ಡ್ ವಿಶ್ಲೇಷಣೆ (ETR114 / ETR123 / ETR131)" },
  bmtpc_note: { en: "Karnataka district-level flood hazard map (national context)", ta: "கர்நாடகா மாவட்ட-நிலை வெள்ள ஆபத்து வரைபடம் (தேசிய சூழல்)", kn: "ಕರ್ನಾಟಕ ಜಿಲ್ಲಾ-ಮಟ್ಟದ ಪ್ರವಾಹ ಅಪಾಯ ನಕ್ಷೆ (ರಾಷ್ಟ್ರೀಯ ಸಂದರ್ಭ)" },
  source_para: { en: "All spatial data on this page is sourced from {opencity}, which republishes KSRSAC's public-domain KMLs. Last source refresh: 27 November 2025.", ta: "இந்த பக்கத்தில் உள்ள அனைத்து இடஞ்சார்ந்த தரவும் {opencity}-ல் இருந்து பெறப்பட்டது, இது KSRSAC-ன் பொது-களம் KML-களை மறுவெளியீடு செய்கிறது. கடைசி ஆதார புதுப்பிப்பு: 27 நவம்பர் 2025.", kn: "ಈ ಪುಟದ ಎಲ್ಲಾ ಪ್ರಾದೇಶಿಕ ದತ್ತಾಂಶ {opencity} ನಿಂದ ಬಂದಿದೆ, ಇದು KSRSAC ನ ಸಾರ್ವಜನಿಕ-ಡೊಮೇನ್ KML ಗಳನ್ನು ಮರು-ಪ್ರಕಟಿಸುತ್ತದೆ. ಕೊನೆಯ ಮೂಲ ರಿಫ್ರೆಶ್: 27 ನವೆಂಬರ್ 2025." },
  about_para: { en: "See {about_link} for the full data-source index and the IISc partnership ask logged as a Tier-1 follow-up.", ta: "முழு தரவு-ஆதார அட்டவணை மற்றும் Tier-1 பின்தொடர்தலாக பதிவு செய்யப்பட்ட IISc கூட்டாண்மை கேள்விக்கு {about_link}-ஐப் பார்க்கவும்.", kn: "ಸಂಪೂರ್ಣ ದತ್ತಾಂಶ-ಮೂಲ ಸೂಚಿ ಮತ್ತು Tier-1 ಅನುಸರಣೆಯಾಗಿ ದಾಖಲಾದ IISc ಪಾಲುದಾರಿಕೆ ಕೋರಿಕೆಗಾಗಿ {about_link} ನೋಡಿ." },
};

/**
 * Bengaluru's flood page is a map, not the narrative stack: KSRSAC KMLs
 * republished by OpenCity (CC-public-domain, Nov 2025) give 399 flood-hotspot
 * points (named-prone / unnamed-vulnerable / named-low-lying) and the BBMP
 * primary + secondary stormwater drain (rajakaluve) network. Copy is `T` above.
 *
 * NOT shipped:
 * - 5/10/25/50/100/200-year return-period polygons. They come out of the
 *   DST-funded IISc-KSNDMC Urban Flood Model (Current Science vol. 120 no. 9,
 *   May 2021), but the rasters are not republished anywhere. Acquisition path
 *   is an RTI / partnership ask through T.V. Ramachandra's group at IISc CES;
 *   stated in the sidebar's "data we don't have".
 * - The tertiary drain network (~5,800 features, 17 MB): too heavy for direct
 *   GeoJSON; queued for a PMTiles follow-up.
 */
export const FLOOD: CityFloodContent = {
  metaDescription:
    "Bengaluru flood risk - KSRSAC flood hotspots, rajakaluve drainage network, and historical inundation.",
  map: {
    center: [12.9716, 77.5946],
    zoom: 11,
    scope: T.scope_label,
    summary: T.summary_counts,
    layersTitle: T.layers,
    layers: [
      {
        url: "/geojson/bangalore-swd-primary.geojson",
        kind: "line",
        style: { color: "#1d4ed8", weight: 2.5, opacity: 0.85 },
        nameProp: "name",
        nameFallback: "Primary stormwater drain",
        fit: true,
        rows: [{ label: T.primary_drains, swatch: "w-4 h-1 rounded bg-blue-700", accent: "accent-blue-700", on: true }],
      },
      {
        url: "/geojson/bangalore-swd-secondary.geojson",
        kind: "line",
        style: { color: "#3b82f6", weight: 1.2, opacity: 0.55 },
        fit: true,
        rows: [{ label: T.secondary_drains, swatch: "w-4 h-0.5 rounded bg-blue-500", accent: "accent-blue-500", on: true }],
      },
      {
        url: "/data/bangalore-flood-hotspots.geojson",
        kind: "point",
        divider: true,
        style: { color: "#0f172a", weight: 1, fillOpacity: 0.85 },
        categoryProp: "category",
        nameProp: "name",
        nameFallback: "(unnamed point)",
        lines: [{ prop: "category_label", muted: true, always: true }],
        // The unnamed-vulnerable cloud starts off: it crowds out the named-locality story.
        rows: [
          { value: "named_flood_prone", fillColor: "#dc2626", radius: 6, label: T.named_prone, swatch: "w-2.5 h-2.5 rounded-full bg-red-600", accent: "accent-red-600", on: true },
          { value: "named_low_lying", fillColor: "#ea580c", radius: 5, label: T.named_low_lying, swatch: "w-2.5 h-2.5 rounded-full bg-orange-600", accent: "accent-orange-600", on: true },
          { value: "vulnerable_unnamed", fillColor: "#facc15", radius: 4, label: T.vulnerable, swatch: "w-2.5 h-2.5 rounded-full bg-yellow-400 border border-slate-700", accent: "accent-yellow-400" },
        ],
      },
    ],
    elevationNote:
      "Ground height above sea level from satellite (FABDEM 30 m, buildings and forests removed). Bengaluru's floods follow its valleys - the blue bands are the low ground the rajakaluves drain. Read as bands, not spot heights (~2 m vertical accuracy).",
    sidebar: {
      heading: T.heading,
      intro: T.intro,
      shows: {
        heading: T.what_shows,
        items: [
          T.bullet_primary,
          T.bullet_secondary,
          T.bullet_named_prone,
          T.bullet_named_low,
          T.bullet_vulnerable,
        ],
      },
      gaps: {
        heading: T.gaps_heading,
        items: [
          T.gap_return_period,
          T.gap_tertiary,
          T.gap_live_rainfall,
          T.gap_bbmp_kaluve,
        ],
      },
      sources: {
        heading: T.external_heading,
        separator: "-",
        items: [
          { href: "https://www.ksndmc.org/", label: "KSNDMC - Karnataka SDMA", note: T.ksndmc_note },
          { href: "https://bhuvan.nrsc.gov.in/", label: "ISRO Bhuvan", note: T.bhuvan_note },
          {
            href: "https://documents1.worldbank.org/curated/en/099052725120011568/pdf/P506272-cb80605f-d4d0-40be-af6e-40c57fddc414.pdf",
            label: "World Bank P506272",
            note: T.wb_note,
          },
          {
            href: "https://wgbis.ces.iisc.ac.in/energy/water/paper/urbanfloods_bangalore/",
            label: "IISc CES - T.V. Ramachandra urban-flood papers",
            note: T.iisc_note,
          },
          { href: "https://vai.bmtpc.org/Flood.html", label: "BMTPC Vulnerability Atlas", note: T.bmtpc_note },
        ],
      },
      footer: {
        paras: [
          {
            ...T.source_para,
            link: { slot: "opencity", href: "https://data.opencity.in/dataset/flooding-locations-in-bengaluru-urban", label: "OpenCity Bengaluru" },
          },
          { ...T.about_para, link: { slot: "about_link", href: "/bangalore/about#data-sources", label: "/bangalore/about" } },
        ],
      },
    },
  },
};
