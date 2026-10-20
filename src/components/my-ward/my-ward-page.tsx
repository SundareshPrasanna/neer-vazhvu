"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useLanguage } from "@/lib/i18n/context";
import { useMyWardData } from "@/lib/hooks/use-my-ward-data";
import { WardSelector } from "./ward-selector";
import { WardHeader } from "./ward-header";
import { WardGroundwaterCard } from "./ward-groundwater-card";
import { WardWaterBodiesCard } from "./ward-water-bodies-card";
import { WardFloodRiskCard } from "./ward-flood-risk-card";
import { WardInfrastructureCard } from "./ward-infrastructure-card";
import { WardRiverCard } from "./ward-river-card";
import { WardUpliftCard } from "./ward-uplift-card";
import { WardActionsCard } from "./ward-actions-card";
import { WardNarrative } from "@/components/insights/ward-narrative";
import { NewsContext } from "@/components/insights/news-context";
import { MyWardCityProvider } from "./city-context";
import { PlaceReports } from "@/components/sightings/place-reports";
import { tryGetPlaceConfig } from "@/lib/cities";
import { wardSources } from "@/content/my-ward/sources";

const CITY_VIEWS = [
  ["groundwater", "nav.groundwater"],
  ["water-bodies", "nav.water_bodies"],
  ["rivers", "nav.rivers"],
  ["flood-risk", "nav.flood_risk"],
] as const;

interface MyWardPageProps {
  /** City id of the /[cityId]/my-ward route. */
  cityId: string;
}

