import type { WardProfile } from "@/lib/hooks/use-ward-profile";

interface GroundwaterData {
  depthM: number | null;
  trend: string;
  riskLevel: string;
  riskScore?: number | null;
}

interface RepresentativeData {
  councillor: { name: string; party: string; phone?: string };
  mla: { name: string; party: string; constituency: string };
  mp: { name: string; party: string; constituency: string };
}

export function escapeCSV(value: string | number | null | undefined): string {
  if (value == null) return "";
  const s = String(value);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function row(...cells: (string | number | null | undefined)[]): string {
  return cells.map(escapeCSV).join(",");
}

export function generateWardCSV(
  wardNumber: number,
  zoneName: string,
  profile: WardProfile,
  groundwater: GroundwaterData | null,
  representatives: RepresentativeData | null,
): string {
  const lines: string[] = [];

  lines.push(row("Category", "Metric", "Value", "Unit", "Source"));

  // Ward identity
  lines.push(row("Ward", "Ward number", wardNumber, "", "GCC"));
  lines.push(row("Ward", "Zone", zoneName, "", "GCC"));

  // Groundwater
  if (groundwater && groundwater.depthM != null) {
    lines.push(row("Groundwater", "Depth to water table", groundwater.depthM.toFixed(1), "meters (mbgl)", "OpenCity/CMWSSB"));
    lines.push(row("Groundwater", "Year-over-year trend", groundwater.trend, "", "OpenCity/CMWSSB"));
    lines.push(row("Groundwater", "Risk level", groundwater.riskLevel, "", "Neer Vazhvu"));
    if (groundwater.riskScore != null) {
      lines.push(row("Groundwater", "Risk score", groundwater.riskScore, "/ 100", "Neer Vazhvu"));
    }
  }

  // Water bodies
  lines.push(row("Water Bodies", "Current count", profile.water_bodies.current_count, "bodies", "OpenStreetMap"));
  lines.push(row("Water Bodies", "Census records", profile.water_bodies.census_records, "records", "data.gov.in"));
  lines.push(row("Water Bodies", "Critical restoration priority", profile.water_bodies.restoration_critical, "bodies", "Neer Vazhvu"));
  lines.push(row("Water Bodies", "High restoration priority", profile.water_bodies.restoration_high, "bodies", "Neer Vazhvu"));
  if (profile.lost_bodies.count > 0) {
    lines.push(row("Water Bodies", "Lost/encroached bodies", profile.lost_bodies.count, "bodies", "Care Earth Trust / IIT Madras"));
    if (profile.lost_bodies.names.length > 0) {
      lines.push(row("Water Bodies", "Lost body names", profile.lost_bodies.names.join("; "), "", ""));
    }
  }

  // Flood risk
  if (profile.flood.dominant_hazard) {
    lines.push(row("Flood Risk", "Dominant hazard", profile.flood.dominant_hazard, "", "CFLOWS / OpenCity"));
  }
  lines.push(row("Flood Risk", "Hazard zones", profile.flood.hazard_zone_count, "zones", "CFLOWS / OpenCity"));
  if (profile.flood.hotspot_2015_count > 0) {
    lines.push(row("Flood Risk", "2015 flood hotspots", profile.flood.hotspot_2015_count, "hotspots", "OpenCity"));
  }
  if (profile.flood.hotspot_2020_count > 0) {
    lines.push(row("Flood Risk", "2020 Cyclone Nivar hotspots", profile.flood.hotspot_2020_count, "hotspots", "OpenCity"));
  }

  // Infrastructure
  lines.push(row("Infrastructure", "Drainage lines", profile.drainage.line_count, "segments", "GCC SWD Survey"));
  lines.push(row("Infrastructure", "Sewage treatment plants", profile.sewerage.stp_count, "STPs", "CMWSSB"));
  if (profile.sewerage.total_stp_capacity_mld > 0) {
    lines.push(row("Infrastructure", "STP capacity", profile.sewerage.total_stp_capacity_mld, "MLD", "CMWSSB"));
  }
  lines.push(row("Infrastructure", "Sewage pumping stations", profile.sewerage.sps_count, "stations", "CMWSSB"));
  lines.push(row("Infrastructure", "Pumping mains", profile.sewerage.pumping_main_count, "segments", "CMWSSB"));

  // River
  if (profile.rivers.nearest_river_id) {
    lines.push(row("River", "Nearest river ID", profile.rivers.nearest_river_id, "", "CPCB"));
    if (profile.rivers.nearest_km != null) {
      lines.push(row("River", "Distance to nearest station", profile.rivers.nearest_km, "km", ""));
    }
  }

  // Industrial
  if (profile.industrial.zone_count > 0) {
    lines.push(row("Industrial", "Industrial zones", profile.industrial.zone_count, "zones", "OpenStreetMap"));
  }

  // Representatives
  if (representatives) {
    lines.push(row("Representatives", "Councillor", representatives.councillor.name, representatives.councillor.party, "GCC 2022"));
    if (representatives.councillor.phone) {
      lines.push(row("Representatives", "Councillor phone", representatives.councillor.phone, "", "GCC"));
    }
    lines.push(row("Representatives", "MLA", representatives.mla.name, representatives.mla.party, "TN Assembly 2021"));
    lines.push(row("Representatives", "MP", representatives.mp.name, representatives.mp.party, "Lok Sabha 2019"));
  }

  // Metadata
  lines.push(row("Metadata", "Export date", new Date().toISOString().split("T")[0], "", ""));
  lines.push(row("Metadata", "Source", "neervazhvu.org", "", ""));

  return lines.join("\n");
}

export function downloadCSV(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
