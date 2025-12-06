"use client"
import { Draggable } from "@hello-pangea/dnd"
import type React from "react"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { UserIcon, CheckCircle } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { useState } from "react"

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

interface TaskCardProps {
  task: Task
  index: number
  onClick: () => void
  onStatusChange?: (taskId: string, newStatus: string) => void
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

const getDaysRemainingStyle = (days: number, isOverdue: boolean) => {
  if (isOverdue) {
    return "bg-red-100 text-red-800 border-red-200"
  }

  if (days <= 3) {
    return "bg-red-100 text-red-800 border-red-200"
  } else if (days <= 5) {
    return "bg-orange-100 text-orange-800 border-orange-200"
  } else {
    return "bg-green-100 text-green-800 border-green-200"
  }
}

const formatContent = (content: string) => {
  if (!content) return content

  // Remove empty div/br blocks and other visual artifacts
  const cleaned = content
    .replace(/<div><br><\/div>/g, "") // Remove empty div/br blocks
    .replace(/<div><br\/><\/div>/g, "") // Remove self-closing br variant
    .replace(/<div>\s*<\/div>/g, "") // Remove empty divs with whitespace
    .replace(/<p><br><\/p>/g, "") // Remove empty p/br blocks
    .replace(/<p><br\/><\/p>/g, "") // Remove self-closing br variant in p
    .replace(/<p>\s*<\/p>/g, "") // Remove empty paragraphs
    .replace(/(<br\s*\/?>){2,}/g, "<br>") // Replace multiple consecutive br tags with single br
    .trim()

  const hasHtmlTags = /<[^>]+>/.test(cleaned)

  if (!hasHtmlTags) {
    // Plain text content - linkify URLs
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+)/g
    return cleaned.replace(urlRegex, (url) => {
      const href = url.startsWith("www.") ? `https://${url}` : url
      return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${url}</a>`
    })
  }

  return cleaned
}

export function TaskCard({ task, index, onClick, onStatusChange }: TaskCardProps) {
  const { days, isOverdue } = getDaysRemaining(task.due_date)
  const [isCompleting, setIsCompleting] = useState(false)
  const supabase = createClient()

  const handleMarkComplete = async (e: React.MouseEvent) => {
    e.stopPropagation() // Prevent card click event

    if (task.status === "done") return // Already complete

    setIsCompleting(true)
    try {
      const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", task.id)

      if (error) throw error

      // Notify parent component of the change
      if (onStatusChange) {
        onStatusChange(task.id, "done")
      }
    } catch (error) {
      console.error("Error marking task as complete:", error)
    } finally {
      setIsCompleting(false)
    }
  }

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <Card
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          data-task-id={task.id}
          className={`cursor-pointer transition-all hover:shadow-md ${snapshot.isDragging ? "shadow-lg rotate-2" : ""}`}
          onClick={onClick}
        >
          <CardContent className="p-4 relative">
            {task.status !== "done" && (
              <Button
                size="sm"
                variant="ghost"
                className="absolute top-2 right-2 h-7 px-2 text-xs hover:bg-green-100 hover:text-green-700 [&:autofill]:bg-transparent [&:-webkit-autofill]:bg-transparent [&:-webkit-autofill]:shadow-none focus-visible:ring-2 focus-visible:ring-green-500 focus-visible:ring-offset-0"
                onClick={handleMarkComplete}
                disabled={isCompleting}
              >
                <CheckCircle className="w-3.5 h-3.5 mr-1" />
                {isCompleting ? "..." : "Complete"}
              </Button>
            )}

            <div className="space-y-3">
              <div className="pr-24">
                <h4 className="font-medium text-sm leading-tight">{task.title}</h4>
              </div>

              {task.description && (
                <div
                  className="text-xs text-muted-foreground line-clamp-2 prose prose-sm max-w-none [&_a]:underline [&_a]:text-primary [&_a]:hover:text-primary/80 [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4 [&_ul]:ml-4 [&_ol]:ml-4 break-words"
                  dangerouslySetInnerHTML={{ __html: formatContent(task.description) }}
                />
              )}

              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {task.assignee && (
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs text-muted-foreground italic">Assigned to</span>
                      <div className="flex items-center gap-1 min-w-0">
                        <UserIcon className="w-3 h-3 flex-shrink-0" />
                        <span className="text-xs text-foreground font-medium truncate">{task.assignee.full_name}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  {task.due_date && (
                    <Badge
                      variant="outline"
                      className={`text-xs font-medium ${getDaysRemainingStyle(days, isOverdue)}`}
                    >
                      {isOverdue ? `${days}d overdue` : days === 0 ? "Due today" : `${days} days left`}
                    </Badge>
                  )}

                  {task.status === "awaiting-feedback" && (
                    <Badge
                      variant="outline"
                      className="text-xs font-medium bg-yellow-100 text-yellow-800 border-yellow-200"
                    >
                      Awaiting Feedback
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </Draggable>
  )
}
