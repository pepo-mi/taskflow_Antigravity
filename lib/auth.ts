export interface User {
  id: string
  email: string
  name: string
  role: "admin" | "user" | "guest"
  domain: string
  createdAt: Date
  lastLogin?: Date
}

export interface AuthState {
  user: User | null
  isLoading: boolean
  isAuthenticated: boolean
}

// Check if email belongs to proper.am domain
export function isProperDomainEmail(email: string): boolean {
  return email.endsWith("@proper.am")
}

// Check if user is admin
export function isAdmin(user: User | null): boolean {
  return user?.email === "peno@proper.am"
}

// Check user permissions
export function canCreateWorkspace(user: User | null): boolean {
  return isAdmin(user)
}

export function canCreateProject(user: User | null): boolean {
  return user?.role === "admin" || user?.role === "user"
}

export function canAddUsers(user: User | null): boolean {
  return isAdmin(user)
}

// Mock authentication functions (replace with real auth later)
export async function signIn(email: string, password: string): Promise<User> {
  // Validate proper.am domain
  if (!isProperDomainEmail(email) && email !== "peno@proper.am") {
    throw new Error("Only proper.am domain users can access this application")
  }

  // Mock user creation
  const user: User = {
    id: Math.random().toString(36).substr(2, 9),
    email,
    name: email.split("@")[0],
    role: email === "peno@proper.am" ? "admin" : "user",
    domain: email.split("@")[1],
    createdAt: new Date(),
    lastLogin: new Date(),
  }

  return user
}

export async function signOut(): Promise<void> {
  // Clear auth state
}

export function getCurrentUser(): User | null {
  // Mock - replace with real session management
  if (typeof window !== "undefined") {
    const userData = localStorage.getItem("taskflow_user")
    return userData ? JSON.parse(userData) : null
  }
  return null
}
