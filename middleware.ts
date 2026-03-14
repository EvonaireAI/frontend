import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const protectedRoutes = [
  "/admin",
  "/creator",
  "/member",
  "/moderate",
  "/profile",
  "/dashboard",
]

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const isProtected = protectedRoutes.some((route) =>
    pathname.startsWith(route)
  )

  if (isProtected) {
    const session = request.cookies.get("session")
    if (!session) {
      const loginUrl = new URL("/auth/login", request.url)
      loginUrl.searchParams.set("from", pathname)
      return NextResponse.redirect(loginUrl)
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/creator/:path*",
    "/member/:path*",
    "/moderate/:path*",
    "/profile/:path*",
    "/dashboard/:path*",
  ],
}
