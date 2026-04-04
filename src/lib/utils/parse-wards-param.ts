export function parseWardsParam(param: string | null): number[] {
  if (!param) return [];
  return param
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0)
    .slice(0, 3);
}
