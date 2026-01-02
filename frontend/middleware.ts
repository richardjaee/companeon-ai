import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware to handle chain-based routing
 * Redirects old URLs to /base prefix for backwards compatibility
 */

// Routes that should be redirected to /base
const CHAIN_ROUTES = [
  '/dashboard',
  '/portfolio',
  '/depositing',
  '/withdraw',
  '/settings',
  '/compatibility',
  '/learn',
  '/tools',
  '/demo-portfolio',
];

// Routes that should NOT be redirected (static pages, API, etc.)
const EXCLUDED_ROUTES = [
  '/api',
  '/about',
  '/privacy',
  '/terms',
  '/audit',
  '/_next',
  '/favicon.ico',
  '/robots.txt',
  '/sitemap.xml',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Reject POST requests to root path - prevents "Unexpected end of form" errors from bots
  if (pathname === '/' && request.method === 'POST') {
    return new NextResponse(
      JSON.stringify({
        error: 'Method not allowed',
        message: 'POST requests to the root path are not supported'
      }),
      {
        status: 405,
        headers: {
          'Content-Type': 'application/json',
          'Allow': 'GET, HEAD'
        }
      }
    );
  }

  // Skip excluded routes
  if (EXCLUDED_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Skip if already has chain prefix
  if (pathname.startsWith('/base/') || pathname.startsWith('/mainnet/')) {
    return NextResponse.next();
  }

  // Let root page (/) load normally - don't force redirect to dashboard
  // The home page will handle its own navigation based on wallet connection state
  if (pathname === '/') {
    return NextResponse.next();
  }

  // Check if this is a chain route that needs redirect
  const needsRedirect = CHAIN_ROUTES.some(route => {
    return pathname === route || pathname.startsWith(`${route}/`);
  });

  if (needsRedirect) {
    // Redirect to /base prefix
    const newUrl = new URL(`/base${pathname}${request.nextUrl.search}`, request.url);
    return NextResponse.redirect(newUrl);
  }

  return NextResponse.next();
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
