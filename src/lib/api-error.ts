import { NextResponse } from 'next/server';

export function logRouteError(route: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${route}] ${message}`);
}

export function internalServerError() {
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
}

/** A route whose database is not configured says so with a 503; it never
 *  serves stand-in numbers. */
export function dataServiceUnavailable() {
  return NextResponse.json(
    { error: 'Data service not configured' },
    { status: 503 },
  );
}
