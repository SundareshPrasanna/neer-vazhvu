/**
 * What a citizen can report: the single source for the capture tiles, the
 * submit validator, the review screen and routing. Keys are stored as text on
 * the row; a recurring "other" note becomes a type by adding it here.
 *
 * Scope: a report is about water at a place: a water body, public water
 * infrastructure, or the water that reaches people from public supply.
 * Out: tankers, bills, supply timings (they arrive as "other" and are counted).
 */

import type { Extent, SeenAt } from "./types";

export const AUTHORITY_ROLES = [
  "solid_waste",
  "sewerage",
  "water_supply",
  "storm_drainage",
  "water_body",
  "pollution_control",
  "land_revenue",
] as const;

export type AuthorityRole = (typeof AUTHORITY_ROLES)[number];

export interface ReportType {
  key: string;
  label: string;
  /** Overrides the group's role; null = recorded only, no body to send it to. */
  role?: AuthorityRole | null;
  /** Takes water-test values (src/lib/sightings/parameters.ts), checked against a photo of the meter or kit. */
  readings?: true;
  /** The places (What step, first screen) this type is offered under; one type can sit under several. */
  seenAt?: readonly SeenAt[];
  /** Shown before "More" for those places. */
  common?: true;
}

/** The What step's first question: where are you? Home first, then the kinds of public place. */
export const SEEN_AT: readonly { key: SeenAt; label: string; hint: string; icon: string }[] = [
  { key: "home", label: "At home", hint: "Your tap, well or borewell. Only the ward is shown, never your house.", icon: "Home" },
  { key: "lake", label: "Lake, pond or tank", hint: "The water, its bank or its bund", icon: "Waves" },
  { key: "river", label: "River, stream or canal", hint: "Flowing water and its banks", icon: "Waypoints" },
  { key: "drain", label: "Drain or nala", hint: "Open drains, manholes and sewers", icon: "Droplets" },
  { key: "street", label: "Street, public tap or pipe", hint: "Water supply, leaks and waterlogging", icon: "Wrench" },
];

/** "How much?", optional. */
export const EXTENTS: readonly { key: Extent; label: string }[] = [
  { key: "spot", label: "A small patch" },
  { key: "stretch", label: "Along a stretch" },
  { key: "widespread", label: "Across most of it" },
];

/** Where tap and drinking water comes from; asked for every report in that group. */
export const WATER_SOURCES = [
  { key: "piped", label: "Piped tap" },
  { key: "borewell", label: "Borewell" },
  { key: "open_well", label: "Open well" },
  { key: "handpump", label: "Handpump or public tap" },
] as const;

export type WaterSource = (typeof WATER_SOURCES)[number]["key"];

export interface ReportGroup {
  key: string;
  label: string;
  /** One line under the tile. */
  hint: string;
  /** lucide-react icon name, mapped in the UI. */
  icon: string;
  color: string;
  role: AuthorityRole | null;
  /** Shown publicly at ward / village level only, never the exact point. */
  private?: boolean;
  types: ReportType[];
}

/** The What step's places, as each type lists them. */
const H: readonly SeenAt[] = ["home"];
const L: readonly SeenAt[] = ["lake"];
const LR: readonly SeenAt[] = ["lake", "river"];
const LRD: readonly SeenAt[] = ["lake", "river", "drain"];
const DS: readonly SeenAt[] = ["drain", "street"];
const S: readonly SeenAt[] = ["street"];
const NONE: readonly SeenAt[] = [];

/** A type: its key (stored, never renamed), what a resident sees, where it is offered, and its role or "common". */
const t = (key: string, label: string, at: readonly SeenAt[], o: { role?: AuthorityRole | null; common?: true } = {}): ReportType => ({
  key,
  label,
  ...(o.role !== undefined && { role: o.role }),
  ...(at.length > 0 && { seenAt: at }),
  ...(o.common && { common: true as const }),
});
const COMMON = { common: true } as const;

