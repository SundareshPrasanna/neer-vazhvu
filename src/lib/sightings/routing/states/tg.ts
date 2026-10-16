// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Authority, Channel, StateRouting } from "../types";

const HYDRAA_TOLL_FREE_HELPLINE: Channel = { kind: "helpline", label: "HYDRAA toll-free helpline", phone: "1070" };

const HMWSSB_BODY: Authority = {
  acronym: "HMWSSB",
  body: "Hyderabad Metropolitan Water Supply and Sewerage Board",
  channels: [
    { kind: "portal", label: "Register Grievance (HMWSSB website)", tracked: true, url: "https://www.hyderabadwater.gov.in/en/index.php/services/customers-services/register-grievances" },
    { kind: "helpline", label: "Metro Customer Care (MCC)", phone: "155313", tracked: true },
    { kind: "app", label: "HMWSSB Citizen Services app (Android)", url: "https://play.google.com/store/apps/details?id=com.hyderabadwater.hmwssb" },
    { kind: "helpline", label: "HMWSSB customer care landlines", phone: "040-23300114" },
    { kind: "helpline", label: "HMWSSB customer care landlines (second line)", phone: "040-23433933" },
    { kind: "email", label: "HMWSSB customer support", url: "mailto:customer-support@hyderabadwater.gov.in" },
  ],
  source: "https://www.hyderabadwater.gov.in/application/files/7417/3185/0800/updated_citizen_charter.pdf",
};

export const TG: StateRouting = {
  stateCode: "TG",
  checked: "2026-10-16",
  roles: {
    pollution_control: {
      body: "Telangana Pollution Control Board",
      acronym: "TGPCB",
      channels: [
        { kind: "portal", label: "Janavani Kalushyanivarini", url: "https://telangana-ccr.glensserver.com/#/user-login", tracked: true },
        { kind: "helpline", label: "TGPCB toll-free number", phone: "10741" },
        { kind: "helpline", label: "TGPCB head office PBX", phone: "040-23887500" },
      ],
      source: "https://tgpcb.cgg.gov.in/",
    },
    land_revenue: {
      body: "Revenue Department, Government of Telangana (District Collector, Revenue Divisional Officer and Tahsildar of the area)",
      channels: [
        { kind: "portal", label: "Prajavani", url: "https://prajavani.cgg.gov.in/", tracked: true },
      ],
      source: "https://prajavani.cgg.gov.in/",
    },
  },
  places: {
    hyderabad: {
      roles: {
        solid_waste: {
          body: "Municipal corporation of the area: Greater Hyderabad Municipal Corporation (GHMC), Cyberabad Municipal Corporation (CMC) or Malkajgiri Municipal Corporation (MMC)",
          acronym: "GHMC / CMC / MMC",
          channels: [
            { kind: "portal", label: "CURE Integrated Grievance System", url: "https://igs.ghmc.gov.in/operator/send_otp_mobile", tracked: true },
            { kind: "app", label: "My Cure app (Android)", url: "https://play.google.com/store/apps/details?id=cgg.gov.ghmc" },
            { kind: "helpline", label: "GHMC / CURE grievance call centre", phone: "040-21111111" },
          ],
          source: "https://www.ghmc.gov.in/",
        },
        sewerage: HMWSSB_BODY,
        water_supply: HMWSSB_BODY,
        storm_drainage: {
          body: "Municipal corporation of the area: Greater Hyderabad Municipal Corporation (GHMC), Cyberabad Municipal Corporation (CMC) or Malkajgiri Municipal Corporation (MMC)",
          acronym: "GHMC / CMC / MMC",
          channels: [
            { kind: "portal", label: "CURE Integrated Grievance System", url: "https://igs.ghmc.gov.in/operator/send_otp_mobile", tracked: true },
            { kind: "app", label: "My Cure app (Android)", url: "https://play.google.com/store/apps/details?id=cgg.gov.ghmc" },
            { kind: "helpline", label: "GHMC / CURE grievance call centre", phone: "040-21111111" },
            HYDRAA_TOLL_FREE_HELPLINE,
          ],
          source: "https://hydraa.telangana.gov.in/functions/disaster-management",
        },
        water_body: {
          body: "Hyderabad Disaster Response and Asset Protection Agency",
          acronym: "HYDRAA",
          channels: [
            HYDRAA_TOLL_FREE_HELPLINE,
            { kind: "helpline", label: "HYDRAA control room", phone: "9000113667" },
            { kind: "helpline", label: "HYDRAA control room (second line)", phone: "8712406901" },
          ],
          source: "https://hydraa.telangana.gov.in/about",
        },
        pollution_control: {
          body: "Telangana Pollution Control Board (Zonal Office Hyderabad and the regional offices covering the city)",
          acronym: "TGPCB",
          channels: [
            { kind: "portal", label: "Janavani Kalushyanivarini", url: "https://telangana-ccr.glensserver.com/#/user-login", tracked: true },
            { kind: "helpline", label: "TGPCB toll-free number", phone: "10741" },
            { kind: "helpline", label: "TGPCB head office PBX", phone: "040-23887500" },
          ],
          source: "https://tgpcb.cgg.gov.in/Home/GetContentDetails?menuid=1184",
        },
        land_revenue: {
          body: "Hyderabad Disaster Response and Asset Protection Agency",
          acronym: "HYDRAA",
          channels: [
            HYDRAA_TOLL_FREE_HELPLINE,
            { kind: "helpline", label: "HYDRAA control room", phone: "9000113667" },
            { kind: "helpline", label: "HYDRAA control room (second line)", phone: "8712406901" },
          ],
          source: "https://hydraa.telangana.gov.in/",
        },
      },
    },
  },
};
