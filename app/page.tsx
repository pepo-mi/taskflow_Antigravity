"use client"

import { useAuth } from "@/hooks/use-auth"
import { Dashboard } from "@/components/dashboard/dashboard"
import { LoginForm } from "@/components/auth/login-form"

export default function HomePage() {
  const { auth } = useAuth()

  if (auth.isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    )
  }

  if (!auth.isAuthenticated) {
    return <LoginForm />
  }

  return <Dashboard />
}
