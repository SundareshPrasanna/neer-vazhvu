"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Check, Copy, FileText, RotateCw, Users } from "lucide-react";

import { GROUP_KINDS, GROUP_LIMITS, SAFETY_LINE, normalizeJoinCode, type GroupKind, type MyGroup, type MyGroups } from "@/lib/sightings/groups";
import { REVIEW_WITHIN_DAYS } from "@/lib/sightings/limits";
import { ActionButton, useFlash } from "./action-feedback";
import { GroupPack } from "./group-pack";
import { btn, enter, field, muted, rule, serif } from "./ui";
import type { useCitizen } from "./use-citizen";

type Citizen = Pick<ReturnType<typeof useCitizen>, "session" | "authFetch">;
type Fetch = Citizen["authFetch"];

/* One shared copy of "my groups" per page: the report form, every card's clean-up block and this panel read it. */

type Snap = { user: string | null; data: MyGroups | null; failed: boolean };
const NONE: Snap = { user: null, data: null, failed: false };
let snap: Snap = NONE;
let inflight: { user: string; p: Promise<void> } | null = null;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

function loadMine(user: string, authFetch: Fetch, force = false): Promise<void> {
  if (!force && snap.user === user && snap.data) return Promise.resolve();
  if (!force && inflight?.user === user) return inflight.p;
  const p: Promise<void> = authFetch("/api/sightings/groups?scope=mine")
    .then((r) => (r.ok ? r.json() : null))
    .catch(() => null)
    .then((j) => {
      if (inflight?.p !== p) return;
      inflight = null;
      snap = j?.data ? { user, data: j.data, failed: false } : { user, data: snap.user === user ? snap.data : null, failed: true };
      listeners.forEach((l) => l());
    });
  inflight = { user, p };
  return p;
}

/** The signed-in person's groups and clean-ups, loaded once per page; `enabled` false defers the request. */
export function useMyGroups(citizen: Citizen, enabled = true) {
  const user = citizen.session?.user.id ?? null;
  const { authFetch } = citizen;
  const s = useSyncExternalStore(subscribe, () => snap, () => NONE);
  useEffect(() => {
    if (user && enabled) void loadMine(user, authFetch);
  }, [user, enabled, authFetch]);
  const refresh = useCallback(() => (user ? loadMine(user, authFetch, true) : Promise.resolve()), [user, authFetch]);
  const own = user && s.user === user ? s : NONE;
  return { data: own.data, failed: own.failed, refresh };
}

/* An invite link (/for-citizens?join=CODE) survives the Google sign-in round trip in sessionStorage. */

const JOIN_KEY = "nv-join";

/** Whether the page was opened to join a group (now or before signing in). Reads only. */
export function pendingJoin(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return new URLSearchParams(window.location.search).has("join") || !!sessionStorage.getItem(JOIN_KEY);
  } catch {
    return new URLSearchParams(window.location.search).has("join");
  }
}

/** Keeps an invite link's code across sign-in. */
export function rememberJoin(): void {
  const code = new URLSearchParams(window.location.search).get("join");
  try {
    if (code) sessionStorage.setItem(JOIN_KEY, code.slice(0, 40));
  } catch {
    // Storage blocked: the code is typed in after sign-in instead.
  }
}

/** The invite code to act on, once: removed from the address bar and storage. */
function takeJoin(): string | null {
  const q = new URLSearchParams(window.location.search);
  let code = q.get("join");
  try {
    code ??= sessionStorage.getItem(JOIN_KEY);
    sessionStorage.removeItem(JOIN_KEY);
  } catch {
    // As above.
  }
  if (q.has("join")) {
    q.delete("join");
    const rest = q.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
  }
  return code;
}

const STATUS: Record<MyGroup["status"], { text: string; tone: string }> = {
  pending: { text: "Waiting for review", tone: "bg-amber-50 text-amber-900 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900" },
  approved: { text: "Active", tone: "bg-emerald-50 text-emerald-900 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-200 dark:ring-emerald-900" },
  rejected: { text: "Not approved", tone: "bg-slate-100 text-slate-700 ring-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:ring-slate-700" },
};

