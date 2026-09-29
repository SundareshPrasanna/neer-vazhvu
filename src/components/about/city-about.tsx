"use client";

import dynamic from "next/dynamic";
import type { ComponentType, ReactNode } from "react";
import { isCityId, type CityId } from "@/lib/cities/ids";

export interface CityAboutSlotProps {
  slot: string;
  cityId: string;
  /** Rendered when the city's module does not fill this slot. */
  fallback?: ReactNode;
}

/** Each city's About content (src/content/about/<city>.tsx), loaded only on
 *  that city's page. Adding a CityId is a type error until its module exists. */
const CITY_ABOUT: Record<CityId, ComponentType<CityAboutSlotProps>> = {
  chennai: dynamic(() => import("@/content/about/chennai")),
  madurai: dynamic(() => import("@/content/about/madurai")),
  bangalore: dynamic(() => import("@/content/about/bangalore")),
  mumbai: dynamic(() => import("@/content/about/mumbai")),
  delhi: dynamic(() => import("@/content/about/delhi")),
  hyderabad: dynamic(() => import("@/content/about/hyderabad")),
  kolkata: dynamic(() => import("@/content/about/kolkata")),
  gurugram: dynamic(() => import("@/content/about/gurugram")),
  pune: dynamic(() => import("@/content/about/pune")),
  surat: dynamic(() => import("@/content/about/surat")),
};

/** One named slot of the About page, filled from the city's own module. */
export function CityAbout({ slot, cityId, fallback = null }: CityAboutSlotProps) {
  if (!isCityId(cityId)) return <>{fallback}</>;
  const Content = CITY_ABOUT[cityId];
  return <Content slot={slot} cityId={cityId} fallback={fallback} />;
}
