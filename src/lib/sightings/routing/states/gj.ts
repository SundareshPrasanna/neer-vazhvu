// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Channel, StateRouting } from "../types";

const PARYAVARAN_SETU_CENTRALIZED_GRIEVANCES: Channel = { kind: "portal", label: "Paryavaran Setu - Centralized Grievances Management System", url: "https://gpcbxgn.gujarat.gov.in/Complain/ComplainLogin" };

const CITIZEN_S_CONNECT_SMC: Channel = { kind: "app", label: "Citizen's Connect - SMC App (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=in.smc" };

const SMC_ONLINE_COMPLAINT: Channel = { kind: "portal", label: "SMC online complaint", tracked: true, url: "https://www.suratmunicipal.gov.in/OnlineServices/complaint/New" };

const SMC_COMPLAINT_REGISTRATION_TOLL: Channel = { kind: "helpline", label: "SMC complaint registration toll free", phone: "1800 123 8000", tracked: true };

const SMC_WHATSAPP_CHATBOT_SEND: Channel = { kind: "whatsapp", label: "SMC WhatsApp chatbot (send 'Hi')", phone: "+91 63599 30020", tracked: true };

const AMC_CCRS_ANDROID: Channel = { kind: "app", label: "AMC CCRS (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.amplvb.ccrs" };

const AMC_CCRS_ONLINE_COMPLAINT: Channel = { kind: "portal", label: "AMC CCRS online complaint", tracked: true, url: "https://www.amccrs.com/AMCPortal/Complaint/Register" };

const AMC_CCRS_WHATSAPP_BOT: Channel = { kind: "whatsapp", label: "AMC CCRS WhatsApp bot (send 'Hi')", phone: "+91 75678 55303", tracked: true, url: "https://wa.me/+917567855303" };

const AMC_CCRS_CALL_CENTER: Channel = { kind: "helpline", label: "AMC CCRS call center (24x7)", phone: "155303", tracked: true };

