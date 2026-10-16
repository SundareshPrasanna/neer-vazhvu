// Researched from official sources 2026-10-16; each entry links the page that states it.
// Adding a place: add its entry here (see CONTRIBUTING, Adding a new city).
import type { Authority, Channel, StateRouting } from "../types";

const PUNAL_CITIZEN_APP_ANDROID: Channel = { kind: "app", label: "PUNAL Citizen app (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.punal.citizen" };

const PUNAL_TN_INTEGRATED_DRINKING: Channel = { kind: "portal", label: "PUNAL - TN Integrated Drinking Water Grievance Redressal Centre", tracked: true, url: "https://punal.tn.gov.in/grievance/#/" };

const PUNAL_IVR_24X7: Channel = { kind: "helpline", label: "PUNAL IVR (24x7)", phone: "1916", tracked: true };

const PUNAL_WHATSAPP_BOT: Channel = { kind: "whatsapp", label: "PUNAL WhatsApp bot", phone: "+91 94999 91916", url: "https://wa.me/919499991916" };

const PETITION_PROCESSING_PORTAL_CM: Channel = { kind: "portal", label: "Petition Processing Portal / CM Helpline (Mudhalvarin Mugavari)", tracked: true, url: "https://cmhelpline.tnega.org/portal/en/home" };

const TNPCB_ONLINE_GRIEVANCE_PETITION: Channel = { kind: "portal", label: "TNPCB Online Grievance Petition Redressal System (OLGPRS)", tracked: true, url: "https://tnpcb.gov.in/olgprs/" };

const TNPCB_COMPLAINT_EMAIL: Channel = { kind: "email", label: "TNPCB complaint email", url: "mailto:complaint@tnpcb.gov.in" };

const MADURAI_CORPORATION_PUBLIC_GRIEVANCE: Channel = { kind: "portal", label: "Madurai Corporation Public Grievance Registration", tracked: true, url: "https://maduraipublic.grievancecell.org/" };

const MADURAI_CORPORATION_COMPLAINT_CALL: Channel = { kind: "whatsapp", label: "Madurai Corporation complaint call centre (call or WhatsApp message)", phone: "+91 78716 61787", url: "https://api.whatsapp.com/send?phone=917871661787" };

const TN_CM_HELPLINE_CITIZEN: Channel = { kind: "app", label: "TN CM Helpline Citizen (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=org.tnega.cmhelpline.citizen" };

const CM_HELPLINE_CALL_CENTRE: Channel = { kind: "helpline", label: "CM Helpline call centre", phone: "1100", tracked: true };

const CM_HELPLINE_EMAIL: Channel = { kind: "email", label: "CM Helpline email", url: "mailto:cmhelpline@tn.gov.in" };

const DISTRICT_COLLECTORATE_CONTROL_ROOM: Channel = { kind: "helpline", label: "District Collectorate Control Room", phone: "1077" };

const TNPCB_ONLINE_POLLUTION_COMPLAINT: Channel = { kind: "portal", label: "TNPCB online pollution complaint (OLGPRS)", tracked: true, url: "https://tnpcb.gov.in/olgprs/login" };

const TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES: Channel = { kind: "helpline", label: "Tiruppur Village Panchayat Grievances Control Room", phone: "0421-2971163" };

const TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES_2: Channel = { kind: "helpline", label: "Tiruppur Village Panchayat Grievances Control Room (toll-free)", phone: "1800 425 7023" };

