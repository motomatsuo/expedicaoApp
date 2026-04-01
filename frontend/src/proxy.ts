import { NextRequest, NextResponse } from 'next/server';
import { ROUTES } from '@/shared/constants/routes';

const protectedPaths = [ROUTES.dashboard, ROUTES.bipagem];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.get('portal_ui_session')?.value === '1';

  if (protectedPaths.some((path) => pathname.startsWith(path)) && !hasSession) {
    return NextResponse.redirect(new URL(ROUTES.login, request.url));
  }

  if (pathname === ROUTES.login && hasSession) {
    return NextResponse.redirect(new URL(ROUTES.dashboard, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/login', '/dashboard/:path*', '/bipagem/:path*'],
};
