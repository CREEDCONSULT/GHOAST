import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIX = '/app';
const AUTH_ROUTES = ['/login', '/register'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  // The refresh token is stored in an httpOnly cookie named 'ghoast_refresh'.
  // We use its presence as a lightweight gate — the real auth check happens
  // client-side in the app layout (invalid/expired tokens get caught by the API).
  const hasSession = request.cookies.has('ghoast_refresh');

  if (pathname.startsWith(PROTECTED_PREFIX) && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (AUTH_ROUTES.includes(pathname) && hasSession) {
    return NextResponse.redirect(new URL('/app/dashboard', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/app/:path*', '/login', '/register'],
};
