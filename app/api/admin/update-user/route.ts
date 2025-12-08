import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"
import { logAdminAction } from "@/lib/admin-logger"

export async function POST(request: NextRequest) {
  try {
    const { userId, full_name, role, organization, privileges, workspace_ids, admin_id } = await request.json()

    // Debug logging
    console.log("=== UPDATE USER API CALLED ===")
    console.log("userId:", userId)
    console.log("role:", role)
    console.log("organization:", organization)
    console.log("workspace_ids:", workspace_ids)
    console.log("admin_id:", admin_id)

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

    // Build update object
    const updateData: Record<string, unknown> = {
      full_name: full_name.trim(),
      role,
      privileges,
    }

    // Only include organization if provided (regular users only)
    if (organization && tableName === "users") {
      updateData.organization = organization
    }

    // Update the user in the correct table
    const { data, error } = await supabase
      .from(tableName)
      .update(updateData)
      .eq("id", userId)
      .select()
      .single()

    if (error) {
      console.error("Error updating user:", error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Handle workspace assignments based on user role
    if (workspace_ids !== undefined && admin_id) {
      if (role === "guest") {
        // For guests, use guest_workspace_access table
        const { error: deleteError } = await supabase.from("guest_workspace_access").delete().eq("guest_id", userId)

        if (deleteError) {
          console.error("Error deleting existing guest workspace access:", deleteError)
        }

        if (workspace_ids.length > 0) {
          const workspaceAccessRecords = workspace_ids.map((workspace_id: string) => ({
            guest_id: userId,
            workspace_id,
            granted_by: admin_id,
          }))

          const { error: insertError } = await supabase.from("guest_workspace_access").insert(workspaceAccessRecords)

          if (insertError) {
            console.error("Error inserting guest workspace access:", insertError)
            return NextResponse.json(
              { error: "User updated but failed to update workspace access: " + insertError.message },
              { status: 500 },
            )
          }
        }
      } else if (role === "user") {
        // For regular users, use user_workspace_access table
        console.log("=== PROCESSING USER WORKSPACE ACCESS ===")
        console.log("User ID:", userId)
        console.log("Workspace IDs to save:", workspace_ids)

        const { error: deleteError } = await supabase.from("user_workspace_access").delete().eq("user_id", userId)

        if (deleteError) {
          console.error("Error deleting existing user workspace access:", deleteError)
        } else {
          console.log("Successfully deleted existing workspace access")
        }

        // Only insert if there are specific workspaces assigned (opt-in)
        // Empty array means "see all workspaces" (no restrictions)
        if (workspace_ids.length > 0) {
          const workspaceAccessRecords = workspace_ids.map((workspace_id: string) => ({
            user_id: userId,
            workspace_id,
            granted_by: admin_id,
          }))
          console.log("Records to insert:", workspaceAccessRecords)

          const { data: insertData, error: insertError } = await supabase.from("user_workspace_access").insert(workspaceAccessRecords).select()

          if (insertError) {
            console.error("Error inserting user workspace access:", insertError)
            return NextResponse.json(
              { error: "User updated but failed to update workspace access: " + insertError.message },
              { status: 500 },
            )
          }
          console.log("Successfully inserted workspace access:", insertData)
        } else {
          console.log("No workspaces to insert (empty array = no restrictions)")
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
