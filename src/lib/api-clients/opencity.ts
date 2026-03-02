const CKAN_BASE = 'https://data.opencity.in/api/3/action/datastore_search';

/** Known OpenCity CKAN resource IDs for Chennai water data */
export const OPENCITY_RESOURCES = {
  lakes: {
    poondi: '8b0c0edc-4204-4f0f-8dc7-2db4817af04f',
    cholavaram: '20dc9876-ef1d-4cf1-9c42-f9d6c1f137db',
    redhills: 'febf2951-71eb-4807-9a06-246dadc1ef04',
    chembarambakkam: 'db41b1a4-5746-46d0-a006-e8fe2b1545a9',
    veeranam: 'a2f9aaad-7ac2-4a01-90d6-801eeef7d4b6',
    kannankottai: 'e0355257-d2d9-48be-a31e-6596a5fcdc07',
  },
  groundwater: {
    2021: '61ef9b4e-feae-4e73-b503-aa2cba9eda50',
    2022: '0e44c0a9-4965-4385-8988-ff4ed6f7534c',
    2023: '2ccf989b-a340-4c49-8264-80a0b60717aa',
    2024: '3a41ca9e-dbe1-495a-9ee3-c14aeaa988c6',
  },
  wardMap: 'e90176d4-319a-45bd-918e-ecce4f048c4d',
} as const;

interface CKANResponse<T> {
  success: boolean;
  result: {
    records: T[];
    total: number;
  };
}

/**
 * Fetches records from an OpenCity CKAN datastore resource.
 * Handles pagination automatically.
 */
export async function fetchCKANResource<T>(
  resourceId: string,
  limit = 5000,
  offset = 0
): Promise<T[]> {
  const url = `${CKAN_BASE}?resource_id=${resourceId}&limit=${limit}&offset=${offset}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`OpenCity CKAN returned ${response.status}`);
  }

  const data: CKANResponse<T> = await response.json();
  if (!data.success) {
    throw new Error('OpenCity CKAN returned success=false');
  }

  const records = data.result.records;

  // If we got a full page, there might be more
  if (records.length === limit) {
    const moreRecords = await fetchCKANResource<T>(resourceId, limit, offset + limit);
    return [...records, ...moreRecords];
  }

  return records;
}
