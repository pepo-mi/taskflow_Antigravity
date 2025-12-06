"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { canCreateWorkspace } from "@/lib/permissions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Plus, FolderOpen, MoreHorizontal, Edit2, Trash2, GripVertical, Users, Shield, User } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  DndContext,
  closestCenter,
  useSensors,
  useSensor,
  PointerSensor,
  KeyboardSensor,
  type DragEndEvent,
} from "@dnd-kit/core"
import { arrayMove, SortableContext, verticalListSortingStrategy, sortableKeyboardCoordinates } from "@dnd-kit/sortable"
import { useSortable } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import useSWR from "swr"

interface Workspace {
  id: string
  name: string
  description: string | null
  created_at: string
  created_by: string
  visibility: string | null
  specific_user_id?: string | null
  position?: number
  creator?: {
    full_name: string
  }
  specific_user?: {
    full_name: string
  }
  projects?: {
    id: string
    name: string
    completed: boolean
  }[]
}

interface WorkspaceListProps {
  onSelectWorkspace: (workspace: Workspace) => void
}

function getVisibilityInfo(visibility: string | null, workspace?: Workspace) {
  switch (visibility) {
    case "admin_only":
      return { icon: Shield, label: "Admin Only", color: "text-red-500" }
    case "specific_user":
      const userName = workspace?.specific_user?.full_name || "Unknown User"
      return { icon: User, label: userName, color: "text-yellow-500" }
    case "all":
    default:
      return { icon: Users, label: "All Users", color: "text-green-500" }
  }
}

