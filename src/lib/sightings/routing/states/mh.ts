// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Authority, Channel, StateRouting } from "../types";

const AAPLE_SARKAR_GRIEVANCE_REDRESSAL: Channel = { kind: "portal", label: "Aaple Sarkar Grievance Redressal Portal", tracked: true, url: "https://grievances.maharashtra.gov.in/en" };

const MAHA_PARYAVARAN_MPCB_ANDROID: Channel = { kind: "app", label: "Maha Paryavaran (MPCB) - Android", tracked: true, url: "https://play.google.com/store/apps/details?id=com.maha.paryavaran" };

const MAHA_PARYAVARAN_MPCB_IPHONE: Channel = { kind: "app", label: "Maha Paryavaran (MPCB) (iPhone)", tracked: true, url: "https://apps.apple.com/in/app/maha-paryavaran/id6746112134" };

const PMC_CARE_ANDROID: Channel = { kind: "app", label: "PMC CARE - Android", tracked: true, url: "https://play.google.com/store/apps/details?id=in.gov.pmc.pmccare" };

const PMC_COMPLAINT_MANAGEMENT_SYSTEM: Channel = { kind: "portal", label: "PMC Complaint Management System (PMC CARE)", tracked: true, url: "https://complaint.pmc.gov.in/" };

const PMC_WHATSAPP_SMS_COMPLAINTS: Channel = { kind: "whatsapp", label: "PMC WhatsApp / SMS complaints", phone: "+91 96899 00002" };

const PMC_TOLL_FREE_CALL: Channel = { kind: "helpline", label: "PMC toll-free call centre", phone: "1800 1030 222" };

const PMC_FEEDBACK_AND_MONITORING: Channel = { kind: "email", label: "PMC Feedback and Monitoring Cell", url: "mailto:feedback@punecorporation.org" };

const NMC_GRIEVANCE_REDRESSAL_SYSTEM: Channel = { kind: "portal", label: "NMC Grievance Redressal System (new complaint)", tracked: true, url: "https://nmcnagpur.gov.in/grievance/complaint_form.php" };

const MY_NAGPUR_NMC_ANDROID: Channel = { kind: "app", label: "My Nagpur (NMC) - Android", tracked: true, url: "https://play.google.com/store/apps/details?id=com.app.newnmc" };

const MY_NAGPUR_NMC_IPHONE: Channel = { kind: "app", label: "My Nagpur (NMC) (iPhone)", tracked: true, url: "https://apps.apple.com/in/app/my-nagpur-nmc/id6476917248" };

const OCW_TOLL_FREE_HELPLINE: Channel = { kind: "helpline", label: "Orange City Water (NMC's water operator) toll-free helpline", phone: "1800-266-9899" };

const MYBMC_MARG_ANDROID: Channel = { kind: "app", label: "MyBMC MARG (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.esri.ugms_bmc" };

const MYBMC_MARG_IPHONE: Channel = { kind: "app", label: "MyBMC MARG (iPhone)", tracked: true, url: "https://apps.apple.com/in/app/mybmc-marg/id6759655448" };

const MYBMC_MARG: Channel = { kind: "portal", label: "MyBMC MARG", tracked: true, url: "https://marg.mcgm.gov.in/MARG/welcomePage.html" };

const MYBMC_ASSIST_WHATSAPP_CHATBOT: Channel = { kind: "whatsapp", label: "MyBMC Assist WhatsApp chatbot", phone: "+91 8999228999", url: "https://wa.me/918999228999" };

const BMC_24X7_HELPLINE: Channel = { kind: "helpline", label: "BMC 24x7 helpline", phone: "1916" };

const TMC_COMPLAINTS_HELPLINE: Channel = { kind: "helpline", label: "TMC complaints helpline", phone: "+91-22-25331590" };

const TMC_COMPLAINTS_HELPLINE_SECOND: Channel = { kind: "helpline", label: "TMC complaints helpline (second line)", phone: "+91-22-25331211" };

const KDMC_ONLINE_COMPLAINT_REGISTRATION: Channel = { kind: "portal", label: "KDMC online complaint registration", tracked: true, url: "https://kdmc.gov.in/kdmc/grievance.html" };

const MY_NMMC_MAJHI_NAVI: Channel = { kind: "app", label: "My NMMC - Majhi Navi Mumbai (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.newnmmc.app" };

const MY_NMMC_MAJHI_NAVI_2: Channel = { kind: "app", label: "My NMMC - Majhi Navi Mumbai (iPhone)", tracked: true, url: "https://apps.apple.com/in/app/my-nmmc-%E0%A4%AE-%E0%A4%9D-%E0%A4%A8%E0%A4%B5-%E0%A4%AE-%E0%A4%AC%E0%A4%88/id6723893978" };

const NMMC_GRIEVANCE_MANAGEMENT_REGISTER: Channel = { kind: "portal", label: "NMMC grievance management (register new grievance)", url: "https://app.nmmconline.in/grievance-management/add-register/new" };

const NMMC_HELPLINE: Channel = { kind: "helpline", label: "NMMC helpline", phone: "022-27567070" };

const NMMC_TOLL_FREE_HELPLINE: Channel = { kind: "helpline", label: "NMMC toll-free helpline", phone: "1800 222 309" };

const NMMC_TOLL_FREE_HELPLINE_2: Channel = { kind: "helpline", label: "NMMC toll-free helpline (second line)", phone: "1800 222 310" };

const MBMC_COMPLAINT_REGISTRATION: Channel = { kind: "portal", label: "MBMC complaint registration", tracked: true, url: "https://crm.mymbmc.in/" };

const VVCMC_COMPLAINT_REGISTRATION_PORTAL: Channel = { kind: "portal", label: "VVCMC complaint registration portal", tracked: true, url: "https://crm.onlinevvcmc.in/" };

const VVCMC_WHATSAPP_CHATBOT: Channel = { kind: "whatsapp", label: "VVCMC WhatsApp chatbot", phone: "+91 9665877727" };

const VVCMC_HEAD_OFFICE: Channel = { kind: "helpline", label: "VVCMC head office", phone: "0250-6630000" };

