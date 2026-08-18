"use client";

/**
 * Pune-specific "What each page shows" subsections.
 *
 * English-only for now; Marathi prose follows in the i18n pass (native
 * review pending). Documents the layers actually shipped for Pune V1 and
 * is explicit about the ways Pune refuses the Chennai baseline: it
 * impounds plenty and still runs short, its dams are an irrigation
 * project with a drinking share inside them, its groundwater is assessed
 * by taluka rather than by ward, and its flood lines exist only as
 * scanned paper.
 *
 * Every number here is PMC's own or a central regulator's, and the
 * arithmetic that produces the headline is a subtraction across two rows
 * of one PMC table rather than a model.
 *
 * Provenance for every dataset named here lives in
 * docs/cities/pune/data-sources.md (publisher, host, acquisition path,
 * licence and retrieval date); the shipped-surface summary is in
 * docs/cities/pune/features.md; and the sources watched for new editions
 * are registered in scripts/source-registry/pune.json.
 */

import Link from "next/link";

function SubSection({
  id,
  title,
  children,
}: {
  id?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      id={id}
      className="rounded-lg border border-slate-200 dark:border-slate-700 p-4 sm:p-5 bg-slate-50/50 dark:bg-slate-900/40 space-y-3"
    >
      <h3 className="text-base font-semibold text-slate-800 dark:text-slate-200">{title}</h3>
      {children}
    </div>
  );
}

function Gap({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-amber-200 dark:border-amber-900/40 p-4 bg-amber-50/50 dark:bg-amber-950/20 space-y-2">
      <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-200">{title}</h4>
      <div className="text-sm text-slate-600 dark:text-slate-400 space-y-2">{children}</div>
    </div>
  );
}

interface Props {
  cityId: string;
  cityName: string;
}

