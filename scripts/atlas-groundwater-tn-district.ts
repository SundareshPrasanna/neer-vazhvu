/**
 * IN-GRES taluk groundwater assessment for one district, served as
 * public/data/atlas/<state>/<district>/groundwater-taluks.json.
 *
 *   npx tsx scripts/atlas-groundwater-tn-district.ts --district thanjavur --fetch --as-of 2026-09-01
 *   npx tsx scripts/atlas-groundwater-tn-district.ts --district thanjavur --replay
 *
 * Same endpoint and payload discriminators as the corridor producer
 * (getBusinessDataForUserOpen, parentuuid required, lowercase view). The
 * assessment units are revenue taluks: a Gram Panchayat only ever inherits
 * them as containing-area context, which atlas-project-groundwater.ts does.
 */
import { loadTnDistrictRefreshPlan } from "../src/lib/atlas/acquisition-validation";
import { validateLgdDistrictRefreshPlan, type LgdDistrictRefreshPlan } from "../src/lib/atlas/lgd-acquisition-model";
import { readFileSync } from "node:fs";
import {
  INDIA_LOCATION_UUID,
  INGRES_API_URL,
  buildTnDistrictGroundwaterExtract,
  summarizeGroundwater,
  validateTnDistrictGroundwaterExtract,
} from "../src/lib/atlas/tn-groundwater";
import type { TnDistrictGroundwaterExtract } from "../src/lib/atlas/tn-groundwater";
import {
  argValue,
  atlasEnvelope,
  cachePath,
  hasFlag,
  planIdentityAdapter,
  readCacheJson,
  requireAsOf,
  requireDistrict,
  reviewedInputPath,
  upstreamSource,
  writeAtlasArtifact,
  writeCache,
} from "./lib/atlas-producer";

const PRODUCED_BY = "scripts/atlas-groundwater-tn-district.ts";
const CACHE = "groundwater.json";

/** What IN-GRES needs from either plan shape. Tamil Nadu plans predate the
 *  state fields and read as TAMILNADU / TALUK; an LGD-built plan states its
 *  own (MAHARASHTRA / TALUKA). */
interface IngresPlan {
  id: string;
  districtName: string;
  stateUuid: string;
  stateName: string;
  unitType: string;
  upstream: "ingres" | "ingresMh";
}

function loadIngresPlan(district: ReturnType<typeof requireDistrict>): IngresPlan {
  const path = reviewedInputPath(district, "refresh-plan.json");
  if (planIdentityAdapter(district) === "lgd-directory") {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    const errors = validateLgdDistrictRefreshPlan(parsed);
    if (errors.length > 0) throw new Error(`Invalid LGD district refresh plan:\n- ${errors.join("\n- ")}`);
    const plan = parsed as LgdDistrictRefreshPlan;
    return {
      id: plan.id,
      districtName: plan.district.ingresDistrictName,
      stateUuid: plan.district.ingresStateUuid,
      stateName: plan.district.ingresStateName,
      unitType: plan.district.ingresAssessmentUnitType,
      upstream: "ingresMh",
    };
  }
  const plan = loadTnDistrictRefreshPlan(path);
  return {
    id: plan.id,
    districtName: plan.district.ingresDistrictName,
    stateUuid: plan.district.ingresStateUuid,
    stateName: "TAMILNADU",
    unitType: "TALUK",
    upstream: "ingres",
  };
}

/**
 * `parentLocName` is always INDIA and `stateuuid` is always null, even when
 * drilling into a district. `loctype` describes the level of `locuuid`, and
 * the response returns that level's children plus a synthetic total row.
 * Omitting `parentuuid` yields an all-null total and nothing else.
 */
