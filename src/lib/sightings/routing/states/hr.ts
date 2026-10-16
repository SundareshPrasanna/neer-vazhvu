// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Channel, StateRouting } from "../types";

const CM_WINDOW_GOVERNMENT_OF: Channel = { kind: "portal", label: "CM Window, Government of Haryana (state grievance channel)", tracked: true, url: "https://cmharyanacell.nic.in/cm_window_index" };

const COMPLAINT_HANDLING_SYSTEM_GURUGRAM: Channel = { kind: "portal", label: "Complaint Handling System, Gurugram", tracked: true, url: "https://services.gmda.gov.in/" };

const MYGURUGRAM_ANDROID: Channel = { kind: "app", label: "myGurugram (Android)", url: "https://play.google.com/store/apps/details?id=com.gmda.citizen" };

const GMDA_MCG_COMPLAINT_WHATSAPP: Channel = { kind: "whatsapp", label: "GMDA / MCG complaint WhatsApp", phone: "7840001817", url: "https://wa.me/917840001817" };

const MCG_GMDA_TOLL_FREE: Channel = { kind: "helpline", label: "MCG / GMDA toll-free helpline (24x7)", phone: "1800-180-1817" };

export const HR: StateRouting = {
  stateCode: "HR",
  checked: "2026-10-16",
  roles: {
    water_body: {
      body: "Haryana Pond and Waste Water Management Authority",
      acronym: "HPWWMA",
      channels: [
        CM_WINDOW_GOVERNMENT_OF,
        { kind: "portal", label: "Irrigation & Water Resources Dept, Haryana - Shikayat Nivaran Kendra", url: "https://systems.hid.gov.in/snk/", tracked: true },
        { kind: "portal", label: "HPWWMA Grievance Redressal Mechanism (GRM)", url: "https://pdms.hpwwma.org.in/GRM/LoginPage.aspx" },
        { kind: "helpline", label: "Irrigation & Water Resources Dept, Haryana - Shikayat Nivaran Kendra", phone: "86999-50177" },
      ],
      source: "https://hpwwma.org.in/",
    },
    pollution_control: {
      body: "Haryana State Pollution Control Board",
      acronym: "HSPCB",
      channels: [
        CM_WINDOW_GOVERNMENT_OF,
        { kind: "helpline", label: "HSPCB Head Office, Panchkula", phone: "0172-2577872" },
        { kind: "email", label: "HSPCB Head Office email", url: "mailto:hqhspcb@hspcb.org.in" },
      ],
      source: "https://hspcb.org.in/page/head-office",
    },
    land_revenue: {
      body: "Revenue & Disaster Management Department, Haryana (Deputy Commissioner as Collector, SDMs and Tehsildars in each district)",
      channels: [
        CM_WINDOW_GOVERNMENT_OF,
      ],
      source: "https://revenueharyana.gov.in/",
    },
  },
  places: {
    gurugram: {
      roles: {
        solid_waste: {
          body: "Municipal Corporation of Gurugram",
          acronym: "MCG",
          channels: [
            COMPLAINT_HANDLING_SYSTEM_GURUGRAM,
            { kind: "portal", label: "MCG 24 Hours Challenge", url: "https://mcg.gov.in/24hr-challenge", tracked: true },
            CM_WINDOW_GOVERNMENT_OF,
            MYGURUGRAM_ANDROID,
            GMDA_MCG_COMPLAINT_WHATSAPP,
            MCG_GMDA_TOLL_FREE,
          ],
          source: "https://mcg.gov.in/",
        },
        sewerage: {
          body: "Municipal Corporation of Gurugram (internal sewers) and Gurugram Metropolitan Development Authority (master sewers and STPs)",
          acronym: "MCG / GMDA",
          channels: [
            COMPLAINT_HANDLING_SYSTEM_GURUGRAM,
            { kind: "portal", label: "MCG 24 Hours Challenge", url: "https://mcg.gov.in/24hr-challenge", tracked: true },
            CM_WINDOW_GOVERNMENT_OF,
            MYGURUGRAM_ANDROID,
            GMDA_MCG_COMPLAINT_WHATSAPP,
            MCG_GMDA_TOLL_FREE,
          ],
          source: "https://gmda.gov.in/",
        },
        water_supply: {
          body: "Municipal Corporation of Gurugram (internal distribution) and Gurugram Metropolitan Development Authority (master supply and treatment)",
          acronym: "MCG / GMDA",
          channels: [
            COMPLAINT_HANDLING_SYSTEM_GURUGRAM,
            CM_WINDOW_GOVERNMENT_OF,
            MYGURUGRAM_ANDROID,
            GMDA_MCG_COMPLAINT_WHATSAPP,
            MCG_GMDA_TOLL_FREE,
          ],
          source: "https://gmda.gov.in/news.html",
        },
        storm_drainage: {
          body: "Gurugram Metropolitan Development Authority (master storm drains) and Municipal Corporation of Gurugram (internal drains)",
          acronym: "GMDA / MCG",
          channels: [
            COMPLAINT_HANDLING_SYSTEM_GURUGRAM,
            CM_WINDOW_GOVERNMENT_OF,
            MYGURUGRAM_ANDROID,
            GMDA_MCG_COMPLAINT_WHATSAPP,
            MCG_GMDA_TOLL_FREE,
          ],
          source: "https://gmda.gov.in/news.html",
        },
        water_body: {
          body: "Haryana Pond and Waste Water Management Authority",
          acronym: "HPWWMA",
          channels: [
            COMPLAINT_HANDLING_SYSTEM_GURUGRAM,
            CM_WINDOW_GOVERNMENT_OF,
            { kind: "portal", label: "Irrigation & Water Resources Dept, Haryana - Shikayat Nivaran Kendra", url: "https://systems.hid.gov.in/snk/", tracked: true },
            { kind: "portal", label: "HPWWMA Grievance Redressal Mechanism (GRM)", url: "https://pdms.hpwwma.org.in/GRM/LoginPage.aspx" },
            { kind: "helpline", label: "Irrigation & Water Resources Dept, Haryana - Shikayat Nivaran Kendra", phone: "86999-50177" },
          ],
          source: "https://hpwwma.org.in/",
        },
        pollution_control: {
          body: "Haryana State Pollution Control Board, Regional Offices Gurugram North and Gurugram South",
          acronym: "HSPCB",
          channels: [
            CM_WINDOW_GOVERNMENT_OF,
            { kind: "helpline", label: "HSPCB Regional Office Gurugram North (office landline)", phone: "0124-2332775" },
            { kind: "helpline", label: "HSPCB Regional Office Gurugram South (office landline)", phone: "0124-2290207" },
            { kind: "email", label: "HSPCB Regional Office Gurugram North", url: "mailto:hspcbrogrn@gmail.com" },
            { kind: "email", label: "HSPCB Regional Office Gurugram South", url: "mailto:hspcbrogrs@gmail.com" },
          ],
          source: "https://hspcb.org.in/page/regional-office",
        },
        land_revenue: {
          body: "Deputy Commissioner (Collector), Gurugram, with SDMs and Tehsildars, for revenue land; GMDA Enforcement Wing for encroachment in GMDA areas",
          acronym: "DC Gurugram / GMDA",
          channels: [
            CM_WINDOW_GOVERNMENT_OF,
            { kind: "portal", label: "GMDA Anti-Encroachment Portal", url: "https://gmda.gov.in/anti-encroachment/", tracked: true },
            { kind: "helpline", label: "Mines & Geology Department, Haryana", phone: "1800-180-5530" },
          ],
          source: "https://gurugram.gov.in/about-district/administrative-setup/",
        },
      },
    },
  },
};
