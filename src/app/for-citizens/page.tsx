import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CitizenApp } from "@/components/sightings/citizen-app";
import { ShareGuide } from "@/components/sightings/share-guide";
import { REPORT_GROUPS } from "@/lib/sightings/taxonomy";

export const metadata: Metadata = {
  title: "For citizens | Neer Vazhvu",
  description:
    "Report trash, sewage, unsafe tap water or encroachment on a lake, river or drain near you, or add your own water test results. We check it, put it on the public record and tell you who handles it. Nothing on the record identifies you.",
  alternates: { canonical: "/for-citizens" },
};

const PROMISES: [string, string][] = [
  [
    "Nobody can see who sent a report.",
    "Public pages show the photo, what it shows, the place and the date. Never your name, email or Google account, never your notes, and never the time of day.",
  ],
  [
    "Your home stays private.",
    "Tap-water reports and water test results show only the ward or village, never the point on the map.",
  ],
  [
    "Our reports database holds nothing from your account.",
    "Each report carries a coded tag made from your account with a secret key kept outside the database, so even a copy of the database cannot tell who sent what. Your email stays only in the sign-in system.",
  ],
  [
    "Our reviewer checks reports, not people.",
    "To check a report, our reviewer sees its photos, exact location, your note and an anonymous tag, never your name or email.",
  ],
  [
    "Photos are cleaned.",
    "We strip the hidden location and date from every photo; our reviewer sees them only until the report is checked, and then they are deleted. Photos that show a face, a vehicle number plate or a house name or number are rejected, so please keep them out of the frame.",
  ],
  [
    "We never share, sell or reuse anything about you.",
    "Your account is used only to run reporting: the limits, your own report list and stopping misuse. We send you no email and show no ads. Nothing about you goes to any government department, the bodies that handle complaints, or anyone else. If you file a complaint with a body yourself, that body sees what you give it, under its own rules.",
  ],
  [
    "You can leave at any time.",
    "Delete your account from My reports. Reports not yet published go with it. Published reports stay with nothing linking them to you, or you can remove them too.",
  ],
  [
    "The limits we cannot promise away.",
    "If an Indian court or law compels us, we would have to hand over what we hold, which is why we keep nothing from your account beside any report. Google knows you used Sign in with Google here, but never sees your reports. Our sign-in and hosting providers keep standard security logs, such as internet addresses; we do not use them to identify anyone.",
  ],
];

const GUIDE: [string, React.ReactNode][] = [
  [
    "Making a good report",
    <ul key="good" className="list-disc space-y-1 pl-5">
      <li>Stand at the spot, so the location is right. Drag the pin if it is off.</li>
      <li>Take one clear photo of the problem itself. Keep faces, vehicle number plates and house names or numbers out of the frame.</li>
      <li>Pick the closest type. If nothing fits, choose Something else and describe it in a line.</li>
      <li>
        For a water test, photograph the meter or kit showing the result, choose where the water came from and enter the values you have.
        TDS alone is fine.
      </li>
      <li>One problem per report. Two problems at the same place make two reports.</li>
    </ul>,
  ],
  [
    "Why no one can trace a report to you",
    <>
      <p>
        When you sign in, Google tells our sign-in system your email, and that is the only place it is kept. When you send a report, our
        server turns your account into a code using a secret key stored somewhere else, and the report carries only that code. So the
        reports database, and anyone who copies it, sees codes, never people.
      </p>
      <p>
        Public pages show the photo, what it shows, the place and the date, and nothing else.{" "}
        <a href="#privacy" className="text-cyan-800 underline underline-offset-2 dark:text-cyan-400">
          Read every promise
        </a>
        .
      </p>
    </>,
  ],
  [
    "What happens after you send it",
    <>
      <ol className="list-decimal space-y-1 pl-5">
        <li>We check it. Reports that identify people, or are not about water at a place, are not published.</li>
        <li>It goes on the public record for that ward, water body or village.</li>
        <li>We show you which public body handles it, its official complaint channels and what each one does after you file.</li>
        <li>
          You decide whether to file. The department will know it was you, since most ask for your mobile number. Your report here stays
          anonymous either way.
        </li>
        <li>
          If you file, add the reference number and update the status as things move: reported, marked done, fixed (with a new photo) or
          still there. Anyone can then see how long a problem stayed open.
        </li>
      </ol>
      <p>
        <span className="font-semibold">Why we do not file for you.</span>{" "}
        Department portals have no way for another system to submit a
        complaint, most need the complainant&rsquo;s own mobile number, and filing in our name would make us the complainant instead of you.
      </p>
      <p>
        <span className="font-semibold">What comes next.</span> We plan to offer departments a regular summary of checked reports for
        their area, with no reporter details, and to record the status they send back for each one, so the record updates without
        depending on you.
      </p>
    </>,
  ],
];

