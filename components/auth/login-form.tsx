"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/hooks/use-auth"

export function LoginForm() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSignUp, setIsSignUp] = useState(false)
  const [isForgotPassword, setIsForgotPassword] = useState(false)
  const { login, signUp } = useAuth()

  const isValidEmail = (email: string) => {
    return email.endsWith("@proper.am")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    if (isSignUp) {
      if (!isValidEmail(email)) {
        setError(
          "Only proper.am domain emails can create accounts. Contact your administrator to be added as a guest user.",
        )
        setIsLoading(false)
        return
      }

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
    }

    try {
      if (isSignUp) {
        await signUp(email, password)
        setSuccess("Account created successfully! Please check your email to verify your account, then sign in.")
        setIsSignUp(false)
        setPassword("")
        setConfirmPassword("")
      } else {
        await login(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `${isSignUp ? "Sign up" : "Login"} failed`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setIsLoading(true)

    if (!email) {
      setError("Please enter your email address")
      setIsLoading(false)
      return
    }

    try {
      const response = await fetch("/api/admin/send-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) {
        let errorData
        try {
          errorData = await response.json()
        } catch (parseError) {
          setError(`Server error (${response.status}). Please try again.`)
          setIsLoading(false)
          return
        }

        if (response.status === 429) {
          setError(`Rate limit exceeded. Please wait ${errorData.retryAfter || 60} seconds before trying again.`)
        } else if (response.status === 404) {
          setError("No account found with this email address. Please contact your administrator.")
        } else {
          setError(errorData.message || errorData.error || "Failed to send reset email")
        }
        setIsLoading(false)
        return
      }

      const data = await response.json()
      setSuccess(data.message || "Password reset email sent! Check your inbox and follow the instructions.")
      setIsForgotPassword(false)
    } catch (err) {
      setError("Network error. Please check your connection and try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl font-serif font-bold text-primary">TaskFlow</CardTitle>
          <CardDescription>
            {isSignUp
              ? "Create your proper.am account"
              : isForgotPassword
                ? "Reset your password"
                : "Sign in to your account"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isForgotPassword ? (
            <form onSubmit={handleForgotPassword} className="space-y-4">
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.email@domain.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Sending..." : "Send Reset Email"}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full bg-transparent"
                onClick={() => {
                  setIsForgotPassword(false)
                  setError("")
                  setSuccess("")
                }}
              >
                Back to Sign In
              </Button>
            </form>
          ) : (
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
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={isSignUp ? "your.name@proper.am" : "your.email@domain.com"}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>

              {isSignUp && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
              )}

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading
                  ? isSignUp
                    ? "Creating account..."
                    : "Signing in..."
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
              </Button>
            </form>
          )}

          <div className="mt-4 text-sm text-muted-foreground text-center">
            {!isForgotPassword && (
              <>
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setIsSignUp(false)
                        setError("")
                        setSuccess("")
                      }}
                    >
                      Sign in
                    </button>
                  </>
                ) : (
                  <>
                    First time user?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setIsSignUp(true)
                        setError("")
                        setSuccess("")
                      }}
                    >
                      Create account
                    </button>
                    {" • "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => {
                        setIsForgotPassword(true)
                        setError("")
                        setSuccess("")
                      }}
                    >
                      Forgot password?
                    </button>
                  </>
                )}
              </>
            )}
            <br />
            <span className="text-xs">
              {isSignUp
                ? "Only proper.am domain users can create accounts."
                : "Guest users: Use the email provided by your administrator."}
            </span>
            <div className="mt-3 p-3 bg-muted rounded-md text-left">
              <p className="font-medium text-xs mb-2">First-time setup:</p>
              <ol className="text-xs space-y-1 list-decimal list-inside">
                <li>Users with proper.am email addresses can create their own accounts</li>
                <li>Publish the app to enable email verification</li>
                <li>Check email and click verification link</li>
                <li>Sign in to access the TaskFlow dashboard</li>
              </ol>
              <p className="text-xs mt-2 font-medium">
                Note: Guest users from outside the organization will be invited by the admin and can sign in with their
                provided credentials.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
