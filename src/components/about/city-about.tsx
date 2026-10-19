"use client";

import type { ReactNode } from "react";
import { isCityId } from "@/lib/cities/ids";
import { CITY_ABOUT } from "@/cities/generated/pages";

export interface CityAboutSlotProps {
  slot: string;
  cityId: string;
  /** Rendered when the city's module does not fill this slot. */
  fallback?: ReactNode;
}

/** One named slot of the About page, filled from the city's own module. */
export function CityAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  if (!isCityId(cityId)) return <>{fallback}</>;
  const Content = CITY_ABOUT[cityId];
  return <Content slot={slot} cityId={cityId} fallback={fallback} />;
}
