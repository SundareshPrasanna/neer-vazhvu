// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Channel, StateRouting } from "../types";

const JANASPANDANA_PRAJA_SEVE_IPGRS: Channel = { kind: "portal", label: "Janaspandana / Praja Seve iPGRS", tracked: true, url: "https://ipgrs.karnataka.gov.in/" };

const KSPCB_INTEGRATED_COMMAND_CONTROL: Channel = { kind: "helpline", label: "KSPCB Integrated Command Control Centre (pollution complaints)", phone: "080-25582559" };

const PRAJA_SEVE_GRIEVANCE_HELPLINE: Channel = { kind: "helpline", label: "Praja Seve grievance helpline", phone: "1902" };

const NAMMA_BENGALURU_SAHAAYA_2: Channel = { kind: "app", label: "Namma Bengaluru (Sahaaya 2.0) app (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.nammabengaluruNew.org" };

const GBA_TOLL_FREE_HELPLINE: Channel = { kind: "helpline", label: "GBA toll-free helpline", phone: "1533" };

const SAHAAYA_2_0_PUBLIC: Channel = { kind: "portal", label: "Sahaaya 2.0 public grievance (web)", tracked: true, url: "https://nammabengaluru.org.in/login" };

const IPGRS_GRAM_PANCHAYAT_GRIEVANCES: Channel = { kind: "portal", label: "iPGRS - Gram Panchayat grievances", tracked: true, url: "https://ipgrs.karnataka.gov.in/Home/Index?str=citizeneng" };

const PANCHAMITRA_RDPR_HELPLINE: Channel = { kind: "helpline", label: "Panchamitra / RDPR helpline", phone: "8277506000" };

