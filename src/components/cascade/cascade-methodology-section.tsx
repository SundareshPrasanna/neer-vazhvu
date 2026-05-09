"use client";

import type { ReactNode } from "react";

/**
 * Detailed methodology explainer for the cascade reconstruction overlay.
 *
 * Designed to be embedded inside an existing collapsible <Section> on
 * the about page (one for the multi-city /[cityId]/about and one for
 * the legacy Chennai /about). Same content for both - the algorithm is
 * district-agnostic by design.
 *
 * The wrapper here is plain content; whichever about page renders it
 * supplies its own <Section> shell with the anchor id="cascade-methodology"
 * so the on-map "Full methodology -->" link can deep-link directly.
 */
export function CascadeMethodologySection({
  cityDisplayName,
  nodeCount,
  edgeCount,
  riverOutletCount,
  maxCascadeDepth,
  topConvergenceExample,
}: {
  cityDisplayName: string;
  nodeCount: number;
  edgeCount: number;
  riverOutletCount: number;
  maxCascadeDepth: number;
  topConvergenceExample?: { name: string; degreeIn: number };
}): ReactNode {
  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
      <p>
        {cityDisplayName}&apos;s tanks were once organised into chained{" "}
        <em>cascades</em> (system kanmoi): water from upper tanks
        overflowed through feeder channels into lower tanks, which fed
        the next, and so on. Most cascade channels are now broken by
        encroachment. The cascade overlay surfaces a{" "}
        <strong>terrain-derived hypothesis</strong> of how the cascade
        structure should have been organised, given the actual elevation
        and flow direction of the land.
      </p>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          What you are seeing
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Sky-blue circles</strong> ({nodeCount.toLocaleString()}{" "}
            tanks): one per OpenStreetMap water-body polygon at least
            1&nbsp;ha in size. Size encodes cascade depth (deeper-in-the-chain
            tanks render larger).
          </li>
          <li>
            <strong>Sky-blue lines</strong> ({edgeCount.toLocaleString()}{" "}
            edges): predicted tank-to-tank cascade links. Each upstream tank
            has at most one outflow.
          </li>
          <li>
            <strong>Amber lines</strong> ({riverOutletCount.toLocaleString()}{" "}
            outflows): tanks whose flow direction points to a river within
            ~2&nbsp;km, modelling the river itself as the terminal sink.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Inputs
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Tank polygons:</strong> OpenStreetMap{" "}
            <code className="text-xs">water=*</code> features.
            <code className="text-xs">water_type</code>{" "}
            in <code className="text-xs">{`{river, canal, stream, drain, ditch, wastewater}`}</code>{" "}
            is excluded so river segments don&apos;t get treated as tanks.
          </li>
          <li>
            <strong>Elevation:</strong>{" "}
            <code className="text-xs">WWF/HydroSHEDS/03CONDEM</code> -
            HydroSHEDS conditioned DEM at 3 arc-second (~90&nbsp;m)
            resolution. &quot;Conditioned&quot; means sinks have been pre-filled
            so flow routing behaves predictably.
          </li>
          <li>
            <strong>Flow direction:</strong>{" "}
            <code className="text-xs">WWF/HydroSHEDS/03DIR</code> - the
            corresponding ESRI D8 flow-direction raster. Each pixel encodes
            which of its eight neighbours water drains to.
          </li>
          <li>
            <strong>River barriers:</strong> the{" "}
            <code className="text-xs">{`{city}-rivers.geojson`}</code> we
            already use on the map.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Algorithm (per tank)
        </h4>
        <ol className="list-decimal list-outside pl-5 space-y-1">
          <li>
            Compute centroid; sample DEM elevation and D8 flow direction at
            that point in a single batched Earth Engine call.
          </li>
          <li>
            Find all other tanks within 3&nbsp;km whose elevation is lower.
          </li>
          <li>
            Reject candidates that fall outside &plusmn;67.5&deg; of the
            upstream tank&apos;s flow-direction bearing - terrain-aware
            directionality, not just &quot;is downhill&quot;.
          </li>
          <li>
            Reject candidates whose straight-line edge would cross a mapped
            river segment - water doesn&apos;t flow across rivers.
          </li>
          <li>
            Pick the single steepest remaining candidate (elevation drop /
            distance) as this tank&apos;s outflow.
          </li>
          <li>
            For tanks with no tank-to-tank outflow but a flow direction
            pointing to a river within 2&nbsp;km: mark{" "}
            <code className="text-xs">drains_to_river</code> and draw an
            amber arrow to the nearest in-cone river point.
          </li>
        </ol>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          What this is NOT
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Not a registry of historical channels.</strong> We
            don&apos;t claim that any specific cascade link historically
            existed; we claim the terrain would have organised water this
            way.
          </li>
          <li>
            <strong>Not full hydrological flow accumulation.</strong> A
            stricter approach would trace flow paths pixel-by-pixel through
            the DEM. We use a &quot;downhill within a flow-direction cone&quot;
            heuristic that&apos;s correct for most obvious cases but can miss
            subtle terrain features that aren&apos;t river-mapped.
          </li>
          <li>
            <strong>Not a real-time water transport model.</strong> Edge
            existence does not imply current water flow.
          </li>
          <li>
            <strong>Not a model of engineered conveyance.</strong> Modern
            reservoirs receive much of their water through canals,
            pipelines and trans-basin diversions - Chembarambakkam Lake,
            for example, is fed by Krishna water from Andhra Pradesh
            (Kandaleru-Poondi canal system) and Cauvery water from
            Veeranam, neither of which appears in this graph because
            neither follows local terrain. A reservoir showing 0
            terrain-driven inflows is NOT necessarily isolated in
            real-world supply terms; it may simply rely on
            human-engineered transfers that this model is silent on.
            Engineered conveyance is a separate data layer (today: not
            yet built; eventually: a parallel &quot;canal transfers&quot; layer
            on the same map).
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Known limitations
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>DEM resolution ~90&nbsp;m.</strong> Adequate for
            district-scale cascade structure; may miss very small channels.
            In flat terrain (e.g. coastal Chennai) elevation differences
            often round to the same integer metre, so the flow-direction
            cone does most of the work.
          </li>
          <li>
            <strong>Single outflow per tank.</strong> Real tanks often have
            one feeder channel and one separate surplus channel; we model
            only the most likely single outflow.
          </li>
          <li>
            <strong>River-coverage gaps.</strong> The river-crossing barrier
            is only as complete as the OSM river polylines. Where the
            polyline is sparse, edges may slip through.
          </li>
          <li>
            <strong>Edges are labelled <code className="text-xs">predicted</code></strong> only.
            A future iteration will cross-check predicted edges against OSM{" "}
            <code className="text-xs">waterway=*</code> tags and
            Sentinel-1/2 monsoon imagery, then label each edge as{" "}
            <code className="text-xs">intact / partial / broken / encroached</code>.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          What you can use it for today
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Spot likely historical hubs:</strong> tanks with high
            in-degree are where multiple terrain-driven flow paths converge.
            {topConvergenceExample
              ? ` For ${cityDisplayName}: ${topConvergenceExample.name} has ${topConvergenceExample.degreeIn} predicted upstream feeders.`
              : ""}{" "}
            Maximum cascade depth in {cityDisplayName} is {maxCascadeDepth}.
          </li>
          <li>
            <strong>Surface river-front tanks:</strong> anything with an
            amber outflow is a tank that drains directly into a river -
            useful for restoration prioritisation since the ecological
            functions differ from internal-cascade tanks.
          </li>
          <li>
            <strong>Identify isolated tanks:</strong> tanks with neither
            inflow, outflow, nor river sink may be genuinely orphaned in the
            terrain (rim of a small basin) or signal a data-coverage gap.
          </li>
        </ul>
      </div>
    </div>
  );
}
