import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { logAdminAction } from "@/lib/admin-logger"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: "Server configuration error" }, { status: 500 })
    }

    const { guest_id, workspace_ids } = await request.json()

    if (!guest_id || !Array.isArray(workspace_ids)) {
      return NextResponse.json({ error: "Invalid request parameters" }, { status: 400 })
    }

    const { createServerClient, requireAdmin } = await import("@/lib/supabase/server")
    const supabase = await createServerClient()
    const { authorized, user, error: authError } = await requireAdmin(supabase)

    if (!authorized || !user) {
      console.error("Unauthorized update guest workspace access attempt:", authError)
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
    }

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get current user (admin)
    const { data: currentUser } = await supabaseAdmin.auth.getUser()
    const grantedBy = currentUser?.user?.id

    if (!grantedBy) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Delete existing workspace access for this guest
    await supabaseAdmin.from("guest_workspace_access").delete().eq("guest_id", guest_id)

    // Insert new workspace access records
    if (workspace_ids.length > 0) {
      const workspaceAccessRecords = workspace_ids.map((workspace_id: string) => ({
        guest_id,
        workspace_id,
        granted_by: grantedBy,
      }))

      const { error } = await supabaseAdmin.from("guest_workspace_access").insert(workspaceAccessRecords)

      if (error) {
        console.error("Failed to update workspace access:", error)
        return NextResponse.json({ error: "Failed to update workspace access" }, { status: 500 })
      }
    }

    // Log the action
    await logAdminAction({
      supabase: supabaseAdmin,
      adminId: grantedBy,
      action: "UPDATE_GUEST_ACCESS",
      targetId: guest_id,
      targetType: "user",
      metadata: {
        workspace_count: workspace_ids.length,
        workspace_ids: workspace_ids,
      },
    })

    return NextResponse.json({
      message: `Workspace access updated. Guest now has access to ${workspace_ids.length} workspace(s).`,
    })
  } catch (error) {
    console.error("Error updating guest workspace access:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