const chip =
  "h-10 rounded-full border border-slate-300 px-4 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 " +
  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 aria-pressed:border-cyan-700 aria-pressed:bg-cyan-700 aria-pressed:text-white " +
  "dark:border-slate-600 dark:text-slate-300";

const post = async (authFetch: Fetch, body: object): Promise<{ ok: boolean; data?: Record<string, unknown>; error?: string }> => {
  const res = await authFetch("/api/sightings/groups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
  const json = res ? await res.json().catch(() => ({})) : {};
  return res?.ok ? { ok: true, data: json.data } : { ok: false, error: json.error ?? (res ? "That did not work. Please try again." : "No connection. Please try again.") };
};

function Alert({ text }: { text: string | null }) {
  return text ? (
    <p role="alert" className="text-sm font-medium text-red-700 dark:text-red-400">
      {text}
    </p>
  ) : null;
}

function GroupItem({ group, authFetch, onChange }: { group: MyGroup; authFetch: Fetch; onChange: () => Promise<void> }) {
  const [busy, setBusy] = useState<"rotate" | "leave" | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, flash] = useFlash<boolean>();
  const [pack, setPack] = useState(false);
  const packButton = useRef<HTMLButtonElement>(null);
  const closePack = useCallback(() => {
    setPack(false);
    packButton.current?.focus();
  }, []);
  const link = group.joinPath ? `${typeof window === "undefined" ? "" : window.location.origin}${group.joinPath}` : null;
  const status = STATUS[group.status];

  const run = async (action: "rotate" | "leave") => {
    setBusy(action);
    setError(null);
    const r = await post(authFetch, { action, groupId: group.id });
    if (r.ok) await onChange();
    setBusy(null);
    if (!r.ok) setError(r.error!);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link!);
      flash(true);
    } catch {
      setError("Copying is blocked here. Select the link and copy it.");
    }
  };

  return (
    <li className="space-y-3 py-5">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
        <div className="min-w-0">
          <p className="font-semibold break-words text-slate-900 dark:text-slate-100">{group.name}</p>
          <p className={`mt-0.5 text-sm ${muted}`}>
            {[group.kindLabel, group.placeName].filter(Boolean).join(", ")}. {group.members} {group.members === 1 ? "member" : "members"}.{" "}
            {group.role === "host" ? "You host it." : "You are a member."}
          </p>
        </div>
        <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${status.tone}`}>{status.text}</span>
      </div>
      {group.status === "pending" && (
        <p className={`text-sm ${muted}`}>
          Members can join now. Once our reviewer checks it, usually within {REVIEW_WITHIN_DAYS} days, reports sent with it show its name
          {group.role === "host" ? " and you can plan clean-ups." : "."}
        </p>
      )}
      {group.status === "rejected" && <p className={`text-sm ${muted}`}>Reports cannot be sent with this group. You can still send them on your own.</p>}
      {group.status === "approved" && (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <button ref={packButton} type="button" onClick={() => setPack(true)} className={btn("secondary", "md")}>
            <FileText className="h-4 w-4" aria-hidden="true" />
            Evidence pack
          </button>
          <span className={`text-xs ${muted}`}>The group&rsquo;s reports and clean-ups, to print or download. Counts only, never names.</span>
        </div>
      )}
      {pack && <GroupPack group={group} authFetch={authFetch} onClose={closePack} />}
      {link && (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-slate-900 dark:text-slate-100" htmlFor={`invite-${group.id}`}>
            Invite link
          </label>
          <div className="flex flex-wrap gap-2">
            <input id={`invite-${group.id}`} readOnly value={link} onFocus={(e) => e.currentTarget.select()} className={`${field} min-w-0 flex-1 basis-60 font-mono`} />
            <button type="button" onClick={copy} className={btn("secondary", "lg")}>
              {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
              <span aria-live="polite">{copied ? "Copied" : "Copy"}</span>
            </button>
          </div>
          <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 text-xs ${muted}`}>
            <span>Anyone with this link can join. Hosts see how many members there are, never who.</span>
            <ActionButton
              label="Make a new link"
              busyLabel="Making…"
              busy={busy === "rotate"}
              disabled={busy != null}
              onClick={() => run("rotate")}
              icon={<RotateCw className="h-3.5 w-3.5" aria-hidden="true" />}
              className={`${btn("quiet", "sm")} -ml-2 h-8!`}
            />
          </div>
        </div>
      )}
      {leaving ? (
        <div role="alertdialog" aria-label={`Leave ${group.name}`} className={`rounded-xl border bg-slate-50 p-4 dark:bg-slate-900 ${rule} ${enter}`}>
          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Leave {group.name}?</p>
          <p className="mt-1 text-sm text-slate-700 dark:text-slate-300">
            Reports you already sent with it keep its name.{group.role === "host" ? " If no other host is left, the member who joined first becomes host." : ""}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <ActionButton label="Leave group" busyLabel="Leaving…" busy={busy === "leave"} onClick={() => run("leave")} className={btn("danger", "md")} />
            <button type="button" onClick={() => setLeaving(false)} disabled={busy != null} className={btn("quiet", "md")}>
              Stay
            </button>
          </div>
        </div>
      ) : (
        <button type="button" onClick={() => setLeaving(true)} className={`${btn("dangerQuiet", "sm")} -ml-3`}>
          Leave group
        </button>
      )}
      <Alert text={error} />
    </li>
  );
}

