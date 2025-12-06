"use client"

import { DialogTrigger } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Users,
  Building2,
  FolderOpen,
  CheckSquare,
  Plus,
  Edit2,
  Trash2,
  UserPlus,
  Archive,
  ChevronDown,
  RotateCcw,
  Package,
  BarChart3,
  Activity,
  Search,
  Filter,
} from "lucide-react"

import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "@/hooks/use-toast"
import { sanitizeContent } from "@/lib/content-sanitizer"

interface User {
  id: string
  email: string
  full_name: string
  role: string
  organization: string
  created_at: string
  privileges?: {
    can_create_workspaces: boolean
    can_create_projects: boolean
    can_create_tasks: boolean
  }
}

interface Workspace {
  id: string
  name: string
  description: string | null
  created_at: string
  project_count?: number
}

interface Project {
  id: string
  name: string
  description: string | null
  workspace_name: string
  creator_name: string
  created_at: string
  task_count?: number
  completed?: boolean
  archived?: boolean
  archived_at?: string
}

interface ArchivedProject {
  id: string
  name: string
  description: string | null
  workspace_name: string
  creator_name: string
  created_at: string
  archived_at: string
  archived_snapshot: {
    tasks: any[]
    files: { name: string; type: string; size: number }[]
    posts: any[]
    archived_date: string
    project_metadata: {
      name: string
      description: string
      created_at: string
    }
  }
}

interface AdminStats {
  total_users: number
  total_workspaces: number
  total_projects: number
  total_tasks: number
}

