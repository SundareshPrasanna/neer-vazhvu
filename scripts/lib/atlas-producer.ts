/**
 * Shared plumbing for the Atlas producers (scripts/atlas-*.ts).
 *
 * Every Atlas artifact is written here with a complete NVDM envelope the
 * producer composes itself (the compute-*-ward-profiles pattern), never
 * through a bare writeFileSync in the producer: scripts/check-generator-drift.py
 * treats a wholesale write in a producer as an envelope wipe. Licences come
 * from the Headwaters registry via registryLicense(), so a producer never
 * holds a second copy of a fact the registry owns.
 *
 * Raw upstream responses and producer intermediates live under
 * .cache/atlas/<state>/<district>/ (gitignored). Reviewed inputs a person
 * maintains (refresh plan, crosswalk resolution, block alignment) live under
 * pipeline-inputs/atlas/<state>/<district>/.
 */
import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";

import { ATLAS_DISTRICTS, type AtlasDistrict } from "../../src/lib/atlas/registry";
import {
  districtArtifactPath,
  districtDataDir,
  type AtlasEnvelope,
  type AtlasEnvelopeSource,
  type AtlasFamily,
} from "../../src/lib/atlas/artifacts";
import { registryLicense } from "./registry-contract";

export const ROOT = resolve(__dirname, "../..");

/* ── CLI ───────────────────────────────────────────────────────────────── */

export function argValue(argv: string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = argv[index + 1];
  if (value === undefined || value.startsWith("--")) {
    throw new Error(`${flag} requires a value`);
  }
  return value;
}

export function hasFlag(argv: string[], flag: string): boolean {
  return argv.includes(flag);
}

