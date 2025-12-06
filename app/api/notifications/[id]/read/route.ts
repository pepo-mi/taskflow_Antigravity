import { createClient } from "@/lib/supabase/server"
import { getAuthUser } from "@/lib/supabase/server"
import { NextResponse } from "next/server"

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient()

    const { user, error: authError } = await getAuthUser(supabase)

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Mark notification as read
    const { data, error } = await supabase
      .from("notifications")
      .update({ read: true }) // Updated column name from is_read to read to match actual database schema
      .eq("id", params.id)
      .eq("user_id", user.id)
      .select()
      .single()

    if (error) {
      console.error("Error marking notification as read:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notification: data })
  } catch (error) {
    console.error("Error in mark notification read API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