const formatDate = (dateString: string | null | undefined) => {
  if (!dateString) return "Unknown"
  const date = new Date(dateString)
  return isNaN(date.getTime()) ? "Unknown" : date.toLocaleDateString()
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([])
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [archivedProjects, setArchivedProjects] = useState<ArchivedProject[]>([])
  const [selectedArchivedProject, setSelectedArchivedProject] = useState<ArchivedProject | null>(null)
  const [isArchivedDetailOpen, setIsArchivedDetailOpen] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [isEditProjectDialogOpen, setIsEditProjectDialogOpen] = useState(false)
  const [editProjectName, setEditProjectName] = useState("")
  const [editProjectDescription, setEditProjectDescription] = useState("")
  const [stats, setStats] = useState<AdminStats>({
    total_users: 0,
    total_workspaces: 0,
    total_projects: 0,
    total_tasks: 0,
  })
  const [isLoading, setIsLoading] = useState(true)
  const [isUserDialogOpen, setIsUserDialogOpen] = useState(false)
  const [isEditUserDialogOpen, setIsEditUserDialogOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<User | null>(null)
  const [editUserName, setEditUserName] = useState("")
  const [editUserRole, setEditUserRole] = useState("")
  const [editUserPrivileges, setEditUserPrivileges] = useState({
    can_create_workspaces: false,
    can_create_projects: false,
    can_create_tasks: false,
  })
  const [editUserWorkspaces, setEditUserWorkspaces] = useState<string[]>([])
  const [isWorkspaceDialogOpen, setIsWorkspaceDialogOpen] = useState(false)
  const [newUserEmail, setNewUserEmail] = useState("")
  const [newUserName, setNewUserName] = useState("")
  const [newUserRole, setNewUserRole] = useState("guest")
  const [newWorkspaceName, setNewWorkspaceName] = useState("")
  const [newWorkspaceDescription, setNewWorkspaceDescription] = useState("")
  const [editingWorkspace, setEditingWorkspace] = useState<any>(null)
  const [editWorkspace, setEditWorkspace] = useState({ name: "", description: "" })
  const [isEditingWorkspace, setIsEditingWorkspace] = useState(false)
  const { auth } = useAuth()
  const supabase = createClient()
  const [isCreateProjectDialogOpen, setIsCreateProjectDialogOpen] = useState(false)
  const [newProject, setNewProject] = useState({ name: "", description: "", workspace_id: "" })
  const [isCreating, setIsCreating] = useState(false)
  const [performanceData, setPerformanceData] = useState<any[]>([])
  const [performanceTimeframe, setPerformanceTimeframe] = useState("annual")
  const [loadingPerformance, setLoadingPerformance] = useState(false)
  const [performanceCache, setPerformanceCache] = useState(new Map())
  const [lastFetchTime, setLastFetchTime] = useState(0)
  const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
  const [newUserPrivileges, setNewUserPrivileges] = useState({
    can_create_workspaces: false,
    can_create_projects: false,
    can_create_tasks: false,
  })
  const [deletingUsers, setDeletingUsers] = useState<Set<string>>(new Set())
  const [selectedWorkspaces, setSelectedWorkspaces] = useState<string[]>([])

  // Search and Filter State
  const [userSearch, setUserSearch] = useState("")
  const [userRoleFilter, setUserRoleFilter] = useState<"all" | "admin" | "user" | "guest">("all")
  const [projectSearch, setProjectSearch] = useState("")
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  useEffect(() => {
    fetchAdminData()
    fetchActivityLogs()
  }, [])

  const handleSendPasswordReset = async (email: string) => {
    try {
      const response = await fetch("/api/admin/send-password-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      })

      if (!response.ok) throw new Error("Failed to send password reset email")

      alert("Password reset email sent")
    } catch (error) {
      console.error("Error sending password reset:", error)
      alert("Failed to send password reset email")
    }
  }

  const fetchActivityLogs = async () => {
    setIsLoadingLogs(true)
    try {
      const { data, error } = await supabase
        .from("admin_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50)

      if (error) throw error
      setActivityLogs(data || [])
    } catch (error) {
      console.error("Error fetching activity logs:", error)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  // Filtered Data
  const filteredUsers = users.filter(user => {
    const matchesSearch = user.full_name.toLowerCase().includes(userSearch.toLowerCase()) ||
      user.email.toLowerCase().includes(userSearch.toLowerCase())
    const matchesRole = userRoleFilter === "all" || user.role === userRoleFilter
    return matchesSearch && matchesRole
  })

  const filteredProjects = projects.filter(project => {
    return project.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
      project.description?.toLowerCase().includes(projectSearch.toLowerCase())
  })

  const fetchPerformanceData = async () => {
    const cacheKey = `${performanceTimeframe}-${auth.user?.id}`
    const now = Date.now()

    if (performanceCache.has(cacheKey) && now - lastFetchTime < CACHE_DURATION) {
      setPerformanceData(performanceCache.get(cacheKey))
      return
    }

    setLoadingPerformance(true)
    try {
      const startDate = new Date()

      switch (performanceTimeframe) {
        case "monthly":
          startDate.setMonth(startDate.getMonth() - 1)
          break
        case "quarterly":
          startDate.setMonth(startDate.getMonth() - 3)
          break
        case "annual":
          startDate.setFullYear(startDate.getFullYear() - 1)
          break
      }

      // Fetch both regular users and guest users
      const [regularUsersResult, guestUsersResult] = await Promise.all([
        supabase
          .from("users")
          .select("id, full_name, email, role, created_at, privileges")
          .order("created_at", { ascending: false }),
        supabase
          .from("guest_users")
          .select("id, full_name, email, role, created_at")
          .order("created_at", { ascending: false }),
      ])

      const regularUsers = regularUsersResult.data || []
      const guestUsers = guestUsersResult.data || []
      const allUsers = [...regularUsers, ...guestUsers]

      if (allUsers.length === 0) {
        setPerformanceData([])
        return
      }

      const performanceMetrics = await Promise.all(
        allUsers.map(async (user) => {
          try {
            // Guest users don't have performance metrics (view-only)
            if (user.role === "guest") {
              return {
                ...user,
                metrics: {
                  projectsCreated: 0,
                  tasksCompleted: 0,
                  totalTasks: 0,
                  projectsOnTime: 0,
                  completionRate: 0,
                  avgCompletionTime: 0,
                },
              }
            }

            const [
              { count: projectsCreated },
              { count: tasksCompleted },
              { count: totalTasks },
              { data: completedProjects },
              { data: userTasks },
            ] = await Promise.all([
              supabase
                .from("projects")
                .select("*", { count: "exact", head: true })
                .eq("created_by", user.id)
                .gte("created_at", startDate.toISOString()),

              supabase
                .from("tasks")
                .select("*", { count: "exact", head: true })
                .eq("assigned_to", user.id)
                .eq("status", "done")
                .gte("updated_at", startDate.toISOString()),

              supabase
                .from("tasks")
                .select("*", { count: "exact", head: true })
                .eq("assigned_to", user.id)
                .gte("created_at", startDate.toISOString()),

              supabase
                .from("projects")
                .select("due_date, updated_at, completed")
                .eq("created_by", user.id)
                .eq("completed", true)
                .gte("updated_at", startDate.toISOString())
                .not("due_date", "is", null),

              supabase
                .from("tasks")
                .select("created_at, updated_at")
                .eq("assigned_to", user.id)
                .eq("status", "done")
                .gte("updated_at", startDate.toISOString()),
            ])

            const projectsOnTime =
              completedProjects?.filter((project) => new Date(project.updated_at) <= new Date(project.due_date))
                .length || 0

            const avgCompletionTime =
              userTasks?.length > 0
                ? userTasks.reduce((acc, task) => {
                  const completionTime = new Date(task.updated_at) - new Date(task.created_at)
                  return acc + completionTime
                }, 0) /
                userTasks.length /
                (1000 * 60 * 60 * 24)
                : 0

            return {
              ...user,
              metrics: {
                projectsCreated: projectsCreated || 0,
                tasksCompleted: tasksCompleted || 0,
                totalTasks: totalTasks || 0,
                projectsOnTime,
                completionRate: totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0,
                avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
              },
            }
          } catch (userError) {
            console.error(`Error fetching metrics for user ${user.email}:`, userError)
            return {
              ...user,
              metrics: {
                projectsCreated: 0,
                tasksCompleted: 0,
                totalTasks: 0,
                projectsOnTime: 0,
                completionRate: 0,
                avgCompletionTime: 0,
              },
            }
          }
        }),
      )

      setPerformanceCache((prev) => new Map(prev.set(cacheKey, performanceMetrics)))
      setLastFetchTime(now)
      setPerformanceData(performanceMetrics)
    } catch (error) {
      console.error("Error fetching performance data:", error)
      setPerformanceData([])
      toast({
        title: "Error",
        description: "Failed to load performance data",
        variant: "destructive",
      })
    } finally {
      setLoadingPerformance(false)
    }
  }

  useEffect(() => {
    if (auth.user?.role === "admin") {
      const timeoutId = setTimeout(() => {
        fetchPerformanceData()
      }, 300) // 300ms debounce

      return () => clearTimeout(timeoutId)
    }
  }, [performanceTimeframe, auth.user])

  const fetchAdminData = async () => {
    try {
      // Fetch both regular users and guest users
      const [regularUsersResult, guestUsersResult] = await Promise.all([
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("guest_users").select("*").order("created_at", { ascending: false }),
      ])

      if (regularUsersResult.error) throw regularUsersResult.error
      if (guestUsersResult.error) throw guestUsersResult.error

      // Combine and sort all users by creation date
      const regularUsers = regularUsersResult.data || []
      const guestUsers = guestUsersResult.data || []
      const allUsers = [...regularUsers, ...guestUsers].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))

      // Fetch workspaces with project count
      const { data: workspacesData, error: workspacesError } = await supabase
        .from("workspaces")
        .select(`
          *,
          projects(count)
        `)
        .order("created_at", { ascending: false })

      if (workspacesError) throw workspacesError

      // Fetch projects with workspace and creator info
      const { data: projectsData, error: projectsError } = await supabase
        .from("projects")
        .select(`
          *,
          workspace:workspaces(name),
          creator:users!projects_created_by_fkey(full_name),
          tasks(count)
        `)
        .eq("archived", false)
        .order("created_at", { ascending: false })

      if (projectsError) throw projectsError

      const { data: archivedData, error: archivedError } = await supabase
        .from("projects")
        .select(`
          *,
          workspace:workspaces(name),
          creator:users!projects_created_by_fkey(full_name)
        `)
        .eq("archived", true)
        .order("archived_at", { ascending: false })

      if (archivedError) throw archivedError

      const { count: tasksCount, error: tasksError } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })

      if (tasksError) throw tasksError

      setUsers(allUsers)
      setWorkspaces(
        workspacesData?.map((w) => ({
          ...w,
          project_count: w.projects?.[0]?.count || 0,
        })) || [],
      )
      setProjects(
        projectsData?.map((p) => ({
          ...p,
          workspace_name: p.workspace?.name || "Unknown",
          creator_name: p.creator?.full_name || "Unknown",
          task_count: p.tasks?.[0]?.count || 0,
        })) || [],
      )
      setArchivedProjects(
        archivedData?.map((p) => ({
          ...p,
          workspace_name: p.workspace?.name || "Unknown",
          creator_name: p.creator?.full_name || "Unknown",
        })) || [],
      )
      setStats({
        total_users: allUsers?.length || 0,
        total_workspaces: workspacesData?.length || 0,
        total_projects: projectsData?.length || 0,
        total_tasks: tasksCount || 0,
      })
    } catch (error) {
      console.error("Error fetching admin data:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to load admin data"
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const fetchUsers = useCallback(async () => {
    try {
      setIsLoading(true)

      const [regularUsersResult, guestUsersResult] = await Promise.all([
        supabase.from("users").select("*").order("created_at", { ascending: false }),
        supabase.from("guest_users").select("*").order("created_at", { ascending: false }),
      ])

      if (regularUsersResult.error) {
        console.error("Error fetching regular users:", regularUsersResult.error)
        throw regularUsersResult.error
      }

      if (guestUsersResult.error) {
        console.error("Error fetching guest users:", guestUsersResult.error)
        throw guestUsersResult.error
      }

      const regularUsers = regularUsersResult.data || []
      const guestUsers = guestUsersResult.data || []

      // Create a Map to ensure unique users by ID
      const userMap = new Map()

      // Add regular users first
      regularUsers.forEach((user) => {
        userMap.set(user.id, user)
      })

      // Add guest users, but don't overwrite if ID already exists
      guestUsers.forEach((user) => {
        if (!userMap.has(user.id)) {
          userMap.set(user.id, user)
        } else {
          console.warn("[v0] Duplicate user ID found:", user.id, "- skipping guest user entry")
        }
      })

      const allUsers = Array.from(userMap.values())

      setUsers(allUsers)
    } catch (error) {
      console.error("Error fetching user:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }, [supabase, toast])

  const createUser = async () => {
    if (!newUserEmail.trim() || !newUserName.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    if (newUserRole === "guest" && selectedWorkspaces.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one workspace for the guest user",
        variant: "destructive",
      })
      return
    }

    setIsCreating(true)
    try {
      const response = await fetch("/api/admin/create-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: newUserEmail.trim(),
          full_name: newUserName.trim(),
          role: newUserRole,
          sendPasswordReset: true,
          privileges: newUserPrivileges,
          workspace_ids: newUserRole === "guest" ? selectedWorkspaces : undefined,
          admin_id: auth.user?.id,
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to create user")
      }

      await fetchUsers()
      setIsUserDialogOpen(false)
      setNewUserEmail("")
      setNewUserName("")
      setNewUserRole("guest")
      setNewUserPrivileges({
        can_create_workspaces: false,
        can_create_projects: false,
        can_create_tasks: false,
      })
      setSelectedWorkspaces([])

      toast({
        title: "Success",
        description: result.message || "User created successfully",
      })
    } catch (error) {
      console.error("Error creating user:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to create user. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }

  const openEditUser = (user: User) => {
    // Clear previous state first to prevent showing stale data
    setEditUserWorkspaces([])

    setEditingUser(user)
    setEditUserName(user.full_name)
    setEditUserRole(user.role)
    setEditUserPrivileges(
      user.privileges || {
        can_create_workspaces: false,
        can_create_projects: false,
        can_create_tasks: false,
      },
    )
    // Fetch workspace access for both guests and regular users
    if (user.role === "guest" || user.role === "user") {
      fetchUserWorkspaces(user.id, user.role)
    }
    setIsEditUserDialogOpen(true)
  }

  const fetchUserWorkspaces = async (userId: string, role: string) => {
    try {
      // Query the appropriate table based on role
      const tableName = role === "guest" ? "guest_workspace_access" : "user_workspace_access"
      const idColumn = role === "guest" ? "guest_id" : "user_id"

      const { data, error } = await supabase
        .from(tableName)
        .select("workspace_id")
        .eq(idColumn, userId)

      if (error) {
        console.error("Error fetching user workspaces:", error)
        setEditUserWorkspaces([])
        return
      }

      setEditUserWorkspaces(data?.map((item: { workspace_id: string }) => item.workspace_id) || [])
    } catch (error) {
      console.error("Error fetching user workspaces:", error)
      setEditUserWorkspaces([])
    }
  }

  const updateUser = async () => {
    if (!editingUser || !editUserName.trim()) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      })
      return
    }

    try {
      const response = await fetch("/api/admin/update-user", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          userId: editingUser.id,
          full_name: editUserName.trim(),
          role: editUserRole,
          privileges: editUserPrivileges,
          // Send workspace_ids for both guests and regular users (not admins)
          workspace_ids: editUserRole !== "admin" ? editUserWorkspaces : undefined,
          admin_id: auth.user?.id, // Pass admin ID for workspace access tracking
        }),
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || "Failed to update user")
      }

      await fetchUsers()
      setIsEditUserDialogOpen(false)
      setEditingUser(null)

      toast({
        title: "Success",
        description: "User updated successfully. User will see changes on next login.",
      })
    } catch (error) {
      console.error("Error updating user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to update user",
        variant: "destructive",
      })
    }
  }

  const sendPasswordReset = async (email: string) => {
    try {
      const response = await fetch("/api/admin/send-password-reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      })

      const result = await response.json()

      if (!response.ok) {
        // Handle rate limiting specifically
        if (response.status === 429) {
          const retryAfter = result.retryAfter || 60
          toast({
            title: "Rate Limit Exceeded",
            description: `Please wait ${retryAfter} seconds before sending another password reset email.`,
            variant: "destructive",
          })
          return
        }

        // Handle user not found
        if (response.status === 404) {
          toast({
            title: "User Not Found",
            description: result.message || "No account found with this email address.",
            variant: "destructive",
          })
          return
        }

        throw new Error(result.message || result.error || "Failed to send password reset")
      }

      toast({
        title: "Success",
        description: result.message || "Password reset email sent successfully",
      })
    } catch (error) {
      console.error("Error sending password reset:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send password reset email",
        variant: "destructive",
      })
    }
  }

  const createWorkspace = async () => {
    if (!newWorkspaceName.trim()) {
      toast({
        title: "Error",
        description: "Please enter a workspace name",
        variant: "destructive",
      })
      return
    }

    try {
      const { data, error } = await supabase
        .from("workspaces")
        .insert({
          name: newWorkspaceName.trim(),
          description: newWorkspaceDescription.trim() || null,
          created_by: auth.user?.id,
        })
        .select()
        .single()

      if (error) throw error

      setWorkspaces([{ ...data, project_count: 0 }, ...workspaces])
      setNewWorkspaceName("")
      setNewWorkspaceDescription("")
      setIsWorkspaceDialogOpen(false)

      toast({
        title: "Success",
        description: "Workspace created successfully",
      })
    } catch (error) {
      console.error("Error creating workspace:", error)
      toast({
        title: "Error",
        description: "Failed to create workspace",
        variant: "destructive",
      })
    }
  }

  const updateWorkspace = async () => {
    if (!editingWorkspace || !editWorkspace.name.trim()) return

    setIsEditingWorkspace(true)
    try {
      const { data, error } = await supabase
        .from("workspaces")
        .update({
          name: editWorkspace.name.trim(),
          description: editWorkspace.description.trim() || null,
        })
        .eq("id", editingWorkspace.id)
        .select()
        .single()

      if (error) throw error

      setWorkspaces(
        workspaces.map((w) =>
          w.id === editingWorkspace.id ? { ...data, project_count: editingWorkspace.project_count } : w,
        ),
      )
      setEditingWorkspace(null)
      setEditWorkspace({ name: "", description: "" })

      toast({
        title: "Success",
        description: "Workspace updated successfully",
      })
    } catch (error) {
      console.error("Error updating workspace:", error)
      toast({
        title: "Error",
        description: "Failed to update workspace",
        variant: "destructive",
      })
    } finally {
      setIsEditingWorkspace(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (deletingUsers.has(userId)) {
      return
    }

    try {
      setDeletingUsers((prev) => new Set(prev).add(userId))

      const response = await fetch("/api/admin/delete-user", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ userId }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to delete user")
      }

      const result = await response.json()

      toast({
        title: "Success",
        description: result.message,
      })

      setUsers((prevUsers) => prevUsers.filter((user) => user.id !== userId))

      // Refresh the user list to ensure consistency
      await fetchUsers()
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setDeletingUsers((prev) => {
        const newSet = new Set(prev)
        newSet.delete(userId)
        return newSet
      })
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    if (
      !confirm(
        "Are you sure you want to delete this workspace? This will also delete all projects and tasks within it.",
      )
    )
      return

    try {
      const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId)

      if (error) throw error

      setWorkspaces(workspaces.filter((w) => w.id !== workspaceId))

      toast({
        title: "Success",
        description: "Workspace deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting workspace:", error)
      toast({
        title: "Error",
        description: "Failed to delete workspace",
        variant: "destructive",
      })
    }
  }

  const archiveProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to archive this project? This will move it to the archived projects section."))
      return

    try {
      // First, get the project details and related data for snapshot
      const { data: projectData, error: projectError } = await supabase
        .from("projects")
        .select(`
          *,
          tasks(*),
          file_attachments(filename, file_type, file_size),
          posts(*)
        `)
        .eq("id", projectId)
        .single()

      if (projectError) throw projectError

      const sanitizedDescription = sanitizeContent(projectData.description || "")

      // Create archived snapshot (strip image data, keep metadata only)
      const archivedSnapshot = {
        tasks: projectData.tasks || [],
        files: (projectData.file_attachments || []).map((file: any) => ({
          name: file.filename,
          type: file.file_type,
          size: file.file_size,
        })),
        posts: (projectData.posts || []).map((post: any) => ({
          id: post.id,
          content: post.content,
          created_at: post.created_at,
        })),
        archived_date: new Date().toISOString(),
        project_metadata: {
          name: projectData.name,
          description: sanitizedDescription,
          created_at: projectData.created_at,
        },
      }

      // Update project to archived status
      const { error: updateError } = await supabase
        .from("projects")
        .update({
          archived: true,
          archived_at: new Date().toISOString(),
          archived_snapshot: archivedSnapshot,
          description: sanitizedDescription,
        })
        .eq("id", projectId)

      if (updateError) throw updateError

      // Remove from current projects list and refresh archived projects
      setProjects(projects.filter((p) => p.id !== projectId))
      fetchAdminData() // Refresh to get updated archived projects

      toast({
        title: "Success",
        description: "Project archived successfully",
      })
    } catch (error) {
      console.error("Error archiving project:", error)
      toast({
        title: "Error",
        description: "Failed to archive project",
        variant: "destructive",
      })
    }
  }

  const restoreProject = async (projectId: string) => {
    if (!confirm("Are you sure you want to restore this project? It will be moved back to active projects.")) return

    try {
      const { error } = await supabase
        .from("projects")
        .update({
          archived: false,
          archived_at: null,
          archived_snapshot: null,
        })
        .eq("id", projectId)

      if (error) throw error

      // Refresh data to update both lists
      fetchAdminData()

      toast({
        title: "Success",
        description: "Project restored successfully",
      })
    } catch (error) {
      console.error("Error restoring project:", error)
      toast({
        title: "Error",
        description: "Failed to restore project",
        variant: "destructive",
      })
    }
  }

  const deleteArchivedProject = async (projectId: string, projectName: string) => {
    const firstConfirm = confirm(
      `⚠️ PERMANENT DELETION WARNING ⚠️

You are about to permanently delete the archived project "${projectName}".

This action will:
• Remove the project and ALL its data forever
• Delete all tasks, discussions, and files
• Cannot be undone or recovered

Are you absolutely sure you want to continue?`,
    )

    if (!firstConfirm) return

    const secondConfirm = confirm(
      `FINAL CONFIRMATION

Type the project name to confirm deletion: "${projectName}"

This is your last chance to cancel. The project will be permanently deleted.`,
    )

    if (!secondConfirm) return

    try {
      // Delete the project permanently (CASCADE will handle related data)
      const { error } = await supabase.from("projects").delete().eq("id", projectId).eq("archived", true) // Extra safety: only delete if archived

      if (error) throw error

      // Refresh data to update the archived projects list
      fetchAdminData()

      toast({
        title: "Project Deleted",
        description: `"${projectName}" has been permanently deleted`,
        variant: "destructive",
      })
    } catch (error) {
      console.error("Error deleting archived project:", error)
      toast({
        title: "Deletion Failed",
        description: "Failed to delete the archived project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const showArchivedDetails = (project: ArchivedProject) => {
    setSelectedArchivedProject(project)
    setIsArchivedDetailOpen(true)
  }

  const openEditProject = (project: Project) => {
    setEditingProject(project)
    setEditProjectName(project.name)
    setEditProjectDescription(project.description || "")
    setIsEditProjectDialogOpen(true)
  }

  const updateProject = async () => {
    if (!editProjectName.trim()) return

    try {
      const sanitizedDescription = sanitizeContent(editProjectDescription)

      const { data, error } = await supabase
        .from("projects")
        .update({
          name: editProjectName.trim(),
          description: sanitizedDescription.trim() || null,
        })
        .eq("id", editingProject.id)
        .select(`
          *,
          workspace:workspaces(name),
          creator:users!projects_created_by_fkey(full_name)
        `)
        .single()

      if (error) throw error

      // Fetch task count separately
      const { count: taskCount } = await supabase
        .from("tasks")
        .select("*", { count: "exact", head: true })
        .eq("project_id", editingProject.id)

      // Update the projects list with the updated project
      setProjects(
        projects.map((p) =>
          p.id === editingProject.id
            ? {
              ...data,
              workspace_name: data.workspace?.name || "Unknown",
              creator_name: data.creator?.full_name || "Unknown",
              task_count: taskCount || 0,
            }
            : p,
        ),
      )

      setIsEditProjectDialogOpen(false)
      setEditingProject(null)

      toast({
        title: "Success",
        description: "Project updated successfully",
      })
    } catch (error) {
      console.error("Error updating project:", error)
      toast({
        title: "Error",
        description: "Failed to update project",
        variant: "destructive",
      })
    }
  }

  const deleteProject = async (projectId: string, projectName: string) => {
    if (
      !confirm(
        `Are you sure you want to delete the project "${projectName}"? This will permanently delete all tasks and discussions within it.`,
      )
    ) {
      return
    }

    try {
      const { error } = await supabase.from("projects").delete().eq("id", projectId)

      if (error) throw error

      // Remove from projects list and update stats
      setProjects(projects.filter((p) => p.id !== projectId))
      setStats((prev) => ({
        ...prev,
        total_projects: prev.total_projects - 1,
      }))

      toast({
        title: "Success",
        description: "Project deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting project:", error)
      toast({
        title: "Error",
        description: "Failed to delete project",
        variant: "destructive",
      })
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role) {
      case "admin":
        return "default"
      case "user":
        return "secondary"
      case "guest":
        return "outline"
      default:
        return "outline"
    }
  }

  const createProject = async () => {
    if (!newProject.name.trim() || !newProject.workspace_id) return

    setIsCreating(true)
    try {
      const sanitizedDescription = sanitizeContent(newProject.description)

      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: newProject.name.trim(),
          description: sanitizedDescription.trim() || null,
          created_by: auth.user?.id,
          workspace_id: newProject.workspace_id,
        })
        .select(`
          *,
          workspace:workspaces(name),
          creator:users!projects_created_by_fkey(full_name),
          tasks(count)
        `)
        .single()

      if (error) throw error

      const newProjectWithDetails = {
        ...data,
        workspace_name: data.workspace?.name || "Unknown",
        creator_name: data.creator?.full_name || "Unknown",
        task_count: data.tasks?.[0]?.count || 0,
      }

      setProjects([newProjectWithDetails, ...projects])
      setNewProject({ name: "", description: "", workspace_id: "" })
      setIsCreateProjectDialogOpen(false)

      toast({
        title: "Success",
        description: "Project created successfully",
      })
    } catch (error) {
      console.error("Error creating project:", error)
      toast({
        title: "Error",
        description: "Failed to create project",
        variant: "destructive",
      })
    } finally {
      setIsCreating(false)
    }
  }


  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">Loading admin dashboard...</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-serif font-bold text-primary">Admin Dashboard</h2>
        <div className="flex flex-col gap-2">
          <Dialog open={isUserDialogOpen} onOpenChange={setIsUserDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <UserPlus className="w-4 h-4 mr-2" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Add New User</DialogTitle>
                <DialogDescription>
                  Create a new user account by providing their email, full name, and role.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="user-email">Email</Label>
                  <Input
                    id="user-email"
                    value={newUserEmail}
                    onChange={(e) => setNewUserEmail(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div>
                  <Label htmlFor="user-name">Full Name</Label>
                  <Input
                    id="user-name"
                    value={newUserName}
                    onChange={(e) => setNewUserName(e.target.value)}
                    placeholder="John Doe"
                  />
                </div>
                <div>
                  <Label htmlFor="user-role">Role</Label>
                  <Select
                    value={newUserRole}
                    onValueChange={(value: "admin" | "user" | "guest") => {
                      setNewUserRole(value)
                      if (value === "admin") {
                        setNewUserPrivileges({
                          can_create_workspaces: true,
                          can_create_projects: true,
                          can_create_tasks: true,
                        })
                      } else if (value === "user") {
                        setNewUserPrivileges({
                          can_create_workspaces: false,
                          can_create_projects: true,
                          can_create_tasks: true,
                        })
                      } else {
                        setNewUserPrivileges({
                          can_create_workspaces: false,
                          can_create_projects: false,
                          can_create_tasks: false,
                        })
                      }
                      setSelectedWorkspaces([])
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="guest">Guest</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {newUserRole === "guest" && (
                  <div className="space-y-3 border-t pt-4">
                    <Label className="text-sm font-medium">Workspace Access</Label>
                    <p className="text-xs text-muted-foreground">
                      Select which workspaces this guest can access. Guests can only view and interact with projects in
                      their assigned workspaces.
                    </p>
                    <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                      {workspaces.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No workspaces available</p>
                      ) : (
                        workspaces.map((workspace) => (
                          <div key={workspace.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`workspace-${workspace.id}`}
                              checked={selectedWorkspaces.includes(workspace.id)}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  setSelectedWorkspaces((prev) => [...prev, workspace.id])
                                } else {
                                  setSelectedWorkspaces((prev) => prev.filter((id) => id !== workspace.id))
                                }
                              }}
                            />
                            <Label htmlFor={`workspace-${workspace.id}`} className="text-sm font-normal cursor-pointer">
                              {workspace.name}
                            </Label>
                          </div>
                        ))
                      )}
                    </div>
                    {selectedWorkspaces.length > 0 && (
                      <p className="text-xs text-green-600 dark:text-green-400">
                        {selectedWorkspaces.length} workspace(s) selected
                      </p>
                    )}
                  </div>
                )}

                {newUserRole !== "admin" && newUserRole !== "guest" && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">User Privileges</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="can_create_workspaces"
                          checked={newUserPrivileges.can_create_workspaces}
                          onChange={(e) =>
                            setNewUserPrivileges((prev) => ({
                              ...prev,
                              can_create_workspaces: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <Label htmlFor="can_create_workspaces" className="text-sm">
                          Can create workspaces
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="can_create_projects"
                          checked={newUserPrivileges.can_create_projects}
                          onChange={(e) =>
                            setNewUserPrivileges((prev) => ({
                              ...prev,
                              can_create_projects: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <Label htmlFor="can_create_projects" className="text-sm">
                          Can create projects
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="can_create_tasks"
                          checked={newUserPrivileges.can_create_tasks}
                          onChange={(e) =>
                            setNewUserPrivileges((prev) => ({
                              ...prev,
                              can_create_tasks: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <Label htmlFor="can_create_tasks" className="text-sm">
                          Can create tasks
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {newUserRole === "user"
                        ? "User role has project and task creation enabled by default"
                        : "Guest users have view-only access by default"}
                    </p>
                  </div>
                )}

                {newUserRole === "guest" && (
                  <div className="space-y-3">
                    <Label className="text-sm font-medium">Guest Privileges</Label>
                    <div className="space-y-2">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="guest_can_create_projects"
                          checked={newUserPrivileges.can_create_projects}
                          onChange={(e) =>
                            setNewUserPrivileges((prev) => ({
                              ...prev,
                              can_create_projects: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <Label htmlFor="guest_can_create_projects" className="text-sm">
                          Can create projects
                        </Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          id="guest_can_create_tasks"
                          checked={newUserPrivileges.can_create_tasks}
                          onChange={(e) =>
                            setNewUserPrivileges((prev) => ({
                              ...prev,
                              can_create_tasks: e.target.checked,
                            }))
                          }
                          className="rounded"
                        />
                        <Label htmlFor="guest_can_create_tasks" className="text-sm">
                          Can create tasks
                        </Label>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Guests have view-only access by default. Enable these privileges to allow content creation within
                      their assigned workspaces.
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsUserDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createUser}>Add User</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isWorkspaceDialogOpen} onOpenChange={setIsWorkspaceDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Add Workspace
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace to organize your projects and collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="workspace-name">Name</Label>
                  <Input
                    id="workspace-name"
                    value={newWorkspaceName}
                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                    placeholder="Marketing Team"
                  />
                </div>
                <div>
                  <Label htmlFor="workspace-description">Description</Label>
                  <Textarea
                    id="workspace-description"
                    value={newWorkspaceDescription}
                    onChange={(e) => setNewWorkspaceDescription(e.target.value)}
                    placeholder="Workspace for marketing team projects"
                    rows={3}
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsWorkspaceDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={createWorkspace}>Create Workspace</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_users}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Workspaces</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_workspaces}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Projects</CardTitle>
            <FolderOpen className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_projects}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasks</CardTitle>
            <CheckSquare className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl sm:text-2xl font-bold">{stats.total_tasks}</div>
          </CardContent>
        </Card>
      </div>

      {/* Management Tabs */}
      <Tabs defaultValue="users" className="space-y-4">
        <div className="overflow-x-auto">
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="users" className="text-xs sm:text-sm">
              Users
            </TabsTrigger>
            <TabsTrigger value="workspaces" className="text-xs sm:text-sm">
              Workspaces
            </TabsTrigger>
            <TabsTrigger value="projects" className="text-xs sm:text-sm">
              Projects
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <BarChart3 className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Performance</span>
              <span className="sm:hidden">Perf</span>
            </TabsTrigger>
            <TabsTrigger value="archived" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Package className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Archived</span>
              <span className="sm:hidden">Arch</span>
            </TabsTrigger>
            <TabsTrigger value="activity" className="flex items-center gap-1 sm:gap-2 text-xs sm:text-sm">
              <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Activity</span>
              <span className="sm:hidden">Logs</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>User Management</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      className="pl-8 w-[200px] h-9"
                    />
                  </div>
                  <Select
                    value={userRoleFilter}
                    onValueChange={(v: any) => setUserRoleFilter(v)}
                  >
                    <SelectTrigger className="w-[130px] h-9">
                      <SelectValue placeholder="Role" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Roles</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="guest">Guest</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="text-sm text-muted-foreground space-y-1 mt-2">
                <p>• New users receive a password setup email to create their own secure password</p>
                <p>• Recommend enabling 2FA for enhanced security (users can enable in their profile)</p>
                <p>• Guest users have limited access, regular users can create workspaces</p>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredUsers.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No users found matching your filters.
                  </div>
                ) : (
                  filteredUsers.map((user) => (
                    <div
                      key={user.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0"
                    >
                      <div className="space-y-1 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                          <span className="font-medium text-sm sm:text-base">{user.full_name}</span>
                          <Badge variant={getRoleBadgeVariant(user.role)} className="w-fit">
                            {user.role}
                          </Badge>
                        </div>
                        <div className="text-xs sm:text-sm text-muted-foreground break-all">{user.email}</div>
                        <div className="text-xs text-muted-foreground">
                          Created {formatDate(user.created_at)} • {user.organization}
                        </div>
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingUser(user)
                            setEditUserName(user.full_name)
                            setEditUserRole(user.role)
                            setEditUserPrivileges(user.privileges || {
                              can_create_workspaces: false,
                              can_create_projects: false,
                              can_create_tasks: false,
                            })
                            setIsEditUserDialogOpen(true)
                          }}
                          className="flex-1 sm:flex-none"
                        >
                          <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSendPasswordReset(user.email)}
                          className="flex-1 sm:flex-none"
                          title="Send Password Reset Email"
                        >
                          <RotateCcw className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeletingUsers((prev) => new Set(prev).add(user.id))}
                          className="flex-1 sm:flex-none text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="workspaces" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace Management</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {workspaces.map((workspace) => (
                  <div
                    key={workspace.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3 sm:p-4 border rounded-lg space-y-3 sm:space-y-0"
                  >
                    <div className="space-y-1 flex-1">
                      <div className="font-medium text-sm sm:text-base">{workspace.name}</div>
                      {workspace.description && (
                        <div className="text-xs sm:text-sm text-muted-foreground line-clamp-2">
                          {workspace.description}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {workspace.project_count} projects • Created {formatDate(workspace.created_at)}
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingWorkspace(workspace)
                          setEditWorkspace({
                            name: workspace.name,
                            description: workspace.description || "",
                          })
                        }}
                        className="flex-1 sm:flex-none"
                      >
                        <Edit2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => deleteWorkspace(workspace.id)}
                        className="flex-1 sm:flex-none"
                      >
                        <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Project Overview</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-8 w-[200px] h-9"
                    />
                  </div>
                  <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Project
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                          Add a new project to this workspace to organize tasks and collaborate.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="project-name">Name</Label>
                          <Input
                            id="project-name"
                            value={newProject.name}
                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                            placeholder="Project Name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="project-description">Description</Label>
                          <Textarea
                            id="project-description"
                            value={newProject.description}
                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                            placeholder="Project Description"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="project-workspace">Workspace</Label>
                          <Select
                            value={newProject.workspace_id}
                            onValueChange={(value) => setNewProject({ ...newProject, workspace_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a workspace" />
                            </SelectTrigger>
                            <SelectContent>
                              {workspaces.map((workspace) => (
                                <SelectItem key={workspace.id} value={workspace.id}>
                                  {workspace.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsCreateProjectDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={createProject} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create Project"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No projects found.
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{project.name}</span>
                          {project.completed && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                          )}
                        </div>
                        {project.description && (
                          <div
                            className="text-sm text-muted-foreground line-clamp-5 prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80"
                            dangerouslySetInnerHTML={{ __html: sanitizeContent(project.description) }}
                          />
                        )}
                        <div className="text-xs text-muted-foreground">
                          {project.workspace_name} • {project.task_count} tasks • Created by {project.creator_name} •{" "}
                          {formatDate(project.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {project.completed && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => archiveProject(project.id)}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditProject(project)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteProject(project.id, project.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="projects" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <CardTitle>Project Management</CardTitle>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search projects..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="pl-8 w-[200px] h-9"
                    />
                  </div >
                  <Dialog open={isCreateProjectDialogOpen} onOpenChange={setIsCreateProjectDialogOpen}>
                    <DialogTrigger asChild>
                      <Button>
                        <Plus className="w-4 h-4 mr-2" />
                        Add Project
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Create New Project</DialogTitle>
                        <DialogDescription>
                          Add a new project to this workspace to organize tasks and collaborate.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label htmlFor="project-name">Name</Label>
                          <Input
                            id="project-name"
                            value={newProject.name}
                            onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                            placeholder="Project Name"
                          />
                        </div>
                        <div>
                          <Label htmlFor="project-description">Description</Label>
                          <Textarea
                            id="project-description"
                            value={newProject.description}
                            onChange={(e) => setNewProject({ ...newProject, description: e.target.value })}
                            placeholder="Project Description"
                            rows={3}
                          />
                        </div>
                        <div>
                          <Label htmlFor="project-workspace">Workspace</Label>
                          <Select
                            value={newProject.workspace_id}
                            onValueChange={(value) => setNewProject({ ...newProject, workspace_id: value })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select a workspace" />
                            </SelectTrigger>
                            <SelectContent>
                              {workspaces.map((workspace) => (
                                <SelectItem key={workspace.id} value={workspace.id}>
                                  {workspace.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button variant="outline" onClick={() => setIsCreateProjectDialogOpen(false)}>
                            Cancel
                          </Button>
                          <Button onClick={createProject} disabled={isCreating}>
                            {isCreating ? "Creating..." : "Create Project"}
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div >
              </div>
            </CardHeader >
            <CardContent>
              <div className="space-y-4">
                {filteredProjects.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    No projects found.
                  </div>
                ) : (
                  filteredProjects.map((project) => (
                    <div key={project.id} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="space-y-1 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{project.name}</span>
                          {project.completed && (
                            <Badge variant="secondary" className="bg-green-100 text-green-800">
                              Completed
                            </Badge>
                          )}
                        </div>
                        {project.description && (
                          <div
                            className="text-sm text-muted-foreground line-clamp-5 prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80"
                            dangerouslySetInnerHTML={{ __html: sanitizeContent(project.description) }}
                          />
                        )}
                        <div className="text-xs text-muted-foreground">
                          {project.workspace_name} • {project.task_count} tasks • Created by {project.creator_name} •{" "}
                          {formatDate(project.created_at)}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {project.completed && (
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => archiveProject(project.id)}
                              className="text-orange-600 hover:text-orange-700 hover:bg-orange-50"
                            >
                              <Archive className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                        <div className="flex gap-2">
                          <Button variant="outline" size="sm" onClick={() => openEditProject(project)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteProject(project.id, project.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  )))}
              </div>
            </CardContent>
          </Card >
        </TabsContent >

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5" />
                  User Performance Analytics
                </CardTitle>
                <Select value={performanceTimeframe} onValueChange={setPerformanceTimeframe}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Last Month</SelectItem>
                    <SelectItem value="quarterly">Last Quarter</SelectItem>
                    <SelectItem value="annual">Last Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingPerformance ? (
                <div className="flex items-center justify-center p-8">
                  <div className="text-muted-foreground">Loading performance data...</div>
                </div>
              ) : (
                <div className="space-y-4">
                  {performanceData.length === 0 ? (
                    <div className="text-center p-8 text-muted-foreground">
                      No performance data available for the selected timeframe.
                    </div>
                  ) : (
                    performanceData.map((user) => (
                      <div key={user.id} className="p-3 sm:p-4 border rounded-lg space-y-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between space-y-2 sm:space-y-0">
                          <div>
                            <div className="font-medium text-sm sm:text-base">{user.full_name}</div>
                            <div className="text-xs sm:text-sm text-muted-foreground">{user.email}</div>
                          </div>
                          <Badge variant={user.role === "user" ? "default" : "secondary"} className="w-fit">
                            {user.role}
                          </Badge>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                          <div className="text-center p-2 sm:p-3 bg-blue-50 rounded-lg">
                            <div className="text-lg sm:text-2xl font-bold text-blue-600">
                              {user.metrics.projectsCreated}
                            </div>
                            <div className="text-xs text-blue-600">Projects</div>
                          </div>

                          <div className="text-center p-2 sm:p-3 bg-green-50 rounded-lg">
                            <div className="text-lg sm:text-2xl font-bold text-green-600">
                              {user.metrics.tasksCompleted}
                            </div>
                            <div className="text-xs text-green-600">Tasks</div>
                          </div>

                          <div className="text-center p-2 sm:p-3 bg-purple-50 rounded-lg">
                            <div className="text-lg sm:text-2xl font-bold text-purple-600">
                              {user.metrics.completionRate}%
                            </div>
                            <div className="text-xs text-purple-600">Rate</div>
                          </div>

                          <div className="text-center p-2 sm:p-3 bg-orange-50 rounded-lg">
                            <div className="text-lg sm:text-2xl font-bold text-orange-600">
                              {user.metrics.avgCompletionTime}d
                            </div>
                            <div className="text-xs text-orange-600">Avg Time</div>
                          </div>
                        </div>

                        <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs sm:text-sm text-muted-foreground space-y-1 sm:space-y-0">
                          <span>Total Tasks: {user.metrics.totalTasks}</span>
                          <span>On-Time Projects: {user.metrics.projectsOnTime}</span>
                        </div>

                        {/* Performance indicator bar */}
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${Math.min(user.metrics.completionRate, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="w-5 h-5" />
                Archived Projects
              </CardTitle>
            </CardHeader>
            <CardContent>
              {archivedProjects.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Package className="w-12 h-12 mx-auto mb-4 opacity-50" />
                  <p>No archived projects yet</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {archivedProjects.map((project) => (
                    <Collapsible key={project.id}>
                      <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{project.name}</span>
                            <Badge variant="outline" className="bg-gray-100 text-gray-600">
                              Archived
                            </Badge>
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {project.workspace_name} • Archived {new Date(project.archived_at).toLocaleDateString()} by{" "}
                            {project.creator_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" size="sm" onClick={() => showArchivedDetails(project)}>
                            View Details
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => restoreProject(project.id)}
                            className="text-blue-600 hover:text-blue-700"
                          >
                            <RotateCcw className="w-4 h-4 mr-1" />
                            Restore
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => deleteArchivedProject(project.id, project.name)}
                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          >
                            <Trash2 className="w-4 h-4 mr-1" />
                            Delete
                          </Button>
                          <CollapsibleTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <ChevronDown className="w-4 h-4" />
                            </Button>
                          </CollapsibleTrigger>
                        </div>
                      </div>
                      <CollapsibleContent className="px-4 pb-4">
                        <div className="mt-2 p-4 bg-muted/30 rounded-lg space-y-2">
                          <div className="grid grid-cols-3 gap-4 text-sm">
                            <div>
                              <span className="font-medium">Tasks:</span>{" "}
                              {project.archived_snapshot?.tasks?.length || 0}
                            </div>
                            <div>
                              <span className="font-medium">Files:</span>{" "}
                              {project.archived_snapshot?.files?.length || 0}
                            </div>
                            <div>
                              <span className="font-medium">Posts:</span>{" "}
                              {project.archived_snapshot?.posts?.length || 0}
                            </div>
                          </div>
                          {project.description && (
                            <div className="text-sm text-muted-foreground">
                              <span className="font-medium">Description:</span>
                              <div
                                className="mt-1 line-clamp-3 prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80"
                                dangerouslySetInnerHTML={{ __html: sanitizeContent(project.description) }}
                              />
                            </div>
                          )}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="activity" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Activity Log
              </CardTitle>
              <Button variant="outline" size="sm" onClick={fetchActivityLogs} disabled={isLoadingLogs}>
                <RotateCcw className={`w-4 h-4 mr-2 ${isLoadingLogs ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[600px] pr-4">
                {isLoadingLogs ? (
                  <div className="flex justify-center p-8">Loading logs...</div>
                ) : activityLogs.length === 0 ? (
                  <div className="text-center p-8 text-muted-foreground">No activity logs found.</div>
                ) : (
                  <div className="space-y-4">
                    {activityLogs.map((log) => (
                      <div key={log.id} className="flex gap-4 p-4 border rounded-lg bg-card/50">
                        <div className="mt-1">
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.action_type.replace(/_/g, " ")}
                          </Badge>
                        </div>
                        <div className="flex-1 space-y-1">
                          <p className="text-sm font-medium">
                            Action by Admin ID: <span className="font-mono text-muted-foreground">{log.admin_id.slice(0, 8)}...</span>
                          </p>
                          <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2 mt-2">
                            <div>Target Type: {log.target_type}</div>
                            <div>IP: {log.ip_address || 'Unknown'}</div>
                          </div>
                          {log.metadata && Object.keys(log.metadata).length > 0 && (
                            <div className="mt-2 text-xs bg-muted p-2 rounded-md font-mono overflow-x-auto">
                              {JSON.stringify(log.metadata, null, 2)}
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground whitespace-nowrap">
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Edit User Dialog */}
      <Dialog open={isEditUserDialogOpen} onOpenChange={setIsEditUserDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user details and privileges</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-user-email">Email</Label>
              <Input id="edit-user-email" value={editingUser?.email || ""} disabled className="bg-muted" />
              <div className="text-xs text-muted-foreground mt-1">
                Email cannot be changed. Use "Reset Password" to send a new password setup email.
              </div>
            </div>
            <div>
              <Label htmlFor="edit-user-name">Full Name</Label>
              <Input
                id="edit-user-name"
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                placeholder="John Doe"
              />
            </div>
            <div>
              <Label htmlFor="edit-user-role">Role</Label>
              <Select
                value={editUserRole}
                onValueChange={(value) => {
                  setEditUserRole(value)
                  if (value === "admin") {
                    setEditUserPrivileges({
                      can_create_workspaces: true,
                      can_create_projects: true,
                      can_create_tasks: true,
                    })
                  } else if (value === "user") {
                    setEditUserPrivileges({
                      can_create_workspaces: false,
                      can_create_projects: true,
                      can_create_tasks: true,
                    })
                  } else {
                    setEditUserPrivileges({
                      can_create_workspaces: false,
                      can_create_projects: false,
                      can_create_tasks: false,
                    })
                  }
                  if (value !== "guest") {
                    setEditUserWorkspaces([])
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="guest">Guest</SelectItem>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(editUserRole === "guest" || editUserRole === "user") && (
              <div className="space-y-3 border-t pt-4">
                <Label className="text-sm font-medium">Workspace Access</Label>
                <p className="text-xs text-muted-foreground">
                  {editUserRole === "guest"
                    ? "Select which workspaces this guest can access. Guests can only view projects in their assigned workspaces."
                    : "Restrict this user to specific workspaces. Leave empty for access to all workspaces (default)."}
                </p>
                <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-3">
                  {workspaces.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No workspaces available</p>
                  ) : (
                    workspaces.map((workspace) => (
                      <div key={workspace.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`edit-workspace-${workspace.id}`}
                          checked={editUserWorkspaces.includes(workspace.id)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setEditUserWorkspaces((prev) => [...prev, workspace.id])
                            } else {
                              setEditUserWorkspaces((prev) => prev.filter((id) => id !== workspace.id))
                            }
                          }}
                        />
                        <Label
                          htmlFor={`edit-workspace-${workspace.id}`}
                          className="text-sm font-normal cursor-pointer"
                        >
                          {workspace.name}
                        </Label>
                      </div>
                    ))
                  )}
                </div>
                {editUserWorkspaces.length > 0 ? (
                  <p className="text-xs text-green-600 dark:text-green-400">
                    {editUserWorkspaces.length} workspace(s) selected
                  </p>
                ) : editUserRole === "user" ? (
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    No restrictions - user can access all workspaces
                  </p>
                ) : null}
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-medium">User Privileges</Label>
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-can-create-workspaces"
                    checked={editUserPrivileges.can_create_workspaces}
                    onCheckedChange={(checked) =>
                      setEditUserPrivileges((prev) => ({
                        ...prev,
                        can_create_workspaces: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="edit-can-create-workspaces" className="text-sm font-normal">
                    Can create workspaces
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-can-create-projects"
                    checked={editUserPrivileges.can_create_projects}
                    onCheckedChange={(checked) =>
                      setEditUserPrivileges((prev) => ({
                        ...prev,
                        can_create_projects: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="edit-can-create-projects" className="text-sm font-normal">
                    Can create projects
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="edit-can-create-tasks"
                    checked={editUserPrivileges.can_create_tasks}
                    onCheckedChange={(checked) =>
                      setEditUserPrivileges((prev) => ({
                        ...prev,
                        can_create_tasks: !!checked,
                      }))
                    }
                  />
                  <Label htmlFor="edit-can-create-tasks" className="text-sm font-normal">
                    Can create tasks
                  </Label>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Changes will take effect on the user's next login</p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditUserDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateUser}>Update User</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Project Dialog */}
      <Dialog open={isEditProjectDialogOpen} onOpenChange={setIsEditProjectDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project name and description.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-project-name">Project Name</Label>
              <Input
                id="edit-project-name"
                value={editProjectName}
                onChange={(e) => setEditProjectName(e.target.value)}
                placeholder="Enter project name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-project-description">Description (Optional)</Label>
              <Textarea
                id="edit-project-description"
                value={editProjectDescription}
                onChange={(e) => setEditProjectDescription(e.target.value)}
                placeholder="Describe this project"
                rows={3}
                className="mt-2"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setIsEditProjectDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={updateProject}>Update Project</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archived Project Detail Modal */}
      <Dialog open={isArchivedDetailOpen} onOpenChange={setIsArchivedDetailOpen}>
        <DialogContent className="max-w-2xl mx-4 sm:mx-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Package className="w-4 h-4 sm:w-5 sm:h-5" />
              {selectedArchivedProject?.name}
            </DialogTitle>
            <DialogDescription>View details of this archived project.</DialogDescription>
          </DialogHeader>
          {selectedArchivedProject && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-sm font-medium">Workspace</Label>
                  <p className="text-sm text-muted-foreground">{selectedArchivedProject.workspace_name}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Archived Date</Label>
                  <p className="text-sm text-muted-foreground">
                    {new Date(selectedArchivedProject.archived_at).toLocaleDateString()}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium">Creator</Label>
                  <p className="text-sm text-muted-foreground">{selectedArchivedProject.creator_name}</p>
                </div>
              </div>

              {selectedArchivedProject.description && (
                <div>
                  <Label className="text-sm font-medium">Description</Label>
                  <div
                    className="text-sm text-muted-foreground mt-1 prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80"
                    dangerouslySetInnerHTML={{ __html: sanitizeContent(selectedArchivedProject.description) }}
                  />
                </div>
              )}

              <div className="space-y-3">
                <Label className="text-sm font-medium">Archived Content</Label>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">
                        {selectedArchivedProject.archived_snapshot?.tasks?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Tasks</div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">
                        {selectedArchivedProject.archived_snapshot?.files?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Files</div>
                    </div>
                  </Card>
                  <Card className="p-3">
                    <div className="text-center">
                      <div className="text-xl sm:text-2xl font-bold">
                        {selectedArchivedProject.archived_snapshot?.posts?.length || 0}
                      </div>
                      <div className="text-xs text-muted-foreground">Posts</div>
                    </div>
                  </Card>
                </div>
              </div>

              {selectedArchivedProject.archived_snapshot?.files &&
                selectedArchivedProject.archived_snapshot.files.length > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Files</Label>
                    <div className="mt-2 space-y-1">
                      {selectedArchivedProject.archived_snapshot.files.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-sm p-2 bg-muted/30 rounded">
                          <span>{file.name}</span>
                          <Badge variant="outline" className="text-xs">
                            {file.type}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsArchivedDetailOpen(false)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    restoreProject(selectedArchivedProject.id)
                    setIsArchivedDetailOpen(false)
                  }}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Restore Project
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    deleteArchivedProject(selectedArchivedProject.id, selectedArchivedProject.name)
                    setIsArchivedDetailOpen(false)
                  }}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete Permanently
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!editingWorkspace}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWorkspace(null)
            setEditWorkspace({ name: "", description: "" })
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-workspace-name">Name</Label>
              <Input
                id="edit-workspace-name"
                className="mt-2"
                value={editWorkspace.name}
                onChange={(e) => setEditWorkspace({ ...editWorkspace, name: e.target.value })}
                placeholder="Marketing Team"
              />
            </div>
            <div>
              <Label htmlFor="edit-workspace-description">Description</Label>
              <Textarea
                id="edit-workspace-description"
                className="mt-2"
                value={editWorkspace.description}
                onChange={(e) => setEditWorkspace({ ...editWorkspace, description: e.target.value })}
                placeholder="Workspace for marketing team projects"
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingWorkspace(null)
                  setEditWorkspace({ name: "", description: "" })
                }}
              >
                Cancel
              </Button>
              <Button onClick={updateWorkspace} disabled={isEditingWorkspace || !editWorkspace.name.trim()}>
                {isEditingWorkspace ? "Updating..." : "Update Workspace"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div >
  )
}

export { AdminDashboard }
export default AdminDashboard