export function MyWardPage({ cityId }: MyWardPageProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  const initialWard = searchParams.get("ward");
  const [wardNumber, setWardNumber] = useState<number | null>(
    initialWard ? parseInt(initialWard, 10) || null : null,
  );

  const { profile, groundwater, representatives, loading, notFound, getRiverLabel } =
    useMyWardData(wardNumber, cityId);

  // Per-city URL prefix. Chennai keeps the flat URLs; other cities are
  // namespaced under /<cityId>.
  const cityPrefix = cityId === "chennai" ? "" : `/${cityId}`;

  // Avoid hydration mismatch: t() returns raw keys on server since
  // LanguageProvider reads language from localStorage on client only.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Sync ward selection to URL
  useEffect(() => {
    if (wardNumber == null) return;
    const current = searchParams.get("ward");
    if (current !== String(wardNumber)) {
      router.replace(`${cityPrefix}/my-ward?ward=${wardNumber}`, { scroll: false });
    }
  }, [wardNumber, searchParams, router, cityPrefix]);

  const handleSelectWard = (ward: number) => {
    setWardNumber(ward);
  };

  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-slate-400">
        Loading...
      </div>
    );
  }

  return (
    <MyWardCityProvider cityId={cityId}>
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Ward selector - shows hero when no ward selected, compact when selected */}
      <WardSelector onSelect={handleSelectWard} selectedWard={wardNumber} cityId={cityId} />

      {/* Ward content */}
      {wardNumber != null && profile && (
        <>
          <WardHeader
            wardNumber={wardNumber}
            zoneName={profile.zone_name}
            profile={profile}
            groundwater={groundwater}
            representatives={representatives}
          />

          {/* AI Narrative - Chennai-only today (the /api/narratives/ward
              endpoint reads a Chennai-specific narrative store).
              Other cities don't yet have a generation pipeline, so we
              hide the section rather than render Chennai's narrative
              under their ward number. */}
          <WardNarrative wardNumber={wardNumber} />

          {/* Ward table, for a profile with no per-ward joins (a city without
              ward geometry): what is published per ward, then this city's own
              city-wide views. Never another city's routes or facts. */}
          {profile.water_bodies == null && (() => {
            const place = tryGetPlaceConfig(cityId);
            const views = CITY_VIEWS.filter(([r]) => place?.routes.includes(r));
            const office = profile.zone_office;
            const tableSource = wardSources(cityId).table;
            return (
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/30 p-5 space-y-3">
                <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                  {profile.assembly_constituency && (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Assembly seat</dt>
                      <dd className="text-slate-800 dark:text-slate-200">{profile.assembly_constituency}</dd>
                    </>
                  )}
                  {profile.population != null && (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Population</dt>
                      <dd className="text-slate-800 dark:text-slate-200">{profile.population.toLocaleString("en-IN")}</dd>
                    </>
                  )}
                  {office && (office.phones?.length || office.email) && (
                    <>
                      <dt className="text-slate-500 dark:text-slate-400">Zone office</dt>
                      <dd className="text-slate-800 dark:text-slate-200 flex flex-wrap gap-x-3">
                        {office.phones?.map((ph) => (
                          <a key={ph} href={`tel:${ph.replace(/\D/g, "")}`} className="text-blue-600 dark:text-blue-400 hover:underline">{ph}</a>
                        ))}
                        {office.email && (
                          <a href={`mailto:${office.email}`} className="text-blue-600 dark:text-blue-400 hover:underline break-all">{office.email}</a>
                        )}
                      </dd>
                    </>
                  )}
                </dl>
                {tableSource && <p className="text-[10px] text-slate-400 dark:text-slate-500">{t(tableSource)}</p>}
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
                  {place?.wardsVintage
                    ? "Lakes, flooding, drains and groundwater have not been matched to these wards yet."
                    : "Lakes, flooding, drains and groundwater cannot be shown ward by ward yet, because there is no digital map of the wards."}
                  {views.length > 0 && (
                    <>
                      {" "}For the whole city:{" "}
                      {views.map(([r, key], i) => (
                        <span key={r}>
                          {i > 0 && ", "}
                          <Link href={`${cityPrefix}/${r}`} className="text-blue-600 dark:text-blue-400 hover:underline">{t(key)}</Link>
                        </span>
                      ))}
                      .
                    </>
                  )}
                </p>
              </div>
            );
          })()}

          {/* Analytical section cards. Gated on `profile.water_bodies` as
              the sentinel: cities whose profile compute has joined the
              water-bodies layer to wards have all the other analytical
              fields too (Chennai 200 GCC wards, Madurai 100 MMC wards).
              Cities that don't (Bangalore GBA 369 wards today) get the
              admin-only fallback above instead, avoiding the runtime
              TypeError that the cards would otherwise raise on undef
              fields. */}
          {profile.water_bodies != null && (
            <>
          <WardGroundwaterCard
            wardNumber={wardNumber}
            groundwater={groundwater}
            profile={profile}
            loading={loading}
          />

          <WardWaterBodiesCard wardNumber={wardNumber} profile={profile} />

          <WardFloodRiskCard wardNumber={wardNumber} profile={profile} />

          <WardInfrastructureCard wardNumber={wardNumber} profile={profile} />

          <WardUpliftCard wardNumber={wardNumber} profile={profile} />

          <WardRiverCard
            wardNumber={wardNumber}
            profile={profile}
            getRiverLabel={getRiverLabel}
          />
            </>
          )}

          {/* Industrial zones - only when section data exists for this city.
              Guard `profile.industrial` itself: the type declares it required
              but ward profiles built for cities without an industrial layer
              (e.g. a Bangalore ward whose profile JSON omits the section)
              come through as undefined at runtime, and `in` throws on undef. */}
          {profile.industrial &&
            !("_data_status" in profile.industrial) &&
            (profile.industrial.zone_count > 0 ||
              (profile.industrial.cetp_count ?? 0) > 0) && (
              <Link
                href={
                  profile.rivers.nearest_river_id
                    ? `${cityPrefix}/rivers?river=${profile.rivers.nearest_river_id}${profile.rivers.nearest_station_id ? `&station=${profile.rivers.nearest_station_id}` : ""}`
                    : `${cityPrefix}/rivers`
                }
                className="block text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-4 py-2.5 hover:bg-amber-100 dark:hover:bg-amber-950/40 transition-colors"
              >
                {profile.industrial.zone_count > 0 && (
                  <>
                    {profile.industrial.zone_count} industrial zone{profile.industrial.zone_count !== 1 ? "s" : ""} in this ward - potential pollution source for water bodies and groundwater.
                  </>
                )}
                {/* Delhi: the treatment plant serving those estates, and how
                    much of its capacity the effluent actually reaches. A plant
                    far below capacity is the finding, not a footnote. */}
                {profile.industrial.cetps?.map((c) => (
                  <span key={c.name} className="mt-1 block">
                    {c.name}
                    {c.design_capacity_mld != null && ` - ${c.design_capacity_mld} MLD design`}
                    {c.median_utilisation_pct != null && (
                      <>
                        , receiving <strong>{c.median_utilisation_pct}%</strong> of it in a median month
                      </>
                    )}
                    .
                  </span>
                ))}
                {/* Archival caveat sits directly under the figures it applies
                    to, not in a separate About page. */}
                {profile.industrial._series_note && (
                  <span className="mt-1 block text-[11px] text-amber-500/80 dark:text-amber-300/70">
                    {profile.industrial._series_note}
                  </span>
                )}
                <span className="ml-1 text-amber-500 dark:text-amber-300 print:hidden">&rarr;</span>
              </Link>
            )}

          {/* Actions & Representatives */}
          <WardActionsCard wardNumber={wardNumber} />

          <PlaceReports place={cityId} ward={wardNumber} />

          {/* News */}
          <NewsContext
            domain="groundwater"
            zoneName={profile.zone_name ?? undefined}
          />

          {/* Data disclaimer */}
          <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-lg px-4 py-3 space-y-1">
            <p>{t("my_ward.data_note")}</p>
            <Link href={`${cityPrefix}/about`} className="text-blue-500 dark:text-blue-400 hover:underline">
              {t("nav.about")}{" "}&rarr;
            </Link>
          </div>
        </>
      )}

      {/* Loading state when ward selected but profile not loaded yet */}
      {wardNumber != null && !profile && loading && (
        <div className="flex items-center justify-center py-16">
          <div className="text-slate-400 dark:text-slate-500 text-sm">Loading ward data...</div>
        </div>
      )}

      {/* Out-of-range ward: the profile fetch is complete and no ward matched the entered number. */}
      {notFound && (
        <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/40 dark:bg-amber-950/20 p-5">
          <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-2">
            Ward {wardNumber} is not in our dataset
          </h3>
          <div className="text-xs text-slate-700 dark:text-slate-300 space-y-2">
            {cityId === "bangalore" && (
              <p>
                Bengaluru is mapped on the Greater Bengaluru Authority&apos;s{" "}
                <span className="font-semibold">369 wards</span> (delimitation
                notified 19 November 2025), numbered here 1 to 369.
              </p>
            )}
            <p>
              The dashboard doesn&apos;t carry a profile for ward{" "}
              {wardNumber} in this city. Use the search above to find a
              covered ward.
            </p>
          </div>
        </div>
      )}
    </div>
    </MyWardCityProvider>
  );
}
