"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useLanguage } from "@/lib/i18n/context";
import {
  hasWaterBodySatelliteEvidence,
  normalizeWaterBodySatelliteEvidenceFrames,
  type WaterBodySatelliteEvidenceFrame,
} from "@/lib/gee/water-body-satellite-evidence";
import { formatDate } from "@/lib/utils/format";

const SENTINEL2_INFO_URL =
  "https://developers.google.com/earth-engine/datasets/catalog/COPERNICUS_S2_HARMONIZED";
const NDWI_INFO_URL =
  "https://en.wikipedia.org/wiki/Normalized_difference_water_index";

type EvidenceStatus = "idle" | "loading" | "ready" | "empty" | "error";

function interpolate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}

function coverageLabelKey(validPixelPct: number | null): string | null {
  if (validPixelPct === null || Number.isNaN(validPixelPct)) {
    return null;
  }
  if (validPixelPct >= 90) {
    return "wb_panel.satellite_view_clear";
  }
  if (validPixelPct >= 70) {
    return "wb_panel.satellite_view_mostly_clear";
  }
  return "wb_panel.satellite_view_partial";
}

function sourceLabel(source: string, t: (key: string) => string): string {
  if (source === "sentinel2_harmonized" || source === "sentinel2_sr_harmonized") {
    return t("wb_panel.satellite_source_sentinel2");
  }
  if (source === "dynamic_world") {
    return t("wb_panel.satellite_source_dynamic_world");
  }

  return source
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface SatelliteEvidenceDialogProps {
  osmId: number;
  waterBodyName: string;
}

export function SatelliteEvidenceDialog({
  osmId,
  waterBodyName,
}: SatelliteEvidenceDialogProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [showOverlay, setShowOverlay] = useState(true);
  const [selectedFrameDate, setSelectedFrameDate] = useState<string | null>(null);
  const [status, setStatus] = useState<EvidenceStatus>("idle");
  const [frames, setFrames] = useState<WaterBodySatelliteEvidenceFrame[]>([]);

  useEffect(() => {
    if (!open || status !== "loading") {
      return;
    }

    const controller = new AbortController();

    fetch(`/api/water-bodies/gee/evidence?osm_id=${osmId}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        if (response.status === 404) {
          setFrames([]);
          setStatus("empty");
          return;
        }

        if (!response.ok) {
          throw new Error(`Failed to fetch water-body satellite evidence: ${response.status}`);
        }

        const payload = await response.json();
        const nextFrames = normalizeWaterBodySatelliteEvidenceFrames(payload?.data);
        if (!hasWaterBodySatelliteEvidence(nextFrames)) {
          setFrames([]);
          setStatus("empty");
          return;
        }

        setFrames(nextFrames);
        setStatus("ready");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setFrames([]);
        setStatus("error");
      });

    return () => controller.abort();
  }, [open, osmId, status]);
  const resolvedSelectedFrameDate =
    selectedFrameDate && frames.some((frame) => frame.frameDate === selectedFrameDate)
      ? selectedFrameDate
      : frames[frames.length - 1]?.frameDate ?? null;
  const selectedFrame =
    frames.find((frame) => frame.frameDate === resolvedSelectedFrameDate) ??
    frames[frames.length - 1];
  const coverageLabel = selectedFrame ? coverageLabelKey(selectedFrame.usableCoveragePct) : null;
  const coverageDetail =
    selectedFrame?.usableCoveragePct == null
      ? null
      : interpolate(t("wb_panel.satellite_coverage_detail_short"), {
          pct: Math.round(selectedFrame.usableCoveragePct),
        });

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          if (status === "idle" || status === "error") {
            setStatus("loading");
          }
          setOpen(true);
        }}
      >
        {t("wb_panel.satellite_evidence_button")}
      </Button>

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (nextOpen && (status === "idle" || status === "error")) {
            setStatus("loading");
          }
          setOpen(nextOpen);
          if (!nextOpen) {
            setShowOverlay(true);
          }
        }}
      >
        <DialogContent className="w-[calc(100vw-2rem)] sm:max-w-5xl max-h-[90vh] overflow-hidden p-0">
          <div className="flex max-h-[90vh] flex-col bg-white dark:bg-slate-900 overflow-hidden">
            <DialogHeader className="border-b border-slate-200 dark:border-slate-700 p-6 pr-12">
              <DialogTitle className="text-xl text-slate-900 dark:text-slate-100">
                {t("wb_panel.satellite_evidence_title")}
              </DialogTitle>
              <DialogDescription className="leading-relaxed text-slate-600 dark:text-slate-300">
                {interpolate(t("wb_panel.satellite_evidence_description"), {
                  name: waterBodyName,
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6">
              {status === "loading" ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-4 text-sm text-slate-600 dark:text-slate-300">
                  {t("wb_panel.satellite_evidence_loading")}
                </div>
              ) : null}

              {status === "empty" ? (
                <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 p-4 text-sm text-amber-900 dark:text-amber-200">
                  {t("wb_panel.satellite_evidence_empty")}
                </div>
              ) : null}

              {status === "error" ? (
                <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-4 text-sm text-red-900 dark:text-red-200">
                  {t("wb_panel.satellite_evidence_error")}
                </div>
              ) : null}

              {status === "ready" && selectedFrame ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="space-y-1">
                      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("wb_panel.satellite_evidence_reviewed_frames")}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-300">
                        {t("wb_panel.satellite_evidence_reviewed_note")}
                      </div>
                    </div>
                    <Button
                      variant={showOverlay ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setShowOverlay((current) => !current)}
                      disabled={!selectedFrame.overlayUrl}
                    >
                      {showOverlay
                        ? t("wb_panel.satellite_evidence_hide_overlay")
                        : t("wb_panel.satellite_evidence_show_overlay")}
                    </Button>
                  </div>

                  <div className="overflow-x-auto pb-1">
                    <div className="flex min-w-max gap-2">
                      {frames.map((frame) => {
                        const isSelected = frame.frameDate === selectedFrame.frameDate;
                        const frameCoverageLabel = coverageLabelKey(frame.usableCoveragePct);
                        return (
                          <button
                            key={frame.frameDate}
                            type="button"
                            onClick={() => setSelectedFrameDate(frame.frameDate)}
                            className={`min-w-[132px] rounded-lg border px-3 py-2 text-left transition-colors ${
                              isSelected
                                ? "border-blue-500 bg-blue-50 dark:border-blue-400 dark:bg-blue-950/30"
                                : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
                            }`}
                          >
                            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                              {formatDate(frame.frameDate)}
                            </div>
                            <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                              {frameCoverageLabel ? t(frameCoverageLabel) : t("wb_panel.unknown")}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-950 overflow-hidden">
                    <div className="relative aspect-[4/3]">
                      {selectedFrame.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedFrame.imageUrl}
                          alt={interpolate(t("wb_panel.satellite_evidence_image_alt"), {
                            name: waterBodyName,
                            date: formatDate(selectedFrame.frameDate),
                          })}
                          className="h-full w-full object-contain"
                        />
                      ) : null}
                      {showOverlay && selectedFrame.overlayUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedFrame.overlayUrl}
                          alt={interpolate(t("wb_panel.satellite_evidence_overlay_alt"), {
                            name: waterBodyName,
                            date: formatDate(selectedFrame.frameDate),
                          })}
                          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
                        />
                      ) : null}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("wb_panel.satellite_evidence_frame_date")}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {formatDate(selectedFrame.frameDate)}
                      </div>
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("wb_panel.satellite_metric_coverage")}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {coverageLabel ? t(coverageLabel) : "\u2014"}
                      </div>
                      {coverageDetail ? (
                        <div className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {coverageDetail}
                        </div>
                      ) : null}
                    </div>
                    <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-3">
                      <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                        {t("wb_panel.source")}
                      </div>
                      <div className="mt-1 text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {sourceLabel(selectedFrame.sourceDataset, t)}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/60 p-4 space-y-3">
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {t("wb_panel.satellite_evidence_overlay_note")}
                    </p>
                    <div className="flex flex-wrap gap-4 text-xs font-semibold">
                      <a
                        href={SENTINEL2_INFO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {t("wb_panel.satellite_source_link_sentinel2")}
                        <span className="ml-1" aria-hidden="true">↗</span>
                      </a>
                      <a
                        href={NDWI_INFO_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
                      >
                        {t("wb_panel.satellite_source_link_ndwi")}
                        <span className="ml-1" aria-hidden="true">↗</span>
                      </a>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
