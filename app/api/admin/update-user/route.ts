import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { logAdminAction } from "@/lib/admin-logger"

export async function POST(request: NextRequest) {
  try {
    const { userId, full_name, role, privileges, workspace_ids, admin_id } = await request.json()

    if (!userId || !full_name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    const { createServerClient, requireAdmin } = await import("@/lib/supabase/server")
    const supabaseAuth = await createServerClient()
    const { authorized, error: authError } = await requireAdmin(supabaseAuth)

    if (!authorized) {
      console.error("Unauthorized update user attempt:", authError)
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
    }

    const { data: { user: adminUser } } = await supabaseAuth.auth.getUser()
    if (!adminUser) {
      console.error("Admin user not found after authorization check.")
      return NextResponse.json({ error: "Admin user not found" }, { status: 403 })
    }

    // Create admin client with service role key to bypass RLS
    const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if user exists in users table
    const { data: regularUser } = await supabase.from("users").select("*").eq("id", userId).maybeSingle()

    // Check if user exists in guest_users table
    const { data: guestUser } = await supabase.from("guest_users").select("*").eq("id", userId).maybeSingle()

    let tableName: string
    if (regularUser) {
      tableName = "users"
    } else if (guestUser) {
      tableName = "guest_users"
    } else {
      return NextResponse.json({ error: "User not found in database" }, { status: 404 })
    }

    // Update the user in the correct table
    const { data, error } = await supabase
      .from(tableName)
      .update({
        full_name: full_name.trim(),
        role,
        privileges,
      })
      .eq("id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating user:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (role === "guest" && workspace_ids !== undefined) {
      // Delete existing workspace assignments
      const { error: deleteError } = await supabase.from("guest_workspace_access").delete().eq("guest_id", userId)

      if (deleteError) {
        console.error("Error deleting existing workspace access:", deleteError)
      }

      // Insert new workspace assignments
      if (workspace_ids.length > 0 && admin_id) {
        const workspaceAccessRecords = workspace_ids.map((workspace_id: string) => ({
          guest_id: userId,
          workspace_id,
          granted_by: admin_id,
        }))

        const { error: insertError } = await supabase.from("guest_workspace_access").insert(workspaceAccessRecords)

        if (insertError) {
          console.error("Error inserting workspace access:", insertError)
          return NextResponse.json(
            { error: "User updated but failed to update workspace access: " + insertError.message },
            { status: 500 },
          )
        }


      }
    }

    // Log the action
    await logAdminAction({
      supabase,
      adminId: admin_id || adminUser.id,
      action: "UPDATE_USER",
      targetId: userId,
      targetType: "user",
      metadata: {
        role: role,
        updated_fields: Object.keys({ full_name, role, privileges }).filter(k => !!k),
        workspace_count: workspace_ids?.length || 0,
      },
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error("Error in update-user API:", error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to update user" },
      { status: 500 },
    )
  }
}
