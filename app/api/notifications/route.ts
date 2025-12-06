import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

const authCache = new Map<string, { userId: string; timestamp: number }>()
const notificationCache = new Map<string, { data: any; timestamp: number }>()
const AUTH_CACHE_TTL = 60000 // 1 minute - reduces auth API calls
const NOTIFICATION_CACHE_TTL = 30000 // 30 seconds

export async function GET(request: Request) {
  try {


    const supabase = await createClient()

    const authHeader = request.headers.get("cookie") || ""
    const authCacheKey = `auth:${authHeader.substring(0, 50)}` // Use cookie hash as cache key
    const cachedAuth = authCache.get(authCacheKey)
    const now = Date.now()

    let userId: string

    if (cachedAuth && now - cachedAuth.timestamp < AUTH_CACHE_TTL) {
      userId = cachedAuth.userId

    } else {
      try {

        const { user: authUser, error: authError } = await getAuthUser(supabase)

        if (authError) {
          console.error("[v0] Notifications API: Auth error:", authError)
          if (cachedAuth) {
            const notifCacheKey = `notifications:${cachedAuth.userId}`
            const cachedNotif = notificationCache.get(notifCacheKey)
            if (cachedNotif) {

              return NextResponse.json({ notifications: cachedNotif.data })
            }
          }
          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        if (!authUser) {

          return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
        }

        userId = authUser.id

        authCache.set(authCacheKey, { userId, timestamp: now })
      } catch (authErr: any) {
        const errMsg = authErr?.message || String(authErr)
        console.error("[v0] Notifications API: Auth exception:", errMsg)

        if (errMsg.includes("Too Many Requests") || errMsg.includes("is not valid JSON")) {
          if (cachedAuth) {
            const notifCacheKey = `notifications:${cachedAuth.userId}`
            const cachedNotif = notificationCache.get(notifCacheKey)
            if (cachedNotif) {
              return NextResponse.json({ notifications: cachedNotif.data })
            }
          }
          return NextResponse.json(
            { error: "Service temporarily unavailable. Please try again in a moment." },
            { status: 503 },
          )
        }
        throw authErr
      }
    }

    const notifCacheKey = `notifications:${userId}`
    const cachedNotif = notificationCache.get(notifCacheKey)

    if (cachedNotif && now - cachedNotif.timestamp < NOTIFICATION_CACHE_TTL) {

      return NextResponse.json({ notifications: cachedNotif.data })
    }

    try {

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) {
        console.error("[v0] Notifications API: Database query error:", error)
        if (cachedNotif) {

          return NextResponse.json({ notifications: cachedNotif.data })
        }
        return NextResponse.json({ error: error.message || "Failed to fetch notifications" }, { status: 500 })
      }

      const notifications = data || []


      notificationCache.set(notifCacheKey, { data: notifications, timestamp: now })

      return NextResponse.json({ notifications })
    } catch (queryErr: any) {
      const errMsg = queryErr?.message || String(queryErr)
      console.error("[v0] Notifications API: Query exception:", errMsg)

      if (cachedNotif) {
        return NextResponse.json({ notifications: cachedNotif.data })
      }

      if (errMsg.includes("Too Many Requests") || errMsg.includes("is not valid JSON")) {
        return NextResponse.json(
          { error: "Service temporarily unavailable. Please try again in a moment." },
          { status: 503 },
        )
      }
      throw queryErr
    }
  } catch (error: any) {
    const errorMessage = error?.message || String(error)
    console.error("[v0] Notifications API: Unhandled error:", {
      message: errorMessage,
      stack: error?.stack,
      error: error,
    })

    if (errorMessage.includes("Too Many Requests") || errorMessage.includes("is not valid JSON")) {
      return NextResponse.json(
        { error: "Service temporarily unavailable. Please try again in a moment." },
        { status: 503 },
      )
    }

    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
