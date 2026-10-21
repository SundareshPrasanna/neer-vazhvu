// Researched from official sources 2026-10-20; each entry links the page that states it.
// Every channel below was read on the agency's own page (or the page's own app bundle, noted) on 2026-10-20.
// Personal / officer mobile numbers seen on official directories are deliberately NOT used as channels.
import type { Channel, StateRouting } from "../types";

// Rajasthan Sampark 2.0 (DoIT&C, Government of Rajasthan): the state's single grievance system.
// Source text (sampark.rajasthan.gov.in app bundle, FAQ): "Rajasthan Sampark can also be accessed by dialing 181,
// through Rajasthan Sampark 2.0 mobile application, official WhatsApp account and Chatbot." and "automated SMS
// notifications are sent to the mobile number of applicant on all stages, including registration, progress and disposal."
// Footer: "Toll Free - 181 E-mail : rajsampark@rajasthan.gov.in".
const RAJ_SAMPARK_PORTAL: Channel = { kind: "portal", label: "Rajasthan Sampark 2.0 grievance portal", url: "https://sampark.rajasthan.gov.in/", tracked: true };
const RAJ_SAMPARK_181: Channel = { kind: "helpline", label: "Rajasthan Sampark helpline (toll free, within Rajasthan)", phone: "181", tracked: true };
const RAJ_SAMPARK_APP: Channel = { kind: "app", label: "Raj Sampark 2.0 (Android)", url: "https://play.google.com/store/apps/details?id=com.rajsampark.versiontwo", tracked: true };
const RAJ_SAMPARK_WHATSAPP: Channel = { kind: "whatsapp", label: "Rajasthan Sampark WhatsApp (send 'Hi')", phone: "+91 94610 67924", url: "https://wa.me/919461067924", tracked: true };

// Nagar Nigam Jaipur (JMC) grievance system "Jaipur Samadhan" (jaipurmc.org home page, "Public Grievance System").
// The web form asks for a mobile number with OTP, ward (1-150) and zone; "Track Complain Status" is on the same site.
// Its complaint categories (GET /ComplaintRegistrationByWebsite/dllComplaintCategory?OtherHeadOffCode=0) include
// "Safai(Road/Sewer/Nali/Small Dead Animal)", "Sewer/Nali/Road Repair", "Sewer Related", "Door to Door Garbage Collection",
// "C & D Material", "Encroachment Related", "Illegal Construction Related". There is NO water-supply category (PHED supplies water).
const JMC_SAMADHAN_PORTAL: Channel = { kind: "portal", label: "Jaipur Samadhan (Nagar Nigam Jaipur online complaint)", url: "https://samadhan.jaipurmc.org", tracked: true };
const JMC_SAMADHAN_APP: Channel = { kind: "app", label: "Jaipur Samadhan (Android)", url: "https://play.google.com/store/apps/details?id=com.oispl.citizen_app", tracked: true };
const JMC_CALL_CENTRE: Channel = { kind: "helpline", label: "JMC Call Centre / public grievance registration (8 am - 10 pm)", phone: "0141-2747400" };

// Disaster Management & Relief Dept home page: "Toll Free HelpLine Number for State 1070 / 112" and
// "Toll Free HelpLine Number for District : 1077". Used for flooding only.
const DMR_DISTRICT_1077: Channel = { kind: "helpline", label: "District disaster control room (floods), toll free", phone: "1077" };

