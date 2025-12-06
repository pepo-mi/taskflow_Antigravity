import { createServerClient as _createServerClient } from "@supabase/ssr"
import { cookies } from "next/headers"

export async function createClient() {
  const cookieStore = await cookies()

  return _createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        } catch {
          // The "setAll" method was called from a Server Component.
          // This can be ignored if you have middleware refreshing
          // user sessions.
        }
      },
    },
  })
}

export async function createServerClient() {
  return createClient()
}

export async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  try {
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    // If there's an error related to invalid refresh token, return null user
    if (error) {
      const errorMessage = error.message || ""
      if (
        errorMessage.includes("Invalid Refresh Token") ||
        errorMessage.includes("Refresh Token Not Found") ||
        errorMessage.includes("refresh_token_not_found")
      ) {
        return { user: null, error: null }
      }
      // For other errors, return the error
      return { user: null, error }
    }

    return { user, error: null }
  } catch (err: any) {
    const errorMessage = err?.message || String(err)
    if (
      errorMessage.includes("Invalid Refresh Token") ||
      errorMessage.includes("Refresh Token Not Found") ||
      errorMessage.includes("refresh_token_not_found")
    ) {
      return { user: null, error: null }
    }
    return { user: null, error: err }
  }
}

export async function requireAdmin(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { user, error } = await getAuthUser(supabase)

  if (error || !user) {
    return { authorized: false, user: null, error: error || "Unauthorized" }
  }

  // Check if user is admin in regular users table
  const { data: regularUser, error: regularError } = await supabase
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (regularUser?.role === "admin") {
    return { authorized: true, user, error: null }
  }

  // Check if user is admin (unlikely but possible?) in guest_users table - guests shouldn't be admins though
  const { data: guestUser } = await supabase
    .from("guest_users")
    .select("role")
    .eq("id", user.id)
    .single()

  if (guestUser?.role === "admin") {
    return { authorized: true, user, error: null }
  }

  return { authorized: false, user, error: "Forbidden: Admin access required" }
}
