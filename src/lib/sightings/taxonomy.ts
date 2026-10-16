/**
 * What a citizen can report: the single source for the capture tiles, the
 * submit validator, the review screen and routing. Keys are stored as text on
 * the row; a recurring "other" note becomes a type by adding it here.
 *
 * Scope: a report is about water at a place: a water body, public water
 * infrastructure, or the water that reaches people from public supply.
 * Out: tankers, bills, supply timings (they arrive as "other" and are counted).
 */

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
}

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

const t = (key: string, label: string, role?: AuthorityRole | null): ReportType =>
  role === undefined ? { key, label } : { key, label, role };

export const REPORT_GROUPS: readonly ReportGroup[] = [
  {
    key: "dumping",
    label: "Trash & dumping",
    hint: "Garbage, plastic or debris on a bank or in water",
    icon: "Trash2",
    color: "#b45309",
    role: "solid_waste",
    types: [
      t("garbage_on_bank", "Garbage on the bank or in the water"),
      t("floating_trash", "Trash floating on the water"),
      t("plastic_buildup", "Plastic piling up"),
      t("cd_debris", "Construction or demolition debris"),
      t("hazardous_waste", "Industrial, hazardous or medical waste", "pollution_control"),
      t("open_burning", "Waste being burnt"),
      t("immersion_residue", "Idol-immersion or ritual waste"),
      t("carcass_waste", "Dead animals or slaughter waste"),
    ],
  },
  {
    key: "sewage",
    label: "Sewage & effluent",
    hint: "Sewage or factory discharge reaching water",
    icon: "Droplets",
    color: "#713f12",
    role: "sewerage",
    types: [
      t("sewage_inflow", "Sewage flowing into a lake, river or canal"),
      t("manhole_overflow", "Manhole overflowing"),
      t("broken_sewer", "Broken sewer line"),
      t("open_manhole", "Open or broken manhole cover"),
      t("septage_dumping", "Septic-tank waste dumped from a truck"),
      t("house_drain", "House drain straight into water"),
      t("effluent_discharge", "Industrial or coloured discharge", "pollution_control"),
    ],
  },
  {
    key: "surface",
    label: "Water looks or smells wrong",
    hint: "Algae, weeds, foam, colour, smell or dead fish",
    icon: "Waves",
    color: "#15803d",
    role: "water_body",
    types: [
      t("algae", "Green water or algae"),
      t("weeds", "Weeds or hyacinth covering the water"),
      t("foam", "Froth or foam"),
      t("bad_smell", "Strong smell"),
      t("discolouration", "Unusual colour"),
      t("oil_film", "Oil film on the water", "pollution_control"),
      t("dead_fish", "Dead fish", "pollution_control"),
      t("drying_up", "Drying up or very low water"),
    ],
  },
  {
    key: "drinking",
    label: "Tap & drinking water",
    hint: "Dirty, smelly or unsafe water from a tap or handpump",
    icon: "GlassWater",
    color: "#0e7490",
    role: "water_supply",
    private: true,
    types: [
      t("dirty_tap_water", "Muddy or coloured tap water"),
      t("smelly_tap_water", "Bad smell or taste"),
      t("sewage_in_supply", "Sewage mixing into the supply"),
      t("illness_suspected", "People falling ill, water suspected"),
      t("public_source_unsafe", "Public tap or handpump water unsafe"),
      t("borewell_quality", "Borewell water salty or coloured", null),
      { key: "water_test", label: "Water test results (TDS, fluoride and more)", role: null, readings: true },
    ],
  },
  {
    key: "infrastructure",
    label: "Pipes, taps & tanks",
    hint: "Leaks and breakdowns of public water infrastructure",
    icon: "Wrench",
    color: "#0369a1",
    role: "water_supply",
    types: [
      t("pipeline_leak", "Burst or leaking pipeline"),
      t("public_tap_leak", "Public tap or standpipe leaking"),
      t("tank_overflow", "Overhead tank overflowing"),
      t("handpump_broken", "Public handpump or borewell broken"),
    ],
  },
  {
    key: "flooding",
    label: "Flooding & drains",
    hint: "Waterlogging, blocked drains, breached bunds",
    icon: "CloudRain",
    color: "#4338ca",
    role: "storm_drainage",
    types: [
      t("waterlogging", "Waterlogged road or area"),
      t("drain_blocked", "Drain blocked by garbage or silt"),
      t("drain_overflow", "Drain overflowing"),
      t("bund_breach", "Bund or embankment breached", "water_body"),
      t("inlet_blocked", "Inlet or supply channel of a tank blocked", "water_body"),
      t("sluice_damaged", "Damaged sluice or weir", "water_body"),
    ],
  },
  {
    key: "encroachment",
    label: "Encroachment & land",
    hint: "Building on, filling in or mining a water body",
    icon: "Construction",
    color: "#7c2d12",
    role: "land_revenue",
    types: [
      t("building_on_bed", "Building on the bed, bank or buffer"),
      t("filling_in", "Water body being filled in"),
      t("bund_encroached", "Bund or boundary encroached"),
      t("sand_mining", "Sand mining in a river or tank"),
      t("trees_cut", "Trees cut at the edge"),
    ],
  },
  {
    key: "recovery",
    label: "Good news",
    hint: "Cleanups, birds back, clear water",
    icon: "Sprout",
    color: "#0d9488",
    role: null,
    types: [
      t("cleanup", "Cleanup or desilting work"),
      t("wildlife_back", "Birds or wildlife back"),
      t("clear_water", "Clean, clear water"),
      t("restoration_work", "New restoration or recharge work"),
    ],
  },
];

/** Free text, reviewer-sorted: into an existing type or tagged as a candidate. */
export const OTHER_KEY = "other";

const GROUPS = new Map(REPORT_GROUPS.map((g) => [g.key, g]));

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
