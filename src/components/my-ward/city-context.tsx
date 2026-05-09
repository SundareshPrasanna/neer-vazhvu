"use client";

/**
 * Lightweight context for the My Ward subtree so the card components
 * (groundwater, water-bodies, flood-risk, infrastructure, river,
 * actions, header) can build city-aware deep links without each one
 * needing a `cityId` prop threaded through.
 *
 * Convention:
 *   cityPrefix === "" for Chennai (flat URLs at root).
 *   cityPrefix === "/<cityId>" otherwise.
 *
 * Default is Chennai for back-compat with the existing /my-ward route
 * that doesn't wrap its tree in a provider.
 */

import { createContext, useContext } from "react";

interface MyWardCityCtx {
  cityId: string;
  cityPrefix: string;
}

const Ctx = createContext<MyWardCityCtx>({ cityId: "chennai", cityPrefix: "" });

export function MyWardCityProvider({
  cityId,
  children,
}: {
  cityId: string;
  children: React.ReactNode;
}) {
  const cityPrefix = cityId === "chennai" ? "" : `/${cityId}`;
  return <Ctx.Provider value={{ cityId, cityPrefix }}>{children}</Ctx.Provider>;
}

export function useMyWardCity() {
  return useContext(Ctx);
}
