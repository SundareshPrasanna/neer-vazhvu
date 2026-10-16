import { AUTHORITY_ROLES } from "../taxonomy";
import type { NationalChannel } from "./types";

/**
 * Offered after the place's own channels. Checked 2026-10-16:
 * Swachhata routes to the urban local body by ward boundary and issues a
 * complaint ID (swach.city Integration FAQ v2.1, 27 Aug 2025); CPGRAMS
 * forwards to the State and issues a registration ID. Not offered: Bhuvan
 * Ganga (app download dead), SBM-G grievance link (HTTP 500), CPCB's form
 * (air pollution in Delhi NCR only).
 */
export const NATIONAL_CHANNELS: NationalChannel[] = [
  {
    kind: "app",
    label: "Swachhata-MoHUA app",
    url: "https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat",
    tracked: true,
    roles: ["solid_waste", "sewerage", "storm_drainage"],
    urbanOnly: true,
  },
  {
    kind: "portal",
    label: "CPGRAMS (Government of India grievance portal)",
    url: "https://pgportal.gov.in/",
    tracked: true,
    roles: [...AUTHORITY_ROLES],
  },
];