export const RJ: StateRouting = {
  stateCode: "RJ",
  checked: "2026-10-20",
  roles: {
    water_supply: {
      // PHED supplies urban and rural drinking water statewide; the corporation does not.
      body: "Public Health Engineering Department (Jal Swasthya Abhiyantriki Vibhag), Government of Rajasthan",
      acronym: "PHED",
      channels: [
        // PHED home page links "Grievance" -> http://sampark.rajasthan.gov.in/
        RAJ_SAMPARK_PORTAL,
        RAJ_SAMPARK_181,
        // "Public Health Engineering Department State Control Room No.: 0141-2222585"
        { kind: "helpline", label: "PHED State Control Room", phone: "0141-2222585" },
      ],
      source: "https://phedwater.rajasthan.gov.in/content/raj/water/public-health-engineering-department/en/citizencorner/phed-control-room-no-.html",
    },
    pollution_control: {
      body: "Rajasthan State Pollution Control Board",
      acronym: "RSPCB",
      channels: [
        // RSPCB Public Grievance page: "Complaints may also be registered through the Government of Rajasthan's
        // public grievance redressal platform, Rajasthan Sampark"
        RAJ_SAMPARK_PORTAL,
        RAJ_SAMPARK_181,
        RAJ_SAMPARK_APP,
        RAJ_SAMPARK_WHATSAPP,
      ],
      source: "https://environment.rajasthan.gov.in/content/environment/en/rajasthan-state-pollution-control-board/ComplaintPage.html",
    },
    water_body: {
      // Dams, reservoirs and irrigation tanks. No WRD page with a citizen channel was reached:
      // wrd.rajasthan.gov.in and waterresources.rajasthan.gov.in do not resolve; water.rajasthan.gov.in is a JS sector portal.
      // Rajasthan Sampark covers every department, but no WRD page saying so was read, so channels stay empty.
      body: "Water Resources Department, Government of Rajasthan (dams, reservoirs, irrigation tanks and canals)",
      acronym: "WRD",
      channels: [],
      source: "https://water.rajasthan.gov.in/",
    },
  },
  places: {
    jaipur: {
      roles: {
        water_supply: {
          // Jaipur city is served by PHED City Circle North and City Circle South (contact list on PHED's Contact Us page:
          // "S.E. (CITY CIRCLE) NORTH JAIPUR 0141 2300281 senorth.jai.phed@rajasthan.gov.in";
          // "S.E. (CITY CIRCLE) SOUTH JAIPUR 0141 2709537 sesouth.jai.phed@rajasthan.gov.in").
          // District control room from "Contact list control room-1.pdf" (13 May 2026): "Jaipur 0141-2706624".
          body: "PHED Jaipur City Circle North and City Circle South (divisions North-I to IV and South-I to V)",
          acronym: "PHED",
          channels: [
            { kind: "helpline", label: "PHED Jaipur district control room", phone: "0141-2706624" },
            { kind: "helpline", label: "PHED State Control Room", phone: "0141-2222585" },
            { kind: "helpline", label: "PHED Superintending Engineer, City Circle North (office line)", phone: "0141-2300281" },
            { kind: "email", label: "PHED Superintending Engineer, City Circle North", url: "mailto:senorth.jai.phed@rajasthan.gov.in" },
            { kind: "helpline", label: "PHED Superintending Engineer, City Circle South (office line)", phone: "0141-2709537" },
            { kind: "email", label: "PHED Superintending Engineer, City Circle South", url: "mailto:sesouth.jai.phed@rajasthan.gov.in" },
            RAJ_SAMPARK_PORTAL,
            RAJ_SAMPARK_181,
          ],
          source: "https://phedwater.rajasthan.gov.in/content/dam/doitassets/water/Public-Health-Engineering-Department/Pdf2026/Contact%20list%20control%20room-1.pdf",
        },
        solid_waste: {
          body: "Nagar Nigam Jaipur (Jaipur Municipal Corporation), Health / sanitation wing",
          acronym: "JMC",
          channels: [
            JMC_SAMADHAN_PORTAL,
            JMC_SAMADHAN_APP,
            JMC_CALL_CENTRE,
            // JMC home page: "मालवीयनगर एवं मुरलीपुरा ज़ोन से संबन्धित घर घर कचरा संग्रहण की शिकायत नंबर 8447905965 पर दर्ज करवाये।"
            { kind: "helpline", label: "Door-to-door garbage collection complaints, Malviya Nagar and Murlipura zones only", phone: "8447905965" },
          ],
          source: "https://jaipurmc.org/",
        },
        sewerage: {
          // Samadhan categories "Sewer Related" and "Sewer/Nali/Road Repair"; JMC directory lists an SE Sewer Project.
          body: "Nagar Nigam Jaipur (Jaipur Municipal Corporation), sewer wing",
          acronym: "JMC",
          channels: [JMC_SAMADHAN_PORTAL, JMC_SAMADHAN_APP, JMC_CALL_CENTRE],
          source: "https://samadhan.jaipurmc.org/ComplaintRegistrationByWebsite/AddComplaintRegistrationByWebsite",
        },
        storm_drainage: {
          // Nala (open drain) cleaning and blockage: JMC Samadhan "Sewer/Nali/Road Repair" and "Safai(Road/Sewer/Nali...)".
          // Flooding emergencies: district disaster helpline 1077 (Disaster Management & Relief Dept home page).
          // Trunk drains and the Dravyavati river channel are JDA works (see water_body; rests on rivers-flood research).
          body: "Nagar Nigam Jaipur (Jaipur Municipal Corporation): drains (nala) inside the city; flood emergencies via the District Collector's disaster control room",
          acronym: "JMC",
          channels: [JMC_SAMADHAN_PORTAL, JMC_SAMADHAN_APP, JMC_CALL_CENTRE, DMR_DISTRICT_1077],
          source: "https://samadhan.jaipurmc.org/ComplaintRegistrationByWebsite/AddComplaintRegistrationByWebsite",
        },
        water_body: {
          // JDA runs the Dravyavati river project (Rajasthan High Court orders of 19 Dec 2024 and 23 Jul 2026) and
          // restored Mansagar; dams such as Ramgarh and Kanota sit with WRD (state role above), which gauges them.
          // JDA home page lists: "EPBX Line : +91 141 2569696" and
          // "Email id: jda@rajasthan.gov.in". No JDA complaint portal for water bodies was found.
          body: "Jaipur Development Authority (Dravyavati river and JDA-area drains and lakes); dams and irrigation tanks: Water Resources Department",
          acronym: "JDA",
          channels: [
            { kind: "helpline", label: "JDA head office EPBX", phone: "0141-2569696" },
            { kind: "email", label: "JDA head office", url: "mailto:jda@rajasthan.gov.in" },
            RAJ_SAMPARK_PORTAL,
          ],
          source: "https://jda.rajasthan.gov.in/content/raj/udh/jda---jaipur/en/home.html",
        },
        pollution_control: {
          // RSPCB Regional Office page: "Jaipur City | Tehsil- Jaipur of District Jaipur ... | ro.cityjaipur@gmail.com";
          // "Jaipur (North) | Amber, ... | 0141 | 2850100 | rorpcb.jaipur[at]gmail[dot]com";
          // "Jaipur (South) | Bassi, Chaksu, ..., Sanganer, ... | 0141 | 4068311 | ro.jaipursouth[at]gmail[dot]com".
          // JMC spans Jaipur, Sanganer and Amer tehsils, so all three ROs can apply.
          body: "RSPCB Regional Office Jaipur City (Jaipur tehsil); Amer tehsil: RO Jaipur (North); Sanganer tehsil: RO Jaipur (South)",
          acronym: "RSPCB RO Jaipur",
          channels: [
            RAJ_SAMPARK_PORTAL,
            RAJ_SAMPARK_181,
            { kind: "email", label: "RSPCB Regional Office Jaipur City", url: "mailto:ro.cityjaipur@gmail.com" },
            { kind: "helpline", label: "RSPCB Regional Office Jaipur (North) (office line)", phone: "0141-2850100" },
            { kind: "email", label: "RSPCB Regional Office Jaipur (North)", url: "mailto:rorpcb.jaipur@gmail.com" },
            { kind: "helpline", label: "RSPCB Regional Office Jaipur (South) (office line)", phone: "0141-4068311" },
            { kind: "email", label: "RSPCB Regional Office Jaipur (South)", url: "mailto:ro.jaipursouth@gmail.com" },
          ],
          source: "https://environment.rajasthan.gov.in/content/environment/en/rajasthan-state-pollution-control-board/contact-Us/regional-office.html",
        },
        land_revenue: {
          // Revenue land (including water bodies recorded in revenue records): District Collector Jaipur.
          // Collector office lines from JMC's own Administrative Directory (jp_AdminContList.pdf, 16 Oct 2026, page 1):
          // the District Collector's office lines "(O) 2209001 , 2209000". The district portal jaipur.rajasthan.gov.in is a
          // JS app (contacts behind a POST API), so JMC's directory is the page that states it.
          // Encroachment on JDA land: JDA home page "Enforcement Control Room: +91 141 2575151, 2575252, 2565800".
          // Encroachment on JMC land: Samadhan category "Encroachment Related".
          body: "District Collector, Jaipur (revenue land and recorded water bodies); JDA Enforcement (JDA land); Nagar Nigam Jaipur (encroachment on corporation land)",
          acronym: "Collectorate Jaipur",
          channels: [
            RAJ_SAMPARK_PORTAL,
            RAJ_SAMPARK_181,
            { kind: "helpline", label: "District Collector, Jaipur (office line)", phone: "0141-2209001" },
            { kind: "helpline", label: "JDA Enforcement Control Room", phone: "0141-2575151" },
            JMC_SAMADHAN_PORTAL,
          ],
          source: "https://jaipurmc.org/PDF/Others/jp_AdminContList.pdf",
        },
      },
    },
  },
};
