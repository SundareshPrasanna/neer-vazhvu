"use client";

/**
 * Methods and uncertainty: the page's own error model, in one place
 * (rendered above the footer for both modes, anchored #methods).
 * Every number family: how it was made, what it means, how wrong it
 * can be. Pre-publication audit: every derived number is recomputed
 * independently from raw inputs by scripts/audit_waterway_numbers.py
 * and the claims gate (scripts/verify_waterway_buckingham.py).
 */
function M({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold text-foreground">{title}</h4>
      <div className="mt-1 space-y-2 text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </div>
  );
}

export function MethodsPanel({ claimCount }: { claimCount: number }) {
  return (
    <section id="methods" className="mx-auto max-w-5xl scroll-mt-36 px-4 pb-16">
      <details className="group rounded-xl border border-border bg-card">
        <summary className="cursor-pointer select-none px-5 py-4 text-base font-semibold text-foreground marker:content-none [&::-webkit-details-marker]:hidden">
          <span className="mr-2 inline-block transition-transform group-open:rotate-90">
            &#9656;
          </span>
          How every number on this page was made, and how wrong it can be
        </summary>
        <div className="grid gap-6 px-5 pb-6 md:grid-cols-2">
          <M title="Length and chainage">
            <p>
              The 74.5 km alignment is chained from OpenStreetMap&apos;s canal
              geometry (ODbL), km 0 at the Ennore creek crossing. OSM has no
              continuous canal through the Basin Bridge / Cooum junction; a
              ~1.4 km straight bridge spans it, so chainage there is
              approximate. Whole-length uncertainty: about &plusmn;1&ndash;2%.
            </p>
          </M>
          <M title="Widths (the 373 transects)">
            <p>
              Every 200 m we cast a perpendicular line and measure the
              water-surface polygon traced by OpenStreetMap contributors
              (edits 2018&ndash;Mar 2026, most since 2022). This is water
              surface at the tracing moment &mdash; not the canal&apos;s
              recorded land, and it moves with season. Individual transects:
              treat as &plusmn;15&ndash;25% on narrow reaches; per-reach
              medians are robust. Each reach carries a confidence tier:
              A = &ge;70% measured, tracing mostly 2021+, adjacent-transect
              jitter &le;25%; B = measured but sparse or older tracing;
              C = not channel-measurable (creek complexes, junctions).
              Wide spreads on reaches that open into backwaters are real
              variation, not error &mdash; jitter is the noise measure.
            </p>
          </M>
          <M title="Satellite metrics (Sentinel-2, 10 m pixels)">
            <p>
              Cloud-masked median composites: Jan&ndash;Apr and
              Jun&ndash;Aug 2026. Vegetation = NDVI &gt; 0.35; open water =
              NDWI &gt; 0. <strong>Vegetation on the water</strong> is
              computed strictly inside the mapped water polygons (floating
              plus emergent growth); <strong>corridor</strong> figures also
              include ~8 m of bank each side and read higher. Threshold
              choice moves fractions by roughly &plusmn;5&ndash;10 percentage
              points; 10 m pixels undercount water in channels narrower than
              ~30 m. The suspended-sediment reading (NDTI) is a relative
              index over open water, not a mg/L measurement. Site images are
              clearest-pixel composites; segment images are medians &mdash;
              each is dated on the image.
            </p>
          </M>
          <M title="The built edge">
            <p>
              Google Open Buildings v3 footprints (2023 release, confidence
              &ge; 0.7) counted within 50 m and 100 m of the centerline.
              Deliberately conservative: measured from the centerline, not
              the canal&apos;s recorded boundary; the confidence filter trims
              small structures; three years of construction post-date the
              data. Counts are robust to these; a &quot;none mapped&quot;
              reads exactly that &mdash; nothing in the dataset, not proof
              of nothing on the ground.
            </p>
          </M>
          <M title="Cited facts and their flags">
            <p>
              {claimCount} claims power this page, each carrying source,
              date and a flag: <em>verified</em> = checked against the cited
              document (many held as local primary copies: IWAI 2014, CAG
              2017 and 2020, the Madras HC order, TNPCB consent orders,
              CPCB monitoring PDFs); <em>our analysis</em> = derived by
              Neer Vazhvu with the method stated; <em>as asserted</em> = a
              named party&apos;s claim, reported, not endorsed. Corrected
              figures are barred from the page by a build-time gate, and
              corrections are recorded, never silently swapped.
            </p>
          </M>
          <M title="What this page deliberately does not compute">
            <p>
              Depth, silt volume and flow &mdash; no satellite can measure
              them in water this turbid and narrow (the last public depth
              survey is from 2014), and we would rather show a gap than an
              estimate without an instrument. They are the first work of the
              measurement layer this page proposes: level and flow gauging
              to the index-velocity standard, a boat-run depth profile, and
              ground-truth under the vegetation the satellite flags.
            </p>
          </M>
        </div>
      </details>
    </section>
  );
}
