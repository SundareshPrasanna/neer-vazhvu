import { NextResponse } from "next/server";
import { STATIC_FACTS } from "@/lib/facts/static-facts";
import { buildLiveFacts } from "@/lib/facts/live-facts";
import type { FactsPayload } from "@/types/facts";

/**
 * GET /api/facts
 *
 * Returns the full list of Chennai Water Facts as a JSON payload. Intended
 * for RSS generators, embed partners, and external data consumers.
 *
 * Live (Tier 1) facts are queried at request time; static facts are
 * bundled at build time. Cached for 1 hour.
 */
export async function GET() {
  const liveFacts = await buildLiveFacts();
  const payload: FactsPayload = {
    generated_at: new Date().toISOString(),
    facts: [...liveFacts, ...STATIC_FACTS],
  };

  return NextResponse.json(payload, {
    headers: {
      "Cache-Control": "public, max-age=3600, stale-while-revalidate=300",
    },
  });
}