/*
 * Labels say what a resident can see, never a cause they cannot confirm: nobody can tell sewage from factory waste by
 * looking, or a sewer from a storm drain. Group rules: Trash is something dumped; Sewage is water you can see flowing in
 * from somewhere; Water is how the water itself looks or smells; Pipes is something public that is broken. Moving a type
 * to another group would change its stored category, so drying up and the tank structures stay where they are and read
 * right under "Lake, pond or tank" by their labels.
 */
export const REPORT_GROUPS: readonly ReportGroup[] = [
  {
    key: "dumping",
    label: "Trash and dumping",
    hint: "Something dumped on a bank, in the water or in a drain",
    icon: "Trash2",
    color: "#b45309",
    role: "solid_waste",
    types: [
      t("garbage_on_bank", "Garbage dumped on the bank or in the water", LRD, COMMON),
      t("floating_trash", "Trash floating on the water", LRD),
      t("plastic_buildup", "Plastic piling up", LRD),
      t("cd_debris", "Debris dumped, a few loads", LRD, COMMON),
      t("hazardous_waste", "Drums, chemicals or medical waste dumped", LRD, { role: "pollution_control" }),
      t("open_burning", "Waste being burnt", LRD),
      t("immersion_residue", "Idols, flowers or ritual waste left in the water", LR),
      t("carcass_waste", "Dead animals dumped, or slaughter waste", LRD),
    ],
  },
  {
    key: "sewage",
    label: "Sewage and outflows",
    hint: "You can see where it comes from: a pipe, outlet, manhole or truck",
    icon: "Droplets",
    color: "#713f12",
    role: "sewerage",
    types: [
      t("sewage_inflow", "Dark, smelly water flowing in from a pipe or drain", LRD, COMMON),
      t("manhole_overflow", "Manhole overflowing (underground sewer)", DS, COMMON),
      t("broken_sewer", "Broken pipe leaking dirty, smelly water", DS),
      t("open_manhole", "Manhole open or its cover broken", DS, COMMON),
      t("septage_dumping", "Tanker truck emptying waste into the water or a drain", LRD),
      t("house_drain", "Pipes from houses or shops emptying into the water", LRD),
      t("effluent_discharge", "Coloured or foamy water flowing in from a pipe or outlet", LRD, { role: "pollution_control", common: true }),
    ],
  },
  {
    key: "surface",
    label: "How the water looks or smells",
    hint: "The water itself: its colour, foam, smell, weeds, fish or level",
    icon: "Waves",
    color: "#15803d",
    role: "water_body",
    types: [
      t("algae", "Water turned green, or green scum on top", LR, COMMON),
      t("weeds", "Weeds or water hyacinth covering the water", LR, COMMON),
      t("foam", "Foam or froth on the water", LRD),
      t("bad_smell", "Water smells bad", LRD),
      t("discolouration", "Water an unusual colour (black, red or milky)", LRD),
      t("oil_film", "Oily, rainbow sheen on the water", LRD, { role: "pollution_control" }),
      t("dead_fish", "Fish dying in the water", LR, { role: "pollution_control", common: true }),
      t("drying_up", "Drying up or very low water", LR, COMMON),
    ],
  },
  {
    key: "drinking",
    label: "Tap and drinking water",
    hint: "At home: water that looks, smells or tastes wrong, or a test result",
    icon: "GlassWater",
    color: "#0e7490",
    role: "water_supply",
    private: true,
    types: [
      t("dirty_tap_water", "Tap water looks muddy or coloured", H, COMMON),
      // One menu item; HOME_SMELLS asks which smell, and a sewage smell is sent as sewage_in_supply.
      t("smelly_tap_water", "Water smells or tastes bad", H, COMMON),
      t("sewage_in_supply", "Water smells like sewage or a drain", NONE),
      t("illness_suspected", "People fell ill after drinking the water", H, COMMON),
      t("public_source_unsafe", "Water from a public tap or handpump looks or smells wrong", H),
      t("borewell_quality", "Borewell water salty or coloured (no test)", H, { role: null }),
      { key: "water_test", label: "Water test results (TDS, fluoride and more)", role: null, readings: true, seenAt: H, common: true },
    ],
  },
  {
    key: "infrastructure",
    label: "Broken public pipes and taps",
    hint: "Something public is broken or leaking: a pipe, tap, tank or handpump",
    icon: "Wrench",
    color: "#0369a1",
    role: "water_supply",
    types: [
      t("pipeline_leak", "Water pipe burst or leaking", S, COMMON),
      t("public_tap_leak", "Public tap leaking or left running", S, COMMON),
      t("tank_overflow", "Public overhead tank overflowing", S),
      t("handpump_broken", "Public handpump or borewell not working", S, COMMON),
    ],
  },
  {
    key: "flooding",
    label: "Flooding and drains",
    hint: "Waterlogging, choked or overflowing drains, broken bunds and channels",
    icon: "CloudRain",
    color: "#4338ca",
    role: "storm_drainage",
    types: [
      t("waterlogging", "Road or area waterlogged", S, COMMON),
      t("drain_blocked", "Drain choked with garbage or silt", DS, COMMON),
      t("drain_overflow", "Open drain overflowing", DS, COMMON),
      t("bund_breach", "Bund or embankment broken", LR, { role: "water_body" }),
      t("inlet_blocked", "Channel feeding the lake or tank blocked", L, { role: "water_body" }),
      t("sluice_damaged", "Sluice gate or weir damaged", LR, { role: "water_body" }),
    ],
  },
  {
    key: "encroachment",
    label: "Building on or filling in",
    hint: "The water or its edge being built on, filled in or dug out",
    icon: "Construction",
    color: "#7c2d12",
    role: "land_revenue",
    types: [
      t("building_on_bed", "Building going up on the bed or bank", LRD),
      t("filling_in", "Being filled in to make land", LRD),
      t("bund_encroached", "Bund or edge fenced off or built on", L),
      t("sand_mining", "Sand or soil being dug out and taken away", LR),
      t("trees_cut", "Trees cut down at the edge", LR),
    ],
  },
  {
    // No places: the What step offers good news at every public place itself.
    key: "recovery",
    label: "Good news",
    hint: "Clean-ups, birds back, clear water",
    icon: "Sprout",
    color: "#0d9488",
    role: null,
    types: [
      t("cleanup", "Clean-up or desilting work", NONE),
      t("wildlife_back", "Birds or wildlife back", NONE),
      t("clear_water", "Clean, clear water", NONE),
      t("restoration_work", "New restoration or recharge work", NONE),
    ],
  },
];

