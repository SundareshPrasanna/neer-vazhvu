export interface GroundwaterWard {
  wardNumber: number;
  wardName: string;
  zone: string;
  depthM: number | null;
  trend: 'improving' | 'stable' | 'declining' | 'unknown';
}

export interface GroundwaterApiResponse {
  period: { year: number; month: number };
  cityAverage: number | null;
  wards: GroundwaterWard[];
  summary: {
    healthy: number;    // 0-3m
    moderate: number;   // 3-6m
    declining: number;  // 6-10m
    stressed: number;   // 10-15m
    critical: number;   // 15-25m
    crisis: number;     // >25m
    noData: number;
  };
}

export type GroundwaterStatus =
  | 'healthy'
  | 'moderate'
  | 'declining'
  | 'stressed'
  | 'critical'
  | 'crisis'
  | 'noData';

export function getGroundwaterStatus(depthM: number | null): GroundwaterStatus {
  if (depthM === null) return 'noData';
  if (depthM <= 3) return 'healthy';
  if (depthM <= 6) return 'moderate';
  if (depthM <= 10) return 'declining';
  if (depthM <= 15) return 'stressed';
  if (depthM <= 25) return 'critical';
  return 'crisis';
}

export function getGroundwaterColor(depthM: number | null): string {
  if (depthM === null) return '#9ca3af';
  if (depthM <= 3) return '#22c55e';
  if (depthM <= 6) return '#84cc16';
  if (depthM <= 10) return '#eab308';
  if (depthM <= 15) return '#f97316';
  if (depthM <= 25) return '#ef4444';
  return '#7f1d1d';
}