export function requireDistrict(argv: string[]): AtlasDistrict {
  const slug = argValue(argv, "--district");
  if (!slug) {
    throw new Error(
      `--district is required (one of ${ATLAS_DISTRICTS.map((d) => d.slug).join(", ")})`,
    );
  }
  const district = ATLAS_DISTRICTS.find((d) => d.slug === slug);
  if (!district) {
    throw new Error(
      `Unknown district ${slug}; registered: ${ATLAS_DISTRICTS.map((d) => d.slug).join(", ")}`,
    );
  }
  return district;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** The acquisition date recorded as produced_at. Never the wall clock: a
 *  producer that stamps today's date makes identical inputs produce a diff. */
export function requireAsOf(argv: string[]): string {
  const asOf = argValue(argv, "--as-of");
  if (!asOf || !DATE.test(asOf)) throw new Error("--as-of YYYY-MM-DD is required");
  return asOf;
}

/* ── paths ─────────────────────────────────────────────────────────────── */

export function reviewedInputPath(district: AtlasDistrict, name: string): string {
  return resolve(
    ROOT,
    "pipeline-inputs/atlas",
    district.stateSlug,
    district.slug,
    name,
  );
}

export function cacheDir(district: AtlasDistrict): string {
  return resolve(ROOT, ".cache/atlas", district.stateSlug, district.slug);
}

export function cachePath(district: AtlasDistrict, name: string): string {
  return resolve(cacheDir(district), name);
}

export function readCacheJson<T>(district: AtlasDistrict, name: string): T | undefined {
  const path = cachePath(district, name);
  if (!existsSync(path)) return undefined;
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function readCacheText(district: AtlasDistrict, name: string): string | undefined {
  const path = cachePath(district, name);
  if (!existsSync(path)) return undefined;
  return readFileSync(path, "utf8");
}

export function writeCache(district: AtlasDistrict, name: string, body: string | object): string {
  const path = cachePath(district, name);
  mkdirSync(dirname(path), { recursive: true });
  const text = typeof body === "string" ? body : `${JSON.stringify(body, null, 2)}\n`;
  writeFileSync(path, text, "utf8");
  return path;
}

export function artifactPath(
  district: AtlasDistrict,
  family: AtlasFamily,
  shard?: string,
): string {
  return resolve(ROOT, districtArtifactPath(district, family, shard));
}

export function readArtifact<T>(
  district: AtlasDistrict,
  family: AtlasFamily,
  shard?: string,
): T {
  const path = artifactPath(district, family, shard);
  if (!existsSync(path)) {
    throw new Error(
      `${districtArtifactPath(district, family, shard)} is not present; run its producer first`,
    );
  }
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function artifactExists(
  district: AtlasDistrict,
  family: AtlasFamily,
  shard?: string,
): boolean {
  return existsSync(artifactPath(district, family, shard));
}

/** Block codes for which a sharded family currently has a file. */
export function shardCodes(district: AtlasDistrict, family: AtlasFamily): string[] {
  const dir = resolve(ROOT, districtDataDir(district), family);
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => /\.(geo)?json$/.test(name))
    .map((name) => name.replace(/\.(geo)?json$/, ""))
    .sort();
}

/* ── envelope ──────────────────────────────────────────────────────────── */

export interface RegisteredSourceSpec {
  id: string;
  title: string;
  publisher: string;
  url?: string;
  role?: "asserts" | "input" | "methodology";
  as_of?: string;
  retrieved?: string;
}

/** A provenance source for a registered upstream. The licence is read from
 *  the registry so the envelope mirrors it verbatim (validate_nvdm.py demotes
 *  an envelope whose inline licence disagrees). */
export function registeredSource(spec: RegisteredSourceSpec): AtlasEnvelopeSource {
  const source: AtlasEnvelopeSource = {
    id: spec.id,
    title: spec.title,
    publisher: spec.publisher,
    license: registryLicense(spec.id),
    role: spec.role ?? "asserts",
  };
  if (spec.url) source.url = spec.url;
  if (spec.as_of) source.as_of = spec.as_of;
  if (spec.retrieved) source.retrieved = spec.retrieved;
  return source;
}

export interface EnvelopeOptions {
  district: AtlasDistrict;
  family: AtlasFamily;
  sources: AtlasEnvelopeSource[];
  method: AtlasEnvelope["provenance"]["method"];
  producedAt: string;
  producedBy: string;
  note: string | string[];
  /** Repo-relative paths of served artifacts this one is derived from.
   *  Always declared, explicitly [] when none: the conformance ladder taints
   *  a derived or mixed artifact that stays silent about its lineage. */
  internalInputs: string[];
  conventions?: Record<string, unknown>;
  projection?: AtlasEnvelope["projection"];
}

export function atlasEnvelope(options: EnvelopeOptions): AtlasEnvelope {
  if (!DATE.test(options.producedAt)) {
    throw new Error(`produced_at must be YYYY-MM-DD, got ${options.producedAt}`);
  }
  const envelope: AtlasEnvelope = {
    nvdm: "1.0",
    dataset: `atlas/${options.family}`,
    scope: { kind: "district", id: options.district.scopeId },
    provenance: {
      sources: options.sources,
      method: options.method,
      produced_at: options.producedAt,
      produced_by: options.producedBy,
      internal_inputs: options.internalInputs,
      note: options.note,
      ...(options.conventions ? { conventions: options.conventions } : {}),
    },
  };
  if (options.projection) envelope.projection = options.projection;
  return envelope;
}

/**
 * Write one artifact: envelope first, then the payload. The payload may not
 * carry an envelope key of its own - a producer that smuggles `provenance`
 * into its payload would shadow the real one.
 */
export function writeAtlasArtifact(
  district: AtlasDistrict,
  family: AtlasFamily,
  shard: string | undefined,
  envelope: AtlasEnvelope,
  payload: object,
  options: {
    /** Geometry-heavy families (served polygons) are written without
     *  indentation: pretty-printing puts every coordinate on its own line and
     *  quadruples the file. Everything else stays readable in a diff. */
    compact?: boolean;
  } = {},
): string {
  for (const key of Object.keys(payload)) {
    if (key in envelope) {
      throw new Error(`payload key ${key} collides with the envelope`);
    }
  }
  const rel = districtArtifactPath(district, family, shard);
  const path = resolve(ROOT, rel);
  mkdirSync(dirname(path), { recursive: true });
  const body = { ...envelope, ...payload };
  writeFileSync(path, `${options.compact ? JSON.stringify(body) : JSON.stringify(body, null, 2)}\n`, "utf8");
  return rel;
}

/** Remove shard files a regeneration did not write, so a district whose
 *  block list shrank does not keep serving a stale block. */
export function pruneShards(
  district: AtlasDistrict,
  family: AtlasFamily,
  written: Set<string>,
): string[] {
  const removed: string[] = [];
  for (const code of shardCodes(district, family)) {
    if (written.has(code)) continue;
    unlinkSync(artifactPath(district, family, code));
    removed.push(code);
  }
  return removed;
}

/* ── TNGIS WFS ─────────────────────────────────────────────────────────── */

export const TNGIS_WFS_BASE = "https://tngis.tn.gov.in/tngismaps/ows";

export function wfsRequestUrl(layer: string, cqlFilter: string): string {
  const params = new URLSearchParams({
    service: "WFS",
    version: "2.0.0",
    request: "GetFeature",
    typeNames: layer,
    CQL_FILTER: cqlFilter,
    outputFormat: "application/json",
  });
  return `${TNGIS_WFS_BASE}?${params.toString()}`;
}

export interface WfsSnapshot {
  body: string;
  url: string;
  sha256: string;
  /** When the cached body was fetched; a snapshot with no record of that is
   *  refused rather than dated by guesswork. */
  retrievedAt: string;
}

/**
 * Read a WFS layer for a district, from the cache unless --fetch was given.
 * The raw body is cached verbatim beside a sidecar recording when and from
 * where it was fetched, so a replay reproduces the same digest and the same
 * vintage.
 */
export async function readWfsSnapshot(options: {
  district: AtlasDistrict;
  cacheName: string;
  layer: string;
  cqlFilter: string;
  fetchNow: boolean;
  /** Required with fetchNow: the acquisition date recorded in the sidecar. */
  retrievedAt?: string;
}): Promise<WfsSnapshot> {
  const url = wfsRequestUrl(options.layer, options.cqlFilter);
  const metaName = options.cacheName.replace(/\.json$/, "") + ".meta.json";
  if (!options.fetchNow) {
    const body = readCacheText(options.district, options.cacheName);
    const meta = readCacheJson<{ retrievedAt: string; url: string }>(
      options.district,
      metaName,
    );
    if (body === undefined || meta === undefined) {
      throw new Error(
        `No cached ${options.layer} response (with its .meta.json) at ` +
          `${cachePath(options.district, options.cacheName)}; re-run with --fetch`,
      );
    }
    return { body, url: meta.url, sha256: sha256Hex(body), retrievedAt: meta.retrievedAt };
  }
  if (!options.retrievedAt || !DATE.test(options.retrievedAt)) {
    throw new Error("a WFS fetch needs --as-of to date the snapshot");
  }
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`TNGIS WFS returned HTTP ${response.status}`);
  const body = await response.text();
  writeCache(options.district, options.cacheName, body);
  writeCache(options.district, metaName, {
    url,
    layer: options.layer,
    retrievedAt: options.retrievedAt,
    sha256: sha256Hex(body),
  });
  return { body, url, sha256: sha256Hex(body), retrievedAt: options.retrievedAt };
}

export function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/* ── upstream sources every Atlas producer may cite ────────────────────── */

export const SOURCE_IDS = {
  tnrdLgd: "tnrd-lgd-directory-2021",
  tnrdMaster: "tnrd-panchayat-master",
  jjm: "jjm-imis-citizen-corner",
  census: "census-2011-village-amenities",
  tngisWaterBodies: "tngis-generic-viewer-water-bodies",
  tngisBoundary: "tngis-tnrd-panchayat-boundary",
  ingres: "ingres-gw-assessment-tn",
  openMeteo: "open-meteo-archive",
  // Districts built from the Local Government Directory (Maharashtra first).
  lgdLocalBodies: "lgd-local-bodies-datagovin",
  lgdVillages: "lgd-villages-datagovin",
  lgdSubdistricts: "lgd-subdistricts-datagovin",
  censusMh: "census-2011-village-amenities-mh",
  datameetMh: "datameet-village-boundaries-mh",
  ingresMh: "ingres-groundwater-maharashtra",
  waterBodiesCensusMh: "water-bodies-census-mh",
  mpcbEnvironmentPlans: "mpcb-district-environment-plans",
  // Tamil Nadu has no state listing: each collectorate publishes its own plan.
  ngtDepTnNamakkal: "ngt-dep-tn-namakkal",
  ngtDepTnKarur: "ngt-dep-tn-karur",
} as const;

export type UpstreamKey = keyof typeof SOURCE_IDS;

const UPSTREAMS: Record<UpstreamKey, Omit<RegisteredSourceSpec, "id" | "role" | "as_of" | "retrieved">> = {
  tnrdLgd: {
    title: "TNRD village panchayat directory with LGD codes (village_eng.pdf, 2021 edition)",
    publisher: "Rural Development and Panchayat Raj Department, Government of Tamil Nadu",
    url: "https://www.tnrd.tn.gov.in/pdf/village_eng.pdf",
  },
  tnrdMaster: {
    title: "TNRD current village panchayat master (vptax public dues enquiry)",
    publisher: "Rural Development and Panchayat Raj Department, Government of Tamil Nadu",
    url: "https://vptax.tnrd.tn.gov.in/project/forms/VillagePanchayatMaster/check_dues_public.php",
  },
  jjm: {
    title: "Jal Jeevan Mission IMIS citizen corner: village information (habitations, sources, sample tests)",
    publisher: "Department of Drinking Water and Sanitation, Ministry of Jal Shakti (JJM IMIS)",
    url: "https://ejalshakti.gov.in/jjm/citizen_corner/villageinformation.aspx",
  },
  census: {
    title: "Census of India 2011 District Census Handbook: village amenities (Tamil Nadu village release)",
    publisher: "Office of the Registrar General and Census Commissioner, India",
    url: "https://censusindia.gov.in/nada/index.php/catalog/45377",
  },
  tngisWaterBodies: {
    title: "TNGIS generic viewer: all water bodies (WFS layer generic_viewer:all_water_bodies)",
    publisher: "Tamil Nadu e-Governance Agency (TNGIS)",
    url: "https://tngis.tn.gov.in/tngismaps/ows",
  },
  tngisBoundary: {
    title: "TNGIS TNRD panchayat boundary and revenue taluk boundary (WFS layers tnrd:panchayat_boundary, admin_master:administrative_boundary_taluk)",
    publisher: "Tamil Nadu e-Governance Agency (TNGIS)",
    url: "https://tngis.tn.gov.in/tngismaps/ows",
  },
  ingres: {
    title: "IN-GRES dynamic groundwater resource assessment, Tamil Nadu taluks",
    publisher: "CGWB / IIT-Hyderabad (IN-GRES)",
    url: "https://ingres.iith.ac.in/",
  },
  openMeteo: {
    title: "Open-Meteo daily precipitation (forecast past_days and ERA5 archive)",
    publisher: "Open-Meteo",
    url: "https://open-meteo.com/",
  },
  lgdLocalBodies: {
    title: "Local Government Directory: local bodies with the villages they cover (data.gov.in resource 1a6c26ed)",
    publisher: "Ministry of Panchayati Raj, Government of India, via the Open Government Data Platform",
    url: "https://data.gov.in/catalog/local-government-directory-lgd",
  },
  lgdVillages: {
    title: "Local Government Directory: villages with Census 2011 codes (data.gov.in resource c967fe8f)",
    publisher: "Ministry of Panchayati Raj, Government of India, via the Open Government Data Platform",
    url: "https://data.gov.in/catalog/local-government-directory-lgd",
  },
  lgdSubdistricts: {
    title: "Local Government Directory: sub-districts (data.gov.in resource 6be51a29)",
    publisher: "Ministry of Panchayati Raj, Government of India, via the Open Government Data Platform",
    url: "https://data.gov.in/catalog/local-government-directory-lgd",
  },
  censusMh: {
    title: "Census of India 2011 District Census Handbook: village amenities (Maharashtra village release)",
    publisher: "Office of the Registrar General and Census Commissioner, India",
    url: "https://censusindia.gov.in/nada/index.php/catalog/828",
  },
  datameetMh: {
    title: "DataMeet indian_village_boundaries, Maharashtra (mh2.geojson with the mh.csv 2001-to-2011 crosswalk)",
    publisher: "DataMeet community",
    url: "https://github.com/datameet/indian_village_boundaries",
  },
  ingresMh: {
    title: "IN-GRES dynamic groundwater resource assessment, Maharashtra talukas",
    publisher: "CGWB / IIT-Hyderabad (IN-GRES)",
    url: "https://ingres.iith.ac.in/",
  },
  waterBodiesCensusMh: {
    title: "First Census of Water Bodies, Maharashtra state return (data.gov.in resource e1874d07)",
    publisher: "Department of Water Resources, River Development and Ganga Rejuvenation, Ministry of Jal Shakti, via the Open Government Data Platform",
    url: "https://data.gov.in/resource/state-wise-data-first-census-water-bodies-maharashtra",
  },
  mpcbEnvironmentPlans: {
    title: "MPCB: State Environment Plan and District Environment Plans (district plans on the CPCB model, NGT O.A. 360 of 2018)",
    publisher: "Maharashtra Pollution Control Board with the Environment Department, Government of Maharashtra",
    url: "https://mpcb.gov.in/en/state-environment-plan-and-district-environment-plan",
  },
  ngtDepTnNamakkal: {
    title: "District Environmental Plan, Namakkal District (CPCB model plan under the NGT's district environment plan directions, November 2019)",
    publisher: "District Collector, Namakkal, with the Tamil Nadu Pollution Control Board",
    url: "https://namakkal.nic.in/document/district-environment-plan-namakkal-district/",
  },
  ngtDepTnKarur: {
    title: "District Environmental Plan, Karur District (CPCB model plan under the NGT's district environment plan directions, November 2019)",
    publisher: "District Collector, Karur, with the Tamil Nadu Pollution Control Board",
    url: "https://karur.nic.in/departments/the-tamil-nadu-pollution-control-board-karur/",
  },
};

/* ── which adapter built a district ────────────────────────────────────── */

export type PlanIdentityAdapter = "tnrd" | "lgd-directory";

/** Read from the reviewed plan, so a producer that must branch by adapter
 *  (groundwater unit type, projection method, boundary source) asks the plan
 *  rather than guessing from the state slug. Absent field = TNRD. */
export function planIdentityAdapter(district: AtlasDistrict): PlanIdentityAdapter {
  const path = reviewedInputPath(district, "refresh-plan.json");
  if (!existsSync(path)) {
    throw new Error(`${district.slug}: no reviewed refresh plan at ${path}`);
  }
  const plan = JSON.parse(readFileSync(path, "utf8")) as { identityAdapter?: string };
  return plan.identityAdapter === "lgd-directory" ? "lgd-directory" : "tnrd";
}

export function upstreamSource(
  key: UpstreamKey,
  extra: { role?: "asserts" | "input" | "methodology"; as_of?: string; retrieved?: string } = {},
): AtlasEnvelopeSource {
  return registeredSource({ id: SOURCE_IDS[key], ...UPSTREAMS[key], ...extra });
}

/** The published TNRD PDF's own creation date, the stable-code edition. */
export const TNRD_LGD_EDITION = "2021-03-11";
