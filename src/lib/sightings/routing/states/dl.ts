// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Authority, Channel, StateRouting } from "../types";

const CM_JAN_SUNWAI_PORTAL: Channel = { kind: "portal", label: "CM Jan Sunwai Portal", tracked: true, url: "https://cmjansunwai.delhi.gov.in/" };

const DJB_BODY: Authority = {
  acronym: "DJB",
  body: "Delhi Jal Board",
  channels: [
    CM_JAN_SUNWAI_PORTAL,
    { kind: "helpline", label: "PUNAL IVR (24x7)", phone: "1916", tracked: true },
    { kind: "app", label: "DJB1916Seva app (Android)", url: "https://play.google.com/store/apps/details?id=in.gov.delhi.delhijalboard" },
    { kind: "whatsapp", label: "DJB WhatsApp complaints", phone: "9650291021" },
    { kind: "helpline", label: "DJB toll-free line (listed with 1916)", phone: "1800117118" },
    { kind: "email", label: "DJB grievances email", url: "mailto:grievances-djb@delhi.gov.in" },
  ],
  source: "https://delhijalboard.delhi.gov.in/jalboard/important-phone-numbers-complaints-redressal",
};

export const DL: StateRouting = {
  stateCode: "DL",
  checked: "2026-10-16",
  roles: {
    water_body: {
      body: "Wetland Authority of Delhi (Department of Environment, GNCTD; secretariat at Delhi Parks and Gardens Society)",
      channels: [
        CM_JAN_SUNWAI_PORTAL,
        { kind: "app", label: "DDA 311 app 'DDA at Your Service' (Android)", url: "https://play.google.com/store/apps/details?id=com.everythingcivic.dda" },
        { kind: "helpline", label: "Wetland Authority of Delhi / DPGS office telephone", phone: "011-23392736" },
        { kind: "email", label: "Wetland Authority of Delhi / DPGS office email", url: "mailto:ceodpgsenv.delhi@nic.in" },
      ],
      source: "https://dpgs.delhi.gov.in/sites/default/files/DPGS/universal-tab/directions_all_wbos_1.pdf",
    },
    pollution_control: {
      body: "Delhi Pollution Control Committee",
      acronym: "DPCC",
      channels: [
        CM_JAN_SUNWAI_PORTAL,
        { kind: "app", label: "Green Delhi App (Android)", url: "https://play.google.com/store/apps/details?id=com.green_delhi_teste" },
        { kind: "email", label: "DPCC Member Secretary's office", url: "mailto:msdpcc@nic.in" },
      ],
      source: "https://dpcc.delhi.gov.in/dpcc/citizen-charter",
    },
    land_revenue: {
      body: "Revenue Department, GNCTD (Divisional Commissioner; District Magistrates / Deputy Commissioners and SDMs of the 13 revenue districts)",
      channels: [
        { kind: "app", label: "CM Jansunwai app (Android)", url: "https://play.google.com/store/apps/details?id=com.nic.dl.delhijanmitra", tracked: true },
        CM_JAN_SUNWAI_PORTAL,
      ],
      source: "https://revenue.delhi.gov.in/",
    },
  },
  places: {
    delhi: {
      roles: {
        solid_waste: {
          body: "Municipal Corporation of Delhi",
          acronym: "MCD",
          channels: [
            { kind: "app", label: "MCD 311 app (Android)", url: "https://play.google.com/store/apps/details?id=com.everythingcivic.mcd", tracked: true },
            { kind: "portal", label: "MCD 311 web complaint form", url: "https://mcd.everythingcivic.com/citizen/createissue?app_id=U2FsdGVkX180J3mGnJmT5QpgtPjhfjtzyXAAccBUxGU%3D&api_key=e34ba86d3943bd6db9120313da011937189e6a9625170905750f649395bcd68312cf10d264c9305d57c23688cc2e5120", tracked: true },
            { kind: "app", label: "Green Delhi App (Android)", url: "https://play.google.com/store/apps/details?id=com.green_delhi_teste" },
            { kind: "helpline", label: "MCD Citizen's Call Center", phone: "155305" },
          ],
          source: "https://mcdonline.nic.in/portal",
        },
        sewerage: DJB_BODY,
        water_supply: DJB_BODY,
        storm_drainage: {
          body: "Municipal Corporation of Delhi (colony and local drains)",
          acronym: "MCD",
          channels: [
            { kind: "app", label: "MCD 311 app (Android)", url: "https://play.google.com/store/apps/details?id=com.everythingcivic.mcd", tracked: true },
            { kind: "portal", label: "MCD 311 web complaint form", url: "https://mcd.everythingcivic.com/citizen/createissue?app_id=U2FsdGVkX180J3mGnJmT5QpgtPjhfjtzyXAAccBUxGU%3D&api_key=e34ba86d3943bd6db9120313da011937189e6a9625170905750f649395bcd68312cf10d264c9305d57c23688cc2e5120", tracked: true },
            CM_JAN_SUNWAI_PORTAL,
            { kind: "app", label: "PWD Sewa 2.0 app (Android)", url: "https://play.google.com/store/apps/details?id=com.sis.pwdsewaapp" },
            { kind: "whatsapp", label: "PWD Sewa WhatsApp chatbot", phone: "8130188222" },
            { kind: "helpline", label: "MCD Citizen's Call Center", phone: "155305" },
            { kind: "helpline", label: "PWD toll-free helpline", phone: "1908" },
            { kind: "helpline", label: "I&FC Department flood control room", phone: "011-21210867" },
          ],
          source: "https://ifc.delhi.gov.in/ifc/flood-control-rooms",
        },
      },
    },
  },
};
