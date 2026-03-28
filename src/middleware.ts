import { NextRequest, NextResponse } from 'next/server';
import { rateLimit } from '@/lib/rate-limit';

// 60 API requests per minute per IP (generous for normal use, blocks abuse)
const MAX_API_REQUESTS = 60;
const WINDOW_MS = 60_000;

// Cache durations (seconds) by route prefix
const CACHE_TTL: Record<string, number> = {
  '/api/groundwater/risk': 3600,          // hourly - computed once per pipeline run
  '/api/groundwater/history': 3600,       // hourly - monthly data
  '/api/groundwater': 1800,               // 30min - monthly data
  '/api/water-bodies-census': 86400,      // daily - census data rarely changes
  '/api/reservoir': 900,                  // 15min - matches homepage ISR
  '/api/calculator': 900,                 // 15min - based on reservoir data
  '/api/narratives': 3600,                // hourly - generated once per pipeline run
  '/api/health': 60,                      // 1min
};

function getCacheTtl(pathname: string): number | null {
  for (const [prefix, ttl] of Object.entries(CACHE_TTL)) {
    if (pathname.startsWith(prefix)) return ttl;
  }
  return null;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Only rate-limit API routes (not pages, static assets, etc.)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next();
  }

  // Skip rate limiting for cron routes (already auth-gated)
  if (pathname.startsWith('/api/cron/')) {
    return NextResponse.next();
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

  const result = rateLimit(ip, MAX_API_REQUESTS, WINDOW_MS);

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests' },
      {
        status: 429,
        headers: {
          'Retry-After': String(result.retryAfterSeconds),
          'X-RateLimit-Limit': String(MAX_API_REQUESTS),
          'X-RateLimit-Remaining': '0',
        },
      },
    );
  }

  const response = NextResponse.next();

  // Rate limit headers
  response.headers.set('X-RateLimit-Limit', String(MAX_API_REQUESTS));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));

  // Cache-Control for public GET routes
  if (request.method === 'GET') {
    const ttl = getCacheTtl(pathname);
    if (ttl) {
      response.headers.set(
        'Cache-Control',
        `public, s-maxage=${ttl}, stale-while-revalidate=${ttl * 2}`,
      );
    }
  }

  return response;
}

export const config = {
  matcher: '/api/:path*',
};
