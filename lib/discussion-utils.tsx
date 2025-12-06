import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Format discussion content by converting mentions to styled badges
 * Handles both @[Name](id) format and @everyone mentions
 */
export function formatContent(content: string): string {
  if (!content) return ""

  let formatted = content

  // Render @[Name](id) as a styled badge showing only the name
  formatted = formatted.replace(
    /@\[(.+?)\]\((.+?)\)/g,
    (match, name, id) => {
      return `<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium 
        bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">@${name}</span>`
    }
  )

  // Replace @everyone mentions with styled badges
  formatted = formatted.replace(
    /@everyone/g,
    '<span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">@everyone</span>',
  )

  return formatted
}

/**
 * Extract user IDs from mentions in content
 * Returns array of user IDs mentioned in the format @[Name](id)
 * Returns special "everyone" string for @everyone mentions
 */
export function extractMentions(content: string): string[] {
  if (!content) return []

  const mentions: string[] = []
  const mentionRegex = /@\[[^\]]+\]\(([0-9a-fA-F-]{36})\)/g
  let match
  while ((match = mentionRegex.exec(content)) !== null) {
    const userId = match[1]
    if (userId && !mentions.includes(userId)) {
      mentions.push(userId)
    }
  }

  if (/@everyone/.test(content)) {
    mentions.push("everyone")
  }

  return mentions
}

/**
 * Get initials from a name
 */
export function getInitials(name: string): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

/**
 * Convert raw @Name mentions into @[Name](uuid) form
 */
export async function convertMentionsToIds(content: string, supabase: SupabaseClient): Promise<string> {
  if (!content) return ""

  let processedContent = content

  // Match raw @Name (letters/numbers/underscore)
  const tokenRegex = /@([\p{L}\p{N}_]+)/gu

  const tokens = new Set<string>()
  let m
  while ((m = tokenRegex.exec(content)) !== null) {
    const token = m[0]    // e.g. "@Peno"
    const nameOnly = m[1] // e.g. "Peno"

    if (nameOnly.toLowerCase() === "everyone") continue
    if (content.includes(`@[${nameOnly}](`)) continue

    tokens.add(token)
  }

  for (const mention of tokens) {
    const name = mention.slice(1) // remove @

    let user: { id: string; full_name: string } | undefined

    // Exact (case-insensitive)
    const { data: exactUsers, error: exactError } = await supabase
      .from("users")
      .select("id, full_name")
      .ilike("full_name", name)
      .limit(1)

    if (exactError) {
      console.error("Error looking up user:", exactError)
      continue
    }
    if (exactUsers && exactUsers.length > 0) {
      user = exactUsers[0]
    }

    // Fuzzy fallback
    if (!user) {
      const { data: fuzzyUsers, error: fuzzyError } = await supabase
        .from("users")
        .select("id, full_name")
        .ilike("full_name", `%${name}%`)
        .limit(1)

      if (fuzzyError) {
        console.error("Error looking up user:", fuzzyError)
        continue
      }
      if (fuzzyUsers && fuzzyUsers.length > 0) {
        user = fuzzyUsers[0]
      }
    }

    if (user) {
      processedContent = processedContent.replace(
        new RegExp(`\\${mention}(?=\\s|$|[.,!?;:])`, "g"),
        `@[${user.full_name}](${user.id})`
      )
    }
  }

  return processedContent
}

/**
 * Send notifications to mentioned users
 */
export async function sendMentionNotifications(
  mentionedUserIds: string[],
  postId: string,
  authorId: string,
  postType: "post" | "reply",
  projectId: string,
  authorName: string,
  supabase: SupabaseClient,
): Promise<void> {
  if (!mentionedUserIds || mentionedUserIds.length === 0) return

  if (!projectId || projectId === "undefined") {
    console.error("Error: Invalid projectId:", projectId)
    return
  }

  try {
    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("name")
      .eq("id", projectId)
      .single()

    if (projectError) {
      console.error("Error fetching project:", projectError)
      return
    }

    const projectName = project?.name || "a project"

    // Handle @everyone
    if (mentionedUserIds.includes("everyone")) {
      const { data: tasks, error: tasksError } = await supabase
        .from("tasks")
        .select("assigned_to")
        .eq("project_id", projectId)
        .not("assigned_to", "is", null)

      if (tasksError) {
        console.error("Error fetching project tasks:", tasksError)
      } else if (tasks && tasks.length > 0) {
        const allUserIds = [...new Set(tasks.map((t) => t.assigned_to))].filter((id) => id !== authorId)

        const notifications = allUserIds.map((userId) => ({
          user_id: userId,
          type: "mention",
          title: `${authorName} mentioned everyone in ${projectName}`,
          message: `You were mentioned in a ${postType} discussion`,
          related_id: postId,
          related_type: postType,
          read: false,
        }))

        const { error: notificationError } = await supabase.from("notifications").insert(notifications)
        if (notificationError) console.error("Error creating @everyone notifications:", notificationError)
      }

      mentionedUserIds = mentionedUserIds.filter((id) => id !== "everyone")
    }

    // Filter out self
    const usersToNotify = mentionedUserIds.filter((userId) => userId !== authorId)
    if (usersToNotify.length === 0) return

    const notifications = usersToNotify.map((userId) => ({
      user_id: userId,
      type: "mention",
      title: `${authorName} mentioned you in ${projectName}`,
      message: `You were mentioned in a ${postType} discussion`,
      related_id: postId,
      related_type: postType,
      read: false,
    }))

    const { error: notificationError } = await supabase.from("notifications").insert(notifications)
    if (notificationError) console.error("Error creating notifications:", notificationError)
  } catch (error) {
    console.error("Error in sendMentionNotifications:", error)
  }
}
