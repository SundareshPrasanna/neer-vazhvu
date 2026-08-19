"use client";

import type { WaterwayReach } from "@/lib/waterways/types";
import { FactLine } from "./claim-chip";

/**
 * The works lens (DECISIONS W11): what any DPR must establish on this
 * reach. Quantities on record, documented inflows, constraints, the
 * survey tasks that close the unknowns, and the programmes already
 * touching the reach. No costs, no rankings, no "should" - the question
 * paper, not the answers. One click deep, like everything dense.
 */
function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h4>
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function WorksLens({ reach }: { reach: WaterwayReach }) {
  const w = reach.works;
  if (!w) return null;
  return (
    <details className="group mt-6 rounded-xl border border-border bg-card">
      <summary className="cursor-pointer select-none px-4 py-3 text-sm font-medium text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="mr-2 inline-block transition-transform group-open:rotate-90">
          &#9656;
        </span>
        The works lens: what a DPR must establish here
      </summary>
      <div className="space-y-4 px-4 pb-4">
        {w.channel.length > 0 && (
          <Group title="Channel: on record">
            <ul className="space-y-2">
              {w.channel.map((f) => <FactLine key={f.claim_id} fact={f} />)}
            </ul>
          </Group>
        )}
        {reach.veg_ha != null && reach.veg_ha > 0.5 && (
          <Group title="Vegetation clearance envelope">
            <p className="text-sm text-foreground/90">
              {reach.veg_ha.toFixed(1)} ha of corridor vegetation in the
              current satellite window (weed mats, reeds and bank growth
              together; ground-truth apportions them).
            </p>
          </Group>
        )}
        {w.interception.length > 0 && (
          <Group title="Interception: documented inflows">
            <ul className="space-y-2">
              {w.interception.map((f) => <FactLine key={f.claim_id} fact={f} />)}
            </ul>
          </Group>
        )}
        {reach.built_edge && (
          <Group title="Interface">
            <p className="text-sm text-foreground/90">
              {reach.built_edge.buildings_50m.toLocaleString("en-IN")} buildings
              within 50 m of the centerline
              ({reach.built_edge.buildings_100m.toLocaleString("en-IN")} within
              100 m); rooftop area {(reach.built_edge.rooftop_m2_50m / 10000).toFixed(1)} ha
              in the 50 m band.
            </p>
          </Group>
        )}
        {w.constraints.length > 0 && (
          <Group title="Constraints to design around">
            <ul className="space-y-2">
              {w.constraints.map((f) => <FactLine key={f.claim_id} fact={f} />)}
            </ul>
          </Group>
        )}
        {w.surveys.length > 0 && (
          <Group title="To establish by survey">
            <ul className="space-y-1">
              {w.surveys.map((t) => (
                <li key={t} className="flex gap-2 text-sm text-foreground/90">
                  <span aria-hidden className="text-primary">&#9633;</span>
                  {t}
                </li>
              ))}
            </ul>
          </Group>
        )}
        {w.programmes.length > 0 && (
          <Group title="Programmes touching this reach">
            <div className="flex flex-wrap gap-1.5">
              {w.programmes.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground"
                >
                  {t}
                </span>
              ))}
            </div>
          </Group>
        )}
      </div>
    </details>
  );
}
