"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { Bell, Camera, Check, ChevronDown, Loader2 } from "lucide-react";

import { nodFor, seenText, thanksText } from "@/lib/sightings/community";
import type { NodEvent } from "@/lib/sightings/status";
import type { PublicReport } from "@/lib/sightings/types";
import { ActionButton } from "./action-feedback";
import { FixitActions } from "./fixit-actions";
import { appLink, btn, enter, fileFocus, muted } from "./ui";
import { shrinkPhoto, type useCitizen } from "./use-citizen";

type Citizen = ReturnType<typeof useCitizen>;
type Counts = { seenCount: number; thanksCount: number };
type Result = { ok: true; data: unknown } | { ok: false; error: string };

/** Signed out: remember this page and start Google sign-in; /for-citizens sends the person back. True when the tap stops here. */
function signInFirst(citizen: Citizen): boolean {
  if (citizen.session) return false;
  // Still reading the saved session: a signed-in person is not sent to Google.
  if (!citizen.ready) return true;
  try {
    sessionStorage.setItem("nv-return", window.location.pathname + window.location.search + window.location.hash);
  } catch {
    // Storage blocked: sign-in lands on the report page instead.
  }
  citizen.signIn();
  return true;
}

async function call(authFetch: Citizen["authFetch"], url: string, init: RequestInit): Promise<Result> {
  const res = await authFetch(url, init).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, data: json.data } : { ok: false, error: json.error ?? "Could not save. Please try again." };
}

/** The places this person follows, asked once per page and kept in step with their taps. */
let followed: { user: string; targets: Promise<Set<string>> } | null = null;
function followsOf(user: string, authFetch: Citizen["authFetch"]): Promise<Set<string>> {
  if (followed?.user !== user) {
    const targets = authFetch("/api/sightings/follows").then(async (r) => {
      if (!r.ok) throw new Error(String(r.status));
      const j = await r.json();
      return new Set<string>((Array.isArray(j?.data) ? j.data : []).map((f: { target: string }) => f.target));
    });
    followed = { user, targets };
    targets.catch(() => {
      if (followed?.targets === targets) followed = null;
    });
  }
  return followed.targets;
}

const Done = ({ children }: { children: React.ReactNode }) => (
  <span role="status" className="inline-flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
    <Check className="h-4 w-4" aria-hidden="true" />
    {children}
  </span>
);

const Problem = ({ error }: { error: string | null }) =>
  error ? (
    <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
      {error}
    </p>
  ) : null;

