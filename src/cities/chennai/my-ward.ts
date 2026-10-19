import type { CityMyWardContent } from "@/content/my-ward/types";
import { CPCB_NWMP } from "@/content/my-ward/shared";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  sources: {
    gw: { en: "Source: OpenCity Chennai / CMWSSB. Monthly readings, typically 3-6 months lag.", ta: "ஆதாரம்: OpenCity Chennai / CMWSSB. மாதாந்திர அளவீடுகள், பொதுவாக 3-6 மாத தாமதம்.", kn: "ಮೂಲ: OpenCity Chennai / CMWSSB. ಮಾಸಿಕ ಮಾಪನಗಳು, ಸಾಮಾನ್ಯವಾಗಿ 3-6 ತಿಂಗಳ ವಿಳಂಬ." },
    flood: { en: "Source: CFLOWS flood model (OpenCity Chennai). Hotspots from GCC damage surveys after 2015 floods and 2020 Cyclone Nivar.", ta: "ஆதாரம்: CFLOWS வெள்ள மாதிரி (OpenCity Chennai). 2015 வெள்ளம் மற்றும் 2020 நிவர் புயலுக்குப் பிறகு GCC சேத கணக்கெடுப்புகளில் இருந்து ஹாட்ஸ்பாட்கள்.", kn: "ಮೂಲ: CFLOWS ಪ್ರವಾಹ ಮಾಡೆಲ್ (OpenCity Chennai). 2015 ಪ್ರವಾಹ ಮತ್ತು 2020 ಚಂಡಮಾರುತ ನಿವಾರ್ ನಂತರ GCC ಹಾನಿ ಸಮೀಕ್ಷೆಗಳಿಂದ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು." },
    infra: { en: "Source: GCC Storm Water Drain Survey (2023), CMWSSB Sewerage Network (OpenCity Chennai).", ta: "ஆதாரம்: GCC மழைநீர் வடிகால் கணக்கெடுப்பு (2023), CMWSSB கழிவுநீர் வலையமைப்பு (OpenCity Chennai).", kn: "ಮೂಲ: GCC ಮಳೆನೀರು ಚರಂಡಿ ಸಮೀಕ್ಷೆ (2023), CMWSSB ಚರಂಡಿ ಜಾಲ (OpenCity Chennai)." },
    river: CPCB_NWMP,
    lostNote: { en: "Lost water bodies identified from historical Survey of India maps, Care Earth Trust surveys, and CMDA records.", ta: "இழந்த நீர்நிலைகள் வரலாற்று சர்வே ஆப் இந்தியா வரைபடங்கள், கேர் எர்த் அறக்கட்டளை கணக்கெடுப்புகள் மற்றும் CMDA பதிவுகளில் இருந்து கண்டறியப்பட்டவை.", kn: "ಕಳೆದ ಜಲಮೂಲಗಳನ್ನು ಐತಿಹಾಸಿಕ Survey of India ನಕ್ಷೆಗಳು, Care Earth Trust ಸಮೀಕ್ಷೆಗಳು ಮತ್ತು CMDA ದಾಖಲೆಗಳಿಂದ ಗುರುತಿಸಲಾಗಿದೆ." },
  },
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "GCC Online Services",
        href: "https://gccservices.in/pgr",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.cmwssb_portal",
        subLabel: "CMWSSB",
        href: "https://www.cmwssb.tn.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "044-2845 2572", href: "tel:04428452572" },
      { labelKey: "my_ward.hl_tanker_booking", value: "044-2845 1515", href: "tel:04428451515" },
      { labelKey: "my_ward.hl_cmwssb_whatsapp", value: "9445147200", href: "https://wa.me/919445147200" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1913", href: "tel:1913" },
      { labelKey: "my_ward.hl_rwh_info", value: null, href: "https://www.cmwssb.tn.gov.in/rain-water-harvesting" },
    ],
  },
};
