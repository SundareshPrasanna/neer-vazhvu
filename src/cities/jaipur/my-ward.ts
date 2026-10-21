import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  // Only the ward table's line: every other line belongs to a card drawn from
  // ward geometry, and Jaipur's 2025 wards exist only as a raster map.
  sources: {
    table: { en: "Wards and population: Rajasthan government ward notification of 16 Sep 2025 (Rajasthan Gazette, 20 Sep 2025). Zone and assembly seat: Nagar Nigam Jaipur's list of wards, Oct 2026. Zone office: Nagar Nigam Jaipur's office directory." },
  },
  //
  // JAIPUR. Checked 2026-10-20, each number from the agency's own page.
  // Water is PHED's, not the corporation's: Jaipur Samadhan has no water
  // category, and PHED's own "Grievance" link opens Rajasthan Sampark.
  //   PHED Jaipur district control room 0141-2706624: PHED's district-wise
  //     control room list (Pdf2026/Contact list control room-1.pdf, 13 May 2026).
  //   City Circle North 0141-2300281, South 0141-2709537: the Superintending
  //     Engineers' office lines on PHED's Contact Us page. No published map
  //     says which circle serves which ward, so both are listed.
  //   Jaipur Samadhan (portal + Android app; no iOS app) and the call centre
  //     0141-2747400 (8 am to 10 pm): jaipurmc.org home page and Contact Us.
  //   Rajasthan Sampark 181: sampark.rajasthan.gov.in (all departments).
  //   1077: Disaster Management and Relief Department, "Toll Free HelpLine
  //     Number for District".
  // Zone office lines and emails (JMC Administrative Directory) are per zone,
  // so they travel in public/data/jaipur-ward-profiles.json, not here.
  // Officers' mobile numbers on these pages are left out.
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "PHED, through Rajasthan Sampark (toll-free 181)",
        href: "https://sampark.rajasthan.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.report_civic_issue",
        subLabel: "Jaipur Samadhan (Nagar Nigam Jaipur)",
        href: "https://samadhan.jaipurmc.org/ComplaintRegistrationByWebsite/AddComplaintRegistrationByWebsite",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Public Health Engineering Department (PHED), Rajasthan",
        href: "https://phedwater.rajasthan.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      { labelKey: "my_ward.hl_water_complaint", value: "0141 270 6624", href: "tel:01412706624" },
      { labelKey: "my_ward.hl_phed_city_north", value: "0141 230 0281", href: "tel:01412300281" },
      { labelKey: "my_ward.hl_phed_city_south", value: "0141 270 9537", href: "tel:01412709537" },
      { labelKey: "my_ward.hl_corporation_call_centre", value: "0141 274 7400", href: "tel:01412747400" },
      {
        labelKey: "my_ward.hl_corporation_app",
        value: null,
        href: "https://play.google.com/store/apps/details?id=com.oispl.citizen_app",
      },
      { labelKey: "my_ward.hl_state_grievance", value: "181", href: "tel:181" },
      { labelKey: "my_ward.hl_flood_emergency", value: "1077", href: "tel:1077" },
    ],
  },
};
