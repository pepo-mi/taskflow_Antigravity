import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
      },
    },
  })

  let user = null
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error: any) {
    // If refresh token is invalid, clear all auth cookies
    if (error?.message?.includes("Invalid Refresh Token") || error?.message?.includes("Refresh Token Not Found")) {
      // Silent handling

      // Clear all Supabase auth cookies
      const authCookies = request.cookies
        .getAll()
        .filter((cookie) => cookie.name.startsWith("sb-") || cookie.name.includes("auth-token"))

      authCookies.forEach((cookie) => {
        supabaseResponse.cookies.delete(cookie.name)
      })

      user = null
    }
    // Silent handling for other errors
  }

  if (
    !request.nextUrl.pathname.startsWith("/api/") &&
    request.nextUrl.pathname !== "/" &&
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/auth")
  ) {
    const url = request.nextUrl.clone()
    // Store the original URL to redirect back after login
    const redirectTo = request.nextUrl.pathname + request.nextUrl.search
    url.pathname = "/auth/login"
    url.searchParams.set("redirectTo", redirectTo)
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
