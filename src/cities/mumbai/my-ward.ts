import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  sources: {
    gwYearbook: { en: "Source: CGWB Ground Water Year Book of Maharashtra. Mumbai City + Suburban are excluded from the block-level GEC assessment - stated, not hidden.", mr: "स्रोत: CGWB महाराष्ट्र भूजल वार्षिक पुस्तिका. मुंबई शहर + उपनगर ब्लॉक-स्तरीय GEC मूल्यांकनातून वगळलेले आहेत." },
    gwNoWell: { en: "No CGWB Year Book well within 5 km of this ward; nearest readings shown on the {map}.", mr: "या वॉर्डपासून 5 किमीच्या आत CGWB वार्षिक पुस्तिकेची विहीर नाही; जवळची वाचने {map} वर." },
    flood: { en: "Source: BMC Disaster Management chronic-flooding register + 26 July 2005 record (Concerned Citizens' Commission).", mr: "स्रोत: BMC आपत्ती व्यवस्थापन दीर्घकालीन पूर नोंदवही + 26 जुलै 2005 नोंद." },
    infra: { en: "Source: OSM-traced drainage (community-mapped; BMC's BRIMSTOWAD as-builts are not public); MCGM sewage treatment facilities.", mr: "स्रोत: OSM-आधारित नाले (समुदाय-नकाशित); MCGM सांडपाणी प्रक्रिया केंद्रे." },
  },
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "BMC central helpline 1916",
        href: "https://portal.mcgm.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "BMC Hydraulic Engineer (lake levels)",
        href: "https://portal.mcgm.gov.in/irj/portal/anonymous/qllakelevel",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1916", href: "tel:1916" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1916", href: "tel:1916" },
    ],
  },
};
