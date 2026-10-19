"use client";

/**
 * Bangalore-specific "What each page shows" subsections.
 *
 * Each section + paragraph reads its copy from `C` below, so the whole
 * description localises with the user's chosen language (en / ta / kn).
 * Mirrors the structure of madurai-pages.tsx so cross-city navigation
 * between about-page anchors stays predictable.
 */

import { useLanguage } from "@/lib/i18n/context";
import { SubSection, type CityPagesProps } from "@/components/about/primitives";
import type { I18nText } from "@/lib/i18n/translations";

function tFmt(template: string, params: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(params[k] ?? `{${k}}`));
}

const C = {
  dashboard: {
    title: { en: "Home / dashboard", ta: "முகப்பு / டாஷ்போர்டு", kn: "ಮುಖಪುಟ / ಡ್ಯಾಶ್‌ಬೋರ್ಡ್" },
    p1: { en: "{city}'s dashboard does NOT show a Chennai-style \"days of water left\" runway. Bengaluru is a pumped city, not a reservoir city: the only operational drinking source is Cauvery water lifted 95 km from T.K. Halli and ~500 m in elevation, served from BWSSB's 5 WTPs at the headworks. The dashboard hero (the Cauvery Pumping panel) anchors on that chain instead - infrastructure, transmission, NRW, and the stage-by-stage augmentation history.", ta: "{city}-வின் டாஷ்போர்டு சென்னை-பாணி \"மீதமுள்ள நீர் நாட்கள்\" தண்டவாளத்தைக் காட்டாது. பெங்களூரு ஒரு பம்ப் செய்யப்பட்ட நகரம், நீர்த்தேக்க நகரம் அல்ல: ஒரே செயல்பாட்டு குடிநீர் ஆதாரம் காவிரி நீர், T.K. ஹல்லியில் இருந்து 95 கி.மீ மற்றும் ~500 மீ உயரத்திற்கு உயர்த்தப்படுகிறது, BWSSB-ன் 5 WTP-களில் இருந்து வழங்கப்படுகிறது. டாஷ்போர்டு ஹீரோ (காவிரி பம்பிங் பேனல்) அந்த சங்கிலியில் நங்கூரம் இடுகிறது.", kn: "{city} ನ ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಚೆನ್ನೈ-ಶೈಲಿಯ \"ಉಳಿದ ನೀರಿನ ದಿನಗಳು\" ಟ್ರ್ಯಾಕ್ ತೋರಿಸುವುದಿಲ್ಲ. ಬೆಂಗಳೂರು ಪಂಪ್ ಮಾಡಲ್ಪಟ್ಟ ನಗರ, ಜಲಾಶಯ ನಗರವಲ್ಲ: T.K. ಹಳ್ಳಿಯಿಂದ 95 ಕಿಮೀ ಮತ್ತು ~500 ಮೀ ಎತ್ತರಕ್ಕೆ ಎತ್ತಲ್ಪಟ್ಟ ಕಾವೇರಿ ನೀರು ಮಾತ್ರ ಕಾರ್ಯಾಚರಣಾ ಕುಡಿಯುವ ಮೂಲ, BWSSB ಯ 5 WTP ಗಳಿಂದ ಸೇವೆ ಸಲ್ಲಿಸಲಾಗುತ್ತದೆ. ಡ್ಯಾಶ್‌ಬೋರ್ಡ್ ಹೀರೋ (ಕಾವೇರಿ ಪಂಪಿಂಗ್ ಪ್ಯಾನಲ್) ಆ ಸರಪಳಿಯ ಮೇಲೆ ಆಧಾರಿತವಾಗಿದೆ - ಮೂಲಸೌಕರ್ಯ, ಪ್ರಸರಣ, NRW, ಮತ್ತು ಹಂತ-ಹಂತದ ಹೆಚ್ಚಳ ಇತಿಹಾಸ." },
    h_cauvery: { en: "Cauvery Pumping hero", ta: "காவிரி பம்பிங் ஹீரோ", kn: "ಕಾವೇರಿ ಪಂಪಿಂಗ್ ಹೀರೋ" },
    p2: { en: "The hero tile renders engineering numbers from bangalore-supply-overview.json: 2,293 MLD installed capacity across six WTPs (Stages I-V; ~1,500 MLD delivered); 95 km transmission; 500 m lift; 36% NRW (audited 2017-18); ~14M served; ~75% of revenue absorbed by pumping energy. Supply-side figures are refreshed to BWSSB-official 2026 sources (BWSSB 'About' page + April 2026 Chairman interview, Elets eGov); historical build-out and 2034/2049 demand from the JICA Phase 3 Final Report (November 2017); Stage V under-delivery (~400 vs 775 MLD design) per The Ken (February 2026).", ta: "ஹீரோ டைல் bangalore-supply-overview.json-ல் இருந்து பொறியியல் எண்களை வழங்குகிறது: 1,310 MLD நிறுவப்பட்ட திறன், 95 கி.மீ பரிமாற்றம், 500 மீ உயர்த்தல், 48% NRW, ~14M GBA-க்கு எதிராக ~5.8M சேவை செய்யப்படுகிறது, வருவாயின் ~75% பம்பிங் ஆற்றலால் உறிஞ்சப்படுகிறது.", kn: "ಹೀರೋ ಟೈಲ್ bangalore-supply-overview.json ನಿಂದ ಎಂಜಿನಿಯರಿಂಗ್ ಸಂಖ್ಯೆಗಳನ್ನು ತೋರಿಸುತ್ತದೆ: ಆರು WTP ಗಳಲ್ಲಿ 2,293 MLD ಸ್ಥಾಪಿತ ಸಾಮರ್ಥ್ಯ (Stages I-V; ~1,500 MLD ತಲುಪಿಸಲಾಗಿದೆ), 95 ಕಿಮೀ ಪ್ರಸರಣ, 500 ಮೀ ಎತ್ತುವಿಕೆ, 36% NRW (2017-18 ಲೆಕ್ಕಪರಿಶೋಧಿತ), ~14M ಸೇವೆ, ಆದಾಯದ ~75% ಪಂಪಿಂಗ್ ಶಕ್ತಿಯಿಂದ ಹೀರಲ್ಪಟ್ಟಿದೆ. ಪೂರೈಕೆ-ಬದಿಯ ಅಂಕಿಅಂಶಗಳನ್ನು BWSSB-ಅಧಿಕೃತ 2026 ಮೂಲಗಳಿಗೆ (BWSSB 'About' ಪುಟ + ಏಪ್ರಿಲ್ 2026 ಅಧ್ಯಕ್ಷರ ಸಂದರ್ಶನ) ನವೀಕರಿಸಲಾಗಿದೆ; ಐತಿಹಾಸಿಕ ನಿರ್ಮಾಣ ಮತ್ತು 2034/2049 ಬೇಡಿಕೆ JICA Phase 3 ವರದಿಯಿಂದ (ನವೆಂಬರ್ 2017); Stage V ಕಡಿಮೆ-ವಿತರಣೆ (~400 vs 775 MLD) The Ken (ಫೆಬ್ರವರಿ 2026) ಪ್ರಕಾರ." },
    h_basin: { en: "Upstream Cauvery basin storage panel", ta: "மேற்பகுதி காவிரி தடாக சேமிப்பு பேனல்", kn: "ಮೇಲ್ಭಾಗ ಕಾವೇರಿ ಜಲಾನಯನ ಸಂಗ್ರಹ ಪ್ಯಾನಲ್" },
    p3: { en: "Below the hero, four upstream Cauvery reservoirs (KRS, Hemavathi, Kabini, Harangi) are surfaced as a basin-storage panel - NOT as Bengaluru's tap supply. These dams are irrigation-primary; the city's share is the carve-out at T.K. Halli. The panel mirrors Madurai's Mullaperiyar pattern: a Kerala-side dam tracked because it feeds Madurai's supply. Daily history backfills and AutoARIMA forecasts on these four reservoirs are queued for a follow-up round; for now the panel surfaces registered capacities + catchment areas.", ta: "ஹீரோவுக்கு கீழே, நான்கு மேற்பகுதி காவிரி நீர்த்தேக்கங்கள் (KRS, ஹேமாவதி, கபினி, ஹராங்கி) ஒரு தடாக-சேமிப்பு பேனலாக காட்டப்படுகின்றன - பெங்களூரின் குழாய் வழங்கல் அல்ல. இந்த அணைகள் பாசன-முதன்மை; நகரின் பங்கு T.K. ஹல்லியில் உள்ள வெட்டு.", kn: "ಹೀರೋದ ಕೆಳಗೆ, ನಾಲ್ಕು ಮೇಲ್ಭಾಗ ಕಾವೇರಿ ಜಲಾಶಯಗಳು (KRS, ಹೇಮಾವತಿ, ಕಬಿನಿ, ಹಾರಂಗಿ) ಜಲಾನಯನ-ಸಂಗ್ರಹ ಪ್ಯಾನಲ್ ಆಗಿ ತೋರಿಸಲ್ಪಡುತ್ತವೆ - ಬೆಂಗಳೂರಿನ ನಲ್ಲಿ ಪೂರೈಕೆಯಲ್ಲ. ಈ ಅಣೆಕಟ್ಟುಗಳು ನೀರಾವರಿ-ಪ್ರಾಥಮಿಕ; ನಗರದ ಪಾಲು T.K. ಹಳ್ಳಿಯಲ್ಲಿ ಕತ್ತರಿಸಿದ ಭಾಗ. ಪ್ಯಾನಲ್ ಮಧುರೈನ ಮುಲ್ಲೈಪೆರಿಯಾರ್ ಮಾದರಿಯನ್ನು ಅನುಸರಿಸುತ್ತದೆ: ಮಧುರೈನ ಪೂರೈಕೆಯನ್ನು ಪೋಷಿಸುವ ಕಾರಣ ಗಮನಿಸಲಾದ ಕೇರಳ-ಬದಿಯ ಅಣೆಕಟ್ಟು. ಈ ನಾಲ್ಕು ಜಲಾಶಯಗಳ ದೈನಂದಿನ ಇತಿಹಾಸ ಭರ್ತಿ ಮತ್ತು AutoARIMA ಮುನ್ಸೂಚನೆಗಳು ಅನುಸರಣೆಗೆ ಕ್ಯೂನಲ್ಲಿವೆ; ಸದ್ಯಕ್ಕೆ ಪ್ಯಾನಲ್ ನೋಂದಾಯಿತ ಸಾಮರ್ಥ್ಯಗಳು + ಜಲಾನಯನ ಪ್ರದೇಶಗಳನ್ನು ತೋರಿಸುತ್ತದೆ." },
  },
  tanker: {
    title: "nav.tanker",
    p1: { en: "Bengaluru is the only city in the platform with a dedicated tanker page. With ~5,000 tankers operating across the city and BWSSB's piped network covering only ~71% of ~14M residents (ISEC, 2017-18), the tanker economy is a parallel water system - not a fringe phenomenon. The page anchors on the OpenCity Bengaluru Tanker Water Survey (longitudinal 2015 / 2019 / 2024 / 2025 waves), surfacing fleet size, rate spreads, IISc-flagged stress ward demand concentrations, and the BWSSB official-vs-informal rate gap (₹700 per 5 kL on Kaveriwheels vs ₹2,850 per 12 kL at summer 2024 crisis peak).", ta: "தளத்தில் பெங்களூரு மட்டுமே ஒரு பிரத்யேக டேங்கர் பக்கம் கொண்டுள்ளது. நகரம் முழுவதும் ~5,000 டேங்கர்கள் இயக்கப்படுகின்றன, BWSSB-ன் குழாய் வலையமைப்பு ~14M குடியிருப்பாளர்களில் ~5.8M-ஐ மட்டுமே அடைகிறது, டேங்கர் பொருளாதாரம் ஒரு இணை நீர் அமைப்பாகும்.", kn: "ವೇದಿಕೆಯಲ್ಲಿ ಬೆಂಗಳೂರು ಮಾತ್ರ ಮೀಸಲಾದ ಟ್ಯಾಂಕರ್ ಪುಟವನ್ನು ಹೊಂದಿದೆ. ನಗರದಾದ್ಯಂತ ~5,000 ಟ್ಯಾಂಕರ್‌ಗಳು ಕಾರ್ಯನಿರ್ವಹಿಸುತ್ತಿವೆ ಮತ್ತು BWSSB ಯ ಪೈಪ್ ಜಾಲ ~14M ನಿವಾಸಿಗಳಲ್ಲಿ ~71% ಮಾತ್ರ ತಲುಪುತ್ತದೆ (ISEC, 2017-18), ಟ್ಯಾಂಕರ್ ಆರ್ಥಿಕತೆಯು ಸಮಾನಾಂತರ ಜಲ ವ್ಯವಸ್ಥೆ. ಪುಟವು OpenCity ಬೆಂಗಳೂರು ಟ್ಯಾಂಕರ್ ನೀರಿನ ಸಮೀಕ್ಷೆ (2015 / 2019 / 2024 / 2025 ತರಂಗಗಳು) ಆಧರಿಸಿದೆ, ಫ್ಲೀಟ್ ಗಾತ್ರ, ದರ ಹರಡುವಿಕೆ, IISc-ಗುರುತಿಸಿದ ಒತ್ತಡ ವಾರ್ಡ್ ಬೇಡಿಕೆ ಸಾಂದ್ರತೆ, ಮತ್ತು BWSSB ಅಧಿಕೃತ-ವಿರುದ್ಧ-ಅನೌಪಚಾರಿಕ ದರ ಅಂತರವನ್ನು (₹700 / 5 kL Kaveriwheels vs ₹2,850 / 12 kL 2024 ಬಿಕ್ಕಟ್ಟು ಶಿಖರ) ತೋರಿಸುತ್ತದೆ." },
  },
  gw: {
    title: "my_ward.groundwater",
    p1: { en: "{city}'s groundwater page combines three views: CGWB block exploitation (the official annual classification), ward-level risk composite, and the CGWB live monitoring station network. Per-ward depth interpolation is deliberately disabled here - the underlying station density doesn't support an honest 369-ward choropleth.", ta: "{city}-வின் நிலத்தடி நீர் பக்கம் மூன்று காட்சிகளை இணைக்கிறது: CGWB தொகுதி சுரண்டல், வார்டு-நிலை ஆபத்து கூட்டு, மற்றும் CGWB நேரடி கண்காணிப்பு நிலையம் வலையமைப்பு.", kn: "{city} ನ ಅಂತರ್ಜಲ ಪುಟ ಮೂರು ನೋಟಗಳನ್ನು ಸಂಯೋಜಿಸುತ್ತದೆ: CGWB ಬ್ಲಾಕ್ ಶೋಷಣೆ (ಅಧಿಕೃತ ವಾರ್ಷಿಕ ವರ್ಗೀಕರಣ), ವಾರ್ಡ್-ಮಟ್ಟದ ಅಪಾಯ ಸಂಯೋಜನೆ, ಮತ್ತು CGWB ನೇರ ಮೇಲ್ವಿಚಾರಣಾ ನಿಲ್ದಾಣ ಜಾಲ. ಪ್ರತಿ-ವಾರ್ಡ್ ಆಳ ಇಂಟರ್‌ಪೋಲೇಷನ್ ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ಇಲ್ಲಿ ನಿಷ್ಕ್ರಿಯಗೊಳಿಸಲಾಗಿದೆ - ಆಧಾರ ನಿಲ್ದಾಣ ಸಾಂದ್ರತೆ 369-ವಾರ್ಡ್ ಚೋರೋಪ್ಲೆತ್‌ಗೆ ಪ್ರಾಮಾಣಿಕವಾಗಿ ಬೆಂಬಲಿಸುವುದಿಲ್ಲ." },
    h_block: { en: "Block exploitation (GWR)", ta: "தொகுதி சுரண்டல் (GWR)", kn: "ಬ್ಲಾಕ್ ಶೋಷಣೆ (GWR)" },
    p2: { en: "6 CGWB-classified blocks across Bangalore Urban district - Bangalore (North), Bangalore-South, Bangalore-East, Bangalore-City, Yelahanka, Anekal - coloured by their latest stage of extraction (annual extraction as a percentage of annual extractable groundwater) from the IN-GRES assessment (CGWB + Karnataka). Status classes: Safe / Semi Critical / Critical / Over Exploited. All six blocks are Over-Exploited in every assessment from 2011 to 2025-26. Bangalore-East is the worst at 395% in 2025-26; Yelahanka went from 157% in 2021-22, when the units were last redrawn, to 251%. The panel auto-anchors on the worst-exploited block when the page loads.", ta: "பெங்களூரு நகர மாவட்டத்தில் 6 CGWB-வகைப்படுத்தப்பட்ட தொகுதிகள் - பெங்களூரு (வடக்கு), பெங்களூரு-தெற்கு, பெங்களூரு-கிழக்கு, பெங்களூரு-நகரம், யேலஹங்கா, அனேகல் - CGWB-ன் நிலத்தடி நீர் மதிப்பீட்டுக் குழுவின் சமீபத்திய பிரித்தெடுப்பு நிலை (stage of extraction) சதவீதத்தால் வண்ணமயமாக்கப்பட்டுள்ளன. அனைத்து ஆறு தொகுதிகளும் 2011 முதல் 2025-26 வரையிலான ஒவ்வொரு மதிப்பீட்டிலும் அதிக-சுரண்டலில் இருந்துள்ளன.", kn: "ಬೆಂಗಳೂರು ನಗರ ಜಿಲ್ಲೆಯಾದ್ಯಂತ 6 CGWB-ವರ್ಗೀಕೃತ ಬ್ಲಾಕ್‌ಗಳು - ಬೆಂಗಳೂರು (ಉತ್ತರ), ಬೆಂಗಳೂರು-ದಕ್ಷಿಣ, ಬೆಂಗಳೂರು-ಪೂರ್ವ, ಬೆಂಗಳೂರು-ನಗರ, ಯಲಹಂಕ, ಆನೇಕಲ್ - CGWB ಯ ಭೂಜಲ ಅಂದಾಜು ಸಮಿತಿ ಮೌಲ್ಯಮಾಪನದಿಂದ ಇತ್ತೀಚಿನ ಹೊರತೆಗೆಯುವಿಕೆಯ ಹಂತದ (stage of extraction) ಶೇಕಡಾವಾರು ಮೂಲಕ ಬಣ್ಣ ಮಾಡಲಾಗಿದೆ. ಎಲ್ಲಾ ಆರು ಬ್ಲಾಕ್‌ಗಳು 2011 ರಿಂದ 2025-26 ರವರೆಗಿನ ಪ್ರತಿ ಮೌಲ್ಯಮಾಪನದಲ್ಲಿ ಅತಿ-ಶೋಷಿತವಾಗಿವೆ. ಬೆಂಗಳೂರು-ಪೂರ್ವ ಕೆಟ್ಟದು, 2025-26 ರಲ್ಲಿ 395%; ಯಲಹಂಕ 2021-22 ರಲ್ಲಿ 157% ರಿಂದ 251% ಗೆ ಏರಿದೆ. ಪುಟ ಲೋಡ್ ಆದಾಗ ಪ್ಯಾನಲ್ ಅತ್ಯಂತ ಕೆಟ್ಟ-ಶೋಷಿತ ಬ್ಲಾಕ್‌ನಲ್ಲಿ ಸ್ವಯಂ-ಆಧಾರಿತವಾಗಿರುತ್ತದೆ." },
    h_station: { en: "CGWB monitoring station overlay", ta: "CGWB கண்காணிப்பு நிலைய அடுக்கு", kn: "CGWB ಮೇಲ್ವಿಚಾರಣಾ ನಿಲ್ದಾಣ ಲೇಯರ್" },
    p3: { en: "13 telemetric DWLR stations across the district, drawn as click-through markers. The set covers Nimhans, Lalbagh Garden, Jayanagar, Hesaraghatta, Thalaghattapura, Anekal, Cubbon Park, Dasanapura, Indian Institute of Science, Yelahanka, Adugodi, Bangalore University Ars Ls, and Singasandra. Stations sitting inside an IISc-flagged stress ward (Jayanagar, Yelahanka) are marked as such. Per-station hydrograph readings are queued for a follow-up CGWB Year Book transcription.", ta: "மாவட்டம் முழுவதும் 13 தொலைமாற்றும் DWLR நிலையங்கள், கிளிக்-த்ரூ மார்க்கர்களாக வரையப்பட்டுள்ளன.", kn: "ಜಿಲ್ಲೆಯಾದ್ಯಂತ 13 ಟೆಲಿಮೆಟ್ರಿಕ್ DWLR ನಿಲ್ದಾಣಗಳು, ಕ್ಲಿಕ್-ತ್ರೂ ಮಾರ್ಕರ್‌ಗಳಾಗಿ ಚಿತ್ರಿಸಲಾಗಿದೆ. ಸೆಟ್ ನಿಮ್ಹಾನ್ಸ್, ಲಾಲ್‌ಬಾಗ್ ಗಾರ್ಡನ್, ಜಯನಗರ, ಹೆಸರಘಟ್ಟ, ತಲಘಟ್ಟಪುರ, ಆನೇಕಲ್, ಕಬ್ಬನ್ ಪಾರ್ಕ್, ದಾಸನಪುರ, ಇಂಡಿಯನ್ ಇನ್ಸ್ಟಿಟ್ಯೂಟ್ ಆಫ್ ಸೈನ್ಸ್, ಯಲಹಂಕ, ಆದುಗೋಡಿ, ಬೆಂಗಳೂರು ವಿಶ್ವವಿದ್ಯಾಲಯ Ars Ls, ಮತ್ತು ಸಿಂಗಸಂದ್ರವನ್ನು ಒಳಗೊಂಡಿದೆ. IISc-ಗುರುತಿಸಿದ ಒತ್ತಡ ವಾರ್ಡ್‌ನಲ್ಲಿರುವ ನಿಲ್ದಾಣಗಳನ್ನು (ಜಯನಗರ, ಯಲಹಂಕ) ಹಾಗೆ ಗುರುತಿಸಲಾಗಿದೆ. ಪ್ರತಿ-ನಿಲ್ದಾಣದ ಜಲಗ್ರಾಫ್ ಮಾಪನಗಳು CGWB Year Book ಪ್ರತಿಲಿಪಿ ಅನುಸರಣೆಗೆ ಕ್ಯೂನಲ್ಲಿವೆ." },
    gap_title: { en: "Why no per-ward depth choropleth?", ta: "ஏன் வார்டு-வாரியான ஆழ வரைபடம் இல்லை?", kn: "ಪ್ರತಿ-ವಾರ್ಡ್ ಆಳ ಚೋರೋಪ್ಲೆತ್ ಏಕೆ ಇಲ್ಲ?" },
    gap_body: { en: "We deliberately do NOT publish an IDW-interpolated per-ward depth choropleth for Bengaluru. The 13 CGWB telemetric stations spread across 369 GBA wards work out to roughly one station per 21 sq km - far too sparse to produce an honest per-ward interpolation. Spreading 13 points smoothly across 369 wards would manufacture precision the underlying data doesn't support. The 6-block GEC classification plus the station-point overlay together give an honest picture without faking ward-level granularity. Chennai's ward-depth choropleth is supported by OpenCity's monthly per-ward survey, which Bengaluru doesn't have an equivalent for.", ta: "பெங்களூருக்கு IDW-ஆல் இடைப்பிரித்த வார்டுக்கான ஆழ வரைபடத்தை நாங்கள் வெளியிடவில்லை. 369 GBA வார்டுகளுக்கு 13 CGWB தொலைமாற்றும் நிலையங்கள் - 21 சதுர கி.மீ.க்கு ஒரு நிலையம் - நேர்மையான வார்டுக்கான இடைப்பிரிப்புக்கு மிக சிறிது.", kn: "ಬೆಂಗಳೂರಿಗೆ IDW-ಇಂಟರ್‌ಪೋಲೇಟೆಡ್ ಪ್ರತಿ-ವಾರ್ಡ್ ಆಳ ಚೋರೋಪ್ಲೆತ್ ಅನ್ನು ನಾವು ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ಪ್ರಕಟಿಸುವುದಿಲ್ಲ. 369 GBA ವಾರ್ಡ್‌ಗಳಾದ್ಯಂತ 13 CGWB ಟೆಲಿಮೆಟ್ರಿಕ್ ನಿಲ್ದಾಣಗಳು ಸುಮಾರು 21 ಚ.ಕಿ.ಮೀ.ಗೆ ಒಂದು ನಿಲ್ದಾಣ - ಪ್ರಾಮಾಣಿಕ ಪ್ರತಿ-ವಾರ್ಡ್ ಇಂಟರ್‌ಪೋಲೇಷನ್ ಉತ್ಪಾದಿಸಲು ತುಂಬಾ ವಿರಳ. 6-ಬ್ಲಾಕ್ GEC ವರ್ಗೀಕರಣ ಮತ್ತು ನಿಲ್ದಾಣ-ಬಿಂದು ಲೇಯರ್ ಒಟ್ಟಿಗೆ ವಾರ್ಡ್-ಮಟ್ಟದ ನಿಖರತೆಯನ್ನು ನಕಲಿಸದೆ ಪ್ರಾಮಾಣಿಕ ಚಿತ್ರವನ್ನು ನೀಡುತ್ತವೆ. ಚೆನ್ನೈನ ವಾರ್ಡ್-ಆಳ ಚೋರೋಪ್ಲೆತ್ OpenCity ಯ ಮಾಸಿಕ ಪ್ರತಿ-ವಾರ್ಡ್ ಸಮೀಕ್ಷೆಯಿಂದ ಬೆಂಬಲಿತವಾಗಿದೆ, ಬೆಂಗಳೂರಿಗೆ ಸಮಾನವಿಲ್ಲ." },
    h_composite: { en: "Ward risk composite (3-factor)", ta: "வார்டு ஆபத்து கூட்டு (3-காரணி)", kn: "ವಾರ್ಡ್ ಅಪಾಯ ಸಂಯೋಜನೆ (3-ಅಂಶ)" },
    p_composite_intro: { en: "A 3-factor weighted percentile score per ward, A-F graded. Mirrors the Madurai 3-factor composite (Chennai uses 5 factors but Bengaluru's drainage / sewerage / flood-hazard layers don't exist publicly yet):", ta: "வார்டுக்கு 3-காரணி எடைபோட்ட சதவீத மதிப்பெண், A-F தரம். மதுரை 3-காரணி கூட்டை பிரதிபலிக்கிறது (சென்னை 5 காரணிகளைப் பயன்படுத்துகிறது ஆனால் பெங்களூரின் வடிகால் / கழிவுநீர் / வெள்ள-ஆபத்து அடுக்குகள் இன்னும் பொதுவில் இல்லை):", kn: "ವಾರ್ಡ್‌ಗೆ 3-ಅಂಶ ತೂಕದ ಶತಮಾನಕ ಸ್ಕೋರ್, A-F ಶ್ರೇಣಿ. ಮಧುರೈನ 3-ಅಂಶ ಸಂಯೋಜನೆಯನ್ನು ಪ್ರತಿಬಿಂಬಿಸುತ್ತದೆ (ಚೆನ್ನೈ 5 ಅಂಶಗಳನ್ನು ಬಳಸುತ್ತದೆ ಆದರೆ ಬೆಂಗಳೂರಿನ ಒಳಚರಂಡಿ / ಚರಂಡಿ / ಪ್ರವಾಹ-ಅಪಾಯ ಲೇಯರ್‌ಗಳು ಇನ್ನೂ ಸಾರ್ವಜನಿಕವಾಗಿಲ್ಲ):" },
    factor1: { en: "GW block exploitation (50%) - the ward's parent CGWB block's draft-vs-recharge percentage; higher = higher risk.", ta: "நிலத்தடி நீர் தொகுதி சுரண்டல் (50%) - வார்டின் பெற்றோர் CGWB தொகுதியின் எடுப்பு-vs-நிரப்புதல் சதவீதம்; அதிகம் = அதிக ஆபத்து.", kn: "ಅಂತರ್ಜಲ ಬ್ಲಾಕ್ ಶೋಷಣೆ (50%) - ವಾರ್ಡ್‌ನ ಪೋಷಕ CGWB ಬ್ಲಾಕ್‌ನ ಬಳಕೆ-vs-ಮರುಪೂರಣ ಶೇಕಡಾವಾರು; ಹೆಚ್ಚು = ಹೆಚ್ಚಿನ ಅಪಾಯ." },
    factor2: { en: "Water-body density (20%) - kere per sq km within the ward; denser = lower risk.", ta: "நீர்நிலை அடர்த்தி (20%) - வார்டுக்குள் சதுர கி.மீ.க்கு கேரே; அடர்த்தியானது = குறைந்த ஆபத்து.", kn: "ಜಲಮೂಲ ಸಾಂದ್ರತೆ (20%) - ವಾರ್ಡ್ ಒಳಗೆ ಪ್ರತಿ ಚ.ಕಿ.ಮೀ.ಗೆ ಕೆರೆ; ಸಾಂದ್ರ = ಕಡಿಮೆ ಅಪಾಯ." },
    factor3: { en: "Water-body health (30%) - mean restoration-priority score within 3 km; higher priority = sicker tanks = higher risk.", ta: "நீர்நிலை ஆரோக்கியம் (30%) - 3 கி.மீ.க்குள் சராசரி மறுசீரமைப்பு-முன்னுரிமை மதிப்பெண்; உயர் முன்னுரிமை = நோய்வாய்ப்பட்ட தடாகங்கள் = அதிக ஆபத்து.", kn: "ಜಲಮೂಲ ಆರೋಗ್ಯ (30%) - 3 ಕಿಮೀ ಒಳಗೆ ಸರಾಸರಿ ಪುನರ್ನಿರ್ಮಾಣ-ಆದ್ಯತೆ ಸ್ಕೋರ್; ಹೆಚ್ಚಿನ ಆದ್ಯತೆ = ಅನಾರೋಗ್ಯಕರ ಕೆರೆಗಳು = ಹೆಚ್ಚಿನ ಅಪಾಯ." },
    composite_caveat: { en: "Each factor is converted to a city-wide percentile (0=best, 100=highest risk), weighted, summed. Composite ≤20 = A, ≤40 = B, ≤60 = C, ≤80 = D, >80 = F. With all six blocks at >100% exploitation, the GW factor saturates most wards near the high end - the city-wide picture is fundamentally bleak.", ta: "ஒவ்வொரு காரணியும் நகர-வாரியான சதவீதமாக மாற்றப்படுகிறது (0=சிறந்தது, 100=மிக அதிக ஆபத்து), எடைபோடப்பட்டு, கூட்டப்படுகிறது. அனைத்து ஆறு தொகுதிகளும் >100% சுரண்டலில் இருப்பதால், GW காரணி பெரும்பாலான வார்டுகளை உயர் முடிவில் நிறைவுபடுத்துகிறது.", kn: "ಪ್ರತಿ ಅಂಶವನ್ನು ನಗರ-ವ್ಯಾಪ್ತಿಯ ಶತಮಾನಕಕ್ಕೆ ಪರಿವರ್ತಿಸಲಾಗಿದೆ (0=ಉತ್ತಮ, 100=ಅತಿ ಹೆಚ್ಚಿನ ಅಪಾಯ), ತೂಕ, ಒಟ್ಟುಗೂಡಿಸಲಾಗಿದೆ. ಸಂಯೋಜನೆ ≤20 = A, ≤40 = B, ≤60 = C, ≤80 = D, >80 = F. ಎಲ್ಲಾ ಆರು ಬ್ಲಾಕ್‌ಗಳು >100% ಶೋಷಣೆಯಲ್ಲಿರುವುದರಿಂದ, GW ಅಂಶ ಹೆಚ್ಚಿನ ವಾರ್ಡ್‌ಗಳನ್ನು ಉನ್ನತ ಮಟ್ಟದಲ್ಲಿ ಸ್ಯಾಚುರೇಟ್ ಮಾಡುತ್ತದೆ - ನಗರ-ವ್ಯಾಪ್ತಿಯ ಚಿತ್ರ ಮೂಲಭೂತವಾಗಿ ಕಠೋರ." },
  },
  wb: {
    title: { en: "Water bodies", ta: "நீர்நிலைகள்", kn: "ಜಲಮೂಲಗಳು" },
    p1: { en: "1,897 OpenStreetMap-traced water-body polygons across BBMP. Click any polygon for its tags + restoration-priority score. Fourteen flagship lakes carry the full deep-zoom rich-data panel (boundary + 1 km halo + 37-year imagery slider + JRC water-loss tint + Dynamic World water + built-gain tint + Open Buildings v3 + Overture Maps Q1 2026 stats + curated timeline + sources modal): Bellandur, Varthur, Madivala, Ulsoor, Hebbal, Sankey, Yelahanka, Kempambudhi, Hesaraghatta, Agara, Puttenahalli, Jakkur, Rachenahalli, Iblur.", ta: "BBMP முழுவதும் 1,897 OpenStreetMap-கண்காணித்த நீர்நிலை பல்கோணங்கள். எந்த பல்கோணத்தையும் கிளிக் செய்து அதன் குறிச்சொற்கள் + மறுசீரமைப்பு-முன்னுரிமை மதிப்பெண்.", kn: "BBMP ಆದ್ಯಂತ 1,897 OpenStreetMap-ಟ್ರೇಸ್ ಮಾಡಿದ ಜಲಮೂಲ ಬಹುಭುಜಗಳು. ಯಾವುದೇ ಬಹುಭುಜವನ್ನು ಅದರ ಟ್ಯಾಗ್‌ಗಳು + ಪುನರ್ನಿರ್ಮಾಣ-ಆದ್ಯತೆ ಸ್ಕೋರ್‌ಗಾಗಿ ಕ್ಲಿಕ್ ಮಾಡಿ. ಹದಿನಾಲ್ಕು ಪ್ರಮುಖ ಕೆರೆಗಳು ಪೂರ್ಣ ಆಳ-ಜೂಮ್ ಶ್ರೀಮಂತ-ದತ್ತಾಂಶ ಪ್ಯಾನಲ್ ಅನ್ನು ಒಯ್ಯುತ್ತವೆ: ಬೆಲ್ಲಂದೂರು, ವರ್ತೂರು, ಮಡಿವಾಳ, ಉಲ್ಸೂರ್, ಹೆಬ್ಬಾಳ, ಸ್ಯಾಂಕಿ, ಯಲಹಂಕ, ಕೆಂಪಾಂಬುಧಿ, ಹೆಸರಘಟ್ಟ, ಆಗರ, ಪುಟ್ಟೇನಹಳ್ಳಿ, ಜಕ್ಕೂರು, ರಾಚೇನಹಳ್ಳಿ, ಇಬ್ಲೂರ್." },
    h_lost: { en: "Lost-narrative overlay", ta: "இழந்த-கதை அடுக்கு", kn: "ಕಳೆದ-ಕಥನ ಲೇಯರ್" },
    p2: { en: "Beyond the OSM-current polygons, the page surfaces a curated inventory of fully-lost and severely-reduced Kempegowda-era kere, anchored on Harini Nagendra's Nature in the City: Bengaluru (OUP 2016). Dharmambudhi (drained for the Majestic bus stand), Sampangi (Sri Kanteerava stadium), Karanji Anjaneya (Bishop Cotton playing fields), Akkithimmanahalli (hockey stadium), Domlur (BDA layout), and severely-reduced bodies like Kempambudhi, Halsoor (Ulsoor), and Sankey carry their conversion stories in click-through tooltips.", ta: "OSM-தற்போதைய பல்கோணங்களுக்கு அப்பால், பக்கம் முழுமையாக-இழந்த மற்றும் கடுமையாக-குறைந்த கெம்பேகௌடா-கால கேரேயின் தொகுக்கப்பட்ட பட்டியலை வெளிப்படுத்துகிறது.", kn: "OSM-ಪ್ರಸ್ತುತ ಬಹುಭುಜಗಳಿಗೆ ಮೀರಿ, ಪುಟ ಸಂಪೂರ್ಣ-ಕಳೆದ ಮತ್ತು ತೀವ್ರ-ಕುಗ್ಗಿದ ಕೆಂಪೇಗೌಡ-ಯುಗದ ಕೆರೆಗಳ ಸಂಗ್ರಹಿಸಿದ ದಾಸ್ತಾನನ್ನು ತೋರಿಸುತ್ತದೆ, ಹರಿಣಿ ನಾಗೇಂದ್ರ ಅವರ Nature in the City: Bengaluru (OUP 2016) ಆಧಾರಿತ. ಧರ್ಮಾಂಬುಧಿ (ಮೆಜೆಸ್ಟಿಕ್ ಬಸ್ ನಿಲ್ದಾಣಕ್ಕೆ ಬರಿದು), ಸಂಪಂಗಿ (ಶ್ರೀ ಕಂಠೀರವ ಕ್ರೀಡಾಂಗಣ), ಕರಂಜಿ ಆಂಜನೇಯ, ಅಕ್ಕಿತಿಮ್ಮನಹಳ್ಳಿ (ಹಾಕಿ ಕ್ರೀಡಾಂಗಣ), ದೊಮ್ಲೂರು (BDA ಬಡಾವಣೆ), ಮತ್ತು ಕೆಂಪಾಂಬುಧಿ, ಹಲ್ಸೂರ್ (ಉಲ್ಸೂರ್), ಸ್ಯಾಂಕಿಯಂತಹ ತೀವ್ರ-ಕುಗ್ಗಿದ ಮೂಲಗಳು ಕ್ಲಿಕ್-ತ್ರೂ ಟೂಲ್‌ಟಿಪ್‌ಗಳಲ್ಲಿ ತಮ್ಮ ಪರಿವರ್ತನೆ ಕಥೆಗಳನ್ನು ಒಯ್ಯುತ್ತವೆ." },
  },
  rivers: {
    title: "nav.rivers",
    p1: { en: "Bengaluru sits on a ridge that splits into three valleys - Vrishabhavathi west (to Cauvery via Arkavathy), Koramangala-Challaghatta south (the Bellandur-Varthur foam cascade, ultimately to Dakshina Pinakini), and Hebbal-Nagavara north (also to Dakshina Pinakini via the Nagavara channel). The page ships these three named rivers as OSM polylines plus the channels feeding them through the BBMP cascade network.", ta: "பெங்களூரு மூன்று பள்ளத்தாக்குகளாக பிரியும் ஒரு மலையில் உள்ளது - விருஷபாவதி மேற்கு, கோரமங்கலா-சல்லகட்டா தெற்கு, மற்றும் ஹெப்பல்-நாகவாரா வடக்கு.", kn: "ಬೆಂಗಳೂರು ಮೂರು ಕಣಿವೆಗಳಿಗೆ ವಿಭಜನೆಯಾಗುವ ಬೆಟ್ಟದ ಮೇಲೆ ಕುಳಿತಿದೆ - ವೃಷಭಾವತಿ ಪಶ್ಚಿಮ (ಅರ್ಕಾವತಿ ಮೂಲಕ ಕಾವೇರಿಗೆ), ಕೋರಮಂಗಲ-ಚಲ್ಲಘಟ್ಟ ದಕ್ಷಿಣ (ಬೆಲ್ಲಂದೂರು-ವರ್ತೂರು ಫೋಮ್ ಸರಪಳಿ, ಅಂತಿಮವಾಗಿ ದಕ್ಷಿಣ ಪಿನಾಕಿನಿಗೆ), ಮತ್ತು ಹೆಬ್ಬಾಳ-ನಾಗವಾರ ಉತ್ತರ. ಪುಟ ಈ ಮೂರು ಹೆಸರಿಸಲಾದ ನದಿಗಳನ್ನು OSM ಪಾಲಿಲೈನ್‌ಗಳಾಗಿ ಮತ್ತು BBMP ಸರಪಳಿ ಜಾಲದ ಮೂಲಕ ಅವುಗಳಿಗೆ ಪೋಷಿಸುವ ಚಾನೆಲ್‌ಗಳನ್ನು ತೋರಿಸುತ್ತದೆ." },
    h_stations: { en: "KSPCB monitoring stations", ta: "KSPCB கண்காணிப்பு நிலையங்கள்", kn: "KSPCB ಮೇಲ್ವಿಚಾರಣಾ ನಿಲ್ದಾಣಗಳು" },
    p2: { en: "9 monitoring stations across the three rivers, sourced from KSPCB's monthly water quality reports cross-referenced with CPCB's National Water Monitoring Programme. Per-station readings cover BOD, COD, DO, pH and coliform counts. Markers are colour-coded by latest BOD: red above 6 mg/L, amber above 3, green at or below 3. The Vrishabhavathi and K&C downstream stations consistently show severe-pollution readings; this is the empirical record behind the foam-and-fire narrative on Bellandur and Varthur.", ta: "மூன்று ஆறுகள் முழுவதும் 9 கண்காணிப்பு நிலையங்கள், KSPCB-ன் மாதாந்திர நீர் தர அறிக்கைகளில் இருந்து பெறப்பட்டது.", kn: "ಮೂರು ನದಿಗಳಾದ್ಯಂತ 9 ಮೇಲ್ವಿಚಾರಣಾ ನಿಲ್ದಾಣಗಳು, KSPCB ಯ ಮಾಸಿಕ ನೀರಿನ ಗುಣಮಟ್ಟ ವರದಿಗಳಿಂದ ಪಡೆಯಲಾಗಿದೆ, CPCB ಯ ರಾಷ್ಟ್ರೀಯ ನೀರಿನ ಮೇಲ್ವಿಚಾರಣಾ ಕಾರ್ಯಕ್ರಮದೊಂದಿಗೆ ಅಡ್ಡ-ಉಲ್ಲೇಖಿಸಲಾಗಿದೆ. ಪ್ರತಿ-ನಿಲ್ದಾಣದ ಮಾಪನಗಳು BOD, COD, DO, pH ಮತ್ತು ಕೋಲಿಫಾರ್ಮ್ ಎಣಿಕೆಗಳನ್ನು ಒಳಗೊಂಡಿವೆ. ಮಾರ್ಕರ್‌ಗಳು ಇತ್ತೀಚಿನ BOD ಮೂಲಕ ಬಣ್ಣ-ಕೋಡ್ ಮಾಡಲಾಗಿದೆ. ವೃಷಭಾವತಿ ಮತ್ತು K&C ಕೆಳಭಾಗದ ನಿಲ್ದಾಣಗಳು ಸ್ಥಿರವಾಗಿ ಗಂಭೀರ-ಮಾಲಿನ್ಯ ಮಾಪನಗಳನ್ನು ತೋರಿಸುತ್ತವೆ; ಇದು ಬೆಲ್ಲಂದೂರು ಮತ್ತು ವರ್ತೂರಿನ ಫೋಮ್-ಮತ್ತು-ಬೆಂಕಿ ಕಥನದ ಹಿಂದಿನ ಪ್ರಾಯೋಗಿಕ ದಾಖಲೆ." },
    h_events: { en: "River events log", ta: "ஆற்று நிகழ்வுகள் பதிவு", kn: "ನದಿ ಘಟನೆಗಳ ಲಾಗ್" },
    p3: { en: "12 hand-curated event entries: the foam crises and fires (16 Feb 2017 Bellandur burns, January 2018 second fire, recurring post-monsoon 2024 events), the NGT Forward Foundation order (OA 222/2014, 75 m / 50 m / 30 m buffer regime), Karnataka Lokayukta's 2011 lake-encroachment report, BDA restoration tenders (Bellandur-Varthur joint tender 2020).", ta: "12 கையால்-தொகுக்கப்பட்ட நிகழ்வு உள்ளீடுகள்: நுரை நெருக்கடிகள் மற்றும் தீ, NGT Forward Foundation உத்தரவு, கர்நாடகா லோக்காயுக்தாவின் 2011 ஏரி-ஆக்கிரமிப்பு அறிக்கை, BDA மறுசீரமைப்பு டெண்டர்கள்.", kn: "12 ಕೈಯಿಂದ-ಸಂಗ್ರಹಿಸಿದ ಘಟನೆ ನಮೂದುಗಳು: ಫೋಮ್ ಬಿಕ್ಕಟ್ಟುಗಳು ಮತ್ತು ಬೆಂಕಿಗಳು (16 ಫೆಬ್ 2017 ಬೆಲ್ಲಂದೂರು ಸುಡುತ್ತದೆ, ಜನವರಿ 2018 ಎರಡನೇ ಬೆಂಕಿ, ಮುಂಗಾರು-ನಂತರ 2024 ಪುನರಾವರ್ತಿತ ಘಟನೆಗಳು), NGT Forward Foundation ಆದೇಶ (OA 222/2014), ಕರ್ನಾಟಕ ಲೋಕಾಯುಕ್ತದ 2011 ಕೆರೆ-ಒತ್ತುವರಿ ವರದಿ, BDA ಪುನರ್ನಿರ್ಮಾಣ ಟೆಂಡರ್‌ಗಳು." },
    h_industry: { en: "Industrial pollution sources", ta: "தொழில்துறை மாசு ஆதாரங்கள்", kn: "ಕೈಗಾರಿಕಾ ಮಾಲಿನ್ಯ ಮೂಲಗಳು" },
    p4: { en: "14 industrial clusters mapped as type-coloured markers across the three valleys: Peenya industrial estate, Bommasandra, Yelahanka, Mahadevapura, Whitefield, Bidadi, Doddaballapur, plus textile-dyeing / electroplating / tannery clusters that feed the Vrishabhavathi and K&C catchments. Compiled from KIADB records, KSPCB consent-to-operate filings, and IISc CES (T.V. Ramachandra) academic surveys.", ta: "மூன்று பள்ளத்தாக்குகள் முழுவதும் வகை-வண்ண மார்க்கர்களாக வரைபடப்படுத்தப்பட்ட 14 தொழில்துறை கொத்துகள்: பீன்யா, பொம்மசந்திரா, யேலஹங்கா, மகாதேவபுரா, வைட்ஃபீல்ட், பிடாடி, தொடபல்லாபூர், மற்றும் ஜவுளி-சாயமிடல் / மின்முலாம் / தோல்பதனிடல் கொத்துகள்.", kn: "ಮೂರು ಕಣಿವೆಗಳಾದ್ಯಂತ ಪ್ರಕಾರ-ಬಣ್ಣದ ಮಾರ್ಕರ್‌ಗಳಾಗಿ ನಕ್ಷೆ ಮಾಡಲಾದ 14 ಕೈಗಾರಿಕಾ ಸಮೂಹಗಳು: ಪೀಣ್ಯ ಕೈಗಾರಿಕಾ ಎಸ್ಟೇಟ್, ಬೊಮ್ಮಸಂದ್ರ, ಯಲಹಂಕ, ಮಹದೇವಪುರ, ವೈಟ್‌ಫೀಲ್ಡ್, ಬಿಡದಿ, ದೊಡ್ಡಬಳ್ಳಾಪುರ, ಜೊತೆಗೆ ವೃಷಭಾವತಿ ಮತ್ತು K&C ಜಲಾನಯನಗಳಿಗೆ ಪೋಷಿಸುವ ಜವಳಿ-ಬಣ್ಣದ / ಎಲೆಕ್ಟ್ರೋಪ್ಲೇಟಿಂಗ್ / ಚರ್ಮ ಸಮೂಹಗಳು. KIADB ದಾಖಲೆಗಳು, KSPCB ಕಾರ್ಯಾಚರಣಾ ಸಮ್ಮತಿ ಸಲ್ಲಿಕೆಗಳು, ಮತ್ತು IISc CES (T.V. ರಾಮಚಂದ್ರ) ಶೈಕ್ಷಣಿಕ ಸಮೀಕ್ಷೆಗಳಿಂದ ಸಂಕಲಿಸಲಾಗಿದೆ." },
    gap_title: { en: "Basin data we don't have yet", ta: "இன்னும் கிடைக்காத படுகை தரவுகள்", kn: "ಇನ್ನೂ ಲಭ್ಯವಿಲ್ಲದ ಜಲಾನಯನ ದತ್ತಾಂಶ" },
    gap_body: { en: "Three things the Arkavathi basin deep dive still cannot show. (1) A precise drain-by-drain trace - which drain carries which discharge to the polluted stretch - needs flow-direction data the drainage network doesn't carry; the map shows the adjacent units plus the upstream V-Valley clusters as a spatial estimate. (2) Per-year sewage and solid-waste series for BBMP/Yelahanka, Magadi and Harohalli need the relevant District Environment Plans (2021 baseline plus a 2024-25 refresh). (3) The BWSSB order permitting apartments to sell treated water is still not in the public record - Paani Earth's RTI is pending. The companion RTI on the KSPCB OCEMS memo was answered in July 2026, confirming the 500 KLD threshold cited on the basin page.", ta: "அர்காவதி படுகை ஆழ்பார்வையில் இன்னும் காட்ட இயலாதவை: (1) எந்த வடிகால் எந்த கழிவை எடுத்துச் செல்கிறது என்ற துல்லியமான தடம்; (2) BBMP/யேலஹங்கா, மகடி, ஹரோஹள்ளிக்கான ஆண்டுவாரி கழிவுநீர் / திடக்கழிவு தொடர்கள்; (3) சுத்திகரிக்கப்பட்ட நீர் விற்பனை குறித்த BWSSB ஆணை இன்னும் பொதுவெளியில் இல்லை - Paani Earth தாக்கல் செய்த RTI நிலுவையில் உள்ளது. KSPCB OCEMS குறிப்பாணை குறித்த RTI-க்கு ஜூலை 2026-இல் பதில் கிடைத்தது (500 KLD வரம்பு உறுதி).", kn: "ಅರ್ಕಾವತಿ ಜಲಾನಯನ ಆಳ-ನೋಟದಲ್ಲಿ ಇನ್ನೂ ತೋರಿಸಲಾಗದವು: (1) ಯಾವ ಚರಂಡಿ ಯಾವ ವಿಸರ್ಜನೆಯನ್ನು ಹೊತ್ತೊಯ್ಯುತ್ತದೆ ಎಂಬ ನಿಖರ ಜಾಡು; (2) BBMP/ಯಲಹಂಕ, ಮಾಗಡಿ, ಹಾರೋಹಳ್ಳಿಗಾಗಿ ವಾರ್ಷಿಕ ಒಳಚರಂಡಿ / ಘನತ್ಯಾಜ್ಯ ಸರಣಿಗಳು; (3) ಸಂಸ್ಕರಿಸಿದ ನೀರಿನ ಮಾರಾಟದ BWSSB ಆದೇಶ ಇನ್ನೂ ಸಾರ್ವಜನಿಕ ದಾಖಲೆಯಲ್ಲಿ ಇಲ್ಲ - Paani Earth ಸಲ್ಲಿಸಿದ RTI ಬಾಕಿ ಇದೆ. KSPCB OCEMS ಮೆಮೊ ಕುರಿತ RTIಗೆ ಜುಲೈ 2026ರಲ್ಲಿ ಉತ್ತರ ಬಂದಿದೆ (500 KLD ಮಿತಿ ದೃಢ)." },
  },
  flood: {
    title: "flood.badge_scope",
    p1: { en: "Narrative-only stub. Hazard-zone polygons (5/10/25/50/100/200-year return periods), historical flood-hotspot layers, stormwater-drain GeoJSON, and sewerage overlays for Bengaluru aren't published publicly (in contrast with Chennai's OpenCity-published layers). The page surfaces the rajakaluve (storm-drain) network from BWSSB's GIS extract and notes the recurring 2022 / 2024 outer-ring-road inundation (Whitefield / Sarjapur / ORR-East) tied to encroached rajakaluves and Bellandur-Varthur overflow.", ta: "கதை-மட்டும் குச்சு. பெங்களூருக்கான ஆபத்து-மண்டலம் பல்கோணங்கள், வரலாற்று வெள்ள-ஹாட்ஸ்பாட் அடுக்குகள், மழைநீர்-வடிகால் GeoJSON, மற்றும் கழிவுநீர் அடுக்குகள் பொதுவில் வெளியிடப்படவில்லை.", kn: "ಕಥನ-ಮಾತ್ರ ಸ್ಟಬ್. ಬೆಂಗಳೂರಿಗೆ ಅಪಾಯ-ವಲಯ ಬಹುಭುಜಗಳು (5/10/25/50/100/200-ವರ್ಷ ಮರಳುವ ಅವಧಿಗಳು), ಐತಿಹಾಸಿಕ ಪ್ರವಾಹ-ಹಾಟ್‌ಸ್ಪಾಟ್ ಲೇಯರ್‌ಗಳು, ಮಳೆನೀರು-ಚರಂಡಿ GeoJSON, ಮತ್ತು ಚರಂಡಿ ಲೇಯರ್‌ಗಳು ಸಾರ್ವಜನಿಕವಾಗಿ ಪ್ರಕಟವಾಗಿಲ್ಲ. ಪುಟ BWSSB ಯ GIS ಸಾರದಿಂದ ರಾಜಕಲುವೆ (ಮಳೆ-ಚರಂಡಿ) ಜಾಲವನ್ನು ತೋರಿಸುತ್ತದೆ ಮತ್ತು ಒತ್ತುವರಿಯಾದ ರಾಜಕಲುವೆಗಳು ಮತ್ತು ಬೆಲ್ಲಂದೂರು-ವರ್ತೂರು ಉಕ್ಕುವಿಕೆಗೆ ಸಂಬಂಧಿಸಿದ ಪುನರಾವರ್ತಿತ 2022 / 2024 ಔಟರ್-ರಿಂಗ್-ರೋಡ್ ಮುಳುಗುವಿಕೆಯನ್ನು (ವೈಟ್‌ಫೀಲ್ಡ್ / ಸರ್ಜಾಪುರ / ORR-ಪೂರ್ವ) ಗಮನಿಸುತ್ತದೆ." },
  },
  myward: {
    title: { en: "My Ward / Report Card", ta: "என் வார்டு / அறிக்கை அட்டை", kn: "ನನ್ನ ವಾರ್ಡ್ / ವರದಿ ಪತ್ರ" },
    p1: { en: "Ward-boundary map for the GBA's 369-ward post-15-May-2025 delimitation (notified 19 Nov 2025), spread across 5 City Corporations. Click a ward to see corporation, area, centroid, the parent CGWB block's exploitation percentage, and a link into the per-ward risk panel.", ta: "GBA-வின் 369-வார்டு 15-மே-2025-க்குப் பிறகான வரம்பு (19 நவ 2025 அறிவிக்கப்பட்டது), 5 நகர மாநகராட்சிகளில் பரவியுள்ளது. ஒரு வார்டை கிளிக் செய்து மாநகராட்சி, பகுதி, மையம், பெற்றோர் CGWB தொகுதியின் சுரண்டல் சதவீதம், மற்றும் வார்டுக்கான ஆபத்து பேனலுக்கான இணைப்பு பார்க்க.", kn: "GBA ಯ 369-ವಾರ್ಡ್ 15-ಮೇ-2025 ನಂತರದ ಗಡಿನಿರ್ಣಯಕ್ಕೆ (19 ನವೆಂಬರ್ 2025 ಸೂಚಿಸಲಾಗಿದೆ) ವಾರ್ಡ್-ಗಡಿ ನಕ್ಷೆ, 5 ನಗರ ನಿಗಮಗಳಾದ್ಯಂತ ಹರಡಿಕೊಂಡಿದೆ. ನಿಗಮ, ಪ್ರದೇಶ, ಕೇಂದ್ರ, ಪೋಷಕ CGWB ಬ್ಲಾಕ್‌ನ ಶೋಷಣಾ ಶೇಕಡಾವಾರು, ಮತ್ತು ಪ್ರತಿ-ವಾರ್ಡ್ ಅಪಾಯ ಪ್ಯಾನಲ್‌ಗೆ ಲಿಂಕ್ ನೋಡಲು ವಾರ್ಡ್ ಅನ್ನು ಕ್ಲಿಕ್ ಮಾಡಿ." },
    h_risk_panel: { en: "Per-ward risk panel", ta: "வார்டுக்கான ஆபத்து பேனல்", kn: "ಪ್ರತಿ-ವಾರ್ಡ್ ಅಪಾಯ ಪ್ಯಾನಲ್" },
    p2: { en: "Each ward shows its 3-factor risk composite (described above under Groundwater), the A-F grade, the ward's rank within the city, and a per-factor breakdown. Without a specific ward selected, the page renders an index grouping ward chips by grade so you can jump straight to the worst-graded wards.", ta: "ஒவ்வொரு வார்டும் அதன் 3-காரணி ஆபத்து கூட்டு, A-F தரம், நகரத்தில் வார்டின் தரவரிசை, மற்றும் காரணி-வாரியான பகுப்பாய்வு காட்டுகிறது.", kn: "ಪ್ರತಿ ವಾರ್ಡ್ ತನ್ನ 3-ಅಂಶ ಅಪಾಯ ಸಂಯೋಜನೆ (ಮೇಲೆ ಅಂತರ್ಜಲದ ಅಡಿಯಲ್ಲಿ ವಿವರಿಸಲಾಗಿದೆ), A-F ಶ್ರೇಣಿ, ನಗರದೊಳಗೆ ವಾರ್ಡ್‌ನ ಶ್ರೇಯಾಂಕ, ಮತ್ತು ಪ್ರತಿ-ಅಂಶ ವಿಶ್ಲೇಷಣೆಯನ್ನು ತೋರಿಸುತ್ತದೆ. ನಿರ್ದಿಷ್ಟ ವಾರ್ಡ್ ಆಯ್ಕೆ ಮಾಡದಿದ್ದರೆ, ಪುಟ ಶ್ರೇಣಿಯಿಂದ ವಾರ್ಡ್ ಚಿಪ್‌ಗಳನ್ನು ಗುಂಪು ಮಾಡುವ ಸೂಚಿಯನ್ನು ತೋರಿಸುತ್ತದೆ ಆದ್ದರಿಂದ ನೀವು ನೇರವಾಗಿ ಕೆಟ್ಟ-ಶ್ರೇಣಿಯ ವಾರ್ಡ್‌ಗಳಿಗೆ ಜಿಗಿಯಬಹುದು." },
    caveat: { en: "Bengaluru's report card is intentionally slimmer than Chennai's. Chennai ships a 5-factor composite plus an uplift-planner cost matrix; the costing layer is out of scope here because the underlying drainage and flood-hazard layers aren't published for Bengaluru.", ta: "பெங்களூருவின் அறிக்கை அட்டை சென்னையை விட வேண்டுமென்றே மெலிதானது. சென்னை 5-காரணி கூட்டை அனுப்புகிறது; செலவு அடுக்கு இங்கே வரம்பிற்கு வெளியே ஏனெனில் அடிப்படை வடிகால் மற்றும் வெள்ள-ஆபத்து அடுக்குகள் பெங்களூருக்கு வெளியிடப்படவில்லை.", kn: "ಬೆಂಗಳೂರಿನ ವರದಿ ಪತ್ರ ಚೆನ್ನೈಗಿಂತ ಉದ್ದೇಶಪೂರ್ವಕವಾಗಿ ತೆಳುವಾಗಿದೆ. ಚೆನ್ನೈ 5-ಅಂಶ ಸಂಯೋಜನೆ ಮತ್ತು ಉನ್ನತಿ-ಯೋಜಕ ವೆಚ್ಚ ಮ್ಯಾಟ್ರಿಕ್ಸ್ ಅನ್ನು ಒಯ್ಯುತ್ತದೆ; ಬೆಂಗಳೂರಿಗೆ ಆಧಾರ ಒಳಚರಂಡಿ ಮತ್ತು ಪ್ರವಾಹ-ಅಪಾಯ ಲೇಯರ್‌ಗಳು ಪ್ರಕಟವಾಗದ ಕಾರಣ ವೆಚ್ಚ ಲೇಯರ್ ಇಲ್ಲಿ ವ್ಯಾಪ್ತಿಯಿಂದ ಹೊರಗಿದೆ." },
  },
  facts: {
    title: { en: "Water facts", ta: "நீர் உண்மைகள்", kn: "ನೀರಿನ ಸತ್ಯಗಳು" },
    p1: { en: "Journalist-ready quotable stats grouped by freshness tier - live (this season), derived (last 12 months), historical (documented), and heritage (pre-modern). Today {city} ships ~32 hand-curated facts spanning the BWSSB 2026 supply numbers (2,293 MLD installed / ~1,500 delivered, 95 km transmission, 36% NRW, ~14M served), the CGWB GEC findings (all 6 blocks Over-Exploited since 2011, Bangalore-East at 395% in 2025-26), the IISc 65 stress-ward count, the foam-and-fire chronology (16 Feb 2017 Bellandur burns), the cohort-level water-loss numbers (Hesaraghatta 369.5 ha lost), the restoration-recovery numbers (Puttenahalli body water +50 pp, Jakkur engineered-wetland model), Heritage anchors (1537 Kempegowda founding, 1882 Sankey, 1894 Hesaraghatta), and the GBA 369-ward administration baseline.", ta: "புதுமை அடுக்கால் தொகுக்கப்பட்ட பத்திரிக்கையாளர்-தயார் மேற்கோள் புள்ளிவிவரங்கள் - நேரடி, பெறப்பட்டது, வரலாற்று, மற்றும் பாரம்பரியம்.", kn: "ತಾಜಾತನ ಹಂತದಿಂದ ಗುಂಪು ಮಾಡಲಾದ ಪತ್ರಕರ್ತ-ಸಿದ್ಧ ಉಲ್ಲೇಖಿಸಬಹುದಾದ ಅಂಕಿಅಂಶಗಳು - ನೇರ (ಈ ಋತು), ಪಡೆದ (ಕಳೆದ 12 ತಿಂಗಳುಗಳು), ಐತಿಹಾಸಿಕ (ದಾಖಲಿತ), ಮತ್ತು ಪರಂಪರೆ (ಆಧುನಿಕ-ಪೂರ್ವ). ಇಂದು {city} JICA Phase 3 ಮೂಲಸೌಕರ್ಯ ಸಂಖ್ಯೆಗಳು, CGWB GEC ಸಂಶೋಧನೆಗಳು, IISc 65 ಒತ್ತಡ-ವಾರ್ಡ್ ಎಣಿಕೆ, ಫೋಮ್-ಮತ್ತು-ಬೆಂಕಿ ಕಾಲಾನುಕ್ರಮ, ಮತ್ತು GBA 369-ವಾರ್ಡ್ ಆಡಳಿತ ಆಧಾರಶಿಲೆಯನ್ನು ವ್ಯಾಪಿಸುವ ~32 ಕೈಯಿಂದ-ಸಂಗ್ರಹಿಸಿದ ಸತ್ಯಗಳನ್ನು ಒಯ್ಯುತ್ತದೆ." },
  },
  origins: {
    title: { en: "Origins (long-read)", ta: "தோற்றம் (நீளக் கட்டுரை)", kn: "ಮೂಲಗಳು (ದೀರ್ಘ-ಓದು)" },
    p1: { en: "A 4-chapter long-read covers the Kempegowda founding (1537) → Cantonment + Hesaraghatta (1882 / 1894) → Cauvery stages (1974 → 2024) → today's parallel water economy (tankers + over-extracted borewells + IISc-flagged stress wards). 11 named sources anchor the narrative including Nagendra's Nature in the City, the JICA Phase 3 Final Report, IISc Groundwater Outlook, NGT Forward Foundation v Karnataka, and Forward Foundation / Friends of Lakes citizen-group accounts. Replaces a Chennai-style runtime LLM CityStory with a hand-edited historical narrative.", ta: "4-அத்தியாய நீளக் கட்டுரை கெம்பேகௌடா நிறுவல் (1537) → Cantonment + ஹேசராகட்டா (1882 / 1894) → காவிரி நிலைகள் (1974 → 2024) → இன்றைய இணை நீர் பொருளாதாரம் (டேங்கர்கள் + அதிக-எடுக்கப்பட்ட ஆழ்துளைக் கிணறுகள் + IISc-அடையாளம் காட்டப்பட்ட அழுத்த வார்டுகள்) ஆகியவற்றை உள்ளடக்குகிறது.", kn: "4-ಅಧ್ಯಾಯ ದೀರ್ಘ-ಓದು ಕೆಂಪೇಗೌಡ ಸ್ಥಾಪನೆ (1537) → ಕ್ಯಾಂಟೋನ್‌ಮೆಂಟ್ + ಹೆಸರಘಟ್ಟ (1882 / 1894) → ಕಾವೇರಿ ಹಂತಗಳು (1974 → 2024) → ಇಂದಿನ ಸಮಾನಾಂತರ ಜಲ ಆರ್ಥಿಕತೆ (ಟ್ಯಾಂಕರ್‌ಗಳು + ಅತಿ-ಎತ್ತಲ್ಪಟ್ಟ ಬೋರ್‌ವೆಲ್‌ಗಳು + IISc-ಗುರುತಿಸಿದ ಒತ್ತಡ ವಾರ್ಡ್‌ಗಳು) ಅನ್ನು ಒಳಗೊಂಡಿದೆ. ಕಥನವನ್ನು ನಾಗೇಂದ್ರ ಅವರ Nature in the City, JICA Phase 3 ಅಂತಿಮ ವರದಿ, IISc ಅಂತರ್ಜಲ ಔಟ್‌ಲುಕ್, NGT Forward Foundation v ಕರ್ನಾಟಕ, ಮತ್ತು Forward Foundation / Friends of Lakes ನಾಗರಿಕ-ಗುಂಪು ಖಾತೆಗಳು ಸೇರಿದಂತೆ 11 ಹೆಸರಿಸಲಾದ ಮೂಲಗಳು ಆಧರಿಸಿವೆ." },
  },
};

