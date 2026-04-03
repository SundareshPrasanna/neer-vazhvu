/**
 * IUDX (India Urban Data Exchange) client for Chennai water level sensors.
 *
 * Auth flow: POST client credentials to cos.iudx.org.in/auth/v1/token
 * Data flow: GET latest readings from rs.cos.iudx.org.in/ngsi-ld/v1/entities
 *
 * Resource group: 257aab1b-1258-445a-a37e-058486a2fa13
 * 241 sensors: canals (29), subways (27), lakes (5), rivers (5), others
 */

const AUTH_URL = "https://cos.iudx.org.in/auth/v1/token";
const RS_URL = "https://rs.cos.iudx.org.in/ngsi-ld/v1/entities";
const RESOURCE_GROUP_ID = "257aab1b-1258-445a-a37e-058486a2fa13";

// Token cache - tokens are typically valid for ~24 hours
let cachedToken: { token: string; expiresAt: number } | null = null;

export interface IudxWaterReading {
  id: string;
  label: string;
  waterLevel: number; // cm
  observationDateTime: string; // ISO 8601
}

/**
 * Get a valid IUDX access token, using cache if available.
 */
async function getToken(): Promise<string> {
  // Return cached token if still valid (with 5 min buffer)
  if (cachedToken && cachedToken.expiresAt > Date.now() + 5 * 60 * 1000) {
    return cachedToken.token;
  }

  const clientId = process.env.IUDX_CLIENT_ID;
  const clientSecret = process.env.IUDX_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("IUDX_CLIENT_ID and IUDX_CLIENT_SECRET must be set");
  }

  const res = await fetch(AUTH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Basic " + Buffer.from(`${clientId}:${clientSecret}`).toString("base64"),
    },
    body: JSON.stringify({
      itemId: RESOURCE_GROUP_ID,
      itemType: "resource_group",
      role: "consumer",
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`IUDX auth failed (${res.status}): ${body}`);
  }

  const data = await res.json();
  const token = data.results?.accessToken ?? data.results?.access_token;
  if (!token) {
    throw new Error("No access token in IUDX auth response");
  }

  // Cache for 23 hours (tokens are typically valid 24h)
  cachedToken = {
    token,
    expiresAt: Date.now() + 23 * 60 * 60 * 1000,
  };

  return token;
}

/**
 * Fetch latest water level readings for all sensors in the resource group.
 */
export async function fetchLatestReadings(): Promise<IudxWaterReading[]> {
  const token = await getToken();

  const res = await fetch(
    `${RS_URL}?type=${encodeURIComponent(RESOURCE_GROUP_ID)}&attrs=id,observationDateTime,waterLevel`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
      next: { revalidate: 300 }, // Cache for 5 minutes
    }
  );

  if (!res.ok) {
    // If unauthorized, clear cached token and retry once
    if (res.status === 401) {
      cachedToken = null;
      const newToken = await getToken();
      const retry = await fetch(
        `${RS_URL}?type=${encodeURIComponent(RESOURCE_GROUP_ID)}&attrs=id,observationDateTime,waterLevel`,
        {
          headers: {
            Authorization: `Bearer ${newToken}`,
            Accept: "application/json",
          },
        }
      );
      if (!retry.ok) {
        throw new Error(`IUDX RS retry failed (${retry.status})`);
      }
      const retryData = await retry.json();
      return parseReadings(retryData);
    }
    throw new Error(`IUDX RS failed (${res.status})`);
  }

  const data = await res.json();
  return parseReadings(data);
}

function parseReadings(data: Record<string, unknown>): IudxWaterReading[] {
  const results = (data.results ?? data) as Record<string, unknown>[];
  if (!Array.isArray(results)) return [];

  return results
    .filter((r) => r.waterLevel != null && r.observationDateTime != null)
    .map((r) => ({
      id: String(r.id ?? ""),
      label: String(r.label ?? r.name ?? r.id ?? ""),
      waterLevel: Number(r.waterLevel),
      observationDateTime: String(r.observationDateTime),
    }));
}

/**
 * Check if IUDX credentials are configured.
 */
export function isIudxConfigured(): boolean {
  return !!(process.env.IUDX_CLIENT_ID && process.env.IUDX_CLIENT_SECRET);
}
