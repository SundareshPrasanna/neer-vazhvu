import type { CityId } from "@/lib/cities/ids";
import type { TranslationEntry } from "@/lib/i18n/translations";

/** The source lines under each My Ward card. A city renders only the lines it
 *  records here; a missing line renders nothing, never another city's source. */
export interface WardSourceCopy {
  /** Live monthly well readings (groundwater card). */
  gw?: TranslationEntry;
  /** CGWB block assessment + nearest Year Book well (groundwater card). */
  gwYearbook?: TranslationEntry;
  /** No Year Book well within 5 km of the ward. */
  gwNoWell?: TranslationEntry;
  flood?: TranslationEntry;
  infra?: TranslationEntry;
  river?: TranslationEntry;
  /** Where the ward's lost water bodies were identified. */
  lostNote?: TranslationEntry;
}

const CPCB_NWMP: TranslationEntry = { en: "Distance is straight-line from ward centroid to nearest CPCB monitoring station. Water quality data from CPCB National Water Monitoring Programme (annual).", ta: "தூரம் வார்டு மையப்புள்ளியிலிருந்து அருகிலுள்ள CPCB கண்காணிப்பு நிலையத்திற்கு நேர்கோட்டு தூரம். நீர் தரவு CPCB தேசிய நீர் கண்காணிப்பு திட்டத்திலிருந்து (ஆண்டு).", kn: "ದೂರವು ವಾರ್ಡ್ ಕೇಂದ್ರದಿಂದ ಹತ್ತಿರದ CPCB ಮೇಲ್ವಿಚಾರಣಾ ನಿಲ್ದಾಣಕ್ಕೆ ಸರಳ ರೇಖೆ. CPCB ರಾಷ್ಟ್ರೀಯ ನೀರಿನ ಮೇಲ್ವಿಚಾರಣಾ ಕಾರ್ಯಕ್ರಮದ ನೀರಿನ ಗುಣಮಟ್ಟ ದತ್ತಾಂಶ (ವಾರ್ಷಿಕ)." };

