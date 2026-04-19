import { NextResponse } from "next/server";
import { STATIC_FACTS } from "@/lib/facts/static-facts";
import { buildLiveFacts } from "@/lib/facts/live-facts";
import { buildDerivedFacts } from "@/lib/facts/derived-facts";
import type { FactsPayload } from "@/types/facts";

/**
 * GET /api/facts
 *
 * Returns the full list of Chennai Water Facts as a JSON payload. Intended
 * for RSS generators, embed partners, and external data consumers.
 *
 * Sources merged:
 * - Tier 1 (live) - queried at request time from Supabase
 * - Tier 2 (derived) - computed from refreshable public/data/*.json files
 * - Tier 3/4 (static) - historical and structural facts bundled at build time
 *
 * Cached for 1 hour.
 */
export async function GET() {
  const [liveFacts, derivedFacts] = await Promise.all([
    buildLiveFacts(),
    buildDerivedFacts(),
  ]);
  const payload: FactsPayload = {
    generated_at: new Date().toISOString(),
    facts: [...liveFacts, ...derivedFacts, ...STATIC_FACTS],
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
    },
  });
}
