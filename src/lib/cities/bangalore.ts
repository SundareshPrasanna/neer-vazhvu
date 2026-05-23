import type { CityConfig } from './types';

// Bangalore is registered but DISABLED until M1 data ingestion + M2 UI land.
// `enabled: false` keeps the city out of listEnabledPlaces(), the URL
// parser's knownCityIds set, the city switcher, and the [cityId] route
// guard (which 404s any non-enabled city in src/app/[cityId]/layout.tsx).
//
// waterSources is intentionally empty: Bangalore's supply is pumped from
// the Cauvery 95+ km away (BWSSB Stages I-V) plus local groundwater.
// There are no Chennai-style local reservoirs that ARE the urban tap
// supply. The eventual hero will lead with Cauvery pumping reliability,
// tanker dependence, and groundwater stress, not days-left math. Adding
// placeholder reservoirs here would imply a Chennai-shaped supply model.
//
// Ward count is the post-15-May-2025 GBA delimitation (369 wards across
// 5 City Corporations, notified 19 Nov 2025).
export const BANGALORE: CityConfig = {
  cityId: 'bangalore',
  displayName: 'Bengaluru',
  displayNameLocalized: { kn: 'ಬೆಂಗಳೂರು' },
  stateCode: 'KA',
  timezone: 'Asia/Kolkata',
  center: { lat: 12.9716, lng: 77.5946 },
  bbox: { south: 12.83, north: 13.18, west: 77.40, east: 77.78 },
  primaryAuthority: {
    code: 'bwssb',
    name: 'Bangalore Water Supply and Sewerage Board',
    acronym: 'BWSSB',
  },
  localGovernment: {
    code: 'gba',
    name: 'Greater Bengaluru Authority',
    acronym: 'GBA',
    wardCount: 369,
  },
  defaultConsumptionMld: 1450,
  defaultDesalinationMld: null,
  availableLanguages: ['en', 'kn'],
  heroMode: 'none',
  waterSources: [],
  sourceNameAliases: {},
  enabled: false,
};
