"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Detailed methodology explainer for the Lake Catchment Atlas (the
 * "Catchments" view mode on /water-bodies). Built to be embedded inside a
 * collapsible <Section id="catchment-methodology"> on both about pages (the
 * multi-city /[cityId]/about and the legacy Chennai /about); the atlas side
 * panel deep-links here via "How this is built ->".
 *
 * Catchment delineation is district-agnostic, so the content is shared; only
 * the city name is interpolated. Keep this in sync with
 * docs/methodology/catchment-atlas-v1.md.
 */
export function CatchmentMethodologySection({
  cityDisplayName,
  cityId,
}: {
  cityDisplayName: string;
  /** When set, "the Catchments view" becomes a link to it. */
  cityId?: string;
}): ReactNode {
  return (
    <div className="space-y-4 text-sm text-slate-700 dark:text-slate-300">
      <p>
        The cascade overlay answers &quot;which tank drains into which&quot;.
        The <strong>catchment atlas</strong> answers the prior question:{" "}
        <strong>where does each lake&apos;s water come from</strong>. Every
        lake sits at the bottom of a catchment - the land whose rain drains
        toward it. Click any lake on the{" "}
        {cityId ? (
          <Link
            href={`/${cityId}/water-bodies?mode=catchments`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            Catchments view
          </Link>
        ) : (
          "Catchments view"
        )}{" "}
        and we draw its area
        of influence: the catchment polygon, the feeder streams inside it, the
        tanks upstream and downstream, and where its overflow finally reaches a
        river.
      </p>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          What you are seeing
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Orange (solid):</strong> the lake&apos;s{" "}
            <strong>own / direct catchment</strong> - the land that drains
            straight into it before reaching any other tank.
          </li>
          <li>
            <strong>Amber (dashed):</strong> the{" "}
            <strong>inherited basin</strong> upstream - catchment that drains
            in via other tanks. Own + inherited = total upstream basin.
          </li>
          <li>
            <strong>Blue lines:</strong> feeder streams, width graded by
            Strahler order (trunks thicker than first-order rills).
          </li>
          <li>
            <strong>Violet dotted line:</strong> the{" "}
            <strong>downstream flow path</strong> - how the lake&apos;s
            overflow actually runs through the channel network, lake by lake,
            until it reaches a river.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Inputs
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Elevation:</strong> FABDEM (Forest And Buildings removed
            Copernicus DEM) at 30&nbsp;m. This is a <em>bare-earth</em> surface
            - buildings and tree canopy are removed - so water routes over the
            real ground rather than over rooftops, which matters in dense urban
            terrain. (The cascade graph uses coarser 90&nbsp;m HydroSHEDS; the
            atlas deliberately uses the finer DEM.)
          </li>
          <li>
            <strong>Lake polygons:</strong> OpenStreetMap{" "}
            <code className="text-xs">water=*</code> features, the same set the
            water-bodies map uses.
          </li>
          <li>
            <strong>Buildings:</strong> Overture Maps building footprints, for
            the rooftop-harvest estimate.
          </li>
          <li>
            <strong>Rainfall:</strong> India Meteorological Department (IMD)
            long-period annual normals for the district.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          How the catchment is delineated
        </h4>
        <ol className="list-decimal list-outside pl-5 space-y-1">
          <li>
            Mosaic FABDEM over the district (buffered so edge catchments
            close), then condition it with WhiteboxTools{" "}
            <code className="text-xs">breach_depressions_least_cost</code>{" "}
            (preferred over fill in cities - it preserves channels running
            under roads and culverts).
          </li>
          <li>
            Compute D8 flow direction and flow accumulation; extract a stream
            network and assign Strahler order; vectorise the streams and smooth
            them (Chaikin corner-cutting) so they trace the natural curved
            channels rather than blocky raster steps.
          </li>
          <li>
            For each lake, trace the contributing area upstream from its
            footprint. The <strong>own (direct) catchment</strong> is the
            upstream trace that <em>stops at the next water body</em> - the land
            draining to this lake before any other tank intercepts it. Removing
            that barrier gives the <strong>total upstream basin</strong>; the
            difference is the <strong>inherited</strong> area. This is
            threshold-free: there are no impound-vs-transit tuning knobs.
          </li>
          <li>
            <strong>Downstream:</strong> from the lake&apos;s outlet (its
            highest-accumulation boundary cell) follow the channel by always
            stepping to the highest-accumulation neighbour until it enters
            another water body; chaining those hops along the cascade gives the
            full downstream flow path to the river.
          </li>
          <li>
            <strong>Rooftop harvest:</strong> clip Overture footprints to the
            own catchment, then{" "}
            <code className="text-xs">
              rooftop area &times; annual rainfall &times; 0.8
            </code>{" "}
            (0.8 runoff coefficient), reported in million litres per year.
          </li>
        </ol>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          Naming the lakes and rivers
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            OpenStreetMap names many water bodies but leaves a large share
            unnamed (in {cityDisplayName} the OSM gap is substantial). Where an
            authoritative open dataset exists - for Bengaluru, the ATREE/CSEI
            named-lake census published on OpenCity - we attach the real toponym
            by <strong>polygon overlap</strong> and tag it{" "}
            <code className="text-xs">name_source</code> with a match
            confidence. OSM-native names are never overwritten, and a small
            pond sitting inside a large lake&apos;s outline is{" "}
            <em>not</em> given that lake&apos;s name (a wrong name is worse than
            a blank one).
          </li>
          <li>
            The river a lake drains into is named by snapping its downstream
            flow path to the nearest mapped river (within 0.5&nbsp;km). Lakes
            whose path stays far from any named river - because they flow off
            the edge of our coverage - honestly show no named river rather than
            a guess.
          </li>
        </ul>
      </div>

      <div>
        <h4 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">
          What this is NOT, and known limits
        </h4>
        <ul className="list-disc list-outside pl-5 space-y-1">
          <li>
            <strong>Not a substitute for a surveyed catchment.</strong> A
            30&nbsp;m bare-earth DEM resolves urban catchments well but misses
            sub-cell culverts, storm drains, and engineered diversions that move
            water against the natural terrain.
          </li>
          <li>
            <strong>Bounded by our map extent.</strong> A lake near the edge can
            drain to a reservoir or river <em>outside</em> the area we model
            (for example a southern Bengaluru tank flowing toward the
            Krishnagiri reservoir, which is off-map). We trace the flow path
            correctly but cannot name a sink we do not hold.
          </li>
          <li>
            <strong>Rivers are conduits, not catchments.</strong> Named
            rivers/canals are excluded as lakes; very elongated polygons with a
            huge catchment-to-area ratio (river segments mis-tagged as water
            bodies) are filtered out.
          </li>
          <li>
            <strong>Rainfall is a long-period normal,</strong> not the actual
            rainfall of any given year, so rooftop-harvest figures are a typical
            annual potential, not a measured yield.
          </li>
          <li>
            <strong>Backfilled names are a join, not ground truth.</strong>{" "}
            They carry a source tag and a match confidence; treat low-confidence
            matches as provisional.
          </li>
        </ul>
      </div>
    </div>
  );
}
