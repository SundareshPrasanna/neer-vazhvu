import type { CityId } from "@/lib/cities/ids";
import type { I18nText } from "@/lib/i18n/translations";

type CalloutId = "stage_v" | "energy" | "gw" | "stress" | "demand" | "project";

/** A pumped-city hero's narrative. Each value is translated copy, an i18n key
 *  or a literal string; {placeholders} are filled from the city's
 *  supply-overview data. A field left out renders nothing, never another
 *  city's story. */
export interface PumpingHeroCopy {
  headline?: I18nText;
  body?: I18nText;
  wtp_label?: I18nText;
  wtp_sub?: I18nText;
  uphill_label?: I18nText;
  uphill_sub?: I18nText;
  nrw_sub?: I18nText;
  pop_label?: I18nText;
  pop_sub?: I18nText;
  footer?: I18nText;
  callouts?: Partial<Record<CalloutId, { title: I18nText; body: I18nText }>>;
}

/** Narrative kept in code because it is translated: Bengaluru's (en/ta/kn).
 *  Cities whose narrative is English-only carry it in their supply-overview
 *  JSON as `hero_copy`, which overrides any field here. */
export const PUMPING_HERO_COPY: Partial<Record<CityId, PumpingHeroCopy>> = {
  bangalore: {
    headline: { en: "Pumped {km} km, lifted {m} m, then a long groundwater shadow market", ta: "{km} கி.மீ பம்ப் செய்யப்பட்டது, {m} மீ உயர்த்தப்பட்டது, பின்னர் நீண்ட நிலத்தடி நீர் நிழல் சந்தை", kn: "{km} ಕಿಮೀ ಪಂಪ್ ಮಾಡಲಾಗಿದೆ, {m} ಮೀ ಎತ್ತಲಾಗಿದೆ, ನಂತರ ದೀರ್ಘ ಅಂತರ್ಜಲ ನೆರಳು ಮಾರುಕಟ್ಟೆ" },
    body: { en: "{city} is a fundamentally pumped city. There is no river running through it - the city sits across the watershed divide of three small valleys (Vrishabhavathi, Koramangala-Challaghatta, Hebbal). Its water chain starts ~{km} km away at the Cauvery and climbs ~{m} m through three pump stations (TK Halli → Harohalli → Tataguni) to reach the BBMP service area. That structural choice - made because Kempe Gowda's 1537 kere network could not scale to a 14M-person city - is what makes the next four numbers consequential.", ta: "{city} அடிப்படையில் ஒரு பம்ப் செய்யப்பட்ட நகரம். அதன் வழியாக ஓடும் ஆறு இல்லை - நகரம் மூன்று சிறிய பள்ளத்தாக்குகளின் (விருஷபாவதி, கோரமங்கலா-சல்லகட்டா, ஹெப்பல்) நீர்பிடிப்புப் பகுதியில் அமர்ந்துள்ளது. அதன் நீர் சங்கிலி காவிரியில் ~{km} கி.மீ தொலைவில் தொடங்கி மூன்று பம்ப் நிலையங்கள் வழியாக ~{m} மீ ஏறி BBMP சேவைப் பகுதியை அடைகிறது. கெம்பே கௌடாவின் 1537 கேரே வலையமைப்பு 14M-நகரத்திற்கு அளவீட இயலாததால் எடுக்கப்பட்ட இந்த கட்டமைப்பு தேர்வே அடுத்த நான்கு எண்களை முக்கியமாக்குகிறது.", kn: "{city} ಮೂಲಭೂತವಾಗಿ ಪಂಪ್ ಮಾಡಲ್ಪಟ್ಟ ನಗರ. ಇಲ್ಲಿ ಯಾವುದೇ ನದಿ ಹರಿಯುವುದಿಲ್ಲ - ನಗರ ಮೂರು ಸಣ್ಣ ಕಣಿವೆಗಳ (ವೃಷಭಾವತಿ, ಕೋರಮಂಗಲ-ಚಲ್ಲಘಟ್ಟ, ಹೆಬ್ಬಾಳ) ಜಲಾನಯನ ವಿಭಾಜಕದ ಮೇಲೆ ಕುಳಿತಿದೆ. ಅದರ ನೀರಿನ ಸರಪಳಿ ಕಾವೇರಿಯಿಂದ ~{km} ಕಿಮೀ ದೂರದಲ್ಲಿ ಪ್ರಾರಂಭವಾಗಿ ಮೂರು ಪಂಪ್ ಸ್ಟೇಷನ್‌ಗಳ ಮೂಲಕ (TK ಹಳ್ಳಿ → ಹಾರೋಹಳ್ಳಿ → ತಾತಗುಣಿ) ~{m} ಮೀ ಏರಿ BBMP ಸೇವಾ ಪ್ರದೇಶವನ್ನು ತಲುಪುತ್ತದೆ. ಕೆಂಪೇ ಗೌಡರ 1537 ಕೆರೆ ಜಾಲ 14M-ಜನಸಂಖ್ಯೆಯ ನಗರಕ್ಕೆ ವಿಸ್ತರಿಸಲಾಗದ ಕಾರಣ ಮಾಡಿದ ಆ ಕಟ್ಟಡ ಆಯ್ಕೆಯೇ ಮುಂದಿನ ನಾಲ್ಕು ಸಂಖ್ಯೆಗಳನ್ನು ಮಹತ್ವದ್ದಾಗಿಸುತ್ತದೆ." },
    wtp_label: { en: "Cauvery WTP capacity", ta: "காவிரி WTP திறன்", kn: "ಕಾವೇರಿ WTP ಸಾಮರ್ಥ್ಯ" },
    wtp_sub: { en: "6 WTPs at TK Halli; ~1,500 MLD delivered (BWSSB 2026)", ta: "TK ஹல்லியில் கட்டங்கள் I-IV (JICA)", kn: "TK ಹಳ್ಳಿಯಲ್ಲಿ 6 WTPಗಳು; ~1,500 MLD ತಲುಪಿಸಲಾಗಿದೆ (BWSSB 2026)" },
    uphill_label: { en: "Uphill from Cauvery", ta: "காவிரியில் இருந்து மேட்டில்", kn: "ಕಾವೇರಿಯಿಂದ ಎತ್ತರಕ್ಕೆ" },
    uphill_sub: { en: "{m} m total lift, 3 pump stations", ta: "{m} மீ மொத்த உயர்வு, 3 பம்ப் நிலையங்கள்", kn: "{m} ಮೀ ಒಟ್ಟು ಎತ್ತುವಿಕೆ, 3 ಪಂಪ್ ಸ್ಟೇಷನ್‌ಗಳು" },
    nrw_sub: { en: "Norm {supply} LPCD -> {consumer} LPCD actual consumption (BWSSB)", ta: "{supply} LPCD வழங்கப்பட்டது -> {consumer} LPCD நுகர்வோரை அடைகிறது", kn: "ಮಾನದಂಡ {supply} LPCD -> {consumer} LPCD ವಾಸ್ತವಿಕ ಬಳಕೆ (BWSSB)" },
    pop_sub: { en: "BWSSB official, 2026 (Apr 2026 Chairman interview)", ta: "BWSSB முக்கிய அம்சங்கள், JICA 2017 ஸ்னாப்ஷாட்", kn: "BWSSB ಅಧಿಕೃತ, 2026 (ಏಪ್ರಿಲ್ 2026 ಅಧ್ಯಕ್ಷರ ಸಂದರ್ಶನ)" },
    footer: { en: "Engineering numbers from the JICA Bengaluru Water Supply and Sewerage Project (Phase 3) Final Report, November 2017 (NJS Consultants). Supplemented with WELL Labs Urban Water Balance (2024), IISc Groundwater Outlook (April 2025), and The Ken May 2026 reporting. See the supply-overview tile below for the full source mix, WTP commissioning history, distribution chain, and tanker market data.", ta: "JICA பெங்களூரு நீர் வழங்கல் மற்றும் கழிவுநீர் திட்டம் (கட்டம் 3) இறுதி அறிக்கை, நவம்பர் 2017 (NJS ஆலோசகர்கள்) இலிருந்து பொறியியல் எண்கள். WELL Labs நகர நீர் சமநிலை (2024), IISc நிலத்தடி நீர் கண்காணிப்பு (ஏப்ரல் 2025), மற்றும் The Ken மே 2026 அறிக்கையிடல் கொண்டு மேம்படுத்தப்பட்டது.", kn: "JICA ಬೆಂಗಳೂರು ನೀರು ಪೂರೈಕೆ ಮತ್ತು ಚರಂಡಿ ಯೋಜನೆ (Phase 3) ಅಂತಿಮ ವರದಿ, ನವೆಂಬರ್ 2017 (NJS ಸಲಹೆಗಾರರು) ರಿಂದ ಎಂಜಿನಿಯರಿಂಗ್ ಸಂಖ್ಯೆಗಳು. WELL Labs ನಗರ ಜಲ ಸಮತೋಲನ (2024), IISc ಅಂತರ್ಜಲ ಔಟ್‌ಲುಕ್ (ಏಪ್ರಿಲ್ 2025) ಮತ್ತು The Ken ಮೇ 2026 ವರದಿಗಳಿಂದ ಪೂರಕವಾಗಿದೆ." },
    callouts: {
      stage_v: {
        title: { en: "Stage V: {design} MLD design, {actual} MLD delivered", ta: "கட்டம் V: {design} MLD வடிவமைப்பு, {actual} MLD வழங்கப்பட்டது", kn: "Stage V: {design} MLD ವಿನ್ಯಾಸ, {actual} MLD ತಲುಪಿಸಲಾಗಿದೆ" },
        body: { en: "Commissioned 16 Oct 2024 at TK Halli to cover the 110 newly-added villages. As of Feb 2026 it's running at roughly half-capacity - the 'expansion that only half-delivers' is the live Bengaluru narrative.", ta: "புதிதாக சேர்க்கப்பட்ட 110 கிராமங்களை உள்ளடக்க 16 அக் 2024 அன்று TK ஹல்லியில் தொடங்கப்பட்டது. பிப் 2026 நிலவரப்படி இது கிட்டத்தட்ட பாதி திறனில் இயங்குகிறது - 'பாதி மட்டுமே வழங்கும் விரிவாக்கம்' பெங்களூரின் நேரடி கதையாகும்.", kn: "110 ಹೊಸದಾಗಿ ಸೇರಿಸಿದ ಗ್ರಾಮಗಳನ್ನು ಒಳಗೊಳ್ಳಲು 16 ಅಕ್ಟೋಬರ್ 2024 ರಂದು TK ಹಳ್ಳಿಯಲ್ಲಿ ಚಾಲನೆಗೊಂಡಿತು. ಫೆಬ್ 2026 ರ ಪ್ರಕಾರ ಇದು ಸುಮಾರು ಅರ್ಧ-ಸಾಮರ್ಥ್ಯದಲ್ಲಿ ಚಲಿಸುತ್ತಿದೆ - 'ಅರ್ಧ ಮಾತ್ರ ತಲುಪಿಸುವ ವಿಸ್ತರಣೆ' ಬೆಂಗಳೂರಿನ ನೇರ ಕಥನ." },
      },
      energy: {
        title: { en: "{pct}% of BWSSB revenue burned on pumping", ta: "BWSSB வருவாயின் {pct}% பம்பிங்கில் எரிக்கப்படுகிறது", kn: "BWSSB ಆದಾಯದ {pct}% ಪಂಪಿಂಗ್‌ನಲ್ಲಿ ಸುಡಲಾಗುತ್ತದೆ" },
        body: { en: "Lifting Cauvery water ~{km} km uphill against ~{m} m elevation is the single largest operating cost - which is why every additional MLD via Cauvery is structurally more expensive than equivalent MLD from local sources.", ta: "காவிரி நீரை ~{km} கி.மீ மேலே ~{m} மீ உயரத்திற்கு எதிராக உயர்த்துவது ஒரு பெரிய இயக்கச் செலவு - காவிரி வழியான ஒவ்வொரு கூடுதல் MLD-யும் உள்ளூர் ஆதாரங்களில் இருந்து வரும் அதே MLD-யை விட கட்டமைப்பு ரீதியாக விலையுயர்ந்ததாக இருப்பது இதனால்.", kn: "ಕಾವೇರಿ ನೀರನ್ನು ~{m} ಮೀ ಎತ್ತರಕ್ಕೆ ಎದುರಾಗಿ ~{km} ಕಿಮೀ ಎತ್ತುವುದು ಒಂದು ದೊಡ್ಡ ಕಾರ್ಯಾಚರಣಾ ವೆಚ್ಚ - ಕಾವೇರಿ ಮೂಲಕ ಪ್ರತಿ ಹೆಚ್ಚುವರಿ MLD ಸ್ಥಳೀಯ ಮೂಲಗಳಿಂದ ಸಮಾನ MLD ಗಿಂತ ಕಟ್ಟಡ ರೀತಿಯಲ್ಲಿ ಹೆಚ್ಚು ದುಬಾರಿಯಾಗಿರುವುದು ಇದರಿಂದಲೇ." },
      },
      gw: {
        title: { en: "Groundwater: {official} MLD (IISc/BWSSB, 2025) to {estimate} MLD (WELL Labs, 2021)", ta: "நிலத்தடி நீர்: {official} MLD (BWSSB) vs {estimate} MLD (WELL Labs)", kn: "ಅಂತರ್ಜಲ: {official} MLD (IISc/BWSSB, 2025) ರಿಂದ {estimate} MLD (WELL Labs, 2021)" },
        body: { en: "Not two readings of one meter - two estimates, built differently, years apart. The 800 MLD is the BWSSB-commissioned IISc Groundwater Outlook (2024-25 conditions). The 1,392 MLD is WELL Labs' 2021 top-down balance (total demand minus piped supply), which is closer to groundwater 'dependence' than to metered extraction; JICA's 2017 expert committee put it near 500 MLD. For an unmetered resource, 800-1,392 MLD is the honest range, not a measured contradiction.", ta: "BWSSB-ன் அதிகாரப்பூர்வ எடுப்புத் தொகையும் WELL Labs-ன் கீழ்-மேல் நகர நீர் சமநிலையும் 592 MLD-ஆல் ஒத்துப்போகவில்லை. மாறுபாடே கதை - நகரத்தின் நிலத்தடி நீர் பயன்பாடு நிலையாக 800 MLD அல்லது நிலையற்ற 1,392 MLD ஆக இருக்கலாம்.", kn: "ಒಂದೇ ಮೀಟರ್‌ನ ಎರಡು ಓದುಗಳಲ್ಲ - ಬೇರೆ ಬೇರೆ ವರ್ಷಗಳ, ಬೇರೆ ಬೇರೆ ವಿಧಾನಗಳಿಂದ ಮಾಡಿದ ಎರಡು ಅಂದಾಜುಗಳು. 800 MLD ಎಂಬುದು BWSSB ನಿಯೋಜಿಸಿದ IISc ಅಂತರ್ಜಲ ಔಟ್‌ಲುಕ್ (2024-25). 1,392 MLD ಎಂಬುದು WELL Labs ನ 2021 ಮೇಲಿನಿಂದ-ಕೆಳಗಿನ ಸಮತೋಲನ (ಒಟ್ಟು ಬೇಡಿಕೆ ಮೈನಸ್ ಪೈಪ್ ಪೂರೈಕೆ), ಇದು ಅಳೆದ ಎತ್ತುವಿಕೆಗಿಂತ ಅಂತರ್ಜಲ 'ಅವಲಂಬನೆ'ಗೆ ಹತ್ತಿರ; JICA ಯ 2017 ತಜ್ಞ ಸಮಿತಿ ಇದನ್ನು ಸುಮಾರು 500 MLD ಎಂದು ಅಂದಾಜಿಸಿತು. ಅಳೆಯದ ಸಂಪನ್ಮೂಲಕ್ಕೆ, 800-1,392 MLD ಎಂಬುದು ಪ್ರಾಮಾಣಿಕ ವ್ಯಾಪ್ತಿ, ಅಳೆದ ವಿರೋಧಾಭಾಸವಲ್ಲ." },
      },
      stress: {
        title: { en: "{count} wards critically over-extracted", ta: "{count} வார்டுகள் மிகவும் அதிகமாக எடுக்கப்பட்டுள்ளன", kn: "{count} ವಾರ್ಡ್‌ಗಳು ಗಂಭೀರವಾಗಿ ಅತಿ-ಎತ್ತಲ್ಪಟ್ಟಿವೆ" },
        body: { en: "The BWSSB-commissioned IISc Groundwater Outlook of Bengaluru City (April 2025) maps 65 BBMP wards as 'over-exploited' - including Hebbal, Yelahanka, Koramangala, KR Puram, Jakkur. Stage V was meant to relieve these wards via piped supply.", ta: "BWSSB-ஆல் கட்டளையிடப்பட்ட பெங்களூரு நகரின் IISc நிலத்தடி நீர் கண்காணிப்பு (ஏப்ரல் 2025) ஹெப்பல், யேலஹங்கா, கோரமங்கலா, KR புரம், ஜக்கூர் உள்ளிட்ட 65 BBMP வார்டுகளை 'அதிகமாக சுரண்டப்பட்டவை' என வரைபடப்படுத்துகிறது. கட்டம் V இந்த வார்டுகளை குழாய் வழங்கல் மூலம் நிவர்த்தி செய்ய நினைக்கப்பட்டது.", kn: "BWSSB ಆದೇಶಿತ IISc ಬೆಂಗಳೂರು ನಗರ ಅಂತರ್ಜಲ ಔಟ್‌ಲುಕ್ (ಏಪ್ರಿಲ್ 2025) ಹೆಬ್ಬಾಳ, ಯಲಹಂಕ, ಕೋರಮಂಗಲ, KR ಪುರಂ, ಜಕ್ಕೂರು ಸೇರಿದಂತೆ 65 BBMP ವಾರ್ಡ್‌ಗಳನ್ನು 'ಅತಿ-ಶೋಷಣೆ' ಎಂದು ನಕ್ಷೆ ಮಾಡುತ್ತದೆ. ಪೈಪ್ ಪೂರೈಕೆಯ ಮೂಲಕ ಈ ವಾರ್ಡ್‌ಗಳಿಗೆ ಪರಿಹಾರ ನೀಡಲು Stage V ಉದ್ದೇಶಿಸಲಾಗಿತ್ತು." },
      },
      demand: {
        title: { en: "2049 demand {demand} MLD vs supply {supply} MLD = {gap} MLD deficit", ta: "2049 தேவை {demand} MLD vs வழங்கல் {supply} MLD = {gap} MLD பற்றாக்குறை", kn: "2049 ಬೇಡಿಕೆ {demand} MLD vs ಪೂರೈಕೆ {supply} MLD = {gap} MLD ಕೊರತೆ" },
        body: { en: "JICA Phase 3 Table 6.3 high-growth scenario: even with Stage V fully delivered + 500 MLD groundwater, post-2049 demand outstrips supply by 721 MLD. Closing this needs Stage VI / inter-basin transfer / large-scale reuse / 10x UFW reduction.", ta: "JICA கட்டம் 3 அட்டவணை 6.3 உயர்-வளர்ச்சி சூழ்நிலை: கட்டம் V முழுமையாக வழங்கப்பட்டாலும் + 500 MLD நிலத்தடி நீர், 2049-க்குப் பிறகான தேவை வழங்கலை 721 MLD-ஆல் தாண்டுகிறது.", kn: "JICA Phase 3 ಟೇಬಲ್ 6.3 ಹೈ-ಗ್ರೋಥ್ ಸನ್ನಿವೇಶ: Stage V ಸಂಪೂರ್ಣವಾಗಿ ತಲುಪಿಸಿದರೂ + 500 MLD ಅಂತರ್ಜಲ, 2049 ರ ನಂತರ ಬೇಡಿಕೆ ಪೂರೈಕೆಯನ್ನು 721 MLD ನಿಂದ ಮೀರಿಸುತ್ತದೆ. ಇದನ್ನು ಮುಚ್ಚಲು Stage VI / ಅಂತರ-ಜಲಾನಯನ ವರ್ಗಾವಣೆ / ದೊಡ್ಡ-ಪ್ರಮಾಣದ ಮರುಬಳಕೆ / 10x UFW ಕಡಿತ ಬೇಕು." },
      },
      project: {
        title: { en: "{cost} crore Stage V + 110-villages sewerage investment", ta: "{cost} கோடி கட்டம் V + 110-கிராமங்கள் கழிவுநீர் முதலீடு", kn: "{cost} ಕೋಟಿ Stage V + 110-ಗ್ರಾಮಗಳ ಚರಂಡಿ ಹೂಡಿಕೆ" },
        body: { en: "JICA Phase 3 Table 16.2.1 (2017 prices). Funding pattern: {jica}% JICA sovereign loan, 7.5% Government of Karnataka, 7.5% BWSSB. Stage V alone is ₹4,435 crore. Running at ~52% of design capacity as of Feb 2026 (The Ken) means roughly half that investment is unrealised yield.", ta: "JICA கட்டம் 3 அட்டவணை 16.2.1 (2017 விலைகள்). நிதி முறை: {jica}% JICA இறையாண்மை கடன், 7.5% கர்நாடக அரசு, 7.5% BWSSB. கட்டம் V மட்டுமே ₹4,435 கோடி.", kn: "JICA Phase 3 ಟೇಬಲ್ 16.2.1 (2017 ಬೆಲೆಗಳು). ಹಣಕಾಸು ಮಾದರಿ: {jica}% JICA ಸಾರ್ವಭೌಮ ಸಾಲ, 7.5% ಕರ್ನಾಟಕ ಸರ್ಕಾರ, 7.5% BWSSB. Stage V ಮಾತ್ರ ₹4,435 ಕೋಟಿ. ಫೆಬ್ 2026 ರ ಪ್ರಕಾರ ~52% ವಿನ್ಯಾಸ ಸಾಮರ್ಥ್ಯದಲ್ಲಿ ಚಲಿಸುತ್ತಿರುವುದು ಎಂದರೆ ಆ ಹೂಡಿಕೆಯ ಸುಮಾರು ಅರ್ಧ ಅಪೂರ್ಣ ಇಳುವರಿ." },
      },
    },
  },
};
