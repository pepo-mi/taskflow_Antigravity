import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { createClient as createServerClient, getAuthUser } from "@/lib/supabase/server"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json({ error: "User ID is required" }, { status: 400 })
    }

    const supabase = await createServerClient()

    // Check if requester is an admin
    const { authorized, user: currentUser, error: authError } = await requireAdmin(supabase)

    if (!authorized || !currentUser) {
      console.error("Unauthorized delete user attempt:", authError)
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
    }

    if (currentUser.id === userId) {
      return NextResponse.json(
        { error: "You cannot delete your own account. Please contact another administrator." },
        { status: 403 },
      )
    }

    const [regularUserResult, guestUserResult] = await Promise.all([
      supabaseAdmin.from("users").select("id, email, role").eq("id", userId).maybeSingle(),
      supabaseAdmin.from("guest_users").select("id, email, role").eq("id", userId).maybeSingle(),
    ])

    if (regularUserResult.error) {
      console.error("Error checking regular users table:", regularUserResult.error)
    }

    if (guestUserResult.error) {
      console.error("Error checking guest_users table:", guestUserResult.error)
    }

    const userData = regularUserResult.data || guestUserResult.data
    const isGuestUser = !!guestUserResult.data

    if (!userData) {
      console.error("Error fetching user: User not found in either table")
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    if (isGuestUser) {
      const { error: accessError } = await supabaseAdmin.from("guest_workspace_access").delete().eq("guest_id", userId)

      if (accessError) {
        console.error("Error deleting workspace access:", accessError)
      }
    }

    const tableName = isGuestUser ? "guest_users" : "users"
    const { error: dbError } = await supabaseAdmin.from(tableName).delete().eq("id", userId)

    if (dbError) {
      console.error("Error deleting user from database:", dbError)
      return NextResponse.json({ error: "Failed to delete user from database" }, { status: 500 })
    }

    try {
      const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId)
      if (authError) {
        console.error("Error deleting auth user:", authError)
      }
    } catch (authException) {
      console.error("Exception deleting auth user:", authException)
    }

    return NextResponse.json({
      success: true,
      message: `User ${userData.email} deleted successfully`,
    })
  } catch (error) {
    console.error("Delete user error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
