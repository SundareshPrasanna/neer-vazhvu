"use client";

/**
 * Madurai-specific "What each page shows" subsections.
 *
 * Wraps every subsection in a language-conditional render so Tamil
 * readers see Tamil prose and English readers see English. The two
 * variants share JSX structure 1:1 - identical headings, same
 * subsection IDs - so cross-links and screenshots stay stable.
 *
 * Phase 4 i18n. Tamil drafts to be reviewed natively before publish.
 */

import { useLanguage } from "@/lib/i18n/context";

function SubSection({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3">
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function MaduraiPageDescriptions({ cityId, cityName }: Props) {
  const { language } = useLanguage();
  if (language === "ta") return <Tamil cityId={cityId} cityName={cityName} />;
  return <English cityId={cityId} cityName={cityName} />;
}

function English({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className="text-slate-600 dark:text-slate-400">
          The home page anchors {cityName}&apos;s reservoir picture. Vaigai dam (the drinking-water source) is the headline; Mullaperiyar (Periyar reservoir in Idukki, Kerala) is the upstream feeder via the 1886 lease tunnel and contributes ~80% of Vaigai&apos;s annual yield.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">9-year history chart</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Daily storage and percent-FRL trends going back to 2018, sourced from TN Agriculture&apos;s public reservoir archive. Toggle between 90 days, 1 year, 3 years, and the full archive; toggle Vaigai vs Mullaperiyar independently.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">14-day forecast</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Each reservoir gets its own AutoARIMA fit. Seasonal differencing kicks in once we have at least two years of history; the forecast is shown as a dashed continuation line plus a shaded 80% confidence band. Refits daily as new readings land.
        </p>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
          <li>Each reservoir is forecast independently - no cross-source pooling.</li>
          <li>The model retrains on every refresh; we don&apos;t freeze parameters.</li>
          <li>14-day horizon is aggressive but useful; the 80% band widens as you go out.</li>
          <li>Predictions clamp at 0 and the registered FRL capacity per source.</li>
        </ul>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName}&apos;s groundwater page combines two authoritative views: CGWB block exploitation (the official annual classification across the district) and a 3-factor ward-level risk composite (composite_score - gw_depth - wb_density - wb_health). The map also shows the CGWB Year Book point network as click-through markers for direct depth readings at known wells.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Block exploitation (GWR)</h4>
        <p className="text-slate-600 dark:text-slate-400">
          11 CGWB-classified blocks across Madurai district (Madurai East/North/South/West, Melur, Peraiyur, Thirupparankundram, Tirumangalam, Usilampatti, Vadipatti, Kallikudi) coloured by the latest annual draft-percentage from CGWB&apos;s Dynamic Ground Water Resources assessment. Status classes: Safe / Semi Critical / Critical / Over Exploited.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">CGWB Year Book point overlay</h4>
        <p className="text-slate-600 dark:text-slate-400">
          21 monitoring stations from CGWB&apos;s Ground Water Year Book of Tamil Nadu &amp; Puducherry (2023-24 and 2024-25 editions) - peer-reviewed, manually-measured dug wells in the phreatic / unconfined aquifer. Each station carries quarterly depth-to-water-level readings (May / Aug / Nov / Jan) spanning May 2023 - January 2025. Click any marker for the well&apos;s hydrograph and full reading history. Stations are tagged with their CGWB block (Alanganallur, Chellampatti, Kallikudi, Kottampatti, Madurai East, Madurai West, Melur, Sedapatti, T.Kallupatty, Thirumangalam, Thirupparankundram, Usilampatti, Vadipatti).
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Why no per-ward depth choropleth?</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We deliberately do NOT publish an IDW-interpolated ward depth choropleth for Madurai (the way Chennai does, via OpenCity&apos;s monthly per-ward survey data). The four India WRIS live stations across the entire district are too sparse to produce an honest 100-ward choropleth; spreading those four points smoothly across the city would manufacture precision we don&apos;t have. The 21 CGWB Year Book stations + the 11-block exploitation classification together give an honest picture without faking ward-level granularity that the underlying data doesn&apos;t support.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Live India WRIS station overlay</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            We also drop markers for each India WRIS live station in Madurai district. Click a marker for the well&apos;s metadata (acquisition mode, depth, aquifer type) and recent reading window. As of latest scrape, Madurai district has 4 telemetric (DWLR, daily) and minimal manual stations - much sparser than Chennai&apos;s ~35-station network.
          </p>
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Ward risk composite</h4>
        <p className="text-slate-600 dark:text-slate-400">
          A 3-factor weighted percentile score per ward, A-F graded. Chennai uses 5 factors (drainage 25%, sewerage 25%, flood 25%, WB-health 15%, WB-density 10%); Madurai&apos;s drainage / sewerage / flood-hazard GeoJSON layers don&apos;t exist publicly yet, so v1 ships a reduced composite with what we have:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                <th className="pb-2 font-medium">Factor</th>
                <th className="pb-2 font-medium">Weight</th>
                <th className="pb-2 font-medium">Direction</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300 text-xs">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Groundwater depth (IDW)</td>
                <td className="py-1.5 font-mono">50%</td>
                <td className="py-1.5">Deeper = higher risk</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">Water-body density (per sq km)</td>
                <td className="py-1.5 font-mono">20%</td>
                <td className="py-1.5">Denser = lower risk</td>
              </tr>
              <tr>
                <td className="py-1.5">Water-body health (mean restoration_priority within 3 km)</td>
                <td className="py-1.5 font-mono">30%</td>
                <td className="py-1.5">Higher score = sicker tank = higher risk</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Each factor is converted to a city-wide percentile (0=best, 100=highest risk), weighted, and summed. Composite ≤20 = A, ≤40 = B, ≤60 = C, ≤80 = D, &gt;80 = F.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies">
        <p className="text-slate-600 dark:text-slate-400">
          715 water-body polygons across Madurai district, sourced from OpenStreetMap. Click any polygon for its tags; the 19 hand-curated flagship tanks carry extra metadata (status, area, builder/era, court-order anchors).
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Vaigai mainstem polygons are explicitly labelled - a post-process matches each unnamed river polygon to the nearest section of the Vaigai polyline within 500 m, so long stretches of the river are no longer left blank on the map.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The lake-restoration narrative (lost tanks, flagships, programmes, court orders) lives on its own page rather than the map view; jump in via <a href={`/${cityId}/lake-restoration`} className="text-blue-600 dark:text-blue-400 hover:underline">Lake restoration</a>.
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className="text-slate-600 dark:text-slate-400">
          Vaigai-system scope: 304 km Vaigai mainstem, 121 km Periyar (Kerala feeder), 72 km Suruliyaru, 27 km Manjalar, 117 km Varaha tributaries. Per-river sidebar shows length, status, upstream/downstream termini, and feed.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">CPCB monitoring stations</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Vaigai is on CPCB&apos;s Priority III polluted-stretch list. Two stations on the National Water Monitoring Programme cover the Madurai stretch - one upstream of the city, one downstream - with annual readings for dissolved oxygen, BOD, pH, conductivity, fecal coliform, and nitrate. We extract those readings from CPCB&apos;s annual River Water Quality reports (2021-2024 covered today) and show them as a per-station table when you select Vaigai in the sidebar.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Markers are colour-coded by the latest BOD reading: red above 6 mg/L, amber above 3, green at or below 3, grey when no readings exist. The four other Vaigai stations a journalist might expect (Vaigai dam, Andipatti, Manamadurai, Ramanathapuram) stay grey because CPCB doesn&apos;t monitor them today.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Court orders &amp; key events</h4>
        <p className="text-slate-600 dark:text-slate-400">
          A hand-curated event log filtered to the selected river. Today it covers the Madras HC&apos;s December 2024 suo motu cognisance of Vaigai pollution (177 sewage / industrial discharge points across 5 districts, sampled stretches graded unfit even for irrigation), the Supreme Court&apos;s 2014 Mullaperiyar verdict (142 ft storage cap, still-active Supervisory Committee), and the operational threshold around Vaigai dam release that triggers Madurai-city flood warnings (about 6,000 cusecs).
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Industrial pollution sources</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Six hand-curated Vaigai-basin polluters mapped as type-coloured markers: the SIDCO industrial estates at Kappalur and K. Pudur, the Sellur sewage discharge zone, the Dindigul tannery cluster, the Theni textile dyeing units, and the multi-district outfall inventory cited in the December 2024 Madras HC order. Compiled from TNSIDCO records, the DHAN Foundation CURE study, the Columbia GSAPP Madurai studio, NGT orders, and news reporting. The Tamil Nadu Pollution Control Board&apos;s online effluent monitoring portal (OCMMS) is referenced as the live cross-check.
        </p>
      </SubSection>

      <SubSection id="page-flood" title="Flood risk">
        <p className="text-slate-600 dark:text-slate-400">
          Narrative-only stub. Hazard-zone polygons (5/10/25/50/100/200-year return periods), historical flood-hotspot layers, drainage GeoJSON, and sewerage overlays don&apos;t exist publicly for Madurai (in contrast with Chennai&apos;s OpenCity-published layers). The page surfaces the Vaigai dam-release threshold (~6,000 cusecs as Madurai-city flood warning; 12,000+ during the 2018 floods) and a documented locality risk note pending RTI to Madurai Corporation.
        </p>
      </SubSection>

      <SubSection id="page-lake-restoration" title="Lake restoration">
        <p className="text-slate-600 dark:text-slate-400">
          Madurai-only narrative-rich page (Chennai redirects /lake-restoration to /water-bodies). Sections: 14 lost urban tanks, 12 severely-reduced tanks, 19 hand-curated flagships, restoration programmes (Kudimaramathu / AMRUT / Smart City / IAMWARM), Madras HC court-order anchors, DHAN partnership target.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Restoration priority badge</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Each flagship carries a colour-coded priority badge built from four signals:
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
          <li><span className="font-semibold">Status severity 0-80</span> - drying / lost &gt; severely reduced &gt; encroached / polluted &gt; restored.</li>
          <li><span className="font-semibold">Cultural bonus 0-35</span> - Biodiversity Heritage Site (+25), Ramsar candidate (+20), HC PIL anchor (+15), pre-1700 heritage (+10), dynasty-era (+8).</li>
          <li><span className="font-semibold">Size 4-25</span> - acres bucketed (very large / large / medium / small / tiny).</li>
          <li><span className="font-semibold">Source confidence ×0.7-1.0</span> - V (verified), N (newsroom), C (claim only) downweights.</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Sum is bucketed: ≤40 low, ≤60 moderate, ≤80 high, &gt;80 critical. First run produced 5 critical, 2 high, 7 moderate, 5 low. Top 5: Vandiyur 100, Thenkal Kanmoi 100, Madakulam 88, Avaniyapuram 85, Samanatham 80.
        </p>
      </SubSection>

      <SubSection id="page-my-ward" title="My Ward / Report Card">
        <p className="text-slate-600 dark:text-slate-400">
          Ward-boundary map for Madurai Corporation&apos;s 100 wards (5 zones, 2022 delimitation). Click a ward to see zone, area, centroid, and a link into the per-ward report card.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">Per-ward report card</h4>
        <p className="text-slate-600 dark:text-slate-400">
          Each report card shows a large A-F grade badge, the composite score out of 100, the ward&apos;s rank within the city, and a per-factor breakdown (raw value, percentile, weight). Without a specific ward selected, the page renders an index grouping ward chips by grade so you can jump straight to the worst-graded wards.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          Madurai&apos;s report card is intentionally slimmer than Chennai&apos;s. Chennai&apos;s is built on a 5-factor composite plus an uplift-planner cost matrix; that costing layer is out of scope for the Madurai launch because the underlying drainage and sewerage layers aren&apos;t published.
        </p>
      </SubSection>

      <SubSection id="page-facts" title="Water facts">
        <p className="text-slate-600 dark:text-slate-400">
          Journalist-ready quotable stats grouped by freshness tier - live (this season), derived (last 12 months), historical (documented), and heritage (pre-modern). Today {cityName} ships 14 hand-curated heritage and governance facts plus 9 auto-derived stats that compute from the data layers we ship: over-exploited blocks, critical and semi-critical blocks, restoration priority counts, F-grade ward count and worst ward, citywide interpolated groundwater depth, Vaigai BOD pollution gradient, Vaigai dissolved oxygen downstream, urban tank area lost.
        </p>
      </SubSection>
    </>
  );
}

function Tamil({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="முகப்பு / டாஷ்போர்டு">
        <p className="text-slate-600 dark:text-slate-400">
          முகப்புப் பக்கம் {cityName} நகரின் நீர்த்தேக்க நிலையை மையமாகக் கொண்டுள்ளது. வைகை அணை (குடிநீர் ஆதாரம்) தலைப்பு; முல்லைப் பெரியார் (கேரளா இடுக்கியில் உள்ள பெரியார் நீர்த்தேக்கம்) 1886 குத்தகை சுரங்கப்பாதை வழியாக மேற்பகுதி ஊட்டியாகும், வைகையின் ஆண்டு பாய்ச்சலில் ~80%-க்கு பங்களிக்கிறது.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">9-ஆண்டு வரலாற்று வரைபடம்</h4>
        <p className="text-slate-600 dark:text-slate-400">
          தினசரி சேமிப்பு மற்றும் FRL சதவீத போக்குகள் 2018 வரை பின்னோக்கிச் செல்கின்றன, தமிழ்நாடு வேளாண்மைத் துறையின் பொது நீர்த்தேக்க காப்பகத்திலிருந்து பெறப்பட்டது. 90 நாட்கள், 1 ஆண்டு, 3 ஆண்டுகள், மற்றும் முழு காப்பகம் இடையே மாற்றலாம்; வைகை மற்றும் முல்லைப் பெரியாரை தனித்தனியாக மாற்றலாம்.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">14-நாள் முன்னறிவிப்பு</h4>
        <p className="text-slate-600 dark:text-slate-400">
          ஒவ்வொரு நீர்த்தேக்கமும் தனிப்பட்ட AutoARIMA பொருத்தத்தைப் பெறுகிறது. குறைந்தபட்சம் இரண்டு வருட வரலாறு கிடைத்தவுடன் பருவகால வேறுபாடு செயல்படத் தொடங்குகிறது; முன்னறிவிப்பு ஒரு புள்ளியிட்ட தொடர்ச்சிக் கோடாகவும், 80% நம்பிக்கை வரம்பு நிழற்கோடாகவும் காட்டப்படுகிறது. புதிய வாசிப்புகள் வரும்போது தினசரி மீண்டும் பொருத்தப்படுகிறது.
        </p>
        <ul className="list-disc list-inside text-slate-600 dark:text-slate-400 space-y-1.5 text-sm">
          <li>ஒவ்வொரு நீர்த்தேக்கமும் தனித்தனியாக முன்னறிவிக்கப்படுகிறது - குறுக்கு-ஆதார தொகுப்பு இல்லை.</li>
          <li>ஒவ்வொரு புதுப்பிப்பிலும் மாதிரி மீண்டும் பயிற்றுவிக்கப்படுகிறது; அளவுகளை நாங்கள் முடக்குவதில்லை.</li>
          <li>14-நாள் காலகட்டம் தீவிரமானது ஆனால் பயனுள்ளது; 80% வரம்பு வெளியே செல்லச் செல்ல விரிவடைகிறது.</li>
          <li>முன்னறிவிப்புகள் 0 மற்றும் ஒவ்வொரு ஆதாரத்திற்கும் பதிவு செய்யப்பட்ட FRL திறனில் கட்டுப்படுத்தப்படுகின்றன.</li>
        </ul>
      </SubSection>

      <SubSection id="page-groundwater" title="நிலத்தடி நீர்">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} நிலத்தடி நீர்ப் பக்கம் இரு அதிகாரப்பூர்வ காட்சிகளை ஒருங்கிணைக்கிறது: CGWB தொகுதி பயன்பாடு (மாவட்டம் முழுவதிலும் உத்தியோகபூர்வ ஆண்டு வகைப்பாடு) மற்றும் 3-காரணி வார்டு-நிலை ஆபத்து கூட்டுச் சதவீதம். வரைபடத்தில் CGWB நிலையங்களின் புள்ளி வலையமைப்பும் கிளிக் செய்யக்கூடிய குறிப்பான்களாக காட்டப்படுகின்றன.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">தொகுதி பயன்பாடு (GWR)</h4>
        <p className="text-slate-600 dark:text-slate-400">
          மதுரை மாவட்டம் முழுவதிலும் 11 CGWB-வகைப்பாடு செய்யப்பட்ட தொகுதிகள் (மதுரை கிழக்கு/வடக்கு/தெற்கு/மேற்கு, மேலூர், பெரையூர், திருப்பரங்குன்றம், திருமங்கலம், உசிலம்பட்டி, வாடிபட்டி, கல்லிகுடி). CGWB-யின் டைனமிக் நிலத்தடி நீர் வளங்கள் மதிப்பீட்டிலிருந்து சமீபத்திய ஆண்டு பயன்பாட்டு சதவீதத்தால் வண்ணமிடப்பட்டுள்ளன: பாதுகாப்பானது / அரை-விமர்சனம் / விமர்சனம் / அதிக-சுரண்டப்பட்டது.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">CGWB ஆண்டு புத்தக புள்ளி அடுக்கு</h4>
        <p className="text-slate-600 dark:text-slate-400">
          CGWB-யின் தமிழ்நாடு &amp; புதுச்சேரி நிலத்தடி நீர் ஆண்டு புத்தகத்தின் (2023-24 மற்றும் 2024-25 பதிப்புகள்) 21 கண்காணிப்பு நிலையங்கள் - பீர்-ஆய்வு செய்யப்பட்ட, கையேட்டில் அளவிடப்பட்ட பிரியாடிக் / கட்டற்ற நீர்ப்படிவில் உள்ள தோண்டிய கிணறுகள். ஒவ்வொரு நிலையத்திலும் காலாண்டு நீர்மட்ட அளவீடுகள் (மே / ஆகஸ்ட் / நவ / ஜன) - மே 2023 முதல் ஜன 2025 வரை. கிணற்றின் ஹைட்ரோகிராஃப் மற்றும் முழு வாசிப்பு வரலாற்றைப் பார்க்க எந்த குறிப்பானையும் கிளிக் செய்யவும். நிலையங்கள் CGWB தொகுதிகளாக குறியிடப்பட்டுள்ளன (அலகனல்லூர், செல்லம்பட்டி, கல்லிகுடி, கொட்டம்பட்டி, மதுரை கிழக்கு, மதுரை மேற்கு, மேலூர், சேடப்பட்டி, T.கல்லுபட்டி, திருமங்கலம், திருப்பரங்குன்றம், உசிலம்பட்டி, வாடிபட்டி).
        </p>
        <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
          <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">ஏன் வார்டு-வாரியான ஆழ வரைபடம் இல்லை?</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            மதுரைக்கு IDW-இடைக்கணிப்பு செய்யப்பட்ட வார்டு ஆழ வரைபடத்தை வேண்டுமென்றே வெளியிடவில்லை (சென்னை OpenCity-யின் மாதாந்திர வார்டு ஆய்வு தரவு வழியாக செய்வது போல). மாவட்டம் முழுவதும் உள்ள 4 இந்தியா WRIS நேரடி நிலையங்கள் 100 வார்டுகளுக்கான ஒரு நேர்மையான வரைபடத்தை உருவாக்க மிகக் குறைவானவை; அந்த நான்கு புள்ளிகளை நகரத்தின் மீது சீராக பரப்புவது உண்மையில் இல்லாத துல்லியத்தைச் செய்யப்படுவதாகும். 21 CGWB ஆண்டு புத்தக நிலையங்கள் + 11-தொகுதி பயன்பாட்டு வகைப்பாடு ஒன்றாக ஒரு நேர்மையான படத்தைக் கொடுக்கின்றன, தரவு ஆதரிக்காத வார்டு-நிலை விவரத்தைச் செய்யாமல்.
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 bg-white dark:bg-slate-900/40 space-y-3">
          <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">நேரடி இந்தியா WRIS நிலைய அடுக்கு</h4>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            மதுரை மாவட்டத்தில் உள்ள ஒவ்வொரு இந்தியா WRIS நேரடி நிலையத்திற்கும் நாம் குறிப்பான்களைப் போடுகிறோம். கிணற்றின் மெட்டாடேட்டா (சேகரிப்பு முறை, ஆழம், நீர்ப்படிவு வகை) மற்றும் சமீபத்திய வாசிப்பு காலத்தைப் பார்க்க ஒரு குறிப்பானைக் கிளிக் செய்யவும். சமீபத்திய சேகரிப்பின்படி, மதுரை மாவட்டத்தில் 4 தொலைதொடர்பு (DWLR, தினசரி) நிலையங்கள் மற்றும் சில கையேடு நிலையங்கள் உள்ளன - சென்னையின் ~35-நிலைய வலையமைப்பை விட மிகவும் குறைவு.
          </p>
        </div>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">வார்டு ஆபத்து கூட்டுச் சதவீதம்</h4>
        <p className="text-slate-600 dark:text-slate-400">
          ஒவ்வொரு வார்டுக்கும் 3-காரணி எடைப்படுத்தப்பட்ட சதவீத மதிப்பெண், A-F தரப்படுத்தப்பட்டது. சென்னை 5 காரணிகளைப் பயன்படுத்துகிறது (வடிகால் 25%, கழிவுநீர் 25%, வெள்ளம் 25%, நீர்நிலை-ஆரோக்கியம் 15%, நீர்நிலை-அடர்த்தி 10%); மதுரையின் வடிகால் / கழிவுநீர் / வெள்ள-ஆபத்து GeoJSON அடுக்குகள் இன்னும் பொதுவில் இல்லை, எனவே v1 கிடைக்கும் வற்றுடன் சுருக்கப்பட்ட கூட்டுச் சதவீதத்தை வழங்குகிறது:
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b">
                <th className="pb-2 font-medium">காரணி</th>
                <th className="pb-2 font-medium">எடை</th>
                <th className="pb-2 font-medium">திசை</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300 text-xs">
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">நிலத்தடி நீர் ஆழம் (IDW)</td>
                <td className="py-1.5 font-mono">50%</td>
                <td className="py-1.5">ஆழமானது = அதிக ஆபத்து</td>
              </tr>
              <tr className="border-b border-slate-100 dark:border-slate-800">
                <td className="py-1.5">நீர்நிலை அடர்த்தி (சதுர கி.மீ.-ற்கு)</td>
                <td className="py-1.5 font-mono">20%</td>
                <td className="py-1.5">அடர்த்தியானது = குறைந்த ஆபத்து</td>
              </tr>
              <tr>
                <td className="py-1.5">நீர்நிலை ஆரோக்கியம் (3 கி.மீ.-க்குள் சராசரி மறுசீரமைப்பு முன்னுரிமை)</td>
                <td className="py-1.5 font-mono">30%</td>
                <td className="py-1.5">அதிக மதிப்பெண் = நோய்வாய்ப்பட்ட கண்மாய் = அதிக ஆபத்து</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          ஒவ்வொரு காரணியும் நகரம் முழுவதும் சதவீதமாக மாற்றப்படுகிறது (0=சிறந்தது, 100=அதிக ஆபத்து), எடைப்படுத்தப்பட்டு, கூட்டப்படுகிறது. கூட்டுச் சதவீதம் ≤20 = A, ≤40 = B, ≤60 = C, ≤80 = D, &gt;80 = F.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="நீர்நிலைகள்">
        <p className="text-slate-600 dark:text-slate-400">
          மதுரை மாவட்டம் முழுவதும் 715 நீர்நிலை பலகோணங்கள், OpenStreetMap-லிருந்து பெறப்பட்டது. குறிச்சொற்களைப் பார்க்க எந்தப் பலகோணத்தையும் கிளிக் செய்யவும்; கையால் தேர்ந்தெடுக்கப்பட்ட 19 முதன்மை கண்மாய்கள் கூடுதல் மெட்டாடேட்டாவைக் கொண்டுள்ளன (நிலை, பரப்பு, கட்டியவர்/காலம், நீதிமன்ற-உத்தரவு நங்கூரங்கள்).
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          வைகை முதன்மை ஆற்றுப் பலகோணங்கள் வெளிப்படையாகக் குறிக்கப்பட்டுள்ளன - பெயரிடப்படாத ஒவ்வொரு நதி பலகோணத்தையும் 500 மீட்டருக்குள் வைகை வரியின் அருகிலுள்ள பகுதியுடன் இணைக்கும் ஒரு பின்-செயல்முறை, இதனால் ஆற்றின் நீண்ட பகுதிகள் வரைபடத்தில் வெறுமையாக இல்லை.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          ஏரி-மறுசீரமைப்பு கதை (இழந்த கண்மாய்கள், முதன்மையானவை, திட்டங்கள், நீதிமன்ற உத்தரவுகள்) வரைபட பார்வைக்குப் பதிலாக சொந்தப் பக்கத்தில் வாழ்கிறது; <a href={`/${cityId}/lake-restoration`} className="text-blue-600 dark:text-blue-400 hover:underline">ஏரி மறுசீரமைப்பு</a> வழியாக அதில் நுழையவும்.
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="ஆறுகள்">
        <p className="text-slate-600 dark:text-slate-400">
          வைகை-அமைப்பு எல்லை: 304 கி.மீ. வைகை முதன்மை, 121 கி.மீ. பெரியார் (கேரளா ஊட்டி), 72 கி.மீ. சுருளியாறு, 27 கி.மீ. மஞ்சளாறு, 117 கி.மீ. வராக கிளை ஆறுகள். ஒவ்வொரு ஆற்றின் பக்கப் பட்டியும் நீளம், நிலை, மேற்/கீழ் முனைகள் மற்றும் ஊட்டத்தைக் காட்டுகிறது.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">CPCB கண்காணிப்பு நிலையங்கள்</h4>
        <p className="text-slate-600 dark:text-slate-400">
          வைகை CPCB-ன் முன்னுரிமை III மாசுபட்ட பகுதிப் பட்டியலில் உள்ளது. தேசிய நீர் கண்காணிப்புத் திட்டத்தில் இரண்டு நிலையங்கள் மதுரை பகுதியை உள்ளடக்குகின்றன - ஒன்று நகரின் மேற்பகுதியில், ஒன்று கீழ்ப்பகுதியில் - கரைந்த ஆக்ஸிஜன், BOD, pH, கடத்துத்திறன், மலக் காளான், மற்றும் நைட்ரேட்டுக்கான ஆண்டு வாசிப்புகளுடன். CPCB-ன் ஆண்டு ஆற்று நீர் தர அறிக்கைகளிலிருந்து (இன்று 2021-2024 உள்ளடக்கப்பட்டது) அந்த வாசிப்புகளைப் பிரித்தெடுத்து, பக்கப் பட்டியில் வைகையைத் தேர்ந்தெடுக்கும் போது நிலைய-வாரி அட்டவணையாகக் காட்டுகிறோம்.
        </p>
        <p className="text-sm text-slate-600 dark:text-slate-400">
          குறிப்பான்கள் சமீபத்திய BOD வாசிப்பால் வண்ணமிடப்படுகின்றன: 6 மிகி/லி-க்கு மேல் சிவப்பு, 3-க்கு மேல் அம்பர், 3 அல்லது அதற்குக் கீழ் பச்சை, வாசிப்புகள் இல்லாதபோது சாம்பல். ஒரு பத்திரிகையாளர் எதிர்பார்க்கும் மற்ற நான்கு வைகை நிலையங்கள் (வைகை அணை, ஆண்டிபட்டி, மானாமதுரை, ராமநாதபுரம்) இன்று CPCB-வால் கண்காணிக்கப்படாததால் சாம்பல் நிறமாகவே இருக்கின்றன.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">நீதிமன்ற உத்தரவுகள் & முக்கிய நிகழ்வுகள்</h4>
        <p className="text-slate-600 dark:text-slate-400">
          தேர்ந்தெடுக்கப்பட்ட ஆற்றுக்கு வடிகட்டப்பட்ட கையால் தேர்ந்தெடுக்கப்பட்ட நிகழ்வுப் பதிவு. இன்று இது மெட்ராஸ் HC-ன் டிசம்பர் 2024 வைகை மாசுபாட்டின் சுயநினைவு உற்காரமை (5 மாவட்டங்களில் 177 கழிவுநீர்/தொழில்துறை வெளியேற்றப் புள்ளிகள், CPCB வகுப்பு D-க்குக் கீழ் 36 மாதிரிகள்), உச்சநீதிமன்றத்தின் 2014 முல்லைப் பெரியார் தீர்ப்பு (142 அடி சேமிப்பு உச்சவரம்பு, இன்னும் செயலிலுள்ள மேற்பார்வைக் குழு), மற்றும் மதுரை-நகர வெள்ள எச்சரிக்கைகளைத் தூண்டும் வைகை அணை திறப்பின் செயல்பாட்டு வரம்பு (சுமார் 6,000 க்யூசெக்ஸ்) ஆகியவற்றை உள்ளடக்கியது.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">தொழில்துறை மாசு ஆதாரங்கள்</h4>
        <p className="text-slate-600 dark:text-slate-400">
          வகை-வண்ணமிடப்பட்ட குறிப்பான்களாக வரைபடப்படுத்தப்பட்ட ஆறு கையால் தேர்ந்தெடுக்கப்பட்ட வைகை-பேசின் மாசுபடுத்திகள்: கப்பலூர் மற்றும் K. புதூரில் உள்ள SIDCO தொழில்துறை எஸ்டேட்டுகள், செல்லூர் கழிவுநீர் வெளியேற்ற மண்டலம், திண்டுக்கல் தோல்பதனிடும் தொகுப்பு, தேனி ஜவுளி சாயமிடும் அலகுகள், மற்றும் டிசம்பர் 2024 மெட்ராஸ் HC உத்தரவில் குறிப்பிடப்பட்ட பல-மாவட்ட வெளியேற்றப் பட்டியல். TNSIDCO பதிவுகள், DHAN அறக்கட்டளை CURE ஆய்வு, கொலம்பியா GSAPP மதுரை ஸ்டுடியோ, NGT உத்தரவுகள், மற்றும் செய்தி அறிக்கைகளிலிருந்து தொகுக்கப்பட்டது. நேரடி குறுக்கு-சரிபார்ப்பாக தமிழ்நாடு மாசுக் கட்டுப்பாட்டு வாரியத்தின் ஆன்லைன் கழிவுநீர் கண்காணிப்பு போர்ட்டல் (OCMMS) குறிப்பிடப்படுகிறது.
        </p>
      </SubSection>

      <SubSection id="page-flood" title="வெள்ள ஆபத்து">
        <p className="text-slate-600 dark:text-slate-400">
          கதை-மட்டுமான ஸ்டப். ஆபத்து-மண்டல பலகோணங்கள் (5/10/25/50/100/200-ஆண்டு திரும்பும் காலகட்டங்கள்), வரலாற்று வெள்ள-அதிக ஆபத்து இடப் பகுதி அடுக்குகள், வடிகால் GeoJSON, மற்றும் கழிவுநீர் அடுக்குகள் மதுரைக்கு பொதுவில் இல்லை (சென்னையின் OpenCity-வெளியிடப்பட்ட அடுக்குகளுக்கு மாறாக). வைகை அணை-திறப்பு வரம்பை (மதுரை-நகர வெள்ள எச்சரிக்கையாக ~6,000 க்யூசெக்ஸ்; 2018 வெள்ளத்தின் போது 12,000+) மற்றும் மதுரை மாநகராட்சிக்கான RTI நிலுவையிலுள்ள ஆவணப்படுத்தப்பட்ட பகுதி ஆபத்து குறிப்பை இந்தப் பக்கம் வெளிப்படுத்துகிறது.
        </p>
      </SubSection>

      <SubSection id="page-lake-restoration" title="ஏரி மறுசீரமைப்பு">
        <p className="text-slate-600 dark:text-slate-400">
          மதுரைக்கு மட்டும் கதை-நிறைந்த பக்கம் (சென்னை /lake-restoration-ஐ /water-bodies-ற்கு திருப்பிவிடுகிறது). பகுதிகள்: 14 இழந்த நகர்ப்புற கண்மாய்கள், 12 கடுமையாகச் சுருங்கிய கண்மாய்கள், கையால் தேர்ந்தெடுக்கப்பட்ட 19 முதன்மையானவை, மறுசீரமைப்பு திட்டங்கள் (குடிமராமத்து / AMRUT / ஸ்மார்ட் சிட்டி / IAMWARM), மெட்ராஸ் HC நீதிமன்ற-உத்தரவு நங்கூரங்கள், DHAN கூட்டாண்மை இலக்கு.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">மறுசீரமைப்பு முன்னுரிமை அடையாளம்</h4>
        <p className="text-slate-600 dark:text-slate-400">
          ஒவ்வொரு முதன்மையும் நான்கு சமிக்ஞைகளிலிருந்து கட்டப்பட்ட வண்ண-குறியீட்ட முன்னுரிமை அடையாளத்தைக் கொண்டுள்ளது:
        </p>
        <ul className="list-disc list-inside text-sm text-slate-600 dark:text-slate-400 space-y-1.5">
          <li><span className="font-semibold">நிலையின் தீவிரம் 0-80</span> - வறண்டு / இழந்தது &gt; கடுமையாக சுருங்கியது &gt; ஆக்கிரமிக்கப்பட்டது / மாசுபட்டது &gt; மறுசீரமைக்கப்பட்டது.</li>
          <li><span className="font-semibold">கலாச்சார கூடுதல் 0-35</span> - உயிர்ப்பல்வகைமை பாரம்பரியத் தலம் (+25), ராம்சார் வேட்பாளர் (+20), HC PIL நங்கூரம் (+15), 1700-க்கு முந்தைய பாரம்பரியம் (+10), அரசவம்ச காலம் (+8).</li>
          <li><span className="font-semibold">அளவு 4-25</span> - ஏக்கர்களாக வகைப்படுத்தப்பட்டது (மிகப்பெரியது / பெரியது / நடுத்தரம் / சிறியது / குட்டியது).</li>
          <li><span className="font-semibold">ஆதார நம்பகத்தன்மை ×0.7-1.0</span> - V (சரிபார்க்கப்பட்டது), N (செய்தி அறை), C (கூற்று மட்டுமே) குறைப்புகள்.</li>
        </ul>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          கூட்டுத்தொகை வகைப்படுத்தப்படுகிறது: ≤40 குறைந்த, ≤60 மிதமான, ≤80 உயர், &gt;80 மிக முக்கியம். முதல் இயக்கம் 5 மிக முக்கியம், 2 உயர், 7 மிதமான, 5 குறைந்த என்று உருவாக்கியது. முதல் 5: வண்டியூர் 100, தென்கால் கண்மாய் 100, மடகுளம் 88, அவனியாபுரம் 85, சாமனத்தம் 80.
        </p>
      </SubSection>

      <SubSection id="page-my-ward" title="என் வார்டு / அறிக்கை அட்டை">
        <p className="text-slate-600 dark:text-slate-400">
          மதுரை மாநகராட்சியின் 100 வார்டுகளுக்கான வார்டு-எல்லை வரைபடம் (5 மண்டலங்கள், 2022 வரம்பு). மண்டலம், பரப்பளவு, மையம் மற்றும் வார்டு-வாரி அறிக்கை அட்டையில் ஒரு இணைப்பைப் பார்க்க ஒரு வார்டைக் கிளிக் செய்யவும்.
        </p>
        <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200 pt-2">வார்டு-வாரி அறிக்கை அட்டை</h4>
        <p className="text-slate-600 dark:text-slate-400">
          ஒவ்வொரு அறிக்கை அட்டையும் ஒரு பெரிய A-F தர அடையாளம், 100-க்கு கூட்டுச் சதவீதம், நகரத்துக்குள் வார்டின் தரவரிசை, மற்றும் ஒவ்வொரு காரணி பிரிப்பு (மூல மதிப்பு, சதவீதம், எடை) ஆகியவற்றைக் காட்டுகிறது. ஒரு குறிப்பிட்ட வார்டு தேர்ந்தெடுக்கப்படாமல், மிக மோசமாக-தரப்படுத்தப்பட்ட வார்டுகளுக்கு நேரடியாக செல்ல உங்களுக்கு உதவும்படி தரத்தால் வார்டு சில்லுகளைத் தொகுக்கும் ஒரு குறியீட்டை இந்தப் பக்கம் வழங்குகிறது.
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400 italic">
          மதுரையின் அறிக்கை அட்டை வேண்டுமென்றே சென்னையை விட மெல்லியதாக உள்ளது. சென்னையின் 5-காரணி கூட்டுச் சதவீதத்துடன் ஒரு உயர்த்தும்-திட்டமிடி செலவு அணியின் மீது கட்டப்பட்டுள்ளது; அந்த செலவீட்டு அடுக்கு மதுரை வெளியீட்டின் எல்லைக்கு வெளியே உள்ளது, ஏனெனில் அடிப்படை வடிகால் மற்றும் கழிவுநீர் அடுக்குகள் வெளியிடப்படவில்லை.
        </p>
      </SubSection>

      <SubSection id="page-facts" title="நீர் உண்மைகள்">
        <p className="text-slate-600 dark:text-slate-400">
          பத்திரிகையாளர்-தயாராக மேற்கோள்-தகுந்த புள்ளிவிவரங்கள் புத்தாக்க வரிசைப்படுத்தப்பட்டுள்ளன - நேரடி (இந்த பருவம்), பெறப்பட்டது (கடந்த 12 மாதங்கள்), வரலாற்று (ஆவணப்படுத்தப்பட்டது), மற்றும் பாரம்பரியம் (நவீனத்திற்கு முன்). இன்று {cityName} கையால் தேர்ந்தெடுக்கப்பட்ட 14 பாரம்பரிய மற்றும் ஆட்சி உண்மைகளுடன், எங்கள் தரவு அடுக்குகளிலிருந்து கணக்கிடப்படும் 9 தானியங்கி-பெறப்பட்ட புள்ளிவிவரங்களையும் வழங்குகிறது: அதிக-சுரண்டப்பட்ட தொகுதிகள், விமர்சனம் மற்றும் அரை-விமர்சன தொகுதிகள், மறுசீரமைப்பு முன்னுரிமை எண்ணிக்கை, F-தர வார்டு எண்ணிக்கை மற்றும் மிகவும் மோசமான வார்டு, நகரம் முழுவதும் இடைக்கணிக்கப்பட்ட நிலத்தடி நீர் ஆழம், வைகை BOD மாசு சாய்வு, மதுரைக்கு கீழ்பகுதி வைகை கரைந்த ஆக்ஸிஜன், இழந்த நகர்ப்புற கண்மாய்ப் பரப்பு.
        </p>
      </SubSection>
    </>
  );
}
