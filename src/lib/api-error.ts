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