const CMWSSB_BODY: Authority = {
  acronym: "CMWSSB",
  body: "Chennai Metropolitan Water Supply and Sewerage Board (Chennai Metrowater)",
  channels: [
    { kind: "app", label: "CHENNAI KUDINEER (Android)", tracked: true, url: "https://play.google.com/store/apps/details?id=com.interlace.cmwssb" },
    { kind: "portal", label: "CMWSSB online complaint system", tracked: true, url: "https://cms-cmwssb.tn.gov.in/" },
    { kind: "helpline", label: "CMWSSB 24x7 Complaint Cell", phone: "044-4567 4567", tracked: true },
    { kind: "helpline", label: "CMWSSB toll-free complaint number", phone: "1916", tracked: true },
    { kind: "whatsapp", label: "CMWSSB WhatsApp grievance number", phone: "+91 81449 30308", url: "https://api.whatsapp.com/send?phone=918144930308" },
  ],
  source: "https://cmwssb.tn.gov.in/complaint-redressal",
};

const CORPORATION_OF_MADURAI_MADURAI: Authority = {
  body: "Corporation of Madurai (Madurai Municipal Corporation)",
  channels: [
    MADURAI_CORPORATION_PUBLIC_GRIEVANCE,
    MADURAI_CORPORATION_COMPLAINT_CALL,
  ],
  source: "https://maduraicorporation.co.in/",
};

const WRD_PU_VP_BODY: Authority = {
  acronym: "WRD / PU / VP",
  body: "Water Resources Department (WRD), Upper Palar Basin Circle and Upper Palar Basin Division, Vellore (Chennai Region); Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
  channels: [
    TN_CM_HELPLINE_CITIZEN,
    PETITION_PROCESSING_PORTAL_CM,
    CM_HELPLINE_CALL_CENTRE,
    DISTRICT_COLLECTORATE_CONTROL_ROOM,
    CM_HELPLINE_EMAIL,
  ],
  source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
};

