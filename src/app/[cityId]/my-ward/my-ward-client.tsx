"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useLanguage } from "@/lib/i18n/context";
import { useLockBodyScroll } from "@/lib/hooks/use-lock-body-scroll";

interface ClientProps {
  cityId: string;
  cityDisplayName: string;
  mapCenter: [number, number];
  mapZoom?: number;
}

interface WardProfile {
  ward_number: number;
  zone_no: string | null;
  zone_name: string | null;
  centroid: [number, number];
  area_sq_km: number | null;
}

const ZONE_COLOR: Record<string, string> = {
  CENTRAL: "#3b82f6",
  EAST:    "#10b981",
  NORTH:   "#f59e0b",
  SOUTH:   "#a855f7",
  WEST:    "#ef4444",
};

function MapLoading() {
  const { t } = useLanguage();
  return (
    <div className="h-full w-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
      <span className="text-slate-500 dark:text-slate-400">{t("common.loading_map") || "Loading map..."}</span>
    </div>
  );
}

const MyWardLeafletMap = dynamic(
  () => import("./my-ward-leaflet-map").then((m) => m.MyWardLeafletMap),
  { ssr: false, loading: () => <MapLoading /> },
);

export default function MyWardClient({
  cityId,
  cityDisplayName,
  mapCenter,
  mapZoom = 12,
}: ClientProps) {
  useLockBodyScroll();
  const [profiles, setProfiles] = useState<WardProfile[]>([]);
  const [selectedWard, setSelectedWard] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch(`/data/${cityId}-ward-profiles.json`)
      // Fall back to legacy /ward-profiles.json (Chennai canonical) when the
      // per-city file does not exist - keeps Chennai's existing data path
      // available if someone routes /chennai/my-ward through here later.
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (Array.isArray(data)) {
          setProfiles(data as WardProfile[]);
          if (data.length > 0) setSelectedWard((data[0] as WardProfile).ward_number);
        }
      })
      .catch(console.error);
  }, [cityId]);

  const profileMap = useMemo(() => {
    const m = new Map<number, WardProfile>();
    for (const p of profiles) m.set(p.ward_number, p);
    return m;
  }, [profiles]);

  const selectedProfile = selectedWard !== null ? profileMap.get(selectedWard) ?? null : null;

  const zones = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of profiles) {
      const z = p.zone_name ?? "?";
      counts[z] = (counts[z] || 0) + 1;
    }
    return counts;
  }, [profiles]);

  const totalArea = profiles.reduce((s, p) => s + (p.area_sq_km ?? 0), 0);

  // Filter wards by search input (matches ward number or zone name).
  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.trim().toLowerCase();
    return profiles.filter(
      (p) =>
        String(p.ward_number).includes(q) ||
        (p.zone_name ?? "").toLowerCase().includes(q),
    );
  }, [profiles, search]);

  return (
    <div className="h-[calc(100vh-64px)] flex flex-col">
      {/* Stats bar */}
      <div className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-700 px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm shrink-0">
        <span className="font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
          {cityDisplayName} - My Ward
        </span>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{profiles.length}</span> wards
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{Object.keys(zones).filter((z) => z !== "?").length}</span> zones
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
          <span className="font-semibold text-slate-900 dark:text-slate-100">{totalArea.toFixed(0)}</span> sq km total
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Map */}
        <div className="relative flex-1 h-full">
          <MyWardLeafletMap
            cityId={cityId}
            mapCenter={mapCenter}
            mapZoom={mapZoom}
            profiles={profiles}
            selectedWard={selectedWard}
            onSelectWard={setSelectedWard}
          />
          {/* Ward search overlay */}
          <div className="absolute top-2 right-2 z-[1000]">
            <input
              type="text"
              placeholder="Search ward # or zone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-44 sm:w-56 px-3 py-2 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {search.trim() && filtered.length > 0 && filtered.length < profiles.length && (
              <div className="mt-1 max-h-48 overflow-y-auto bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md shadow-lg">
                {filtered.slice(0, 12).map((p) => (
                  <button
                    key={p.ward_number}
                    onClick={() => {
                      setSelectedWard(p.ward_number);
                      setSearch("");
                    }}
                    className="block w-full text-left px-3 py-1.5 text-xs hover:bg-slate-50 dark:hover:bg-slate-800"
                  >
                    Ward {p.ward_number} - {p.zone_name}
                  </button>
                ))}
                {filtered.length > 12 && (
                  <div className="px-3 py-1 text-[10px] text-slate-400">+{filtered.length - 12} more</div>
                )}
              </div>
            )}
          </div>

          {/* Zone legend bottom-left */}
          <div className="absolute bottom-2 left-2 z-[1000] bg-white/95 dark:bg-slate-900/95 backdrop-blur rounded-md p-2 shadow-sm border border-slate-200 dark:border-slate-700">
            <div className="text-[10px] uppercase tracking-wider text-slate-500 mb-1">Zones</div>
            <div className="flex flex-wrap gap-1.5 max-w-[180px]">
              {Object.entries(zones)
                .filter(([z]) => z !== "?")
                .map(([z, count]) => (
                  <span key={z} className="flex items-center gap-1 text-[10px]">
                    <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: ZONE_COLOR[z] ?? "#94a3b8" }} />
                    <span className="text-slate-700 dark:text-slate-300">{z}</span>
                    <span className="text-slate-400">({count})</span>
                  </span>
                ))}
            </div>
          </div>
        </div>

        {/* Detail sidebar */}
        <div className="hidden md:flex h-full md:w-80 lg:w-96 border-l border-slate-200 dark:border-slate-700 flex-col overflow-y-auto">
          {selectedProfile ? <WardDetail profile={selectedProfile} cityId={cityId} /> : <div className="p-4 text-sm text-slate-500">Click a ward.</div>}
        </div>
      </div>

      {/* Mobile bottom panel */}
      {selectedProfile && (
        <div className="md:hidden border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 max-h-[40vh] overflow-y-auto">
          <WardDetail profile={selectedProfile} cityId={cityId} />
        </div>
      )}
    </div>
  );
}

