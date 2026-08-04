import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

// NOTE (security): This middleware provides UX-level route gating only.
// The `session` cookie is a non-HttpOnly marker set client-side in
// lib/auth.ts and MUST NOT be treated as a security boundary — it can be
// forged by any script running in the page or via devtools. Real
// authorization is enforced by the backend on every API call via the JWT
// bearer token. Do not rely on this middleware to protect sensitive data;
// it only prevents an unauthenticated user from momentarily seeing a
// protected page shell before client-side auth checks redirect them.
const protectedRoutes = [
  "/admin",
  "/creator",
  "/member",
  "/moderate",
  "/profile",
  "/dashboard",
  "/gateway-quiz",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  const response = isProtected && !request.cookies.get("session")
    ? NextResponse.redirect(
        (() => {
          const loginUrl = new URL("/auth/login", request.url)
          loginUrl.searchParams.set("from", pathname)
          return loginUrl
        })(),
      )
    : NextResponse.next()

  // Defense-in-depth: ensure protected pages are never cached by
  // shared/proxy caches, reducing risk of stale authenticated content
  // being served to a different user.
  if (isProtected) {
    response.headers.set("Cache-Control", "no-store, must-revalidate")
  }

  return response
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/creator/:path*",
    "/member/:path*",
    "/moderate/:path*",
    "/profile/:path*",
    "/dashboard/:path*",
    "/gateway-quiz/:path*",
  ],
}
