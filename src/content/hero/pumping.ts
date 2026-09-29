import type { CityId } from "@/lib/cities/ids";

type CalloutId = "stage_v" | "energy" | "gw" | "stress" | "demand" | "project";

/** A pumped-city hero's narrative. Each value is an i18n key (translated at
 *  render time) or a literal string; {placeholders} are filled from the city's
 *  supply-overview data. A field left out renders nothing, never another
 *  city's story. */
export interface PumpingHeroCopy {
  headline?: string;
  body?: string;
  wtp_label?: string;
  wtp_sub?: string;
  uphill_label?: string;
  uphill_sub?: string;
  nrw_sub?: string;
  pop_label?: string;
  pop_sub?: string;
  footer?: string;
  callouts?: Partial<Record<CalloutId, { title: string; body: string }>>;
}

/** Narrative kept in code because it is translated: Bengaluru's (en/kn), the
 *  story the pump.* strings were written for. Cities whose narrative is
 *  English-only carry it in their supply-overview JSON as `hero_copy`, which
 *  overrides any field here. */
export const PUMPING_HERO_COPY: Partial<Record<CityId, PumpingHeroCopy>> = {
  bangalore: {
    headline: "pump.headline",
    body: "pump.body",
    wtp_label: "pump.stat.wtp_label",
    wtp_sub: "pump.stat.wtp_sub",
    uphill_label: "pump.stat.uphill_label",
    uphill_sub: "pump.stat.uphill_sub",
    nrw_sub: "pump.stat.nrw_sub",
    pop_sub: "pump.stat.pop_sub",
    footer: "pump.footer",
    callouts: {
      stage_v: { title: "pump.callout.stage_v_title", body: "pump.callout.stage_v_body" },
      energy: { title: "pump.callout.energy_title", body: "pump.callout.energy_body" },
      gw: { title: "pump.callout.gw_title", body: "pump.callout.gw_body" },
      stress: { title: "pump.callout.stress_title", body: "pump.callout.stress_body" },
      demand: { title: "pump.callout.demand_title", body: "pump.callout.demand_body" },
      project: { title: "pump.callout.project_title", body: "pump.callout.project_body" },
    },
  },
};
