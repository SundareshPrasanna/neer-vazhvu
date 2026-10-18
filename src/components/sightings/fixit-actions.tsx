"use client";

import { useState } from "react";
import { CalendarDays, Check, ShieldAlert } from "lucide-react";

import { GROUP_LIMITS, SAFETY_LINE, fixitAllowed, fixitWhen, istInputToIso, isoToIstInput } from "@/lib/sightings/groups";
import type { PublicFixit, PublicReport } from "@/lib/sightings/types";
import { ActionButton } from "./action-feedback";
import { useMyGroups } from "./groups-panel";
import { btn, enter, field, muted, rule } from "./ui";
import type { useCitizen } from "./use-citizen";

type Citizen = ReturnType<typeof useCitizen>;

const post = async (citizen: Citizen, body: object): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> => {
  const res = await citizen
    .authFetch("/api/sightings/fixits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
    .catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, data: json.data } : { ok: false, error: json.error ?? (res ? "That did not save. Please try again." : "No connection. Please try again.") };
};

/** Signed out: sign in, then come back to this page (the same round trip as "Seen it lately?"). */
function signInHere(citizen: Citizen) {
  try {
    sessionStorage.setItem("nv-return", window.location.pathname + window.location.search + window.location.hash);
  } catch {
    // Storage blocked: sign-in lands on the report page instead.
  }
  citizen.signIn();
}

function Safety() {
  return (
    <p className={`flex items-start gap-1.5 text-xs leading-relaxed ${muted}`}>
      <ShieldAlert className="mt-px h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      {SAFETY_LINE}
    </p>
  );
}

function Problem({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
      {text}
    </p>
  ) : null;
}

