/**
 * Variant selection logic for the CityStory narrative.
 * Picks the right sentence keys based on data thresholds.
 */

import type { CityStoryMetrics } from "./derive-metrics";
import {
  STORAGE_CRISIS_PCT,
  STORAGE_STRESS_PCT,
  STRESSED_WARDS_THRESHOLD,
  DECLINING_WARDS_THRESHOLD,
} from "./constants";

export type NarrativeVariant = "crisis" | "stress" | "mixed" | "stable";

export interface CityStoryNarrative {
  variant: NarrativeVariant;
  headlineKey: string;
  sentences: Array<{
    key: string;
    params: Record<string, string | number>;
  }>;
  freshnessKey: string;
  freshnessParams: Record<string, string | number>;
}

export function selectNarrative(metrics: CityStoryMetrics): CityStoryNarrative {
  const { reservoir, groundwater, restoration } = metrics;
  const { storagePct } = reservoir;

  // -- Select variant --
  let variant: NarrativeVariant;
  if (storagePct < STORAGE_CRISIS_PCT) {
    variant = "crisis";
  } else if (storagePct < STORAGE_STRESS_PCT) {
    variant = "stress";
  } else if (
    groundwater.stressedCount > STRESSED_WARDS_THRESHOLD ||
    groundwater.declineCount > DECLINING_WARDS_THRESHOLD
  ) {
    variant = "mixed";
  } else {
    variant = "stable";
  }

  // -- Build sentences --
  const sentences: CityStoryNarrative["sentences"] = [];

  // Headline is variant-specific
  const headlineKey = `city_story.${variant}_headline`;

  // Reservoir context sentence
  sentences.push({
    key: "city_story.reservoir_context",
    params: {
      pct: Math.round(storagePct),
    },
  });

  // Groundwater pressure sentence (always shown - even stable has a count)
  if (groundwater.stressedCount > 0) {
    sentences.push({
      key: "city_story.gw_pressure",
      params: {
        stressedCount: groundwater.stressedCount,
        totalWards: groundwater.totalWards,
      },
    });
  }

  // Declining wards (show when meaningful)
  if (groundwater.declineCount > 0) {
    sentences.push({
      key: "city_story.gw_declining",
      params: {
        declineCount: groundwater.declineCount,
      },
    });
  }

  // Restoration action sentence (show when there are critical or high priority bodies)
  const actionCount = restoration.criticalCount + restoration.highCount;
  if (actionCount > 0) {
    sentences.push({
      key: "city_story.restoration_action",
      params: {
        actionCount,
      },
    });
  }

  // -- Freshness --
  const gwDate = new Date(groundwater.period.year, groundwater.period.month - 1);
  const gwMonthStr = gwDate.toLocaleString("en", { month: "short" });

  return {
    variant,
    headlineKey,
    sentences,
    freshnessKey: "city_story.freshness",
    freshnessParams: {
      reservoirDate: reservoir.lastUpdated,
      gwMonth: gwMonthStr,
      gwYear: groundwater.period.year,
    },
  };
}