/** Good news: offered at every public place by the What step, so no type lists places. */
export const GOOD_NEWS_KEY = "recovery";

/**
 * At home, "Water smells or tastes bad" asks which. A sewage or drain smell is sent as sewage in the supply; salty water
 * from one's own borewell or well as a borewell report (homeSmellType); every other answer as a bad smell or taste.
 */
export const HOME_SMELLS: readonly { key: string; label: string; subcategory: string }[] = [
  { key: "sewage", label: "Like sewage or a drain", subcategory: "sewage_in_supply" },
  { key: "chlorine", label: "Like bleach or chlorine", subcategory: "smelly_tap_water" },
  { key: "rotten_eggs", label: "Like rotten eggs", subcategory: "smelly_tap_water" },
  { key: "metal", label: "Like metal or rust", subcategory: "smelly_tap_water" },
  { key: "salty", label: "Salty", subcategory: "smelly_tap_water" },
  { key: "other", label: "Something else", subcategory: "smelly_tap_water" },
  { key: "unsure", label: "Not sure", subcategory: "smelly_tap_water" },
];

/** The type a home smell is sent as: salty well or borewell water is the ground's, not the supply's. Null for an unknown answer. */
export function homeSmellType(smell: string, source: WaterSource | null): string | null {
  const s = HOME_SMELLS.find((x) => x.key === smell);
  if (!s) return null;
  return s.key === "salty" && (source === "borewell" || source === "open_well") ? "borewell_quality" : s.subcategory;
}

