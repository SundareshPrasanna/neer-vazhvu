import Link from "next/link";
import { listWaterwaysForCity } from "@/lib/waterways";

/**
 * The one shared entry point from a city surface into the waterway pages
 * (multi-city component discipline: one component, registry-driven).
 * Renders a compact link chip per visible waterway of the city - built for
 * the slim stats bars on the rivers map surfaces - and nothing at all for
 * a city with no waterways. Adyar and Cooum appear here by adding their
 * manifests to src/lib/waterways/, never by editing this file.
 */
export function WaterwayLinks({ cityId }: { cityId: string }) {
  const waterways = listWaterwaysForCity(cityId);
  if (waterways.length === 0) return null;
  return (
    <>
      {waterways.map((w) => (
        <Link
          key={w.waterwayId}
          href={`/waterways/${w.waterwayId}`}
          className="inline-flex items-center gap-1 rounded-full border border-cyan-300 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-950/40 px-2.5 py-0.5 text-xs font-medium text-cyan-800 dark:text-cyan-200 hover:bg-cyan-100 dark:hover:bg-cyan-900/50 transition-colors"
        >
          {w.shortName}
          <span aria-hidden>&rarr;</span>
        </Link>
      ))}
    </>
  );
}
