/**
 * What happens after a citizen files with a complaint system, from that
 * system's own pages (researched 2026-10-16). Matched to channels by URL, or
 * "tel:<number>" for phone lines; a system shared by an app, a portal and a
 * helpline is described once.
 */
import type { Channel } from "./types";

export interface Expectation {
  system: string;
  keys: string[];
  /** One or two plain sentences, second person. */
  expect: string;
  /** Filing needs the citizen's mobile number (and so identifies them to the department). */
  needsPhone: boolean | null;
  source: string;
}

export const EXPECTATIONS: Expectation[] = [
  {
    system: "Rajasthan Sampark 2.0",
    keys: [
      "https://sampark.rajasthan.gov.in/",
      "tel:181",
      "https://play.google.com/store/apps/details?id=com.rajsampark.versiontwo",
      "https://wa.me/919461067924",
    ],
    expect: "You get an SMS when your grievance is registered, as it progresses and when it is disposed of. You can track it in the Raj Sampark 2.0 app, on its WhatsApp account, or by calling 181.",
    needsPhone: true,
    source: "https://sampark.rajasthan.gov.in/",
  },
  {
    system: "Jaipur Samadhan (Nagar Nigam Jaipur)",
    keys: ["https://samadhan.jaipurmc.org", "https://play.google.com/store/apps/details?id=com.oispl.citizen_app"],
    expect: "You verify your mobile number with a one-time code, then choose a category, your ward and zone, and can attach a photo. You can look the complaint up later under Track Complain Status.",
    needsPhone: true,
    source: "https://samadhan.jaipurmc.org/ComplaintRegistrationByWebsite/AddComplaintRegistrationByWebsite",
  },
  {
    system: "Swachhata-MoHUA",
    keys: ["https://play.google.com/store/apps/details?id=com.ichangemycity.swachhbharat"],
    expect: "Your complaint goes to your city corporation and is assigned to the ward's sanitary inspector or engineer. You get push updates and a 'Resolved' photo, and can reopen it if not satisfied.",
    needsPhone: true,
    source: "https://www.swachh.city/",
  },
  {
    system: "CPGRAMS",
    keys: ["https://pgportal.gov.in/"],
    expect: "You get a unique registration number to track on pgportal; a state matter is sent to the state government. You get an SMS or email when it is resolved, and can appeal if you rate it Poor.",
    needsPhone: true,
    source: "https://pgportal.gov.in/Home/Faq",
  },
  {
    system: "PGRS (Andhra Pradesh)",
    keys: ["https://pgrs.ap.gov.in/"],
    expect: "You get an SMS with a Grievance No. and a tracking link, and an officer is assigned to it. It needs your Aadhaar number and takes individual or household grievances, not community ones.",
    needsPhone: true,
    source: "https://pgrs.ap.gov.in/Home/Faqs?Length=4",
  },
  {
    system: "GVMC grievance system",
    keys: ["https://www.gvmc.gov.in/", "tel:1800-4250-0009", "https://play.google.com/store/apps/details?id=com.fluentgrid.onevizag"],
    expect: "You get a complaint number and it is forwarded to the officer concerned; track it by that number on gvmc.gov.in. By phone you also get an SMS with the officer's details and another when it is redressed.",
    needsPhone: true,
    source: "https://www.gvmc.gov.in/wss/static_content/Grievances.jsp",
  },
  {
    system: "Puramithra (AP CDMA)",
    keys: ["https://play.google.com/store/apps/details?id=com.dreamstep.apcmmscitizen"],
    expect: "It is routed to the official concerned, first the ward secretariat's amenities or sanitation secretary, with escalation levels up to the Municipal Commissioner. You can track its status in the app.",
    needsPhone: true,
    source: "https://cdma.ap.gov.in/resources/grievance-sla",
  },
  {
    system: "PUNAL (TWAD Board)",
    keys: ["https://punal.tn.gov.in/grievance/#/", "https://play.google.com/store/apps/details?id=com.punal.citizen", "https://wa.me/919499991916"],
    expect: "You get an acknowledgement with a unique Grievance ID; the complaint is verified and forwarded to the field engineers or officials concerned. Track it on the portal, app or IVR with that ID.",
    needsPhone: true,
    source: "https://punal.tn.gov.in/faq.html",
  },
  {
    system: "TN CM Helpline (Mudhalvarin Mugavari)",
    keys: ["https://cmhelpline.tnega.org/portal/en/home", "https://play.google.com/store/apps/details?id=org.tnega.cmhelpline.citizen"],
    expect: "You get an SMS when you file and when it is closed; it is assigned to the department concerned. Track it in My Dashboard, and you can appeal once if you are not satisfied.",
    needsPhone: true,
    source: "https://cmhelpline.tnega.org/portal/en/kb/articles/tamil-nadu-cm-helpline-faqs",
  },
  {
    system: "TNPCB OLGPRS",
    keys: ["https://tnpcb.gov.in/olgprs/", "https://tnpcb.gov.in/olgprs/login"],
    expect: "You get a complaint ID by SMS and it goes directly to the District Environment Engineer. Track it with the complaint number and your mobile number; action taken is sent to you by post.",
    needsPhone: true,
    source: "https://tnpcb.gov.in/olgprs/",
  },
  {
    system: "GCC Public Grievance (web portal)",
    keys: ["https://gccservices.chennaicorporation.gov.in/pgr"],
    expect: "You get a complaint number when you submit; use it, or your mobile number, to track the complaint on the GCC grievance portal. Anyone who knows your mobile number can look up complaints filed under it.",
    needsPhone: false,
    source: "https://gccservices.in/pgr/registercomplaints",
  },
  {
    system: "CMWSSB complaint system",
    keys: ["https://play.google.com/store/apps/details?id=com.interlace.cmwssb", "https://cms-cmwssb.tn.gov.in/", "tel:044-4567 4567", "https://api.whatsapp.com/send?phone=918144930308"],
    expect: "You get a reference number by SMS and the complaint goes straight to your area's Depot Engineer; the action taken is also sent by SMS. Unresolved water or sewer complaints escalate after 3 days.",
    needsPhone: true,
    source: "https://cmwssb.tn.gov.in/citizencharter",
  },
  {
    system: "Madurai Corporation grievance portal",
    keys: ["https://maduraipublic.grievancecell.org/"],
    expect: "You get a ticket number on screen when you submit your complaint.",
    needsPhone: true,
    source: "https://maduraipublic.grievancecell.org/",
  },
  {
    system: "Praja Seve iPGRS (Karnataka)",
    keys: ["https://ipgrs.karnataka.gov.in/", "https://ipgrs.karnataka.gov.in/Home/Index?str=citizeneng"],
    expect: "You get a Grievance ID by SMS and can track it with that ID and your mobile number. It goes to the department's field officer and moves up to senior officers if not resolved in time.",
    needsPhone: true,
    source: "https://ipgrs.karnataka.gov.in/Home/videoGetFile?filePath=%2FUpload%2FJanaspandandaAdsVideos%2FDocuments%2FGO_on_reducing_time_to_21_days_in_iPGRS_and_CPGRAMS.pdf",
  },
  {
    system: "Namma Bengaluru (Sahaaya 2.0), GBA",
    keys: ["https://play.google.com/store/apps/details?id=com.nammabengaluruNew.org", "https://nammabengaluru.org.in/login", "https://gba.karnataka.gov.in/"],
    expect: "You log in with your mobile number and an OTP, and get a complaint ID to track in the app or web portal. When it is marked resolved, you can rate it or reopen it.",
    needsPhone: true,
    source: "https://play.google.com/store/apps/details?id=com.nammabengaluruNew.org",
  },
  {
    system: "BSWML WhatsApp chatbot (Bengaluru)",
    keys: ["https://wa.me/919448197197?text=Hi"],
    expect: "You report by chatting with BSWML's WhatsApp bot, which shares your WhatsApp number with BSWML. BSWML says the bot lets you report, track and give feedback on garbage complaints.",
    needsPhone: true,
    source: "https://bswml.karnataka.gov.in/en",
  },
  {
    system: "K-SMART PGR and Complaints (Kerala LSGD)",
    keys: ["https://ksmart.lsgkerala.gov.in/ui/web-portal/services"],
    expect: "You file after logging in to K-SMART and get an acknowledgement plus an SMS or WhatsApp alert. It goes to your local body's staff, and updates reach your K-SMART login and WhatsApp.",
    needsPhone: true,
    source: "https://cdn.ksmart.lsgkerala.gov.in/common/webpage/news/KSmart_PGR_User_Manual.pdf",
  },
  {
    system: "Waste-Free Nava Kerala WhatsApp number (LSGD)",
    keys: ["tel:9446700800"],
    expect: "You send a photo or video with place and time; your WhatsApp number goes with it. The local body checks it and acts if confirmed; if a fine is collected you may get up to 25%, max Rs 2,500.",
    needsPhone: true,
    source: "https://thalavoorpanchayat.lsgkerala.gov.in/en/node/46",
  },
  {
    system: "KWA Aqua Loom complaint system (Kerala Water Authority)",
    keys: ["https://aqualoomnew.kwa.kerala.gov.in/get-register-form", "tel:9495998258"],
    expect: "You give your name and phone number, and can track the complaint on Aqua Loom by docket number or phone. KWA's charter gives the same day for leaks on mains or dirty water, and 3 days for no water.",
    needsPhone: true,
    source: "https://kwa.kerala.gov.in/wp-content/uploads/2020/08/citizens_charter.pdf",
  },
  {
    system: "KSPCB PHOENIX complaint portal (Kerala)",
    keys: ["https://www.keralapcbonline.com/pcb/welcome"],
    expect: "You choose which Board office receives it, such as District Office Palakkad. A complaint ID appears on screen when you submit; keep it to track the complaint on the portal.",
    needsPhone: true,
    source: "https://www.keralapcbonline.com/pcb/downloadUserManual?fileName=/s0B+xn+XXgBNVHozwMCkdIf3tqbDFNu00fAdEy7fazL8dGUiCwUdw==",
  },
  {
    system: "Kerala CM's Public Grievance Redressal System (CMO portal)",
    keys: ["https://complaints.cmo.kerala.gov.in/"],
    expect: "You register (mobile checked by OTP) and get a docket number; track it with that and your mobile. Each office has a CMO-portal charge officer; if they do not update you, call 1076.",
    needsPhone: true,
    source: "https://kannur.nic.in/chief-ministers-public-grievance-redressal-cell/",
  },
  {
    system: "Janavani Kalushya Nivarini (TGPCB)",
    keys: ["https://telangana-ccr.glensserver.com/#/user-login"],
    expect: "You must give your name and mobile number with the complaint, and the portal has a complaint tracking page. TGPCB does not publish who acts on it or how fast.",
    needsPhone: true,
    source: "https://tgpcb.cgg.gov.in/",
  },
  {
    system: "Prajavani (Telangana)",
    keys: ["https://prajavani.cgg.gov.in/"],
    expect: "You file in person at the Monday Prajavani hearing or at Praja Bhavan and get a receipt with a reference ID; the portal only tracks it. The officer must act within 30 days or it escalates.",
    needsPhone: null,
    source: "https://prajavani.cgg.gov.in/HomeCSS/img/CIRCULAR260716131154907.pdf",
  },
  {
    system: "GHMC CURE Integrated Grievance System and My Cure app",
    keys: ["https://igs.ghmc.gov.in/operator/send_otp_mobile", "https://play.google.com/store/apps/details?id=cgg.gov.ghmc"],
    expect: "You verify your mobile number with an OTP and get a reference number by SMS to track the complaint. GHMC's charter sets 48 hours for uncleared garbage or water stagnation.",
    needsPhone: true,
    source: "https://www.ghmc.gov.in/Menu_Files/citizen-charter-19-06_compress.pdf",
  },
  {
    system: "HMWSSB Metro Customer Care (MCC)",
    keys: ["https://www.hyderabadwater.gov.in/en/index.php/services/customers-services/register-grievances", "tel:155313", "https://play.google.com/store/apps/details?id=com.hyderabadwater.hmwssb"],
    expect: "You get an MCC reference number by SMS to track the complaint. The charter sets 2 working days for leaks, sewer overflow or a missing manhole cover, and 4 for no water or polluted water.",
    needsPhone: true,
    source: "https://www.hyderabadwater.gov.in/application/files/7417/3185/0800/updated_citizen_charter.pdf",
  },
  {
    system: "Aaple Sarkar Grievance Portal (Maharashtra)",
    keys: ["https://grievances.maharashtra.gov.in/en"],
    expect: "You get a token number and the grievance goes to the district or Mantralaya office you choose. Track it by token, rate the reply, and escalate it if you are dissatisfied.",
    needsPhone: true,
    source: "https://grievances.maharashtra.gov.in/en/faqs",
  },
  {
    system: "MJP Citizen Portal (Maharashtra Jeevan Pradhikaran)",
    keys: ["https://mjpwms.in/"],
    expect: "You need an MJP consumer number to file. It goes to the Executive Engineer for your water works; MJP's charter gives 3 working days for pressure or quality complaints.",
    needsPhone: true,
    source: "https://mjp.maharashtra.gov.in/wp-content/uploads/2022/12/Citizen-Charter-english.pdf",
  },
  {
    system: "Maha Paryavaran app (MPCB)",
    keys: ["https://play.google.com/store/apps/details?id=com.maha.paryavaran", "https://apps.apple.com/in/app/maha-paryavaran/id6746112134"],
    expect: "An industrial pollution complaint goes to MPCB's Sub-Regional Officer, who has 30 days to act; complaints about a town or village are passed to its municipality or tahsildar. Track it in the app.",
    needsPhone: true,
    source: "https://www.mpcb.gov.in/sites/default/files/whats_new/2026-02/Citizen_Charter_2026.pdf",
  },
  {
    system: "PMC CARE (Pune Municipal Corporation)",
    keys: ["https://play.google.com/store/apps/details?id=in.gov.pmc.pmccare", "https://complaint.pmc.gov.in/", "tel:+91 96899 00002"],
    expect: "Your complaint reaches the ward office or department, which assigns it to an officer; it auto-escalates to a senior if not resolved in time. Track or reopen it by token number on the portal.",
    needsPhone: true,
    source: "https://complaint.pmc.gov.in/infoLogin",
  },
  {
    system: "MMRDA online complaint management",
    keys: ["https://mmrda.maharashtra.gov.in/en/node/add/complaint_management_form", "https://mmrda.maharashtra.gov.in/en/track-complaint-management-form"],
    expect: "You verify your email address before filing. You can then track the complaint on MMRDA's site by its Application ID.",
    needsPhone: null,
    source: "https://mmrda.maharashtra.gov.in/en/track-complaint-management-form",
  },
  {
    system: "MyBMC MARG (BMC grievance system)",
    keys: ["https://play.google.com/store/apps/details?id=com.esri.ugms_bmc", "https://apps.apple.com/in/app/mybmc-marg/id6759655448", "https://marg.mcgm.gov.in/MARG/welcomePage.html"],
    expect: "You log in with your mobile number and an OTP and get a Grievance ID. Updates come to your registered mobile and email; you can track it, rate the fix, and reopen it if unhappy.",
    needsPhone: true,
    source: "https://marg.mcgm.gov.in/MARG/welcomePage.html",
  },
  {
    system: "KDMC online complaint registration",
    keys: ["https://kdmc.gov.in/kdmc/grievance.html"],
    expect: "You confirm the complaint with an OTP sent to your mobile. You can then check its status on KDMC's site with your complaint number.",
    needsPhone: true,
    source: "https://kdmc.gov.in/kdmc/grievance.html",
  },
  {
    system: "My NMMC / NMMC grievance portal",
    keys: ["https://play.google.com/store/apps/details?id=com.newnmmc.app", "https://apps.apple.com/in/app/my-nmmc-%E0%A4%AE-%E0%A4%9D-%E0%A4%A8%E0%A4%B5-%E0%A4%AE-%E0%A4%AC%E0%A4%88/id6723893978", "https://app.nmmconline.in/grievance-management/add-register/new"],
    expect: "You sign in with your mobile number (OTP or password). You can track the grievance by its Grievance ID in the app or portal, and reopen it within 7 days of closure.",
    needsPhone: true,
    source: "https://play.google.com/store/apps/details?id=com.newnmmc.app",
  },
  {
    system: "MBMC complaint CRM (Mira-Bhayandar)",
    keys: ["https://crm.mymbmc.in/"],
    expect: "You confirm by OTP and can check status by complaint number or mobile. If unhappy with the reply, send a reminder: a Deputy or Additional Commissioner must review it within 15 days.",
    needsPhone: true,
    source: "https://mbmc.gov.in/assets/upload2/2026/01/Daily%20update/%E0%A4%AA%E0%A5%8D%E0%A4%B0%E0%A4%B6%E0%A4%BE%E0%A4%B8%E0%A4%95%E0%A5%80%E0%A4%AF%20%E0%A4%89%E0%A4%A4%E0%A5%8D%E0%A4%A4%E0%A4%B0%E0%A4%A6%E0%A4%BE%E0%A4%AF%E0%A4%BF%E0%A4%A4%E0%A5%8D%E0%A4%B5%20%E0%A4%A8%E0%A4%BF%E0%A4%B6%E0%A5%8D%E0%A4%9A%E0%A4%BF%E0%A4%A4%20%E0%A4%95%E0%A4%B0%E0%A4%A3%E0%A5%8D%E0%A4%AF%E0%A4%BE%E0%A4%AC%E0%A4%BE%E0%A4%AC%E0%A4%A4%20%E0%A4%AA%E0%A4%B0%E0%A4%BF%E0%A4%AA%E0%A4%A4%E0%A5%8D%E0%A4%B0%E0%A4%95_30.pdf",
  },
  {
    system: "VVCMC complaint portal (Vasai-Virar CRM)",
    keys: ["https://crm.onlinevvcmc.in/"],
    expect: "You confirm with an OTP sent to your mobile. You can check status by complaint number or mobile, reopen the complaint, and rate the fix as satisfied or not.",
    needsPhone: true,
    source: "https://crm.onlinevvcmc.in/",
  },
  {
    system: "UMC Grievance Redressal Portal (Ulhasnagar)",
    keys: ["https://grievance.smartumc.info/"],
    expect: "You register with your mobile number and an OTP. On filing you get a Complaint ID, and your account shows it as pending, assigned, resolved or rejected.",
    needsPhone: true,
    source: "https://grievance.smartumc.info/register",
  },
  {
    system: "Panvel Municipal Corporation grievance portal",
    keys: ["https://grievance.panvelcorporation.in/"],
    expect: "Your complaint goes to the concerned department and you can check its status and redressal online or in the app. Panvel's charter gives 3 days for water pressure or quality complaints.",
    needsPhone: true,
    source: "https://panvelcorporation.maharashtra.gov.in/assets/document/nagarik.pdf",
  },
  {
    system: "CIDCO online grievance redressal system",
    keys: ["https://cidco.maharashtra.gov.in:8443/grievance_geportal/index"],
    expect: "You register with mobile and email (OTP). Your complaint goes to the department's Grievance Redressal Officer, and you can follow its status and action online.",
    needsPhone: true,
    source: "https://cidco.maharashtra.gov.in/Page?Token=1D0332BF100",
  },
  {
    system: "CM Jan Sunwai (Delhi)",
    keys: ["https://cmjansunwai.delhi.gov.in/", "https://play.google.com/store/apps/details?id=com.nic.dl.delhijanmitra"],
    expect: "You register with a mobile OTP and get a reference number; it is sent to the department concerned. You can track it, send a reminder if it is overdue, and rate how it was handled.",
    needsPhone: true,
    source: "https://cmjansunwai.delhi.gov.in/About",
  },
  {
    system: "DDA 311 'DDA at Your Service' (Samasya Nidaan Sewa)",
    keys: ["https://play.google.com/store/apps/details?id=com.everythingcivic.dda"],
    expect: "The app routes your geo-tagged complaint to the DDA department or officer concerned as a work order. You get automatic notifications, can track it, and can give feedback.",
    needsPhone: true,
    source: "https://play.google.com/store/apps/details?id=com.everythingcivic.dda",
  },
  {
    system: "Green Delhi app (DPCC)",
    keys: ["https://play.google.com/store/apps/details?id=com.green_delhi_teste"],
    expect: "You log in with a mobile OTP. Your complaint is sent automatically to the department responsible for that offence in your district, and the app shows whether it is pending or resolved.",
    needsPhone: true,
    source: "https://play.google.com/store/apps/details?id=com.green_delhi_teste",
  },
  {
    system: "MCD 311 (Municipal Corporation of Delhi)",
    keys: ["https://play.google.com/store/apps/details?id=com.everythingcivic.mcd", "https://mcd.everythingcivic.com/citizen/createissue?app_id=U2FsdGVkX180J3mGnJmT5QpgtPjhfjtzyXAAccBUxGU%3D&api_key=e34ba86d3943bd6db9120313da011937189e6a9625170905750f649395bcd68312cf10d264c9305d57c23688cc2e5120"],
    expect: "Your request, with a photo and GPS location, goes to MCD. You can track it and comment, and you are notified when the authority marks it completed.",
    needsPhone: true,
    source: "https://play.google.com/store/apps/details?id=com.everythingcivic.mcd",
  },
  {
    system: "DJB 1916 Seva app (Delhi Jal Board)",
    keys: ["https://play.google.com/store/apps/details?id=in.gov.delhi.delhijalboard"],
    expect: "You get a complaint ID and SMS updates. DJB's charter aims to fix no water, short supply or dirty water within 12 hours, and sewer blockage or overflow within 24 hours.",
    needsPhone: true,
    source: "https://delhijalboard.delhi.gov.in/sites/default/files/inline-files/citizen_s_charter.pdf",
  },
  {
    system: "DJB WhatsApp complaints (Delhi Jal Board)",
    keys: ["tel:9650291021"],
    expect: "DJB registers your water, tanker or sewer complaint from WhatsApp. Its charter aims to fix no water, short supply or dirty water within 12 hours, and sewer blockage or overflow within 24 hours.",
    needsPhone: true,
    source: "https://delhijalboard.delhi.gov.in/hi/node/2389",
  },
  {
    system: "PWD Sewa 2.0 (PWD Delhi)",
    keys: ["https://play.google.com/store/apps/details?id=com.sis.pwdsewaapp", "tel:8130188222"],
    expect: "PWD Delhi says you should normally get a response within 15 days and action within 30 days. PWD Sewa uses a mobile OTP login and lets you track the complaint.",
    needsPhone: true,
    source: "https://www.pwddelhi.gov.in/faq",
  },
  {
    system: "SMC Complaint Management System: web portal and SMC app (Surat)",
    keys: ["https://www.suratmunicipal.gov.in/OnlineServices/complaint/New", "https://play.google.com/store/apps/details?id=in.smc", "https://apps.apple.com/in/app/surat-municipal-corporation/id766167352"],
    expect: "Your complaint goes into SMC's Complaint Management System, which SMC says solves complaints in a time-bound manner and replies to you. On the website it appears under My Complaints.",
    needsPhone: null,
    source: "https://www.suratmunicipal.gov.in/FAQs/HydraulicDepartment",
  },
  {
    system: "SMC WhatsApp chatbot and toll-free complaint line (Surat)",
    keys: ["tel:+91 63599 30020", "tel:1800 123 8000"],
    expect: "Your complaint goes into SMC's Complaint Management System, which SMC says solves complaints in a time-bound manner. On WhatsApp you can also check its status.",
    needsPhone: true,
    source: "https://www.suratmunicipal.gov.in/Home/WhatsAppChatbotService",
  },
  {
    system: "SWAGAT online grievance (Gujarat; District SWAGAT to the Collector)",
    keys: ["https://swagat.gujarat.gov.in/"],
    expect: "Your application to the Collector, filed between the 1st and 10th of the month, is taken up at the monthly District SWAGAT hearing the Collector chairs. You check its status by logging in with your mobile.",
    needsPhone: true,
    source: "https://swagat.gujarat.gov.in/",
  },
  {
    system: "AMC CCRS (Ahmedabad Comprehensive Complaint Redressal System)",
    keys: ["https://play.google.com/store/apps/details?id=com.amplvb.ccrs", "https://www.amccrs.com/AMCPortal/Complaint/Register", "https://wa.me/+917567855303", "tel:155303"],
    expect: "You get an SMS with a token number; the complaint goes to the officer for your ward or area, and you get SMS updates. If it was not fixed properly you can reopen it within 24 hours of closure.",
    needsPhone: true,
    source: "https://www.amccrs.com/AMCPortal/Home/FAQ",
  },
  {
    system: "CM Window (Haryana)",
    keys: ["https://cmharyanacell.nic.in/cm_window_index"],
    expect: "You file in person at the CM Window counter in the DC or SDM office (or the CM's offices). You get a registration number and can track it online with that number and your mobile.",
    needsPhone: true,
    source: "https://cmharyanacell.nic.in/cm_window_index",
  },
  {
    system: "Irrigation & Water Resources Dept Haryana: Shikayat Nivaran Kendra",
    keys: ["https://systems.hid.gov.in/snk/"],
    expect: "You get an SMS with a complaint number and another SMS when it is resolved. If you are not satisfied, give feedback within 3 days of resolution or it is closed automatically.",
    needsPhone: true,
    source: "https://systems.hid.gov.in/SNK/UserManual/Public.pdf",
  },
  {
    system: "GMDA-MCG Complaint Handling System, Gurugram (portal, myGurugram, WhatsApp)",
    keys: ["https://services.gmda.gov.in/", "https://play.google.com/store/apps/details?id=com.gmda.citizen", "https://wa.me/917840001817"],
    expect: "Your complaint is logged in the shared GMDA and MCG complaint system, and you can check its status on the portal or in the myGurugram app.",
    needsPhone: true,
    source: "https://services.gmda.gov.in/",
  },
  {
    system: "MCG 24 Hours Challenge (Gurugram)",
    keys: ["https://mcg.gov.in/24hr-challenge"],
    expect: "You get a complaint ID and a target time; it goes automatically to the responsible MCG officer or agency, and you can track it by ID. Giving your mobile is optional.",
    needsPhone: false,
    source: "https://mcg.gov.in/24hr-challenge",
  },
  {
    system: "GMDA Anti-Encroachment Portal",
    keys: ["https://gmda.gov.in/anti-encroachment/"],
    expect: "You get a GMDA Encroachment ID to track the report. It goes first to a Junior Engineer and can escalate to an Assistant Engineer. Only GMDA roads, greenbelts, drains and land are covered.",
    needsPhone: true,
    source: "https://gmda.gov.in/anti-encroachment/",
  },
  {
    system: "West Bengal Paribesh app (WBPCB)",
    keys: ["https://play.google.com/store/apps/details?id=in.gov.wbpcb.paribeshapp"],
    expect: "Your pollution complaint goes directly from the app to the West Bengal Pollution Control Board.",
    needsPhone: true,
    source: "https://play.google.com/store/apps/details?id=in.gov.wbpcb.paribeshapp",
  },
  {
    system: "Apnar Sarkar, Apnar Pashe: WB CMO grievance portal",
    keys: ["https://cmo.wb.gov.in/"],
    expect: "You verify your mobile with an OTP and get a grievance number. The CM's grievance cell assigns it to the head of the department concerned, and you can check its status with your mobile number.",
    needsPhone: true,
    source: "https://cmo.wb.gov.in/",
  },
  {
    system: "KMC grievance system (Kolkata): portal and WhatsApp",
    keys: ["https://kmc.wb.gov.in/citizen/language-selection", "tel:8335988888"],
    expect: "Your complaint is logged in KMC's grievance system and sent to the KMC department concerned. On the web portal you log in with a mobile OTP, get a complaint number and can follow its status.",
    needsPhone: true,
    source: "https://kmc.wb.gov.in/citizen/language-selection",
  },
];

const BY_KEY = new Map(EXPECTATIONS.flatMap((e) => e.keys.map((k) => [k, e] as const)));

export const channelKey = (c: Channel) => c.url ?? `tel:${c.phone}`;

export function withExpectations(channels: Channel[]): Channel[] {
  return channels.map((c) => {
    const e = BY_KEY.get(channelKey(c));
    return e ? { ...c, system: e.system, expect: e.expect, ...(e.needsPhone != null && { needsPhone: e.needsPhone }) } : c;
  });
}