/**
 * Types residents easily mix up at one spot: one issue holds them together, and a new report is matched against open
 * issues of any of them. Community types only; a type sits in one set at most.
 */
export const RELATED_TYPES: readonly (readonly string[])[] = [
  ["garbage_on_bank", "floating_trash", "plastic_buildup"],
  ["cd_debris", "filling_in"],
  ["sewage_inflow", "effluent_discharge", "discolouration", "foam"],
  ["manhole_overflow", "drain_overflow", "drain_blocked", "broken_sewer"],
  ["algae", "weeds"],
  ["building_on_bed", "bund_encroached"],
  ["pipeline_leak", "public_tap_leak"],
];

const RELATED_SET = new Map(RELATED_TYPES.flatMap((set, i) => set.map((k) => [k, i] as const)));

/** One key for a type and the types it is mixed up with; issues at a spot join on it. */
export function relatedKey(category: string, subcategory: string | null): string {
  const i = subcategory ? RELATED_SET.get(subcategory) : undefined;
  return i === undefined ? `${category}|${subcategory}` : `related:${i}`;
}

/** The type keys a report of this type may be the same thing as: itself and the ones it is mixed up with. */
export function relatedSubcategories(subcategory: string): readonly string[] {
  const i = RELATED_SET.get(subcategory);
  return i === undefined ? [subcategory] : RELATED_TYPES[i];
}

/**
 * The only types a group may hold a fix-it day (clean-up) for: litter and ritual waste on a bank, cleared from the bank.
 * Never sewage, drains, hazardous, medical or burning waste, dead animals or debris: unsafe for volunteers, and
 * manual scavenging is illegal in India.
 */
export const FIXIT_TYPES: ReadonlySet<string> = new Set(["garbage_on_bank", "floating_trash", "plastic_buildup", "immersion_residue"]);

/** Free text, reviewer-sorted: into an existing type or tagged as a candidate. */
export const OTHER_KEY = "other";

const GROUPS = new Map(REPORT_GROUPS.map((g) => [g.key, g]));

/** The types offered for a place, common ones first. Filled from each type's seenAt. */
export function typesFor(seenAt: SeenAt): { group: ReportGroup; type: ReportType }[] {
  const all = REPORT_GROUPS.flatMap((group) => group.types.filter((type) => type.seenAt?.includes(seenAt)).map((type) => ({ group, type })));
  return [...all.filter((x) => x.type.common), ...all.filter((x) => !x.type.common)];
}

export function getGroup(key: string): ReportGroup | undefined {
  return GROUPS.get(key);
}

export function getType(category: string, subcategory: string | null): ReportType | undefined {
  return subcategory ? GROUPS.get(category)?.types.find((x) => x.key === subcategory) : undefined;
}

/** Every non-other report names a type; "other" names none. */
export function isValidReport(category: string, subcategory: string | null): boolean {
  if (category === OTHER_KEY) return !subcategory;
  return getType(category, subcategory) !== undefined;
}

export function roleFor(category: string, subcategory: string | null): AuthorityRole | null {
  const type = getType(category, subcategory);
  if (type?.role !== undefined) return type.role;
  return GROUPS.get(category)?.role ?? null;
}

export function labelFor(category: string, subcategory: string | null): string {
  if (category === OTHER_KEY) return "Other";
  return getType(category, subcategory)?.label ?? GROUPS.get(category)?.label ?? category;
}

export function takesReadings(category: string, subcategory: string | null): boolean {
  return getType(category, subcategory)?.readings === true;
}

export function isPrivateCategory(category: string): boolean {
  return GROUPS.get(category)?.private === true;
}

/** Reports about a shared, public place: only these take anyone else's updates, "seen this too", thanks, help or clean-ups. */
export function isCommunityReport(category: string): boolean {
  return !isPrivateCategory(category);
}
