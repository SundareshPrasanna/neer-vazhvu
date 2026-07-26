"use client";

/**
 * Hyderabad-specific "What each page shows" subsections.
 *
 * English-only for now; Telugu prose follows in the i18n pass.
 *
 * Documents the layers actually shipped for Hyderabad V1 and is explicit
 * about what distinguishes Hyderabad from the Chennai baseline in BOTH
 * directions - it has a richer daily supply feed than any other city on the
 * platform, and it has no public ward geometry at all.
 *
 * Provenance for every dataset named here lives in
 * docs/cities/hyderabad/data-sources.md (publisher, host, acquisition path,
 * licence and retrieval date), and the sources watched for new editions are
 * registered in scripts/source-registry/hyderabad.json.
 *
 * HOUSE RULE APPLIED THROUGHOUT: figures that exist only in news reporting -
 * HMWSSB's service-area size, population served, headline supply in MLD, and
 * every published STP count - are NOT repeated here, because they are
 * mutually inconsistent across sources. Where a number is absent, that is
 * deliberate and is said out loud.
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

interface Props {
  cityId: string;
  cityName: string;
}

export function HyderabadPageDescriptions({ cityId, cityName }: Props) {
  return (
    <>
      <SubSection id="page-dashboard" title="Home / dashboard">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} has the richest daily supply feed of any city on this
          platform. HMWSSB publishes, every day, not just the level and storage
          of each of its six sources but{" "}
          <strong>how much it actually drew from each in million litres</strong>{" "}
          and how much flowed in. Most utilities publish a design capacity and
          leave the rest to inference. That means the water-runway figure here
          is divided by a measured number rather than an assumed one, and the
          three rainfall scenarios are all computable - Mumbai&apos;s dashboard
          has to collapse them into one line because its feed carries storage
          only.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The archive runs daily from 1 January 2014, so the chart spans twelve
          and a half years. Two things in that record are worth knowing. The
          board&apos;s own summary row is labelled &quot;Total(1 to 5)&quot; but
          does not sum rows 1 to 5 - it silently includes the Godavari source
          added later - so we recompute the total from the individual rows.
          And on 1 July 2026 the published capacity of Osman Sagar and Himayat
          Sagar changed by about a tenth and a seventh respectively, overnight
          and without notice. We detected it by bisecting the archive. The cause
          is not established and we do not describe it as siltation.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Deliberately absent: a supply-overview panel of treatment-plant counts
          and population served. Those figures exist only in news reporting and
          contradict each other across sources, so we publish none of them until
          HMWSSB&apos;s own disclosure is obtained.
        </p>
      </SubSection>

      <SubSection id="page-water-bodies" title="Water bodies">
        <p className="text-slate-600 dark:text-slate-400">
          Three instruments count {cityName}&apos;s lakes and none of them is a
          complete inventory, so the page shows all three rather than picking a
          winner. OpenStreetMap contributes 669 mapped polygons totalling about
          10,599 hectares - the geometry. HMDA&apos;s gazetted register
          contributes 2,978 lakes with their legal notification status - the
          boundary. The 2023 Jal Dharohar census contributes 3,116 enumerated
          points across Hyderabad and Rangareddy districts - the enumeration. A
          lake can be gazetted and unmapped, or mapped and never notified.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The register is the accountability layer. Every lake is meant to have
          its Full Tank Level fixed twice - a preliminary notification, then a
          final one after objections. All 2,978 have the preliminary;{" "}
          <strong>only 1,352 have the final</strong>. Until the final issues
          there is no boundary a court can be pointed at. The gap is worst
          exactly where development pressure is highest: Rangareddy, the Outer
          Ring Road corridor, holds 891 lakes and has 34.5% finally notified,
          against 68.0% in Siddipet.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          What we do <em>not</em> have is the shape of those legal boundaries.
          HMDA publishes a survey sheet per lake carrying the FTL elevation,
          tank area and perimeter, but they are scanned raster PDFs with no
          extractable text, so no machine-readable polygon exists. Recovering
          them means optical character recognition over ~3,000 title blocks -
          a planned job, not a shipped one.
        </p>
      </SubSection>

      <SubSection id="page-groundwater" title="Groundwater">
        <p className="text-slate-600 dark:text-slate-400">
          Point observations from the Central Ground Water Board network via
          India-WRIS, which for {cityName} is live - telemetric readings run to
          June 2026, where Delhi&apos;s equivalent network stopped in September
          2025.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          481 wells, with 10,724 monthly readings and a median depth of about
          8.7 metres below ground level. Ranga Reddy contributes 192 and Medak
          173, so the metro core alone carries around 240 - a denser network
          than we expected and comparable to Delhi&apos;s.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          We show the wells as points and deliberately do <em>not</em>{" "}
          interpolate a continuous depth surface between them. Partly because
          there is no public ward geometry to interpolate onto, and partly
          because this is Deccan hard rock - granite and gneiss, where water
          sits in weathered zones and discrete fractures rather than a
          continuous water table. A smooth surface drawn between two wells a
          few kilometres apart would assert groundwater that may not be there.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          One handling note that matters: the national database returns depth
          with a sign that depends on which programme installed the station,
          and Hyderabad mixes them - the telemetric recorders report one way
          and the older manual wells the other. We derive the convention
          separately for every station from its own record rather than assuming
          it, because taking absolute values would erase genuine readings of
          water standing above the sensor.
        </p>
      </SubSection>

      <SubSection id="page-rivers" title="Rivers">
        <p className="text-slate-600 dark:text-slate-400">
          The Musi and its tributary the Esi, plus the Manjira on the supply
          side. Two honest caveats. First, OpenStreetMap maps the Musi under
          three different names, which we merge - without that it renders as
          three rivers. Second, and more important, the Esi is represented by a
          single 10-kilometre way against the Musi&apos;s 244, even though
          Himayat Sagar impounds the Esi exactly as Osman Sagar impounds the
          Musi. That is a gap in the public map, not a fact about the river, and
          the page should not be read as saying the Esi is minor.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          River <em>quality</em> is not shown. The Musi is among India&apos;s
          most-cited polluted river stretches, but the canonical national
          monitoring data sits on a Central Pollution Control Board host that
          refuses connections from outside India, so it needs a different
          acquisition path than our other feeds. We would rather show nothing
          than show a number we cannot source.
        </p>
      </SubSection>

      <SubSection id="page-flood-risk" title="Flood risk">
        <p className="text-slate-600 dark:text-slate-400">
          GHMC&apos;s own layers: 96 named nalas (storm-water drains) running
          about 245 kilometres, 23 designated major water-logging locations, and
          the wider canal and drain network.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          The most important thing on this page is an absence. GHMC&apos;s nala
          layer <strong>defines</strong> the fields the flooding debate needs -
          encroachments per drain, separated into government, private and
          religious, with a count of how many are in court - and publishes all
          five as zero for all 96 drains. In a city that created HYDRAA in 2024
          specifically to demolish encroachments, that is an unfilled column
          rather than a clean record, so we strip those fields rather than
          render them. We flag it here because the schema already specifies
          exactly what to ask for.
        </p>
      </SubSection>

      <SubSection id="page-tanker" title="Tanker">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} is the one city where the tanker market is run by the
          utility itself and reported. HMWSSB publishes monthly bookings and
          deliveries for each of its 201 operational sections -{" "}
          <Link
            href={`/${cityId}/tanker`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            1.32 million bookings
          </Link>{" "}
          between January 2022 and February 2024. Bengaluru&apos;s equivalent
          page rests on household surveys because that market is private and
          unreported.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          We looked for a fulfilment gap and there isn&apos;t one: 99.95% of
          bookings were delivered, and the worst of 201 sections still ran at
          98.4%. So the page reports demand instead, which is where the signal
          is. Bookings triple between October and June, and the heaviest demand
          is not in the old city but in Madhapur, Kondapur, Hafeezpet,
          Gachibowli and Manikonda - the IT corridor. Tanker dependence here
          tracks where the city outgrew its pipes, not where residents are
          poorest.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Two gaps, both upstream: the published series stops at February 2024,
          and December 2022 is missing entirely - the file exists but is empty
          at source. Neither month is interpolated. Sections are HMWSSB&apos;s
          own operational units and no public boundary file exists for them, so
          this is a ranked table rather than a map.
        </p>
      </SubSection>

      <SubSection id="page-rainfall" title="Rainfall">
        <p className="text-slate-600 dark:text-slate-400">
          {cityName} is measured far better than any other city here. The
          Telangana Development Planning Society publishes daily rainfall from
          individual automatic weather stations with their own coordinates, and{" "}
          <strong>161 of them sit inside the city</strong>. Every other city on
          this platform infers rainfall from a single 0.25-degree grid cell
          about 28 kilometres across. For a city whose flooding is intensely
          localised, that is the difference between seeing a storm and averaging
          it away.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Note a count discrepancy we have not resolved: the network&apos;s own
          summary page reports 185 stations inside Greater Hyderabad, the
          station map exposes 162, and 161 resolve to coordinates. We publish
          what we can place on a map and say so. The station endpoint returns
          only the latest reading with no archive, so the series accumulates
          from the day we started collecting; the long history sits in annual
          bulk files that are a separate job.
        </p>
      </SubSection>

      <SubSection id="page-missing" title="What is missing, and why">
        <p className="text-slate-600 dark:text-slate-400">
          <strong>My Ward is not available.</strong> A gazette notification on
          25 December 2025 replaced Greater Hyderabad&apos;s 150 wards with 300,
          and on 11 February 2026 the corporation was split into three - GHMC,
          Cyberabad and Malkajgiri. The geometry for those 300 wards is not
          public. The only ward boundaries available are the superseded 150-ward
          set, which would attribute data to boundaries that no longer exist.
          There is also currently nobody to attribute it to: the corporations
          are run by a Special Officer pending elections, so there are no
          sitting councillors.
        </p>
        <p className="text-slate-600 dark:text-slate-400">
          Water, notably, was <em>not</em> divided with the corporations.
          HMWSSB continues to serve the whole Core Urban Region, which is why
          this remains one water story under three municipal governments - and
          why {cityName} is modelled here as a single city rather than as a
          region of independent corporations the way Mumbai is.
        </p>
      </SubSection>
    </>
  );
}
