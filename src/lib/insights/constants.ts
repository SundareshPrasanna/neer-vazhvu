/**
 * Shared threshold constants for the narrative / insights layer.
 * Keep all render thresholds here so the compute layer, copy templates,
 * and future tests stay in sync.
 */

// -- CityStory variant selection --
export const STORAGE_CRISIS_PCT = 25;
export const STORAGE_STRESS_PCT = 50;
export const STRESSED_WARDS_THRESHOLD = 30;
export const DECLINING_WARDS_THRESHOLD = 40;

// -- Connected insight render thresholds --
// Ward detail panel: show reservoir insight when reservoir sub-score is
// at least 60% of its 20-point max
export const RESERVOIR_COMPONENT_THRESHOLD = 12;
export const RESERVOIR_COMPONENT_MAX = 20;

// Water body detail panel: show river pollution insight when sub-score is
// at least ~56% of its 18-point max
export const RIVER_POLLUTION_COMPONENT_THRESHOLD = 10;
export const RIVER_POLLUTION_COMPONENT_MAX = 18;