/** A planned clean-up: who, when, where to meet, how many are coming; "I'll come" for anyone, Cancel and Mark done for hosts. */
function Planned({ fixit, citizen, onEnded }: { fixit: PublicFixit; citizen: Citizen; onEnded: (s: "cancelled" | "done") => void }) {
  const { data, refresh } = useMyGroups(citizen, !!citizen.session);
  const [now] = useState(() => Date.now());
  const [count, setCount] = useState(fixit.going);
  const [mine, setMine] = useState<boolean | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const going = mine ?? !!data?.going.includes(fixit.id);
  const host = !!data?.hosting.includes(fixit.id);
  const started = Date.parse(fixit.startsAt) <= now;

  const run = async (action: "rsvp" | "unrsvp" | "cancel" | "done") => {
    if (!citizen.session) return signInHere(citizen);
    setBusy(action);
    setError(null);
    const r = await post(citizen, { action, fixitId: fixit.id });
    setBusy(null);
    if (!r.ok) return setError(r.error!);
    if (action === "rsvp" || action === "unrsvp") {
      setCount(Number(r.data?.going ?? count));
      setMine(action === "rsvp");
    } else onEnded(action === "cancel" ? "cancelled" : "done");
    void refresh();
  };

  return (
    <div className="space-y-2.5">
      <p className="flex items-start gap-2 text-sm text-slate-800 dark:text-slate-200">
        <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
        <span>
          Clean-up planned by <span className="font-semibold">{fixit.groupName}</span>, {fixitWhen(fixit.startsAt)} (India time), meet at{" "}
          {fixit.meetingPoint}.
        </span>
      </p>
      {fixit.note && <p className={`pl-6 text-sm break-words ${muted}`}>{fixit.note}</p>}
      <div className="flex flex-wrap items-center gap-2 pl-6">
        <span className={`text-sm tabular-nums ${muted}`}>
          {count} coming{going ? ", including you" : ""}
        </span>
        {!started &&
          (going ? (
            <ActionButton label="Not coming" busyLabel="Saving…" busy={busy === "unrsvp"} disabled={busy != null} onClick={() => run("unrsvp")} className={btn("quiet", "sm")} />
          ) : (
            <ActionButton
              label="I'll come"
              busyLabel="Saving…"
              busy={busy === "rsvp"}
              disabled={busy != null || (!!citizen.session && !data)}
              onClick={() => run("rsvp")}
              icon={<Check className="h-4 w-4" aria-hidden="true" />}
              className={btn("secondary", "sm")}
            />
          ))}
      </div>
      {host && !confirm && (
        <div className="flex flex-wrap items-center gap-2 pl-6">
          <span className={`text-sm ${muted}`}>Your group&rsquo;s clean-up:</span>
          {started && (
            <ActionButton label="Mark done" busyLabel="Saving…" busy={busy === "done"} disabled={busy != null} onClick={() => run("done")} className={btn("secondary", "sm")} />
          )}
          <button type="button" onClick={() => setConfirm(true)} disabled={busy != null} className={btn("dangerQuiet", "sm")}>
            Cancel it
          </button>
        </div>
      )}
      {host && confirm && (
        <div role="alertdialog" aria-label="Cancel this clean-up" className={`ml-6 rounded-xl border bg-slate-50 p-3 dark:bg-slate-900 ${rule} ${enter}`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Cancel this clean-up?</p>
          <p className="mt-0.5 text-sm text-slate-700 dark:text-slate-300">Everyone who said they would come is told.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <ActionButton label="Cancel clean-up" busyLabel="Cancelling…" busy={busy === "cancel"} onClick={() => run("cancel")} className={btn("danger", "sm")} />
            <button type="button" onClick={() => setConfirm(false)} disabled={busy != null} className={btn("quiet", "sm")}>
              Keep it
            </button>
          </div>
        </div>
      )}
      <div className="pl-6">
        <Safety />
      </div>
      <Problem text={error} />
    </div>
  );
}

/** "Plan a clean-up" for a host of a reviewed group: date and time in India time, where to meet, an optional note. */
function Plan({ report, citizen, hosts, onPlanned }: { report: PublicReport; citizen: Citizen; hosts: { id: string; name: string }[]; onPlanned: (f: PublicFixit) => void }) {
  const { refresh } = useMyGroups(citizen);
  const [open, setOpen] = useState(false);
  const [bounds] = useState(() => {
    const now = Date.now();
    // The first quarter hour past the 2-hour lead.
    const min = Math.ceil((now + GROUP_LIMITS.leadHours * 3_600_000) / 900_000) * 900_000;
    return { min: isoToIstInput(min), max: isoToIstInput(now + GROUP_LIMITS.aheadDays * 86_400_000) };
  });
  const [groupId, setGroupId] = useState(hosts[0].id);
  const [when, setWhen] = useState("");
  const [meet, setMeet] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    const startsAt = istInputToIso(when);
    if (!startsAt) return setError("Choose a date and time.");
    setBusy(true);
    setError(null);
    const r = await post(citizen, { action: "create", sightingId: report.id, groupId, startsAt, meetingPoint: meet, note: note.trim() || undefined });
    setBusy(false);
    if (!r.ok) return setError(r.error!);
    void refresh();
    onPlanned(r.data as unknown as PublicFixit);
  };

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={btn("secondary", "sm")}>
        <CalendarDays className="h-4 w-4" aria-hidden="true" />
        Plan a clean-up
      </button>
    );
  const ready = !!when && meet.trim().length >= GROUP_LIMITS.meetMin;
  return (
    <form
      className={`space-y-3 rounded-xl border p-4 ${rule} ${enter}`}
      onSubmit={(e) => {
        e.preventDefault();
        void save();
      }}
    >
      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Plan a clean-up here</p>
      <p className={`text-sm ${muted}`}>
        It shows on this report with your group&rsquo;s name. A clean-up adds hands to the department&rsquo;s work; the report stays open
        until it is fixed.
      </p>
      {hosts.length > 1 && (
        <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
          Group
          <select value={groupId} onChange={(e) => setGroupId(e.target.value)} className={`${field} mt-1.5`}>
            {hosts.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
        Date and time <span className={`font-normal ${muted}`}>India time</span>
        <input type="datetime-local" value={when} min={bounds.min} max={bounds.max} step={900} onChange={(e) => setWhen(e.target.value)} className={`${field} mt-1.5`} />
      </label>
      <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
        Where to meet
        <input
          value={meet}
          onChange={(e) => setMeet(e.target.value)}
          maxLength={GROUP_LIMITS.meetMax}
          placeholder="For example, the steps by the temple gate"
          className={`${field} mt-1.5`}
        />
      </label>
      <label className="block text-sm font-medium text-slate-900 dark:text-slate-100">
        Note <span className={`font-normal ${muted}`}>Optional</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={GROUP_LIMITS.noteMax} rows={2} placeholder="For example, what to bring" className={`${field} mt-1.5`} />
      </label>
      <Safety />
      <div className="flex flex-wrap gap-2">
        <ActionButton type="submit" label="Plan clean-up" busyLabel="Saving…" busy={busy} disabled={!ready} className={btn("primary", "md")} />
        <button type="button" onClick={() => setOpen(false)} disabled={busy} className={btn("quiet", "md")}>
          Cancel
        </button>
      </div>
      <Problem text={error} />
    </form>
  );
}

/**
 * A planned clean-up at this spot (with "I'll come"), or, for a host of a reviewed group on a safe report type
 * (litter, floating trash, plastic, ritual waste) that is still open, "Plan a clean-up". Renders nothing otherwise.
 */
export function FixitActions({ report, citizen }: { report: PublicReport; citizen: Citizen }) {
  const [fixit, setFixit] = useState(report.fixit);
  const [ended, setEnded] = useState<"cancelled" | "done" | null>(null);
  const eligible = fixitAllowed({ review_status: "approved", category: report.category, subcategory: report.subcategory, case_status: report.caseStatus });
  const { data } = useMyGroups(citizen, !!citizen.session && !fixit && eligible);

  if (ended)
    return (
      <p role="status" className="flex items-start gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400">
        <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        {ended === "done" ? "Marked as done. Thank you. If the spot is clear now, send an “It’s gone” photo." : "Clean-up cancelled. Those coming are told."}
      </p>
    );
  if (fixit) return <Planned fixit={fixit} citizen={citizen} onEnded={setEnded} />;
  if (!eligible || !data) return null;
  const hosts = data.groups.filter((g) => g.role === "host" && g.status === "approved");
  return hosts.length ? <Plan report={report} citizen={citizen} hosts={hosts} onPlanned={setFixit} /> : null;
}
