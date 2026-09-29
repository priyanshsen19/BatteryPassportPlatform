import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'bpp_session';
// Signed-in users are sent from these to the dashboard.
const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];
// Reachable whether or not the visitor is signed in (a reset link can be opened anywhere).
const OPEN_PATHS = ['/reset-password'];

/** Routes signed-out visitors to the login page and signed-in users away from it. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.includes(pathname);
  if (OPEN_PATHS.includes(pathname)) return NextResponse.next();

  if (!hasSession && !isPublic) {
    const url = new URL('/login', request.url);
    if (pathname !== '/') url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }
  if (hasSession && (isPublic || pathname === '/')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }
  return NextResponse.next();
}

export const config = {
  // Skip API routes, Next.js assets and static files (anything with a file extension, e.g. logos).
  matcher: ['/((?!api|_next/static|_next/image|.*\\.[a-zA-Z0-9]+$).*)'],
};
