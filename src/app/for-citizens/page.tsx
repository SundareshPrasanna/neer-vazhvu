import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Plus } from "lucide-react";

import { CitizenApp } from "@/components/sightings/citizen-app";
import { displayFont } from "@/components/sightings/display-font";
import { ShareGuide } from "@/components/sightings/share-guide";
import { muted, rule, serif } from "@/components/sightings/ui";
import { listPublishedAtlasDistricts } from "@/lib/atlas/registry";
import { listBasins } from "@/lib/basins";
import { listEnabledPlaces } from "@/lib/cities";
import { logRouteError } from "@/lib/api-error";
import { adminClient, reportsEnabled } from "@/lib/sightings/auth";
import { FIXIT_LABELS, SAFETY_LINE, loadPublicGroups, type PublicGroup } from "@/lib/sightings/groups";
import { REVIEW_WITHIN_DAYS } from "@/lib/sightings/limits";
import { REPORT_GROUPS } from "@/lib/sightings/taxonomy";

export const metadata: Metadata = {
  title: "For citizens | Neer Vazhvu",
  description:
    "Report trash, sewage, unsafe tap water or encroachment on a lake, river or drain near you, or add your own water test results. We check it, put it on the public record and tell you who handles it. Nothing on the record identifies you.",
  alternates: { canonical: "/for-citizens" },
};

/** The groups list is read from the database; refreshed every few minutes. */
export const revalidate = 300;

const PROMISES: [string, string][] = [
  [
    "Nobody can see who sent a report",
    "Public pages show the photo, what it shows, the place and the date, and maps show the report within about 100 m of where it was sent. Never your name, email or Google account, never your notes, and never the time of day.",
  ],
  [
    "Groups show the group, never you",
    "If you send a report with a group, it shows the group's name, never yours. Members are never listed, not even to the group's hosts.",
  ],
  ["Your home stays private", "Tap-water reports and water test results show only the ward or village, never the point on the map."],
  [
    "Our reports database holds nothing from your account",
    "Each report carries a coded tag made from your account with a secret key kept outside the database, so even a copy of the database cannot tell who sent what. Your email stays only in the sign-in system.",
  ],
  [
    "Our reviewer checks reports, not people",
    "To check a report, our reviewer sees its photos, exact location, your note and an anonymous tag, never your name or email.",
  ],
  [
    "Photos are cleaned",
    "We strip the hidden location and date from every photo; our reviewer sees them only until the report is checked, and then they are deleted. Photos that show a face, a vehicle number plate or a house name or number are rejected, so keep them out of the frame or blur them before sending.",
  ],
  [
    "We never share, sell or reuse anything about you",
    "Your account is used only to run reporting: the limits, your own report list and stopping misuse. We send you no email and show no ads. Notifications come only if you turn them on, carry nothing about you, and can be turned off at any time. Nothing about you goes to any government department, the bodies that handle complaints, or anyone else. If you file a complaint with a body yourself, that body sees what you give it, under its own rules.",
  ],
  [
    "How reports are used",
    "Published reports are part of the public record. We use them, and the averages and trends drawn from them, for analysis, both non-commercial and commercial, always without anything that identifies you.",
  ],
  [
    "You can leave at any time",
    "Delete your account from the top of this page once signed in. Reports not yet published go with it. Published reports stay with nothing linking them to you, or you can remove them too.",
  ],
  [
    "The limits we cannot promise away",
    "If an Indian court or law compels us, we would have to hand over what we hold, which is why we keep nothing from your account beside any report. Google knows you used Sign in with Google here, but never sees your reports. Our sign-in and hosting providers keep standard security logs, such as internet addresses; we do not use them to identify anyone.",
  ],
];

