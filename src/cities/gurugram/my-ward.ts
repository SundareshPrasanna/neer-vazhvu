import type { CityMyWardContent } from "@/content/my-ward/types";

/** My Ward: the source line under each card, and the city's own complaint
 *  portals and helplines (primary-sourced; no entry, no card). */
export const MY_WARD: CityMyWardContent = {
  // GURUGRAM. The city this bug was actually live for: /gurugram/my-ward
  // serves in production and gurugram was missing from this map, so it was
  // rendering Chennai's helplines.
  //
  // Numbers are GMDA's own, read off gmda.gov.in, which publishes them as one
  // line: "For any query, suggestion and complaint about Grievance Redressal
  // Portal (GRAP) pls. contact through following means: Toll free number and
  // PRI Number ( 18001801817, 01242653908) WEB portal ( services.gmda.gov.in )".
  // Nothing here is inferred. MCG's own site serves a 1 KB shell with no
  // contact details at all, so the municipal corporation contributes no
  // verifiable number and none is invented for it.
  actions: {
    quickActions: [
      {
        labelKey: "my_ward.report_issue",
        subLabel: "GMDA grievance redressal (GRAP)",
        href: "https://services.gmda.gov.in/",
        icon: "complaint",
      },
      {
        labelKey: "my_ward.water_supply_portal",
        subLabel: "Gurugram Metropolitan Development Authority",
        href: "https://www.gmda.gov.in/",
        icon: "portal",
      },
    ],
    helplines: [
      {
        labelKey: "my_ward.hl_water_complaint",
        value: "1800 180 1817",
        href: "tel:18001801817",
      },
      {
        // GMDA publishes this PRI line beside the toll-free one for the same
        // grievance portal; carried because a toll-free number is not always
        // reachable from every network.
        labelKey: "my_ward.hl_mmc_helpline",
        value: "0124 265 3908",
        href: "tel:01242653908",
      },
      {
        // Gurugram's tanker supply IS a published sales ledger rather than a
        // booking line - point at it instead of inventing a number.
        labelKey: "my_ward.hl_tanker_booking",
        value: null,
        href: "/gurugram/tanker",
      },
    ],
  },
};
