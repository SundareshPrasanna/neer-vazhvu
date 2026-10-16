// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Channel, StateRouting } from "../types";

const PGRS_AP_STATE_GRIEVANCE: Channel = { kind: "portal", label: "PGRS - AP state grievance portal", tracked: true, url: "https://pgrs.ap.gov.in/" };

const PGRS_CALL_CENTRE_AP: Channel = { kind: "helpline", label: "PGRS call centre - AP state grievance helpline", phone: "1100", tracked: true };

const ONEVIZAG_ONEAPP_GVMC_COMPLAINTS: Channel = { kind: "app", label: "OneVizag OneApp - GVMC complaints (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.fluentgrid.onevizag" };

const GVMC_WEBSITE_E_COMPLAINT: Channel = { kind: "portal", label: "GVMC website e-Complaint", tracked: true, url: "https://www.gvmc.gov.in/" };

const GVMC_TOLL_FREE_CALL: Channel = { kind: "helpline", label: "GVMC toll-free call centre", phone: "1800-4250-0009", tracked: true };

const PURAMITHRA_ANDROID: Channel = { kind: "app", label: "Puramithra (Android)", url: "https://play.google.com/store/apps/details?id=com.dreamstep.apcmmscitizen" };

const MANA_MITRA_AP_STATE: Channel = { kind: "whatsapp", label: "Mana Mitra - AP state WhatsApp governance (RTGS)", phone: "9552300009", url: "https://wa.me/9552300009" };

export const AP: StateRouting = {
  stateCode: "AP",
  checked: "2026-10-16",
  roles: {
    pollution_control: {
      body: "Andhra Pradesh Pollution Control Board",
      acronym: "APPCB",
      channels: [
        PGRS_AP_STATE_GRIEVANCE,
        PGRS_CALL_CENTRE_AP,
      ],
      source: "https://pcb.ap.gov.in/",
    },
    land_revenue: {
      body: "Revenue Department, Government of Andhra Pradesh (District Collector / Revenue Divisional Officer / Tahsildar-MRO of the mandal)",
      channels: [
        PGRS_AP_STATE_GRIEVANCE,
        PGRS_CALL_CENTRE_AP,
      ],
      source: "https://pgrs.ap.gov.in/Home/Faqs",
    },
  },
  places: {
    visakhapatnam: {
      roles: {
        solid_waste: {
          body: "Greater Visakhapatnam Municipal Corporation - Public Health (sanitation) wing",
          acronym: "GVMC",
          channels: [
            ONEVIZAG_ONEAPP_GVMC_COMPLAINTS,
            GVMC_WEBSITE_E_COMPLAINT,
            PGRS_AP_STATE_GRIEVANCE,
            GVMC_TOLL_FREE_CALL,
            PURAMITHRA_ANDROID,
            { kind: "app", label: "Swachhata-MoHUA (Android)", url: "https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat" },
            MANA_MITRA_AP_STATE,
          ],
          source: "https://www.gvmc.gov.in/wss/static_content/Grievances.jsp?parentMenuId=200-56&pageName=Grievances.jsp&menutitle=Grievances",
        },
        sewerage: {
          body: "Greater Visakhapatnam Municipal Corporation - Engineering (UGD / sewerage)",
          acronym: "GVMC",
          channels: [
            ONEVIZAG_ONEAPP_GVMC_COMPLAINTS,
            GVMC_WEBSITE_E_COMPLAINT,
            PGRS_AP_STATE_GRIEVANCE,
            GVMC_TOLL_FREE_CALL,
            PURAMITHRA_ANDROID,
            MANA_MITRA_AP_STATE,
          ],
          source: "https://www.gvmc.gov.in/wss/static_content/Grievances.jsp?parentMenuId=200-56&pageName=Grievances.jsp&menutitle=Grievances",
        },
        water_supply: {
          body: "Greater Visakhapatnam Municipal Corporation - Engineering (water supply)",
          acronym: "GVMC",
          channels: [
            ONEVIZAG_ONEAPP_GVMC_COMPLAINTS,
            GVMC_WEBSITE_E_COMPLAINT,
            PGRS_AP_STATE_GRIEVANCE,
            GVMC_TOLL_FREE_CALL,
            PURAMITHRA_ANDROID,
            MANA_MITRA_AP_STATE,
          ],
          source: "https://www.gvmc.gov.in/wss/static_content/Grievances.jsp?parentMenuId=200-56&pageName=Grievances.jsp&menutitle=Grievances",
        },
        storm_drainage: {
          body: "Greater Visakhapatnam Municipal Corporation - Engineering (drains)",
          acronym: "GVMC",
          channels: [
            ONEVIZAG_ONEAPP_GVMC_COMPLAINTS,
            GVMC_WEBSITE_E_COMPLAINT,
            PGRS_AP_STATE_GRIEVANCE,
            GVMC_TOLL_FREE_CALL,
            PURAMITHRA_ANDROID,
            MANA_MITRA_AP_STATE,
          ],
          source: "https://www.gvmc.gov.in/wss/static_content/Grievances.jsp?parentMenuId=200-56&pageName=Grievances.jsp&menutitle=Grievances",
        },
        water_body: {
          body: "Greater Visakhapatnam Municipal Corporation (city lakes and ponds); Water Resources Department, AP - Irrigation Circle Visakhapatnam (irrigation tanks and reservoirs)",
          acronym: "GVMC",
          channels: [
            ONEVIZAG_ONEAPP_GVMC_COMPLAINTS,
            GVMC_WEBSITE_E_COMPLAINT,
            PGRS_AP_STATE_GRIEVANCE,
            GVMC_TOLL_FREE_CALL,
          ],
          source: "https://amrut.mohua.gov.in/assets/Status-of-Approved-Projects-under-AMRUT-2-in-Andhra-Pradesh-as-on-05-03-2026_.pdf",
        },
        pollution_control: {
          body: "Andhra Pradesh Pollution Control Board - Regional Office, Visakhapatnam (Environmental Engineer)",
          acronym: "APPCB",
          channels: [
            PGRS_AP_STATE_GRIEVANCE,
            PGRS_CALL_CENTRE_AP,
            { kind: "helpline", label: "APPCB Regional Office Visakhapatnam (office landline)", phone: "0891-2755356" },
            { kind: "email", label: "APPCB Regional Office Visakhapatnam (office mailbox)", url: "mailto:rovsp-ee1@appcb.gov.in" },
          ],
          source: "https://pcb.ap.gov.in/PCBLive/PCB/ContactUs",
        },
        land_revenue: {
          body: "District Collector, Visakhapatnam (Revenue Department) - Revenue Divisional Officer (Visakhapatnam / Bheemunipatnam) and Tahsildar-MRO of the mandal",
          channels: [
            PGRS_AP_STATE_GRIEVANCE,
            PGRS_CALL_CENTRE_AP,
            { kind: "helpline", label: "Sand complaints toll-free", phone: "1800-425-6016" },
          ],
          source: "https://visakhapatnam.ap.gov.in/mandals/",
        },
      },
    },
  },
};
