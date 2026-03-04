const IST_TIME_ZONE = 'Asia/Kolkata';

function getDatePartsInTimeZone(
  date: Date,
  timeZone: string = IST_TIME_ZONE
): { year: number; month: number; day: number } {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);

  return { year, month, day };
}

/** Get today's date as YYYY-MM-DD in IST */
export function todayIST(): string {
  const { year, month, day } = getDatePartsInTimeZone(new Date(), IST_TIME_ZONE);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Get today's year/month/day in IST */
export function todayISTParts(): { year: number; month: number; day: number } {
  return getDatePartsInTimeZone(new Date(), IST_TIME_ZONE);
}

/** Subtract N days from a date, returning YYYY-MM-DD */
export function subtractDays(date: Date, days: number): string {
  const shifted = new Date(date.getTime() - days * 24 * 60 * 60 * 1000);
  const { year, month, day } = getDatePartsInTimeZone(shifted, IST_TIME_ZONE);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
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
