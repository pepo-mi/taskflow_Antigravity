import { createClient } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json()

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 })
    }

    const { createServerClient, requireAdmin } = await import("@/lib/supabase/server")
    const supabase = await createServerClient()
    const { authorized, error: authError } = await requireAdmin(supabase)

    if (!authorized) {
      console.error("Unauthorized password reset attempt:", authError)
      return NextResponse.json({ error: "Unauthorized: Admin access required" }, { status: 403 })
    }

    const requestUrl = new URL(request.url)
    const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`

    const { error } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${baseUrl}/auth/reset-password`,
      data: {
        app_name: "TaskFlow",
        organization: "proper.am",
        support_email: "support@proper.am",
        custom_message:
          "Welcome to TaskFlow! Click the link below to reset your password and access your project management account.",
      },
    })

    if (error) {
      console.error("Password reset error:", error)

      // Handle rate limiting specifically
      if (error.message.includes("For security purposes, you can only request this after")) {
        const match = error.message.match(/after (\d+) seconds/)
        const seconds = match ? match[1] : "60"
        return NextResponse.json(
          {
            error: "Rate limit exceeded",
            message: `Please wait ${seconds} seconds before requesting another password reset email.`,
            retryAfter: Number.parseInt(seconds),
          },
          { status: 429 },
        )
      }

      // Handle other specific errors
      if (error.message.includes("User not found")) {
        return NextResponse.json(
          {
            error: "User not found",
            message: "No account found with this email address.",
          },
          { status: 404 },
        )
      }

      return NextResponse.json(
        {
          error: "Failed to send password reset email",
          message: error.message,
        },
        { status: 500 },
      )
    }

    return NextResponse.json({
      message:
        "Password reset email sent successfully. Please check your inbox and follow the instructions to set up your TaskFlow password.",
    })
  } catch (error) {
    console.error("Password reset API error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PUT() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function DELETE() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}

export async function PATCH() {
  return NextResponse.json({ error: "Method not allowed" }, { status: 405 })
}
