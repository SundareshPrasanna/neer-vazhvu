import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  // PUNE. Added WITH the cutover rather than after it, because line 152 reads
  // `ACTIONS_BY_CITY[cityId] ?? ACTIONS_BY_CITY.chennai` - a missing city does
  // not render an empty card, it renders CHENNAI'S HELPLINES. A Pune resident
  // would have been given CMWSSB's number.
  //
  // The toll-free number is PMC's own, read off its grievance portal
  // (complaint.pmc.gov.in) where it is captioned in Marathi as the call centre
  // for "सूचना आणि तक्रारींसाठी" - suggestions and complaints. Nothing here is
  // inferred: PMC publishes no separate water-supply or flood number that
  // could be verified, so those entries carry value:null and a URL rather than
  // a plausible-looking digit string.
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "PMC grievance portal",
        href: "https://complaint.pmc.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Pune Municipal Corporation",
        href: "https://pmc.gov.in/en/grievance",
        icon: "portal",
      },
    ],
    helplines: [
      {
        labelKey: "my_ward.hl_water_complaint",
        value: "1800 1030 222",
        href: "tel:18001030222",
      },
      {
        // PMC dispatches tankers but publishes no booking line: the daily
        // registers behind /pune/tanker are a record of what was sent, not a
        // way to ask. Points at that page rather than inventing a number.
        labelKey: "my_ward.hl_tanker_booking",
        value: null,
        href: "/pune/tanker",
      },
    ],
  },
};
