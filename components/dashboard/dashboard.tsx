"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { WorkspaceList } from "@/components/workspaces/workspace-list"
import { ProjectList } from "@/components/projects/project-list"
import { KanbanBoard } from "@/components/tasks/kanban-board"
import { AdminDashboard } from "@/components/admin/admin-dashboard"
import { ProjectDiscussion } from "@/components/communication/project-discussion"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { ThemeToggle } from "@/components/theme-toggle" // Added ThemeToggle import
import { canCreateProject } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/client"

interface Workspace {
  id: string
  name: string
  description: string | null
}

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  created_by: string
  creator?: {
    full_name: string
  }
  task_count?: number
  workspace_id: string // Added workspace_id to the Project interface
}

export function Dashboard() {
  const { auth, logout } = useAuth()
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)
  const [showAdminDashboard, setShowAdminDashboard] = useState(false)
  const [selectedProjectForDiscussion, setSelectedProjectForDiscussion] = useState<Project | null>(null)
  const projectListRef = useRef<{ openCreateDialog?: () => void }>({})
  const supabase = createClient()

  useEffect(() => {
    const handleNavigateToTask = async (event: CustomEvent) => {
      const { projectId, taskId } = event.detail

      try {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, name, description, created_at, created_by, workspace_id")
          .eq("id", projectId)
          .single()

        if (projectError) {
          console.error("Error fetching project:", projectError)
          return
        }

        if (project) {
          const { data: workspace, error: workspaceError } = await supabase
            .from("workspaces")
            .select("id, name, description")
            .eq("id", project.workspace_id)
            .single()

          if (workspaceError) {
            console.error("Error fetching workspace:", workspaceError)
          }

          if (workspace) {
            setSelectedWorkspace(workspace)
          }

          setShowAdminDashboard(false)
          setSelectedProject(project)
          setSelectedProjectForDiscussion(null)

          setTimeout(() => {
            const taskElement = document.querySelector(`[data-task-id="${taskId}"]`)
            if (taskElement) {
              taskElement.scrollIntoView({ behavior: "smooth", block: "center" })
              taskElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2")
              setTimeout(() => {
                taskElement.classList.remove("ring-2", "ring-blue-500", "ring-offset-2")
              }, 2000)
            }
          }, 500)
        }
      } catch (error) {
        console.error("Error navigating to task:", error)
      }
    }

    const handleNavigateToDiscussion = async (event: CustomEvent) => {
      const { projectId, postId } = event.detail

      try {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, name, description, created_at, created_by, workspace_id")
          .eq("id", projectId)
          .single()

        if (projectError) {
          console.error("Error fetching project:", projectError)
          return
        }

        if (project) {
          const { data: workspace, error: workspaceError } = await supabase
            .from("workspaces")
            .select("id, name, description")
            .eq("id", project.workspace_id)
            .single()

          if (workspaceError) {
            console.error("Error fetching workspace:", workspaceError)
          }

          if (workspace) {
            setSelectedWorkspace(workspace)
          }

          setShowAdminDashboard(false)
          setSelectedProjectForDiscussion(project)
          setSelectedProject(null)

          setTimeout(() => {
            const postElement = document.querySelector(`[data-post-id="${postId}"]`)
            if (postElement) {
              postElement.scrollIntoView({ behavior: "smooth", block: "center" })
              postElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2")
              setTimeout(() => {
                postElement.classList.remove("ring-2", "ring-blue-500", "ring-offset-2")
              }, 2000)
            }
          }, 500)
        }
      } catch (error) {
        console.error("Error navigating to discussion:", error)
      }
    }

    const handleNavigateToProject = async (event: CustomEvent) => {
      const { projectId } = event.detail

      try {
        const { data: project, error: projectError } = await supabase
          .from("projects")
          .select("id, name, description, created_at, created_by, workspace_id")
          .eq("id", projectId)
          .single()

        if (projectError) {
          console.error("Error fetching project:", projectError)
          return
        }

        if (project) {
          const { data: workspace, error: workspaceError } = await supabase
            .from("workspaces")
            .select("id, name, description")
            .eq("id", project.workspace_id)
            .single()

          if (workspaceError) {
            console.error("Error fetching workspace:", workspaceError)
          }

          if (workspace) {
            setSelectedWorkspace(workspace)
          }

          setShowAdminDashboard(false)
          setSelectedProject(project)
          setSelectedProjectForDiscussion(null)
        }
      } catch (error) {
        console.error("Error navigating to project:", error)
      }
    }

    window.addEventListener("navigate-to-task", handleNavigateToTask as EventListener)
    window.addEventListener("navigate-to-discussion", handleNavigateToDiscussion as EventListener)
    window.addEventListener("navigate-to-project", handleNavigateToProject as EventListener)

    return () => {
      window.removeEventListener("navigate-to-task", handleNavigateToTask as EventListener)
      window.removeEventListener("navigate-to-discussion", handleNavigateToDiscussion as EventListener)
      window.removeEventListener("navigate-to-project", handleNavigateToProject as EventListener)
    }
  }, [supabase])

  const handleSelectWorkspace = (workspace: Workspace) => {
    setSelectedWorkspace(workspace)
    setSelectedProject(null)
    setSelectedProjectForDiscussion(null)
  }

  const handleSelectProject = (project: Project) => {
    setSelectedProject(project)
    setSelectedProjectForDiscussion(null)
  }

  const handleBackToWorkspaces = () => {
    setSelectedWorkspace(null)
    setSelectedProject(null)
    setShowAdminDashboard(false)
    setSelectedProjectForDiscussion(null)
  }

  const handleBackToProjects = () => {
    setSelectedProject(null)
    setSelectedProjectForDiscussion(null)
  }

  const handleNavigateToDiscussion = (project: Project) => {
    setSelectedProjectForDiscussion(project)
    setSelectedProject(null)
  }

  const handleBackFromDiscussion = () => {
    setSelectedProjectForDiscussion(null)
  }

  const handleNavigateToTasks = (project: Project) => {
    setSelectedProject(project)
    setSelectedProjectForDiscussion(null)
  }

  const handleShowAdmin = () => {
    setShowAdminDashboard(true)
    setSelectedWorkspace(null)
    setSelectedProject(null)
    setSelectedProjectForDiscussion(null)
  }

  const handleSetProjectListRef = useCallback((ref: { openCreateDialog: () => void } | null) => {
    if (ref) {
      projectListRef.current = ref
    }
  }, [])

  const handleCreateProject = () => {
    if (projectListRef.current?.openCreateDialog) {
      projectListRef.current.openCreateDialog()
    }
  }

  return (
    <div className="text-foreground text-base">
      <header className="border-b bg-card">
        <div className="flex items-center justify-between px-3 md:px-6 py-3 md:py-4">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-[rgba(43,38,239,1)]">TaskFlow</h1>
          <div className="flex items-center gap-2 md:gap-4">
            <span className="hidden md:block text-sm text-muted-foreground">
              Welcome, {auth.user?.name} ({auth.user?.role})
            </span>
            <ThemeToggle />
            <NotificationBell />
            <div className="flex flex-row gap-1 sm:gap-2 md:gap-4">
              {auth.user?.role === "admin" && (
                <Button
                  variant={showAdminDashboard ? "default" : "outline"}
                  onClick={showAdminDashboard ? handleBackToWorkspaces : handleShowAdmin}
                  size="sm"
                  className="text-xs md:text-sm"
                >
                  {showAdminDashboard ? "Back" : "Admin"}
                </Button>
              )}
              <Button variant="outline" onClick={logout} size="sm" className="text-xs md:text-sm bg-transparent">
                Sign Out
              </Button>
            </div>
          </div>
        </div>
        {selectedWorkspace && !selectedProject && !selectedProjectForDiscussion && !showAdminDashboard && (
          <div className="border-t bg-card/50 px-3 md:px-6 py-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 justify-between">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                <Button
                  variant="outline"
                  onClick={handleBackToWorkspaces}
                  className="flex items-center gap-2 bg-transparent w-fit"
                  size="sm"
                >
                  ← Back
                </Button>
                <div>
                  <h2 className="text-lg md:text-xl font-semibold">{selectedWorkspace.name}</h2>
                  {selectedWorkspace.description && (
                    <p className="text-xs md:text-sm text-muted-foreground line-clamp-2">
                      {selectedWorkspace.description}
                    </p>
                  )}
                </div>
              </div>
              {canCreateProject(auth.user) && (
                <Button
                  className="bg-primary hover:bg-primary/80 text-primary-foreground font-medium w-fit"
                  onClick={handleCreateProject}
                  size="sm"
                >
                  + New Project
                </Button>
              )}
            </div>
          </div>
        )}
      </header>

      <main className="flex-1 p-3 md:p-6 md:px-40 bg-background">
        {showAdminDashboard ? (
          <AdminDashboard />
        ) : selectedProjectForDiscussion ? (
          <div className="space-y-4 md:space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
              <Button variant="outline" onClick={handleBackFromDiscussion} size="sm">
                ← Back
              </Button>
              <div className="flex-1">
                <h2 className="text-lg md:text-xl font-semibold line-clamp-1">{selectedProjectForDiscussion.name}</h2>
                <p className="text-xs md:text-sm text-muted-foreground">Manage tasks for this project</p>
              </div>
              <Button
                className="bg-primary hover:bg-primary/80 text-primary-foreground font-medium w-fit"
                onClick={() => handleNavigateToTasks(selectedProjectForDiscussion)}
                size="sm"
              >
                Tasks
              </Button>
            </div>

            <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit">
              <Button
                variant="ghost"
                className="bg-background shadow-sm hover:bg-background/80 text-xs md:text-sm"
                onClick={() => handleNavigateToTasks(selectedProjectForDiscussion)}
                size="sm"
              >
                Tasks
              </Button>
              <Button variant="ghost" className="bg-primary text-primary-foreground text-xs md:text-sm" size="sm">
                <span className="mr-1 md:mr-2">💬</span>
                Discussion
              </Button>
            </div>

            <ProjectDiscussion project={selectedProjectForDiscussion} />
          </div>
        ) : selectedProject ? (
          <KanbanBoard project={selectedProject} onBack={handleBackToProjects} />
        ) : selectedWorkspace ? (
          <ProjectList
            workspace={selectedWorkspace}
            onBack={handleBackToWorkspaces}
            onSelectProject={handleSelectProject}
            onNavigateToDiscussion={handleNavigateToDiscussion}
            hideHeader={true}
            onCreateProject={handleSetProjectListRef}
          />
        ) : (
          <WorkspaceList onSelectWorkspace={handleSelectWorkspace} />
        )}
      </main>

      <footer className="mt-auto p-3 md:p-6 bg-card border-t">
        <div className="px-3 md:px-6">
          <p className="text-xs text-muted-foreground text-center">PROPER Studios | proper.am</p>
        </div>
      </footer>
    </div>
  )
}