function SortableWorkspace({
  workspace,
  onSelectWorkspace,
  onEdit,
  onDelete,
  auth,
}: {
  workspace: Workspace
  onSelectWorkspace: (workspace: Workspace) => void
  onEdit: (workspace: Workspace) => void
  onDelete: (workspaceId: string) => void
  auth: any
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: workspace.id,
  })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const totalProjects = workspace.projects?.length || 0
  const completedProjects = workspace.projects?.filter((p) => p.completed).length || 0

  const visibilityInfo = getVisibilityInfo(workspace.visibility, workspace)
  const VisibilityIcon = visibilityInfo.icon

  const handleCardClick = (e: React.MouseEvent) => {
    const target = e.target as HTMLElement
    if (
      target.closest("button") ||
      target.closest(".dropdown-trigger") ||
      target.closest("[data-radix-collection-item]")
    ) {
      return
    }
    onSelectWorkspace(workspace)
  }

  return (
    <div ref={setNodeRef} style={style} {...attributes} className={`${isDragging ? "shadow-2xl z-50" : ""}`}>
      <Card
        className="cursor-pointer hover:shadow-lg transition-all duration-200 hover:scale-[1.02] bg-card h-full flex flex-col border-gray-900 border"
        onClick={handleCardClick}
      >
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              {canCreateWorkspace(auth.user) && (
                <div {...listeners} className="cursor-grab active:cursor-grabbing p-1 hover:bg-muted rounded">
                  <GripVertical className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
              <FolderOpen className="w-5 h-5 text-muted-foreground" />
              <CardTitle className="font-semibold text-xl">{workspace.name}</CardTitle>
            </div>
            {auth.user && (canCreateWorkspace(auth.user) || auth.user.id === workspace.created_by) && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" onClick={(e) => e.stopPropagation()}>
                    <MoreHorizontal className="w-4 h-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(workspace)
                    }}
                  >
                    <Edit2 className="w-4 h-4 mr-2" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      if (
                        confirm(
                          `Are you sure you want to delete "${workspace.name}"?\n\nThis will permanently delete all projects, tasks, and discussions within it. This action cannot be undone.`,
                        )
                      ) {
                        onDelete(workspace.id)
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
          <div className="flex items-center gap-2 mt-2">
            <VisibilityIcon className={`w-4 h-4 ${visibilityInfo.color}`} />
            <span className={`text-xs font-medium ${visibilityInfo.color}`}>{visibilityInfo.label}</span>
          </div>
        </CardHeader>
        <CardContent className="space-y-4 flex-1 flex flex-col">
          {workspace.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">{workspace.description}</p>
          )}

          <div className="space-y-3 flex-1 flex flex-col justify-end">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{totalProjects}</div>
                  <div className="text-xs text-muted-foreground">Projects</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-gray-600">{completedProjects}</div>
                  <div className="text-xs text-muted-foreground">Completed</div>
                </div>
              </div>
            </div>

            {totalProjects > 0 && (
              <div className="space-y-2">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Progress</span>
                  <span>{Math.round((completedProjects / totalProjects) * 100)}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="bg-green-500 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${(completedProjects / totalProjects) * 100}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

const CACHE_KEY = "taskflow_workspaces_cache"
const CACHE_TIMESTAMP_KEY = "taskflow_workspaces_timestamp"
const CACHE_DURATION = 3 * 60 * 1000 // 3 minutes

const loadFromCache = (): Workspace[] | null => {
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
    console.error("Error loading workspaces from cache:", error)
  }

  return null
}

const saveToCache = (data: Workspace[]) => {
  if (typeof window === "undefined") return

  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(data))
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
  } catch (error) {
    console.error("Error saving workspaces to cache:", error)
  }
}

export function WorkspaceList({ onSelectWorkspace }: WorkspaceListProps) {
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [newWorkspace, setNewWorkspace] = useState({
    name: "",
    description: "",
    visibility: "all",
    specific_user_id: "",
  })
  const [isCreating, setIsCreating] = useState(false)
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null)
  const [editWorkspace, setEditWorkspace] = useState({
    name: "",
    description: "",
    visibility: "all",
    specific_user_id: "",
  })
  const [isEditing, setIsEditing] = useState(false)
  const [users, setUsers] = useState<Array<{ id: string; full_name: string; email: string }>>([])
  const { auth } = useAuth()
  const supabase = createClient()

  const workspaceFetcher = async (): Promise<Workspace[]> => {
    let query = supabase.from("workspaces").select(`
        *,
        creator:users!workspaces_created_by_fkey(full_name),
        specific_user:users!workspaces_specific_user_id_fkey(full_name),
        projects(id, name, completed)
      `)

    // For non-admin users (including guests), filter workspaces
    if (!canCreateWorkspace(auth.user)) {
      // Check if user is a guest
      const isGuest = auth.user?.role === "guest"

      if (isGuest) {
        // For guests: only show workspaces they have explicit access to via guest_workspace_access
        const { data: guestAccess } = await supabase
          .from("guest_workspace_access")
          .select("workspace_id")
          .eq("guest_id", auth.user?.id)

        const accessibleWorkspaceIds = guestAccess?.map((a) => a.workspace_id) || []

        if (accessibleWorkspaceIds.length > 0) {
          query = query.in("id", accessibleWorkspaceIds)
        } else {
          // Guest has no workspace access, return empty array
          return []
        }
      } else {
        // For regular users: show workspaces with visibility=all, created by them, or assigned to them
        query = query.or(`visibility.eq.all,created_by.eq.${auth.user?.id},specific_user_id.eq.${auth.user?.id}`)
      }
    }

    const { data, error } = await query.order("position", { ascending: true }).order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching workspaces:", error)
      throw error
    }

    return data || []
  }

  const {
    data: workspaces,
    error: workspacesError,
    mutate,
    isValidating,
  } = useSWR<Workspace[]>(auth.user ? "workspaces" : null, workspaceFetcher, {
    fallbackData: loadFromCache() || undefined,
    refreshInterval: 300000, // 5 minutes instead of 3
    dedupingInterval: 60000, // 1 minute deduplication
    revalidateOnFocus: false,
    revalidateOnReconnect: false,
    onSuccess: (data) => {
      saveToCache(data)
    },
    onError: (err) => {
      console.error("Error fetching workspaces:", err)
    },
  })

  const [isLoading, setIsLoading] = useState(!workspaces)
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  useEffect(() => {
    fetchUsers()
    if (workspaces) {
      setIsLoading(false)
    }
  }, [workspaces])

  const fetchUsers = async () => {
    try {
      const { data: regularUsers, error: usersError } = await supabase
        .from("users")
        .select("id, full_name, email")
        .order("full_name")

      const { data: guestUsers, error: guestError } = await supabase
        .from("guest_users")
        .select("id, full_name, email")
        .order("full_name")

      if (usersError) throw usersError
      if (guestError) throw guestError

      // Combine both arrays and sort by full_name
      const allUsers = [...(regularUsers || []), ...(guestUsers || [])].sort((a, b) =>
        a.full_name.localeCompare(b.full_name),
      )
      setUsers(allUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
    }
  }

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event
    if (active.id !== over?.id) {
      const oldIndex = workspaces!.findIndex((item) => item.id === active.id)
      const newIndex = workspaces!.findIndex((item) => item.id === over?.id)

      const reorderedWorkspaces = arrayMove(workspaces!, oldIndex, newIndex)
      mutate(reorderedWorkspaces, false)

      try {
        const updates = reorderedWorkspaces.map((workspace, index) => ({
          id: workspace.id,
          position: index,
        }))

        for (const update of updates) {
          await supabase.from("workspaces").update({ position: update.position }).eq("id", update.id)
        }
        mutate()
      } catch (error) {
        console.error("Error updating workspace positions:", error)
        mutate()
      }
    }
  }

  const createWorkspace = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    if (!newWorkspace.name.trim()) return

    setIsCreating(true)
    try {
      const workspaceData: Record<string, any> = {
        name: newWorkspace.name.trim(),
        description: newWorkspace.description.trim() || null,
        visibility: newWorkspace.visibility,
        created_by: auth.user?.id,
      }

      if (newWorkspace.visibility === "specific_user" && newWorkspace.specific_user_id) {
        workspaceData.specific_user_id = newWorkspace.specific_user_id
      }

      const { data, error } = await supabase
        .from("workspaces")
        .insert(workspaceData)
        .select(`
          *,
          creator:users!workspaces_created_by_fkey(full_name),
          specific_user:users!workspaces_specific_user_id_fkey(full_name),
          projects(id, name, completed)
        `)
        .single()

      if (error) throw error

      mutate([data, ...(workspaces || [])], false)
      setNewWorkspace({ name: "", description: "", visibility: "all", specific_user_id: "" })
      setIsCreateOpen(false)
      mutate()
    } catch (error) {
      console.error("Error creating workspace:", error)
    } finally {
      setIsCreating(false)
    }
  }

  const updateWorkspace = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault()
    }
    if (!editingWorkspace || !editWorkspace.name.trim()) return

    setIsEditing(true)
    try {
      const workspaceData: Record<string, any> = {
        name: editWorkspace.name.trim(),
        description: editWorkspace.description.trim() || null,
        visibility: editWorkspace.visibility,
      }

      if (editWorkspace.visibility === "specific_user" && editWorkspace.specific_user_id) {
        workspaceData.specific_user_id = editWorkspace.specific_user_id
      } else {
        workspaceData.specific_user_id = null
      }

      const { data, error } = await supabase
        .from("workspaces")
        .update(workspaceData)
        .eq("id", editingWorkspace.id)
        .select(`
          *,
          creator:users!workspaces_created_by_fkey(full_name),
          specific_user:users!workspaces_specific_user_id_fkey(full_name),
          projects(id, name, completed)
        `)
        .single()

      if (error) throw error

      mutate(
        workspaces?.map((w) => (w.id === editingWorkspace.id ? data : w)),
        false,
      )
      setEditingWorkspace(null)
      setEditWorkspace({ name: "", description: "", visibility: "all", specific_user_id: "" })
      mutate()
    } catch (error) {
      console.error("Error updating workspace:", error)
    } finally {
      setIsEditing(false)
    }
  }

  const deleteWorkspace = async (workspaceId: string) => {
    try {
      const { error } = await supabase.from("workspaces").delete().eq("id", workspaceId)

      if (error) throw error

      mutate(
        workspaces?.filter((w) => w.id !== workspaceId),
        false,
      )
      mutate()
    } catch (error) {
      console.error("Error deleting workspace:", error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">Loading workspaces...</div>
      </div>
    )
  }

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl md:text-2xl font-semibold text-foreground">Workspaces</h2>
        </div>
        {canCreateWorkspace(auth.user) && (
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/80 text-primary-foreground font-medium w-fit">
                <Plus className="w-4 h-4 mr-2" />
                New Workspace
              </Button>
            </DialogTrigger>
            <DialogContent className="mx-auto w-full max-w-lg px-4">
              <DialogHeader>
                <DialogTitle>Create New Workspace</DialogTitle>
                <DialogDescription>
                  Create a new workspace to organize your projects and collaborate with your team.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={createWorkspace} className="space-y-4 leading-7 py-0 my-0">
                <div>
                  <Label htmlFor="name">Workspace Name</Label>
                  <Input
                    className="my-1.5"
                    id="name"
                    value={newWorkspace.name}
                    onChange={(e) => setNewWorkspace({ ...newWorkspace, name: e.target.value })}
                    placeholder="Enter workspace name"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="description">Description (Optional)</Label>
                  <Textarea
                    className="py-0 my-1.5"
                    id="description"
                    value={newWorkspace.description}
                    onChange={(e) => setNewWorkspace({ ...newWorkspace, description: e.target.value })}
                    placeholder="Describe this workspace"
                    rows={3}
                  />
                </div>
                <div>
                  <Label htmlFor="visibility">Visibility</Label>
                  <Select
                    value={newWorkspace.visibility}
                    onValueChange={(value) =>
                      setNewWorkspace({ ...newWorkspace, visibility: value, specific_user_id: "" })
                    }
                  >
                    <SelectTrigger className="my-1.5">
                      <SelectValue placeholder="Select visibility" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-green-500" />
                          <span>All Users</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="admin_only">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-red-500" />
                          <span>Admin Only</span>
                        </div>
                      </SelectItem>
                      <SelectItem value="specific_user">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-yellow-500" />
                          <span>Specific User</span>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {newWorkspace.visibility === "specific_user" && (
                  <div>
                    <Label htmlFor="specific-user">Select User</Label>
                    <Select
                      value={newWorkspace.specific_user_id}
                      onValueChange={(value) => setNewWorkspace({ ...newWorkspace, specific_user_id: value })}
                    >
                      <SelectTrigger className="my-1.5">
                        <SelectValue placeholder="Choose a user" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((user) => (
                          <SelectItem key={user.id} value={user.id}>
                            <div className="flex flex-col items-start">
                              <span>{user.full_name}</span>
                              <span className="text-xs text-muted-foreground">{user.email}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={
                      isCreating ||
                      !newWorkspace.name.trim() ||
                      (newWorkspace.visibility === "specific_user" && !newWorkspace.specific_user_id)
                    }
                  >
                    {isCreating ? "Creating..." : "Create Workspace"}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {(workspaces?.length || 0) === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-8 md:py-12">
            <FolderOpen className="w-10 h-10 md:w-12 md:h-12 text-muted-foreground mb-4" />
            <h3 className="text-base md:text-lg font-medium mb-2">No workspaces yet</h3>
            <p className="text-sm text-muted-foreground text-center mb-4 px-4">
              {canCreateWorkspace(auth.user)
                ? "Create your first workspace to get started organizing projects."
                : "No workspaces available to you yet. Contact your administrator for access."}
            </p>
            {canCreateWorkspace(auth.user) && (
              <Button onClick={() => setIsCreateOpen(true)} className="mt-2">
                <Plus className="w-4 h-4 mr-2" />
                Create Workspace
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={(workspaces || []).map((w) => w.id)} strategy={verticalListSortingStrategy}>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(workspaces || []).map((workspace) => (
                <SortableWorkspace
                  key={workspace.id}
                  workspace={workspace}
                  onSelectWorkspace={onSelectWorkspace}
                  onEdit={(workspace) => {
                    setEditingWorkspace(workspace)
                    setEditWorkspace({
                      name: workspace.name,
                      description: workspace.description || "",
                      visibility: workspace.visibility || "all",
                      specific_user_id: workspace.specific_user_id || "",
                    })
                  }}
                  onDelete={deleteWorkspace}
                  auth={auth}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}

      <Dialog open={!!editingWorkspace} onOpenChange={(open) => !open && setEditingWorkspace(null)}>
        <DialogContent className="mx-4 max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Workspace</DialogTitle>
            <DialogDescription>Update the workspace name, description, and visibility settings.</DialogDescription>
          </DialogHeader>
          <form onSubmit={updateWorkspace} className="space-y-4">
            <div>
              <Label htmlFor="edit-name">Workspace Name</Label>
              <Input
                id="edit-name"
                value={editWorkspace.name}
                onChange={(e) => setEditWorkspace({ ...editWorkspace, name: e.target.value })}
                placeholder="Enter workspace name"
                required
              />
            </div>
            <div>
              <Label htmlFor="edit-description">Description (Optional)</Label>
              <Textarea
                id="edit-description"
                value={editWorkspace.description}
                onChange={(e) => setEditWorkspace({ ...editWorkspace, description: e.target.value })}
                placeholder="Describe this workspace"
                rows={3}
              />
            </div>
            <div>
              <Label htmlFor="edit-visibility">Visibility</Label>
              <Select
                value={editWorkspace.visibility}
                onValueChange={(value) =>
                  setEditWorkspace({ ...editWorkspace, visibility: value, specific_user_id: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <Users className="w-4 h-4 text-green-500" />
                      <span>All Users</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="admin_only">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-red-500" />
                      <span>Admin Only</span>
                    </div>
                  </SelectItem>
                  <SelectItem value="specific_user">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-yellow-500" />
                      <span>Specific User</span>
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            {editWorkspace.visibility === "specific_user" && (
              <div>
                <Label htmlFor="edit-specific-user">Select User</Label>
                <Select
                  value={editWorkspace.specific_user_id}
                  onValueChange={(value) => setEditWorkspace({ ...editWorkspace, specific_user_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choose a user" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        <div className="flex flex-col items-start">
                          <span>{user.full_name}</span>
                          <span className="text-xs text-muted-foreground">{user.email}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setEditingWorkspace(null)}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  isEditing ||
                  !editWorkspace.name.trim() ||
                  (editWorkspace.visibility === "specific_user" && !editWorkspace.specific_user_id)
                }
              >
                {isEditing ? "Updating..." : "Update Workspace"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
