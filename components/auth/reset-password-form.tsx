"use client"

import type React from "react"
import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"
import { AlertCircle, Mail } from "lucide-react"

export function ResetPasswordForm() {
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isValidToken, setIsValidToken] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const router = useRouter()

  const supabase = createClient()

  useEffect(() => {
    console.log("[v0] Reset password page loaded")
    console.log("[v0] Full URL:", window.location.href)
    console.log("[v0] Hash:", window.location.hash)

    const hashParams = new URLSearchParams(window.location.hash.substring(1))
    const accessToken = hashParams.get("access_token")
    const type = hashParams.get("type")
    const errorParam = hashParams.get("error")
    const errorDescription = hashParams.get("error_description")
    const refreshToken = hashParams.get("refresh_token")
    const expiresAt = hashParams.get("expires_at")
    const expiresIn = hashParams.get("expires_in")

    console.log("[v0] URL Parameters:", {
      accessToken: accessToken ? `${accessToken.substring(0, 20)}...` : null,
      type,
      error: errorParam,
      errorDescription,
      refreshToken: refreshToken ? `${refreshToken.substring(0, 20)}...` : null,
      expiresAt,
      expiresIn,
    })

    if (errorParam) {
      console.log("[v0] Error in URL hash:", errorParam, errorDescription)
      if (errorParam === "access_denied" && errorDescription?.includes("expired")) {
        setError("Your password setup link has expired. Password setup links are valid for 1 hour after being sent.")
        setIsExpired(true)
      } else if (errorParam === "access_denied" && errorDescription?.includes("invalid")) {
        setError("This password setup link is invalid or has already been used.")
        setIsExpired(true)
      } else {
        setError("There was an issue with your setup link. Please contact your administrator for assistance.")
        setIsExpired(true)
      }
      return
    }

    if (accessToken && type === "recovery") {
      console.log("[v0] Valid recovery token found, setting session")
      setIsValidToken(true)
      supabase.auth
        .setSession({
          access_token: accessToken,
          refresh_token: refreshToken || "",
        })
        .then(({ error }) => {
          if (error) {
            console.error("[v0] Error setting session:", error)
            setError("Failed to validate your setup link. Please contact your administrator.")
            setIsExpired(true)
            setIsValidToken(false)
          } else {
            console.log("[v0] Session set successfully")
          }
        })
    } else {
      console.log("[v0] Invalid token or type:", { accessToken: !!accessToken, type })
      setError("Invalid or expired setup link. Please contact your administrator for a new invitation.")
      setIsExpired(true)
    }
  }, [supabase.auth])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    console.log("[v0] Attempting to update password")

    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setIsLoading(false)
      return
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setIsLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      })

      if (error) {
        console.error("[v0] Error updating password:", error)
        throw error
      }

      console.log("[v0] Password updated successfully")
      setSuccess("Password updated successfully! Redirecting to login...")

      setTimeout(() => {
        window.location.href = "/"
      }, 2000)
    } catch (err) {
      console.error("[v0] Password update failed:", err)
      setError(err instanceof Error ? err.message : "Failed to update password")
    } finally {
      setIsLoading(false)
    }
  }

  if (!isValidToken && !error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif font-bold text-primary">
            {isValidToken ? "TaskFlow - Set Your Password" : "TaskFlow - Link Expired"}
          </CardTitle>
          <CardDescription>
            {isValidToken ? "Create your password to access TaskFlow" : "Password setup link is no longer valid"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isValidToken ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert>
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Enter new password"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  placeholder="Confirm new password"
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Setting password..." : "Set Password"}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="ml-2">{error}</AlertDescription>
              </Alert>

              <div className="bg-muted p-4 rounded-lg space-y-3">
                <div className="flex items-start gap-2">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium">What to do next:</p>
                    <p className="text-sm text-muted-foreground">
                      Contact your TaskFlow administrator to request a new password setup link. They can resend your
                      invitation from the admin dashboard.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Button onClick={() => router.push("/")} className="w-full">
                  Go to TaskFlow Login
                </Button>
                <Button onClick={() => window.location.reload()} className="w-full" variant="outline">
                  Try Again
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
