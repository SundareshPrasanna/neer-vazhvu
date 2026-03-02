/** Format a number with commas for Indian/international style */
export function formatNumber(n: number, decimals = 0): string {
  return n.toLocaleString('en-IN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

/** Format mcft values with appropriate precision */
export function formatMcft(mcft: number): string {
  if (mcft >= 1000) {
    return `${formatNumber(mcft, 0)} mcft`;
  }
  return `${formatNumber(mcft, 1)} mcft`;
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

/** Format date for "Updated X ago" style display */
export function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return 'just now';
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'yesterday';
  return `${diffDays} days ago`;
}
