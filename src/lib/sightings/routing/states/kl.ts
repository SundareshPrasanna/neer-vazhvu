// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Channel, StateRouting } from "../types";

const K_SMART_PUBLIC_GRIEVANCE: Channel = { kind: "portal", label: "K-SMART Public Grievance Redressal and Complaints", tracked: true, url: "https://ksmart.lsgkerala.gov.in/ui/web-portal/services" };

const LSGD_SINGLE_WHATSAPP_NUMBER: Channel = { kind: "whatsapp", label: "LSGD single WhatsApp number for Waste-Free Nava Kerala complaints (photo/video of dumping)", phone: "9446700800" };

export const KL: StateRouting = {
  stateCode: "KL",
  checked: "2026-10-16",
  roles: {
    solid_waste: {
      body: "Local Self Government Department (through the local self-government institution: grama panchayat / municipality / corporation)",
      acronym: "LSGD",
      channels: [
        K_SMART_PUBLIC_GRIEVANCE,
        LSGD_SINGLE_WHATSAPP_NUMBER,
      ],
      source: "https://lsgkerala.gov.in/index.php/en/public-grievance-cell/4367",
    },
    water_supply: {
      body: "Kerala Water Authority",
      acronym: "KWA",
      channels: [
        { kind: "portal", label: "Aqua Loom - KWA online consumer complaint registration and status", url: "https://aqualoomnew.kwa.kerala.gov.in/get-register-form", tracked: true },
        { kind: "whatsapp", label: "KWA WhatsApp", phone: "9495998258" },
        { kind: "helpline", label: "KWA toll-free consumer complaints line (24x7)", phone: "1916" },
        { kind: "helpline", label: "KWA consumer helpline (toll-free)", phone: "18004255313" },
        { kind: "email", label: "KWA call centre email", url: "mailto:1916cckwa@gmail.com" },
      ],
      source: "https://kwa.kerala.gov.in/en/consumer-grievances/",
    },
    storm_drainage: {
      body: "Local self-government institution (grama panchayat / municipality / municipal corporation)",
      acronym: "LSGI",
      channels: [
        K_SMART_PUBLIC_GRIEVANCE,
      ],
      source: "https://lsgkerala.gov.in/index.php/en/public-grievance-cell/4367",
    },
    water_body: {
      body: "Irrigation Department, Government of Kerala (irrigation works); other public ponds and tanks vest in the Village Panchayat",
      channels: [
        { kind: "portal", label: "Irrigation Department Encroachment Reporting Form", url: "https://irrigation.kerala.gov.in/encroachment" },
      ],
      source: "https://irrigation.kerala.gov.in/encroachment",
    },
    pollution_control: {
      body: "Kerala State Pollution Control Board",
      acronym: "KSPCB",
      channels: [
        { kind: "portal", label: "KSPCB PHOENIX portal - File Complaint / Complaint Tracking", url: "https://www.keralapcbonline.com/pcb/welcome", tracked: true },
        { kind: "helpline", label: "KSPCB complaint cell (complaint related enquiry)", phone: "+91 9447977526" },
        { kind: "email", label: "KSPCB complaint cell email", url: "mailto:kspcbcomplaintcell25@gmail.com" },
      ],
      source: "https://kspcb.kerala.gov.in/contact-us",
    },
    land_revenue: {
      body: "Revenue Department, Government of Kerala (District Collector / Tahsildar / Village Officer)",
      channels: [
        { kind: "portal", label: "Chief Minister's Public Grievance Redressal System", url: "https://complaints.cmo.kerala.gov.in/", tracked: true },
        { kind: "helpline", label: "CM's Public Grievance Redressal Cell toll-free", phone: "1076" },
      ],
      source: "https://cmo.kerala.gov.in/index-en.html",
    },
  },
  places: {
    "kl-palakkad": {
      roles: {
        solid_waste: {
          body: "Local self-government institution in Palakkad (grama panchayat or municipality), under LSGD",
          acronym: "LSGI",
          channels: [
            K_SMART_PUBLIC_GRIEVANCE,
            LSGD_SINGLE_WHATSAPP_NUMBER,
          ],
          source: "https://lsgkerala.gov.in/index.php/en/public-grievance-cell/4367",
        },
        sewerage: {
          body: "Local self-government institution in Palakkad (grama panchayat or municipality)",
          acronym: "LSGI",
          channels: [
            K_SMART_PUBLIC_GRIEVANCE,
            LSGD_SINGLE_WHATSAPP_NUMBER,
          ],
          source: "https://lsgkerala.gov.in/index.php/en/public-grievance-cell/4367",
        },
        water_supply: {
          body: "Kerala Water Authority - PH Circle Palakkad (PH Divisions Palakkad and Shornur)",
          acronym: "KWA",
          channels: [
            { kind: "portal", label: "Aqua Loom - KWA online consumer complaint registration and status", url: "https://aqualoomnew.kwa.kerala.gov.in/get-register-form", tracked: true },
            { kind: "whatsapp", label: "KWA WhatsApp", phone: "9495998258" },
            { kind: "helpline", label: "KWA toll-free consumer complaints line (24x7)", phone: "1916" },
            { kind: "helpline", label: "KWA consumer helpline (toll-free)", phone: "18004255313" },
            { kind: "helpline", label: "KWA Superintending Engineer, PH Circle Palakkad (office line)", phone: "0491-2544927" },
            { kind: "helpline", label: "KWA Executive Engineer, PH Division Palakkad (office line)", phone: "0491-2545027" },
            { kind: "email", label: "KWA PH Circle Palakkad", url: "mailto:cru.phcpalakkad@kerala.gov.in" },
            { kind: "email", label: "KWA PH Division Palakkad", url: "mailto:cru.phdnpkd@kerala.gov.in" },
          ],
          source: "https://kwa.kerala.gov.in/en/contact-us/",
        },
        water_body: {
          body: "Irrigation Department, Kerala - Palakkad divisions (Irrigation Malampuzha, Chittur, Kanjirappuzha; Minor Irrigation Division Palakkad) for irrigation works; other public ponds vest in the grama panchayat",
          channels: [
            { kind: "portal", label: "Irrigation Department Encroachment Reporting Form", url: "https://irrigation.kerala.gov.in/encroachment" },
            { kind: "helpline", label: "Executive Engineer, Minor Irrigation, College Road, Palakkad (office line)", phone: "0491-2522808" },
            { kind: "helpline", label: "Executive Engineer, Irrigation, Malampuzha (office line)", phone: "0491-2815111" },
            { kind: "email", label: "Executive Engineer, Minor Irrigation, Palakkad", url: "mailto:eemipalakkad@gmail.com" },
          ],
          source: "https://palakkad.nic.in/en/other-departments/",
        },
        pollution_control: {
          body: "Kerala State Pollution Control Board - Palakkad District Office",
          acronym: "KSPCB",
          channels: [
            { kind: "portal", label: "KSPCB PHOENIX portal - File Complaint / Complaint Tracking", url: "https://www.keralapcbonline.com/pcb/welcome", tracked: true },
            { kind: "helpline", label: "KSPCB Palakkad District Office (office line)", phone: "0491-3522360" },
            { kind: "helpline", label: "KSPCB complaint cell (complaint related enquiry)", phone: "+91 9447977526" },
          ],
          source: "https://kspcb.kerala.gov.in/about/offices",
        },
        land_revenue: {
          body: "Revenue Department - District Collector, Palakkad (Taluk Tahsildars, Village Officers)",
          channels: [
            { kind: "portal", label: "Chief Minister's Public Grievance Redressal System", url: "https://complaints.cmo.kerala.gov.in/", tracked: true },
            { kind: "helpline", label: "District Collectorate, Civil Station, Palakkad", phone: "0491-2505309" },
            { kind: "helpline", label: "CM's Public Grievance Redressal Cell toll-free", phone: "1076" },
            { kind: "email", label: "District Collector, Palakkad", url: "mailto:dcpkd.ker@nic.in" },
          ],
          source: "https://palakkad.nic.in/en/contactus/",
        },
      },
    },
  },
};
