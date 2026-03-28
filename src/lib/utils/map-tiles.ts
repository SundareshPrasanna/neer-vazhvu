"use client";

import { useTheme } from "next-themes";

const OSM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

export function useMapTiles() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return {
    url: OSM_TILES,
    attribution: OSM_ATTR,
    stroke: isDark ? "#475569" : "#374151",       // slate-600 / gray-700
    strokeLight: isDark ? "#334155" : "#1e293b",   // slate-700 / slate-800
    hoverStroke: isDark ? "#60a5fa" : "#1e40af",   // blue-400 / blue-800
  };
}
