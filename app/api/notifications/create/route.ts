import { NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { user_id, type, message, reference_id, reference_type, title } = body

    if (!user_id || !type || !message) {
      console.error("Missing required fields:", { user_id, type, message })
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const supabase = createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

    let userData = null
    let userError = null

    const { data: regularUser, error: regularUserError } = await supabase
      .from("users")
      .select("id, email, full_name")
      .eq("id", user_id)
      .single()

    if (regularUser) {
      userData = regularUser
    } else {
      const { data: guestUser, error: guestUserError } = await supabase
        .from("guest_users")
        .select("id, email, full_name")
        .eq("id", user_id)
        .single()

      if (guestUser) {
        userData = guestUser
      } else {
        userError = guestUserError || regularUserError
      }
    }

    if (userError || !userData) {
      console.error("User not found in either users or guest_users tables:", { user_id, error: userError })
      return NextResponse.json({ error: "User not found" }, { status: 404 })
    }

    const { data, error } = await supabase
      .from("notifications")
      .insert({
        user_id,
        type,
        message,
        title: title || message,
        related_id: reference_id,
        related_type: reference_type,
        read: false,
      })
      .select()
      .single()

    if (error) {
      console.error("Error creating notification:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ notification: data })
  } catch (error) {
    console.error("Error in create notification API:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