export const GJ: StateRouting = {
  stateCode: "GJ",
  checked: "2026-10-16",
  roles: {
    water_supply: {
      body: "Gujarat Water Supply and Sewerage Board (rural drinking water supply; WASMO runs in-village schemes with village Pani Samitis), under the Water Supply Division of the Narmada, Water Resources, Water Supply and Kalpsar Department",
      acronym: "GWSSB",
      channels: [
        { kind: "portal", label: "GWSSB online complaint form (Register Complaint)", url: "https://watersupply.gujarat.gov.in/support/ticket/submit" },
        { kind: "helpline", label: "Drinking Water Supply Toll Free Helpline", phone: "1916" },
        { kind: "helpline", label: "GWSSB control room for water supply complaints", phone: "079 2322 0859" },
      ],
      source: "https://watersupply.gujarat.gov.in/contact",
    },
    water_body: {
      body: "Narmada, Water Resources, Water Supply and Kalpsar Department, Water Resources Division (state irrigation / WRD): dams, canals, reservoirs, irrigation tanks, flood and salinity works. Narmada canals: Sardar Sarovar Narmada Nigam Ltd (SSNNL). Irrigation works under District Panchayats are handled by panchayat irrigation divisions; village ponds by gram panchayats.",
      acronym: "NWRWS&K Dept (WRD)",
      channels: [],
      source: "https://guj-nwrws.gujarat.gov.in/downloads/citizens_charter.pdf",
    },
    pollution_control: {
      body: "Gujarat Pollution Control Board",
      acronym: "GPCB",
      channels: [
        PARYAVARAN_SETU_CENTRALIZED_GRIEVANCES,
        { kind: "helpline", label: "GPCB head office, Paryavaran Bhavan, Gandhinagar", phone: "079 2323 2152" },
      ],
      source: "https://gpcbxgn.gujarat.gov.in/",
    },
  },
  places: {
    surat: {
      roles: {
        solid_waste: {
          body: "Surat Municipal Corporation, Solid Waste Management (Health Department)",
          acronym: "SMC",
          channels: [
            CITIZEN_S_CONNECT_SMC,
            { kind: "app", label: "Surat Municipal Corporation (iPhone)", url: "https://apps.apple.com/in/app/surat-municipal-corporation/id766167352", tracked: true },
            SMC_ONLINE_COMPLAINT,
            { kind: "whatsapp", label: "SMC WhatsApp chatbot", phone: "+91 63599 30020", tracked: true },
            SMC_COMPLAINT_REGISTRATION_TOLL,
            { kind: "helpline", label: "SMC Construction & Demolition waste toll free", phone: "1800 212 2829" },
            { kind: "helpline", label: "SMC Plastic waste toll free", phone: "1800 233 3002" },
          ],
          source: "https://www.suratmunicipal.gov.in/Home/TollFreeNumbers",
        },
        sewerage: {
          body: "Surat Municipal Corporation, Drainage Department",
          acronym: "SMC",
          channels: [
            CITIZEN_S_CONNECT_SMC,
            SMC_ONLINE_COMPLAINT,
            SMC_WHATSAPP_CHATBOT_SEND,
            SMC_COMPLAINT_REGISTRATION_TOLL,
          ],
          source: "https://www.suratmunicipal.gov.in/",
        },
        water_supply: {
          body: "Surat Municipal Corporation, Hydraulic (Water Supply) Department",
          acronym: "SMC",
          channels: [
            CITIZEN_S_CONNECT_SMC,
            SMC_ONLINE_COMPLAINT,
            SMC_WHATSAPP_CHATBOT_SEND,
            SMC_COMPLAINT_REGISTRATION_TOLL,
          ],
          source: "https://www.suratmunicipal.gov.in/Departments/HydraulicHome",
        },
        storm_drainage: {
          body: "Surat Municipal Corporation, Drainage Department (storm water drains)",
          acronym: "SMC",
          channels: [
            CITIZEN_S_CONNECT_SMC,
            SMC_ONLINE_COMPLAINT,
            SMC_WHATSAPP_CHATBOT_SEND,
            SMC_COMPLAINT_REGISTRATION_TOLL,
          ],
          source: "https://www.suratmunicipal.gov.in/CleanSurat/Documents/WMRAndAP/StormWaterCoverageActionPlan2019.pdf",
        },
        water_body: {
          body: "Surat Municipal Corporation (Tapi river stretch and khadis inside city limits; Tapi Revival / Tapi Shuddhikaran project; Singanpore weir-cum-causeway; proposed Rundh-Bhatha barrage; Tapi Riverfront Development and Rejuvenation Project). Upstream dams and weirs (Ukai, Kakrapar) and flood embankments: state Water Resources Department (Irrigation Circle, Surat).",
          acronym: "SMC",
          channels: [
            CITIZEN_S_CONNECT_SMC,
            SMC_WHATSAPP_CHATBOT_SEND,
            SMC_COMPLAINT_REGISTRATION_TOLL,
          ],
          source: "https://www.suratmunicipal.gov.in/Departments/ProjectsUnderPlanningTendering",
        },
        pollution_control: {
          body: "Gujarat Pollution Control Board, Regional Office Surat (Plot No. 11-12/2, 3 GIDC Pandesara, Surat-394221)",
          acronym: "GPCB RO Surat",
          channels: [
            PARYAVARAN_SETU_CENTRALIZED_GRIEVANCES,
            { kind: "helpline", label: "GPCB Regional Office Surat (office line)", phone: "0261 2891696" },
            { kind: "email", label: "GPCB Regional Office Surat", url: "mailto:ro-gpcb-sura@gujarat.gov.in" },
          ],
          source: "https://gpcb.gujarat.gov.in/Home/RegionalOfficeContactUs",
        },
        land_revenue: {
          body: "Collector, Surat (Collectorate - District Surat), with the Mamlatdar offices of the city talukas. Illegal sand mining: Commissionerate of Geology and Mining (CGM), Gujarat.",
          acronym: "Collectorate Surat",
          channels: [
            { kind: "portal", label: "District SWAGAT online application addressed to the Collector", url: "https://swagat.gujarat.gov.in/" },
            { kind: "helpline", label: "Collector, Surat (office line)", phone: "0261 2652525" },
            { kind: "helpline", label: "CGM Gujarat: Illegal Mining and Transportation Complaints", phone: "1800 233 4640" },
            { kind: "email", label: "Collector, Surat", url: "mailto:collector-sur@gujarat.gov.in" },
          ],
          source: "https://surat.gujarat.gov.in/contacts",
        },
      },
    },
    ahmedabad: {
      roles: {
        solid_waste: {
          body: "Amdavad Municipal Corporation, Solid Waste Management Department",
          acronym: "AMC",
          channels: [
            AMC_CCRS_ANDROID,
            AMC_CCRS_ONLINE_COMPLAINT,
            AMC_CCRS_WHATSAPP_BOT,
            AMC_CCRS_CALL_CENTER,
            { kind: "email", label: "AMC CCRS email", url: "mailto:ccrs@ahmedabadcity.gov.in" },
          ],
          source: "https://www.amccrs.com/AMCPortal/Complaint/RegisterManual",
        },
        sewerage: {
          body: "Amdavad Municipal Corporation, Drainage Department",
          acronym: "AMC",
          channels: [
            AMC_CCRS_ANDROID,
            AMC_CCRS_ONLINE_COMPLAINT,
            AMC_CCRS_WHATSAPP_BOT,
            AMC_CCRS_CALL_CENTER,
          ],
          source: "https://www.amccrs.com/AMCPortal/Complaint/Register",
        },
        water_supply: {
          body: "Amdavad Municipal Corporation, Water Operation / Water Project Departments",
          acronym: "AMC",
          channels: [
            AMC_CCRS_ANDROID,
            AMC_CCRS_ONLINE_COMPLAINT,
            AMC_CCRS_WHATSAPP_BOT,
            AMC_CCRS_CALL_CENTER,
          ],
          source: "https://www.amccrs.com/AMCPortal/Complaint/Register",
        },
        storm_drainage: {
          body: "Amdavad Municipal Corporation (Drainage / storm water)",
          acronym: "AMC",
          channels: [
            AMC_CCRS_ANDROID,
            AMC_CCRS_ONLINE_COMPLAINT,
            AMC_CCRS_WHATSAPP_BOT,
            AMC_CCRS_CALL_CENTER,
          ],
          source: "https://www.amccrs.com/AMCPortal/Complaint/Register",
        },
        water_body: {
          body: "Amdavad Municipal Corporation (city lakes, e.g. Kankaria Lakefront, Vastrapur; lake interlinking) and Sabarmati Riverfront Development Corporation Ltd (AMC's SPV for the Sabarmati riverfront)",
          acronym: "AMC / SRFDCL",
          channels: [
            AMC_CCRS_ONLINE_COMPLAINT,
            AMC_CCRS_WHATSAPP_BOT,
            AMC_CCRS_CALL_CENTER,
            { kind: "helpline", label: "SRFDCL office, Riverfront House (office line)", phone: "+91 79 26580430" },
            { kind: "email", label: "SRFDCL office email", url: "mailto:office@srfdcl.com" },
          ],
          source: "https://sabarmatiriverfront.com/srfdcl.html",
        },
        pollution_control: {
          body: "Gujarat Pollution Control Board, Regional Office Ahmedabad (City) (2nd Floor, old building, GPCB, Sector 10A, Gandhinagar); also Regional Office Ahmedabad (East), Plot No. 3501, Phase-IV, GIDC Vatva",
          acronym: "GPCB RO Ahmedabad (City) / (East)",
          channels: [
            PARYAVARAN_SETU_CENTRALIZED_GRIEVANCES,
            { kind: "helpline", label: "GPCB Regional Office Ahmedabad (East), GIDC Vatva (office line)", phone: "079 29295880" },
            { kind: "email", label: "GPCB Regional Office Ahmedabad (City)", url: "mailto:ro-gpcb-ahmc@gujarat.gov.in" },
            { kind: "email", label: "GPCB Regional Office Ahmedabad (East)", url: "mailto:ro-gpcb-ahme@gujarat.gov.in" },
          ],
          source: "https://gpcb.gujarat.gov.in/Home/RegionalOfficeContactUs",
        },
        land_revenue: {
          body: "Collector, Ahmedabad (Collectorate - District Ahmedabad), with the Mamlatdar offices of the city talukas. Illegal sand mining: Commissionerate of Geology and Mining (CGM), Gujarat.",
          acronym: "Collectorate Ahmedabad",
          channels: [
            { kind: "portal", label: "District SWAGAT online application addressed to the Collector", url: "https://swagat.gujarat.gov.in/" },
            { kind: "helpline", label: "Collector, Ahmedabad (office line)", phone: "079 27551681" },
            { kind: "helpline", label: "CGM Gujarat: Illegal Mining and Transportation Complaints", phone: "1800 233 4640" },
            { kind: "email", label: "Collector, Ahmedabad", url: "mailto:collector-ahd@gujarat.gov.in" },
          ],
          source: "https://ahmedabad.gujarat.gov.in/contacts",
        },
      },
    },
  },
};
