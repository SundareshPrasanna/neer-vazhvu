import type { Metadata } from "next";
import Link from "next/link";
import { listAllPlaces } from "@/lib/cities";
import { CityLandmark, CITY_ACCENT, DEFAULT_ACCENT } from "@/components/landing/city-landmark";

export const metadata: Metadata = {
  title: "Neer Vazhvu | Urban Water Intelligence",
  description:
    "Open-source urban water intelligence across Indian cities. Reservoirs, groundwater, rivers, floods, and water bodies made legible city by city - Chennai, Madurai, and Bengaluru live, more onboarding.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Neer Vazhvu | Urban Water Intelligence",
    description:
      "Open-source urban water intelligence across Indian cities - Chennai, Madurai, and Bengaluru live, more onboarding.",
    type: "website",
    locale: "en_IN",
    siteName: "Neer Vazhvu",
    url: "https://neervazhvu.org",
  },
  twitter: {
    card: "summary_large_image",
    title: "Neer Vazhvu | Urban Water Intelligence",
    description:
      "Open-source urban water intelligence across Indian cities - Chennai, Madurai, and Bengaluru live, more onboarding.",
  },
};

const GITHUB_URL = "https://github.com/SundareshPrasanna/neer-vazhvu";
const CONTACT_EMAIL = "contact@neervazhvu.org";
const CONTACT_MAILTO = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("Neer Vazhvu")}`;

// One-line hook per city. Keyed by cityId. Cities without a hook still
// render from the registry with their authority + state, just no tagline.
const CITY_HOOKS: Record<string, string> = {
  chennai:
    "Reservoir days-left, groundwater by ward, river health, flood risk, lost water bodies, and a satellite shoreline-change map. The origin city.",
  madurai:
    "Vaigai-basin reservoir runway, groundwater, water bodies, and flood context for the temple city.",
  bangalore:
    "Cauvery pumped 100 km uphill, ward groundwater stress, the tanker market, and lake restoration.",
  mumbai:
    "Seven BMC lakes, the Mithi river, and the parallel water systems behind the city's taps. Onboarding.",
  delhi:
    "The Yamuna, the Delhi Jal Board supply network, and one of India's sharpest water-access gaps.",
  kolkata:
    "The Hooghly, groundwater arsenic, and a delta city's drainage and flooding.",
};

type CityStatus = "live" | "onboarding" | "upnext";

type BoardCity = {
  cityId: string;
  displayName: string;
  authorityAcronym: string;
  stateCode: string;
  hook: string;
  status: CityStatus;
};

const STATUS_ORDER: Record<CityStatus, number> = { live: 0, onboarding: 1, upnext: 2 };

/**
 * Build the city status board from the registry. A registered place with
 * `enabled !== false` is LIVE (its /<cityId> route resolves in prod); a
 * registered place with `enabled === false` is ONBOARDING (route 404s, so
 * its card is not a link).
 *
 * Mumbai is publicly known to be onboarding but is not yet in the registry,
 * so it is appended as a static onboarding entry. Once it lands in the
 * registry (enabled: false), the dedupe below drops the static fallback and
 * the registry becomes the single source of truth.
 */
function buildCityBoard(): BoardCity[] {
  const fromRegistry: BoardCity[] = listAllPlaces().map((config): BoardCity => ({
    cityId: config.cityId,
    displayName: config.displayName,
    authorityAcronym: config.primaryAuthority.acronym,
    stateCode: config.stateCode,
    hook: CITY_HOOKS[config.cityId] ?? "",
    status: config.enabled !== false ? "live" : "onboarding",
  }));

  const registeredIds = new Set(fromRegistry.map((c) => c.cityId));

  // Cities not yet in the registry. Kept minimal and honest: shown with
  // their published authority + state and no link (their routes 404 in
  // prod). "onboarding" = actively being wired up; "upnext" = next in line.
  const staticCities: BoardCity[] = [
    { cityId: "mumbai", displayName: "Mumbai", authorityAcronym: "BMC", stateCode: "MH", hook: CITY_HOOKS.mumbai, status: "onboarding" },
    { cityId: "delhi", displayName: "Delhi", authorityAcronym: "DJB", stateCode: "DL", hook: CITY_HOOKS.delhi, status: "upnext" },
    { cityId: "kolkata", displayName: "Kolkata", authorityAcronym: "KMC", stateCode: "WB", hook: CITY_HOOKS.kolkata, status: "upnext" },
  ];
  const STATIC = staticCities.filter((c) => !registeredIds.has(c.cityId));

  const all = [...fromRegistry, ...STATIC];
  // Live first, then onboarding, then up next; stable within each group.
  return all.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
}

const CAPABILITIES: { label: string; detail: string }[] = [
  {
    label: "Reservoir levels & days-left",
    detail: "Live storage against demand, and how much runway is left.",
  },
  {
    label: "Groundwater by ward",
    detail: "Depth, stress, and extraction stitched to local geography.",
  },
  {
    label: "River & canal water quality",
    detail: "Pollution loads and health along the streams that drain the city.",
  },
  {
    label: "Flood risk & drainage",
    detail: "Hazard zones, historical events, and where the water goes.",
  },
  {
    label: "Water bodies & restoration",
    detail: "Lakes and tanks, what was lost, and what is being revived.",
  },
  {
    label: "Coastal shoreline change",
    detail: "Satellite-derived erosion and accretion along the coast.",
  },
  {
    label: "AI daily briefings",
    detail: "Plain-language summaries in English and regional languages.",
  },
];

const STATUS_BADGE: Record<CityStatus, { label: string; classes: string; dot: string }> = {
  live: {
    label: "Live",
    classes:
      "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 ring-emerald-600/20 dark:ring-emerald-500/30",
    dot: "bg-emerald-500",
  },
  onboarding: {
    label: "Onboarding",
    classes:
      "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-400 ring-amber-600/20 dark:ring-amber-500/30",
    dot: "bg-amber-500",
  },
  upnext: {
    label: "Up next",
    classes:
      "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 ring-slate-500/20 dark:ring-slate-400/30",
    dot: "bg-slate-400",
  },
};

function CityBadge({ status }: { status: CityStatus }) {
  const b = STATUS_BADGE[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset ${b.classes}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
      {b.label}
    </span>
  );
}

function CityCard({ city }: { city: BoardCity }) {
  const isLive = city.status === "live";
  // Live cities get their vibrant accent; cities that are not yet open get a
  // muted slate banner so colour alone signals live-vs-coming at a glance.
  const accent = isLive
    ? CITY_ACCENT[city.cityId] ?? DEFAULT_ACCENT
    : "from-slate-400 to-slate-500 dark:from-slate-700 dark:to-slate-800";

  // Landmark banner. A licensed photograph can later replace the gradient +
  // CityLandmark here without touching the rest of the card.
  const banner = (
    <div className={`relative h-24 overflow-hidden bg-gradient-to-br ${accent}`}>
      <CityLandmark
        cityId={city.cityId}
        className={`absolute inset-0 h-full w-full ${isLive ? "text-white/85" : "text-white/60"}`}
      />
      {/* gentle dark gradient at the base for separation from the body */}
      <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-black/15 to-transparent" />
      <div className="absolute top-3 right-3">
        <CityBadge status={city.status} />
      </div>
      {!isLive && (
        <span className="absolute bottom-2 left-3 text-xs font-semibold uppercase tracking-wide text-white/90">
          {city.status === "onboarding" ? "Onboarding" : "Up next"}
        </span>
      )}
    </div>
  );

  const body = (
    <div className="p-5 sm:p-6">
      <h3 className="text-lg font-bold text-slate-900 dark:text-slate-100">
        {city.displayName}
      </h3>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">
        {city.authorityAcronym}
        <span className="mx-1 text-slate-300 dark:text-slate-600">|</span>
        {city.stateCode}
      </p>
      {city.hook && (
        <p className="mt-3 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
          {city.hook}
        </p>
      )}
      {city.status === "live" ? (
        <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-cyan-700 dark:text-cyan-400">
          Open dashboard
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </span>
      ) : (
        <span className="mt-4 inline-flex items-center text-sm font-medium text-slate-400 dark:text-slate-500">
          {city.status === "onboarding" ? "Onboarding" : "Up next"}
        </span>
      )}
    </div>
  );

  const baseClass =
    "block overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900";

  if (city.status === "live") {
    return (
      <Link
        href={`/${city.cityId}`}
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

export default function Page() {
  const cities = buildCityBoard();

  return (
    <div className="bg-slate-50 dark:bg-slate-950">
      {/* HERO */}
      <section className="relative overflow-hidden border-b border-slate-200 dark:border-slate-800">
        <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-950 dark:to-slate-900" />
        <div className="relative mx-auto max-w-5xl px-4 sm:px-6 lg:px-8 py-16 sm:py-24 text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-white/80 dark:bg-slate-800/80 px-3 py-1 text-xs font-semibold text-cyan-700 dark:text-cyan-300 ring-1 ring-inset ring-cyan-600/20">
            Open source
            <span className="mx-1.5 font-normal text-cyan-600/40 dark:text-cyan-400/40">|</span>
            Built in the open
          </span>
          <h1 className="mt-6 text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 dark:text-slate-50">
            Neer Vazhvu
          </h1>
          <p className="mt-3 bg-gradient-to-r from-cyan-600 to-blue-600 dark:from-cyan-400 dark:to-blue-400 bg-clip-text text-lg sm:text-xl font-semibold text-transparent">
            Urban Water Intelligence
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-base sm:text-lg leading-relaxed text-slate-600 dark:text-slate-300">
            An open-source platform that makes India&apos;s urban water systems
            legible - reservoirs, groundwater, rivers, floods, and water bodies
            - city by city.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <a
              href="#cities"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              Explore the cities
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M12 .5C5.37.5 0 5.87 0 12.5c0 5.3 3.44 9.8 8.21 11.39.6.11.82-.26.82-.58 0-.29-.01-1.04-.02-2.04-3.34.73-4.04-1.61-4.04-1.61-.55-1.39-1.34-1.76-1.34-1.76-1.09-.74.08-.73.08-.73 1.2.08 1.84 1.24 1.84 1.24 1.07 1.83 2.81 1.3 3.5.99.11-.78.42-1.31.76-1.61-2.67-.3-5.47-1.34-5.47-5.95 0-1.31.47-2.39 1.24-3.23-.13-.3-.54-1.52.11-3.18 0 0 1.01-.32 3.3 1.23a11.5 11.5 0 016.01 0c2.29-1.55 3.3-1.23 3.3-1.23.65 1.66.24 2.88.12 3.18.77.84 1.23 1.92 1.23 3.23 0 4.62-2.81 5.64-5.49 5.94.43.37.81 1.1.81 2.22 0 1.6-.01 2.9-.01 3.29 0 .32.21.7.82.58A12.01 12.01 0 0024 12.5C24 5.87 18.63.5 12 .5z" />
              </svg>
              View source on GitHub
            </a>
          </div>
        </div>
      </section>

      {/* CITY STATUS BOARD */}
      <section
        id="cities"
        className="scroll-mt-20 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900"
      >
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              Cities
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              Each city is its own dashboard, built on whatever public data can
              carry an honest picture.
            </p>
          </div>

          <h3 className="mt-10 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Live now
          </h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cities
              .filter((c) => c.status === "live")
              .map((city) => (
                <CityCard key={city.cityId} city={city} />
              ))}
          </div>

          <h3 className="mt-12 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            <span className="h-2 w-2 rounded-full bg-slate-400" />
            Coming soon
          </h3>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {cities
              .filter((c) => c.status !== "live")
              .map((city) => (
                <CityCard key={city.cityId} city={city} />
              ))}
          </div>
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            Want your city, or a dataset, on this map sooner? Email{" "}
            <a
              href={CONTACT_MAILTO}
              className="font-medium text-cyan-700 dark:text-cyan-400 underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            .
          </p>
        </div>
      </section>

      {/* ORIGIN STORY */}
      <section className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-cyan-700 dark:text-cyan-400">
          Why it exists
        </h2>
        <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
          <p>
            Neer Vazhvu was born from Chennai&apos;s water crisis. In 2019, the
            city reached &quot;Day Zero&quot; - its major reservoirs ran dry and
            taps across the metro fell silent. The question that followed was
            simple: why did almost no one see it coming, and where was the data
            that could have?
          </p>
          <p>
            The data existed. It was just scattered - across research papers,
            government portals, citizen surveys, and satellite archives - with no
            one holding a single, joined-up view. India does not lack water data.
            It lacks an eagle-eye view of it, and the ability to drill from a
            whole city down to one neighbourhood, road, or locality.
          </p>
          <p>
            That is the idea behind Neer Vazhvu: use AI to bring those scattered
            sources together into one coherent picture, then use that picture to
            surface what matters - the gaps, the contradictions, and the changes
            worth acting on. Collating the data is only the start; the goal is the
            gap analysis that turns it into something genuinely useful.
          </p>
          <p>
            The stance is deliberate. Neer Vazhvu is infrastructure that enables
            accountability, not a publisher of verdicts. It surfaces public data
            honestly, dates every number, names the gaps it cannot fill, and keeps
            its code open. No scorecards, no grades, no hype - just the water
            systems made legible so anyone can ask better questions.
          </p>
        </div>
      </section>

      {/* WHAT WE TRACK */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="max-w-2xl">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
              What we track
            </h2>
            <p className="mt-3 text-base text-slate-600 dark:text-slate-300">
              The capabilities below are the building blocks. Which ones a city
              has depends on its data - we turn a layer on only when the public
              record can support it.
            </p>
          </div>
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {CAPABILITIES.map((cap) => (
              <div
                key={cap.label}
                className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-5"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {cap.label}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
                  {cap.detail}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* DATA STEWARDSHIP */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            A home for peer-reviewed data
          </h2>
          <div className="mt-4 space-y-4 text-base leading-relaxed text-slate-700 dark:text-slate-300">
            <p>
              Neer Vazhvu is built alongside the people who produce the data -
              researchers, surveyors, civic groups, and institutions. Much of
              what you see here exists because data collaborators chose to share
              peer-reviewed work that would otherwise sit in a PDF or a one-off
              report.
            </p>
            <p>
              The aim is a safe space for water data: shared carefully,
              attributed clearly, dated, and stewarded for the long term. Sharing
              a dataset here adds to a public commons without losing the credit
              or the context, so the next person can build on it instead of
              starting over.
            </p>
          </div>
        </div>
      </section>

      {/* CLOSING */}
      <section className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 py-14 sm:py-16 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-slate-100">
            Open source, open to collaboration
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-600 dark:text-slate-300">
            The code is open on{" "}
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-cyan-700 dark:text-cyan-400 underline-offset-2 hover:underline"
            >
              GitHub
            </a>
            , and the data is curated city by city. Partners, journalists, and
            officials who want to extend a city or contribute data are welcome
            to reach out at{" "}
            <a
              href={CONTACT_MAILTO}
              className="font-semibold text-cyan-700 dark:text-cyan-400 underline-offset-2 hover:underline"
            >
              {CONTACT_EMAIL}
            </a>
            . For a sense of the methodology depth, read the{" "}
            <Link
              href="/chennai/about"
              className="font-semibold text-cyan-700 dark:text-cyan-400 underline-offset-2 hover:underline"
            >
              Chennai methodology
            </Link>
            .
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/chennai"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-shadow hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              Open the Chennai dashboard
            </Link>
            <Link
              href="/chennai/about"
              className="inline-flex w-full sm:w-auto items-center justify-center rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-6 py-3 text-sm font-semibold text-slate-700 dark:text-slate-200 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500"
            >
              Read the methodology
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
