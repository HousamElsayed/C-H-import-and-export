import { NextResponse, type NextRequest } from 'next/server'
import { SESSION_COOKIE } from '@/lib/auth'

const PUBLIC_PATHS = ['/login', '/forbidden']

/**
 * Cheap gate: bounces requests without a session cookie straight to /login.
 * The cookie is not trusted here — every page and server action re-validates
 * the session against the database.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const hasCookie = Boolean(request.cookies.get(SESSION_COOKIE)?.value)
  const isPublic = PUBLIC_PATHS.some((path) => pathname.startsWith(path))

  if (!hasCookie && !isPublic) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    url.search = pathname === '/' ? '' : `?next=${encodeURIComponent(pathname)}`
    return NextResponse.redirect(url)
  }

  if (hasCookie && pathname === '/login') {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)'],
}
