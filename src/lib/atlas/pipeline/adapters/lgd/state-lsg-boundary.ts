/**
 * Gram Panchayat polygons from a state's own local-body boundary layer, for
 * a state whose Panchayats are not unions of Census villages (Kerala: a
 * revenue village is often split between Panchayats, so the DataMeet union
 * would not be the Panchayat). Kerala's layer is KSREC's
 * Kerala_Lsgd_Boundary_Lsgdcode, one polygon per local body.
 *
 * Each polygon is bound to its LGD code through the reviewed block
 * membership's boundaryName, matched by folded name. The layer's own LSGD
 * code columns are never used for the join: KSREC's table is mis-joined for
 * swapped pairs (Tarur and Thachanattukara carry each other's codes). Every
 * polygon that is not an excluded type (urban local bodies, outside the
 * Panchayat Atlas) must be claimed by exactly one member, and every member
 * must find exactly one polygon, or the refresh stops.
 */
import type { BlockMembership } from "./block-membership";
import type { PanchayatGeometry } from "./datameet-boundary";

export interface StateLsgFeature {
  properties: Record<string, unknown>;
  geometry: { type: string; coordinates: unknown } | null;
}

export interface StateLsgLayerFields {
  /** The feature property holding the local body's name. */
  nameField: string;
  /** The feature property holding its type ("Grama Panchayat", "Municipality"). */
  typeField: string;
  /** Types outside the Panchayat Atlas, left unclaimed without error. */
  excludedTypes: string[];
}

type Polygon = number[][][];

const fold = (value: unknown): string => String(value ?? "").toLowerCase().replace(/[^a-z]/g, "");

function polygonsOf(geometry: StateLsgFeature["geometry"]): Polygon[] {
  if (!geometry) return [];
  if (geometry.type === "Polygon") return [geometry.coordinates as Polygon];
  if (geometry.type === "MultiPolygon") return geometry.coordinates as Polygon[];
  return [];
}

export function bindStateLsgPolygons(options: {
  features: StateLsgFeature[];
  fields: StateLsgLayerFields;
  membership: BlockMembership;
}): { geometries: Map<string, PanchayatGeometry>; excludedFeatures: number } {
  const { features, fields, membership } = options;
  const excluded = new Set(options.fields.excludedTypes.map(fold));
  const candidates = features.filter((feature) => !excluded.has(fold(feature.properties[fields.typeField])));
  const byName = new Map<string, StateLsgFeature[]>();
  for (const feature of candidates) {
    const key = fold(feature.properties[fields.nameField]);
    byName.set(key, [...(byName.get(key) ?? []), feature]);
  }
  const errors: string[] = [];
  const claimed = new Set<StateLsgFeature>();
  const geometries = new Map<string, PanchayatGeometry>();
  for (const member of membership.members) {
    if (!member.boundaryName) {
      errors.push(`${member.lgdGramPanchayatCode} ${member.name}: no boundaryName in the membership`);
      continue;
    }
    const matches = byName.get(fold(member.boundaryName)) ?? [];
    if (matches.length !== 1) {
      errors.push(`${member.lgdGramPanchayatCode} ${member.name}: boundaryName "${member.boundaryName}" matches ${matches.length} polygons`);
      continue;
    }
    const [feature] = matches;
    const coordinates = polygonsOf(feature.geometry);
    if (coordinates.length === 0) {
      errors.push(`${member.lgdGramPanchayatCode} ${member.name}: the polygon has no area geometry`);
      continue;
    }
    claimed.add(feature);
    geometries.set(member.lgdGramPanchayatCode, {
      lgdGramPanchayatCode: member.lgdGramPanchayatCode,
      geometry: { type: "MultiPolygon", coordinates },
      memberVillagesDrawn: [],
      memberVillagesNotDrawn: [],
    });
  }
  const unclaimed = candidates.filter((feature) => !claimed.has(feature));
  if (unclaimed.length > 0) {
    errors.push(
      `polygons no member claims: ${unclaimed
        .map((feature) => `${String(feature.properties[fields.nameField])} (${String(feature.properties[fields.typeField])})`)
        .join(", ")}`,
    );
  }
  if (errors.length > 0) throw new Error(`State boundary layer does not bind:\n- ${errors.join("\n- ")}`);
  return { geometries, excludedFeatures: features.length - candidates.length };
}