export const TN: StateRouting = {
  stateCode: "TN",
  checked: "2026-10-16",
  roles: {
    sewerage: {
      body: "Local body that runs the sewer network (Corporation / Municipality / Town Panchayat / Village Panchayat), complaints routed through PUNAL run by the Tamil Nadu Water Supply and Drainage Board",
      acronym: "PUNAL (TWAD Board)",
      channels: [
        PUNAL_CITIZEN_APP_ANDROID,
        PUNAL_TN_INTEGRATED_DRINKING,
        PUNAL_IVR_24X7,
        PUNAL_WHATSAPP_BOT,
      ],
      source: "https://punal.tn.gov.in/faq.html",
    },
    water_supply: {
      body: "Tamil Nadu Water Supply and Drainage Board (runs PUNAL, the statewide integrated drinking-water grievance centre that routes to TWAD, Corporations, Municipalities, Town Panchayats and Village Panchayats)",
      acronym: "TWAD Board",
      channels: [
        PUNAL_CITIZEN_APP_ANDROID,
        PUNAL_TN_INTEGRATED_DRINKING,
        PUNAL_IVR_24X7,
        PUNAL_WHATSAPP_BOT,
      ],
      source: "https://punal.tn.gov.in/",
    },
    water_body: {
      body: "Water Resources Department, Government of Tamil Nadu (rivers, reservoirs and PWD tanks); smaller tanks and ooranis sit with Panchayat Unions; ponds inside city limits often with the city corporation",
      acronym: "WRD",
      channels: [
        PETITION_PROCESSING_PORTAL_CM,
      ],
      source: "https://wrd.tn.gov.in/contact-us/",
    },
    pollution_control: {
      body: "Tamil Nadu Pollution Control Board",
      acronym: "TNPCB",
      channels: [
        TNPCB_ONLINE_GRIEVANCE_PETITION,
        TNPCB_COMPLAINT_EMAIL,
      ],
      source: "https://tnpcb.gov.in/olgprs/",
    },
    land_revenue: {
      body: "Revenue Administration: District Collectorate, Revenue Divisional Office and Taluk Office (Tahsildar) of the district",
      channels: [
        PETITION_PROCESSING_PORTAL_CM,
      ],
      source: "https://madurai.nic.in/service/how-to-lodge-a-grievance/",
    },
  },
  places: {
    chennai: {
      roles: {
        solid_waste: {
          body: "Greater Chennai Corporation - Solid Waste Management Department",
          acronym: "GCC",
          channels: [
            { kind: "portal", label: "GCC Public Grievance and Redressal System", url: "https://gccservices.chennaicorporation.gov.in/pgr", tracked: true },
            { kind: "app", label: "Namma Chennai (Android)", url: "https://play.google.com/store/apps/details?id=com.ceedeev.grivenancev2" },
            { kind: "whatsapp", label: "GCC WhatsApp chatbot", url: "https://wa.me/919445061913", phone: "+91 94450 61913" },
            { kind: "helpline", label: "GCC complaint helpline", phone: "1913" },
          ],
          source: "https://chennaicorporation.gov.in/gcc/department/solid-waste-management/",
        },
        sewerage: CMWSSB_BODY,
        water_supply: CMWSSB_BODY,
        storm_drainage: {
          body: "Greater Chennai Corporation - Storm Water Drain Department",
          acronym: "GCC",
          channels: [
            { kind: "portal", label: "GCC Public Grievance and Redressal System", url: "https://gccservices.chennaicorporation.gov.in/pgr", tracked: true },
            { kind: "app", label: "Namma Chennai (Android)", url: "https://play.google.com/store/apps/details?id=com.ceedeev.grivenancev2" },
            { kind: "whatsapp", label: "GCC WhatsApp chatbot", url: "https://wa.me/919445061913", phone: "+91 94450 61913" },
            { kind: "helpline", label: "GCC complaint helpline", phone: "1913" },
          ],
          source: "https://chennaicorporation.gov.in/gcc/department/storm-water/",
        },
        water_body: {
          body: "Water Resources Department, Government of Tamil Nadu - Chennai Region (rivers Cooum, Adyar, Kosasthalaiyar, Buckingham Canal and WRD lakes)",
          acronym: "WRD",
          channels: [
            PETITION_PROCESSING_PORTAL_CM,
          ],
          source: "https://wrd.tn.gov.in/chennai-region/",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board - Joint Chief Environmental Engineer (Monitoring), Chennai, and District Environmental Engineer offices Chennai (Arumbakkam), Chennai South (Velachery), Ambattur and Manali (MERRC)",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_GRIEVANCE_PETITION,
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "Chennai District Collectorate - Revenue Administration (revenue divisions Chennai North, Central, South; taluk offices / Tahsildars)",
          channels: [
            PETITION_PROCESSING_PORTAL_CM,
          ],
          source: "https://chennai.nic.in/about-district/administrative-setup/revenue-administration/",
        },
      },
    },
    madurai: {
      roles: {
        solid_waste: CORPORATION_OF_MADURAI_MADURAI,
        sewerage: {
          body: "Corporation of Madurai (Madurai Municipal Corporation) - underground sewerage",
          channels: [
            MADURAI_CORPORATION_PUBLIC_GRIEVANCE,
            PUNAL_TN_INTEGRATED_DRINKING,
            PUNAL_IVR_24X7,
            MADURAI_CORPORATION_COMPLAINT_CALL,
          ],
          source: "https://maduraicorporation.co.in/aboutus/sewerage/",
        },
        water_supply: {
          body: "Corporation of Madurai (Madurai Municipal Corporation) - water supply",
          channels: [
            PUNAL_CITIZEN_APP_ANDROID,
            MADURAI_CORPORATION_PUBLIC_GRIEVANCE,
            PUNAL_TN_INTEGRATED_DRINKING,
            PUNAL_IVR_24X7,
            MADURAI_CORPORATION_COMPLAINT_CALL,
            PUNAL_WHATSAPP_BOT,
          ],
          source: "https://maduraicorporation.co.in/aboutus/water-supply/",
        },
        storm_drainage: CORPORATION_OF_MADURAI_MADURAI,
        water_body: {
          body: "Water Resources Department, Government of Tamil Nadu - Madurai Region (Vandiyur tank: Periyar Main Canal Division, Melur, PMC Sub-Division 1)",
          acronym: "WRD",
          channels: [
            PETITION_PROCESSING_PORTAL_CM,
          ],
          source: "https://cdn.s3waas.gov.in/s3f5f8590cd58a54e94377e6ae2eded4d9/uploads/2020/02/2020022142.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board - District Environmental Engineer, Madurai (SIDCO Industrial Estate, Kappalur), under the JCEE (Monitoring) Madurai regional office",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_GRIEVANCE_PETITION,
            TNPCB_COMPLAINT_EMAIL,
            { kind: "email", label: "TNPCB District Environmental Engineer, Madurai (office)", url: "mailto:deemdu@tnpcb.gov.in", phone: "0452-2489738" },
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "Madurai District Collectorate - Revenue Administration (Madurai and Melur revenue divisions; city taluks Madurai North, West, East, South and Thirupparankundram)",
          channels: [
            PETITION_PROCESSING_PORTAL_CM,
          ],
          source: "https://madurai.nic.in/service/how-to-lodge-a-grievance/",
        },
      },
    },
    "tn-thanjavur": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Thanjavur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Thanjavur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Thanjavur district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Thanjavur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Lower Cauvery Basin Circle, Thanjavur (Trichy Region), for system tanks and tanks over 40 ha ayacut; Panchayat Union (BDO) for smaller tanks; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            { kind: "helpline", label: "WRD Lower Cauvery Basin Circle office, Santhapillai Gate, Thanjavur", phone: "04362-230133" },
            CM_HELPLINE_EMAIL,
          ],
          source: "https://thanjavur.nic.in/pwd-water-resources-department-wrd/",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Thanjavur",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Thanjavur office (landline)", phone: "04362-256558" },
            { kind: "email", label: "TNPCB DEE Thanjavur office", url: "mailto:deetnj@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Thanjavur: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://thanjavur.nic.in/helpline/",
        },
      },
    },
    "tn-tiruchirappalli": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Tiruchirappalli district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Tiruchirappalli district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Tiruchirappalli district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Tiruchirappalli district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Middle Cauvery Basin Circle, Trichy: Ariyaru Basin Division (Trichy-20) for non-system tanks, River Conservancy Division (Trichy-1) for Cauvery/Kollidam river works; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Trichy",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Trichy office (landline)", phone: "0431-2501558" },
            { kind: "email", label: "TNPCB DEE Trichy office", url: "mailto:deetry@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Tiruchirappalli: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tiruchirappalli.nic.in/helpline/",
        },
      },
    },
    "tn-salem": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Salem district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Salem district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Salem district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Salem district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Upper Cauvery Basin Circle, Salem (Trichy Region): Sarabanga Basin Division, Salem and Mettur Dam Division, Mettur; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Salem and AEE Mettur (industrial hot spot office)",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Salem office (landline)", phone: "0427-2448526" },
            { kind: "email", label: "TNPCB DEE Salem office", url: "mailto:deeslm@tnpcb.gov.in" },
            { kind: "email", label: "TNPCB AEE Mettur office", url: "mailto:aeemtr@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Salem: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://salem.nic.in/helpline/",
        },
      },
    },
    "tn-tirupathur": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Tirupathur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Tirupathur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Tirupathur district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Tirupathur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: WRD_PU_VP_BODY,
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Vaniyambadi",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Vaniyambadi office (landline)", phone: "04174-234831" },
            { kind: "email", label: "TNPCB DEE Vaniyambadi office", url: "mailto:deevbd@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Tirupathur: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tirupathur.nic.in/helpline/",
        },
      },
    },
    "tn-erode": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Erode district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Erode district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Erode district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Erode district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Bhavani Basin Circle, Erode (Coimbatore Region): Lower Bhavani Basin Division, Bhavanisagar; Bhavanisagar Dam Division, Erode; Special Project Division, Perundurai; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Erode and DEE Perundurai",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Erode office (landline)", phone: "0424-2271596" },
            { kind: "helpline", label: "TNPCB DEE Perundurai office (landline)", phone: "04294-234288" },
            { kind: "email", label: "TNPCB DEE Erode office", url: "mailto:deeerd@tnpcb.gov.in" },
            { kind: "email", label: "TNPCB DEE Perundurai office", url: "mailto:deepnd@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Erode: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            { kind: "whatsapp", label: "Erode Collectorate WhatsApp", phone: "9791788852" },
            CM_HELPLINE_EMAIL,
            { kind: "email", label: "Erode Collectorate email", url: "mailto:collrerd@nic.in" },
          ],
          source: "https://erode.nic.in/helpline/",
        },
      },
    },
    "tn-namakkal": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Namakkal district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Namakkal district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Namakkal district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Namakkal district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD); the division covering Namakkal tanks was not found in the WRD RTI officer list. Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Namakkal and DEE Kumarapalayam",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Namakkal office (landline)", phone: "04286-280722" },
            { kind: "helpline", label: "TNPCB DEE Kumarapalayam office (landline)", phone: "04288-262800" },
            { kind: "email", label: "TNPCB DEE Namakkal office", url: "mailto:deenml@tnpcb.gov.in" },
            { kind: "email", label: "TNPCB DEE Kumarapalayam office", url: "mailto:deekmp@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Namakkal: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://namakkal.nic.in/helpline/",
        },
      },
    },
    "tn-karur": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Karur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Karur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Karur district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Karur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD): Amaravathi Basin Sub-Division, Karur (Amaravathy Basin Division, Dharapuram) and River Conservancy Sub-Division, Kulithalai; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnsdma.tn.gov.in/img/document/DDMPPDF/Karur.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Karur",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "email", label: "TNPCB DEE Karur office", url: "mailto:deekar@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Karur: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://karur.nic.in/helpline/",
        },
      },
    },
    "tn-tiruppur": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Tiruppur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES_2,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Tiruppur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES_2,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Tiruppur district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES_2,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Tiruppur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES,
            TIRUPPUR_VILLAGE_PANCHAYAT_GRIEVANCES_2,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Coimbatore Region: Amaravathy Basin Division, Dharapuram; Thirumurthi Division, Udumalaipettai; Special Project Division, Avinashi (Athikadavu-Avinashi scheme); Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Tiruppur (North) and DEE Tiruppur (South)",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Tiruppur (North) office (landline)", phone: "0421-2236210" },
            { kind: "email", label: "TNPCB DEE Tiruppur (North) office", url: "mailto:deetpn@tnpcb.gov.in" },
            { kind: "email", label: "TNPCB DEE Tiruppur (South) office", url: "mailto:deetps@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Tiruppur: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tiruppur.nic.in/helpline/",
        },
      },
    },
    "tn-vellore": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Vellore district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Vellore district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Vellore district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Vellore district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: WRD_PU_VP_BODY,
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Vellore",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Vellore office (landline)", phone: "0416-2242700" },
            { kind: "email", label: "TNPCB DEE Vellore office", url: "mailto:deevlr@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Vellore: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://vellore.nic.in/helpline/",
        },
      },
    },
    "tn-ranipet": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Ranipet district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Ranipet district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Ranipet district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Ranipet district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Chennai Region, Palar basin: Upper Palar Basin Division (Vellore) or Lower Palar Basin Division (Kanchipuram), not confirmed which covers each Ranipet tank; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Ranipet",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "email", label: "TNPCB DEE Ranipet office", url: "mailto:deerpt@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Ranipet: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://ranipet.nic.in/helpline/",
        },
      },
    },
    "tn-dindigul": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Dindigul district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Dindigul district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Dindigul district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Dindigul district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD): Nanganjiyar Basin Division, Palani (Bhavani Basin Circle, Coimbatore Region); Vaigai-basin parts may fall under Manjalar Basin Division, Periyakulam (Madurai Region); Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Dindigul",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Dindigul office (landline)", phone: "0451-2461868" },
            { kind: "email", label: "TNPCB DEE Dindigul office", url: "mailto:deedgl@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Dindigul: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://dindigul.nic.in/helpline/",
        },
      },
    },
    "tn-tiruvallur": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Tiruvallur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Tiruvallur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Tiruvallur district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Tiruvallur district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Palar Basin Circle, Chennai (Chennai Region): Kosasthalaiyar Basin Division, Tiruvallur and Araniyar Basin Division, Chennai; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://wrd.tn.gov.in/wp-content/uploads/2024/09/POI-details.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Thiruvallur and DEE Gummidipoondi",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Thiruvallur office (landline)", phone: "044-27664425" },
            { kind: "email", label: "TNPCB DEE Thiruvallur office", url: "mailto:deetlr@tnpcb.gov.in" },
            { kind: "email", label: "TNPCB DEE Gummidipoondi office", url: "mailto:deegmp@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Tiruvallur: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            { kind: "whatsapp", label: "Tiruvallur Collectorate Helpline (CHL) WhatsApp", phone: "9840327626" },
            { kind: "helpline", label: "Tiruvallur Collectorate Helpline (CHL)", phone: "18005997626" },
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tiruvallur.nic.in/helpline/",
        },
      },
    },
    "tn-krishnagiri": {
      roles: {
        solid_waste: {
          body: "Village Panchayat (sanitation and solid waste management), under the Panchayat Union / Block Development Office, Krishnagiri district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        sewerage: {
          body: "Village Panchayat (drains, public sanitation), under the Panchayat Union / Block Development Office, Krishnagiri district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_supply: {
          body: "Village Panchayat (local supply: handpumps, power pumps, overhead tanks, street taps) with the Tamil Nadu Water Supply and Drainage Board for Combined Water Supply Schemes, Krishnagiri district",
          acronym: "VP / TWAD",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        storm_drainage: {
          body: "Village Panchayat (construction and maintenance of drains), under the Panchayat Union / Block Development Office, Krishnagiri district",
          acronym: "VP / BDO",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnrd.tn.gov.in/policynotes/42--PN-RuralDev%20PN-2026-27--ENG--WEB.pdf",
        },
        water_body: {
          body: "Water Resources Department (WRD), Pennaiyar Basin Circle (Tiruvannamalai): Upper Pennaiyar Basin Division, Dharmapuri; Panchayat Union (BDO) for tanks under 40 ha ayacut; Village Panchayat for ponds and ooranis",
          acronym: "WRD / PU / VP",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            DISTRICT_COLLECTORATE_CONTROL_ROOM,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://tnsdma.tn.gov.in/img/document/DDMPPDF/Krishnagiri.pdf",
        },
        pollution_control: {
          body: "Tamil Nadu Pollution Control Board, District Environmental Engineer office(s): DEE Hosur",
          acronym: "TNPCB",
          channels: [
            TNPCB_ONLINE_POLLUTION_COMPLAINT,
            { kind: "helpline", label: "TNPCB DEE Hosur office (landline)", phone: "04344-278922" },
            { kind: "email", label: "TNPCB DEE Hosur office", url: "mailto:deehsr@tnpcb.gov.in" },
            TNPCB_COMPLAINT_EMAIL,
          ],
          source: "https://tnpcb.gov.in/contact.php",
        },
        land_revenue: {
          body: "District Collectorate, Krishnagiri: Revenue and Disaster Management Department (Tahsildar, Revenue Divisional Officer, District Collector)",
          acronym: "Revenue Dept",
          channels: [
            TN_CM_HELPLINE_CITIZEN,
            PETITION_PROCESSING_PORTAL_CM,
            CM_HELPLINE_CALL_CENTRE,
            CM_HELPLINE_EMAIL,
          ],
          source: "https://krishnagiri.nic.in/",
        },
      },
    },
  },
};
