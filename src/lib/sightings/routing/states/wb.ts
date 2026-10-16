// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Authority, Channel, StateRouting } from "../types";

const WEST_BENGAL_PARIBESH_APP: Channel = { kind: "app", label: "West Bengal Paribesh App (Android)", url: "https://play.google.com/store/apps/details?id=in.gov.wbpcb.paribeshapp" };

const WBPCB_TOLL_FREE_HELPLINE: Channel = { kind: "helpline", label: "WBPCB toll-free helpline (16x6)", phone: "1800-345-3390" };

const WB_CHIEF_MINISTER_S: Channel = { kind: "portal", label: "WB Chief Minister's Office grievance portal 'Apnar Sarkar, Apnar Pashe'", tracked: true, url: "https://cmo.wb.gov.in/" };

const CM_S_OFFICE_GRIEVANCE: Channel = { kind: "helpline", label: "CM's Office grievance help desk", phone: "82820 82820" };

const KMC_GRIEVANCE_PORTAL: Channel = { kind: "portal", label: "KMC grievance portal", tracked: true, url: "https://kmc.wb.gov.in/citizen/language-selection" };

const KMC_WHATSAPP_FOR_COMPLAINTS: Channel = { kind: "whatsapp", label: "KMC WhatsApp for complaints", phone: "8335988888" };

const KMC_CALL_CENTRE: Channel = { kind: "helpline", label: "KMC Call Centre", phone: "1800-345-3375" };

const KMC_CALL_CENTRE_2: Channel = { kind: "helpline", label: "KMC Call Centre", phone: "033-2226-9909" };

const KMC_CONTROL_ROOM: Channel = { kind: "helpline", label: "KMC Control Room", phone: "033-2286-1212" };

const KMC_CONTROL_ROOM_SECOND: Channel = { kind: "helpline", label: "KMC Control Room (second line)", phone: "033-2286-1313" };

const KMC_CONTROL_ROOM_SECOND_2: Channel = { kind: "helpline", label: "KMC Control Room (second line)", phone: "033-2286-1414" };

const BMC_GRIEVANCE_NUMBER: Channel = { kind: "helpline", label: "BMC grievance number", phone: "6292234126" };

const BMC_POURA_BHAWAN_OFFICE: Channel = { kind: "helpline", label: "BMC Poura Bhawan office, Salt Lake Sector III", phone: "033-2334-0314" };

const BMC_OFFICIAL_CONTACT_EMAIL: Channel = { kind: "email", label: "BMC official contact email", url: "mailto:bidhannagar.corporation@gmail.com" };

const MUNICIPALITY_WEBSITE_FEEDBACK_FORM: Channel = { kind: "portal", label: "Municipality website feedback form", url: "https://www.budgebudgemunicipality.org/feedback.php" };

const BUDGE_BUDGE_MUNICIPALITY_OFFICE: Channel = { kind: "helpline", label: "Budge Budge Municipality office", phone: "033-2470-1540" };

const BUDGE_BUDGE_MUNICIPALITY_OFFICE_2: Channel = { kind: "helpline", label: "Budge Budge Municipality office", phone: "033-2470-1224" };

const BUDGE_BUDGE_MUNICIPALITY_OFFICE_3: Channel = { kind: "helpline", label: "Budge Budge Municipality office", phone: "033-2470-1885" };

const KMC_BODY: Authority = {
  acronym: "KMC",
  body: "Kolkata Municipal Corporation - Sewerage & Drainage Department",
  channels: [
    KMC_GRIEVANCE_PORTAL,
    KMC_WHATSAPP_FOR_COMPLAINTS,
    KMC_CALL_CENTRE,
    KMC_CALL_CENTRE_2,
    KMC_CONTROL_ROOM,
    KMC_CONTROL_ROOM_SECOND,
    KMC_CONTROL_ROOM_SECOND_2,
  ],
  source: "https://www.kmcgov.in/KMCPortal/jsp/KMCDrainageHome.jsp",
};

