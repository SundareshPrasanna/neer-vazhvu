import { NextRequest, NextResponse } from 'next/server';

/**
 * Validates the CRON_SECRET header on cron API routes.
 * Returns null if authorized, or a 401 response if not.
 */
export function verifyCronAuth(request: NextRequest): NextResponse | null {
  const authHeader = request.headers.get('authorization');
  const expectedToken = process.env.CRON_SECRET;
  const allowDevBypass =
    process.env.NODE_ENV === 'development' &&
    process.env.ALLOW_UNPROTECTED_CRON === 'true';

  if (!expectedToken) {
    if (allowDevBypass) {
      console.warn('CRON_SECRET not set  -  allowing cron auth bypass in local development');
      return null;
    }
    return NextResponse.json(
      { error: 'Server misconfigured: CRON_SECRET is missing' },
      { status: 500 }
    );
  }

  if (authHeader !== `Bearer ${expectedToken}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  return null;
}
