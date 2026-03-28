"use client";

import { useTheme } from "next-themes";

const LIGHT_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const DARK_TILES = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

const LIGHT_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
const DARK_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/">CARTO</a>';

export function useMapTiles() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  return {
    url: isDark ? DARK_TILES : LIGHT_TILES,
    attribution: isDark ? DARK_ATTR : LIGHT_ATTR,
    stroke: isDark ? "#475569" : "#374151",       // slate-600 / gray-700
    strokeLight: isDark ? "#334155" : "#1e293b",   // slate-700 / slate-800
    hoverStroke: isDark ? "#60a5fa" : "#1e40af",   // blue-400 / blue-800
  };
}
