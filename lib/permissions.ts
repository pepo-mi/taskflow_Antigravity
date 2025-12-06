export interface UserPrivileges {
  can_create_workspaces: boolean
  can_create_projects: boolean
  can_create_tasks: boolean
}

export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "user" | "guest"
  organization: string
  full_name: string
  privileges?: UserPrivileges
}

export function canCreateWorkspace(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  return user.privileges?.can_create_workspaces || false
}

export function canCreateProject(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  return user.privileges?.can_create_projects || false
}

export function canCreateTask(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  return user.privileges?.can_create_tasks || false
}

export function isAdmin(user: User | null): boolean {
  return user?.role === "admin"
}

export function isGuest(user: User | null): boolean {
  return user?.role === "guest"
}

export function canManageUsers(user: User | null): boolean {
  return isAdmin(user)
}

export function canEditProject(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  // Typically, users who can create projects can also edit them, 
  // or checks should be done against project ownership (which needs the project object).
  // For now, retaining the existing logic but being mindful of it.
  return user.privileges?.can_create_projects || false
}

export function canDeleteProject(user: User | null): boolean {
  // STRICT: Only admins can delete projects to prevent data loss.
  if (!user) return false
  return user.role === "admin"
}

export function canEditTask(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  return user.privileges?.can_create_tasks || false
}

export function canDeleteTask(user: User | null): boolean {
  if (!user) return false
  // Assuming admins and maybe users who can create tasks can delete them?
  // User asked: "measure nothing gets deleted from supabase... ensure security"
  // Safe bet: strict deletion.
  return user.role === "admin"
}

export function canEditWorkspace(user: User | null): boolean {
  if (!user) return false
  if (user.role === "admin") return true
  return user.privileges?.can_create_workspaces || false
}

export function canDeleteWorkspace(user: User | null): boolean {
  if (!user) return false
  return user.role === "admin"
}
