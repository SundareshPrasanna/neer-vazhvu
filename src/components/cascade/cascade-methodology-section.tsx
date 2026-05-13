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
  edgeConfidenceCounts,
}: {
  cityDisplayName: string;
  nodeCount: number;
  edgeCount: number;
  riverOutletCount: number;
  maxCascadeDepth: number;
  topConvergenceExample?: { name: string; degreeIn: number };
  edgeConfidenceCounts?: {
    high: number;
    medium: number;
    low: number;
    unspecified: number;
  };
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
            <strong>Not a model of any inflow that isn&apos;t
            tank-to-tank.</strong> Reservoirs receive water from at least
            four sources that this graph cannot represent: (a) direct
            rainfall on the lake surface, (b) catchment runoff via
            unmapped channels and overland flow, (c) the river the
            reservoir dams (rivers are deliberately excluded from
            cascade nodes), and (d) engineered canals, pipelines, and
            trans-basin diversions. A reservoir showing 0 cascade
            inflows here is <strong>not</strong> isolated in real life -
            Chembarambakkam Lake, for example, is fed by all four kinds
            of inflow (its 71.6 km<sup>2</sup> Adyar catchment, the
            upper Adyar itself, plus Krishna water via the Kandaleru-Poondi
            canal and Cauvery water from Veeranam) yet none of those
            appears in this layer. The cascade graph is solely about
            tank-to-tank structure derived from terrain.
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
            <strong>Single outflow per tank (default).</strong> Real
            tanks often have one feeder channel and one separate surplus
            channel; the V1 algorithm models only the steepest candidate
            edge per upstream. A per-district{" "}
            <code className="text-xs">allow_multi_outflow</code> opt-in
            relaxes this and keeps near-tied candidates (within 30&#37;
            of the best score by default), modelling tanks with both
            feeder and surplus. Off by default for {cityDisplayName};
            we plan to enable it for plateau-geography districts where
            terrain gradients are weaker and multi-branch cascades are
            documented in the historical record.
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
          <li>
            <strong>OSM <code className="text-xs">water_type=reservoir</code> is ambiguous</strong> in this
            region. In Madurai roughly 87&#37; of cascade nodes carry that
            tag, including many traditional kanmoi tanks that historically
            fed downstream cascades. The algorithm therefore does NOT
            auto-classify reservoirs as terminal sinks. A per-district
            curation hook (<code className="text-xs">terminal_sink_osm_ids</code>)
            exists for marking specific known engineered reservoirs (large
            dams whose outflow is via spillway / canal rather than via
            gravity to another tank); it is currently empty pending
            validation against TN PWD / DHAN inventories.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Edge confidence
        </h4>
        <p>
          Each predicted edge carries a{" "}
          <code className="text-xs">confidence</code> field bucketed by
          its <code className="text-xs">score_m_per_km</code> (elevation
          drop normalised by edge length). Thresholds:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>HIGH</strong> (&ge;&nbsp;5&nbsp;m/km): a clear
            downhill gradient unambiguous even given HydroSHEDS
            90&nbsp;m elevation noise.
          </li>
          <li>
            <strong>MEDIUM</strong> (1-5&nbsp;m/km): plausible cascade
            link with moderate confidence. Most kanmoi-cascade edges
            fall here.
          </li>
          <li>
            <strong>LOW</strong> (&lt;&nbsp;1&nbsp;m/km): below
            0.2&nbsp;m drop per 200&nbsp;m. Near the noise floor of
            the conditioned DEM; the edge may be terrain noise as much
            as real flow.
          </li>
        </ul>
        {edgeConfidenceCounts && edgeCount > 0 ? (
          <p className="mt-2">
            For {cityDisplayName}:{" "}
            <strong>
              {edgeConfidenceCounts.high.toLocaleString()} high
            </strong>
            {" "}(
            {Math.round((edgeConfidenceCounts.high / edgeCount) * 100)}%),{" "}
            <strong>
              {edgeConfidenceCounts.medium.toLocaleString()} medium
            </strong>
            {" "}(
            {Math.round((edgeConfidenceCounts.medium / edgeCount) * 100)}%),{" "}
            <strong>
              {edgeConfidenceCounts.low.toLocaleString()} low
            </strong>
            {" "}(
            {Math.round((edgeConfidenceCounts.low / edgeCount) * 100)}%).
          </p>
        ) : null}
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Isolated tanks: why each one is isolated
        </h4>
        <p>
          A tank is &quot;isolated&quot; in this graph when it has no
          tank-to-tank inflow, no tank-to-tank outflow, and no river
          sink. The pipeline re-walks the candidate-evaluation gates for
          each such tank and stamps it with one of these reasons, surfaced
          in the on-map hover tooltip:
        </p>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <code className="text-xs">elevation_sampling_failed</code> -
            the HydroSHEDS DEM returned no value at the tank&apos;s
            centroid, so the algorithm has nothing to compare against.
            Usually data-coverage at the DEM&apos;s 90&nbsp;m resolution
            boundaries.
          </li>
          <li>
            <code className="text-xs">no_neighbors_in_range</code> - no
            other tanks within the 3&nbsp;km radius the cascade window
            uses. Real geographic effect, common on the rural fringe of
            the district.
          </li>
          <li>
            <code className="text-xs">all_neighbors_uphill</code> -
            in-range tanks exist but every one of them is at a higher
            elevation. The tank sits at a local basin low; water has
            nowhere downhill to go through the tank network in this
            window.
          </li>
          <li>
            <code className="text-xs">all_neighbors_out_of_cone</code> -
            downhill tanks exist in range, but all sit outside the
            &plusmn;67.5&deg; cone aligned with the upstream tank&apos;s
            D8 flow direction. The terrain wants water to go somewhere
            other than where the nearest downhill tank is.
          </li>
          <li>
            <code className="text-xs">all_neighbors_river_blocked</code> -
            downhill, in-cone, in-range tanks exist, but every edge to
            them would cross a mapped river LineString. May indicate
            either real river-cut isolation or a gap where the OSM river
            polylines are over-segmented relative to ground truth.
          </li>
          <li>
            <code className="text-xs">unknown_isolation</code> -
            defensive fallback. Should be empty in practice.
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
            inflow, outflow, nor river sink carry an{" "}
            <code className="text-xs">isolation_reason</code> field
            distinguishing genuine basin orphans from data-coverage gaps.
            See the bucket-by-bucket breakdown above.
          </li>
        </ul>
      </div>
    </div>
  );
}