/** One tap, once per person: the count goes up at once and is put right by the server's answer. */
function useNod(report: PublicReport, citizen: Citizen) {
  const [counts, setCounts] = useState<Counts>({ seenCount: report.seenCount, thanksCount: report.thanksCount });
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const send = async (event: NodEvent) => {
    if (signInFirst(citizen)) return;
    const field = event === "seen_too" ? "seenCount" : "thanksCount";
    const before = counts;
    setBusy(true);
    setError(null);
    setCounts({ ...counts, [field]: counts[field] + 1 });
    const fd = new FormData();
    fd.append("event", event);
    const r = await call(citizen.authFetch, `/api/sightings/${report.id}/events`, { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) {
      setCounts(before);
      return setError(r.error);
    }
    const d = r.data as Partial<Counts> | undefined;
    if (typeof d?.seenCount === "number" && typeof d.thanksCount === "number") setCounts({ seenCount: d.seenCount, thanksCount: d.thanksCount });
    setDone(true);
  };
  return { counts, busy, done, error, send };
}

/** "Follow this place" (the report's most specific place) and, beneath it, a planned clean-up or a way to plan one. */
function HelpPanel({ id, report, citizen }: { id: string; report: PublicReport; citizen: Citizen }) {
  const [following, setFollowing] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { authFetch } = citizen;
  const user = citizen.session?.user.id;
  const target = report.followTarget;

  useEffect(() => {
    if (!user) return;
    let live = true;
    followsOf(user, authFetch)
      .then((s) => live && setFollowing(s.has(target)))
      .catch(() => live && setFollowing(false));
    return () => {
      live = false;
    };
  }, [user, authFetch, target]);

  const toggle = async () => {
    if (signInFirst(citizen)) return;
    const next = !following;
    setBusy(true);
    setError(null);
    setFollowing(next);
    const r = await call(authFetch, "/api/sightings/follows", { method: next ? "POST" : "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ target }) });
    setBusy(false);
    if (!r.ok) {
      setFollowing(!next);
      return setError(r.error);
    }
    followed?.targets.then((s) => void (next ? s.add(target) : s.delete(target))).catch(() => {});
  };

  return (
    <div id={id} className={`space-y-3 rounded-lg bg-slate-50 p-3 dark:bg-slate-900 ${enter}`}>
      <div className="space-y-1.5">
        <ActionButton
          label={following ? "Following" : "Follow this place"}
          busyLabel="Saving…"
          busy={busy}
          disabled={!!user && following === null}
          pressed={!!following}
          icon={following ? <Check className="h-4 w-4" aria-hidden="true" /> : <Bell className="h-4 w-4" aria-hidden="true" />}
          onClick={toggle}
          className={btn("secondary", "sm")}
        />
        <p className={`text-xs ${muted}`}>
          {following ? "You get a notice when something here is reported or fixed. Tap Following to stop." : "Get a notice when something here is reported or fixed."} Notices need notifications on in{" "}
          <Link href="/for-citizens" className={appLink}>
            My reports
          </Link>
          .
        </p>
        <Problem error={error} />
      </div>
      <FixitActions report={report} citizen={citizen} />
    </div>
  );
}

/** An open report: "I've seen it too", "It's gone" (a fixed photo, checked before it counts) and "I want to help". */
function OpenActions({ report, citizen }: { report: PublicReport; citizen: Citizen }) {
  const nod = useNod(report, citizen);
  const [gone, setGone] = useState<"idle" | "busy" | "sent">("idle");
  const [goneError, setGoneError] = useState<string | null>(null);
  const [help, setHelp] = useState(Boolean(report.fixit));
  const panel = useId();

  const sendGone = async (file: File) => {
    setGone("busy");
    setGoneError(null);
    const fd = new FormData();
    fd.append("event", "fixed");
    fd.append("photos", file);
    const r = await call(citizen.authFetch, `/api/sightings/${report.id}/events`, { method: "POST", body: fd });
    if (!r.ok) {
      setGone("idle");
      return setGoneError(r.error);
    }
    setGone("sent");
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {nod.done ? (
          <Done>You&rsquo;ve seen it too</Done>
        ) : (
          <ActionButton label="I've seen it too" busyLabel="Saving…" busy={nod.busy} onClick={() => nod.send("seen_too")} className={btn("secondary", "sm")} />
        )}
        {nod.counts.seenCount > 0 && <span className={`text-sm tabular-nums ${muted}`}>{seenText(nod.counts.seenCount)}</span>}
      </div>
      <Problem error={nod.error} />
      <div className="flex flex-wrap items-center gap-2">
        {gone === "sent" ? (
          <Done>Thanks. Your photo is checked before the report changes.</Done>
        ) : (
          <label className={`${btn("secondary", "sm")} ${fileFocus}`} aria-disabled={gone === "busy"} onClick={(e) => signInFirst(citizen) && e.preventDefault()}>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              disabled={gone === "busy"}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = "";
                if (f) await sendGone(await shrinkPhoto(f));
              }}
            />
            {gone === "busy" ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Camera className="h-4 w-4" aria-hidden="true" />}
            {gone === "busy" ? "Sending…" : "It's gone"}
          </label>
        )}
        <button type="button" aria-expanded={help} aria-controls={panel} onClick={() => setHelp(!help)} className={btn("secondary", "sm")}>
          I want to help
          <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${help ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
      </div>
      <Problem error={goneError} />
      {help && <HelpPanel id={panel} report={report} citizen={citizen} />}
    </div>
  );
}

/** A fixed report: "Thank you", once per person, the reporter too. */
function ThankYou({ report, citizen }: { report: PublicReport; citizen: Citizen }) {
  const nod = useNod(report, citizen);
  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        {nod.done ? (
          <Done>You said thank you</Done>
        ) : (
          <ActionButton label="Thank you" busyLabel="Saving…" busy={nod.busy} onClick={() => nod.send("thanks")} className={btn("secondary", "sm")} />
        )}
        {nod.counts.thanksCount > 0 && <span className={`text-sm tabular-nums ${muted}`}>{thanksText(nod.counts.thanksCount)}</span>}
      </div>
      <Problem error={nod.error} />
    </div>
  );
}

/**
 * What anyone can do on a published report about a shared place: on an open one, say they have seen it too, send a
 * photo showing it gone, or help (follow the place, join or plan a clean-up); on a fixed one, say thank you. Nothing
 * on a home's tap water or test, or on other statuses. No names, likes or comments: counts only.
 */
export function CommunityActions({ report, citizen }: { report: PublicReport; citizen: Citizen }) {
  const nod = nodFor(report);
  if (nod === "seen_too") return <OpenActions report={report} citizen={citizen} />;
  if (nod === "thanks") return <ThankYou report={report} citizen={citizen} />;
  return null;
}