const BNCMC_HELPLINE: Channel = { kind: "helpline", label: "BNCMC helpline", phone: "(02522) 255314/15" };

const UMC_GRIEVANCE_REDRESSAL_PORTAL: Channel = { kind: "portal", label: "UMC Grievance Redressal Portal (register/login)", url: "https://grievance.smartumc.info/" };

const UMC_HELPLINE: Channel = { kind: "helpline", label: "UMC helpline", phone: "(0251) 2720150" };

const PMC_GRIEVANCE_REGISTRATION: Channel = { kind: "portal", label: "PMC Grievance Registration", url: "https://grievance.panvelcorporation.in/" };

const PMC_WHATSAPP_HELPLINE: Channel = { kind: "whatsapp", label: "PMC WhatsApp / helpline", phone: "+91 8960916091", url: "https://api.whatsapp.com/send?phone=918960916091" };

const PMC_HELPLINE: Channel = { kind: "helpline", label: "PMC helpline", phone: "022-27458040/41/42" };

const PMC_TOLL_FREE_HELPLINE: Channel = { kind: "helpline", label: "PMC toll-free helpline", phone: "1800-227701" };

const GP_PS_ZP_SATARA: Authority = {
  acronym: "GP / PS / ZP Satara",
  body: "Gram Panchayat (villages) / Nagar Parishad or Nagar Panchayat (towns); Panchayat Samiti (block, Block Development Officer) and Zilla Parishad Satara (Water and Sanitation / Swachh Bharat Mission cell) supervise in rural areas",
  channels: [
    AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
  ],
  source: "https://www.zpsatara.gov.in/en/swacha-bharat-mission/",
};

const GP_PS_ZP_AHILYANAGAR: Authority = {
  acronym: "GP / PS / ZP Ahilyanagar",
  body: "Gram Panchayat (villages) / Nagar Parishad or Nagar Panchayat (towns); Panchayat Samiti (block, Block Development Officer) and Zilla Parishad Ahilyanagar (Water Supply and Sanitation Department) supervise in rural areas",
  channels: [
    AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
  ],
  source: "https://nagarzp.gov.in/en/grievance-redressal/",
};

const GP_PS_ZP_KOLHAPUR: Authority = {
  acronym: "GP / PS / ZP Kolhapur",
  body: "Gram Panchayat (villages) / Nagar Parishad or Nagar Panchayat (towns); Panchayat Samiti (block, Block Development Officer) and Zilla Parishad Kolhapur (Water and Sanitation Department: greywater and solid waste management) supervise in rural areas",
  channels: [
    AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
  ],
  source: "https://www.zpkolhapur.gov.in/%e0%a4%aa%e0%a4%be%e0%a4%a3%e0%a5%80-%e0%a4%b5-%e0%a4%b8%e0%a5%8d%e0%a4%b5%e0%a4%9a%e0%a5%8d%e0%a4%9b%e0%a4%a4%e0%a4%be-%e0%a4%b5%e0%a4%bf%e0%a4%ad%e0%a4%be%e0%a4%97/",
};

const MBMC_BODY: Authority = {
  acronym: "MBMC",
  body: "Mira-Bhayandar Municipal Corporation - Water Supply and Sewerage Department",
  channels: [
    MBMC_COMPLAINT_REGISTRATION,
    { kind: "email", label: "MBMC Water Supply and Sewerage Department email", url: "mailto:watersupply@mbmc.gov.in" },
  ],
  source: "https://mbmc.gov.in/mbmc/water-supply-and-sewerage-",
};

const UMC_BODY: Authority = {
  acronym: "UMC",
  body: "Ulhasnagar Municipal Corporation (department not confirmed)",
  channels: [
    UMC_GRIEVANCE_REDRESSAL_PORTAL,
    UMC_HELPLINE,
  ],
  source: "https://www.umc.gov.in/",
};

