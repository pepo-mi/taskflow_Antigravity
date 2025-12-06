import { type NextRequest, NextResponse } from "next/server"
import { logAdminAction } from "@/lib/admin-logger"

export async function POST(request: NextRequest) {
  try {
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing Supabase environment variables")
      return NextResponse.json({ error: "Server configuration error: Missing Supabase credentials" }, { status: 500 })
    }

    // Parse request body
    let requestBody
    try {
      requestBody = await request.json()
    } catch (parseError) {
      console.error("JSON parse error:", parseError)
      return NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 })
    }

    const { email, full_name, role, sendPasswordReset, privileges, workspace_ids, admin_id } = requestBody

    if (!email || !full_name) {
      return NextResponse.json({ error: "Email and full name are required" }, { status: 400 })
    }

    const isProperDomain = email.endsWith("@proper.am")

    // Admin can now assign any role to any user regardless of domain

    const { createServerClient, requireAdmin } = await import("@/lib/supabase/server")
    const supabase = await createServerClient()
    const { authorized, error: authError } = await requireAdmin(supabase)

    if (!authorized) {
      console.error("Unauthorized create user attempt:", authError)
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
    }

    const { createClient } = await import("@supabase/supabase-js")

    const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Check if user already exists
    const [regularUserResult, guestUserResult] = await Promise.all([
      supabaseAdmin
        .from("users")
        .select("id, email, role, organization, privileges")
        .eq("email", email.trim())
        .maybeSingle(),
      supabaseAdmin
        .from("guest_users")
        .select("id, email, role, organization, privileges")
        .eq("email", email.trim())
        .maybeSingle(),
    ])

    if (regularUserResult.error) {
      console.error("Error checking existing regular user:", regularUserResult.error)
      return NextResponse.json(
        {
          error: "Database query error: " + regularUserResult.error.message,
        },
        { status: 500 },
      )
    }

    if (guestUserResult.error) {
      console.error("Error checking existing guest user:", guestUserResult.error)
      return NextResponse.json(
        {
          error: "Database query error: " + guestUserResult.error.message,
        },
        { status: 500 },
      )
    }

    const existingUser = regularUserResult.data || guestUserResult.data
    const isExistingGuest = !!guestUserResult.data

    if (existingUser) {
      if (existingUser.role !== role) {
        // Handle role changes between guest and regular users
        if (role === "guest" && !isExistingGuest) {
          // Moving from regular user to guest - not allowed
          return NextResponse.json(
            {
              error: "Cannot convert regular users to guest users",
            },
            { status: 400 },
          )
        }

        if (role !== "guest" && isExistingGuest) {
          // Moving from guest to regular user - need to create auth user and move data
          return NextResponse.json(
            {
              error: "Converting guest users to regular users is not currently supported",
            },
            { status: 400 },
          )
        }

        // Update existing user's role (same table)
        const tableName = isExistingGuest ? "guest_users" : "users"
        const { data: updatedUser, error: updateError } = await supabaseAdmin
          .from(tableName)
          .update({
            role: role,
            full_name: full_name.trim(),
            organization: role === "guest" ? "external" : "proper.am",
            privileges:
              privileges ||
              (role === "admin"
                ? { can_create_workspaces: true, can_create_projects: true, can_create_tasks: true }
                : role === "user"
                  ? { can_create_workspaces: false, can_create_projects: true, can_create_tasks: true }
                  : { can_create_workspaces: false, can_create_projects: false, can_create_tasks: false }),
          })
          .eq("id", existingUser.id)
          .select()
          .single()

        if (updateError) {
          console.error("Error updating user role:", updateError)
          return NextResponse.json(
            {
              error: "Failed to update user role: " + updateError.message,
            },
            { status: 400 },
          )
        }

        return NextResponse.json({
          user: updatedUser,
          message: `User role updated from ${existingUser.role} to ${role}`,
        })
      } else {
        return NextResponse.json({
          user: existingUser,
          message: "User already exists with the specified role",
        })
      }
    }

    // Create new user
    if (role === "guest") {
      let authData
      let authUserId
      try {
        // First, try to get existing auth user by email
        const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingAuthUser = existingAuthUsers.users.find((u) => u.email === email.trim())

        if (existingAuthUser) {
          authUserId = existingAuthUser.id
          authData = { user: existingAuthUser }
        } else {
          // Create new auth user
          const authResult = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password: Math.random().toString(36).slice(-8),
            email_confirm: true,
            user_metadata: {
              full_name: full_name.trim(),
              role: "guest",
              organization: "external",
            },
          })

          if (authResult.error) {
            console.error("Guest auth user creation error:", authResult.error)
            return NextResponse.json(
              {
                error: "Failed to create guest auth user: " + authResult.error.message,
              },
              { status: 400 },
            )
          }

          authData = authResult.data
          authUserId = authData.user.id
        }
      } catch (authError) {
        console.error("Guest auth user creation exception:", authError)
        return NextResponse.json(
          {
            error:
              "Failed to create guest auth user: " + (authError instanceof Error ? authError.message : "Unknown error"),
          },
          { status: 400 },
        )
      }

      // Create guest user profile in guest_users table
      const { data: guestData, error: guestError } = await supabaseAdmin
        .from("guest_users")
        .insert({
          id: authUserId, // Use auth user ID to link with Supabase Auth
          email: email.trim(),
          full_name: full_name.trim(),
          role: "guest",
          organization: "external",
          privileges: privileges || {
            can_create_workspaces: false,
            can_create_projects: false,
            can_create_tasks: false,
          },
        })
        .select()
        .single()

      if (guestError) {
        console.error("Guest user profile creation error:", guestError)

        if (guestError.code === "23505") {
          // User already exists in guest_users (created by trigger), fetch it instead
          const { data: existingGuest, error: fetchError } = await supabaseAdmin
            .from("guest_users")
            .select()
            .eq("id", authUserId)
            .single()

          if (fetchError || !existingGuest) {
            console.error("Failed to fetch existing guest user:", fetchError)
            return NextResponse.json(
              {
                error: "Failed to create or fetch guest user profile: " + (fetchError?.message || "Unknown error"),
              },
              { status: 400 },
            )
          }

          authData = { user: existingGuest }
        } else {
          // Different error, cleanup and fail
          if (!authData.user) {
            try {
              await supabaseAdmin.auth.admin.deleteUser(authUserId)
            } catch (cleanupError) {
              console.error("Failed to cleanup guest auth user:", cleanupError)
            }
          }
          return NextResponse.json(
            {
              error: "Failed to create guest user profile: " + guestError.message,
            },
            { status: 400 },
          )
        }
      }

      // Assign workspace access
      if (workspace_ids && Array.isArray(workspace_ids) && workspace_ids.length > 0) {
        const grantedBy = admin_id

        if (grantedBy) {
          const workspaceAccessRecords = workspace_ids.map((workspace_id) => ({
            guest_id: authUserId,
            workspace_id,
            granted_by: grantedBy,
          }))

          const { error: accessError } = await supabaseAdmin
            .from("guest_workspace_access")
            .insert(workspaceAccessRecords)

          if (accessError) {
            console.error("Failed to assign workspace access:", accessError)
            // Don't fail user creation if workspace access fails
            // The admin can manually assign access later
          } else {

          }
        } else {
          console.error("No admin_id provided, cannot assign workspace access")
        }
      }

      if (sendPasswordReset) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://proper-taskflow.vercel.app"
          const redirectUrl = `${baseUrl.replace(/\/$/, "")}/auth/setup-password`

          // Generate password reset token
          const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: email.trim(),
            options: {
              redirectTo: redirectUrl,
            },
          })

          if (resetError) {
            console.error("Failed to generate password reset link:", resetError)
          } else if (resetData?.properties?.action_link) {
            const { sendWelcomeEmail } = await import("@/lib/email")
            const emailResult = await sendWelcomeEmail({
              to: email.trim(),
              name: full_name.trim(),
              resetPasswordUrl: resetData.properties.action_link,
              isGuest: true,
            })

            if (!emailResult.success) {
              console.error("Welcome email failed:", emailResult.error)
            }
          }
        } catch (emailError) {
          console.error("Guest welcome email exception:", emailError)
        }
      }

      return NextResponse.json({
        user: authData.user,
        message:
          "Guest user created successfully" +
          (sendPasswordReset ? ". A password setup email has been sent." : "") +
          (workspace_ids && workspace_ids.length > 0 ? ` Access granted to ${workspace_ids.length} workspace(s).` : ""),
      })
    } else {
      let authData
      let authUserId
      try {
        // First, try to get existing auth user by email
        const { data: existingAuthUsers } = await supabaseAdmin.auth.admin.listUsers()
        const existingAuthUser = existingAuthUsers.users.find((u) => u.email === email.trim())

        if (existingAuthUser) {
          authUserId = existingAuthUser.id
          authData = { user: existingAuthUser }
        } else {
          // Create new auth user
          const authResult = await supabaseAdmin.auth.admin.createUser({
            email: email.trim(),
            password: Math.random().toString(36).slice(-8),
            email_confirm: true,
            user_metadata: {
              full_name: full_name.trim(),
              role: role,
              organization: "proper.am",
            },
          })

          if (authResult.error) {
            console.error("Auth user creation error:", authResult.error)
            return NextResponse.json(
              {
                error: "Failed to create auth user: " + authResult.error.message,
              },
              { status: 400 },
            )
          }

          authData = authResult.data
          authUserId = authData.user.id
        }
      } catch (authError) {
        console.error("Auth user creation exception:", authError)
        return NextResponse.json(
          {
            error: "Failed to create auth user: " + (authError instanceof Error ? authError.message : "Unknown error"),
          },
          { status: 400 },
        )
      }

      // Create database user
      const { data: userData, error: userError } = await supabaseAdmin
        .from("users")
        .insert({
          id: authUserId,
          email: email.trim(),
          full_name: full_name.trim(),
          role: role,
          organization: "proper.am",
          privileges:
            privileges ||
            (role === "admin"
              ? { can_create_workspaces: true, can_create_projects: true, can_create_tasks: true }
              : role === "user"
                ? { can_create_workspaces: false, can_create_projects: true, can_create_tasks: true }
                : { can_create_workspaces: false, can_create_projects: false, can_create_tasks: false }),
        })
        .select()
        .single()

      if (userError) {
        console.error("Database user creation error:", userError)
        if (!authData.user) {
          try {
            await supabaseAdmin.auth.admin.deleteUser(authUserId)
          } catch (cleanupError) {
            console.error("Failed to cleanup auth user:", cleanupError)
          }
        }
        return NextResponse.json(
          {
            error: "Failed to create user profile: " + userError.message,
          },
          { status: 400 },
        )
      }

      // Assign workspace access
      if (workspace_ids && Array.isArray(workspace_ids) && workspace_ids.length > 0) {
        const grantedBy = admin_id

        if (grantedBy) {
          const workspaceAccessRecords = workspace_ids.map((workspace_id) => ({
            user_id: authUserId,
            workspace_id,
            granted_by: grantedBy,
          }))

          const { error: accessError } = await supabaseAdmin
            .from("user_workspace_access")
            .insert(workspaceAccessRecords)

          if (accessError) {
            console.error("Failed to assign workspace access:", accessError)
            // Don't fail user creation if workspace access fails
            // The admin can manually assign access later
          } else {

          }
        } else {
          console.error("No admin_id provided, cannot assign workspace access")
        }
      }

      if (sendPasswordReset) {
        try {
          const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://proper-taskflow.vercel.app"
          const redirectUrl = `${baseUrl.replace(/\/$/, "")}/auth/setup-password`

          // Generate password reset token
          const { data: resetData, error: resetError } = await supabaseAdmin.auth.admin.generateLink({
            type: "recovery",
            email: email.trim(),
            options: {
              redirectTo: redirectUrl,
            },
          })

          if (resetError) {
            console.error("Failed to generate password reset link:", resetError)
          } else if (resetData?.properties?.action_link) {
            const { sendWelcomeEmail } = await import("@/lib/email")
            const emailResult = await sendWelcomeEmail({
              to: email.trim(),
              name: full_name.trim(),
              resetPasswordUrl: resetData.properties.action_link,
              isGuest: false,
            })

            if (!emailResult.success) {
              console.error("Welcome email failed:", emailResult.error)
            }
          }
        } catch (emailError) {
          console.error("Welcome email exception:", emailError)
        }
      }

      return NextResponse.json({
        user: authData.user,
        message: "User created successfully" + (sendPasswordReset ? ". A password setup email has been sent." : ""),
      })
    }
  } catch (error) {
    console.error("Unhandled error in API route:", error)

    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    )
  }
}
