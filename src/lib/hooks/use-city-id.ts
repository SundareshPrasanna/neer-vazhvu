"use client";

import { useParams } from "next/navigation";

/** The city of the current /[cityId] route, or null outside one. Components
 *  nested deep inside a city page read it here instead of defaulting to a city. */
export function useCityId(): string | null {
  const params = useParams();
  return typeof params?.cityId === "string" ? params.cityId : null;
}