export const MH: StateRouting = {
  stateCode: "MH",
  checked: "2026-10-16",
  roles: {
    water_supply: {
      body: "Water Supply and Sanitation Department, Govt of Maharashtra (rural drinking water policy; schemes run by Zilla Parishad Rural Water Supply departments and gram panchayats) with Maharashtra Jeevan Pradhikaran for schemes MJP operates",
      acronym: "WSSD / MJP",
      channels: [
        AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
        { kind: "portal", label: "MJP Citizen Portal", url: "https://mjpwms.in/" },
      ],
      source: "https://water.maharashtra.gov.in/%e0%a4%a4%e0%a4%95%e0%a5%8d%e0%a4%b0%e0%a4%be%e0%a4%b0-%e0%a4%a8%e0%a4%bf%e0%a4%b5%e0%a4%be%e0%a4%b0%e0%a4%a3/",
    },
    water_body: {
      body: "Water Resources Department, Govt of Maharashtra (dams, canals, irrigation projects above 600 ha) with the Soil and Water Conservation Department (minor irrigation tanks up to 600 ha) and Zilla Parishad Minor Irrigation (up to 100 ha)",
      acronym: "WRD / SWCD",
      channels: [
        AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
      ],
      source: "https://www.mwrdidc.in/mkvdc/project-handed-over-to-water-conservation-department",
    },
    pollution_control: {
      body: "Maharashtra Pollution Control Board",
      acronym: "MPCB",
      channels: [
        MAHA_PARYAVARAN_MPCB_ANDROID,
        MAHA_PARYAVARAN_MPCB_IPHONE,
      ],
      source: "https://mpcb.gov.in/en",
    },
    land_revenue: {
      body: "Revenue and Forest Department, Govt of Maharashtra - District Collector, Sub-Divisional Officer and Tahsildar offices",
      acronym: "Revenue",
      channels: [
        AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
      ],
      source: "https://grievances.maharashtra.gov.in/en",
    },
  },
  places: {
    pune: {
      roles: {
        solid_waste: {
          body: "Pune Municipal Corporation - Solid Waste Management Department",
          acronym: "PMC",
          channels: [
            PMC_CARE_ANDROID,
            PMC_COMPLAINT_MANAGEMENT_SYSTEM,
            PMC_WHATSAPP_SMS_COMPLAINTS,
            PMC_TOLL_FREE_CALL,
            PMC_FEEDBACK_AND_MONITORING,
          ],
          source: "https://www.pmc.gov.in/en/d/solid-waste-management",
        },
        sewerage: {
          body: "Pune Municipal Corporation - Drainage Department",
          acronym: "PMC",
          channels: [
            PMC_CARE_ANDROID,
            PMC_COMPLAINT_MANAGEMENT_SYSTEM,
            PMC_WHATSAPP_SMS_COMPLAINTS,
            PMC_TOLL_FREE_CALL,
            PMC_FEEDBACK_AND_MONITORING,
          ],
          source: "https://www.pmc.gov.in/en/d/drainage",
        },
        water_supply: {
          body: "Pune Municipal Corporation - Water Supply Department",
          acronym: "PMC",
          channels: [
            PMC_CARE_ANDROID,
            PMC_COMPLAINT_MANAGEMENT_SYSTEM,
            PMC_WHATSAPP_SMS_COMPLAINTS,
            PMC_TOLL_FREE_CALL,
            PMC_FEEDBACK_AND_MONITORING,
          ],
          source: "https://www.pmc.gov.in/en/d/water",
        },
        storm_drainage: {
          body: "Pune Municipal Corporation - Drainage Department (cleaning of storm drains and nallahs); Road Department lays new storm drains and culverts",
          acronym: "PMC",
          channels: [
            PMC_CARE_ANDROID,
            PMC_COMPLAINT_MANAGEMENT_SYSTEM,
            PMC_WHATSAPP_SMS_COMPLAINTS,
            PMC_TOLL_FREE_CALL,
            PMC_FEEDBACK_AND_MONITORING,
          ],
          source: "https://www.pmc.gov.in/en/d/drainage",
        },
        water_body: {
          body: "Pune Municipal Corporation (Mula, Mutha and Mula-Mutha river stretches, nallahs and city lakes within PMC limits; Chief Engineer (Projects) runs riverfront development, Drainage Department cleans natural watercourses)",
          acronym: "PMC",
          channels: [
            PMC_CARE_ANDROID,
            PMC_COMPLAINT_MANAGEMENT_SYSTEM,
            PMC_WHATSAPP_SMS_COMPLAINTS,
            PMC_TOLL_FREE_CALL,
            PMC_FEEDBACK_AND_MONITORING,
          ],
          source: "https://www.pmc.gov.in/en/d/ce-project",
        },
        pollution_control: {
          body: "Maharashtra Pollution Control Board - Sub-Regional Office Pune-I (Regional Office Pune)",
          acronym: "MPCB",
          channels: [
            MAHA_PARYAVARAN_MPCB_ANDROID,
            MAHA_PARYAVARAN_MPCB_IPHONE,
            { kind: "helpline", label: "MPCB Sub-Regional Office Pune-I (Regional Office Pune) office line", phone: "020-25811694" },
            { kind: "email", label: "MPCB Sub-Regional Office Pune-I (Regional Office Pune)", url: "mailto:sropune1@mpcb.gov.in" },
          ],
          source: "https://www.mpcb.gov.in/en/about-us/offices/pune",
        },
        land_revenue: {
          body: "District Collector Pune and Tahsildars (Revenue and Forest Department)",
          acronym: "Collector Pune",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://pune.gov.in/en/",
        },
      },
    },
    nagpur: {
      roles: {
        solid_waste: {
          body: "Nagpur Municipal Corporation - Solid Waste Management Department (collection, transport and disposal of the city's waste)",
          acronym: "NMC",
          channels: [
            NMC_GRIEVANCE_REDRESSAL_SYSTEM,
            MY_NAGPUR_NMC_ANDROID,
            MY_NAGPUR_NMC_IPHONE,
            { kind: "email", label: "NMC Solid Waste Management Department", url: "mailto:swm@nmc.gov.in" },
          ],
          source: "https://nmcnagpur.gov.in/5c151c2a9b76f9ef26d7e0f0d00c9a89",
        },
        sewerage: {
          body: "Nagpur Municipal Corporation - Public Health Engineering Department (water supply and sewage management)",
          acronym: "NMC",
          channels: [
            NMC_GRIEVANCE_REDRESSAL_SYSTEM,
            MY_NAGPUR_NMC_ANDROID,
            MY_NAGPUR_NMC_IPHONE,
          ],
          source: "https://nmcnagpur.gov.in/219e052492f4008818b8adb6366c7ed6",
        },
        water_supply: {
          body: "Nagpur Municipal Corporation - Public Health Engineering Department; Orange City Water Pvt Ltd runs supply and billing for NMC",
          acronym: "NMC / OCW",
          channels: [
            OCW_TOLL_FREE_HELPLINE,
            NMC_GRIEVANCE_REDRESSAL_SYSTEM,
            MY_NAGPUR_NMC_ANDROID,
            MY_NAGPUR_NMC_IPHONE,
          ],
          source: "https://nmcnagpur.gov.in/219e052492f4008818b8adb6366c7ed6",
        },
        storm_drainage: {
          body: "Nagpur Municipal Corporation - Public Health Engineering Department (its listed works include strengthening the rain-water drains against urban flooding)",
          acronym: "NMC",
          channels: [
            NMC_GRIEVANCE_REDRESSAL_SYSTEM,
            MY_NAGPUR_NMC_ANDROID,
            MY_NAGPUR_NMC_IPHONE,
          ],
          source: "https://nmcnagpur.gov.in/219e052492f4008818b8adb6366c7ed6",
        },
        water_body: {
          body: "Nagpur Municipal Corporation (development and upkeep of the city's lakes); Water Resources Department for the irrigation dams",
          acronym: "NMC / WRD",
          channels: [
            NMC_GRIEVANCE_REDRESSAL_SYSTEM,
            MY_NAGPUR_NMC_ANDROID,
            MY_NAGPUR_NMC_IPHONE,
          ],
          source: "https://nmcnagpur.gov.in/assets/300/2025/08/Public-Notices/ESR_Final_Report_2023-2024.pdf",
        },
      },
    },
    "mh-satara": {
      roles: {
        solid_waste: GP_PS_ZP_SATARA,
        sewerage: GP_PS_ZP_SATARA,
        water_supply: {
          body: "Zilla Parishad Satara - Rural Water Supply Department (schemes, repairs; gram panchayats and their water and sanitation committees run in-village supply)",
          acronym: "ZP RWS",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://www.zpsatara.gov.in/en/rural-water-supply-department/",
        },
        storm_drainage: {
          body: "Gram Panchayat (villages) / Nagar Parishad or Nagar Panchayat (towns); Panchayat Samiti (block, Block Development Officer) and Zilla Parishad Satara (Water and Sanitation / Swachh Bharat Mission cell) supervise in rural areas",
          acronym: "GP / PS / ZP Satara",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://www.zpsatara.gov.in/en/",
        },
        water_body: {
          body: "Zilla Parishad Satara - Minor Irrigation Department (percolation tanks, village tanks, Kolhapur-type weirs, storage and diversion weirs up to 100 ha); Soil and Water Conservation Department up to 600 ha; WRD Satara Irrigation Circle above 600 ha",
          acronym: "ZP MI / SWCD / WRD",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://www.zpsatara.gov.in/en/minor-irragation-department/",
        },
        pollution_control: {
          body: "Maharashtra Pollution Control Board - Sub-Regional Office Satara (Regional Office Pune)",
          acronym: "MPCB",
          channels: [
            MAHA_PARYAVARAN_MPCB_ANDROID,
            MAHA_PARYAVARAN_MPCB_IPHONE,
            { kind: "helpline", label: "MPCB Sub-Regional Office Satara (Regional Office Pune) office line", phone: "02162-233527 / 237789" },
            { kind: "email", label: "MPCB Sub-Regional Office Satara (Regional Office Pune)", url: "mailto:srosatara@mpcb.gov.in" },
          ],
          source: "https://www.mpcb.gov.in/en/about-us/offices/pune",
        },
        land_revenue: {
          body: "District Collector Satara and Tahsildars (Revenue and Forest Department)",
          acronym: "Collector Satara",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
            { kind: "helpline", label: "Satara district helpline: Unauthorized Sand Excavation and Transportation (toll-free)", phone: "1077" },
          ],
          source: "https://www.satara.gov.in/en/helpline/",
        },
      },
    },
    "mh-ahilyanagar": {
      roles: {
        solid_waste: GP_PS_ZP_AHILYANAGAR,
        sewerage: GP_PS_ZP_AHILYANAGAR,
        water_supply: {
          body: "Zilla Parishad Ahilyanagar - Rural Water Supply Department (tap water schemes, borewells and pumps, maintenance and repair of regional schemes, scarcity measures; one Mechanical Sub-Division and 7 RWS sub-divisions; supports Village Water Supply and Sanitation Committees)",
          acronym: "ZP RWS",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://nagarzp.gov.in/en/rural-water-supply/",
        },
        storm_drainage: GP_PS_ZP_AHILYANAGAR,
        water_body: {
          body: "Zilla Parishad Ahilyanagar - Minor Irrigation (schemes up to 100 ha); Soil and Water Conservation Department up to 600 ha; Water Resources Department above 600 ha",
          acronym: "ZP MI / SWCD / WRD",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://nagarzp.gov.in/en/minor-irrigation/",
        },
        pollution_control: {
          body: "Maharashtra Pollution Control Board - Sub-Regional Office Ahilyanagar (Regional Office Nashik)",
          acronym: "MPCB",
          channels: [
            MAHA_PARYAVARAN_MPCB_ANDROID,
            MAHA_PARYAVARAN_MPCB_IPHONE,
            { kind: "helpline", label: "MPCB Sub-Regional Office Ahilyanagar (Regional Office Nashik) office line", phone: "0241-2470852" },
            { kind: "email", label: "MPCB Sub-Regional Office Ahilyanagar (Regional Office Nashik)", url: "mailto:sroahilyanagar@mpcb.gov.in" },
          ],
          source: "https://www.mpcb.gov.in/en/about-us/offices/nashik",
        },
        land_revenue: {
          body: "District Collector Ahilyanagar and Tahsildars (Revenue and Forest Department)",
          acronym: "Collector Ahilyanagar",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
            { kind: "helpline", label: "Collector Office Ahilyanagar", phone: "0241-2345001" },
            { kind: "helpline", label: "District Control Room (toll-free)", phone: "1077" },
            { kind: "email", label: "Collector Office Ahilyanagar", url: "mailto:collector.ahmednagar@maharashtra.gov.in" },
          ],
          source: "https://ahilyanagar.maharashtra.gov.in/en/service/how-to-lodge-a-grievance/",
        },
      },
    },
    "mh-kolhapur": {
      roles: {
        solid_waste: GP_PS_ZP_KOLHAPUR,
        sewerage: GP_PS_ZP_KOLHAPUR,
        water_supply: {
          body: "Zilla Parishad Kolhapur - Rural Water Supply Department (Jal Jeevan Mission tap connections, scarcity measures; gram panchayats run in-village supply)",
          acronym: "ZP RWS",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://www.zpkolhapur.gov.in/%e0%a4%97%e0%a5%8d%e0%a4%b0%e0%a4%be%e0%a4%ae%e0%a5%80%e0%a4%a3-%e0%a4%aa%e0%a4%be%e0%a4%a3%e0%a5%80-%e0%a4%aa%e0%a5%81%e0%a4%b0%e0%a4%b5%e0%a4%a0%e0%a4%be-%e0%a4%b5%e0%a4%bf%e0%a4%ad%e0%a4%be/",
        },
        storm_drainage: {
          body: "Gram Panchayat (villages) / Nagar Parishad or Nagar Panchayat (towns); Panchayat Samiti (block, Block Development Officer) and Zilla Parishad Kolhapur (Water and Sanitation Department: greywater and solid waste management) supervise in rural areas",
          acronym: "GP / PS / ZP Kolhapur",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://www.zpkolhapur.gov.in/%e0%a4%a4%e0%a4%95%e0%a5%8d%e0%a4%b0%e0%a4%be%e0%a4%b0-%e0%a4%a8%e0%a5%8b%e0%a4%82%e0%a4%a6%e0%a4%a3%e0%a5%80/",
        },
        water_body: {
          body: "Zilla Parishad Kolhapur (minor irrigation up to 100 ha); Soil and Water Conservation Department up to 600 ha; WRD Kolhapur Irrigation Circle above 600 ha",
          acronym: "ZP / SWCD / WRD",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://www.mwrdidc.in/mkvdc/project-handed-over-to-water-conservation-department",
        },
        pollution_control: {
          body: "Maharashtra Pollution Control Board - Sub-Regional Office Kolhapur (Regional Office Kolhapur)",
          acronym: "MPCB",
          channels: [
            MAHA_PARYAVARAN_MPCB_ANDROID,
            MAHA_PARYAVARAN_MPCB_IPHONE,
            { kind: "helpline", label: "MPCB Sub-Regional Office Kolhapur (Regional Office Kolhapur) office line", phone: "0231-2660448" },
            { kind: "email", label: "MPCB Sub-Regional Office Kolhapur (Regional Office Kolhapur)", url: "mailto:srokolhapur@mpcb.gov.in" },
          ],
          source: "https://www.mpcb.gov.in/en/about-us/offices/kolhapur",
        },
        land_revenue: {
          body: "District Collector Kolhapur and Tahsildars (Revenue and Forest Department)",
          acronym: "Collector Kolhapur",
          channels: [
            AAPLE_SARKAR_GRIEVANCE_REDRESSAL,
          ],
          source: "https://grievances.maharashtra.gov.in/en",
        },
      },
    },
    mumbai: {
      roles: {
        water_body: {
          body: "Mithi River Development and Protection Authority (coordinating body; works implemented by MMRDA and MCGM)",
          acronym: "MRDPA",
          channels: [
            { kind: "portal", label: "MMRDA online complaint management", url: "https://mmrda.maharashtra.gov.in/en/node/add/complaint_management_form", tracked: true },
            { kind: "portal", label: "MMRDA track complaint (by Application Id)", url: "https://mmrda.maharashtra.gov.in/en/track-complaint-management-form", tracked: true },
          ],
          source: "https://mmrda.maharashtra.gov.in/en/divisions/town-country-planning/mithi-river-development-and-protection-authority/overview",
        },
        pollution_control: {
          body: "Maharashtra Pollution Control Board - Regional Offices Mumbai, Thane, Navi Mumbai, Kalyan and Raigad",
          acronym: "MPCB",
          channels: [
            MAHA_PARYAVARAN_MPCB_ANDROID,
            MAHA_PARYAVARAN_MPCB_IPHONE,
            { kind: "helpline", label: "MPCB RO Mumbai", phone: "022-24016239" },
            { kind: "helpline", label: "MPCB RO Thane", phone: "022-25802272" },
            { kind: "helpline", label: "MPCB RO Navi Mumbai and RO Raigad", phone: "022-27562740" },
            { kind: "helpline", label: "MPCB RO Kalyan", phone: "0251-2027343" },
            { kind: "email", label: "MPCB RO Mumbai (covers BMC)", url: "mailto:romumbai@mpcb.gov.in" },
            { kind: "email", label: "MPCB RO Thane", url: "mailto:rothane@mpcb.gov.in" },
            { kind: "email", label: "MPCB RO Navi Mumbai", url: "mailto:ronavimumbai@mpcb.gov.in" },
            { kind: "email", label: "MPCB RO Kalyan", url: "mailto:rokalyan@mpcb.gov.in" },
            { kind: "email", label: "MPCB RO Raigad", url: "mailto:roraigad@mpcb.gov.in" },
          ],
          source: "https://mpcb.gov.in/en/about-us/offices/mumbai",
        },
        land_revenue: {
          body: "District Collectors - Mumbai City, Mumbai Suburban, Thane, Palghar and Raigad",
          acronym: "Collector",
          channels: [
            { kind: "helpline", label: "Mumbai City Collectorate", phone: "022-22665233" },
            { kind: "helpline", label: "Mumbai Suburban Collector Office (Bandra East)", phone: "022-69403333" },
            { kind: "helpline", label: "Thane Collector Office", phone: "+91-22-25347444" },
            { kind: "helpline", label: "Palghar Collector / Resident Deputy Collector office", phone: "02525-239125" },
            { kind: "helpline", label: "Raigad Collector Office, Alibag", phone: "+91-2141-222118" },
            { kind: "email", label: "Collector, Mumbai City", url: "mailto:collector.mumbaicity@maharashtra.gov.in" },
            { kind: "email", label: "Collector, Mumbai Suburban", url: "mailto:collector.mumbaisuburb@maharashtra.gov.in" },
            { kind: "email", label: "Collector, Thane", url: "mailto:collector.thane@maharashtra.gov.in" },
            { kind: "email", label: "Collector, Palghar", url: "mailto:collector.palghar@maharashtra.gov.in" },
            { kind: "email", label: "Collector, Raigad", url: "mailto:collector.raigad@maharashtra.gov.in" },
          ],
          source: "https://thane.nic.in/municipal-corporations/",
        },
      },
      corporations: {
        bmc: {
          solid_waste: {
            body: "Brihanmumbai Municipal Corporation - Solid Waste Management Department",
            acronym: "BMC (MCGM)",
            channels: [
              MYBMC_MARG_ANDROID,
              MYBMC_MARG_IPHONE,
              MYBMC_MARG,
              MYBMC_ASSIST_WHATSAPP_CHATBOT,
              BMC_24X7_HELPLINE,
            ],
            source: "https://portal.mcgm.gov.in/irj/portal/anonymous",
          },
          sewerage: {
            body: "Brihanmumbai Municipal Corporation - Sewerage Operations",
            acronym: "BMC (MCGM)",
            channels: [
              MYBMC_MARG_ANDROID,
              MYBMC_MARG_IPHONE,
              MYBMC_MARG,
              MYBMC_ASSIST_WHATSAPP_CHATBOT,
              BMC_24X7_HELPLINE,
              { kind: "helpline", label: "BMC Sewerage Operations helpline", phone: "+91 9324500600" },
            ],
            source: "https://portal.mcgm.gov.in/irj/portal/anonymous",
          },
          water_supply: {
            body: "Brihanmumbai Municipal Corporation - Hydraulic Engineer's Department",
            acronym: "BMC (MCGM)",
            channels: [
              MYBMC_MARG_ANDROID,
              MYBMC_MARG_IPHONE,
              MYBMC_MARG,
              MYBMC_ASSIST_WHATSAPP_CHATBOT,
              BMC_24X7_HELPLINE,
            ],
            source: "https://portal.mcgm.gov.in/irj/portal/anonymous",
          },
          storm_drainage: {
            body: "Brihanmumbai Municipal Corporation - Storm Water Drains Department",
            acronym: "BMC (MCGM)",
            channels: [
              MYBMC_MARG_ANDROID,
              MYBMC_MARG_IPHONE,
              MYBMC_MARG,
              MYBMC_ASSIST_WHATSAPP_CHATBOT,
              BMC_24X7_HELPLINE,
            ],
            source: "https://portal.mcgm.gov.in/irj/portal/anonymous",
          },
          water_body: {
            body: "Brihanmumbai Municipal Corporation - Storm Water Drains Department (rivers/nallahs incl. its stretch of the Mithi) and Hydraulic Engineer's Department (supply lakes)",
            acronym: "BMC (MCGM)",
            channels: [
              MYBMC_MARG_ANDROID,
              MYBMC_MARG_IPHONE,
              MYBMC_MARG,
              MYBMC_ASSIST_WHATSAPP_CHATBOT,
              BMC_24X7_HELPLINE,
            ],
            source: "https://mmrda.maharashtra.gov.in/en/divisions/town-country-planning/mithi-river-development-and-protection-authority/overview",
          },
        },
        tmc: {
          solid_waste: {
            body: "Thane Municipal Corporation - Solid Waste Management (health/sanitation)",
            acronym: "TMC",
            channels: [
              TMC_COMPLAINTS_HELPLINE,
              TMC_COMPLAINTS_HELPLINE_SECOND,
              { kind: "helpline", label: "TMC C&D (debris) waste collection helpline", phone: "18002124530" },
            ],
            source: "https://thanecity.gov.in/tmc/CitizenHome.html",
          },
          sewerage: {
            body: "Thane Municipal Corporation - Sewerage Department (Malnissaran Vibhag)",
            acronym: "TMC",
            channels: [
              TMC_COMPLAINTS_HELPLINE,
              TMC_COMPLAINTS_HELPLINE_SECOND,
            ],
            source: "https://thanecity.gov.in/tmc/CitizenHome.html",
          },
          water_supply: {
            body: "Thane Municipal Corporation - Water Supply Department",
            acronym: "TMC",
            channels: [
              TMC_COMPLAINTS_HELPLINE,
              TMC_COMPLAINTS_HELPLINE_SECOND,
              { kind: "helpline", label: "TMC Regional Disaster Management Cell (logs pipeline bursts)", phone: "1800-222-108" },
            ],
            source: "https://thanecity.gov.in/tmc/CitizenHome.html",
          },
          storm_drainage: {
            body: "Thane Municipal Corporation - Public Works (nallah/drains) and Regional Disaster Management Cell",
            acronym: "TMC",
            channels: [
              TMC_COMPLAINTS_HELPLINE,
              TMC_COMPLAINTS_HELPLINE_SECOND,
              { kind: "helpline", label: "TMC Regional Disaster Management Cell (24x7)", phone: "1800-222-108" },
            ],
            source: "https://thanecity.gov.in/tmc/CitizenHome.html",
          },
          water_body: {
            body: "Thane Municipal Corporation (city lakes, e.g. Masunda/Upvan)",
            acronym: "TMC",
            channels: [
              TMC_COMPLAINTS_HELPLINE,
              TMC_COMPLAINTS_HELPLINE_SECOND,
            ],
            source: "https://thanecity.gov.in/tmc/CitizenHome.html",
          },
        },
        kdmc: {
          solid_waste: {
            body: "Kalyan-Dombivli Municipal Corporation - Solid Waste Management Department",
            acronym: "KDMC",
            channels: [
              KDMC_ONLINE_COMPLAINT_REGISTRATION,
              { kind: "helpline", label: "KDMC garbage", phone: "0251-2200045" },
              { kind: "helpline", label: "KDMC garbage", phone: "1800-233-0045" },
            ],
            source: "https://kdmc.gov.in/kdmc/CitizenHome.html",
          },
          sewerage: {
            body: "Kalyan-Dombivli Municipal Corporation - Sewerage Department",
            acronym: "KDMC",
            channels: [
              KDMC_ONLINE_COMPLAINT_REGISTRATION,
              { kind: "helpline", label: "KDMC septic-tank cleaning / SWM helpline", phone: "1800-233-0045" },
              { kind: "helpline", label: "KDMC hotline", phone: "0251-2211866" },
            ],
            source: "https://kdmc.gov.in/kdmc/CitizenHome.html",
          },
          water_supply: {
            body: "Kalyan-Dombivli Municipal Corporation - Water Supply Department",
            acronym: "KDMC",
            channels: [
              KDMC_ONLINE_COMPLAINT_REGISTRATION,
              { kind: "helpline", label: "KDMC hotline", phone: "0251-2211866" },
            ],
            source: "https://kdmc.gov.in/kdmc/CitizenHome.html",
          },
          storm_drainage: {
            body: "Kalyan-Dombivli Municipal Corporation - storm water drainage",
            acronym: "KDMC",
            channels: [
              KDMC_ONLINE_COMPLAINT_REGISTRATION,
              { kind: "helpline", label: "KDMC disaster management complaints (toll-free)", phone: "1800-233-7383" },
              { kind: "helpline", label: "KDMC disaster management complaints", phone: "0251-2314219" },
              { kind: "helpline", label: "KDMC emergency", phone: "0251-2211373" },
            ],
            source: "https://kdmc.gov.in/kdmc/CitizenHome.html",
          },
          water_body: {
            body: "Kalyan-Dombivli Municipal Corporation (municipal lakes)",
            acronym: "KDMC",
            channels: [
              KDMC_ONLINE_COMPLAINT_REGISTRATION,
              { kind: "helpline", label: "KDMC 'Shenale lake and disaster management' complaints (toll-free)", phone: "1800-233-7383" },
              { kind: "helpline", label: "KDMC 'Shenale lake and disaster management' complaints", phone: "0251-2314219" },
            ],
            source: "https://kdmc.gov.in/kdmc/CitizenHome.html",
          },
        },
        nmmc: {
          solid_waste: {
            body: "Navi Mumbai Municipal Corporation - Solid Waste Management Department",
            acronym: "NMMC",
            channels: [
              MY_NMMC_MAJHI_NAVI,
              MY_NMMC_MAJHI_NAVI_2,
              NMMC_GRIEVANCE_MANAGEMENT_REGISTER,
              NMMC_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE_2,
            ],
            source: "https://www.nmmc.gov.in/",
          },
          sewerage: {
            body: "Navi Mumbai Municipal Corporation - Sewerage (Engineering) Department",
            acronym: "NMMC",
            channels: [
              MY_NMMC_MAJHI_NAVI,
              MY_NMMC_MAJHI_NAVI_2,
              NMMC_GRIEVANCE_MANAGEMENT_REGISTER,
              NMMC_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE_2,
            ],
            source: "https://www.nmmc.gov.in/",
          },
          water_supply: {
            body: "Navi Mumbai Municipal Corporation - Water Supply Department",
            acronym: "NMMC",
            channels: [
              MY_NMMC_MAJHI_NAVI,
              MY_NMMC_MAJHI_NAVI_2,
              NMMC_GRIEVANCE_MANAGEMENT_REGISTER,
              NMMC_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE_2,
            ],
            source: "https://www.nmmc.gov.in/",
          },
          storm_drainage: {
            body: "Navi Mumbai Municipal Corporation - Engineering Department (storm water drains)",
            acronym: "NMMC",
            channels: [
              MY_NMMC_MAJHI_NAVI,
              MY_NMMC_MAJHI_NAVI_2,
              NMMC_GRIEVANCE_MANAGEMENT_REGISTER,
              NMMC_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE,
              NMMC_TOLL_FREE_HELPLINE_2,
            ],
            source: "https://www.nmmc.gov.in/",
          },
          water_body: {
            body: "Navi Mumbai Municipal Corporation (municipal lakes and holding ponds); CIDCO for CIDCO-owned land and mangroves",
            acronym: "NMMC / CIDCO",
            channels: [
              MY_NMMC_MAJHI_NAVI,
              MY_NMMC_MAJHI_NAVI_2,
              NMMC_GRIEVANCE_MANAGEMENT_REGISTER,
              { kind: "portal", label: "CIDCO mangrove-related complaints form", url: "https://cidco.maharashtra.gov.in:8443/Mangrove_complaints" },
            ],
            source: "https://cidco.maharashtra.gov.in/home/GrievancesGovernance",
          },
        },
        mbmc: {
          solid_waste: {
            body: "Mira-Bhayandar Municipal Corporation - Solid Waste Management Department",
            acronym: "MBMC",
            channels: [
              MBMC_COMPLAINT_REGISTRATION,
              { kind: "email", label: "MBMC SWM / health department email", url: "mailto:swmhealth@mbmc.gov.in" },
            ],
            source: "https://mbmc.gov.in/mbmc/solid-waste-management-department",
          },
          sewerage: MBMC_BODY,
          water_supply: MBMC_BODY,
          storm_drainage: {
            body: "Mira-Bhayandar Municipal Corporation - Public Works / Electrical Department (nallahs, gutters)",
            acronym: "MBMC",
            channels: [
              MBMC_COMPLAINT_REGISTRATION,
              { kind: "email", label: "MBMC Public Works Department email", url: "mailto:pwd@mbmc.gov.in" },
            ],
            source: "https://mbmc.gov.in/mbmc/public-works-electrical-",
          },
          water_body: {
            body: "Mira-Bhayandar Municipal Corporation - Environment Department (lakes, creek edge, mangroves)",
            acronym: "MBMC",
            channels: [
              MBMC_COMPLAINT_REGISTRATION,
              { kind: "email", label: "MBMC Environment Department email", url: "mailto:save.environs@mbmc.gov.in" },
            ],
            source: "https://mbmc.gov.in/mbmc/envirnment-dept",
          },
        },
        vvcmc: {
          solid_waste: {
            body: "Vasai-Virar City Municipal Corporation - Health / Sanitation Department",
            acronym: "VVCMC",
            channels: [
              VVCMC_COMPLAINT_REGISTRATION_PORTAL,
              VVCMC_WHATSAPP_CHATBOT,
              VVCMC_HEAD_OFFICE,
            ],
            source: "https://crm.onlinevvcmc.in/",
          },
          sewerage: {
            body: "Vasai-Virar City Municipal Corporation (department not confirmed)",
            acronym: "VVCMC",
            channels: [
              VVCMC_COMPLAINT_REGISTRATION_PORTAL,
              VVCMC_WHATSAPP_CHATBOT,
              VVCMC_HEAD_OFFICE,
            ],
            source: "https://crm.onlinevvcmc.in/",
          },
          water_supply: {
            body: "Vasai-Virar City Municipal Corporation - Water Supply Department",
            acronym: "VVCMC",
            channels: [
              VVCMC_COMPLAINT_REGISTRATION_PORTAL,
              VVCMC_WHATSAPP_CHATBOT,
              VVCMC_HEAD_OFFICE,
            ],
            source: "https://crm.onlinevvcmc.in/",
          },
          storm_drainage: {
            body: "Vasai-Virar City Municipal Corporation - PWD and Disaster Management Cell",
            acronym: "VVCMC",
            channels: [
              VVCMC_COMPLAINT_REGISTRATION_PORTAL,
              VVCMC_WHATSAPP_CHATBOT,
              VVCMC_HEAD_OFFICE,
              { kind: "helpline", label: "VVCMC disaster management", phone: "0250-2334546" },
              { kind: "helpline", label: "VVCMC disaster management (second line)", phone: "0250-2334547" },
            ],
            source: "https://crm.onlinevvcmc.in/",
          },
          water_body: {
            body: "Vasai-Virar City Municipal Corporation - Environment Department",
            acronym: "VVCMC",
            channels: [
              VVCMC_COMPLAINT_REGISTRATION_PORTAL,
              VVCMC_WHATSAPP_CHATBOT,
              VVCMC_HEAD_OFFICE,
            ],
            source: "https://crm.onlinevvcmc.in/",
          },
        },
        bncmc: {
          solid_waste: {
            body: "Bhiwandi-Nizampur City Municipal Corporation - Solid Waste Management Department",
            acronym: "BNCMC",
            channels: [
              { kind: "helpline", label: "BNCMC Cleanliness Complaint Helpline", phone: "9225214121" },
              { kind: "helpline", label: "BNCMC Health and Sanitation Department (toll-free)", phone: "1800-233-1113" },
              BNCMC_HELPLINE,
            ],
            source: "https://www.bncmc.gov.in/",
          },
          sewerage: {
            body: "Bhiwandi-Nizampur City Municipal Corporation (department not confirmed; PWD / Health and Sanitation)",
            acronym: "BNCMC",
            channels: [
              BNCMC_HELPLINE,
              { kind: "helpline", label: "BNCMC Health and Sanitation Department (toll-free)", phone: "1800-233-1113" },
              { kind: "helpline", label: "BNCMC community/public toilets (CT/PT)", phone: "02522-254152" },
            ],
            source: "https://www.bncmc.gov.in/",
          },
          water_supply: {
            body: "Bhiwandi-Nizampur City Municipal Corporation - Water Supply Department",
            acronym: "BNCMC",
            channels: [
              BNCMC_HELPLINE,
            ],
            source: "https://www.bncmc.gov.in/department.php?department_id=58",
          },
          storm_drainage: {
            body: "Bhiwandi-Nizampur City Municipal Corporation - Public Works Department / Disaster Management",
            acronym: "BNCMC",
            channels: [
              BNCMC_HELPLINE,
              { kind: "helpline", label: "BNCMC Emergency Department (toll-free)", phone: "1800-233-1102" },
            ],
            source: "https://www.bncmc.gov.in/",
          },
          water_body: {
            body: "Bhiwandi-Nizampur City Municipal Corporation (custodian department not confirmed)",
            acronym: "BNCMC",
            channels: [
              BNCMC_HELPLINE,
            ],
            source: "https://www.bncmc.gov.in/",
          },
        },
        umc: {
          solid_waste: {
            body: "Ulhasnagar Municipal Corporation - Solid Waste Management",
            acronym: "UMC",
            channels: [
              UMC_GRIEVANCE_REDRESSAL_PORTAL,
              UMC_HELPLINE,
            ],
            source: "https://www.umc.gov.in/",
          },
          sewerage: UMC_BODY,
          water_supply: {
            body: "Ulhasnagar Municipal Corporation - Water Supply",
            acronym: "UMC",
            channels: [
              UMC_GRIEVANCE_REDRESSAL_PORTAL,
              UMC_HELPLINE,
            ],
            source: "https://www.umc.gov.in/",
          },
          storm_drainage: UMC_BODY,
          water_body: {
            body: "Ulhasnagar Municipal Corporation (custodian department not confirmed)",
            acronym: "UMC",
            channels: [
              UMC_GRIEVANCE_REDRESSAL_PORTAL,
              UMC_HELPLINE,
            ],
            source: "https://www.umc.gov.in/",
          },
        },
        pmc: {
          solid_waste: {
            body: "Panvel Municipal Corporation - Solid Waste Management Department (Swachh Bharat Abhiyan)",
            acronym: "PMC",
            channels: [
              PMC_GRIEVANCE_REGISTRATION,
              PMC_WHATSAPP_HELPLINE,
              PMC_HELPLINE,
              PMC_TOLL_FREE_HELPLINE,
            ],
            source: "https://panvelcorporation.maharashtra.gov.in/Department",
          },
          sewerage: {
            body: "Panvel Municipal Corporation - Sewage (Cleaning) Department / Sewerage Construction Department",
            acronym: "PMC",
            channels: [
              PMC_GRIEVANCE_REGISTRATION,
              PMC_WHATSAPP_HELPLINE,
              PMC_HELPLINE,
              PMC_TOLL_FREE_HELPLINE,
            ],
            source: "https://panvelcorporation.maharashtra.gov.in/Department",
          },
          water_supply: {
            body: "Panvel Municipal Corporation - Water Supply Department (Panvel city, villages); CIDCO in CIDCO nodes (e.g. Kharghar, Kamothe, Kalamboli, New Panvel, Taloja)",
            acronym: "PMC / CIDCO",
            channels: [
              { kind: "portal", label: "CIDCO online grievance redressal system (CIDCO nodes)", url: "https://cidco.maharashtra.gov.in:8443/grievance_geportal/index", tracked: true },
              PMC_GRIEVANCE_REGISTRATION,
              PMC_WHATSAPP_HELPLINE,
              PMC_HELPLINE,
              PMC_TOLL_FREE_HELPLINE,
            ],
            source: "https://panvelcorporation.maharashtra.gov.in/Department",
          },
          storm_drainage: {
            body: "Panvel Municipal Corporation - Drainage Department",
            acronym: "PMC",
            channels: [
              PMC_GRIEVANCE_REGISTRATION,
              PMC_WHATSAPP_HELPLINE,
              PMC_HELPLINE,
              PMC_TOLL_FREE_HELPLINE,
            ],
            source: "https://panvelcorporation.maharashtra.gov.in/Department",
          },
          water_body: {
            body: "Panvel Municipal Corporation - Environment Department; CIDCO for CIDCO-owned land and mangroves in the nodes",
            acronym: "PMC / CIDCO",
            channels: [
              PMC_GRIEVANCE_REGISTRATION,
              { kind: "portal", label: "CIDCO mangrove-related complaints form", url: "https://cidco.maharashtra.gov.in:8443/Mangrove_complaints" },
            ],
            source: "https://panvelcorporation.maharashtra.gov.in/Department",
          },
        },
      },
    },
  },
};