export const MY_WARD_SOURCES: Partial<Record<CityId, WardSourceCopy>> = {
  chennai: {
    gw: { en: "Source: OpenCity Chennai / CMWSSB. Monthly readings, typically 3-6 months lag.", ta: "ஆதாரம்: OpenCity Chennai / CMWSSB. மாதாந்திர அளவீடுகள், பொதுவாக 3-6 மாத தாமதம்.", kn: "ಮೂಲ: OpenCity Chennai / CMWSSB. ಮಾಸಿಕ ಮಾಪನಗಳು, ಸಾಮಾನ್ಯವಾಗಿ 3-6 ತಿಂಗಳ ವಿಳಂಬ." },
    flood: { en: "Source: CFLOWS flood model (OpenCity Chennai). Hotspots from GCC damage surveys after 2015 floods and 2020 Cyclone Nivar.", ta: "ஆதாரம்: CFLOWS வெள்ள மாதிரி (OpenCity Chennai). 2015 வெள்ளம் மற்றும் 2020 நிவர் புயலுக்குப் பிறகு GCC சேத கணக்கெடுப்புகளில் இருந்து ஹாட்ஸ்பாட்கள்.", kn: "ಮೂಲ: CFLOWS ಪ್ರವಾಹ ಮಾಡೆಲ್ (OpenCity Chennai). 2015 ಪ್ರವಾಹ ಮತ್ತು 2020 ಚಂಡಮಾರುತ ನಿವಾರ್ ನಂತರ GCC ಹಾನಿ ಸಮೀಕ್ಷೆಗಳಿಂದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು." },
    infra: { en: "Source: GCC Storm Water Drain Survey (2023), CMWSSB Sewerage Network (OpenCity Chennai).", ta: "ஆதாரம்: GCC மழைநீர் வடிகால் கணக்கெடுப்பு (2023), CMWSSB கழிவுநீர் வலையமைப்பு (OpenCity Chennai).", kn: "ಮೂಲ: GCC ಮಳೆನೀರು ಚರಂಡಿ ಸಮೀಕ್ಷೆ (2023), CMWSSB ಚರಂಡಿ ಜಾಲ (OpenCity Chennai)." },
    river: CPCB_NWMP,
    lostNote: { en: "Lost water bodies identified from historical Survey of India maps, Care Earth Trust surveys, and CMDA records.", ta: "இழந்த நீர்நிலைகள் வரலாற்று சர்வே ஆப் இந்தியா வரைபடங்கள், கேர் எர்த் அறக்கட்டளை கணக்கெடுப்புகள் மற்றும் CMDA பதிவுகளில் இருந்து கண்டறியப்பட்டவை.", kn: "ಕಳೆದ ಜಲಮೂಲಗಳನ್ನು ಐತಿಹಾಸಿಕ Survey of India ನಕ್ಷೆಗಳು, Care Earth Trust ಸಮೀಕ್ಷೆಗಳು ಮತ್ತು CMDA ದಾಖಲೆಗಳಿಂದ ಗುರುತಿಸಲಾಗಿದೆ." },
  },
  madurai: {
    gwYearbook: { en: "Source: CGWB Tamil Nadu Ground Water Year Book 2023-24 + GEC 2022 block-level dynamic groundwater resource assessment.", ta: "ஆதாரம்: CGWB தமிழ்நாடு நிலத்தடி நீர் ஆண்டுப் புத்தகம் 2023-24 + GEC 2022 பிளாக்-நிலை இயங்கு நிலத்தடி நீர் வள மதிப்பீடு.", kn: "ಮೂಲ: CGWB ತಮಿಳುನಾಡು ಅಂತರ್ಜಲ ಇಯರ್ ಬುಕ್ 2023-24 + GEC 2022 ಬ್ಲಾಕ್-ಮಟ್ಟದ ಡೈನಮಿಕ್ ಅಂತರ್ಜಲ ಸಂಪನ್ಮೂಲ ಮೌಲ್ಯಮಾಪನ." },
    gwNoWell: { en: "No CGWB Year Book well within 5 km of this ward; nearest readings shown on /madurai/groundwater.", ta: "இந்த வார்டிலிருந்து 5 கி.மீ-க்குள் CGWB ஆண்டுப் புத்தக கிணறு இல்லை; /madurai/groundwater-இல் அருகிலுள்ள அளவீடுகள் காண்க.", kn: "ಈ ವಾರ್ಡ್‌ನ 5 ಕಿಮೀ ಒಳಗೆ ಯಾವುದೇ CGWB Year Book ಬಾವಿ ಇಲ್ಲ; ಹತ್ತಿರದ ಮಾಪನಗಳನ್ನು /madurai/groundwater ನಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ." },
    river: CPCB_NWMP,
  },
  bangalore: {
    gwYearbook: { en: "Source: CGWB Karnataka Ground Water Year Book + IN-GRES 2025-26 block-level dynamic groundwater resource assessment.", kn: "ಮೂಲ: CGWB ಕರ್ನಾಟಕ ಅಂತರ್ಜಲ ವಾರ್ಷಿಕ ಪುಸ್ತಕ + IN-GRES 2025-26 ಬ್ಲಾಕ್-ಮಟ್ಟದ ಚಲನಶೀಲ ಅಂತರ್ಜಲ ಸಂಪನ್ಮೂಲ ಮೌಲ್ಯಮಾಪನ." },
    gwNoWell: { en: "No CGWB Year Book well within 5 km of this ward; nearest readings shown on /bangalore/groundwater.", kn: "ಈ ವಾರ್ಡ್‌ನಿಂದ 5 ಕಿ.ಮೀ ಒಳಗೆ CGWB ವಾರ್ಷಿಕ ಪುಸ್ತಕದ ಬಾವಿ ಇಲ್ಲ; ಹತ್ತಿರದ ವಾಚನಗಳು /bangalore/groundwater ನಲ್ಲಿ." },
    flood: { en: "Source: KSNDMC flood-prone zones + BBMP flooding hotspots (Sept 2022).", kn: "ಮೂಲ: KSNDMC ಪ್ರವಾಹ ಪೀಡಿತ ವಲಯಗಳು + BBMP ಪ್ರವಾಹ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು (ಸೆಪ್ಟೆಂಬರ್ 2022)." },
    infra: { en: "Source: BBMP storm-water-drain master plan (partial); BWSSB sewerage (design capacities).", kn: "ಮೂಲ: BBMP ಮಳೆನೀರು ಚರಂಡಿ ಮಾಸ್ಟರ್ ಪ್ಲಾನ್ (ಭಾಗಶಃ); BWSSB ಒಳಚರಂಡಿ (ವಿನ್ಯಾಸ ಸಾಮರ್ಥ್ಯ)." },
    river: CPCB_NWMP,
  },
  delhi: {
    gwYearbook: { en: "Source: CGWB observation wells via the India-WRIS Ground Water Level dataset (network stops reporting 20 Sep 2025) + CGWB Dynamic Ground Water Resources 2024-25, assessed by DISTRICT for Delhi rather than by block.", hi: "स्रोत: India-WRIS के माध्यम से CGWB निरीक्षण कूप + CGWB डायनामिक भूजल संसाधन 2024-25 (जिला-स्तर)।" },
    infra: { en: "Source: OSM-traced drains (community-mapped; the IFC 2018 Drainage Master Plan's 3,737 km across 11 agencies is PDF-only). DJB sewer network not public - its OpenCity dataset was delisted." },
    river: { en: "Distance is straight-line from ward centroid to the nearest DPCC monitoring station on the Yamuna. Water quality from DPCC's monthly Yamuna analysis reports." },
  },
  mumbai: {
    gwYearbook: { en: "Source: CGWB Ground Water Year Book of Maharashtra. Mumbai City + Suburban are excluded from the block-level GEC assessment - stated, not hidden.", mr: "स्रोत: CGWB महाराष्ट्र भूजल वार्षिक पुस्तिका. मुंबई शहर + उपनगर ब्लॉक-स्तरीय GEC मूल्यांकनातून वगळलेले आहेत." },
    gwNoWell: { en: "No CGWB Year Book well within 5 km of this ward; nearest readings shown on /mumbai/groundwater.", mr: "या वॉर्डपासून 5 किमीच्या आत CGWB वार्षिक पुस्तिकेची विहीर नाही; जवळची वाचने /mumbai/groundwater वर." },
    flood: { en: "Source: BMC Disaster Management chronic-flooding register + 26 July 2005 record (Concerned Citizens' Commission).", mr: "स्रोत: BMC आपत्ती व्यवस्थापन दीर्घकालीन पूर नोंदवही + 26 जुलै 2005 नोंद." },
    infra: { en: "Source: OSM-traced drainage (community-mapped; BMC's BRIMSTOWAD as-builts are not public); MCGM sewage treatment facilities.", mr: "स्रोत: OSM-आधारित नाले (समुदाय-नकाशित); MCGM सांडपाणी प्रक्रिया केंद्रे." },
  },
};

/** A city's My Ward source lines (none recorded -> empty). */
export const wardSources = (cityId: string): WardSourceCopy => MY_WARD_SOURCES[cityId as CityId] ?? {};