const GUIDE: [string, React.ReactNode][] = [
  [
    "Making a good report",
    <ul key="good" className="list-disc space-y-1.5 pl-5">
      <li>Stand at the spot, so the location is right. Drag the pin if it is off. Sending it later? Search for the place on the map.</li>
      <li>
        Take one clear photo of the problem itself. Keep faces, vehicle number plates and house names or numbers out of the frame, or blur them
        before sending.
      </li>
      <li>Pick the closest type. If nothing fits, choose Something else and describe it in a line.</li>
      <li>For a water test, photograph the meter or kit showing the result, choose where the water came from and enter the values you have. TDS alone is fine.</li>
      <li>One problem per report. Two problems at the same place make two reports.</li>
    </ul>,
  ],
  [
    "What you can report",
    <>
      <p>
        {REPORT_GROUPS.map((g) => g.label).join(", ")}, or anything else about water at a place, anywhere in the cities, districts and river
        basins we cover.
      </p>
      <p>Have a TDS meter or a water test kit? Add your results under Tap &amp; drinking water.</p>
      <p>Water bills, tanker prices and supply timings belong with your water board.</p>
    </>,
  ],
  [
    "What happens after you send it",
    <ol key="after" className="list-decimal space-y-1.5 pl-5">
      <li>Straight away, we show you which public body handles it, its official complaint channels and what each one does after you file.</li>
      <li>
        We check it, usually within {REVIEW_WITHIN_DAYS} days. Reports that identify people, or are not about water at a place, are not
        published.
      </li>
      <li>It goes on the public record for its place: in the list and, within about 100 m, on the map.</li>
      <li>You decide whether to file. The department will know it was you, since most ask for your mobile number. Your report here stays anonymous either way.</li>
      <li>
        If you file, save the reference number (you can do it straight after sending) and update the status as things move: reported, done
        by the department, fixed (with a new photo) or still there. Turn on notifications, or add a calendar reminder, to hear when something
        changes.
      </li>
      <li>
        Anyone who passes the spot can say it is still there, or send a photo showing it fixed. We share checked reports, never anything
        about you, with the departments that handle them, and they can mark what they have done. A fixed photo is checked before the record
        changes.
      </li>
    </ol>,
  ],
  [
    "Where you will see your report",
    <p key="where">
      On the page for its place: a lake&rsquo;s panel on the water bodies map, your ward&rsquo;s page, the village or district page, or the
      river basin&rsquo;s map, where a Citizen reports layer shows every published report. The confirmation after sending, and My reports,
      link straight to it. Tap-water reports and water tests show at ward or village level only, never on the map.
    </p>,
  ],
  [
    "Groups and clean-ups",
    <>
      <p>
        Colleges, schools, residents&rsquo; associations, lake groups and NGOs can take part together. Once signed in, open Groups to start
        one, or join one with the code or invite link its host shares. We check each new group before its name appears anywhere.
      </p>
      <p>
        A report sent with a group shows the group&rsquo;s name, never the sender&rsquo;s, and counts towards what the group has done. Members
        are never listed.
      </p>
      <p>A checked group&rsquo;s hosts can plan a clean-up at a reported spot, and anyone signed in can say they will come. Clean-ups are only for:</p>
      <ul className="list-disc space-y-1 pl-5">
        {FIXIT_LABELS.map((l) => (
          <li key={l}>{l}</li>
        ))}
      </ul>
      <p>
        Never sewage, drains, debris, burning, hazardous or medical waste, or dead animals: those need the department&rsquo;s trained staff and
        equipment, and clearing sewage by hand is against the law. A clean-up adds hands to the department&rsquo;s work; the report stays open
        until it is fixed. {SAFETY_LINE}
      </p>
    </>,
  ],
  [
    "Why we do not file complaints for you",
    <>
      <p>
        Department portals have no way for another system to submit a complaint, most need the complainant&rsquo;s own mobile number, and
        filing in our name would make us the complainant instead of you.
      </p>
      <p>
        We plan to offer departments a regular summary of checked reports for their area, with no reporter details, and to record the status
        they send back for each one, so the record updates without depending on you.
      </p>
    </>,
  ],
  [
    "Why we ask you to sign in",
    <p key="why">
      So one person cannot flood the record with fake or repeated reports: each account has a daily limit, and an account that misuses it can
      be stopped. And so you can follow your own reports and keep their status up to date. Google confirms you are a real person; we never ask
      for your phone number or address.
    </p>,
  ],
];

/** Closed by default: the detail is there for whoever wants it, and out of the way of everyone else. */
function Disclosures({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className={`border-t ${rule}`}>
      {items.map(([title, body]) => (
        <details key={title} className={`group/item border-b ${rule}`}>
          <summary className="flex cursor-pointer list-none items-center justify-between gap-6 py-4 font-semibold text-slate-900 transition-colors hover:text-cyan-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:text-slate-100 dark:hover:text-cyan-400 [&::-webkit-details-marker]:hidden">
            {title}
            <Plus className="h-4 w-4 shrink-0 text-slate-400 transition-transform duration-200 group-open/item:rotate-45" aria-hidden="true" />
          </summary>
          <div className={`max-w-[62ch] space-y-3 pb-6 leading-relaxed ${muted}`}>{body}</div>
        </details>
      ))}
    </div>
  );
}

function Section({ id, title, intro, extra, children }: { id: string; title: string; intro: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section id={id} className={`scroll-mt-20 border-t py-14 sm:py-20 ${rule}`}>
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
        <div className="space-y-4">
          <h2 className={`${serif} text-3xl leading-tight sm:text-4xl`}>{title}</h2>
          <p className={`max-w-[42ch] ${muted}`}>{intro}</p>
          {extra}
        </div>
        {children}
      </div>
    </section>
  );
}

const byName = (a: string, b: string) => a.localeCompare(b);

/** Reviewed groups and what they did together (the same data as GET /api/sightings/groups); none while reporting is off. */
async function groupsTakingPart(): Promise<PublicGroup[]> {
  if (!reportsEnabled()) return [];
  try {
    return await loadPublicGroups(adminClient());
  } catch (err) {
    logRouteError("for-citizens groups", err);
    return [];
  }
}

