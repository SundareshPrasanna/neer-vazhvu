import Link from "next/link";
import type {
  AutoCascadeScored,
  CascadeHealth,
  CascadePriority,
  DocumentedCascadeScored,
} from "@/lib/cascade-health";
import { PRIORITY_STYLES } from "@/lib/cascade-health";

interface CascadeHealthPanelProps {
  data: CascadeHealth;
  cityDisplayName: string;
}

export function CascadeHealthPanel({
  data,
  cityDisplayName,
}: CascadeHealthPanelProps) {
  const { summary, documented_cascades: documented, auto_cascades: auto } =
    data;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex items-start justify-between gap-3 mb-2">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Tank cascades at risk - {cityDisplayName}
        </h1>
        <Link
          href={`/${data.district_id}/water-bodies`}
          className="shrink-0 inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
        >
          <span aria-hidden>←</span> View on map
        </Link>
      </div>
      <p className="text-base text-slate-600 dark:text-slate-400 mb-2 max-w-3xl">
        Every historic tank in {cityDisplayName} sat on a cascade - water
        from one tank overflowed through a surplus channel to feed the
        next, and so on. Most cascades are now broken by encroachment or
        unmapped infrastructure. This panel scores each documented
        cascade against the terrain-derived graph + current
        OpenStreetMap, and ranks all auto-derived cascade components by
        fragility.
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 mb-8 max-w-3xl italic">
        Health 0-100 (higher = less fragile). Priority: CRITICAL &lt; 25,
        HIGH &lt; 45, MEDIUM &lt; 70, LOW &ge; 70. The map view of these
        cascades lives at{" "}
        <Link
          href={`/${data.district_id}/water-bodies`}
          className="underline hover:text-slate-700 dark:hover:text-slate-300"
        >
          /{data.district_id}/water-bodies
        </Link>
        {" "}with the Cascade toggle on. Methodology + scoring weights:{" "}
        <Link
          href={`/${data.district_id}/about#cascade-methodology`}
          className="underline hover:text-slate-700 dark:hover:text-slate-300"
        >
          see about page
        </Link>
        .
      </p>

      <SummaryRow summary={summary} />

      {documented.length > 0 ? (
        <section className="mt-10">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Documented cascades ({documented.length})
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Hand-curated cascade chains with academic, government, court,
            or NGO citations. Scored against current OSM + algorithm
            output.
          </p>
          <div className="space-y-4">
            {documented.map((cascade) => (
              <DocumentedCascadeCard
                key={cascade.cascade_id}
                cascade={cascade}
              />
            ))}
          </div>
        </section>
      ) : null}

      {auto.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-1">
            Auto-derived cascades ({auto.length})
          </h2>
          <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
            Every weakly-connected component of size &ge;{" "}
            {summary.min_component_size} in the terrain-derived graph.
            Scored on algorithmic signals (edge confidence, isolation
            ratio, size, lost-tank name overlap). Cascades that overlap a
            documented chain are tagged.
          </p>
          <div className="space-y-3">
            {auto.map((cascade) => (
              <AutoCascadeCard key={cascade.cascade_id} cascade={cascade} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function SummaryRow({ summary }: { summary: CascadeHealth["summary"] }) {
  const totalDocumented = summary.documented_count;
  const totalAuto = summary.auto_count;
  const totalCritical =
    summary.documented_by_priority.CRITICAL +
    summary.auto_by_priority.CRITICAL;
  const totalHigh =
    summary.documented_by_priority.HIGH + summary.auto_by_priority.HIGH;
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-2">
      <SummaryTile label="Documented cascades" value={totalDocumented} />
      <SummaryTile label="Auto-derived cascades" value={totalAuto} />
      <SummaryTile
        label="CRITICAL priority"
        value={totalCritical}
        tone="critical"
      />
      <SummaryTile label="HIGH priority" value={totalHigh} tone="high" />
    </div>
  );
}

function SummaryTile({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "critical" | "high";
}) {
  const valueColor =
    tone === "critical"
      ? "text-red-600 dark:text-red-400"
      : tone === "high"
        ? "text-orange-600 dark:text-orange-400"
        : "text-slate-900 dark:text-slate-100";
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-3">
      <div className={`text-2xl font-bold ${valueColor}`}>{value}</div>
      <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
        {label}
      </div>
    </div>
  );
}

function PriorityBadge({ priority }: { priority: CascadePriority }) {
  const style = PRIORITY_STYLES[priority];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${style.badge}`}
    >
      {priority}
    </span>
  );
}

function HealthBar({
  health,
  priority,
}: {
  health: number;
  priority: CascadePriority;
}) {
  const style = PRIORITY_STYLES[priority];
  const pct = Math.max(0, Math.min(100, health));
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden">
        <div
          className={`h-full ${style.bar} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 tabular-nums w-10 text-right">
        {Math.round(health)}
      </span>
    </div>
  );
}

function DocumentedCascadeCard({
  cascade,
}: {
  cascade: DocumentedCascadeScored;
}) {
  const style = PRIORITY_STYLES[cascade.priority];
  return (
    <article
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-5 ring-1 ${style.ring}`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            {cascade.name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="capitalize">{cascade.transfer_type}</span>
            {cascade.historical_era ? (
              <>
                <span aria-hidden>·</span>
                <span>{cascade.historical_era}</span>
              </>
            ) : null}
            {cascade.is_engineered_control ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-amber-700 dark:text-amber-400 font-medium">
                  engineered control
                </span>
              </>
            ) : null}
          </div>
        </div>
        <PriorityBadge priority={cascade.priority} />
      </header>

      <HealthBar health={cascade.health_score} priority={cascade.priority} />

      <p className="text-sm text-slate-700 dark:text-slate-300 mt-4">
        {cascade.narrative}
      </p>

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Component
          label="Tank presence (OSM)"
          value={`${cascade.components.tank_presence.resolved_in_osm} / ${cascade.components.tank_presence.total}`}
          sub={`${Math.round(cascade.components.tank_presence.ratio * 100)}%`}
        />
        <Component
          label="Edges reproduced"
          value={`${cascade.components.edge_reproduction.reproduced} / ${cascade.components.edge_reproduction.total_documented}`}
          sub={`${Math.round(cascade.components.edge_reproduction.ratio * 100)}%`}
        />
        <Component
          label="Avg edge confidence"
          value={cascade.components.avg_edge_confidence.toFixed(2)}
          sub="0=low, 1=high"
        />
        <Component
          label="Lost-tank hits"
          value={cascade.components.lost_tank_intersections.length.toString()}
          sub={
            cascade.components.lost_tank_intersections.length > 0
              ? cascade.components.lost_tank_intersections.join(", ")
              : "none in known list"
          }
        />
      </div>

      <div className="mt-4 text-xs">
        <details className="group">
          <summary className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 select-none">
            Tanks in order ({cascade.tanks_in_order.length})
          </summary>
          <ol className="mt-2 space-y-1 list-decimal list-inside text-slate-700 dark:text-slate-300">
            {cascade.tanks_in_order.map((tank, i) => (
              <li key={`${cascade.cascade_id}-${i}`}>
                <span className="font-medium">{tank.name}</span>
                {tank.category ? (
                  <span className="text-slate-500 dark:text-slate-400 ml-1">
                    ({tank.category})
                  </span>
                ) : null}
                {tank.is_terminal ? (
                  <span className="ml-2 text-amber-600 dark:text-amber-400">
                    terminal
                  </span>
                ) : null}
                {tank.osm_id ? (
                  <span className="ml-2 text-emerald-600 dark:text-emerald-400">
                    OSM {tank.osm_id}
                  </span>
                ) : (
                  <span className="ml-2 text-red-500 dark:text-red-400">
                    not in OSM extract
                  </span>
                )}
                {tank.notes ? (
                  <div className="text-xs text-slate-500 dark:text-slate-400 ml-5 italic">
                    {tank.notes}
                  </div>
                ) : null}
              </li>
            ))}
          </ol>
        </details>
      </div>

      <footer className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 text-xs space-y-1">
        <div className="text-slate-500 dark:text-slate-400">
          Source:{" "}
          <a
            href={cascade.source.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {cascade.source.citation}
          </a>
        </div>
        {cascade.court_anchor ? (
          <div className="text-slate-500 dark:text-slate-400">
            Court:{" "}
            <a
              href={cascade.court_anchor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {cascade.court_anchor.case} ({cascade.court_anchor.year},{" "}
              {cascade.court_anchor.court})
            </a>
          </div>
        ) : null}
        {cascade.restoration_anchor ? (
          <div className="text-slate-500 dark:text-slate-400">
            Restoration:{" "}
            <a
              href={cascade.restoration_anchor.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {cascade.restoration_anchor.program}
            </a>
          </div>
        ) : null}
      </footer>
    </article>
  );
}

function Component({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div>
      <div className="text-slate-500 dark:text-slate-400">{label}</div>
      <div className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">
        {value}
      </div>
      {sub ? (
        <div className="text-slate-400 dark:text-slate-500 mt-0.5">{sub}</div>
      ) : null}
    </div>
  );
}

function AutoCascadeCard({ cascade }: { cascade: AutoCascadeScored }) {
  const style = PRIORITY_STYLES[cascade.priority];
  const name =
    cascade.representative_tank_name ?? `Cascade of ${cascade.size} tanks`;
  return (
    <article
      className={`rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/30 p-5 ring-1 ${style.ring}`}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100 truncate">
            {name}
          </h3>
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span>Auto-derived</span>
            <span aria-hidden>·</span>
            <span>{cascade.size} tanks</span>
            <span aria-hidden>·</span>
            <span>{cascade.edge_count} edges</span>
            <span aria-hidden>·</span>
            <span>{cascade.total_area_ha.toLocaleString()} ha</span>
            {cascade.documented_overlap ? (
              <>
                <span aria-hidden>·</span>
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  ↔ {cascade.documented_overlap.documented_name}
                </span>
              </>
            ) : null}
          </div>
        </div>
        <PriorityBadge priority={cascade.priority} />
      </header>

      <HealthBar health={cascade.health_score} priority={cascade.priority} />

      <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
        <Component
          label="Tanks in component"
          value={cascade.size.toString()}
          sub={`${cascade.total_area_ha.toLocaleString()} ha total`}
        />
        <Component
          label="Edges in component"
          value={cascade.edge_count.toString()}
          sub={`${cascade.isolated_count} isolated tanks`}
        />
        <Component
          label="Avg edge confidence"
          value={cascade.avg_edge_confidence.toFixed(2)}
          sub="0=low, 1=high"
        />
        <Component
          label="Lost-tank hits"
          value={cascade.lost_tank_intersections.length.toString()}
          sub={
            cascade.lost_tank_intersections.length > 0
              ? cascade.lost_tank_intersections.join(", ")
              : "none in known list"
          }
        />
      </div>

      {cascade.tanks_in_order.length > 0 ? (
        <div className="mt-4 text-xs">
          <details className="group">
            <summary className="cursor-pointer text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 select-none">
              Tanks in order ({cascade.tanks_in_order.length})
            </summary>
            <ol className="mt-2 space-y-1 list-decimal list-inside text-slate-700 dark:text-slate-300">
              {cascade.tanks_in_order.map((tank, i) => (
                <li key={`${cascade.cascade_id}-${i}`}>
                  <span className="font-medium">
                    {tank.name || `(unnamed OSM ${tank.osm_id})`}
                  </span>
                  {tank.area_ha != null ? (
                    <span className="text-slate-500 dark:text-slate-400 ml-1">
                      ({tank.area_ha.toLocaleString()} ha)
                    </span>
                  ) : null}
                  {tank.is_headwater_in_component ? (
                    <span className="ml-2 text-sky-600 dark:text-sky-400">
                      headwater
                    </span>
                  ) : null}
                  {tank.is_terminal_in_component &&
                  !tank.is_headwater_in_component ? (
                    <span className="ml-2 text-amber-600 dark:text-amber-400">
                      terminal
                    </span>
                  ) : null}
                  {tank.isolation_reason ? (
                    <span className="ml-2 text-purple-600 dark:text-purple-400">
                      isolated · {tank.isolation_reason.replace(/_/g, " ")}
                    </span>
                  ) : null}
                  <span className="ml-2 text-slate-400 dark:text-slate-500">
                    OSM {tank.osm_id}
                  </span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      ) : null}
    </article>
  );
}
