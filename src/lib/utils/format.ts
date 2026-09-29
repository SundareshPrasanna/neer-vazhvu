/** Format a number with commas for Indian/international style */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format percentage */
export function formatPct(pct: number): string {
  return `${pct.toFixed(1)}%`;
}

/** Format a date string (YYYY-MM-DD) to display format */
export function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/** Interpolate template params into a translated string */
export function interpolate(template: string, params: Record<string, string | number>): string {
  let result = template;
  for (const [key, value] of Object.entries(params)) {
    result = result.replace(`{${key}}`, String(value));
  }
  return result;
}
