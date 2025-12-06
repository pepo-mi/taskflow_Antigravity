"use client"

import type React from "react"
import { useState, useEffect, createContext, useContext, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"

interface UserPrivileges {
  can_create_workspaces: boolean
  can_create_projects: boolean
  can_create_tasks: boolean
}

interface User {
  id: string
  email: string
  name: string
  role: "admin" | "user" | "guest"
  organization: string
  full_name: string
  privileges?: UserPrivileges
}

interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

const AuthContext = createContext<{
  auth: AuthState
  login: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
} | null>(null)

const ALLOWED_DOMAIN = "@proper.am"
const ADMIN_EMAIL = "peno@proper.am"

const isValidEmail = (email: string): boolean => {
  return email.endsWith(ALLOWED_DOMAIN)
}

const determineUserRole = (email: string): "admin" | "user" | "guest" => {
  if (email === ADMIN_EMAIL) return "admin"
  if (email.endsWith(ALLOWED_DOMAIN)) return "user"
  return "guest"
}

const createFallbackUser = (userId: string, email: string): User => ({
  id: userId,
  email,
  name: email.split("@")[0],
  role: determineUserRole(email),
  organization: email.endsWith(ALLOWED_DOMAIN) ? "proper.am" : "external",
  full_name: email.split("@")[0],
  privileges:
    determineUserRole(email) === "admin"
      ? { can_create_workspaces: true, can_create_projects: true, can_create_tasks: true }
      : determineUserRole(email) === "user"
        ? { can_create_workspaces: false, can_create_projects: true, can_create_tasks: true }
        : { can_create_workspaces: false, can_create_projects: false, can_create_tasks: false },
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState>({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  })

  const loadUserProfile = useCallback(async (userId: string, email: string) => {
    try {
      const supabase = createClient()

      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Profile query timeout")), 5000),
      )

      const profileQueryPromise = async () => {
        const [regularUserQuery, guestUserQuery] = await Promise.all([
          supabase
            .from("users")
            .select("id, email, full_name, role, organization, privileges")
            .eq("id", userId)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("guest_users")
            .select("id, email, full_name, role, organization, privileges")
            .eq("id", userId)
            .limit(1)
            .maybeSingle(),
        ])

        return regularUserQuery.data ? regularUserQuery : guestUserQuery
      }

      let result
      try {
        result = await Promise.race([profileQueryPromise(), timeoutPromise])
      } catch (error) {
        const fallbackUser = createFallbackUser(userId, email)
        setAuth({
          user: fallbackUser,
          isLoading: false,
          isAuthenticated: true,
        })
        return
      }

      const { data: profile, error } = result as any

      if (error && error.message === "Supabase not configured") {
        const fallbackUser = createFallbackUser(userId, email)
        setAuth({
          user: fallbackUser,
          isLoading: false,
          isAuthenticated: true,
        })
        return
      }

      if (error || !profile) {
        const fallbackUser = createFallbackUser(userId, email)
        setAuth({
          user: fallbackUser,
          isLoading: false,
          isAuthenticated: true,
        })
        return
      }

      const user: User = {
        id: profile.id,
        email: profile.email,
        name: profile.full_name || email.split("@")[0],
        role: profile.role || determineUserRole(email),
        organization: profile.organization || (email.endsWith(ALLOWED_DOMAIN) ? "proper.am" : "external"),
        full_name: profile.full_name || email.split("@")[0],
        privileges: profile.privileges || {
          can_create_workspaces: profile.role === "admin",
          can_create_projects: profile.role === "admin" || profile.role === "user",
          can_create_tasks: profile.role === "admin" || profile.role === "user",
        },
      }

      setAuth({
        user,
        isLoading: false,
        isAuthenticated: true,
      })
    } catch (error) {
      if (error instanceof Error && error.message === "Profile query timeout") {
        console.debug("Profile query failed, using fallback user:", error.message)
      }
      const fallbackUser = createFallbackUser(userId, email)
      setAuth({
        user: fallbackUser,
        isLoading: false,
        isAuthenticated: true,
      })
    }
  }, [])

  useEffect(() => {
    let mounted = true

    const getInitialSession = async () => {
      try {
        const supabase = createClient()
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Session query timeout")), 5000),
        )

        const sessionPromise = supabase.auth.getSession()

        let sessionResult
        try {
          sessionResult = await Promise.race([sessionPromise, timeoutPromise])
        } catch (error) {
          if (mounted) {
            setAuth({
              user: null,
              isLoading: false,
              isAuthenticated: false,
            })
          }
          return
        }

        const {
          data: { session },
          error,
        } = sessionResult as any

        if (error) {
          if (mounted) {
            setAuth({
              user: null,
              isLoading: false,
              isAuthenticated: false,
            })
          }
          return
        }

        if (session?.user && mounted) {
          await loadUserProfile(session.user.id, session.user.email!)
        } else if (mounted) {
          setAuth({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          })
        }
      } catch (error) {
        console.debug("Session initialization failed, continuing without authentication:", error)
        if (mounted) {
          setAuth({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          })
        }
      }
    }

    getInitialSession()

    const setupAuthListener = async () => {
      try {
        const supabase = createClient()
        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (!mounted) return

          try {
            if (session?.user) {
              await loadUserProfile(session.user.id, session.user.email!)
            } else {
              setAuth({
                user: null,
                isLoading: false,
                isAuthenticated: false,
              })
            }
          } catch (error) {
            console.error("Error in auth state change:", error)
            setAuth({
              user: null,
              isLoading: false,
              isAuthenticated: false,
            })
          }
        })

        return () => {
          subscription.unsubscribe()
        }
      } catch (error) {
        console.debug("Failed to setup auth listener:", error instanceof Error ? error.message : error)
        return () => { } // Return empty cleanup function
      }
    }

    let cleanup: (() => void) | undefined

    setupAuthListener().then((cleanupFn) => {
      cleanup = cleanupFn
    })

    return () => {
      mounted = false
      cleanup?.()
    }
  }, [loadUserProfile])

  const login = useCallback(async (email: string, password: string) => {
    const supabase = createClient()

    // Input validation
    if (!email || !password) {
      throw new Error("Email and password are required")
    }

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.toLowerCase().trim(),
        password,
      })

      if (error) {
        if (error.message === "Supabase not configured") {


          // Create a demo user session
          const demoUserId = `demo-${Date.now()}`
          const demoUser = createFallbackUser(demoUserId, email.toLowerCase().trim())

          setAuth({
            user: demoUser,
            isLoading: false,
            isAuthenticated: true,
          })

          return // Successfully "logged in" with demo user
        }
        // Provide user-friendly error messages
        if (error.message.includes("Invalid login credentials")) {
          throw new Error("Invalid email or password")
        }
        throw error
      }
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = createClient()

    // Input validation
    if (!email || !password) {
      throw new Error("Email and password are required")
    }

    if (!isValidEmail(email)) {
      throw new Error(
        "Only proper.am domain users can create accounts. Contact your administrator to be added as a guest user.",
      )
    }

    if (password.length < 6) {
      throw new Error("Password must be at least 6 characters long")
    }

    try {
      const { error } = await supabase.auth.signUp({
        email: email.toLowerCase().trim(),
        password,
        options: {
          emailRedirectTo: process.env.NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL || `${window.location.origin}/protected`,
        },
      })

      if (error) {
        if (error.message === "Supabase not configured") {


          // Create a demo user session
          const demoUserId = `demo-${Date.now()}`
          const demoUser = createFallbackUser(demoUserId, email.toLowerCase().trim())

          setAuth({
            user: demoUser,
            isLoading: false,
            isAuthenticated: true,
          })

          return // Successfully "signed up" with demo user
        }
        if (error.message.includes("User already registered")) {
          throw new Error("An account with this email already exists")
        }
        throw error
      }
    } catch (error) {
      console.error("Sign up error:", error)
      throw error
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      const supabase = createClient()
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (session) {
        // Only attempt to sign out if there's an active session
        const { error } = await supabase.auth.signOut()
        if (error) {
          console.error("Logout error:", error)
          throw error
        }
      }

      // Always clear local state regardless of session status
      setAuth({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      })
    } catch (error) {
      console.error("Error during logout:", error)
      // Still clear local state even if logout fails
      setAuth({
        user: null,
        isLoading: false,
        isAuthenticated: false,
      })
      if (error instanceof Error && error.message.includes("Auth session missing")) {
        return // Successfully "logged out" since there was no session to begin with
      }
      throw error
    }
  }, [])

  return <AuthContext.Provider value={{ auth, login, signUp, logout }}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