async function readLevel(options: {
  locName: string;
  locType: string;
  locUuid: string;
  parentUuid: string;
  year: string;
}): Promise<Record<string, unknown>[]> {
  const response = await fetch(INGRES_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json, text/plain, */*",
      Origin: "https://ingres.iith.ac.in",
      Referer: "https://ingres.iith.ac.in/gecdataonline/gis",
      "User-Agent": "neer-vazhvu-atlas/0.1 (research; contact@neervazhvu.org)",
    },
    body: JSON.stringify({
      parentLocName: "INDIA",
      locname: options.locName,
      loctype: options.locType,
      view: "admin",
      locuuid: options.locUuid,
      year: options.year,
      computationType: "normal",
      component: "recharge",
      period: "annual",
      category: "safe",
      mapOnClickParams: "true",
      login: "true",
      stateuuid: null,
      verificationStatus: 1,
      approvalLevel: 1,
      parentuuid: options.parentUuid,
    }),
  });
  if (!response.ok) {
    throw new Error(`IN-GRES returned HTTP ${response.status}`);
  }
  const rows = (await response.json()) as Record<string, unknown>[];
  if (!Array.isArray(rows)) throw new Error("IN-GRES returned an unexpected shape");
  const named = rows.filter(
    (row) => String(row.locationName ?? "").trim().toLowerCase() !== "total",
  );
  if (named.length === 0) {
    throw new Error(
      `IN-GRES returned only a total row for ${options.locName}; the payload ` +
        "discriminator is wrong (parentuuid, lowercase view, or spaceless locname)",
    );
  }
  return rows;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const district = requireDistrict(argv);
  const fetchNow = hasFlag(argv, "--fetch");
  const replay = hasFlag(argv, "--replay");
  if (fetchNow === replay) throw new Error("choose exactly one of --fetch or --replay");
  const plan = loadIngresPlan(district);

  let groundwater: TnDistrictGroundwaterExtract;
  if (fetchNow) {
    const asOf = requireAsOf(argv);
    const year = argValue(argv, "--year") ?? "2024-2025";
    const districtName = plan.districtName;
    const stateRows = await readLevel({
      locName: plan.stateName,
      locType: "STATE",
      locUuid: plan.stateUuid,
      parentUuid: INDIA_LOCATION_UUID,
      year,
    });
    const districtRow = stateRows.find(
      (row) =>
        String(row.locationName ?? "").trim().toUpperCase() === districtName.toUpperCase(),
    );
    if (!districtRow) {
      throw new Error(
        `${districtName} is not among the ${stateRows.length - 1} districts ` +
          `IN-GRES reports for ${plan.stateName}`,
      );
    }
    const unitRows = await readLevel({
      locName: districtName,
      locType: "DISTRICT",
      locUuid: String(districtRow.locationUUID),
      parentUuid: plan.stateUuid,
      year,
    });
    groundwater = buildTnDistrictGroundwaterExtract({
      planId: plan.id,
      assessmentYear: year,
      acquiredAt: asOf,
      assessmentUnitType: plan.unitType,
      portalUrl:
        `https://ingres.iith.ac.in/gecdataonline/gis/INDIA;locname=${districtName}` +
        `;loctype=DISTRICT;locuuid=${String(districtRow.locationUUID)};year=${year}`,
      districtRow,
      unitRows,
    });
    writeCache(district, CACHE, groundwater);
  } else {
    const cached = readCacheJson<TnDistrictGroundwaterExtract>(district, CACHE);
    if (!cached) {
      throw new Error(`No cached IN-GRES extract at ${cachePath(district, CACHE)}; run --fetch`);
    }
    groundwater = cached;
  }
  if (groundwater.planId !== plan.id) {
    throw new Error(`extract is for ${groundwater.planId}, plan is ${plan.id}`);
  }
  const errors = validateTnDistrictGroundwaterExtract(groundwater);
  if (errors.length > 0) {
    throw new Error(`Invalid groundwater extract:\n- ${errors.join("\n- ")}`);
  }

  const envelope = atlasEnvelope({
    district,
    family: "groundwater-taluks",
    sources: [upstreamSource(plan.upstream, { retrieved: groundwater.acquiredAt })],
    method: "api",
    producedAt: groundwater.acquiredAt,
    producedBy: PRODUCED_BY,
    internalInputs: [],
    note:
      `IN-GRES dynamic groundwater assessment ${groundwater.assessmentYear} for ` +
      `${groundwater.district.locationName}: the district row and its ` +
      `${groundwater.recordCount} ${groundwater.source.assessmentUnitType} assessment units ` +
      "(category, stage of extraction, recharge, availability, rainfall), read from the " +
      "open getBusinessDataForUserOpen endpoint. The portal's synthetic total row is the " +
      "district figure and is not counted as a unit.",
    conventions: {
      assessment_year: `${groundwater.assessmentYear} is IN-GRES's hydrological-year label, not an edition year`,
      hierarchy: `assessment units sit on the revenue hierarchy (${groundwater.source.assessmentUnitType.toLowerCase()}s), not the panchayat hierarchy`,
      categories: "safe | semi_critical | critical | over_exploited | saline, spelled as the portal spells them",
      units: "stage of extraction in percent; recharge and availability in ham; rainfall in mm",
    },
  });
  const rel = writeAtlasArtifact(district, "groundwater-taluks", undefined, envelope, groundwater);
  const summary = summarizeGroundwater(groundwater);
  console.log(
    [
      `Wrote ${rel}`,
      `${groundwater.district.locationName}, ${groundwater.assessmentYear}: district ` +
        `${summary.districtCategory ?? "not stated"} at ${summary.districtStagePercent ?? "?"} percent`,
      `Assessment units (${groundwater.source.assessmentUnitType}): ${summary.assessmentUnits}; ` +
        Object.entries(summary.byCategory)
          .sort()
          .map(([category, count]) => `${category} ${count}`)
          .join(", "),
      summary.worst
        ? `Worst unit: ${summary.worst.locationName} at ${summary.worst.stageOfExtractionPercent} percent`
        : "No unit reports a stage of extraction",
    ].join("\n"),
  );
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
