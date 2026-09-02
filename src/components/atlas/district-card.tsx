/**
 * The Atlas's place cards, shared by the landing board and the state page:
 * the district card (one per district, status-badged) and the state card
 * (the Districts view opens at states; districts appear inside a state).
 * One component per feature: the landing page and /atlas/[state] both
 * render exactly these.
 */
import Link from "next/link";
import { CityBadge, type CityStatus } from "@/components/landing/city-landmark";
import {
  districtHref,
  groupAtlasStates,
  listAtlasDistricts,
  listVisibleAtlasDistricts,
  stateHref,
  type AtlasDistrict,
  type AtlasStateEntry,
} from "@/lib/atlas/registry";

const STATUS_ORDER: Record<CityStatus, number> = { live: 0, preview: 1, onboarding: 2, upnext: 3 };

export type DistrictStatus = Extract<CityStatus, "live" | "preview" | "onboarding">;

export type BoardDistrict = { district: AtlasDistrict; status: DistrictStatus };

/**
 * The district board reads the Atlas registry the way the city board reads
 * src/lib/cities: a published district is live, a district exposed through
 * NEXT_PUBLIC_PREVIEW_DISTRICTS is a linkable preview, the rest are
 * onboarding cards without a link. One registry, no static fallback list.
 */
export function buildDistrictBoard(): BoardDistrict[] {
  const visible = new Set(listVisibleAtlasDistricts().map((d) => d.scopeId));
  return listAtlasDistricts()
    .map(
      (district): BoardDistrict => ({
        district,
        status: district.published
          ? "live"
          : visible.has(district.scopeId)
            ? "preview"
            : "onboarding",
      }),
    )
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

const DISTRICT_ACCENT = "from-teal-500 to-emerald-700";

/** Canals, tanks and a field bund: the rural twin of CityLandmark. */
function DistrictMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 200 80"
      preserveAspectRatio="xMidYMax meet"
      aria-hidden="true"
      className={className}
    >
      <g fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
        <path d="M0 58 C 30 46, 55 70, 85 58 S 135 46, 165 58 S 190 66, 200 60" />
        <path d="M0 68 C 40 58, 65 78, 105 68 S 165 58, 200 70" strokeOpacity={0.55} />
        <path d="M22 42 V 24 H 62 V 42" strokeOpacity={0.85} />
        <path d="M112 38 V 20 H 152 V 38" strokeOpacity={0.85} />
        <path d="M30 33 h24 M120 29 h24" strokeOpacity={0.35} />
        <path d="M0 78 H 200" strokeOpacity={0.25} />
      </g>
    </svg>
  );
}

export function DistrictCard({ district, status }: BoardDistrict) {
  const linkable = status !== "onboarding";
  const accent = linkable
    ? DISTRICT_ACCENT
    : "from-slate-400 to-slate-500 dark:from-slate-700 dark:to-slate-800";

  const banner = (
    <div className={`relative h-24 overflow-hidden bg-gradient-to-br ${accent}`}>
      <DistrictMark
        className={`absolute inset-0 h-full w-full ${linkable ? "text-white/85" : "text-white/60"}`}
      />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="absolute top-3 right-3">
        <CityBadge status={status} />
      </div>
    </div>
  );

  const body = (
    <div className="p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        {district.name}
      </h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        District
        <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
        {district.stateCode}
        {district.basin && (
          <>
            <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
            {district.basin.subBasinName}
          </>
        )}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
        {district.hook}
      </p>
      {linkable ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 dark:text-cyan-400">
          Open district
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      ) : (
        <span className="mt-4 inline-flex items-center text-sm font-medium text-slate-400 dark:text-slate-500">
          Onboarding
        </span>
      )}
    </div>
  );

  const baseClass =
    "block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900";

  if (linkable) {
    return (
      <Link
        href={districtHref(district)}
        className={`${baseClass} transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}
      >
        {banner}
        {body}
      </Link>
    );
  }

  return (
    <div className={baseClass}>
      {banner}
      {body}
    </div>
  );
}

/** A state entry plus its districts' board statuses, for the state card. */
export interface BoardState {
  state: AtlasStateEntry;
  board: BoardDistrict[];
}

/** Group the whole district board by state, first appearance first. A state
 *  whose districts are all onboarding still shows (as an unlinkable card),
 *  the same rule as an onboarding district. */
export function buildStateBoard(): BoardState[] {
  const board = buildDistrictBoard();
  const states = groupAtlasStates(board.map((b) => b.district));
  return states.map((state) => ({
    state,
    board: board.filter((b) => b.district.stateSlug === state.stateSlug),
  }));
}

export function StateCard({ state, board }: BoardState) {
  const live = board.filter((b) => b.status === "live").length;
  const preview = board.filter((b) => b.status === "preview").length;
  const linkable = live + preview > 0;
  const accent = linkable
    ? DISTRICT_ACCENT
    : "from-slate-400 to-slate-500 dark:from-slate-700 dark:to-slate-800";
  const counts = [
    live > 0 ? `${live} live` : null,
    preview > 0 ? `${preview} preview` : null,
    board.length - live - preview > 0 ? `${board.length - live - preview} onboarding` : null,
  ]
    .filter(Boolean)
    .join(" · ");

  const banner = (
    <div className={`relative h-24 overflow-hidden bg-gradient-to-br ${accent}`}>
      <DistrictMark className="absolute inset-0 h-full w-full text-white/85" />
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="absolute top-3 right-3 rounded-full bg-white/85 dark:bg-slate-900/85 px-2.5 py-0.5 text-xs font-semibold text-slate-700 dark:text-slate-200">
        {board.length} {board.length === 1 ? "district" : "districts"}
      </div>
    </div>
  );

  const body = (
    <div className="p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">{state.stateName}</h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        State
        <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
        {counts}
      </p>
      <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{state.hook}</p>
      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
        {board.map((b) => b.district.name).join(" · ")}
      </p>
      {linkable ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 dark:text-cyan-400">
          Open state
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      ) : (
        <span className="mt-4 inline-flex items-center text-sm font-medium text-slate-400 dark:text-slate-500">
          Onboarding
        </span>
      )}
    </div>
  );

  const baseClass =
    "block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900";

  if (linkable) {
    return (
      <Link
        href={stateHref(state.stateSlug)}
        className={`${baseClass} transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500`}
      >
        {banner}
        {body}
      </Link>
    );
  }
  return (
    <div className={baseClass}>
      {banner}
      {body}
    </div>
  );
}