/** Groups: start one, join one with a code or invite link, see your own. Members stay anonymous; the group is a name. */
export function GroupsPanel({ citizen }: { citizen: Citizen }) {
  const { data, failed, refresh } = useMyGroups(citizen);
  const { authFetch } = citizen;
  const user = citizen.session?.user.id ?? null;
  const [code, setCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const [joined, setJoined] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<GroupKind | null>(null);
  const [placeId, setPlaceId] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [created, setCreated] = useState(false);

  const join = useCallback(
    async (raw: string) => {
      setJoining(true);
      setJoinError(null);
      setJoined(null);
      if (!normalizeJoinCode(raw)) {
        setJoining(false);
        return setJoinError("That code does not look right. It has 12 letters and numbers.");
      }
      const r = await post(authFetch, { action: "join", code: raw });
      if (r.ok) {
        await refresh();
        setCode("");
        setJoined(r.data?.already ? `You are already in ${r.data.name}.` : `You joined ${r.data?.name}.`);
      } else setJoinError(r.error!);
      setJoining(false);
    },
    [authFetch, refresh],
  );

  // Opened from an invite link: join once signed in.
  useEffect(() => {
    if (!user) return;
    const pending = takeJoin();
    if (pending) void Promise.resolve().then(() => join(pending));
  }, [user, join]);

  const create = async () => {
    setCreating(true);
    setCreateError(null);
    setCreated(false);
    const r = await post(authFetch, { action: "create", name, kind, placeId: placeId || null });
    if (r.ok) {
      await refresh();
      setName("");
      setKind(null);
      setPlaceId("");
      setCreated(true);
    } else setCreateError(r.error!);
    setCreating(false);
  };

  const nameOk = name.trim().length >= GROUP_LIMITS.nameMin;
  const groups = data?.groups ?? [];
  return (
    <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_19rem] lg:gap-16">
      <div className="min-w-0 space-y-12">
        <section aria-labelledby="my-groups" className="space-y-3">
          <h2 id="my-groups" className={`${serif} text-[1.75rem] leading-tight sm:text-3xl`}>
            Your groups
          </h2>
          <p className={`max-w-[60ch] ${muted}`}>
            Take part with your college, school, residents&rsquo; association, lake group or NGO. A report sent with a group shows the
            group&rsquo;s name, never yours or any member&rsquo;s. Once checked by our reviewer, a group can plan clean-ups at reported spots.
          </p>
          {joined && (
            <p role="status" className={`flex items-center gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 ${enter}`}>
              <Check className="h-4 w-4" aria-hidden="true" />
              {joined}
            </p>
          )}
          {!data && !failed && <div className="h-20 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />}
          {!data && failed && (
            <div className="flex flex-wrap items-center gap-3">
              <p className={muted}>Could not load your groups.</p>
              <button type="button" onClick={() => void refresh()} className={btn("secondary", "sm")}>
                Try again
              </button>
            </div>
          )}
          {data && groups.length === 0 && <p className={`text-sm ${muted}`}>You are not in a group yet. Join one with the code a host shared, or start one below.</p>}
          {groups.length > 0 && (
            <ul className={`divide-y border-y ${rule}`}>
              {groups.map((g) => (
                <GroupItem key={g.id} group={g} authFetch={authFetch} onChange={refresh} />
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="join-group" className="space-y-3">
          <h2 id="join-group" className={`${serif} text-2xl leading-tight`}>
            Join a group
          </h2>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void join(code);
            }}
          >
            <label className="sr-only" htmlFor="join-code">
              Group code
            </label>
            <input
              id="join-code"
              value={code}
              onChange={(e) => setCode(e.target.value.slice(0, 40))}
              placeholder="ABCD-EFGH-JKLM"
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              className={`${field} min-w-0 flex-1 basis-48 font-mono uppercase sm:max-w-xs`}
            />
            <ActionButton type="submit" label="Join" busyLabel="Joining…" busy={joining} disabled={!code.trim()} icon={<Users className="h-4 w-4" aria-hidden="true" />} className={btn("primary")} />
          </form>
          <p className={`text-sm ${muted}`}>Ask the group&rsquo;s host for its code or invite link.</p>
          <Alert text={joinError} />
        </section>

        <section aria-labelledby="start-group" className="space-y-5">
          <h2 id="start-group" className={`${serif} text-2xl leading-tight`}>
            Start a group
          </h2>
          <label className="block">
            <span className="font-medium text-slate-900 dark:text-slate-100">Name</span>
            <span className={`block text-sm ${muted}`}>As people know it, for example &ldquo;Anna University NSS unit&rdquo;.</span>
            <input value={name} onChange={(e) => setName(e.target.value)} maxLength={GROUP_LIMITS.nameMax} className={`${field} mt-2`} />
          </label>
          <fieldset>
            <legend className="font-medium text-slate-900 dark:text-slate-100">What kind of group</legend>
            <div className="mt-3 flex flex-wrap gap-2">
              {GROUP_KINDS.map((k) => (
                <button key={k.key} type="button" aria-pressed={kind === k.key} onClick={() => setKind(k.key)} className={chip}>
                  {k.label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="block">
            <span className="font-medium text-slate-900 dark:text-slate-100">City or district</span>
            <span className={`block text-sm ${muted}`}>Optional. Shown beside the group&rsquo;s name.</span>
            <select value={placeId} onChange={(e) => setPlaceId(e.target.value)} className={`${field} mt-2`}>
              <option value="">Not tied to one place</option>
              {data?.places.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <ActionButton label="Start the group" busyLabel="Starting…" busy={creating} disabled={!nameOk || !kind} onClick={create} className={`${btn("primary")} w-full sm:w-auto`} />
          {created && (
            <p role="status" className={`flex items-start gap-1.5 text-sm font-medium text-emerald-700 dark:text-emerald-400 ${enter}`}>
              <Check className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              Started. Share its invite link above. Our reviewer checks new groups, usually within {REVIEW_WITHIN_DAYS} days.
            </p>
          )}
          <Alert text={createError} />
        </section>
      </div>

      <aside className="space-y-4 lg:pt-1">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">How Neer Mitra groups work</h2>
        <ul className={`space-y-3 text-sm leading-relaxed ${muted}`}>
          <li>When you send a report, choose to send it with your group. The report shows the group&rsquo;s name, never yours.</li>
          <li>Members are never listed. A host sees how many members a group has, not who they are.</li>
          <li>Once a group is checked, its hosts can plan a clean-up at a reported spot with litter, floating trash, plastic or ritual waste.</li>
          <li>
            Never sewage, drains, debris, burning, hazardous or medical waste, or dead animals: those need the department&rsquo;s trained staff
            and equipment. {SAFETY_LINE}
          </li>
        </ul>
      </aside>
    </div>
  );
}
