"use client";

import { useState } from "react";
import { ArrowLeft, Check, ChevronDown, ChevronRight } from "lucide-react";

import { LIMITS } from "@/lib/sightings/limits";
import {
  EXTENTS,
  GOOD_NEWS_KEY,
  HOME_SMELLS,
  OTHER_KEY,
  REPORT_GROUPS,
  SEEN_AT,
  WATER_SOURCES,
  getGroup,
  getType,
  homeSmellType,
  isCommunityReport,
  typesFor,
  type ReportGroup,
  type ReportType,
  type WaterSource,
} from "@/lib/sightings/taxonomy";
import type { Calibrated, Filtered, Instrument } from "@/lib/sightings/test-meta";
import type { Extent, NearbyWater, SeenAt } from "@/lib/sightings/types";
import { Choice } from "./choice";
import { btn, enter, field, muted, rule } from "./ui";
import { WaterTest } from "./water-test";

/** Everything the person has said about the report; kept whole in the draft and the outbox. */
export interface Form {
  seenAt: SeenAt | null;
  /** Public places: the chosen type's group and key ("other" has no type). */
  group: string | null;
  type: string | null;
  /** At home: the answer to "What's wrong?", and the follow-up under "Smells or tastes bad". */
  homeIssue: HomeIssue | null;
  smell: string | null;
  note: string;
  /** At home: which water; null with sourceAsked = "Not sure". */
  source: string | null;
  sourceAsked: boolean;
  extent: Extent | null;
  /** Water-test results by parameter key, as typed; TDS is offered first. */
  values: Record<string, string>;
  instrument: Instrument | null;
  filtered: Filtered | null;
  calibrated: Calibrated | null;
  flushed: "yes" | "no" | null;
  depth: string;
  model: string;
}

export const EMPTY_FORM: Form = {
  seenAt: null,
  group: null,
  type: null,
  homeIssue: null,
  smell: null,
  note: "",
  source: null,
  sourceAsked: false,
  extent: null,
  values: { tds: "" },
  instrument: null,
  filtered: null,
  calibrated: null,
  flushed: null,
  depth: "",
  model: "",
};

export type Patch = (p: Partial<Form>) => void;
/** The What step's screens: where are you, which water (home only), what is wrong. */
export type Screen = "place" | "water" | "what";

type HomeIssue = "dirty" | "smell" | "ill" | "test";
const HOME_ISSUES: { key: HomeIssue; label: string }[] = [
  { key: "dirty", label: "Looks dirty or coloured" },
  { key: "smell", label: "Smells or tastes bad" },
  { key: "ill", label: "People fell ill after drinking it" },
  { key: "test", label: "Add a water test" },
];

const WATER_TEST = "water_test";
const fromWell = (source: string | null) => source === "borewell" || source === "open_well";

/** At home, the type follows the answer and the water: a well's colour or salt is the ground's, a public tap's is the supply's. */
function homeType(f: Form): string | null {
  switch (f.homeIssue) {
    case "dirty":
      return fromWell(f.source) ? "borewell_quality" : f.source === "handpump" ? "public_source_unsafe" : "dirty_tap_water";
    case "smell":
      return f.smell ? homeSmellType(f.smell, f.source as WaterSource | null) : null;
    case "ill":
      return "illness_suspected";
    case "test":
      return WATER_TEST;
    default:
      return null;
  }
}

/** The category and type the report is sent as. Every home report is tap and drinking water, which shows only the ward. */
export function chosen(f: Form): { group: string | null; type: string | null } {
  if (f.seenAt === "home") return { group: f.homeIssue ? "drinking" : null, type: homeType(f) };
  return { group: f.group, type: f.group === OTHER_KEY ? null : f.type };
}

/** Why the What step cannot move on; null = ready. */
export function whatBlocker(f: Form): string | null {
  if (!f.seenAt) return "Choose where you are.";
  if (f.seenAt === "home") {
    if (!f.sourceAsked) return "Choose which water.";
    if (!f.homeIssue) return "Choose what is wrong.";
    if (f.homeIssue === "smell" && !f.smell) return "Choose how it smells or tastes.";
    if (f.homeIssue === "test") {
      if (!Object.values(f.values).some((v) => v.trim() !== "")) return "Enter at least one result.";
      if (!f.source) return "Choose where the water is from.";
      if (!f.instrument) return "Choose what you tested with.";
      if (!f.filtered) return "Say whether the water was filtered.";
    }
    return null;
  }
  if (!f.group) return "Choose what you see.";
  if (f.group === OTHER_KEY && !f.note.trim()) return "Describe what you saw.";
  return null;
}

