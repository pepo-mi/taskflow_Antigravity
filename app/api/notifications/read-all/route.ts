import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH() {
  try {
    const supabase = await createClient()

    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Mark all notifications as read
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)

    if (error) {
      console.error("Error marking all notifications as read:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error in mark all notifications read API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
