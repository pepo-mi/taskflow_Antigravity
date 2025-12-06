"use client"

import { useState } from "react"
import { Label, Select, SelectTrigger, SelectValue, SelectContent, SelectItem, Checkbox } from "your-ui-library" // Import necessary UI components

interface CreateUserFormProps {
  onUserCreated: (user: any) => void // Define the props interface
}

export function CreateUserForm({ onUserCreated }: CreateUserFormProps) {
  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    role: "user" as "admin" | "user" | "guest",
    sendPasswordReset: true,
    privileges: {
      can_create_workspaces: false,
      can_create_projects: false,
      can_create_tasks: false,
    },
  })

  const handleUserCreated = () => {
    onUserCreated(formData)
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData((prev) => ({ ...prev, email: e.target.value }))}
          className="input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="full_name">Full Name</Label>
        <input
          id="full_name"
          type="text"
          value={formData.full_name}
          onChange={(e) => setFormData((prev) => ({ ...prev, full_name: e.target.value }))}
          className="input"
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="role">Role</Label>
        <Select
          value={formData.role}
          onValueChange={(value: "admin" | "user" | "guest") => {
            setFormData((prev) => ({
              ...prev,
              role: value,
              privileges:
                value === "admin"
                  ? { can_create_workspaces: true, can_create_projects: true, can_create_tasks: true }
                  : value === "user"
                    ? { can_create_workspaces: false, can_create_projects: true, can_create_tasks: true }
                    : { can_create_workspaces: false, can_create_projects: false, can_create_tasks: false },
            }))
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="user">User</SelectItem>
            <SelectItem value="guest">Guest</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <Label className="text-sm font-medium">User Privileges</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_create_workspaces"
              checked={formData.privileges.can_create_workspaces}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  privileges: { ...prev.privileges, can_create_workspaces: !!checked },
                }))
              }
            />
            <Label htmlFor="can_create_workspaces" className="text-sm">
              Can create workspaces
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_create_projects"
              checked={formData.privileges.can_create_projects}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  privileges: { ...prev.privileges, can_create_projects: !!checked },
                }))
              }
            />
            <Label htmlFor="can_create_projects" className="text-sm">
              Can create projects
            </Label>
          </div>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="can_create_tasks"
              checked={formData.privileges.can_create_tasks}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({
                  ...prev,
                  privileges: { ...prev.privileges, can_create_tasks: !!checked },
                }))
              }
            />
            <Label htmlFor="can_create_tasks" className="text-sm">
              Can create tasks
            </Label>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Customize privileges for this user. Role selection sets defaults, but you can override them.
        </p>
      </div>

      <div className="space-y-2">
        <Checkbox
          id="sendPasswordReset"
          checked={formData.sendPasswordReset}
          onCheckedChange={(checked) => setFormData((prev) => ({ ...prev, sendPasswordReset: !!checked }))}
        />
        <Label htmlFor="sendPasswordReset" className="text-sm">
          Send password reset email
        </Label>
      </div>

      <button onClick={handleUserCreated} className="btn">
        Create User
      </button>
    </div>
  )
}
