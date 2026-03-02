/** Get today's date as YYYY-MM-DD in IST */
export function todayIST(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

/** Subtract N days from a date, returning YYYY-MM-DD */
export function subtractDays(date: Date, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() - days);
  return d.toISOString().split('T')[0];
}

/** Parse DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD */
export function parseDMY(dateStr: string): string {
  const match = dateStr.match(/(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})/);
  if (!match) throw new Error(`Cannot parse date: ${dateStr}`);
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
}

/** Convert YYYYMMDD to YYYY-MM-DD */
export function nasaDateToISO(nasaDate: string): string {
  return `${nasaDate.slice(0, 4)}-${nasaDate.slice(4, 6)}-${nasaDate.slice(6, 8)}`;
}

/** Convert YYYY-MM-DD to YYYYMMDD for NASA API */
export function isoToNasaDate(isoDate: string): string {
  return isoDate.replace(/-/g, '');
}
