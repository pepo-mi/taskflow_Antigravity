"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Mail, Lock, ArrowRight } from "lucide-react"

export default function SetupPasswordLanding() {
  const router = useRouter()
  const [email, setEmail] = useState<string>("")
  const [hasToken, setHasToken] = useState(false)

  useEffect(() => {
    // Check if we have a recovery token in the URL hash
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get("access_token")
    const type = params.get("type")





    if (accessToken && type === "recovery") {
      setHasToken(true)
      // Try to extract email from token (it's a JWT)
      try {
        const payload = JSON.parse(atob(accessToken.split(".")[1]))
        if (payload.email) {
          setEmail(payload.email)
        }
      } catch (e) {
        console.error("[v0] Failed to parse token:", e)
      }
    }
  }, [])

  const handleContinue = () => {

    // Redirect to the actual reset password page with the token intact
    router.push(`/auth/reset-password${window.location.hash}`)
  }

  if (!hasToken) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
              <Mail className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle>Invalid Link</CardTitle>
            <CardDescription>This password setup link is invalid or has already been used.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-center text-sm text-muted-foreground">
              Please contact your administrator to request a new invitation email.
            </p>
            <Button onClick={() => router.push("/")} variant="outline" className="w-full">
              Go to TaskFlow Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Lock className="h-6 w-6 text-primary" />
          </div>
          <CardTitle>Welcome to TaskFlow!</CardTitle>
          <CardDescription>You've been invited to join TaskFlow as a guest user.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {email && (
            <div className="rounded-lg bg-muted p-4">
              <p className="text-sm text-muted-foreground">Setting up account for:</p>
              <p className="font-medium">{email}</p>
            </div>
          )}

          <div className="space-y-3">
            <h3 className="font-medium">Next Steps:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  1
                </span>
                <span>Click the button below to continue</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  2
                </span>
                <span>Create a secure password for your account</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
                  3
                </span>
                <span>Start collaborating with your team</span>
              </li>
            </ul>
          </div>

          <Button onClick={handleContinue} className="w-full" size="lg">
            Set Up My Password
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>

          <p className="text-center text-xs text-muted-foreground">
            This link will expire in 1 hour for security purposes.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