export function PunePageDescriptions({ cityId, cityName }: Props) {
  const P = "text-slate-600 dark:text-slate-400";
  const A = "text-blue-600 dark:text-blue-400 hover:underline";
  return (
    <>
      <SubSection id="supply" title="Dashboard - where the water goes between the dam and the tap">
        <p className={P}>
          {cityName} draws from four dams on the Mutha, lifts 1,681.5 MLD at a
          time, and treats it at eighteen plants rated 1,854 MLD. The headline
          on this page is not how long the water lasts. It is an arithmetic PMC
          publishes about itself, in a single table of its{" "}
          <a
            href="https://webadmin.pmc.gov.in/sites/default/files/2026-08/PMC%20Draft%20ESR%202025-26_compressed.pdf"
            target="_blank"
            rel="noopener noreferrer"
            className={A}
          >
            Draft Environment Status Report 2025-26
          </a>
          .
        </p>
        <p className={P}>
          PMC needs <strong>21.03 TMC</strong> a year and is entitled to{" "}
          <strong>16.36</strong> - a shortfall of 4.67 TMC. In the same table it
          books <strong>6.73 TMC as system losses</strong>, 32% non-revenue
          water. The entire entitlement gap sits inside the leakage, and closing
          it would leave the city 2.05 TMC in surplus without a drop of new
          water. That is a subtraction across two rows, not a model.
        </p>
        <p className={P}>
          Meanwhile PMC&apos;s own service-level benchmark reports{" "}
          <strong>four hours of supply a day</strong> against its own 24-hour
          target, after Rs 1,557.89 crore of a Rs 2,818.46 crore equitable-supply
          project, with 67 of 82 service reservoirs built and{" "}
          <strong>35 commissioned</strong>.
        </p>
        <Gap title="PMC reprinted the same benchmark table four years running">
          <p>
            The 2021-22, 2022-23, 2023-24 and 2024-25 editions all report
            coverage 98%, supply 4 hours, NRW 35%, per-capita 250 LPCD, metered
            30% and collection 88%. Only 2025-26 moves. We show that column as{" "}
            <strong>one observation</strong>, never as a four-year trend.
          </p>
          <p>
            PMC&apos;s water budget also does not quite close: the demand rows
            sum to 1,110.18 MLD while its loss row implies 1,109.65. We publish
            both of PMC&apos;s figures as printed rather than quietly correcting
            one to make the arithmetic work.
          </p>
        </Gap>
      </SubSection>

      <SubSection title="Reservoirs - and why there is no days-of-water-left number">
        <p className={P}>
          The Khadakwasla chain - Khadakwasla, Panshet, Warasgaon and Temghar -
          holds 29.15 TMC of live storage between them, read every morning from
          the Maharashtra Water Resources Department&apos;s Pravah dam-safety
          bulletin. We check those capacities against a second, independent
          government register: CWC&apos;s National Register of Large Dams agrees
          to the cubic metre on four of the six dams, and the chain total
          reproduces PMC&apos;s own published 825.43 MCM from a completely
          separate source.
        </p>
        <p className={P}>
          We deliberately do <strong>not</strong> divide that storage by the
          city&apos;s demand. The Khadakwasla Complex is an{" "}
          <strong>irrigation project with a drinking-water share inside it</strong>
          : of its 33.77 TMC of use, 22.55 TMC is the irrigation provision and
          8.3 TMC was the drinking provision in the project&apos;s own planning.
          A runway computed from total storage would credit {cityName} with water
          that belongs to the canal - and the farmers downstream at Daund and
          Indapur are in front of a regulator arguing about exactly that.
        </p>
        <Gap title="Nine years, two orders, and no settled entitlement">
          <p>
            In 2017 the Pune District Regulatory Officer fixed PMC&apos;s
            entitlement at 8.19 TMC. In December 2018 the Maharashtra Water
            Resources Regulatory Authority set that aside, deemed 11.5 TMC an
            entitlement, and found PMC&apos;s use far in excess of the
            project&apos;s own drinking provision, with the Khadakwasla farmers
            &quot;deprived of their share&quot;. PMC appealed; in May 2025 MWRRA
            found the officer who issued the order was not the competent
            authority and sent it back. It remains unresolved.
          </p>
          <p>
            The 11.5 TMC figure that circulates is the{" "}
            <strong>Khadakwasla-only</strong> reservation, not PMC&apos;s total.
            The total authorisation is 16.36 TMC. Comparing 11.5 against total
            lifting compares one reservoir&apos;s share against every source the
            city draws on, and we do not repeat it.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="groundwater" title="Groundwater - by taluka, because the district average lies">
        <p className={P}>
          <Link href={`/${cityId}/groundwater`} className={A}>
            The groundwater map
          </Link>{" "}
          shows Pune district&apos;s 14 talukas across six editions of the
          national Dynamic Ground Water Resource Assessment. This is the first
          city on the platform where we drill below the district, and the reason
          is simple: the district figure says the opposite of the finding.
        </p>
        <p className={P}>
          Pune district totals <strong>63.73% of its extractable resource and
          is categorised SAFE</strong>. Inside it, <strong>Shirur taluka is
          CRITICAL at 95.71%</strong> and has been in every published edition,
          never below 94.24%. 93% of Shirur&apos;s extraction is agriculture -
          this is an irrigation story, not a city one, and agriculture is above
          90% of extraction in 8 of the 14 talukas.
        </p>
        <p className={P}>
          Our figures reproduce CGWB&apos;s published National Compilation 2025
          exactly. That took a correction: the portal&apos;s convenient total
          silently includes saline land that CGWB excludes, which would have put
          the district at 67.25% instead of 63.23%.
        </p>
        <Gap title="Six editions are not six years of measurement">
          <p>
            The assessment recomputes what is available every edition while
            largely carrying the extraction and rainfall inputs forward. Seven of
            the 14 talukas carry a single rainfall figure across all six
            editions. Purandhar moves from semi-critical to safe on an extraction
            number that is <strong>identical in both editions</strong> - the
            denominator was revised, nothing was measured to have changed. So we
            do not draw this as an annual extraction trend.
          </p>
        </Gap>
        <Gap title="120 monitoring stations in the district. One inside the city.">
          <p>
            The station dots on that map are the finding. Maharashtra runs 120
            telemetric groundwater stations across Pune district - genuinely
            dense - and exactly one, at Shivajinagar, stands inside the municipal
            boundary. The rest instrument the eastern irrigation belt around
            Baramati, Indapur, Purandhar and Daund. Interpolating a per-ward
            depth surface for the city from one station would manufacture
            precision that does not exist, so we do not offer one.
          </p>
          <p>
            PMC publishes no groundwater figure at all, and says so: its supply
            accounts explicitly exclude borewells and private tankers, and its
            2025-26 report <em>recommends creating</em> the monitoring and
            licensing that would produce one. The only independent estimate is
            ACWADAM&apos;s (2019) - roughly 4 TMC a year from perhaps 80,000 to
            125,000 borewells, about a quarter of formal municipal supply. We
            carry that as a research estimate, never as a measurement.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="rivers" title="Rivers - what CPCB measured, next to what CPCB concluded">
        <p className={P}>
          <Link href={`/${cityId}/rivers`} className={A}>
            The rivers page
          </Link>{" "}
          carries the Mula, Mutha, Mula-Mutha, Pawana, Indrayani, Bhima and Ghod
          from the Central Pollution Control Board&apos;s October 2025 polluted
          river stretches assessment - and it shows two things from that report
          side by side, because they disagree.
        </p>
        <p className={P}>
          CPCB classifies the <strong>Mula as improved</strong>, Priority I down
          to Priority II. An annexure to the same report gives measured BOD at
          the same stations in 2024, and the Mula at Bopodi reads{" "}
          <strong>102.5 mg/L</strong> - the sixth-highest of 756 locations in
          India, higher than the worst Yamuna station CPCB publishes for Delhi
          and higher than the Mithi at Mahim. Both are shown; neither is
          averaged into the other.
        </p>
        <p className={P}>
          The Mutha&apos;s gradient is the second story. It leaves Khadakwasla
          dam at <strong>4.1 mg/L</strong>, reads 32.5 at Deccan Bridge, 35.0 at
          Sangam and <strong>50.2 at Veer Savarkar Bhavan</strong>. The river
          does not arrive polluted. And PMC generates 980 MLD of sewage against
          477 MLD of operating treatment capacity, so about half of what the city
          produces reaches this channel untreated.
        </p>
        <p className={P}>
          The Mutha Right Bank Canal is drawn alongside the rivers even though it
          is not one. It carries Khadakwasla water east to the Daund and Indapur
          command, and it is the other claimant on the same water -
          {cityName}&apos;s entitlement argument is unreadable without it.
        </p>
        <Gap title="What the monitoring does not include">
          <p>
            CPCB names its stations but publishes no coordinates for them, so
            readings appear in the panel while the stations get no map marker. We
            would rather carry the numbers than invent positions.
          </p>
          <p>
            Per-station COD is collected by the state board and not published,
            and no surfactant measurement exists for the Indrayani - which
            matters, because MPCB attributes the recurring foam at the Alandi
            ghats to detergent while PCMC attributes it to the Chakan, Dehu and
            Talegaon industrial estates. Neither has published a measurement, so
            the page states the dispute rather than settling it.
          </p>
        </Gap>
      </SubSection>

      <SubSection id="water-bodies" title="Water bodies and wards">
        <p className={P}>
          <Link href={`/${cityId}/water-bodies`} className={A}>
            The water-bodies map
          </Link>{" "}
          draws 791 polygons, 84 of them named, from OpenStreetMap. That source
          choice is itself a finding: <strong>PMC publishes no lake or tank
          layer at all</strong>. Its only water-body file is twelve polygons of
          river channel. Katraj, Pashan, Jambhulwadi and Bund Garden are in
          OpenStreetMap and in none of the municipal datasets we could reach.
        </p>
        <p className={P}>
          Seven features that OpenStreetMap tags as water are excluded, and the
          count above is after that: three swimming pools, a gym pool, a service
          reservoir, a rainwater-harvesting sump and one pool carrying no water
          tag at all. The exclusion is kept narrow on purpose, because{" "}
          <em>talav</em> is a real water body here - Ganesh Talav and Lakaki
          Talav are lakes, and a broader match for &ldquo;tank&rdquo; would have
          deleted them.
        </p>
        <Gap title="OpenStreetMap is not a register, and no register exists">
          <p className={P}>
            Maharashtra publishes no open vector lake layer. MRSAC, the state
            remote-sensing centre that would be the equivalent of Tamil Nadu&apos;s
            open GeoServer, does not resolve publicly; Bhuvan answers a vector
            request with <em>Service WFS is disabled</em> and serves raster tiles
            only. The Government of India&apos;s First Census of Water Bodies does
            cover Maharashtra and enumerates 3,680 in Pune <em>district</em>, but
            only ten of those fall inside PMC, and its condition columns are
            near-uniformly unfilled defaults - 3,679 of 3,680 recorded as not
            encroached. It is a rural minor-irrigation tank census, and it is not
            a substitute for this layer.
          </p>
        </Gap>
        <p className={P}>
          <Link href={`/${cityId}/my-ward`} className={A}>
            Ward boundaries
          </Link>{" "}
          are the 41 electoral prabhags of the 2025 delimitation, used for the
          2026 PMC election. The published boundary file carries no ward names at
          all - only numbers - so the names come from PMC&apos;s own election
          results, joined 41 of 41. PMC separately runs 15 administrative ward
          offices, which are a different geography and are what its operational
          records key to.
        </p>
        <Gap title="Pimpri-Chinchwad is not covered, and cannot honestly be">
          <p>
            PCMC is a separate corporation of 181 sq km on its own Pavana source,
            and it publishes its own environment reports. But no PCMC ward
            boundary exists in any public form - no open dataset, a login-walled
            GIS server, and no corporation polygon in OpenStreetMap. Rather than
            draw a two-corporation region with one corporation missing, this
            place is scoped to PMC and says so.
          </p>
        </Gap>
      </SubSection>

      <SubSection title="Rainfall">
        <p className={P}>
          Long-term rainfall comes from IMD&apos;s 0.25-degree gridded dataset,
          1970 to 2025, with recent months filled provisionally until IMD
          publishes. Which grid cell we use was a real decision rather than a
          default: Pune district carries a fourfold rainfall gradient from the
          Western Ghats to the eastern rain shadow, so a quarter-degree matters.
          The cell that looks nearest sits 11 km west, up the gradient, and runs
          31% above IMD&apos;s own Pune observatory normal. The cell we use is
          within 4.3% of it.
        </p>
      </SubSection>

      <SubSection title="What is not here yet">
        <p className={P}>
          Every absence below is a decision with a reason, recorded in the
          repository so an omission is never indistinguishable from a bug.
        </p>
        <Gap title="No flood-risk page">
          <p>
            The event register is not the problem - the 1961 Panshet dam breach,
            the 2019 Ambil Odha flash flood, and the July and August 2024
            releases are all dated and sourced. The hazard layer is. Maharashtra
            WRD publishes {cityName}&apos;s red and blue flood lines as{" "}
            <strong>518 scanned map sheets and no vector files</strong>. There is
            nothing to draw without digitising paper.
          </p>
        </Gap>
        <Gap title="No tanker page - yet">
          <p>
            This one is buildable and is the largest piece of work outstanding.
            PMC publishes a genuine daily tanker register: hundreds of
            spreadsheets since April 2026, one per filling point per day, each
            row carrying the ward, the recipient society, the address and the
            tanker&apos;s vehicle number. One filling point logged 424
            deliveries in a single day - in the monsoon. The producer is not
            written.
          </p>
        </Gap>
        <Gap title="No allocation ledger">
          <p>
            The instruments are unusually well documented, but the ledger&apos;s
            whole point is entitled against <em>received</em>, and no measured
            annual draw has been published since 2017-18 - a year for which PMC
            and the state water department disagree by 4.15 TMC. A ledger whose
            received column is eight years old and contested would be worse than
            none.
          </p>
        </Gap>
      </SubSection>
    </>
  );
}
