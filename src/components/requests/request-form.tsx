"use client";

import { useState } from "react";

import { signInConfigured, useCitizen } from "@/components/sightings/use-citizen";
import { LIMITS } from "@/lib/requests/limits";
import type { RequestKind } from "@/lib/requests/validate";

/** Requests ride the citizen-reports sign-in, so they switch on with it. */
export const requestsEnabled = signInConfigured && process.env.NEXT_PUBLIC_CITIZEN_REPORTS === "on";

const PLACE_KINDS: { kind: RequestKind; label: string }[] = [
  { kind: "city", label: "City" },
  { kind: "district", label: "District" },
];

const field =
  "w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500";
const primary =
  "inline-flex items-center justify-center rounded-lg bg-cyan-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-cyan-800 dark:hover:bg-cyan-600 disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500";

type Sent = { status: "idle" | "sending" | "sent" } | { status: "error"; error: string };

/** Sign-in always lands on /mitra, which sends the person back to the page
 *  saved here (the round trip fixit-actions.tsx uses). */
export function signInHere(signIn: () => void) {
  try {
    sessionStorage.setItem("nv-return", window.location.pathname + window.location.search + window.location.hash);
  } catch {
    // Storage blocked: sign-in lands on /mitra instead.
  }
  signIn();
}

/** A signed-in request for a place. Signed out, it is one sign-in button. */
export function RequestForm({ subject }: { subject: string }) {
  const { session, ready, signIn, authFetch } = useCitizen();
  const [kind, setKind] = useState<RequestKind>("city");
  const [name, setName] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [contactOk, setContactOk] = useState(false);
  const [sent, setSent] = useState<Sent>({ status: "idle" });

  if (!ready) return null;
  if (!session) {
    return (
      <div>
        <button type="button" onClick={() => signInHere(signIn)} className={primary}>
          Sign in to request {subject}
        </button>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Sign-in with Google keeps requests to real people. We keep the name you give, and your email only if you tick the box.
        </p>
      </div>
    );
  }
  if (sent.status === "sent") {
    return (
      <p role="status" className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
        Request received. Thank you: we read every one.
      </p>
    );
  }

  const meta = session.user.user_metadata ?? {};
  const shownName = name ?? String(meta.full_name ?? meta.name ?? "");

  async function send(e: React.FormEvent) {
    e.preventDefault();
    setSent({ status: "sending" });
    try {
      const res = await authFetch("/api/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, subject, name: shownName, message, contactOk, sourcePath: window.location.pathname }),
      });
      const body = await res.json().catch(() => ({}));
      // Asking twice is not a failure: the first request stands.
      if (res.ok || body.reason === "duplicate") setSent({ status: "sent" });
      else setSent({ status: "error", error: body.error ?? "Could not send. Please try again." });
    } catch {
      setSent({ status: "error", error: "Could not send. Please check your connection and try again." });
    }
  }

  return (
    <form onSubmit={send} className="max-w-xl space-y-3">
      <fieldset className="flex flex-wrap items-center gap-2">
        <legend className="sr-only">{subject} is a</legend>
        <span className="text-sm text-slate-600 dark:text-slate-300">{subject} is a</span>
        {PLACE_KINDS.map((k) => (
          <label
            key={k.kind}
            className={`cursor-pointer rounded-lg border px-3 py-1 text-sm font-medium ${
              kind === k.kind
                ? "border-cyan-700 bg-cyan-50 text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                : "border-slate-300 text-slate-600 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            <input type="radio" name="kind" value={k.kind} checked={kind === k.kind} onChange={() => setKind(k.kind)} className="sr-only" />
            {k.label}
          </label>
        ))}
      </fieldset>
      <label className="block">
        <span className="text-sm text-slate-600 dark:text-slate-300">Your name</span>
        <input value={shownName} onChange={(e) => setName(e.target.value)} required maxLength={LIMITS.nameChars} className={`mt-1 ${field}`} />
      </label>
      <label className="block">
        <span className="text-sm text-slate-600 dark:text-slate-300">Why it matters to you, and any data you know of (optional)</span>
        <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={LIMITS.messageChars} className={`mt-1 ${field}`} />
      </label>
      <label className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-300">
        <input type="checkbox" checked={contactOk} onChange={(e) => setContactOk(e.target.checked)} className="mt-0.5" />
        <span>You can email me about this request at {session.user.email}</span>
      </label>
      {sent.status === "error" && <p className="text-sm text-red-700 dark:text-red-400">{sent.error}</p>}
      <button type="submit" disabled={sent.status === "sending" || !shownName.trim()} className={primary}>
        {sent.status === "sending" ? "Sending" : `Request ${subject}`}
      </button>
    </form>
  );
}
