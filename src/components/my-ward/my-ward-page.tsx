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
import { WardActionsCard } from "./ward-actions-card";
import { WardNarrative } from "@/components/insights/ward-narrative";
import { NewsContext } from "@/components/insights/news-context";

export function MyWardPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t } = useLanguage();
  const [mounted, setMounted] = useState(false);

  const initialWard = searchParams.get("ward");
  const [wardNumber, setWardNumber] = useState<number | null>(
    initialWard ? parseInt(initialWard, 10) || null : null,
  );

  const { profile, groundwater, representatives, loading, getRiverLabel } = useMyWardData(wardNumber);

  // Avoid hydration mismatch: t() returns raw keys on server since
  // LanguageProvider reads language from localStorage on client only.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  // Sync ward selection to URL
  useEffect(() => {
    if (wardNumber == null) return;
    const current = searchParams.get("ward");
    if (current !== String(wardNumber)) {
      router.replace(`/my-ward?ward=${wardNumber}`, { scroll: false });
    }
  }, [wardNumber, searchParams, router]);

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
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      {/* Ward selector - shows hero when no ward selected, compact when selected */}
      <WardSelector onSelect={handleSelectWard} selectedWard={wardNumber} />

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

          {/* AI Narrative */}
          <WardNarrative wardNumber={wardNumber} />

          {/* Section cards */}
          <WardGroundwaterCard
            wardNumber={wardNumber}
            groundwater={groundwater}
            loading={loading}
          />

          <WardWaterBodiesCard wardNumber={wardNumber} profile={profile} />

          <WardFloodRiskCard wardNumber={wardNumber} profile={profile} />

          <WardInfrastructureCard wardNumber={wardNumber} profile={profile} />

          <WardRiverCard
            wardNumber={wardNumber}
            profile={profile}
            getRiverLabel={getRiverLabel}
          />

          {/* Industrial zones */}
          {profile.industrial.zone_count > 0 && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-4 py-2.5">
              {profile.industrial.zone_count} industrial zone{profile.industrial.zone_count !== 1 ? "s" : ""} in this ward - potential pollution source for water bodies and groundwater.
            </div>
          )}

          {/* Actions & Representatives */}
          <WardActionsCard wardNumber={wardNumber} />

          {/* News */}
          <NewsContext
            domain="groundwater"
            zoneName={profile.zone_name}
          />

          {/* Data disclaimer */}
          <div className="text-xs text-slate-400 dark:text-slate-500 bg-slate-50 dark:bg-slate-800/30 rounded-lg px-4 py-3 space-y-1">
            <p>{t("my_ward.data_note")}</p>
            <Link href="/about" className="text-blue-500 dark:text-blue-400 hover:underline">
              {t("nav.about")} &rarr;
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
    </div>
  );
}
