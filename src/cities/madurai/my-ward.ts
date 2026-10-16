import type { CityMyWardContent } from "@/content/my-ward/types";
import { CPCB_NWMP } from "@/content/my-ward/shared";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  sources: {
    gwYearbook: { en: "Source: CGWB Tamil Nadu Ground Water Year Book 2023-24 + GEC 2022 block-level dynamic groundwater resource assessment.", ta: "ஆதாரம்: CGWB தமிழ்நாடு நிலத்தடி நீர் ஆண்டுப் புத்தகம் 2023-24 + GEC 2022 பிளாக்-நிலை இயங்கு நிலத்தடி நீர் வள மதிப்பீடு.", kn: "ಮೂಲ: CGWB ತಮಿಳುನಾಡು ಅಂತರ್ಜಲ ಇಯರ್ ಬುಕ್ 2023-24 + GEC 2022 ಬ್ಲಾಕ್-ಮಟ್ಟದ ಡೈನಮಿಕ್ ಅಂತರ್ಜಲ ಸಂಪನ್ಮೂಲ ಮೌಲ್ಯಮಾಪನ." },
    gwNoWell: { en: "No CGWB Year Book well within 5 km of this ward; nearest readings shown on the {map}.", ta: "இந்த வார்டிலிருந்து 5 கி.மீ-க்குள் CGWB ஆண்டுப் புத்தக கிணறு இல்லை; {map}-இல் அருகிலுள்ள அளவீடுகள் காண்க.", kn: "ಈ ವಾರ್ಡ್‌ನ 5 ಕಿಮೀ ಒಳಗೆ ಯಾವುದೇ CGWB Year Book ಬಾವಿ ಇಲ್ಲ; ಹತ್ತಿರದ ಮಾಪನಗಳನ್ನು {map} ನಲ್ಲಿ ತೋರಿಸಲಾಗಿದೆ." },
    river: CPCB_NWMP,
  },
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "Madurai Corporation (MMC)",
        href: "https://www.maduraicorporation.co.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "TWAD Board (Madurai)",
        href: "https://www.twadboard.tn.gov.in/content/madurai",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_mmc_helpline", value: "1913", href: "tel:1913" },
      { labelKey: "my_ward.hl_mmc_water", value: "0452-253 4222", href: "tel:04522534222" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1913", href: "tel:1913" },
    ],
  },
};