/** Groups shown in full; the rest are counted. */
const GROUPS_SHOWN = 60;
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** A river and its watersheds read as one: sub-basins and the overview basins of one river (the Cauvery's two states) share a name. */
function basinNames() {
  const basins = listBasins();
  const byId = new Map(basins.map((b) => [b.basinId, b]));
  const names = basins.map((b) => {
    const root = (b.parentBasinId && byId.get(b.parentBasinId)) || b;
    return root.overviewMode ? `${root.displayName.replace(/\s*\(.*\)$/, "").replace(/ Basin$/, "")} and its watersheds` : b.displayName;
  });
  return [...new Set(names)].sort(byName);
}

/** The same lists a report's point is placed against (src/lib/sightings/locate-server.ts). */
function coverage() {
  return {
    cities: listEnabledPlaces().map((c) => c.displayName).sort(byName),
    districts: listPublishedAtlasDistricts().map((d) => d.name).sort(byName),
    basins: basinNames(),
  };
}

export default async function ForCitizensPage() {
  if (process.env.NEXT_PUBLIC_CITIZEN_REPORTS !== "on") notFound();
  const where = coverage();
  const groups = await groupsTakingPart();
  const places: [string, string[]][] = [
    ["Cities", where.cities],
    ["Districts", where.districts],
    ["River basins", where.basins],
  ];
  return (
    <main className={`${displayFont.variable} mx-auto max-w-7xl px-4 sm:px-6 lg:px-8`}>
      <CitizenApp
        coverage={{ cities: where.cities.length, districts: where.districts.length, basins: where.basins.length }}
        header={
          <header className="max-w-3xl pt-10 pb-10 sm:pt-16 sm:pb-14 group-data-[signed-in]/citizen:pb-6 sm:group-data-[signed-in]/citizen:pt-12 sm:group-data-[signed-in]/citizen:pb-8">
            <h1
              className={`${serif} text-[2.5rem] leading-[1.04] sm:text-6xl group-data-[signed-in]/citizen:text-[2rem] sm:group-data-[signed-in]/citizen:text-5xl`}
            >
              Report trash, sewage or dirty water near you
            </h1>
            <p className={`mt-4 max-w-[52ch] text-lg leading-relaxed group-data-[signed-in]/citizen:hidden ${muted}`}>
              Send a photo from a lake, river, drain or tap. We check it, add it to the public record for that place and show you which
              public body handles it.
            </p>
          </header>
        }
      />
      <div className="mt-20 sm:mt-28">
        <Section
          id="how-it-works"
          title="How it works"
          intro="From a photo at the spot to the public record, and on to the public body that handles it."
          extra={
            <div className="pt-2">
              <ShareGuide />
            </div>
          }
        >
          <Disclosures items={GUIDE} />
        </Section>
        <Section id="where" title="Where you can report" intro="Anywhere inside these places. We add more as each one is onboarded.">
          <dl className={`border-t ${rule}`}>
            {places.map(([label, names]) => (
              <div key={label} className={`grid gap-1 border-b py-4 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-6 ${rule}`}>
                <dt className="font-semibold text-slate-900 dark:text-slate-100">{label}</dt>
                <dd className={`leading-relaxed ${muted}`}>{names.join(", ")}</dd>
              </div>
            ))}
          </dl>
        </Section>
        <Section
          id="groups"
          title="Groups taking part"
          intro="Colleges, schools, residents' associations, lake groups and NGOs that report together and hold clean-ups. Each group is checked before its name appears."
        >
          {groups.length ? (
            <div>
              <ul className={`border-t ${rule}`}>
                {groups.slice(0, GROUPS_SHOWN).map((g) => (
                  <li key={g.id} className={`grid gap-1 border-b py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-baseline sm:gap-6 ${rule}`}>
                    <div className="min-w-0">
                      <p className="font-semibold break-words text-slate-900 dark:text-slate-100">{g.name}</p>
                      <p className={`text-sm ${muted}`}>{[g.kindLabel, g.placeName].filter(Boolean).join(", ")}</p>
                    </div>
                    <p className={`text-sm tabular-nums ${muted}`}>
                      {plural(g.reports, "report", "reports")}, {g.fixed} fixed, {plural(g.cleanups, "clean-up", "clean-ups")}
                    </p>
                  </li>
                ))}
              </ul>
              {groups.length > GROUPS_SHOWN && <p className={`mt-4 text-sm ${muted}`}>And {plural(groups.length - GROUPS_SHOWN, "more group", "more groups")}.</p>}
            </div>
          ) : (
            <p className={`max-w-[62ch] leading-relaxed ${muted}`}>
              No groups yet. Sign in and open Groups to start one for your college, school, residents&rsquo; association or lake.
            </p>
          )}
        </Section>
        <Section id="privacy" title="How we protect you" intro="What we promise about your reports and your account, and the limits we cannot promise away.">
          <Disclosures items={PROMISES.map(([title, text]) => [title, <p key={title}>{text}</p>])} />
        </Section>
      </div>
    </main>
  );
}
