import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const token = request.cookies.get('phoenix_token')?.value;
  const path = request.nextUrl.pathname;

  // Protect all student and admin routes EXCEPT the actual /student login page
  if ((path.startsWith('/student') && path !== '/student') || path.startsWith('/admin')) {
    if (!token) {
      // If they don't have a token, kick them back to the student login screen
      return NextResponse.redirect(new URL('/student', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/student/:path*', '/admin/:path*'],
};