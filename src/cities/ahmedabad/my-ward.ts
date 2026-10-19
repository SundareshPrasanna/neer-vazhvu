import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  sources: {
    gwYearbook: { en: "Source: IN-GRES 2025-26 assessment (the Ahmedabad Urban unit holds every AMC ward) + Gujarat Surface Water and Ground Water Department and CGWB telemetry on the National Water Data Portal; latest monthly mean shown." },
    gwNoWell: { en: "No telemetry well within 5 km of this ward's centre; all stations are on the {map}." },
    river: { en: "Distance is straight-line from the ward centre to the nearest CPCB monitoring station on the Sabarmati. Water quality from CPCB's annual NWMP river tables, 2018-2024." },
  },
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "AMC Central Complaint Redressal System (CCRS)",
        href: "https://www.amccrs.com/AMCPortal/Complaint/Register",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Ahmedabad Municipal Corporation",
        href: "https://ahmedabadcity.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      {
        // AMC's call centre, as published on its homepage under "Citizen
        // Complaint" (checked 2026-10-14); water complaints go through it.
        labelKey: "my_ward.hl_water_complaint",
        value: "155303",
        href: "tel:155303",
      },
      {
        labelKey: "my_ward.hl_whatsapp_complaint",
        value: "+91 75678 55303",
        href: "https://wa.me/917567855303",
      },
    ],
  },
};
