import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('phoenix_token')?.value;

  // Protect student and admin routes natively
  if (request.nextUrl.pathname.startsWith('/student') || request.nextUrl.pathname.startsWith('/admin')) {
    if (!token) {
      // No token found, redirect to login which we assume is root "/"
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/admin/:path*'],
};
