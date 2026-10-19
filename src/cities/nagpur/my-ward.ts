import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  // Nagpur: no flood, infra or lost-water-body line, because no ward-level
  // source exists for them (flood is a narrative page; no storm-drain GIS).
  sources: {
    gwYearbook: { en: "Source: IN-GRES groundwater assessment by taluka unit + GSDA and CGWB telemetry on the National Water Data Portal; latest monthly mean shown." },
    gwNoWell: { en: "No telemetry well within 5 km of this ward's centre; every station is on the {map}." },
    river: { en: "Distance is straight-line from the ward centre to the nearest river sampling point with a published location; for every ward this is one of NMC's 23 points (Environment Status Report 2023-24, one sampling round, monsoon 2023)." },
  },
  // NAGPUR. Checked 2026-10-15. The NMC numbers are the contact block on page
  // 2 of NMC's natural-disaster plan 2025-26 (nmcnagpur.gov.in, Apatti_
  // Vyavsthapan_2025-26.pdf), read on the page image because the text layer
  // is a legacy font: Emergency Control Room 101 / 0712-2567777 / 0712-2567029,
  // Disaster Management Cell 0712-2551866, Collector's control room 1077. The
  // water line is Orange City Water's, the operator NMC contracts for water
  // supply and billing ("Help Line: 1800-266-9899" on ocwindia.com). NMC's
  // Public Health Engineering page lists a department office line
  // (0712-2567035); the operator's toll-free line is used for complaints. The
  // plan names 0712-2551866 the Disaster Management Cell; it is shown under the
  // shared flood-emergency label. Officers' mobile numbers on the
  // same pages are left out. No tanker line: NMC runs tankers but publishes no
  // booking number, and no /nagpur/tanker page exists to point at.
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "Orange City Water (NMC's water operator), toll-free 1800-266-9899",
        href: "https://www.ocwindia.com/contact_us",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "NMC Public Health Engineering (water supply)",
        href: "https://nmcnagpur.gov.in/219e052492f4008818b8adb6366c7ed6",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "1800 266 9899", href: "tel:18002669899" },
      { labelKey: "my_ward.hl_flood_emergency", value: "0712 255 1866", href: "tel:07122551866" },
      { labelKey: "my_ward.hl_emergency_control_room", value: "101 / 0712 256 7777", href: "tel:101" },
      { labelKey: "my_ward.hl_district_control_room", value: "1077", href: "tel:1077" },
    ],
  },
};
