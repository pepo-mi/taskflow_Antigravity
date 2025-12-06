"use client"

import { useState } from "react"
import { Bell, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/use-auth"
import { createClient } from "@/lib/supabase/client"
import useSWR from "swr"

interface Notification {
  id: string
  user_id: string
  type: string
  message: string
  related_id: string | null
  related_type: string | null
  read: boolean
  created_at: string
}

interface NotificationResponse {
  notifications: Notification[]
}

const CACHE_KEY = "taskflow_notifications_cache"
const CACHE_TIMESTAMP_KEY = "taskflow_notifications_timestamp"
const CACHE_DURATION = 2 * 60 * 1000 // 2 minutes

const fetcher = async (url: string): Promise<NotificationResponse> => {
  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`)
  }
  return response.json()
}

const loadFromCache = (): NotificationResponse | null => {
  if (typeof window === "undefined") return null

  try {
    const cached = localStorage.getItem(CACHE_KEY)
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY)

    if (cached && timestamp) {
      const age = Date.now() - Number.parseInt(timestamp, 10)
      if (age < CACHE_DURATION) {
        return JSON.parse(cached)
      }
    }
  } catch (error) {
    console.error("Error loading from cache:", error)
  }

  return null
}

const saveToCache = (data: NotificationResponse) => {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.error("Error saving to cache:", error)
  }
}

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const { auth } = useAuth()
  const supabase = createClient()

  const { data, error, mutate, isValidating } = useSWR<NotificationResponse>(
    auth.user ? "/api/notifications" : null,
    fetcher,
    {
      fallbackData: loadFromCache() || undefined,
      refreshInterval: isOpen ? 30000 : 300000, // 30s when open, 5min when closed
      dedupingInterval: 20000, // Prevent duplicate requests within 20s
      revalidateOnFocus: false, // Don't refetch on tab focus
      revalidateOnReconnect: false, // Don't refetch on reconnect
      revalidateOnMount: true,
      onSuccess: (data) => {
        saveToCache(data)
      },
      onError: (err) => {
        console.error("SWR error:", err)
        const cached = loadFromCache()
      },
    },
  )

  const notifications = data?.notifications || []
  const unreadCount = notifications.filter((n) => !n.read).length

  const handleManualRefresh = async () => {
    setIsRefreshing(true)
    try {
      await mutate(undefined, { revalidate: true })
    } finally {
      setIsRefreshing(false)
    }
  }

  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      })

      if (response.ok) {
        mutate((current) => {
          if (!current) return current
          return {
            notifications: current.notifications.map((n) => (n.id === notificationId ? { ...n, read: true } : n)),
          }
        }, false)
      }
    } catch (error) {
      console.error("Error marking notification as read:", error)
    }
  }

  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/read-all", {
        method: "PATCH",
      })

      if (response.ok) {
        mutate((current) => {
          if (!current) return current
          return {
            notifications: current.notifications.map((n) => ({ ...n, read: true })),
          }
        }, false)
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error)
    }
  }

  const handleNotificationClick = async (notification: Notification) => {
    if (!notification.read) {
      await markAsRead(notification.id)
    }

    setIsOpen(false)

    if (notification.related_id && notification.related_type) {
      try {
        if (notification.related_type === "task") {
          const { data: task, error: taskError } = await supabase
            .from("tasks")
            .select("project_id")
            .eq("id", notification.related_id)
            .single()

          if (task) {
            window.dispatchEvent(
              new CustomEvent("navigate-to-task", {
                detail: {
                  projectId: task.project_id,
                  taskId: notification.related_id,
                  forceRefresh: true,
                },
              }),
            )
          } else {
            console.error("Task not found or access denied:", taskError)
          }
        } else if (notification.related_type === "comment" || notification.related_type === "post") {
          const { data: post, error: postError } = await supabase
            .from("posts")
            .select("project_id")
            .eq("id", notification.related_id)
            .single()

          if (post) {
            window.dispatchEvent(
              new CustomEvent("navigate-to-discussion", {
                detail: {
                  projectId: post.project_id,
                  postId: notification.related_id,
                  forceRefresh: true,
                },
              }),
            )
          } else {
            console.error("Post not found or access denied:", postError)
          }
        } else if (notification.related_type === "project") {
          const { data: project, error: projectError } = await supabase
            .from("projects")
            .select("id, name, description, created_at, created_by, workspace_id")
            .eq("id", notification.related_id)
            .single()

          if (project) {
            window.dispatchEvent(
              new CustomEvent("navigate-to-project", {
                detail: {
                  projectId: project.id,
                  forceRefresh: true,
                },
              }),
            )
          } else {
            console.error("Project not found or access denied:", projectError)
          }
        }
      } catch (error) {
        console.error("Error navigating from notification:", error)
      }
    }
  }

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString)
    const now = new Date()
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000)

    if (diffInSeconds < 60) return "just now"
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`
    return `${Math.floor(diffInSeconds / 86400)}d ago`
  }

  if (!auth.user) {
    return null
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="relative">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
        <div className="flex items-center justify-between px-2 py-2">
          <h3 className="font-semibold text-sm">Notifications</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleManualRefresh}
              disabled={isRefreshing || isValidating}
              className="text-xs h-auto py-1"
            >
              <RefreshCw className={`w-3 h-3 ${isRefreshing || isValidating ? "animate-spin" : ""}`} />
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs h-auto py-1">
                Mark all read
              </Button>
            )}
          </div>
        </div>
        <DropdownMenuSeparator />
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">No notifications yet</div>
        ) : (
          notifications.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={`flex flex-col items-start gap-1 p-3 cursor-pointer ${!notification.read ? "bg-blue-50" : ""}`}
              onClick={() => handleNotificationClick(notification)}
            >
              <div className="flex items-start justify-between w-full gap-2">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">{notification.message}</p>
                </div>
                {!notification.read && <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0 mt-1" />}
              </div>
              <span className="text-xs text-muted-foreground">{getRelativeTime(notification.created_at)}</span>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