/** What the report says, in the words the person chose; null until they have. */
export function whatLabel(f: Form): string | null {
  if (f.seenAt === "home") {
    const issue = HOME_ISSUES.find((h) => h.key === f.homeIssue);
    if (!issue) return null;
    if (issue.key === "test") return "Water test results";
    const smell = issue.key === "smell" ? HOME_SMELLS.find((x) => x.key === f.smell)?.label : null;
    return smell ? `${issue.label}: ${smell.toLowerCase()}` : issue.label;
  }
  if (f.group === OTHER_KEY) return f.note.trim() || null;
  return (f.group && f.type && getType(f.group, f.type)?.label) || null;
}

/** The place the person chose, as words for the summary. */
export function seenAtLabel(seenAt: SeenAt | null): string | null {
  if (!seenAt) return null;
  return seenAt === "other" ? "Somewhere else" : (SEEN_AT.find((s) => s.key === seenAt)?.label ?? null);
}

const PLACES: readonly { key: SeenAt; label: string; hint: string }[] = [
  ...SEEN_AT.filter((s) => s.key !== "home"),
  { key: "other", label: "Somewhere else", hint: "Anything else about water at a place" },
];
const HOME = SEEN_AT.find((s) => s.key === "home") ?? { key: "home" as const, label: "At home", hint: "Only the ward is shown, never your house." };

const KIND_WORDS: Record<NearbyWater["kind"], string> = { lake: "a lake", river: "a river", canal: "a canal", stream: "a stream", drain: "a drain" };
const KIND_SEEN: Record<NearbyWater["kind"], SeenAt> = { lake: "lake", river: "river", canal: "river", stream: "river", drain: "drain" };
const featureName = (w: NearbyWater) => w.name ?? KIND_WORDS[w.kind];
const capital = (s: string) => s[0].toUpperCase() + s.slice(1);
/** Two features this close (difference in metres) are both offered. */
const CLOSE_M = 40;

export function whatHeading(screen: Screen, f: Form): { title: string; subtitle: string | null } {
  if (screen === "place") return { title: "Where are you?", subtitle: null };
  if (screen === "water") return { title: "Which water?", subtitle: "Where the water in your home comes from." };
  if (f.seenAt === "home") return { title: "What's wrong?", subtitle: "Pick what you notice." };
  return { title: "What do you see?", subtitle: "Pick the closest. If nothing fits, choose Something else." };
}

const row =
  "flex w-full items-center gap-3 px-1 py-3.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cyan-500 dark:hover:bg-slate-900";
const radio = "h-[1.125rem] w-[1.125rem] shrink-0 accent-cyan-700";

/** A tappable row that moves on: label, a quiet hint, a chevron (a tick on the one chosen before). */
function Row({ label, hint, onClick, current }: { label: string; hint?: string; onClick: () => void; current?: boolean }) {
  return (
    <li>
      <button type="button" onClick={onClick} aria-current={current || undefined} className={row}>
        <span className="min-w-0 flex-1">
          <span className="block font-semibold text-slate-900 dark:text-slate-100">{label}</span>
          {hint && <span className={`mt-0.5 block text-sm ${muted}`}>{hint}</span>}
        </span>
        {current ? (
          <Check className="h-4 w-4 shrink-0 text-cyan-700 dark:text-cyan-400" aria-hidden="true" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
        )}
      </button>
    </li>
  );
}

function Radio({ name, checked, onChange, children }: { name: string; checked: boolean; onChange: () => void; children: React.ReactNode }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-3 px-1 py-3.5 transition-colors hover:bg-slate-50 dark:hover:bg-slate-900">
        <input type="radio" name={name} checked={checked} onChange={onChange} className={radio} />
        <span className="text-slate-900 dark:text-slate-100">{children}</span>
      </label>
    </li>
  );
}

type Option = { group: ReportGroup; type: ReportType };

/**
 * A place's types from the taxonomy, common first; "Somewhere else" has no list of its own and gets every public type.
 * Good news is offered at every public place. Never a home's types.
 */
