import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname;
  const adminCookie = request.cookies.get('admin_access')?.value;

  // Protect all student and admin routes
  if ((path.startsWith('/student') && path !== '/student') || path.startsWith('/admin')) {
    // If they have the local admin bypass cookie and are heading to an admin route, let them in!
    if (path.startsWith('/admin') && adminCookie === 'true') {
      return supabaseResponse;
    }

    if (!user) {
      // If they don't have a token or bypass cookie, kick them back to the login screen
      return NextResponse.redirect(new URL('/', request.url));
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/student/:path*', '/admin/:path*'],
};