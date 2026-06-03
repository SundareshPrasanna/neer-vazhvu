"use client";

import { useTheme } from "@/components/theme-provider";

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function useMapTiles() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return {
    url: OSM_TILES,
    attribution: OSM_ATTR,
    isDark,
    stroke: isDark ? "#94a3b8" : "#374151",       // slate-400 / gray-700
    strokeLight: isDark ? "#64748b" : "#1e293b",   // slate-500 / slate-800
    hoverStroke: isDark ? "#93c5fd" : "#1e40af",   // blue-300 / blue-800
  };
}
