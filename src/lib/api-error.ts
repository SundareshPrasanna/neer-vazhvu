import { NextResponse } from 'next/server';

export function logRouteError(route: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${route}] ${message}`);
}

export function sanitizeErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : 'Unknown error';
  // Strip stack traces and internal details
  const firstLine = message.split('\n')[0];
  if (firstLine.length > 200) return 'Pipeline step failed';
  return firstLine;
}

export function internalServerError() {
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/**
 * Mock data may only be served when demo mode is explicitly requested via
 * env. A missing Supabase config alone must never silently serve fabricated
 * numbers with a 200 (2026-08 baseline P0.4) — routes return this 503
 * instead.
 */
export function isExplicitDemoMode(): boolean {
  return process.env.NEER_VAZHVU_DEMO_MODE === 'true';
}

export function dataServiceUnavailable() {
  return NextResponse.json(
    { error: 'Data service not configured' },
    { status: 503 },
  );
}
