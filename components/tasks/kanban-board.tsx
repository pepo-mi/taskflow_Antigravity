"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  MessageSquare,
  Download,
  ChevronLeft,
  ChevronRight,
  Archive,
  Plus,
  Clock,
  Play,
  CheckCircle,
  MessageCircle,
  ArrowLeft,
} from "lucide-react"
import { DragDropContext, Droppable, type DropResult } from "@hello-pangea/dnd"
import { ProjectDiscussion } from "@/components/communication/project-discussion"
import { TaskCard } from "@/components/tasks/task-card"
import { canCreateTask, canEditTask, canDeleteTask } from "@/lib/permissions"

// Utility functions for content formatting and file handling
const formatContent = (content: string) => {
  if (!content) return content

  // Check if content already contains HTML tags (from rich text editor)
  const hasHtmlTags = /<[^>]+>/.test(content)

  if (hasHtmlTags) {
    // Content is already formatted HTML, just return it as-is
    // The rich text editor already handles URL formatting
    return content
  }

  // Only apply URL formatting to plain text content
  const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
  return content.replace(urlRegex, (url) => {
    const href = url.startsWith("www.") ? `https://${url}` : url
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${url}</a>`
  })
}

const isImage = (filename: string) => {
  const imageExtensions = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "svg"]
  const extension = filename.split(".").pop()?.toLowerCase()
  return extension ? imageExtensions.includes(extension) : false
}

const isPDF = (filename: string) => {
  return filename?.toLowerCase().endsWith(".pdf")
}

interface Task {
  id: string
  title: string
  description: string | null
  status: "todo" | "in-progress" | "done" | "awaiting-feedback"
  position: number
  project_id: string
  assigned_to: string | null
  created_by: string
  due_date: string | null
  assignee?: {
    full_name: string
  }
  creator?: {
    full_name: string
  }
}

interface Project {
  id: string
  name: string
  description: string | null
  workspace?: {
    name: string
  }
}

interface FileAttachment {
  id: string
  filename: string
  file_url: string
  file_type: string
  file_size: number
}

interface KanbanBoardProps {
  project: Project
  onBack: () => void
}

const KanbanBoard = ({ project, onBack }: KanbanBoardProps) => {
  const [tasks, setTasks] = useState<Task[]>([])
  const [users, setUsers] = useState<{ id: string; full_name: string; email: string }[]>([])
  const [projectFiles, setProjectFiles] = useState<FileAttachment[]>([])
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState<number>(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreateTaskOpen, setIsCreateTaskOpen] = useState(false)
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    status: "todo" as "todo" | "in-progress" | "done" | "awaiting-feedback",
    assigned_to: "",
    due_date: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [originalTask, setOriginalTask] = useState<Task | null>(null)
  const [isEditOpen, setIsEditOpen] = useState(false)
  const { auth } = useAuth()
  const supabase = createClient()

  const handleTaskClick = (task: Task) => {
    if (canEditTask(auth.user)) {
      setEditingTask(task)
      setOriginalTask(task)
      setIsEditOpen(true)
    }
  }

  const handleTaskStatusChange = (taskId: string, newStatus: string) => {
    setTasks(
      tasks.map((t) =>
        t && t.id === taskId ? { ...t, status: newStatus as "todo" | "in-progress" | "done" | "awaiting-feedback" } : t,
      ),
    )
  }

  useEffect(() => {
    fetchTasks()
    fetchUsers()
    fetchProjectFiles()
  }, [project.id])

  useEffect(() => {
    const handleNavigateToTask = (event: CustomEvent) => {
      const { projectId, taskId, forceRefresh } = event.detail

      // If this is the current project and forceRefresh is true, reload the data
      if (projectId === project.id && forceRefresh) {
        fetchTasks()

        // Scroll to the specific task after a short delay to allow data to load
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
    }

    window.addEventListener("navigate-to-task", handleNavigateToTask as EventListener)

    return () => {
      window.removeEventListener("navigate-to-task", handleNavigateToTask as EventListener)
    }
  }, [project.id])

  const fetchTasks = async () => {
    const { data: tasksData, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("project_id", project.id)
      .order("position", { ascending: true })

    if (tasksError) {
      console.error("Error fetching tasks:", tasksError)
      throw tasksError
    }

    const userIds = new Set<string>()
    tasksData?.forEach((task) => {
      if (task.assigned_to) userIds.add(task.assigned_to)
      if (task.created_by) userIds.add(task.created_by)
    })

    const userIdsArray = Array.from(userIds)

    // Fetch from both users and guest_users tables
    const [regularUsersResult, guestUsersResult] = await Promise.all([
      supabase.from("users").select("id, full_name").in("id", userIdsArray),
      supabase.from("guest_users").select("id, full_name").in("id", userIdsArray),
    ])

    // Combine user data
    const userMap = new Map<string, { full_name: string }>()
    regularUsersResult.data?.forEach((user) => userMap.set(user.id, { full_name: user.full_name }))
    guestUsersResult.data?.forEach((user) => userMap.set(user.id, { full_name: user.full_name }))

    const tasksWithUsers = tasksData?.map((task) => ({
      ...task,
      assignee: task.assigned_to ? userMap.get(task.assigned_to) : undefined,
      creator: task.created_by ? userMap.get(task.created_by) : undefined,
    }))

    setTasks(tasksWithUsers || [])
    setIsLoading(false)
  }

  const fetchUsers = async () => {
    try {
      const { data: regularUsers, error: usersError } = await supabase.from("users").select("id, full_name, email")

      const { data: guestUsers, error: guestError } = await supabase.from("guest_users").select("id, full_name, email")

      if (usersError) {
        console.error("Error fetching regular users:", usersError)
        throw usersError
      }
      if (guestError) {
        console.error("Error fetching guest users:", guestError)
        throw guestError
      }

      // Combine both arrays
      const allUsers = [...(regularUsers || []), ...(guestUsers || [])]

      setUsers(allUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const fetchProjectFiles = async () => {
    try {
      const { data, error } = await supabase
        .from("file_attachments")
        .select("*")
        .eq("project_id", project.id)
        .order("created_at", { ascending: false })

      if (error) throw error
      setProjectFiles(data || [])
    } catch (error) {
      // The UI will simply show no files if there's an error
    }
  }

  const calculateBusinessDays = (startDate: Date, endDate: Date): number => {
    let count = 0
    const current = new Date(startDate)

    while (current <= endDate) {
      const dayOfWeek = current.getDay()
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday (0) or Saturday (6)
        count++
      }
      current.setDate(current.getDate() + 1)
    }

    return count
  }

  const getDaysRemaining = (dueDate: string | null): { days: number; isOverdue: boolean } => {
    if (!dueDate) return { days: 0, isOverdue: false }

    const today = new Date()
    const due = new Date(dueDate)

    // Reset time to start of day for accurate comparison
    today.setHours(0, 0, 0, 0)
    due.setHours(0, 0, 0, 0)

    if (due < today) {
      const overdueDays = calculateBusinessDays(due, today) - 1
      return { days: overdueDays, isOverdue: true }
    }

    const remainingDays = calculateBusinessDays(today, due)
    return { days: remainingDays, isOverdue: false }
  }

  const createTask = async () => {
    if (!newTask.title.trim()) return

    setIsCreating(true)
    try {
      const maxPosition = Math.max(...tasks.filter((t) => t && t.status === "todo").map((t) => t.position), -1)

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: newTask.title.trim(),
          description: newTask.description.trim() || null,
          assigned_to: newTask.assigned_to || null,
          due_date: newTask.due_date || null,
          project_id: project.id,
          created_by: auth.user?.id,
          status: newTask.status,
          position: maxPosition + 1,
        })
        .select()
        .single()

      if (error) throw error

      // Fetch user data separately to handle both regular users and guest users
      const userIds = []
      if (data.assigned_to) userIds.push(data.assigned_to)
      if (data.created_by) userIds.push(data.created_by)

      const [regularUsersResult, guestUsersResult] = await Promise.all([
        supabase.from("users").select("id, full_name").in("id", userIds),
        supabase.from("guest_users").select("id, full_name").in("id", userIds),
      ])

      const userMap = new Map<string, { full_name: string }>()
      regularUsersResult.data?.forEach((user) => userMap.set(user.id, { full_name: user.full_name }))
      guestUsersResult.data?.forEach((user) => userMap.set(user.id, { full_name: user.full_name }))

      const taskWithUsers = {
        ...data,
        assignee: data.assigned_to ? userMap.get(data.assigned_to) : undefined,
        creator: data.created_by ? userMap.get(data.created_by) : undefined,
      }

      if (data.assigned_to && data.assigned_to !== auth.user?.id) {
        try {
          const notificationResponse = await fetch("/api/notifications/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: data.assigned_to,
              type: "task_assigned",
              message: `You have been assigned to task: ${data.title}`,
              reference_id: data.id,
              reference_type: "task",
            }),
          })

          const notificationResult = await notificationResponse.json()

          if (!notificationResponse.ok) {
            console.error("Failed to create notification:", notificationResult)
            alert(`Task created but failed to notify assignee: ${notificationResult.error || "Unknown error"}`)
          }
        } catch (notificationError) {
          console.error("Exception while creating notification:", notificationError)
          alert(
            `Task created but failed to notify assignee: ${notificationError instanceof Error ? notificationError.message : "Unknown error"}`,
          )
        }
      }

      setTasks([...tasks, taskWithUsers])
      setNewTask({ title: "", description: "", status: "todo", assigned_to: "", due_date: "" })
      setIsCreateTaskOpen(false)
    } catch (error) {
      console.error("Error creating task:", error)
      alert(`Failed to create task: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setIsCreating(false)
    }
  }

  const updateTask = async (updatedTask: Task) => {
    const originalTask = tasks.find((t) => t.id === updatedTask.id)
    if (!originalTask) return

    try {
      const assignedToChanged = originalTask.assigned_to !== updatedTask.assigned_to

      const { data, error } = await supabase
        .from("tasks")
        .update({
          title: updatedTask.title,
          description: updatedTask.description,
          status: updatedTask.status,
          assigned_to: updatedTask.assigned_to,
          due_date: updatedTask.due_date,
        })
        .eq("id", editingTask.id)
        .select(`
          *,
          assignee:users!tasks_assigned_to_fkey(full_name),
          creator:users!tasks_created_by_fkey(full_name)
        `)
        .single()

      if (error) {
        console.error("Task update error:", error)
        throw error
      }

      if (assignedToChanged && data.assigned_to && data.assigned_to !== auth.user?.id) {
        try {
          const notificationResponse = await fetch("/api/notifications/create", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              user_id: data.assigned_to,
              type: "task_assigned",
              message: `You have been assigned to task: ${data.title}`,
              reference_id: data.id,
              reference_type: "task",
            }),
          })

          const notificationResult = await notificationResponse.json()

          if (!notificationResponse.ok) {
            console.error("Failed to create notification:", {
              status: notificationResponse.status,
              error: notificationResult,
              user_id: data.assigned_to,
              task_id: data.id,
            })
            alert(`Task updated but failed to notify assignee: ${notificationResult.error || "Unknown error"}`)
          }
        } catch (notificationError) {
          console.error("Exception while creating notification:", {
            error: notificationError,
            user_id: data.assigned_to,
            task_id: data.id,
          })
          alert(
            `Task updated but failed to notify assignee: ${notificationError instanceof Error ? notificationError.message : "Unknown error"}`,
          )
        }
      }

      await fetchTasks()

      setIsEditOpen(false)
      setEditingTask(null)
      setOriginalTask(null)
    } catch (error) {
      console.error("Error updating task:", error)
      alert(`Failed to update task: ${error instanceof Error ? error.message : "Unknown error"}`)
    }
  }

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase.from("tasks").delete().eq("id", taskId)

      if (error) throw error

      setTasks(tasks.filter((t) => t.id !== taskId))
    } catch (error) {
      console.error("Error deleting task:", error)
    }
  }

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId } = result

    if (!destination) return
    if (destination.droppableId === source.droppableId && destination.index === source.index) return

    const task = tasks.find((t) => t && t.id === draggableId)
    if (!task) return

    const newStatus = destination.droppableId as "todo" | "in-progress" | "done" | "awaiting-feedback"
    const tasksInDestination = tasks.filter((t) => t && t.status === newStatus)

    let newPosition: number
    if (tasksInDestination.length === 0) {
      newPosition = 1000
    } else if (destination.index === 0) {
      newPosition = tasksInDestination[0].position - 1000
    } else if (destination.index >= tasksInDestination.length) {
      newPosition = tasksInDestination[tasksInDestination.length - 1].position + 1000
    } else {
      const prevTask = tasksInDestination[destination.index - 1]
      const nextTask = tasksInDestination[destination.index]
      newPosition = Math.floor((prevTask.position + nextTask.position) / 2)

      // Ensure we don't get the same position as existing tasks
      if (newPosition === prevTask.position || newPosition === nextTask.position) {
        newPosition = prevTask.position + 500
      }
    }

    // Optimistically update UI
    const updatedTasks = tasks.map((t) =>
      t && t.id === draggableId ? { ...t, status: newStatus, position: newPosition } : t,
    )
    setTasks(updatedTasks)

    // Update database
    try {
      const { error } = await supabase
        .from("tasks")
        .update({ status: newStatus, position: newPosition })
        .eq("id", draggableId)

      if (error) throw error
    } catch (error) {
      console.error("Error updating task:", error)
      // Revert optimistic update
      setTasks(tasks)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (newTask.title.trim()) {
        createTask()
      }
    }
  }

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      if (editingTask && editingTask.title.trim()) {
        updateTask(editingTask)
      }
    }
  }

  const downloadFile = (fileUrl: string, filename: string) => {
    fetch(fileUrl)
      .then((response) => response.blob())
      .then((blob) => {
        const url = window.URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = filename
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
        window.URL.revokeObjectURL(url)
      })
      .catch((error) => {
        console.error("Error downloading file:", error)
        // Fallback to direct link
        const link = document.createElement("a")
        link.href = fileUrl
        link.download = filename
        link.target = "_blank"
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
      })
  }

  const downloadAllFiles = async () => {
    if (projectFiles.length === 0) return

    try {
      // Dynamic import of JSZip
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()

      // Add each file to the zip
      for (const file of projectFiles) {
        try {
          const response = await fetch(file.file_url)
          const blob = await response.blob()
          zip.file(file.filename, blob)
        } catch (error) {
          console.error(`Error downloading file ${file.filename}:`, error)
          // Continue with other files even if one fails
        }
      }

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" })

      // Create download link
      const link = document.createElement("a")
      link.href = URL.createObjectURL(zipBlob)
      link.download = `${project.name}_files.zip`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      // Clean up the object URL
      URL.revokeObjectURL(link.href)
    } catch (error) {
      console.error("Error creating zip file:", error)
      alert("Failed to create zip file. Please try again.")
    }
  }

  const imageFiles = projectFiles.filter((file) => isImage(file.filename) || isPDF(file.filename))

  const openImageCarousel = (fileUrl: string) => {
    const index = imageFiles.findIndex((file) => file.file_url === fileUrl)
    setCurrentImageIndex(index >= 0 ? index : 0)
    setSelectedImage(fileUrl)
  }

  const navigateImage = (direction: "prev" | "next") => {
    if (imageFiles.length === 0) return

    let newIndex = currentImageIndex
    if (direction === "prev") {
      newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : imageFiles.length - 1
    } else {
      newIndex = currentImageIndex < imageFiles.length - 1 ? currentImageIndex + 1 : 0
    }

    setCurrentImageIndex(newIndex)
    setSelectedImage(imageFiles[newIndex].file_url)
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedImage && imageFiles.length > 1) {
        if (e.key === "ArrowLeft") {
          e.preventDefault()
          navigateImage("prev")
        } else if (e.key === "ArrowRight") {
          e.preventDefault()
          navigateImage("next")
        }
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => document.removeEventListener("keydown", handleKeyDown)
  }, [selectedImage, currentImageIndex, imageFiles.length])

  const duplicateTask = async (taskToDuplicate: Task) => {
    if (!taskToDuplicate) return

    try {
      const maxPosition = Math.max(
        ...tasks.filter((t) => t && t.status === taskToDuplicate.status).map((t) => t.position),
        -1,
      )

      const { data, error } = await supabase
        .from("tasks")
        .insert({
          title: `${taskToDuplicate.title} (Copy)`,
          description: taskToDuplicate.description,
          assigned_to: taskToDuplicate.assigned_to,
          due_date: taskToDuplicate.due_date,
          project_id: project.id,
          created_by: auth.user?.id,
          status: taskToDuplicate.status,
          position: maxPosition + 1000,
        })
        .select()
        .single()

      if (error) throw error

      // Fetch user data separately to handle both regular users and guest users
      const userIds = []
      if (data.assigned_to) userIds.push(data.assigned_to)
      if (data.created_by) userIds.push(data.created_by)

      const [regularUsersResult, guestUsersResult] = await Promise.all([
        supabase.from("users").select("id, full_name").in("id", userIds),
        supabase.from("guest_users").select("id, full_name").in("id", userIds),
      ])

      const userMap = new Map<string, { full_name: string }>()
      regularUsersResult.data?.forEach((user) => userMap.set(user.id, { full_name: user.full_name }))
      guestUsersResult.data?.forEach((user) => userMap.set(user.id, { full_name: user.full_name }))

      const taskWithUsers = {
        ...data,
        assignee: data.assigned_to ? userMap.get(data.assigned_to) : undefined,
        creator: data.created_by ? userMap.get(data.created_by) : undefined,
      }

      setTasks([...tasks, taskWithUsers])
      setIsEditOpen(false)
      setEditingTask(null)
      setOriginalTask(null)
    } catch (error) {
      console.error("Error duplicating task:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">Loading tasks...</div>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <div className="flex-1 p-2 sm:p-4 md:p-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 md:mb-6 gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={onBack}
              className="p-1 sm:p-2 text-primary bg-background border-foreground border sm:px-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </Button>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-foreground truncate">{project?.name}</h1>
            </div>
          </div>
          {canCreateTask(auth.user) && (
            <Button onClick={() => setIsCreateTaskOpen(true)} className="w-full sm:w-auto text-sm" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Task
            </Button>
          )}
        </div>

        {/* Project Description and Files */}
        <div className="space-y-6">
          <div className="flex gap-4 items-start">
            <div className="flex-1 px-1.5">
              {project.description && (
                <div className="mb-4">
                  <div
                    className="prose prose-sm max-w-none text-sm text-muted-foreground [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 max-h-[400px] overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: formatContent(project.description) }}
                  />
                </div>
              )}
              {projectFiles.length > 0 && (
                <div className="space-y-2 items-end">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">Attached Files:</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={downloadAllFiles}
                      className="flex items-center gap-2 bg-transparent text-slate-950"
                    >
                      <Archive className="w-4 h-4" />
                      Download All
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {projectFiles.map((file) => (
                      <div key={file.id} className="group">
                        {isImage(file.filename) ? (
                          <div className="relative">
                            <div
                              className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-80 transition-opacity border border-border"
                              onClick={() => openImageCarousel(file.file_url)}
                            >
                              <img
                                src={file.file_url || "/placeholder.svg"}
                                alt={file.filename}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate" title={file.filename}>
                              {file.filename}
                            </p>
                          </div>
                        ) : isPDF(file.filename) ? (
                          <div className="relative">
                            <div
                              className="aspect-square border rounded-lg bg-red-50 cursor-pointer hover:bg-red-100 transition-colors flex items-center justify-center"
                              onClick={() => openImageCarousel(file.file_url)}
                            >
                              <div className="text-center">
                                <div className="w-10 h-10 bg-red-600 rounded mx-auto mb-2 flex items-center justify-center">
                                  <span className="text-sm text-white font-bold">PDF</span>
                                </div>
                                <span className="text-xs text-red-600 font-medium">Click to view</span>
                              </div>
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 truncate" title={file.filename}>
                              {file.filename}
                            </p>
                          </div>
                        ) : (
                          <div className="aspect-square border rounded-lg p-3 hover:bg-muted/50 transition-colors flex flex-col items-center justify-center">
                            <Download className="w-8 h-8 text-muted-foreground mb-2" />
                            <button
                              onClick={() => downloadFile(file.file_url, file.filename)}
                              className="text-xs text-blue-600 hover:text-blue-800 underline text-center truncate w-full px-2"
                              title={file.filename}
                            >
                              {file.filename}
                            </button>
                            <p className="text-xs text-muted-foreground mt-1">
                              {file.file_type ? file.file_type.toUpperCase() : "FILE"}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {!project.description && projectFiles.length === 0 && (
                <p className="text-muted-foreground mt-1">Manage tasks for this project</p>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="tasks" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="tasks" className="text-sm">
              Tasks
            </TabsTrigger>
            <TabsTrigger value="discussion" className="text-sm">
              <MessageSquare className="w-4 h-4 mr-1 sm:mr-2" />
              <span className="hidden xs:inline">Discussion</span>
              <span className="xs:hidden">Chat</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="discussion" className="mt-6">
            <ProjectDiscussion project={project} />
          </TabsContent>

          <TabsContent value="tasks" className="mt-0">
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2 sm:gap-4 md:gap-6">
                {/* Todo Column */}
                <div className="bg-gray-50 rounded-lg p-2 sm:p-3 md:p-4">
                  <h3 className="font-semibold text-gray-700 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base">
                    <Clock className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="truncate">To Do ({tasks.filter((t) => t && t.status === "todo").length})</span>
                  </h3>
                  <Droppable droppableId="todo">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-1 sm:space-y-2 md:space-y-3 min-h-[120px] sm:min-h-[150px] md:min-h-[200px]"
                      >
                        {tasks
                          .filter((t) => t && t.status === "todo")
                          .sort((a, b) => a.position - b.position)
                          .map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onClick={() => handleTaskClick(task)}
                              onStatusChange={handleTaskStatusChange}
                            />
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* In Progress Column */}
                <div className="bg-blue-50 rounded-lg p-2 sm:p-3 md:p-4">
                  <h3 className="font-semibold text-blue-700 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base">
                    <Play className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="truncate">
                      In Progress ({tasks.filter((t) => t && t.status === "in-progress").length})
                    </span>
                  </h3>
                  <Droppable droppableId="in-progress">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-1 sm:space-y-2 md:space-y-3 min-h-[120px] sm:min-h-[150px] md:min-h-[200px]"
                      >
                        {tasks
                          .filter((t) => t && t.status === "in-progress")
                          .sort((a, b) => a.position - b.position)
                          .map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onClick={() => handleTaskClick(task)}
                              onStatusChange={handleTaskStatusChange}
                            />
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Awaiting Feedback Column */}
                <div className="bg-yellow-50 rounded-lg p-2 sm:p-3 md:p-4">
                  <h3 className="font-semibold text-yellow-700 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base">
                    <MessageCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="truncate">
                      Awaiting Feedback ({tasks.filter((t) => t && t.status === "awaiting-feedback").length})
                    </span>
                  </h3>
                  <Droppable droppableId="awaiting-feedback">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-1 sm:space-y-2 md:space-y-3 min-h-[120px] sm:min-h-[150px] md:min-h-[200px]"
                      >
                        {tasks
                          .filter((t) => t && t.status === "awaiting-feedback")
                          .sort((a, b) => a.position - b.position)
                          .map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onClick={() => handleTaskClick(task)}
                              onStatusChange={handleTaskStatusChange}
                            />
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Done Column */}
                <div className="bg-green-50 rounded-lg p-2 sm:p-3 md:p-4">
                  <h3 className="font-semibold text-green-700 mb-2 sm:mb-3 md:mb-4 flex items-center gap-1 sm:gap-2 text-xs sm:text-sm md:text-base">
                    <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                    <span className="truncate">Done ({tasks.filter((t) => t && t.status === "done").length})</span>
                  </h3>
                  <Droppable droppableId="done">
                    {(provided) => (
                      <div
                        {...provided.droppableProps}
                        ref={provided.innerRef}
                        className="space-y-1 sm:space-y-2 md:space-y-3 min-h-[120px] sm:min-h-[150px] md:min-h-[200px]"
                      >
                        {tasks
                          .filter((t) => t && t.status === "done")
                          .sort((a, b) => a.position - b.position)
                          .map((task, index) => (
                            <TaskCard
                              key={task.id}
                              task={task}
                              index={index}
                              onClick={() => handleTaskClick(task)}
                              onStatusChange={handleTaskStatusChange}
                            />
                          ))}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            </DragDropContext>
          </TabsContent>
        </Tabs>
      </div>

      {/* Dialogs */}
      {canCreateTask(auth.user) && (
        <Dialog open={isCreateTaskOpen} onOpenChange={setIsCreateTaskOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Task</DialogTitle>
              <DialogDescription>Add a new task to this project</DialogDescription>
            </DialogHeader>
            <div className="space-y-6">
              <div>
                <Label htmlFor="title">Task Title</Label>
                <Input
                  className="border-transparent mt-2"
                  id="title"
                  value={newTask.title}
                  onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                  onKeyDown={handleKeyDown}
                  placeholder="Enter task title"
                />
              </div>
              <div>
                <Label htmlFor="description">Description (Optional)</Label>
                <Textarea
                  className="mt-2"
                  id="description"
                  value={newTask.description}
                  onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                  placeholder="Describe this task"
                  rows={6}
                />
              </div>
              <div>
                <Label htmlFor="status">Status</Label>
                <Select
                  value={newTask.status}
                  onValueChange={(value: "todo" | "in-progress" | "done" | "awaiting-feedback") =>
                    setNewTask({ ...newTask, status: value })
                  }
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todo">To Do</SelectItem>
                    <SelectItem value="in-progress">In Progress</SelectItem>
                    <SelectItem value="awaiting-feedback">Awaiting Feedback</SelectItem>
                    <SelectItem value="done">Done</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="due_date">Due Date (Optional)</Label>
                <Input
                  className="mt-2"
                  id="due_date"
                  type="date"
                  value={newTask.due_date}
                  onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="assigned_to">Assign To (Optional)</Label>
                <Select
                  value={newTask.assigned_to}
                  onValueChange={(value) => setNewTask({ ...newTask, assigned_to: value })}
                >
                  <SelectTrigger className="mt-2">
                    <SelectValue placeholder="Select a user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.full_name} ({user.email})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateTaskOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createTask} disabled={isCreating || !newTask.title.trim()}>
                  {isCreating ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {canEditTask(auth.user) && (
        <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
          <DialogContent className="border-slate-300 max-w-[95vw] sm:max-w-lg w-full mx-auto p-4 sm:p-6">
            <DialogHeader>
              <DialogTitle>Edit Task</DialogTitle>
              <DialogDescription>Update the task details below.</DialogDescription>
            </DialogHeader>
            {editingTask && (
              <div className="space-y-4 sm:space-y-6">
                <div>
                  <Label htmlFor="edit-title">Title</Label>
                  <Input
                    className="border-slate-300 mt-2"
                    id="edit-title"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({ ...editingTask, title: e.target.value })}
                    onKeyDown={handleEditKeyDown}
                    placeholder="Task title"
                  />
                </div>

                <div>
                  <Label htmlFor="edit-description">Description</Label>
                  <Textarea
                    className="border-slate-300 mt-2 break-all"
                    id="edit-description"
                    value={editingTask.description || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, description: e.target.value })}
                    onKeyDown={handleEditKeyDown}
                    placeholder="Task description"
                    rows={6}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-status">Status</Label>
                  <Select
                    value={editingTask.status}
                    onValueChange={(value) =>
                      setEditingTask({
                        ...editingTask,
                        status: value as "todo" | "in-progress" | "done" | "awaiting-feedback",
                      })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todo">To Do</SelectItem>
                      <SelectItem value="in-progress">In Progress</SelectItem>
                      <SelectItem value="awaiting-feedback">Awaiting Feedback</SelectItem>
                      <SelectItem value="done">Done</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="edit-due-date">Due Date</Label>
                  <Input
                    className="mt-2"
                    id="edit-due-date"
                    type="date"
                    value={editingTask.due_date || ""}
                    onChange={(e) => setEditingTask({ ...editingTask, due_date: e.target.value })}
                  />
                </div>

                <div>
                  <Label htmlFor="edit-assigned-to">Assign To</Label>
                  <Select
                    value={editingTask.assigned_to || "unassigned"}
                    onValueChange={(value) =>
                      setEditingTask({ ...editingTask, assigned_to: value === "unassigned" ? null : value })
                    }
                  >
                    <SelectTrigger className="mt-2">
                      <SelectValue placeholder="Select a user" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="unassigned">Unassigned</SelectItem>
                      {users.map((user) => (
                        <SelectItem key={user.id} value={user.id}>
                          {user.full_name} ({user.email})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex flex-wrap justify-end gap-2 text-center">
                  <Button variant="outline" onClick={() => setIsEditOpen(false)} className="flex-1 sm:flex-none">
                    Cancel
                  </Button>
                  {canDeleteTask(auth.user) && (
                    <Button
                      variant="destructive"
                      onClick={() => {
                        if (editingTask) {
                          const confirmed = confirm(
                            `Are you sure you want to delete the task "${editingTask.title}"? This action cannot be undone.`,
                          )
                          if (confirmed) {
                            deleteTask(editingTask.id)
                            setIsEditOpen(false)
                            setEditingTask(null)
                          }
                        }
                      }}
                      className="flex-1 sm:flex-none"
                    >
                      Delete Task
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={() => {
                      if (editingTask) {
                        duplicateTask(editingTask)
                      }
                    }}
                    className="flex items-center gap-2 flex-1 sm:flex-none"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Duplicate
                  </Button>
                  <Button onClick={() => updateTask(editingTask)} className="flex-1 sm:flex-none py-[0] my-0.5">
                    Update Task
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl py-11">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DialogTitle>
                  {imageFiles[currentImageIndex] && isImage(imageFiles[currentImageIndex].filename)
                    ? "Image Preview"
                    : imageFiles[currentImageIndex] && isPDF(imageFiles[currentImageIndex].filename)
                      ? "PDF Preview"
                      : "File Preview"}
                </DialogTitle>
                {imageFiles.length > 1 && (
                  <span className="text-sm text-muted-foreground">
                    {currentImageIndex + 1} of {imageFiles.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {imageFiles.length > 1 && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => navigateImage("prev")}>
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => navigateImage("next")}>
                      <ChevronRight className="w-4 h-4" />
                    </Button>
                  </>
                )}
                {selectedImage && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const currentFile = imageFiles[currentImageIndex]
                      if (currentFile) {
                        downloadFile(selectedImage, currentFile.filename)
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>
          {selectedImage && (
            <div className="flex justify-center relative">
              {imageFiles[currentImageIndex] && isImage(imageFiles[currentImageIndex].filename) ? (
                <img
                  src={selectedImage || "/placeholder.svg"}
                  alt="Preview"
                  className="max-w-full max-h-[70vh] object-contain rounded"
                />
              ) : imageFiles[currentImageIndex] && isPDF(imageFiles[currentImageIndex].filename) ? (
                <div className="w-full max-w-4xl h-[70vh] border rounded">
                  <iframe
                    src={selectedImage}
                    className="w-full h-full rounded"
                    title={`PDF Preview: ${imageFiles[currentImageIndex].filename}`}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg">
                  <Download className="w-16 h-16 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">{imageFiles[currentImageIndex]?.filename}</p>
                  <Button
                    onClick={() => {
                      const currentFile = imageFiles[currentImageIndex]
                      if (currentFile) {
                        downloadFile(selectedImage, currentFile.filename)
                      }
                    }}
                  >
                    <Download className="w-4 h-4 mr-2" />
                    Download File
                  </Button>
                </div>
              )}
            </div>
          )}
          {selectedImage && imageFiles[currentImageIndex] && (
            <div className="text-center text-sm text-muted-foreground mt-2">
              <p className="font-medium">{imageFiles[currentImageIndex].filename}</p>
              <p>
                {imageFiles[currentImageIndex].file_type
                  ? imageFiles[currentImageIndex].file_type.toUpperCase()
                  : isPDF(imageFiles[currentImageIndex].filename)
                    ? "PDF"
                    : "FILE"}
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

export { KanbanBoard }
