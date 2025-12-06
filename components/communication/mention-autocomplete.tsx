"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Users } from "lucide-react"

interface User {
  id: string
  full_name: string
  email: string
  role: string
}

interface MentionAutocompleteProps {
  onSelect: (user: User) => void
  searchQuery: string
  position: { top: number; left: number }
  onClose: () => void
  highlightedIndex: number
  setSelectHandler: (fn: (index: number) => void) => void
}

export function MentionAutocomplete({
  onSelect,
  searchQuery,
  position,
  onClose,
  highlightedIndex,
  setSelectHandler,
}: MentionAutocompleteProps) {
  const [users, setUsers] = useState<User[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const containerRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  useEffect(() => {
    fetchUsers()
  }, [])

  const fetchUsers = async () => {
    try {
      setIsLoading(true)
      const [regularUsersResult, guestUsersResult] = await Promise.all([
        supabase.from("users").select("id, full_name, email, role").order("full_name"),
        supabase.from("guest_users").select("id, full_name, email").order("full_name"),
      ])

      if (regularUsersResult.error) {
        console.error("Error fetching regular users:", regularUsersResult.error)
      }
      if (guestUsersResult.error) {
        console.error("Error fetching guest users:", guestUsersResult.error)
      }

      const allUsers = [
        ...(regularUsersResult.data || []),
        ...(guestUsersResult.data || []).map((guest) => ({
          ...guest,
          role: "guest",
        })),
      ]

      allUsers.sort((a, b) => a.full_name.localeCompare(b.full_name))
      setUsers(allUsers)
    } catch (error) {
      console.error("Error fetching users:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const everyoneOption: User = {
    id: "everyone",
    full_name: "everyone",
    email: "Notify all project members",
    role: "special",
  }

  const filteredUsers = users.filter((user) => {
    const query = searchQuery.toLowerCase()
    const nameMatch = user.full_name.toLowerCase().includes(query)
    const emailMatch = user.email.toLowerCase().includes(query)
    const startsWithMatch = user.full_name.toLowerCase().startsWith(query)
    return nameMatch || emailMatch || startsWithMatch
  })

  const filteredItems = [
    ...(everyoneOption.full_name.toLowerCase().includes(searchQuery.toLowerCase())
      ? [everyoneOption]
      : []),
    ...filteredUsers,
  ]

  // ✅ Register handler after filteredItems is defined
  useEffect(() => {
    setSelectHandler((index: number) => {
      if (filteredItems[index]) {
        onSelect(filteredItems[index])
      }
    })
  }, [filteredItems, onSelect, setSelectHandler])

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2)

  if (isLoading) {
    return (
      <Card
        ref={containerRef}
        className="absolute z-50 w-64 max-h-64 overflow-y-auto shadow-lg"
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-4 text-sm text-muted-foreground">Loading users...</div>
      </Card>
    )
  }

  if (filteredItems.length === 0) {
    return (
      <Card
        ref={containerRef}
        className="absolute z-50 w-64 max-h-64 overflow-y-auto shadow-lg"
        style={{ top: position.top, left: position.left }}
      >
        <div className="p-4 text-sm text-muted-foreground">
          No users found
          {searchQuery && <div className="text-xs mt-1">Searching for: "{searchQuery}"</div>}
        </div>
      </Card>
    )
  }

  return (
    <Card
      ref={containerRef}
      className="fixed z-50 w-64 max-h-64 overflow-y-auto shadow-lg"
      style={{ top: position.top, left: position.left }}
    >
      <div className="py-1">
        {filteredItems.map((user, index) => (
          <div
            key={user.id}
            className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
              index === highlightedIndex ? "bg-muted" : "hover:bg-muted/50"
            }`}
            onClick={() => onSelect(user)}
          >
            {user.id === "everyone" ? (
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Users className="w-4 h-4 text-primary" />
              </div>
            ) : (
              <Avatar className="w-8 h-8">
                <AvatarFallback className="text-xs">{getInitials(user.full_name)}</AvatarFallback>
              </Avatar>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">
                {user.id === "everyone" ? "@everyone" : user.full_name}
              </div>
              <div className="text-xs text-muted-foreground truncate">
                {user.id === "everyone"
                  ? user.email
                  : `${user.email} • ${user.role}`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  )
}