export const KA: StateRouting = {
  stateCode: "KA",
  checked: "2026-10-16",
  roles: {
    water_body: {
      body: "Karnataka Tank Conservation and Development Authority",
      acronym: "KTCDA",
      channels: [
        { kind: "helpline", label: "KTCDA head office, Bengaluru", phone: "080-23513711" },
        { kind: "email", label: "KTCDA head office email", url: "mailto:ktcda2018@gmail.com" },
      ],
      source: "https://ktcda.karnataka.gov.in/13/functions/en",
    },
    pollution_control: {
      body: "Karnataka State Pollution Control Board",
      acronym: "KSPCB",
      channels: [
        JANASPANDANA_PRAJA_SEVE_IPGRS,
        KSPCB_INTEGRATED_COMMAND_CONTROL,
        { kind: "email", label: "KSPCB ICCC complaints email", url: "mailto:iccc.kspcb@gmail.com" },
      ],
      source: "https://kspcb.karnataka.gov.in/node/520",
    },
    land_revenue: {
      body: "Revenue Department, Government of Karnataka (Deputy Commissioner / Tahsildar of the district)",
      channels: [
        JANASPANDANA_PRAJA_SEVE_IPGRS,
        PRAJA_SEVE_GRIEVANCE_HELPLINE,
      ],
      source: "https://ipgrs.karnataka.gov.in/",
    },
  },
  places: {
    bangalore: {
      roles: {
        solid_waste: {
          body: "Bengaluru Solid Waste Management Limited",
          acronym: "BSWML",
          channels: [
            NAMMA_BENGALURU_SAHAAYA_2,
            { kind: "whatsapp", label: "BSWML WhatsApp chatbot", url: "https://wa.me/919448197197?text=Hi", phone: "9448197197", tracked: true },
            { kind: "portal", label: "Greater Bengaluru Authority web portal", url: "https://gba.karnataka.gov.in/" },
            GBA_TOLL_FREE_HELPLINE,
          ],
          source: "https://bswml.karnataka.gov.in/174/register-complaint/en",
        },
        sewerage: {
          body: "Bangalore Water Supply and Sewerage Board",
          acronym: "BWSSB",
          channels: [
            { kind: "helpline", label: "BWSSB call centre", phone: "1916" },
            { kind: "helpline", label: "SafaiMitra helpline (sewer/septic cleaning)", phone: "14420" },
            { kind: "email", label: "BWSSB call centre email", url: "mailto:callcenter@bwssb.gov.in" },
          ],
          source: "https://bwssb.karnataka.gov.in/5/contact-info/en",
        },
        water_supply: {
          body: "Bangalore Water Supply and Sewerage Board",
          acronym: "BWSSB",
          channels: [
            { kind: "helpline", label: "BWSSB call centre", phone: "1916" },
            { kind: "email", label: "BWSSB call centre email", url: "mailto:callcenter@bwssb.gov.in" },
          ],
          source: "https://bwssb.karnataka.gov.in/5/contact-info/en",
        },
        storm_drainage: {
          body: "Greater Bengaluru Authority and its five city corporations",
          acronym: "GBA",
          channels: [
            NAMMA_BENGALURU_SAHAAYA_2,
            SAHAAYA_2_0_PUBLIC,
            GBA_TOLL_FREE_HELPLINE,
          ],
          source: "https://gba.karnataka.gov.in/",
        },
        water_body: {
          body: "Greater Bengaluru Authority (lakes)",
          acronym: "GBA",
          channels: [
            NAMMA_BENGALURU_SAHAAYA_2,
            SAHAAYA_2_0_PUBLIC,
            GBA_TOLL_FREE_HELPLINE,
          ],
          source: "https://gba.karnataka.gov.in/",
        },
        pollution_control: {
          body: "Karnataka State Pollution Control Board, Bengaluru regional offices",
          acronym: "KSPCB",
          channels: [
            KSPCB_INTEGRATED_COMMAND_CONTROL,
            { kind: "email", label: "KSPCB ICCC complaints email", url: "mailto:iccc.kspcb@gmail.com" },
          ],
          source: "https://kspcb.karnataka.gov.in/contact-us-0",
        },
        land_revenue: {
          body: "Revenue Department - Deputy Commissioner, Bengaluru Urban district (taluk Tahsildars)",
          channels: [
            JANASPANDANA_PRAJA_SEVE_IPGRS,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
            { kind: "helpline", label: "DC Office Bengaluru Urban", phone: "080-22211106" },
          ],
          source: "https://bengaluruurban.nic.in/en/grievance-redressal/",
        },
      },
      corporations: {
        central: {
          storm_drainage: {
            body: "Bengaluru Central City Corporation (engineering / storm water drains), under the Greater Bengaluru Authority",
            acronym: "BCCC",
            channels: [
              NAMMA_BENGALURU_SAHAAYA_2,
              SAHAAYA_2_0_PUBLIC,
              { kind: "helpline", label: "Bengaluru Central City Corporation helpline", phone: "9480685702" },
              { kind: "helpline", label: "Bengaluru Central City Corporation helpline", phone: "080-22975803" },
              GBA_TOLL_FREE_HELPLINE,
            ],
            source: "https://bengalurucentral.karnataka.gov.in/home",
          },
        },
        north: {
          storm_drainage: {
            body: "Bengaluru North City Corporation (engineering / storm water drains), under the Greater Bengaluru Authority",
            acronym: "BNCC",
            channels: [
              NAMMA_BENGALURU_SAHAAYA_2,
              SAHAAYA_2_0_PUBLIC,
              { kind: "helpline", label: "Bengaluru North City Corporation helpline", phone: "9480685705" },
              { kind: "helpline", label: "Bengaluru North City Corporation helpline", phone: "080-28636671" },
              { kind: "helpline", label: "Bengaluru North City Corporation helpline", phone: "080-22975936" },
              GBA_TOLL_FREE_HELPLINE,
            ],
            source: "https://bengalurunorth.karnataka.gov.in/home",
          },
        },
        south: {
          storm_drainage: {
            body: "Bengaluru South City Corporation (engineering / storm water drains), under the Greater Bengaluru Authority",
            acronym: "BSCC",
            channels: [
              NAMMA_BENGALURU_SAHAAYA_2,
              SAHAAYA_2_0_PUBLIC,
              { kind: "helpline", label: "Bengaluru South City Corporation helpline", phone: "9480685704" },
              { kind: "helpline", label: "Bengaluru South City Corporation helpline", phone: "080-26566362" },
              { kind: "helpline", label: "Bengaluru South City Corporation helpline", phone: "080-22975703" },
              GBA_TOLL_FREE_HELPLINE,
            ],
            source: "https://bengalurusouth.karnataka.gov.in/home",
          },
        },
        east: {
          storm_drainage: {
            body: "Bengaluru East City Corporation (engineering / storm water drains), under the Greater Bengaluru Authority",
            acronym: "BECC",
            channels: [
              NAMMA_BENGALURU_SAHAAYA_2,
              SAHAAYA_2_0_PUBLIC,
              { kind: "helpline", label: "Bengaluru East City Corporation helpline", phone: "9480685706" },
              { kind: "helpline", label: "Bengaluru East City Corporation helpline", phone: "080-28512300" },
              { kind: "helpline", label: "Bengaluru East City Corporation helpline", phone: "080-28512301" },
              GBA_TOLL_FREE_HELPLINE,
            ],
            source: "https://bengalurueast.karnataka.gov.in/home",
          },
        },
        west: {
          storm_drainage: {
            body: "Bengaluru West City Corporation (engineering / storm water drains), under the Greater Bengaluru Authority",
            acronym: "BWCC",
            channels: [
              NAMMA_BENGALURU_SAHAAYA_2,
              SAHAAYA_2_0_PUBLIC,
              { kind: "helpline", label: "Bengaluru West City Corporation helpline", phone: "9480685703" },
              { kind: "helpline", label: "Bengaluru West City Corporation helpline", phone: "080-23561692" },
              { kind: "helpline", label: "Bengaluru West City Corporation helpline", phone: "080-23463366" },
              GBA_TOLL_FREE_HELPLINE,
            ],
            source: "https://bengaluruwest.karnataka.gov.in/home",
          },
        },
      },
    },
    "ka-kolar": {
      roles: {
        solid_waste: {
          body: "Gram Panchayat (Rural Development and Panchayat Raj Department)",
          acronym: "RDPR",
          channels: [
            IPGRS_GRAM_PANCHAYAT_GRIEVANCES,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
            PANCHAMITRA_RDPR_HELPLINE,
          ],
          source: "https://panchamitra.karnataka.gov.in/Home/RDPR_Grievances_via_IPGRS_Portal",
        },
        sewerage: {
          body: "Gram Panchayat, with the Rural Drinking Water and Sanitation Department",
          acronym: "RDWSD",
          channels: [
            IPGRS_GRAM_PANCHAYAT_GRIEVANCES,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
            PANCHAMITRA_RDPR_HELPLINE,
          ],
          source: "https://panchamitra.karnataka.gov.in/Home/RDPR_Grievances_via_IPGRS_Portal",
        },
        water_supply: {
          body: "Rural Drinking Water and Sanitation Department (with the Gram Panchayat)",
          acronym: "RDWSD",
          channels: [
            IPGRS_GRAM_PANCHAYAT_GRIEVANCES,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
            { kind: "helpline", label: "Panchamitra helpline", phone: "8277506000" },
          ],
          source: "https://panchamitra.karnataka.gov.in/Home/RDPR_Grievances_via_IPGRS_Portal",
        },
        storm_drainage: {
          body: "Gram Panchayat (Karnataka Panchayat Raj Commissionerate)",
          channels: [
            IPGRS_GRAM_PANCHAYAT_GRIEVANCES,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
            PANCHAMITRA_RDPR_HELPLINE,
          ],
          source: "https://panchamitra.karnataka.gov.in/Home/RDPR_Grievances_via_IPGRS_Portal",
        },
        water_body: {
          body: "Minor Irrigation and Ground Water Development Department (Kolar division) for tanks with atchkat 40-2000 ha; Zilla Panchayat (Panchayat Raj Engineering Dept) for smaller tanks",
          acronym: "MI&GWD",
          channels: [
            JANASPANDANA_PRAJA_SEVE_IPGRS,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
          ],
          source: "https://minorirrigation.karnataka.gov.in/12/about-us/en",
        },
        pollution_control: {
          body: "Karnataka State Pollution Control Board - Regional Office, Kolar",
          acronym: "KSPCB",
          channels: [
            { kind: "helpline", label: "KSPCB Regional Office Kolar (office line)", phone: "08152-243199" },
            KSPCB_INTEGRATED_COMMAND_CONTROL,
            { kind: "email", label: "KSPCB Regional Office Kolar", url: "mailto:kolar@kspcb.gov.in" },
          ],
          source: "https://kspcb.karnataka.gov.in/contact-us-0",
        },
        land_revenue: {
          body: "Revenue Department - Deputy Commissioner, Kolar (taluk Tahsildars)",
          channels: [
            JANASPANDANA_PRAJA_SEVE_IPGRS,
            PRAJA_SEVE_GRIEVANCE_HELPLINE,
            { kind: "helpline", label: "Deputy Commissioner Office, Kolar", phone: "08152-243500" },
            { kind: "email", label: "Deputy Commissioner Office, Kolar", url: "mailto:dcoffice.klr@gmail.com" },
          ],
          source: "https://kolar.nic.in/en/service/how-to-lodge-a-grievance/",
        },
      },
    },
  },
};