const KMC_BODY_2: Authority = {
  acronym: "KMC",
  body: "Kolkata Municipal Corporation",
  channels: [
    KMC_GRIEVANCE_PORTAL,
    KMC_CALL_CENTRE,
    KMC_CALL_CENTRE_2,
  ],
  source: "https://www.kmcgov.in/KMCPortal/downloads/EnvironmentPlan_KMC_2021.pdf",
};

export const WB: StateRouting = {
  stateCode: "WB",
  checked: "2026-10-16",
  roles: {
    pollution_control: {
      body: "West Bengal Pollution Control Board",
      acronym: "WBPCB",
      channels: [
        WEST_BENGAL_PARIBESH_APP,
        WBPCB_TOLL_FREE_HELPLINE,
        { kind: "helpline", label: "WBPCB Public Grievance Cell", phone: "033-2320-0042" },
        { kind: "email", label: "WBPCB head office", url: "mailto:net.wbpcb-wb@bangla.gov.in" },
      ],
      source: "https://www.wbpcb.gov.in/public-grievance-redressal",
    },
    land_revenue: {
      body: "Land & Land Reforms and Refugee Relief & Rehabilitation Department, Government of West Bengal (through District Magistrate & Collector, DL&LRO, BL&LRO)",
      acronym: "L&LR&RR&R Dept",
      channels: [
        WB_CHIEF_MINISTER_S,
        CM_S_OFFICE_GRIEVANCE,
      ],
      source: "https://banglarbhumi.gov.in/BanglarBhumi/Home.action",
    },
  },
  places: {
    kolkata: {
      roles: {
        water_body: {
          body: "Irrigation & Waterways Department, Government of West Bengal",
          acronym: "I&WD",
          channels: [
            WB_CHIEF_MINISTER_S,
            { kind: "portal", label: "I&WD online grievance / suggestion form", url: "https://iwd.wb.gov.in/Grievances" },
            { kind: "helpline", label: "I&WD Central Flood Control Room, Jalasampad Bhavan (toll-free)", phone: "1800-345-0117" },
            { kind: "helpline", label: "I&WD Central Flood Control Room, Jalasampad Bhavan", phone: "033-2321-8341" },
          ],
          source: "https://www.greentribunal.gov.in/sites/default/files/news_updates/Compliance%20affidavit%20filed%20by%20_4%2C%20Irrigation%20%26%20Waterways%2C%20WB%2C%20page%20207-220.pdf",
        },
      },
      corporations: {
        kmc: {
          solid_waste: {
            body: "Kolkata Municipal Corporation - Solid Waste Management Department",
            acronym: "KMC",
            channels: [
              KMC_GRIEVANCE_PORTAL,
              KMC_WHATSAPP_FOR_COMPLAINTS,
              KMC_CALL_CENTRE,
              KMC_CALL_CENTRE_2,
              KMC_CONTROL_ROOM,
              KMC_CONTROL_ROOM_SECOND,
              KMC_CONTROL_ROOM_SECOND_2,
            ],
            source: "https://www.kmcgov.in/KMCPortal/jsp/SolidWaste.jsp",
          },
          sewerage: KMC_BODY,
          water_supply: {
            body: "Kolkata Municipal Corporation - Water Supply Department",
            acronym: "KMC",
            channels: [
              KMC_GRIEVANCE_PORTAL,
              KMC_WHATSAPP_FOR_COMPLAINTS,
              KMC_CALL_CENTRE,
              KMC_CALL_CENTRE_2,
            ],
            source: "https://www.kmcgov.in/KMCPortal/jsp/WaterSupply.jsp",
          },
          storm_drainage: KMC_BODY,
          water_body: KMC_BODY_2,
          pollution_control: {
            body: "West Bengal Pollution Control Board - Kolkata, Salt Lake and Alipore Regional Offices",
            acronym: "WBPCB",
            channels: [
              WEST_BENGAL_PARIBESH_APP,
              WBPCB_TOLL_FREE_HELPLINE,
              { kind: "helpline", label: "WBPCB Kolkata Regional Office", phone: "033-2320-0059" },
              { kind: "helpline", label: "WBPCB Salt Lake Regional Office", phone: "033-2320-0097" },
              { kind: "helpline", label: "WBPCB Alipore Regional Office", phone: "033-2448-5554" },
            ],
            source: "https://www.wbpcb.gov.in/offices-&-laboratories-of-wbpcb",
          },
          land_revenue: KMC_BODY_2,
        },
        bidhannagar: {
          solid_waste: {
            body: "Bidhannagar Municipal Corporation - Conservancy (Solid Waste Management) Department",
            acronym: "BMC",
            channels: [
              WB_CHIEF_MINISTER_S,
              BMC_GRIEVANCE_NUMBER,
              BMC_POURA_BHAWAN_OFFICE,
              BMC_OFFICIAL_CONTACT_EMAIL,
            ],
            source: "https://www.bmcwbgov.in/index.php/facilities/waste-management",
          },
          sewerage: {
            body: "Bidhannagar Municipal Corporation - Public Health Engineering (PHE) Department",
            acronym: "BMC",
            channels: [
              WB_CHIEF_MINISTER_S,
              BMC_GRIEVANCE_NUMBER,
              BMC_POURA_BHAWAN_OFFICE,
              BMC_OFFICIAL_CONTACT_EMAIL,
            ],
            source: "https://www.bmcwbgov.in/index.php/services-operations/water-supply-services",
          },
          water_supply: {
            body: "Bidhannagar Municipal Corporation - Public Health Engineering (PHE) Department (Water)",
            acronym: "BMC",
            channels: [
              WB_CHIEF_MINISTER_S,
              { kind: "portal", label: "BMC online water tanker / ferrule services (not a complaint portal)", url: "https://ftb.bmcwbgov.in/" },
              BMC_GRIEVANCE_NUMBER,
              BMC_POURA_BHAWAN_OFFICE,
              BMC_OFFICIAL_CONTACT_EMAIL,
            ],
            source: "https://www.bmcwbgov.in/index.php/services-operations/water-supply-services",
          },
          storm_drainage: {
            body: "Bidhannagar Municipal Corporation - Public Health Engineering (PHE) / Sewerage & Drainage",
            acronym: "BMC",
            channels: [
              WB_CHIEF_MINISTER_S,
              BMC_GRIEVANCE_NUMBER,
              BMC_POURA_BHAWAN_OFFICE,
              BMC_OFFICIAL_CONTACT_EMAIL,
            ],
            source: "https://www.bmcwbgov.in/index.php/services-operations/water-supply-services",
          },
          water_body: {
            body: "Irrigation & Waterways Department, Government of West Bengal (canals); BMC for municipal ponds",
            acronym: "I&WD",
            channels: [
              WB_CHIEF_MINISTER_S,
              { kind: "portal", label: "I&WD online grievance / suggestion form", url: "https://iwd.wb.gov.in/Grievances" },
              { kind: "helpline", label: "I&WD Central Flood Control Room, Jalasampad Bhavan (toll-free)", phone: "1800-345-0117" },
              { kind: "helpline", label: "I&WD Central Flood Control Room, Jalasampad Bhavan", phone: "033-2321-8341" },
            ],
            source: "https://www.greentribunal.gov.in/sites/default/files/news_updates/Compliance%20affidavit%20filed%20by%20_4%2C%20Irrigation%20%26%20Waterways%2C%20WB%2C%20page%20207-220.pdf",
          },
          pollution_control: {
            body: "West Bengal Pollution Control Board - Salt Lake Regional Office",
            acronym: "WBPCB",
            channels: [
              WEST_BENGAL_PARIBESH_APP,
              WBPCB_TOLL_FREE_HELPLINE,
              { kind: "helpline", label: "WBPCB Salt Lake Regional Office", phone: "033-2320-0097" },
            ],
            source: "https://www.wbpcb.gov.in/offices-&-laboratories-of-wbpcb",
          },
          land_revenue: {
            body: "District Magistrate & Collector, North 24 Parganas - District Land & Land Reforms Office (DL&LRO)",
            acronym: "DL&LRO N24Pgs",
            channels: [
              WB_CHIEF_MINISTER_S,
              { kind: "helpline", label: "DL&LRO North 24 Parganas, Collectorate, Barasat", phone: "033-2584-6301" },
              CM_S_OFFICE_GRIEVANCE,
              { kind: "email", label: "DL&LRO North 24 Parganas office email", url: "mailto:dllro.n24pgs@gmail.com" },
            ],
            source: "https://north24parganas.gov.in/land/",
          },
        },
        budge_budge: {
          solid_waste: {
            body: "Budge Budge Municipality - Sanitation & Conservancy Department",
            acronym: "BBM",
            channels: [
              WB_CHIEF_MINISTER_S,
              MUNICIPALITY_WEBSITE_FEEDBACK_FORM,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_2,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_3,
            ],
            source: "https://www.budgebudgemunicipality.org/departments.php",
          },
          sewerage: {
            body: "Budge Budge Municipality - Sanitation & Conservancy Department (cesspool / septic tank service)",
            acronym: "BBM",
            channels: [
              WB_CHIEF_MINISTER_S,
              MUNICIPALITY_WEBSITE_FEEDBACK_FORM,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_2,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_3,
            ],
            source: "https://www.budgebudgemunicipality.org/departments.php",
          },
          water_supply: {
            body: "Budge Budge Municipality - Water Works Department",
            acronym: "BBM",
            channels: [
              WB_CHIEF_MINISTER_S,
              MUNICIPALITY_WEBSITE_FEEDBACK_FORM,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_2,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_3,
            ],
            source: "https://www.budgebudgemunicipality.org/departments.php",
          },
          storm_drainage: {
            body: "Budge Budge Municipality - Public Works Department (drains) and Sanitation & Conservancy (drain cleaning)",
            acronym: "BBM",
            channels: [
              WB_CHIEF_MINISTER_S,
              MUNICIPALITY_WEBSITE_FEEDBACK_FORM,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_2,
              BUDGE_BUDGE_MUNICIPALITY_OFFICE_3,
            ],
            source: "https://www.budgebudgemunicipality.org/departments.php",
          },
          pollution_control: {
            body: "West Bengal Pollution Control Board - Alipore Regional Office",
            acronym: "WBPCB",
            channels: [
              WEST_BENGAL_PARIBESH_APP,
              WBPCB_TOLL_FREE_HELPLINE,
              { kind: "helpline", label: "WBPCB Alipore Regional Office", phone: "033-2448-5554" },
            ],
            source: "https://www.wbpcb.gov.in/offices-&-laboratories-of-wbpcb",
          },
          land_revenue: {
            body: "District Magistrate & Collector, South 24 Parganas (Alipore) - land & land reforms wing (DL&LRO / BL&LRO)",
            acronym: "DM S24Pgs",
            channels: [
              WB_CHIEF_MINISTER_S,
              { kind: "helpline", label: "Office of the District Magistrate, South 24 Parganas, Alipore", phone: "033-2479-3713" },
              { kind: "helpline", label: "Office of the District Magistrate, South 24 Parganas, Alipore (second line)", phone: "033-2479-1774" },
              CM_S_OFFICE_GRIEVANCE,
              { kind: "email", label: "Office of the District Magistrate, South 24 Parganas", url: "mailto:dm-ali@nic.in" },
            ],
            source: "https://s24pgs.gov.in/collectorate/",
          },
        },
      },
    },
  },
};
