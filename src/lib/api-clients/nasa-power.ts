import { CHENNAI_CENTER } from '@/lib/utils/constants';
import { nasaDateToISO, isoToNasaDate } from '@/lib/utils/date';

const NASA_POWER_BASE = 'https://power.larc.nasa.gov/api/temporal/daily/point';

export interface NASAPowerDay {
  date: string;
  precipitation_mm: number;
  temp_max_c: number;
  temp_min_c: number;
  humidity_pct: number;
}

/**
 * Fetches daily weather data from NASA POWER API.
 * No auth required. Single point query for Chennai centroid.
 *
 * @param startDate - YYYY-MM-DD format
 * @param endDate - YYYY-MM-DD format
 */
export async function fetchNASAPower(
  startDate: string,
  endDate: string
): Promise<NASAPowerDay[]> {
  const params = new URLSearchParams({
    parameters: 'PRECTOTCORR,T2M_MAX,T2M_MIN,RH2M',
    community: 'AG',
    longitude: CHENNAI_CENTER.lng.toString(),
    latitude: CHENNAI_CENTER.lat.toString(),
    start: isoToNasaDate(startDate),
    end: isoToNasaDate(endDate),
    format: 'JSON',
  });

  const response = await fetch(`${NASA_POWER_BASE}?${params}`);
  if (!response.ok) {
    throw new Error(`NASA POWER returned ${response.status}: ${await response.text()}`);
  }

  const data = await response.json();
  const properties = data.properties.parameter;

  const dates = Object.keys(properties.PRECTOTCORR);

  return dates
    .filter((d) => properties.PRECTOTCORR[d] !== -999) // -999 = missing data
    .map((d) => ({
      date: nasaDateToISO(d),
      precipitation_mm: properties.PRECTOTCORR[d],
      temp_max_c: properties.T2M_MAX[d],
      temp_min_c: properties.T2M_MIN[d],
      humidity_pct: properties.RH2M[d],
    }));
}