function optionsFor(seenAt: SeenAt): { problems: Option[]; good: Option[] } {
  const own = typesFor(seenAt).filter((o) => isCommunityReport(o.group.key) && o.group.key !== GOOD_NEWS_KEY);
  const problems = own.length
    ? own
    : REPORT_GROUPS.filter((g) => isCommunityReport(g.key) && g.key !== GOOD_NEWS_KEY).flatMap((group) => group.types.map((type) => ({ group, type })));
  const news = getGroup(GOOD_NEWS_KEY);
  return { problems, good: news ? news.types.map((type) => ({ group: news, type })) : [] };
}

/** "What do you see?" at a public place: common types, then More, then good news, then Something else. */
function PublicTypes({ form, patch }: { form: Form; patch: Patch }) {
  const { problems, good } = optionsFor(form.seenAt!);
  const common = problems.filter((o) => o.type.common);
  const rest = common.length ? problems.filter((o) => !o.type.common) : problems;
  const picked = (o: Option) => form.group === o.group.key && form.type === o.type.key;
  const [more, setMore] = useState(() => common.length > 0 && rest.some(picked));
  const choose = (o: Option) => patch({ group: o.group.key, type: o.type.key, ...(o.group.key === GOOD_NEWS_KEY && { extent: null }) });
  const list = (items: Option[]) => (
    <ul className={`divide-y border-y ${rule}`}>
      {items.map((o) => (
        <Radio key={o.type.key} name="report-type" checked={picked(o)} onChange={() => choose(o)}>
          {o.type.label}
        </Radio>
      ))}
    </ul>
  );
  // With no common types to lead (a place the taxonomy does not mark), the whole list reads in its groups.
  const byGroup = (items: Option[]) =>
    [...new Set(items.map((o) => o.group))].map((g) => (
      <div key={g.key} className="space-y-1">
        <p className={`pt-2 text-sm font-medium ${muted}`}>{g.label}</p>
        {list(items.filter((o) => o.group === g))}
      </div>
    ));
  const isOther = form.group === OTHER_KEY;
  return (
    <div className="space-y-6">
      <fieldset className="space-y-4">
        <legend className="sr-only">What you see</legend>
        {common.length > 0 && list(common)}
        {common.length > 0 && rest.length > 0 && (
          <button type="button" aria-expanded={more} onClick={() => setMore(!more)} className={btn("quiet", "sm")}>
            More
            <ChevronDown className={`h-4 w-4 transition-transform duration-200 ${more ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        )}
        {more && rest.length > 0 && <div className={enter}>{list(rest)}</div>}
        {!common.length && byGroup(rest)}
        {good.length > 0 && (
          <div className="space-y-1">
            <p className={`pt-2 text-sm font-medium ${muted}`}>Good news</p>
            {list(good)}
          </div>
        )}
        <ul className={`border-y ${rule}`}>
          <Radio name="report-type" checked={isOther} onChange={() => patch({ group: OTHER_KEY, type: null })}>
            Something else
          </Radio>
        </ul>
      </fieldset>
      {isOther && (
        <label className={`block ${enter}`}>
          <span className="font-medium text-slate-900 dark:text-slate-100">What did you see?</span>
          <textarea
            value={form.note}
            onChange={(e) => patch({ note: e.target.value.slice(0, LIMITS.noteChars) })}
            rows={3}
            placeholder="One line is enough"
            className={`${field} mt-2`}
          />
        </label>
      )}
      {form.group && form.group !== GOOD_NEWS_KEY && (
        <div className={enter}>
          <Choice legend="How much?" tag="Optional" options={EXTENTS} value={form.extent} onChange={(extent) => patch({ extent })} optional />
        </div>
      )}
    </div>
  );
}

/** "What's wrong?" at home: four answers; a smell asks which, a test opens today's water-test fields. */
function HomeTypes({ form, patch }: { form: Form; patch: Patch }) {
  return (
    <div className="space-y-7">
      <fieldset>
        <legend className="sr-only">What is wrong</legend>
        <ul className={`divide-y border-y ${rule}`}>
          {HOME_ISSUES.map((h) => (
            <Radio key={h.key} name="home-issue" checked={form.homeIssue === h.key} onChange={() => patch({ homeIssue: h.key })}>
              {h.label}
            </Radio>
          ))}
        </ul>
      </fieldset>
      {form.homeIssue === "smell" && (
        <div className={enter}>
          <Choice legend="How does it smell or taste?" options={HOME_SMELLS} value={form.smell} onChange={(smell) => patch({ smell })} />
        </div>
      )}
      {form.homeIssue === "test" && <WaterTest form={form} patch={patch} />}
    </div>
  );
}

/**
 * The What step as a drill-down of at most three screens: where are you, which water (home only), what is wrong or
 * what do you see. A known nearby lake, river or drain opens it with a yes-or-no question instead of the list.
 */
export function WhatStep({
  form,
  patch,
  screen,
  onScreen,
  nearby,
  askAll,
  onAskAll,
}: {
  form: Form;
  patch: Patch;
  screen: Screen;
  onScreen: (s: Screen) => void;
  nearby: NearbyWater[] | null;
  askAll: boolean;
  onAskAll: () => void;
}) {
  const place = (seenAt: SeenAt) => {
    if (seenAt !== form.seenAt) patch({ seenAt, group: null, type: null, homeIssue: null, smell: null, extent: null });
    onScreen(seenAt === "home" ? (form.seenAt === "home" && form.sourceAsked ? "what" : "water") : "what");
  };

  if (screen === "place") {
    const near = nearby?.[0];
    const second = near && nearby[1] && nearby[1].distanceM - near.distanceM <= CLOSE_M ? nearby[1] : null;
    if (near && !askAll) {
      const names = [near, second].filter((w): w is NearbyWater => !!w);
      return (
        <div className={`space-y-4 rounded-xl border p-4 sm:p-5 ${rule} ${enter}`}>
          <p className="text-lg font-semibold leading-snug text-slate-900 dark:text-slate-100">
            {second ? `Looks like you're at ${featureName(near)} or ${featureName(second)}. Which one?` : `Looks like you're at ${featureName(near)}. Right?`}
          </p>
          <div className="flex flex-wrap gap-2">
            {names.map((w, i) => (
              <button key={i} type="button" onClick={() => place(KIND_SEEN[w.kind])} className={btn("primary", "md")}>
                {second ? capital(featureName(w)) : "Yes"}
              </button>
            ))}
            <button type="button" onClick={onAskAll} className={btn("secondary", "md")}>
              Somewhere else
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="space-y-6">
        <ul className={`divide-y border-y ${rule}`}>
          <Row label={HOME.label} hint={HOME.hint} onClick={() => place("home")} current={form.seenAt === "home"} />
        </ul>
        <div>
          <p className={`text-sm font-medium ${muted}`}>Or a public place</p>
          <ul className={`mt-1 divide-y border-y ${rule}`}>
            {PLACES.map((p) => (
              <Row key={p.key} label={p.label} hint={p.hint} onClick={() => place(p.key)} current={form.seenAt === p.key} />
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // At home, the what screen names the water too, and Change goes back one screen.
  const homeWhat = screen === "what" && form.seenAt === "home";
  const back = (
    <div className="flex items-center justify-between gap-3">
      <p className="min-w-0 font-semibold text-slate-900 dark:text-slate-100">
        {homeWhat ? [seenAtLabel("home"), WATER_SOURCES.find((w) => w.key === form.source)?.label.toLowerCase()].filter(Boolean).join(", ") : seenAtLabel(form.seenAt)}
      </p>
      <button type="button" className={btn("quiet", "sm")} onClick={() => onScreen(homeWhat ? "water" : "place")}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Change
      </button>
    </div>
  );

  if (screen === "water") {
    const options = [...WATER_SOURCES, { key: "unsure", label: "Not sure" }];
    return (
      <div className="space-y-5">
        {back}
        <ul className={`divide-y border-y ${rule}`}>
          {options.map((w) => (
            <Row
              key={w.key}
              label={w.label}
              current={form.sourceAsked && (form.source ?? "unsure") === w.key}
              onClick={() => {
                patch({ source: w.key === "unsure" ? null : w.key, sourceAsked: true });
                onScreen("what");
              }}
            />
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${enter}`}>
      {back}
      {form.seenAt === "home" ? <HomeTypes form={form} patch={patch} /> : <PublicTypes form={form} patch={patch} />}
    </div>
  );
}
