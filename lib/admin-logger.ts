import { SupabaseClient } from "@supabase/supabase-js"

export type AdminActionType =
    | "CREATE_USER"
    | "UPDATE_USER"
    | "DELETE_USER"
    | "SEND_PASSWORD_RESET"
    | "CREATE_WORKSPACE"
    | "UPDATE_WORKSPACE"
    | "DELETE_WORKSPACE"
    | "CREATE_PROJECT"
    | "UPDATE_PROJECT"
    | "ARCHIVE_PROJECT"
    | "RESTORE_PROJECT"
    | "DELETE_PROJECT"
    | "UPDATE_GUEST_ACCESS"

interface LogAdminActionParams {
    supabase: SupabaseClient
    adminId: string
    action: AdminActionType
    targetId?: string
    targetType?: "user" | "workspace" | "project"
    metadata?: Record<string, any>
    ipAddress?: string
}

export async function logAdminAction({
    supabase,
    adminId,
    action,
    targetId,
    targetType,
    metadata = {},
    ipAddress,
}: LogAdminActionParams) {
    try {
        const { error } = await supabase.from("admin_activity_logs").insert({
            admin_id: adminId,
            action_type: action,
            target_id: targetId,
            target_type: targetType,
            metadata,
            ip_address: ipAddress,
        })

        if (error) {
            console.error("Failed to log admin action:", error)
            // We don't throw here to avoid failing the main operation just because logging failed
        }
    } catch (err) {
        console.error("Unexpected error logging admin action:", err)
    }
}
