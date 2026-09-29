"use client";

/**
 * Lightweight context for the My Ward subtree so the card components
 * (groundwater, water-bodies, flood-risk, infrastructure, river,
 * actions, header) can build city-aware deep links without each one
 * needing a `cityId` prop threaded through. Outside the provider (ward
 * panels on other pages) the city comes from the route; there is no
 * default city.
 */

import { createContext, useContext } from "react";
import { useCityId } from "@/lib/hooks/use-city-id";

interface MyWardCityCtx {
  cityId: string;
  cityPrefix: string;
}

const Ctx = createContext<MyWardCityCtx | null>(null);

export function MyWardCityProvider({
  cityId,
  children,
}: {
  cityId: string;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={{ cityId, cityPrefix: `/${cityId}` }}>{children}</Ctx.Provider>;
}

/** `cityId` is "" outside both a provider and a /[cityId] route. */
export function useMyWardCity(): MyWardCityCtx {
  const ctx = useContext(Ctx);
  const routeCityId = useCityId() ?? "";
  return ctx ?? { cityId: routeCityId, cityPrefix: routeCityId ? `/${routeCityId}` : "" };
}
