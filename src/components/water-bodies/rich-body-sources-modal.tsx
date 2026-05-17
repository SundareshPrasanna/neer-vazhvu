"use client";

import { useEffect } from "react";
import { X, ExternalLink } from "lucide-react";
import type { RichBodyEntry } from "@/lib/water-bodies/rich-body-registry";

interface RichBodySourcesModalProps {
  body: RichBodyEntry;
  onClose: () => void;
}

export function RichBodySourcesModal({ body, onClose }: RichBodySourcesModalProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-[10002] bg-black/60 flex items-stretch overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative flex flex-col w-full md:max-w-[760px] md:mx-auto md:my-8 md:rounded-xl bg-white dark:bg-slate-900 shadow-2xl min-h-[calc(100vh-4rem)]">
        <button
          onClick={onClose}
          aria-label="Close"
          className="sticky top-3 z-20 self-end mr-3 mt-3 flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200 shadow-md hover:bg-slate-50 dark:hover:bg-slate-700 text-sm font-medium"
        >
          <X className="w-4 h-4" />
          <span className="hidden sm:inline">Close</span>
        </button>

        <div className="px-5 md:px-8 py-4 md:py-6">
          <h2 className="text-xl md:text-2xl font-semibold text-slate-900 dark:text-slate-100">
            Sources &amp; methodology
          </h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            Provenance, licences, and caveats for the data shown on the {body.name} panel.
          </p>

          <Section title="Boundary &amp; legal status">
            <SourceRow
              label="Gazetted Ramsar boundary"
              source="Tamil Nadu State Wetland Authority (TNSWA) QGIS web map"
              note="Authoritative legal boundary. Matches the official Ramsar Site 2481 area (1,247.54 ha) within 0.4%."
              link="https://tnswa.tn.gov.in/qgis_web/index.html"
              licence="Public data from a Tamil Nadu government portal"
            />
            <SourceRow
              label="Ecological boundary (secondary)"
              source="OpenStreetMap relation 15046539"
              note="OSM mapper's interpretation of current marsh extent. Smaller than the gazette (~1,073 ha) because OSM mappers excluded built-up enclaves inside the legal Ramsar perimeter."
              link="https://www.openstreetmap.org/relation/15046539"
              licence="ODbL"
            />
            <SourceRow
              label="1 km no-build buffer"
              source="Computed via @turf/buffer as a Minkowski offset from the gazetted polygon"
              note={`Anchored to NGT order, Sept 2025 - construction freeze within 1 km pending scientific zone-of-influence mapping. Buffer follows the polygon edge (not a circle from a centroid).`}
              link={body.buffer_source_url}
              licence="Derived"
            />
          </Section>

          <Section title="Encroachment &amp; built-up surface">
            <SourceRow
              label="Building footprints (current, primary)"
              source="Overture Maps Foundation - buildings 2026-04-15.0 release"
              note="Quarterly-refreshed building polygons combined from Microsoft, OpenStreetMap, Google, and other partners. Conservative deduplication: each detected structure counted once. We display Overture's count as the primary headline number."
              link="https://docs.overturemaps.org/"
              licence="CDLA-Permissive 2.0"
            />
            <SourceRow
              label="Building footprints (2023 baseline)"
              source="Google Open Buildings v3"
              note="Static one-time research release, imagery from approximately 2022-2023. More aggressive detection - includes each small rooftop as a separate structure, so counts run higher than Overture especially in informal-settlement areas. We show the 2023 count as cf. comparison for the encroachment-since-2023 angle."
              link="https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_Research_open-buildings_v3_polygons"
              licence="CC-BY-4.0"
            />
            <SourceRow
              label="Built-up surface trend (2016-2026)"
              source="Dynamic World V1"
              note="Per-pixel land-cover labels at 10 m, refreshed every 2-5 days from Sentinel-2. We compute the per-year annual MODE label and report the fraction with built = class 6. DW's built class is broader than the building polygons: roads, paved surfaces, and sometimes bare ground all read as built."
              link="https://developers.google.com/earth-engine/datasets/catalog/GOOGLE_DYNAMICWORLD_V1"
              licence="CC-BY-4.0"
            />
          </Section>

          <Section title="Water trend">
            <SourceRow
              label="Annual water classification (1984-2021)"
              source="JRC Global Surface Water v1.4"
              note="Per-pixel yearly classification at 30 m from Landsat 5/7/8 archives. Bodies under ~2 ha are below confident resolution. Pre-2000 over India is sparse; pre-2016 our data uses 5-year majority windows to denoise single-year artefacts. JRC v1.4 has no 2022+ data; extending it requires a custom Sentinel-2 pipeline."
              link="https://developers.google.com/earth-engine/datasets/catalog/JRC_GSW1_4_YearlyHistory"
              licence="EC Open"
            />
          </Section>

          <Section title="Satellite imagery (yearly chips)">
            <SourceRow
              label="1984-1998"
              source="Landsat 5 TM yearly RGB median composite"
              licence="USGS public domain (free)"
            />
            <SourceRow
              label="1999-2012"
              source="Landsat 5 + 7"
              note="Landsat 7 SLC-off stripes from 2003 onward, mitigated by median compositing."
              licence="USGS public domain"
            />
            <SourceRow
              label="2013-2018"
              source="Landsat 7 + 8"
              licence="USGS public domain"
            />
            <SourceRow
              label="2019-present"
              source="Sentinel-2 SR Harmonized"
              licence="Copernicus open"
            />
          </Section>

          <Section title="Planet NICFI imagery">
            <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              High-resolution visual imagery from December 2015 onwards is sourced from Planet&apos;s NICFI
              (Norway&apos;s International Climate &amp; Forests Initiative) basemap program. NICFI provides
              free 5-metre monthly mosaics for tropical biome regions (~30&deg;N to ~30&deg;S), supporting
              tropical forest monitoring and related research.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Scope interpretation.</strong>{" "}
              We use NICFI to monitor paired wetland and tree-cover change in tropical Indian cities.
              Wetland conservation and urban tree-cover loss are recognised ecological adjacencies of
              tropical forest health - wetlands buffer river systems, and urban tree cover correlates
              with catchment integrity and heat-island formation. We treat our use as within the
              program&apos;s stated goals of forest conservation and restoration. Our use is non-commercial,
              civic-tech in nature, and intended to make ecological infrastructure visible to the public.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Compliance.</strong> All NICFI
              imagery on this platform retains the required attribution. Chips are cached on our
              infrastructure for display performance only - we do not redistribute NICFI mosaics as a
              standalone dataset, do not offer bulk downloads of NICFI tiles, and do not sub-license the
              imagery to third parties. NICFI imagery is served only within the analytical context of
              our water-body and tree-cover pages.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Attribution.</strong>{" "}
              &copy; Planet Labs PBC | NICFI. Used under the{" "}
              <a
                href="https://www.planet.com/nicfi/"
                target="_blank"
                rel="noreferrer noopener"
                className="text-sky-600 dark:text-sky-400 hover:underline inline-flex items-center gap-1"
              >
                NICFI Public License
                <ExternalLink className="w-3 h-3" />
              </a>
              .
            </p>
            <p className="mt-3 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              <em>Note: NICFI registration is in progress. Until it clears, satellite chips on this
              page use Sentinel-2 SR Harmonized at 10 m. NICFI 5 m chips will replace them as a quiet
              quality upgrade once access is provisioned.</em>
            </p>
          </Section>

          <Section title="Caveats to keep in mind">
            <ul className="list-disc pl-5 space-y-2 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
              <li>
                <strong className="text-slate-900 dark:text-slate-100">The two building counts
                diverge by methodology, not just by date.</strong> Overture (2026) is the more recent
                snapshot but uses conservative deduplication; Google Open Buildings v3 (2023) detects
                each rooftop individually and often counts more structures in dense informal
                settlements. Treat the pair as a range, not a point estimate.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-100">Dynamic World &quot;built&quot;
                is over-inclusive.</strong> Roads, paved surfaces, and sometimes bare ground read as
                built. Pair the DW % with the Open Buildings rooftop count for a calibrated read.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-100">JRC pre-2000 over India is
                sparse</strong> (Landsat 5 sparse coverage). Use 5-year averages, not single-year values.
              </li>
              <li>
                <strong className="text-slate-900 dark:text-slate-100">The OSM ecological polygon is
                one observer&apos;s interpretation</strong> - the &quot;gap&quot; between gazette and OSM is
                indicative of conversion-already-happened, not definitive proof.
              </li>
            </ul>
          </Section>

          <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400">
            Questions about our use of any of these datasets? Reach us via{" "}
            <a
              href="https://neervazhvu.org"
              target="_blank"
              rel="noreferrer noopener"
              className="underline hover:text-slate-700 dark:hover:text-slate-300"
            >
              neervazhvu.org
            </a>
            .
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h3
        className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400"
        dangerouslySetInnerHTML={{ __html: title }}
      />
      <div className="mt-2 space-y-3">{children}</div>
    </section>
  );
}

interface SourceRowProps {
  label: string;
  source: string;
  note?: string;
  link?: string;
  licence?: string;
}

function SourceRow({ label, source, note, link, licence }: SourceRowProps) {
  return (
    <div className="border border-slate-200 dark:border-slate-800 rounded-md p-3 text-sm">
      <div className="font-medium text-slate-900 dark:text-slate-100">{label}</div>
      <div className="mt-0.5 text-slate-600 dark:text-slate-400">
        {source}
        {licence && (
          <span className="ml-2 text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">
            · {licence}
          </span>
        )}
      </div>
      {note && (
        <div className="mt-1.5 text-[13px] text-slate-700 dark:text-slate-300 leading-relaxed">
          {note}
        </div>
      )}
      {link && (
        <a
          href={link}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-1.5 inline-flex items-center gap-1 text-[12px] text-sky-600 dark:text-sky-400 hover:underline"
        >
          Source <ExternalLink className="w-3 h-3" />
        </a>
      )}
    </div>
  );
}
