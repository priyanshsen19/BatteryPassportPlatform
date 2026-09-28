import { NextResponse, type NextRequest } from 'next/server';

const SESSION_COOKIE = 'bpp_session';
const PUBLIC_PATHS = ['/login', '/register'];

/** Routes signed-out visitors to the login page and signed-in users away from it. */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);
  const isPublic = PUBLIC_PATHS.includes(pathname);

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
  matcher: ['/((?!api|_next/static|_next/image|icon.svg|favicon.ico).*)'],
};
