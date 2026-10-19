import type { CityMyWardContent } from "@/content/my-ward/types";
import { CPCB_NWMP } from "@/content/my-ward/shared";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  sources: {
    gwYearbook: { en: "Source: CGWB Karnataka Ground Water Year Book + IN-GRES 2025-26 block-level dynamic groundwater resource assessment.", kn: "ಮೂಲ: CGWB ಕರ್ನಾಟಕ ಅಂತರ್ಜಲ ವಾರ್ಷಿಕ ಪುಸ್ತಕ + IN-GRES 2025-26 ಬ್ಲಾಕ್-ಮಟ್ಟದ ಚಲನಶೀಲ ಅಂತರ್ಜಲ ಸಂಪನ್ಮೂಲ ಮೌಲ್ಯಮಾಪನ." },
    gwNoWell: { en: "No CGWB Year Book well within 5 km of this ward; nearest readings shown on the {map}.", kn: "ಈ ವಾರ್ಡ್‌ನಿಂದ 5 ಕಿ.ಮೀ ಒಳಗೆ CGWB ವಾರ್ಷಿಕ ಪುಸ್ತಕದ ಬಾವಿ ಇಲ್ಲ; ಹತ್ತಿರದ ವಾಚನಗಳು {map} ನಲ್ಲಿ." },
    flood: { en: "Source: KSNDMC flood-prone zones + BBMP flooding hotspots (Sept 2022).", kn: "ಮೂಲ: KSNDMC ಪ್ರವಾಹ ಪೀಡಿತ ವಲಯಗಳು + BBMP ಪ್ರವಾಹ ಹಾಟ್‌ಸ್ಪಾಟ್‌ಗಳು (ಸೆಪ್ಟೆಂಬರ್ 2022)." },
    infra: { en: "Source: BBMP storm-water-drain master plan (partial); BWSSB sewerage (design capacities).", kn: "ಮೂಲ: BBMP ಮಳೆನೀರು ಚರಂಡಿ ಮಾಸ್ಟರ್ ಪ್ಲಾನ್ (ಭಾಗಶಃ); BWSSB ಒಳಚರಂಡಿ (ವಿನ್ಯಾಸ ಸಾಮರ್ಥ್ಯ)." },
    river: CPCB_NWMP,
  },
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "BWSSB (helpline 1916)",
        href: "https://bwssb.karnataka.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "BBMP",
        href: "https://bbmp.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1916", href: "tel:1916" },
      { labelKey: "my_ward.hl_flood_emergency", value: "112", href: "tel:112" },
    ],
  },
};
