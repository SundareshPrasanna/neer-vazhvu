import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { CitizenApp } from "@/components/sightings/citizen-app";
import { REPORT_GROUPS } from "@/lib/sightings/taxonomy";

export const metadata: Metadata = {
  title: "For citizens | Neer Vazhvu",
  description:
    "Report trash, sewage, unsafe tap water or encroachment on a lake, river or drain near you. We check it, put it on the public record and tell you who handles it.",
  alternates: { canonical: "/for-citizens" },
};

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

      <section className="mt-10 grid gap-6 text-sm text-slate-600 sm:grid-cols-2 dark:text-slate-400">
        <div>
          <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">What you can report</h2>
          <p>{REPORT_GROUPS.map((g) => g.label).join(", ")}, or anything else about water at a place.</p>
          <p className="mt-2">Water bills, tanker prices and supply timings belong with your water board.</p>
        </div>
        <div>
          <h2 className="mb-1 font-semibold text-slate-900 dark:text-slate-100">What is shown</h2>
          <p>
            The photo, what it shows, the place and the dated status. Never your name, email or notes. Tap-water reports show at
            ward or village level only.
          </p>
        </div>
      </section>
    </main>
  );
}