export default function ForCitizensPage() {
  if (process.env.NEXT_PUBLIC_CITIZEN_REPORTS !== "on") notFound();
  return (
    <main className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-slate-100">Report what you see on your water</h1>
      <p className="mt-3 text-slate-700 dark:text-slate-300">
        Trash in a lake, sewage in a river, muddy tap water: send a photo and its location. We check it, add it to the public
        record for that place and tell you which public body handles it.
      </p>

      <ol className="mt-6 space-y-2 text-sm text-slate-700 dark:text-slate-300">
        <li>
          <span className="font-semibold">1. Photo and location.</span> Sign in with Google once; report as often as you need.
        </li>
        <li>
          <span className="font-semibold">2. We check every report</span> before it appears on the page for that ward, water body or
          village.
        </li>
        <li>
          <span className="font-semibold">3. You see who handles it</span> and where to file it. Add the reference number and mark it
          done or fixed, so the record shows what happened.
        </li>
      </ol>

      <div className="mt-8">
        <CitizenApp />
      </div>

      <section id="how-it-works" className="mt-10 scroll-mt-20">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">How it works, step by step</h2>
        <div className="divide-y divide-slate-200 rounded-lg border border-slate-200 text-sm text-slate-700 dark:divide-slate-700 dark:border-slate-700 dark:text-slate-300">
          {GUIDE.map(([title, body]) => (
            <details key={title} className="group p-4">
              <summary className="cursor-pointer font-semibold text-slate-900 dark:text-slate-100">{title}</summary>
              <div className="mt-2 space-y-2">{body}</div>
            </details>
          ))}
        </div>
        <ShareGuide />
      </section>

      <section className="mt-10 grid gap-6 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-400">
        <div>
          <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">What you can report</h2>
          <p>
            {REPORT_GROUPS.map((g) => g.label).join(", ")}, or anything else about water at a place, anywhere in the cities, districts and
            river basins we cover.
          </p>
          <p className="mt-2">Have a TDS meter or a water test kit? Add your results under Tap &amp; drinking water.</p>
          <p className="mt-2">Water bills, tanker prices and supply timings belong with your water board.</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">Why we ask you to sign in</h2>
          <p>
            So one person cannot flood the record with fake or repeated reports: each account has a daily limit, and an account that
            misuses it can be stopped. And so you can follow your own reports and keep their status up to date. Google confirms you are
            a real person; we never ask for your phone number or address.
          </p>
        </div>
      </section>

      <section id="privacy" className="mt-10 scroll-mt-20 text-sm text-slate-700 dark:text-slate-300">
        <h2 className="mb-3 text-lg font-semibold text-slate-900 dark:text-slate-100">Your privacy: what we promise</h2>
        <dl className="space-y-3">
          {PROMISES.map(([title, text]) => (
            <div key={title}>
              <dt className="font-semibold text-slate-900 dark:text-slate-100">{title}</dt>
              <dd className="mt-0.5">{text}</dd>
            </div>
          ))}
        </dl>
      </section>
    </main>
  );
}