function WardDetail({ profile, cityId }: { profile: WardProfile; cityId: string }) {
  const zoneColor = profile.zone_name ? ZONE_COLOR[profile.zone_name] ?? "#94a3b8" : "#94a3b8";
  return (
    <div className="p-4 space-y-3">
      <div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: zoneColor }} />
          <span className="text-xs text-slate-500 uppercase tracking-wider">{profile.zone_name ?? "Zone ?"} zone</span>
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mt-1">Ward {profile.ward_number}</h2>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">Zone number</div>
          <div className="font-semibold mt-0.5">Zone {profile.zone_no ?? "?"}</div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2">
          <div className="text-[10px] uppercase text-slate-500">Area</div>
          <div className="font-semibold mt-0.5">
            {profile.area_sq_km !== null ? `${profile.area_sq_km.toFixed(2)} sq km` : "-"}
          </div>
        </div>
        <div className="border border-slate-200 dark:border-slate-700 rounded-lg p-2 col-span-2">
          <div className="text-[10px] uppercase text-slate-500">Centroid (lng, lat)</div>
          <div className="font-mono text-xs mt-0.5">
            {profile.centroid[0].toFixed(4)}, {profile.centroid[1].toFixed(4)}
          </div>
        </div>
      </div>

      <a
        href={`/${cityId}/my-ward/report?ward=${profile.ward_number}`}
        className="block rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50/40 dark:bg-blue-950/20 p-3 hover:border-blue-400 transition-colors"
      >
        <div className="text-[10px] uppercase tracking-wider text-blue-700 dark:text-blue-400 font-semibold">
          Ward report card
        </div>
        <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed mt-1">
          Composite risk grade with factor breakdown (groundwater depth, water-body
          density, water-body health) for Ward {profile.ward_number}.
        </p>
      </a>

      <div className="text-xs text-slate-500 dark:text-slate-400">
        Other citywide data:
      </div>
      <div className="space-y-1.5">
        <a href="../groundwater" className="block rounded border border-slate-200 dark:border-slate-700 p-2 text-xs hover:border-blue-400 transition-colors">
          <span className="font-semibold">Groundwater map</span> - CGWB blocks + live WRIS stations
        </a>
        <a href="../water-bodies" className="block rounded border border-slate-200 dark:border-slate-700 p-2 text-xs hover:border-blue-400 transition-colors">
          <span className="font-semibold">Water bodies</span> - OSM polygons of tanks near this ward
        </a>
        <a href="../lake-restoration" className="block rounded border border-slate-200 dark:border-slate-700 p-2 text-xs hover:border-blue-400 transition-colors">
          <span className="font-semibold">Lake restoration</span> - priority-scored flagships + court anchor
        </a>
      </div>
    </div>
  );
}
