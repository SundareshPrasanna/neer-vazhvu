import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the CRON_SECRET header on cron API routes.
 * Returns null if authorized, or a 401 response if not.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;

  if (!expectedToken) {
    console.warn('CRON_SECRET not set — cron endpoints are unprotected');
    return null;
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
