"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { canCreateProject } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { FileUpload, FilePreview } from "@/components/communication/file-upload"
import { Switch } from "@/components/ui/switch"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Plus, Folder, MoreHorizontal, Edit2, Trash2, Calendar, User, MessageSquare, FileIcon } from "lucide-react"
import useSWR from "swr"
import { useToast } from "@/hooks/use-toast"

interface Project {
  id: string
  name: string
  description: string | null
  created_at: string
  created_by: string
  due_date: string | null
  completed: boolean
  creator_name?: string
  task_count?: number
  completed_task_count?: number
  recent_activity?: string
  attachments?: Array<{ id: string; filename: string; file_url: string; file_type: string }>
  assigned_users?: string[]
}

interface Workspace {
  id: string
  name: string
  description: string | null
}

interface ProjectListProps {
  workspace: Workspace
  onBack: () => void
  onSelectProject: (project: Project) => void
  onNavigateToDiscussion?: (project: Project) => void
  hideHeader?: boolean
  onCreateProject?: (ref: { openCreateDialog: () => void }) => void
}

function SortableProject({
  project,
  onSelectProject,
  onEdit,
  onDelete,
  onToggleCompletion,
  onNavigateToDiscussion,
  auth,
}: {
  project: Project
  onSelectProject: (project: Project) => void
  onEdit: (project: Project) => void
  onDelete: (projectId: string) => void
  onToggleCompletion: (projectId: string) => void
  onNavigateToDiscussion?: (project: Project) => void
  auth: any
}) {
  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest("button") ||
      target.closest(".dropdown-trigger") ||
      target.closest("[data-radix-collection-item]") ||
      target.closest("[role='switch']")
    ) {
      return
    }
    onSelectProject(project)
  }

  const getDueDateStatus = (dueDate: string | null, completed: boolean) => {
    if (!dueDate || completed) return null

    const due = new Date(dueDate)
    const now = new Date()
    const diffDays = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

    if (diffDays < 0) {
      return {
        status: "overdue",
        color: "text-red-600 dark:text-red-400",
        icon: Trash2,
        text: `${Math.abs(diffDays)} days overdue`,
      }
    } else if (diffDays === 0) {
      return { status: "due-today", color: "text-orange-600 dark:text-orange-400", icon: Calendar, text: "Due today" }
    } else if (diffDays <= 3) {
      return {
        status: "due-soon",
        color: "text-yellow-600 dark:text-yellow-400",
        icon: Calendar,
        text: `Due in ${diffDays} days`,
      }
    }
    return null
  }

  const dueDateStatus = getDueDateStatus(project.due_date, project.completed)
  const completionPercentage =
    project.task_count && project.task_count > 0
      ? Math.round(((project.completed_task_count || 0) / project.task_count) * 100)
      : 0

  return (
    <div className="group h-full">
      <Card
        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.01] border-border h-full flex flex-col bg-white dark:bg-gray-900"
        onClick={handleCardClick}
      >
        <CardContent className="p-6 flex-1 flex flex-col">
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-3 mt-1 flex-shrink-0">
              <Folder className="w-5 h-5 text-blue-500 dark:text-blue-400" />
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start gap-3 mb-4">
                <h3
                  className={`flex-1 min-w-0 font-poppins font-semibold text-lg text-gray-900 dark:text-white group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors ${
                    project.completed ? "line-through text-gray-500 dark:text-gray-400" : ""
                  }`}
                  title={project.name}
                >
                  <span className="block truncate">{project.name}</span>
                </h3>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Switch
                    checked={!project.completed}
                    onCheckedChange={() => onToggleCompletion(project.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="scale-110 border border-gray-300 data-[state=checked]:border-blue-500 data-[state=checked]:shadow-blue-200 transition-all duration-200 shadow rounded-md bg-white data-[state=checked]:bg-white [&>span]:bg-gray-200 data-[state=checked]:[&>span]:bg-blue-500"
                  />

                  {canCreateProject(auth.user) && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="px-0.5" asChild>
                        <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="w-4 h-4 text-gray-600 dark:text-gray-100" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            onEdit(project)
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation()
                            if (confirm("Are you sure you want to delete this project?")) {
                              onDelete(project.id)
                            }
                          }}
                          className="text-destructive"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>

              {project.description && (
                <div
                  className="text-sm text-gray-600 dark:text-gray-100 mb-4 line-clamp-2 prose prose-sm max-w-none [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80 [&_a]:cursor-pointer"
                  dangerouslySetInnerHTML={{ __html: project.description }}
                  onClick={(e) => {
                    const target = e.target as HTMLElement
                    if (target.tagName === "A") {
                      e.stopPropagation()
                    }
                  }}
                />
              )}

              {project.attachments && project.attachments.length > 0 && (
                <div className="mb-4">
                  <div className="flex flex-wrap gap-2">
                    {project.attachments.slice(0, 4).map((attachment, index) => {
                      const isImage =
                        attachment.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/) ||
                        attachment.file_type.startsWith("image/")
                      const isPDF =
                        attachment.file_type === "application/pdf" || attachment.filename.toLowerCase().endsWith(".pdf")

                      return (
                        <div
                          key={`${attachment.id}-${index}`}
                          className="relative w-20 h-20 rounded border border-gray-200 overflow-hidden bg-gray-50 hover:border-blue-400 transition-colors cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            window.open(attachment.file_url, "_blank")
                          }}
                          title={attachment.filename}
                        >
                          {isImage ? (
                            <img
                              src={attachment.file_url || "/placeholder.svg"}
                              alt={attachment.filename}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                // Fallback to icon if image fails to load
                                const target = e.target as HTMLImageElement
                                target.style.display = "none"
                                const parent = target.parentElement
                                if (parent) {
                                  parent.innerHTML = `
                                    <div class="w-full h-full flex items-center justify-center bg-gray-100">
                                      <div class="text-center">
                                        <svg class="w-8 h-8 text-gray-400 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                        </svg>
                                        <span class="text-[8px] text-gray-500 font-medium mt-1 block">IMAGE</span>
                                      </div>
                                    </div>
                                  `
                                }
                              }}
                            />
                          ) : isPDF ? (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50 to-red-100">
                              <div className="w-10 h-12 bg-red-600 rounded shadow-sm flex items-center justify-center mb-1">
                                <span className="text-[11px] text-white font-bold">PDF</span>
                              </div>
                              <span className="text-[8px] text-red-700 font-medium px-1 text-center line-clamp-1">
                                {attachment.filename.split(".")[0].slice(0, 12)}
                              </span>
                            </div>
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100">
                              <FileIcon className="w-8 h-8 text-blue-600 mb-1" />
                              <span className="text-[8px] text-blue-700 font-medium uppercase px-1">
                                {attachment.filename.split(".").pop()?.slice(0, 4) || "FILE"}
                              </span>
                            </div>
                          )}
                        </div>
                      )
                    })}
                    {project.attachments.length > 4 && (
                      <div className="w-20 h-20 rounded border border-gray-200 bg-gray-50 flex items-center justify-center text-sm text-gray-600 font-medium">
                        +{project.attachments.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 dark:text-gray-100 mb-4">
                {project.assigned_users && project.assigned_users.length > 0 ? (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span>{project.assigned_users.join(", ")}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-1">
                    <User className="w-4 h-4" />
                    <span className="text-gray-400 dark:text-gray-400">Unassigned</span>
                  </div>
                )}
                {project.due_date && (
                  <div className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    <span>{new Date(project.due_date).toLocaleDateString()}</span>
                  </div>
                )}
                {project.task_count !== undefined && (
                  <div className="flex items-center gap-1">
                    <Folder className="w-4 h-4" />
                    <span>
                      {project.completed_task_count || 0}/{project.task_count} tasks
                    </span>
                  </div>
                )}
              </div>

              {dueDateStatus && (
                <div className={`flex items-center gap-1 text-sm ${dueDateStatus.color} mb-3`}>
                  <dueDateStatus.icon className="w-4 h-4" />
                  <span>{dueDateStatus.text}</span>
                </div>
              )}

              {project.task_count && project.task_count > 0 && (
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-gray-600 dark:text-gray-100">
                    <span>Progress</span>
                    <span>{completionPercentage}%</span>
                  </div>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                    <div
                      className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${completionPercentage}%` }}
                    />
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-4">
                  {project.completed && (
                    <Badge
                      variant="secondary"
                      className="bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300"
                    >
                      Completed
                    </Badge>
                  )}
                  {dueDateStatus?.status === "overdue" && (
                    <Badge variant="destructive" className="bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                      Overdue
                    </Badge>
                  )}
                </div>
                {onNavigateToDiscussion && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation()
                      onNavigateToDiscussion(project)
                    }}
                    className="text-gray-600 dark:text-gray-100 hover:text-foreground dark:hover:text-white"
                  >
                    <MessageSquare className="w-4 h-4 mr-1" />
                    Discussion
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const getCacheKey = (workspaceId: string) => `taskflow_projects_${workspaceId}_cache`
const getCacheTimestampKey = (workspaceId: string) => `taskflow_projects_${workspaceId}_timestamp`
const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes

const loadFromCache = (workspaceId: string): Project[] | null => {
  if (typeof window === "undefined") return null

  try {
    const cached = localStorage.getItem(getCacheKey(workspaceId))
    const timestamp = localStorage.getItem(getCacheTimestampKey(workspaceId))

    if (cached && timestamp) {
      const age = Date.now() - Number.parseInt(timestamp, 10)
      if (age < CACHE_DURATION) {
        return JSON.parse(cached)
      }
    }
  } catch (error) {
    console.error("Error loading projects from cache:", error)
  }

  return null
}

const saveToCache = (workspaceId: string, data: Project[]) => {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(getCacheKey(workspaceId), JSON.stringify(data))
    localStorage.setItem(getCacheTimestampKey(workspaceId), Date.now().toString())
  } catch (error) {
    console.error("Error saving projects to cache:", error)
  }
}

export function ProjectList({
  workspace,
  onBack,
  onSelectProject,
  onNavigateToDiscussion,
  hideHeader = false,
  onCreateProject,
}: ProjectListProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newProject, setNewProject] = useState({
    name: "",
    description: "",
    due_date: "",
  })
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; filename: string; type?: string }>>([])
  const [isCreating, setIsCreating] = useState(false)
  const [editingProject, setEditingProject] = useState<Project | null>(null)
  const [editProject, setEditProject] = useState({
    name: "",
    description: "",
    due_date: "",
  })
  const [editUploadedFiles, setEditUploadedFiles] = useState<Array<{ url: string; filename: string; type?: string }>>(
    [],
  )
  const [existingAttachments, setExistingAttachments] = useState<
    Array<{ id: string; filename: string; file_url: string; file_type: string }>
  >([])
  const [isEditing, setIsEditing] = useState(false)
  const { auth } = useAuth()
  const supabase = createClient()
  const { toast } = useToast()

  const projectFetcher = async (): Promise<Project[]> => {
    const { data, error } = await supabase
      .from("projects")
      .select(`
        *,
        tasks(
          id,
          status,
          assigned_to,
          assigned_user:users!tasks_assigned_to_fkey(full_name)
        ),
        attachments:file_attachments(
          id,
          filename,
          file_url,
          file_type
        )
      `)
      .eq("workspace_id", workspace.id)
      .eq("archived", false)
      .order("created_at", { ascending: false })

    if (error) throw error

    const projectsWithCounts = (data || []).map((project) => {
      const tasks = project.tasks || []

      const userTaskCounts = new Map<string, number>()

      tasks.forEach((task: any) => {
        if (task.assigned_to) {
          const assignedUser = Array.isArray(task.assigned_user) ? task.assigned_user[0] : task.assigned_user
          const userName = assignedUser?.full_name
          if (userName) {
            userTaskCounts.set(userName, (userTaskCounts.get(userName) || 0) + 1)
          }
        }
      })

      const assignedUsers = Array.from(userTaskCounts.entries()).map(([name, count]) =>
        count > 1 ? `${name} (${count})` : name,
      )

      return {
        ...project,
        assigned_users: assignedUsers,
        task_count: tasks.length,
        completed_task_count: tasks.filter((task: any) => task.status === "done").length,
        tasks: undefined,
      }
    })

    return projectsWithCounts
  }

  const {
    data: swrProjects,
    error: projectsError,
    mutate,
    isValidating,
  } = useSWR<Project[]>(`projects_${workspace.id}`, projectFetcher, {
    fallbackData: loadFromCache(workspace.id) || undefined,
    refreshInterval: 300000, // 5 minutes instead of 3
    dedupingInterval: 60000, // 1 minute deduplication
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    onSuccess: (data) => {
      saveToCache(workspace.id, data)
    },
    onError: (err) => {
      console.error("Error fetching projects:", err)
    },
  })

  useEffect(() => {
    if (swrProjects) {
      setIsLoading(false)
    }
  }, [swrProjects])

  useEffect(() => {
    if (onCreateProject) {
      const ref = {
        openCreateDialog: () => {
          setIsCreateOpen(true)
        },
      }
      onCreateProject(ref)
    }
  }, [onCreateProject])

  const createProject = async () => {
    if (!newProject.name.trim()) return

    setIsCreating(true)
    try {
      const { data, error } = await supabase
        .from("projects")
        .insert({
          name: newProject.name.trim(),
          description: newProject.description.trim() || null,
          due_date: newProject.due_date || null,
          created_by: auth.user.id,
          workspace_id: workspace.id,
        })
        .select()
        .single()

      if (error) throw error

      if (uploadedFiles.length > 0) {
        const attachmentPromises = uploadedFiles.map((file) =>
          supabase
            .from("file_attachments")
            .insert({
              filename: file.filename,
              file_url: file.url,
              file_type: file.type || "application/octet-stream",
              file_size: 0,
              project_id: data.id,
              uploaded_by: auth.user.id,
            })
            .select(),
        )

        const attachmentResults = await Promise.all(attachmentPromises)
        const attachments = attachmentResults.filter((result) => result.data).map((result) => result.data![0])

        const newProjectWithCounts = {
          ...data,
          creator_name: data.creator_name?.[0]?.full_name || "Unknown",
          task_count: 0,
          completed_task_count: 0,
          attachments,
        }

        mutate([newProjectWithCounts, ...(swrProjects || [])], false)
      } else {
        const newProjectWithCounts = {
          ...data,
          creator_name: data.creator_name?.[0]?.full_name || "Unknown",
          task_count: 0,
          completed_task_count: 0,
          attachments: [],
        }

        mutate([newProjectWithCounts, ...(swrProjects || [])], false)
      }

      setNewProject({ name: "", description: "", due_date: "" })
      setUploadedFiles([])
      setIsCreateOpen(false)
      mutate()
    } catch (error) {
      console.error("Error creating project:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const updateProject = async () => {
    if (!editingProject || !editProject.name.trim()) return

    setIsEditing(true)
    try {
      const { data, error } = await supabase
        .from("projects")
        .update({
          name: editProject.name.trim(),
          description: editProject.description.trim() || null,
          due_date: editProject.due_date || null,
        })
        .eq("id", editingProject.id)
        .select()
        .single()

      if (error) throw error

      if (editUploadedFiles.length > 0) {
        const attachmentPromises = editUploadedFiles.map((file) =>
          supabase.from("file_attachments").insert({
            filename: file.filename,
            file_url: file.url,
            file_type: file.type || "application/octet-stream",
            file_size: 0,
            project_id: editingProject.id,
            uploaded_by: auth.user.id,
          }),
        )

        await Promise.all(attachmentPromises)
      }

      const { data: attachmentsData } = await supabase
        .from("file_attachments")
        .select("id, filename, file_url, file_type")
        .eq("project_id", editingProject.id)

      const { data: tasksData } = await supabase
        .from("tasks")
        .select(`
          id,
          status,
          assigned_to,
          assigned_user:users!tasks_assigned_to_fkey(full_name)
        `)
        .eq("project_id", editingProject.id)

      const assignedUsers = (tasksData || [])
        .filter((task: any) => task.assigned_to && task.assigned_user?.[0]?.full_name)
        .map((task: any) => task.assigned_user[0].full_name)
      const uniqueAssignedUsers = [...new Set(assignedUsers)]

      const updatedProject = {
        ...data,
        assigned_users: uniqueAssignedUsers,
        task_count: editingProject.task_count,
        completed_task_count: editingProject.completed_task_count,
        attachments: attachmentsData || [],
      }

      mutate(
        swrProjects?.map((p) => (p.id === editingProject.id ? updatedProject : p)),
        false,
      )
      setEditingProject(null)
      setEditProject({ name: "", description: "", due_date: "" })
      setEditUploadedFiles([])
      setExistingAttachments([])
      mutate()
    } catch (error) {
      console.error("Error updating project:", error)
    } finally {
      setIsEditing(false)
    }
  }

  const deleteProject = async (projectId: string) => {
    try {
      const optimisticData = swrProjects?.filter((p) => p.id !== projectId)
      mutate(optimisticData, false)

      const { error } = await supabase.from("projects").delete().eq("id", projectId)

      if (error) {
        console.error("Error deleting project:", error)
        mutate(swrProjects, false)
        toast({
          title: "Error",
          description: "Failed to delete project. Please try again.",
          variant: "destructive",
        })
        return
      }

      await mutate()

      toast({
        title: "Success",
        description: "Project deleted successfully.",
      })
    } catch (error) {
      console.error("Error deleting project:", error)
      mutate(swrProjects, false)
      toast({
        title: "Error",
        description: "Failed to delete project. Please try again.",
        variant: "destructive",
      })
    }
  }

  const toggleProjectCompletion = async (projectId: string) => {
    try {
      const project = swrProjects?.find((p) => p.id === projectId)
      if (!project) return

      const newCompletedState = !project.completed
      const optimisticData = swrProjects?.map((p) => (p.id === projectId ? { ...p, completed: newCompletedState } : p))

      mutate(optimisticData, false)

      const { error } = await supabase.from("projects").update({ completed: newCompletedState }).eq("id", projectId)

      if (error) {
        console.error("Error toggling completion:", error)
        mutate(swrProjects, false)
        toast({
          title: "Error",
          description: "You don't have permission to update this project. Please contact an administrator.",
          variant: "destructive",
        })
        return
      }

      await mutate()
    } catch (error) {
      console.error("Error toggling project completion:", error)
      mutate(swrProjects, false)
      toast({
        title: "Error",
        description: "Failed to update project status. Please try again.",
        variant: "destructive",
      })
    }
  }

  const deleteAttachment = async (attachmentId: string) => {
    try {
      const { error } = await supabase.from("file_attachments").delete().eq("id", attachmentId)

      if (error) throw error

      const updatedAttachments = existingAttachments.filter((attachment) => attachment.id !== attachmentId)
      setExistingAttachments(updatedAttachments)

      const project = swrProjects?.find((p) => p.id === editingProject?.id)
      if (project) {
        const updatedProject = {
          ...project,
          attachments: updatedAttachments,
        }
        mutate(
          swrProjects?.map((p) => (p.id === project.id ? updatedProject : p)),
          false,
        )
        mutate()
      }
    } catch (error) {
      console.error("Error deleting attachment:", error)
    }
  }

  const handleNewProjectClick = () => {
    setIsCreateOpen(true)
  }

  const handleFileUploaded = (file: { url: string; filename: string }) => {
    setUploadedFiles((prev) => [...prev, file])
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index))
  }

  const handleEditFileUploaded = (file: { url: string; filename: string }) => {
    setEditUploadedFiles((prev) => [...prev, file])
  }

  const handleEditRemoveFile = (index: number) => {
    setEditUploadedFiles(editUploadedFiles.filter((_, i) => i !== index))
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-gray-600 dark:text-gray-100">Loading projects...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      {!hideHeader && (
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <Button
                variant="ghost"
                onClick={onBack}
                className="mb-2 p-0 h-auto text-gray-600 dark:text-gray-100 hover:text-foreground dark:hover:text-white"
              >
                ← Back to Workspaces
              </Button>
              <h2 className="text-xl md:text-2xl font-semibold text-gray-900 dark:text-white">{workspace.name}</h2>
              {workspace.description && (
                <p className="text-sm text-gray-600 dark:text-gray-100 mt-1">{workspace.description}</p>
              )}
            </div>
            {canCreateProject(auth.user) && (
              <Button
                className="bg-primary hover:bg-primary/80 text-primary-foreground font-medium shrink-0"
                onClick={handleNewProjectClick}
              >
                <Plus className="w-4 h-4 mr-2" />
                New Project
              </Button>
            )}
          </div>
        </div>
      )}

      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="mx-auto w-full max-w-2xl px-4 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
            <DialogDescription>
              Create a new project in the {workspace.name} workspace to organize your tasks and collaborate with your
              team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                value={newProject.name}
                onChange={(e) => setNewProject({ ...newProject, name: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && newProject.name.trim()) {
                    e.preventDefault()
                    createProject()
                  }
                }}
                placeholder="Enter project name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="description">Description (Optional)</Label>
              <div className="mt-2">
                <RichTextEditor
                  content={newProject.description}
                  onChange={(content) => setNewProject({ ...newProject, description: content })}
                  placeholder="Describe this project with rich text formatting..."
                  className="min-h-[150px]"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="due_date">Due Date (Optional)</Label>
              <Input
                id="due_date"
                type="date"
                value={newProject.due_date}
                onChange={(e) => setNewProject({ ...newProject, due_date: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Attachments (Optional)</Label>
              <div className="mt-2 space-y-3">
                <FileUpload onFileUploaded={handleFileUploaded} />
                {uploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-100">Uploaded files:</p>
                    {uploadedFiles.map((file, index) => (
                      <FilePreview
                        key={index}
                        filename={file.filename}
                        fileUrl={file.url}
                        fileType={file.type || "application/octet-stream"}
                        onRemove={() => handleRemoveFile(index)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsCreateOpen(false)
                  setNewProject({ name: "", description: "", due_date: "" })
                  setUploadedFiles([])
                }}
              >
                Cancel
              </Button>
              <Button onClick={createProject} disabled={isCreating || !newProject.name.trim()}>
                {isCreating ? "Creating..." : "Create Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {(swrProjects?.length || 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <Folder className="w-10 h-10 md:w-12 md:h-12 text-gray-600 dark:text-gray-100 mb-4" />
            <h3 className="text-base md:text-lg font-medium mb-2 text-gray-600 dark:text-gray-100">No projects yet</h3>
            <p className="text-sm text-gray-600 dark:text-gray-100 text-center mb-4 px-4">
              {canCreateProject(auth.user)
                ? "Create your first project to start organizing tasks and collaborating."
                : "No projects available in this workspace yet."}
            </p>
            {canCreateProject(auth.user) && (
              <Button onClick={handleNewProjectClick} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Create Project
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {(swrProjects || []).map((project) => (
            <SortableProject
              key={project.id}
              project={project}
              onSelectProject={onSelectProject}
              onEdit={(project) => {
                setEditingProject(project)
                setEditProject({
                  name: project.name,
                  description: project.description || "",
                  due_date: project.due_date || "",
                })
                setExistingAttachments(project.attachments || [])
              }}
              onDelete={deleteProject}
              onToggleCompletion={toggleProjectCompletion}
              onNavigateToDiscussion={onNavigateToDiscussion}
              auth={auth}
            />
          ))}
        </div>
      )}

      <Dialog
        open={!!editingProject}
        onOpenChange={(open) => {
          if (!open) {
            setEditingProject(null)
            setEditUploadedFiles([])
            setExistingAttachments([])
          }
        }}
      >
        <DialogContent className="mx-4 max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
            <DialogDescription>Update the project details and settings.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Project Name</Label>
              <Input
                id="edit-name"
                value={editProject.name}
                onChange={(e) => setEditProject({ ...editProject, name: e.target.value })}
                placeholder="Enter project name"
                className="mt-2"
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <div className="mt-2">
                <RichTextEditor
                  content={editProject.description}
                  onChange={(content) => setEditProject({ ...editProject, description: content })}
                  placeholder="Describe this project with rich text formatting..."
                  className="min-h-[150px]"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="edit-due_date">Due Date (Optional)</Label>
              <Input
                id="edit-due_date"
                type="date"
                value={editProject.due_date}
                onChange={(e) => setEditProject({ ...editProject, due_date: e.target.value })}
                className="mt-2"
              />
            </div>
            <div>
              <Label>Attachments</Label>
              <div className="mt-2 space-y-3">
                {existingAttachments.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-100">Existing files:</p>
                    {existingAttachments.map((attachment) => (
                      <FilePreview
                        key={attachment.id}
                        filename={attachment.filename}
                        fileUrl={attachment.file_url}
                        fileType={attachment.file_type}
                        onRemove={() => deleteAttachment(attachment.id)}
                      />
                    ))}
                  </div>
                )}

                <FileUpload onFileUploaded={handleEditFileUploaded} />

                {editUploadedFiles.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600 dark:text-gray-100">New files:</p>
                    {editUploadedFiles.map((file, index) => (
                      <FilePreview
                        key={index}
                        filename={file.filename}
                        fileUrl={file.url}
                        fileType={file.type || "application/octet-stream"}
                        onRemove={() => handleEditRemoveFile(index)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setEditingProject(null)
                  setEditUploadedFiles([])
                  setExistingAttachments([])
                }}
              >
                Cancel
              </Button>
              <Button onClick={updateProject} disabled={isEditing || !editProject.name.trim()}>
                {isEditing ? "Updating..." : "Update Project"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
