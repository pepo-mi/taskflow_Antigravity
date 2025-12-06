import { Resend } from "resend"

const RESEND_API_KEY = process.env.RESEND_API_KEY

if (!RESEND_API_KEY) {
  console.warn(
    "[v0] RESEND_API_KEY is not set. Welcome emails will not be sent. " +
    "Get your API key at https://resend.com/api-keys and add it to your environment variables.",
  )
}

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null

interface WelcomeEmailParams {
  to: string
  name: string
  resetPasswordUrl: string
  isGuest: boolean
}

export async function sendWelcomeEmail({ to, name, resetPasswordUrl, isGuest }: WelcomeEmailParams) {
  if (!resend || !RESEND_API_KEY) {
    console.warn(
      "[v0] Skipping welcome email - RESEND_API_KEY not configured. " +
      "To enable welcome emails:\n" +
      "1. Sign up at https://resend.com\n" +
      "2. Get your API key from https://resend.com/api-keys\n" +
      "3. Add RESEND_API_KEY to your environment variables\n" +
      "4. Verify a domain at https://resend.com/domains\n" +
      "5. Add RESEND_FROM_EMAIL (e.g., noreply@proper.am) to your environment variables",
    )
    return {
      success: false,
      error: "Email service not configured. User created successfully but welcome email was not sent.",
    }
  }

  try {
    const fromEmail = process.env.RESEND_FROM_EMAIL || "onboarding@resend.dev"
    const fromName = "TaskFlow - PROPER Studios"

    const setupPasswordUrl = resetPasswordUrl.replace("/auth/reset-password", "/auth/setup-password")

    const { data, error } = await resend.emails.send({
      from: `${fromName} <${fromEmail}>`,
      to: [to],
      subject: "Welcome to TaskFlow - PROPER Studios",
      html: `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Welcome to TaskFlow</title>
          </head>
          <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 40px 20px; text-align: center; border-radius: 8px 8px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 28px; font-weight: 600;">Welcome to TaskFlow</h1>
              <p style="color: rgba(255, 255, 255, 0.9); margin: 10px 0 0 0; font-size: 16px;">PROPER Studios' Task Management System</p>
            </div>
            
            <div style="background: #ffffff; padding: 40px 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
              <p style="font-size: 16px; margin-bottom: 20px;">Hi ${name},</p>
              
              <p style="font-size: 16px; margin-bottom: 20px;">
                ${isGuest
          ? "You've been invited to join TaskFlow as a guest user. You'll have access to specific workspaces assigned to you by the admin."
          : "Your account has been created on TaskFlow, PROPER Studios' collaborative task management platform."
        }
              </p>
              
              <p style="font-size: 16px; margin-bottom: 30px;">
                To get started, please set up your password by clicking the button below:
              </p>
              
              <div style="text-align: center; margin: 30px 0;">
                <a href="${setupPasswordUrl}" 
                   style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px; display: inline-block;">
                  Set Up Your Password
                </a>
              </div>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
                If the button doesn't work, copy and paste this link into your browser:<br>
                <a href="${setupPasswordUrl}" style="color: #667eea; word-break: break-all;">${setupPasswordUrl}</a>
              </p>
              
              <p style="font-size: 14px; color: #6b7280; margin-top: 20px;">
                If you didn't expect this email, please contact your administrator.
              </p>
            </div>
            
            <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
              <p style="margin: 0;">© ${new Date().getFullYear()} PROPER Studios. All rights reserved.</p>
              <p style="margin: 10px 0 0 0;">TaskFlow - Collaborative Task Management</p>
            </div>
          </body>
        </html>
      `,
    })

    if (error) {
      console.error("[v0] Failed to send welcome email:", error.message || error)
      return { success: false, error: error.message || "Failed to send email" }
    }


    return { success: true, data }
  } catch (error: any) {
    console.error("[v0] Exception sending welcome email:", error.message || error)
    return { success: false, error: error.message || "Failed to send email" }
  }
}