export function BangalorePageDescriptions({ cityId, cityName }: CityPagesProps) {
  const { t } = useLanguage();
  const tf = (x: I18nText) => tFmt(t(x), { city: cityName });

  return (
    <>
      <SubSection id="page-dashboard" title={t(C.dashboard.title)}>
        <p className="text-slate-600 dark:text-slate-400">{tf(C.dashboard.p1)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.dashboard.h_cauvery)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.dashboard.p2)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.dashboard.h_basin)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.dashboard.p3)}</p>
      </SubSection>

      <SubSection id="page-tanker" title={t(C.tanker.title)}>
        <p className="text-slate-600 dark:text-slate-400">{t(C.tanker.p1)}</p>
      </SubSection>

      <SubSection id="page-groundwater" title={t(C.gw.title)}>
        <p className="text-slate-600 dark:text-slate-400">{tf(C.gw.p1)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
          {t(C.gw.h_block)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.gw.p2)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.gw.h_station)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.gw.p3)}</p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t(C.gw.gap_title)}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t(C.gw.gap_body)}</p>
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.gw.h_composite)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.gw.p_composite_intro)}</p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
          <li>{t(C.gw.factor1)}</li>
          <li>{t(C.gw.factor2)}</li>
          <li>{t(C.gw.factor3)}</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t(C.gw.composite_caveat)}</p>
      </SubSection>

      <SubSection id="page-water-bodies" title={t(C.wb.title)}>
        <p className="text-slate-600 dark:text-slate-400">{t(C.wb.p1)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.wb.h_lost)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.wb.p2)}</p>
      </SubSection>

      <SubSection id="page-rivers" title={t(C.rivers.title)}>
        <p className="text-slate-600 dark:text-slate-400">{t(C.rivers.p1)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.rivers.h_stations)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.rivers.p2)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.rivers.h_events)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.rivers.p3)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.rivers.h_industry)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.rivers.p4)}</p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            {t(C.rivers.gap_title)}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">{t(C.rivers.gap_body)}</p>
        </div>
      </SubSection>

      <SubSection id="page-flood" title={t(C.flood.title)}>
        <p className="text-slate-600 dark:text-slate-400">{t(C.flood.p1)}</p>
      </SubSection>

      <SubSection id="page-my-ward" title={t(C.myward.title)}>
        <p className="text-slate-600 dark:text-slate-400">{t(C.myward.p1)}</p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">
          {t(C.myward.h_risk_panel)}
        </h4>
        <p className="text-slate-600 dark:text-slate-400">{t(C.myward.p2)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">{t(C.myward.caveat)}</p>
      </SubSection>

      <SubSection id="page-facts" title={t(C.facts.title)}>
        <p className="text-slate-600 dark:text-slate-400">{tf(C.facts.p1)}</p>
      </SubSection>

      <SubSection id="page-origins" title={t(C.origins.title)}>
        <p className="text-slate-600 dark:text-slate-400">{t(C.origins.p1)}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          <a
            href={`/${cityId}/origins`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            /{cityId}/origins
          </a>
        </p>
      </SubSection>
    </>
  );
}
