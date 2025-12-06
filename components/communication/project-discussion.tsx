"use client"

import { useState, useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { MessageSquare, Send, Edit2, Trash2, MoreHorizontal, Upload, Plus, X, Download } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip"
import { FileUpload } from "./file-upload"
import { MentionTextarea } from "./mention-textarea"
import React from "react"
import {
  formatContent,
  extractMentions,
  getInitials,
  convertMentionsToIds,
  sendMentionNotifications,
} from "@/lib/discussion-utils"

interface Post {
  id: string
  content: string
  created_at: string
  updated_at: string
  author_id: string
  parent_id: string | null
  author: {
    full_name: string
    email: string
  }
  replies?: Post[]
  attachments?: FileAttachment[]
  reactions?: Reaction[]
}

interface Reaction {
  id: string
  post_id: string
  user_id: string
  emoji: string
  created_at: string
  user: {
    full_name: string
  }
}

interface FileAttachment {
  id: string
  filename: string
  file_url: string
  file_type: string
  file_size: number
  uploaded_by: string
}

interface Project {
  id: string
  name: string
}

interface ProjectDiscussionProps {
  project: Project
}

interface UploadedFile {
  url: string
  filename: string
}

export function ProjectDiscussion({ project }: ProjectDiscussionProps) {
  const [posts, setPosts] = useState<Post[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [newPost, setNewPost] = useState("")
  const [isPosting, setIsPosting] = useState(false)
  const [isNewPostExpanded, setIsNewPostExpanded] = useState(false)
  const [editingPost, setEditingPost] = useState<string | null>(null)
  const [editContent, setEditContent] = useState("")
  const [editUploadedFiles, setEditUploadedFiles] = useState<Array<{ url: string; filename: string }>>([])
  const [editExistingAttachments, setEditExistingAttachments] = useState<FileAttachment[]>([])
  const [isEditFileUploadOpen, setIsEditFileUploadOpen] = useState(false)
  const [imageModalOpen, setImageModalOpen] = useState(false)
  const [selectedImage, setSelectedImage] = useState<{ url: string; alt: string } | null>(null)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [allImages, setAllImages] = useState<{ url: string; alt: string }[]>([])
  const [uploadedFiles, setUploadedFiles] = useState<Array<{ url: string; filename: string }>>([])
  const [isFileUploadOpen, setIsFileUploadOpen] = useState(false)
  const { auth } = useAuth()
  const supabase = createClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const [replyContents, setReplyContents] = useState<Record<string, string>>({})
  const [replyUploadedFiles, setReplyUploadedFiles] = useState<Record<string, UploadedFile[]>>({})
  const [isReplyFileUploadOpen, setIsReplyFileUploadOpen] = useState<Record<string, boolean>>({})

  useEffect(() => {
    fetchPosts()
  }, [project.id])

  useEffect(() => {
    const handleNavigateToDiscussion = (event: CustomEvent) => {
      const { projectId, postId, forceRefresh } = event.detail

      // If this is the current project and forceRefresh is true, reload the data
      if (projectId === project.id && forceRefresh) {
        fetchPosts()

        // Scroll to the specific post after a short delay to allow data to load
        setTimeout(() => {
          const postElement = document.querySelector(`[data-post-id="${postId}"]`)
          if (postElement) {
            postElement.scrollIntoView({ behavior: "smooth", block: "center" })
            postElement.classList.add("ring-2", "ring-blue-500", "ring-offset-2")
            setTimeout(() => {
              postElement.classList.remove("ring-2", "ring-blue-500", "ring-offset-2")
            }, 2000)
          }
        }, 500)
      }
    }

    window.addEventListener("navigate-to-discussion", handleNavigateToDiscussion as EventListener)

    return () => {
      window.removeEventListener("navigate-to-discussion", handleNavigateToDiscussion as EventListener)
    }
  }, [project.id])

  const fetchPosts = async () => {
    try {
      setIsLoading(true)
      const { data, error } = await supabase
        .from("posts")
        .select(`
          *,
          author:users!posts_author_id_fkey(full_name, email),
          attachments:file_attachments(*),
          reactions:reactions(
            id,
            emoji,
            user_id,
            created_at,
            user:users!reactions_user_id_fkey(full_name)
          )
        `)
        .eq("project_id", project.id)
        .order("created_at", { ascending: true })

      if (error) throw error

      // Group posts by parent_id to create threaded structure
      const postsMap = new Map<string, Post>()
      const rootPosts: Post[] = []

      data?.forEach((post) => {
        const postWithReplies: Post = {
          ...post,
          replies: [],
          reactions: post.reactions || [],
        }
        postsMap.set(post.id, postWithReplies)

        if (!post.parent_id) {
          rootPosts.push(postWithReplies)
        }
      })

      // Add replies to their parent posts
      data?.forEach((post) => {
        if (post.parent_id) {
          const parent = postsMap.get(post.parent_id)
          if (parent) {
            parent.replies = parent.replies || []
            parent.replies.push(postsMap.get(post.id)!)
          }
        }
      })

      setPosts(rootPosts)
    } catch (error) {
      console.error("Error fetching posts:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const createPost = async (content: string, parentId?: string, files: UploadedFile[] = []) => {
    if (!auth.user || (!content.trim() && files.length === 0)) return

    try {
      setIsPosting(true)

      const processedContent = await convertMentionsToIds(content, supabase)

      const { data: postData, error: postError } = await supabase
        .from("posts")
        .insert({
          content: processedContent.trim(),
          author_id: auth.user.id,
          project_id: project.id,
          parent_id: parentId || null,
        })
        .select()
        .single()

      if (postError) throw postError

      // Handle file attachments
      if (files.length > 0) {
        const attachments = files.map((file) => ({
          post_id: postData.id,
          filename: file.filename,
          file_url: file.url,
          file_type: file.filename.split(".").pop()?.toLowerCase() || "unknown",
          file_size: 0,
          uploaded_by: auth.user.id,
        }))

        const { error: attachmentError } = await supabase.from("file_attachments").insert(attachments)

        if (attachmentError) throw attachmentError
      }

      const mentions = extractMentions(processedContent)
      if (mentions.length > 0) {
        await sendMentionNotifications(
          mentions,
          postData.id,
          auth.user.id,
          parentId ? "reply" : "post",
          project.id,
          auth.user.full_name || auth.user.email,
          supabase,
        )
      }

      // Clear form
      if (!parentId) {
        setNewPost("")
        setUploadedFiles([])
        setIsNewPostExpanded(false)
      }

      // Refresh posts
      await fetchPosts()
    } catch (error) {
      console.error("Error creating post:", error)
    } finally {
      setIsPosting(false)
    }
  }

  const updatePost = async (postId: string, content: string) => {
    if (!content.trim() && editUploadedFiles.length === 0 && editExistingAttachments.length === 0) return

    try {
      const currentPost =
        posts.find((p) => p.id === postId) || posts.flatMap((p) => p.replies || []).find((r) => r.id === postId)
      const originalContent = currentPost?.content || ""

      const processedContent = await convertMentionsToIds(content, supabase)

      const { error } = await supabase.from("posts").update({ content: processedContent.trim() }).eq("id", postId)

      if (error) throw error

      if (editUploadedFiles.length > 0) {
        const attachments = editUploadedFiles
          .filter((file) => file && file.filename && file.url && typeof file.filename === "string")
          .map((file) => {
            let fileType = "unknown"
            try {
              if (file.filename && typeof file.filename === "string") {
                const parts = file.filename.split(".")
                if (parts.length > 1) {
                  fileType = parts.pop()?.toLowerCase() || "unknown"
                }
              }
            } catch (e) {
              console.error("Error extracting file type:", e)
            }

            return {
              post_id: postId,
              filename: file.filename,
              file_url: file.url,
              file_type: fileType,
              file_size: 0,
              uploaded_by: auth.user?.id,
            }
          })

        if (attachments.length > 0) {
          const { error: attachmentError } = await supabase.from("file_attachments").insert(attachments)

          if (attachmentError) {
            console.error("Error saving new attachments:", attachmentError)
          }
        }
      }

      const originalAttachments = currentPost?.attachments || []
      const deletedAttachments = originalAttachments.filter(
        (original) => !editExistingAttachments.find((existing) => existing.id === original.id),
      )

      if (deletedAttachments.length > 0) {
        const { error: deleteError } = await supabase
          .from("file_attachments")
          .delete()
          .in(
            "id",
            deletedAttachments.map((a) => a.id),
          )

        if (deleteError) {
          console.error("Error deleting attachments:", deleteError)
        }
      }

      const originalMentions = extractMentions(originalContent)
      const newMentions = extractMentions(processedContent)
      const addedMentions = newMentions.filter((userId) => !originalMentions.includes(userId))

      if (addedMentions.length > 0 && auth.user) {
        await sendMentionNotifications(
          addedMentions,
          postId,
          auth.user.id,
          currentPost?.parent_id ? "reply" : "post",
          project.id,
          auth.user.full_name || auth.user.email,
          supabase,
        )
      }

      await fetchPosts()

      setEditingPost(null)
      setEditContent("")
      setEditUploadedFiles([])
      setEditExistingAttachments([])
    } catch (error) {
      console.error("Error updating post:", error)
    }
  }

  const deletePost = async (postId: string) => {
    try {
      const { error } = await supabase.from("posts").delete().eq("id", postId)

      if (error) throw error

      // Remove the post from state
      setPosts((prevPosts) =>
        prevPosts
          .filter((post) => post.id !== postId)
          .map((post) => ({
            ...post,
            replies: post.replies?.filter((reply) => reply.id !== postId) || [],
          })),
      )
    } catch (error) {
      console.error("Error deleting post:", error)
    }
  }

  // Moved to utils: const formatContent = (content: string) => { ... }

  // Moved to utils: const getInitials = (name: string) => { ... }

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imageModalOpen || allImages.length <= 1) return

      if (e.key === "ArrowLeft") {
        e.preventDefault()
        setCurrentImageIndex((prev) => (prev - 1 + allImages.length) % allImages.length)
      } else if (e.key === "ArrowRight") {
        e.preventDefault()
        setCurrentImageIndex((prev) => (prev + 1) % allImages.length)
      } else if (e.key === "Escape") {
        e.preventDefault()
        setImageModalOpen(false)
      }
    }

    if (imageModalOpen) {
      document.addEventListener("keydown", handleKeyDown)
      return () => document.removeEventListener("keydown", handleKeyDown)
    }
  }, [imageModalOpen, allImages.length])

  React.useEffect(() => {
    if (allImages.length > 0 && currentImageIndex < allImages.length) {
      setSelectedImage(allImages[currentImageIndex])
    }
  }, [currentImageIndex, allImages])

  const openImageModalWithContext = (clickedUrl: string, contextImages: { url: string; alt: string }[]) => {
    setAllImages(contextImages)
    const clickedIndex = contextImages.findIndex((img) => img.url === clickedUrl)
    setCurrentImageIndex(clickedIndex >= 0 ? clickedIndex : 0)
    setSelectedImage(contextImages[clickedIndex >= 0 ? clickedIndex : 0])
    setImageModalOpen(true)
  }

  const getImagesFromAttachments = (attachments?: FileAttachment[]): { url: string; alt: string }[] => {
    if (!attachments) return []
    return attachments
      .filter((file) => file.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
      .map((file) => ({ url: file.file_url, alt: file.filename }))
  }

  const getImagesFromUploadedFiles = (files: UploadedFile[]): { url: string; alt: string }[] => {
    return files
      .filter((file) => file.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i))
      .map((file) => ({ url: file.url, alt: file.filename }))
  }

  const discussions = posts

  React.useEffect(() => {
    ;(window as any).openImageModal = (url: string, alt: string) => {
      const images: { url: string; alt: string }[] = []

      // Collect images from all discussion posts
      discussions.forEach((discussion) => {
        if (discussion.attachments) {
          discussion.attachments.forEach((file) => {
            if (file.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
              images.push({ url: file.file_url, alt: file.filename })
            }
          })
        }
      })

      // Collect images from uploaded files
      uploadedFiles.forEach((file) => {
        if (file.filename?.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)) {
          images.push({ url: file.url, alt: file.filename })
        }
      })

      setAllImages(images)
      const clickedIndex = images.findIndex((img) => img.url === url)
      setCurrentImageIndex(clickedIndex >= 0 ? clickedIndex : 0)
      setSelectedImage({ url, alt })
      setImageModalOpen(true)
    }
    return () => {
      delete (window as any).openImageModal
    }
  }, [discussions, uploadedFiles])

  const handleFileUploaded = (file: { url: string; filename: string }) => {
    setUploadedFiles((prevFiles) => [...prevFiles, file])
    setIsFileUploadOpen(false)
  }

  const handleEditFileUploaded = (file: { url: string; filename: string }) => {
    setEditUploadedFiles((prevFiles) => [...prevFiles, file])
  }

  const handleReplyFileUploaded = (postId: string, file: UploadedFile) => {
    setReplyUploadedFiles((prev) => ({
      ...prev,
      [postId]: [...(prev[postId] || []), file],
    }))
    // Dialog close is handled in the FileUpload onFileUploaded callback
  }

  const removeExistingAttachment = (attachmentId: string) => {
    setEditExistingAttachments((prevAttachments) =>
      prevAttachments.filter((attachment) => attachment.id !== attachmentId),
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-lg text-muted-foreground">Loading discussion...</div>
      </div>
    )
  }

  const toggleReaction = async (postId: string, emoji: string) => {
    if (!auth.user) return

    try {
      const existingReaction = posts
        .flatMap((post) => [post, ...(post.replies || [])])
        .find((post) => post.id === postId)
        ?.reactions?.find((r) => r.user_id === auth.user.id && r.emoji === emoji)

      // Update UI optimistically
      setPosts((prevPosts) =>
        prevPosts.map((post) => {
          if (post.id === postId) {
            return {
              ...post,
              reactions: existingReaction
                ? post.reactions?.filter((r) => r.id !== existingReaction.id) || []
                : [
                    ...(post.reactions || []),
                    {
                      id: `temp-${Date.now()}`,
                      post_id: postId,
                      user_id: auth.user.id,
                      emoji: emoji,
                      created_at: new Date().toISOString(),
                      user: { full_name: auth.user.full_name || auth.user.email },
                    },
                  ],
            }
          }
          if (post.replies) {
            return {
              ...post,
              replies: post.replies.map((reply) => {
                if (reply.id === postId) {
                  return {
                    ...reply,
                    reactions: existingReaction
                      ? reply.reactions?.filter((r) => r.id !== existingReaction.id) || []
                      : [
                          ...(reply.reactions || []),
                          {
                            id: `temp-${Date.now()}`,
                            post_id: postId,
                            user_id: auth.user.id,
                            emoji: emoji,
                            created_at: new Date().toISOString(),
                            user: { full_name: auth.user.full_name || auth.user.email },
                          },
                        ],
                  }
                }
                return reply
              }),
            }
          }
          return post
        }),
      )

      if (existingReaction) {
        // Remove reaction
        const { error } = await supabase.from("reactions").delete().eq("id", existingReaction.id)
        if (error) throw error
      } else {
        // Add reaction
        const { error } = await supabase.from("reactions").insert({
          post_id: postId,
          user_id: auth.user.id,
          emoji: emoji,
        })
        if (error) throw error
      }

      // Refresh posts to sync with database
      await fetchPosts()
    } catch (error) {
      console.error("Error toggling reaction:", error)
      // Revert optimistic update on error
      await fetchPosts()
    }
  }

  const getReactionCount = (post: Post, emoji: string) => {
    return post.reactions?.filter((r) => r.emoji === emoji).length || 0
  }

  const hasUserReacted = (post: Post, emoji: string) => {
    return post.reactions?.some((r) => r.user_id === auth.user?.id && r.emoji === emoji) || false
  }

  const getReactionUsers = (post: Post, emoji: string): string[] => {
    return post.reactions?.filter((r) => r.emoji === emoji).map((r) => r.user.full_name) || []
  }

  const updateReplyContent = (postId: string, content: string) => {
    setReplyContents((prev) => ({ ...prev, [postId]: content }))
  }

  const getReplyContent = (postId: string) => {
    return replyContents[postId] || ""
  }

  const getReplyFiles = (postId: string) => {
    return replyUploadedFiles[postId] || []
  }

  const updateReplyFiles = (postId: string, files: UploadedFile[]) => {
    setReplyUploadedFiles((prev) => ({ ...prev, [postId]: files }))
  }

  const clearReply = (postId: string) => {
    setReplyContents((prev) => ({ ...prev, [postId]: "" }))
    setReplyUploadedFiles((prev) => ({ ...prev, [postId]: [] }))
  }

  const createReply = async (postId: string) => {
    const content = getReplyContent(postId)
    const files = getReplyFiles(postId)

    if (!content.trim() && files.length === 0) return

    await createPost(content, postId, files)
    clearReply(postId)
  }

  const removeUploadedFile = (setUploadedFiles: any) => (index: number) => {
    setUploadedFiles((prev: any) => prev.filter((_: any, i: number) => i !== index))
  }

  const downloadAllFiles = async (attachments: FileAttachment[]) => {
    if (!attachments || attachments.length === 0) return

    try {
      const JSZip = (await import("jszip")).default
      const zip = new JSZip()

      // Add each file to the zip
      for (const attachment of attachments) {
        try {
          const response = await fetch(attachment.file_url)
          const blob = await response.blob()
          zip.file(attachment.filename, blob)
        } catch (error) {
          console.error(`Error downloading file ${attachment.filename}:`, error)
          // Continue with other files even if one fails
        }
      }

      // Generate the zip file
      const zipBlob = await zip.generateAsync({ type: "blob" })

      // Create download link
      const link = document.createElement("a")
      link.href = URL.createObjectURL(zipBlob)
      link.download = `discussion_files_${Date.now()}.zip`
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

  // Moved to utils: const convertMentionsToIds = async (content: string): Promise<string> => { ... }

  // Moved to utils: const extractMentions = (content: string): string[] => { ... }

  // Moved to utils: const sendMentionNotifications = async ( ... ) => { ... }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
        <h3 className="text-base sm:text-lg pl-3 sm:pl-4 border-l-2 sm:border-l-4 border-slate-300">
          Project Discussion
        </h3>
      </div>

      {!isNewPostExpanded ? (
        <Card className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setIsNewPostExpanded(true)}>
          <CardContent className="py-3 sm:py-2">
            <div className="flex items-center gap-2 sm:gap-3 text-muted-foreground">
              <Avatar className="w-9 h-9 sm:w-8 sm:h-8">
                <AvatarFallback className="text-xs">
                  {auth.user ? getInitials(auth.user.full_name || auth.user.email) : "?"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 flex items-center gap-2">
                <Plus className="w-4 h-4" />
                <span className="text-sm font-medium">Start a new discussion...</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader
            className="pb-3 cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg"
            onClick={() => {
              setIsNewPostExpanded(false)
              setNewPost("")
              setUploadedFiles([])
            }}
          >
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm sm:text-base">Start a new discussion</CardTitle>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0"
                onClick={(e) => {
                  e.stopPropagation()
                  setIsNewPostExpanded(false)
                  setNewPost("")
                  setUploadedFiles([])
                }}
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3 sm:space-y-4" onClick={(e) => e.stopPropagation()}>
            <MentionTextarea
              className="border-slate-300 min-h-32 sm:min-h-28 text-base"
              value={newPost}
              onChange={setNewPost}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  if (!isPosting && (newPost.trim() || uploadedFiles.length > 0)) {
                    createPost(newPost, undefined, uploadedFiles)
                  }
                }
              }}
              placeholder="Share updates, ask questions, or start a discussion... Type @ to mention someone (Press Enter to post, Shift+Enter for new line)"
              rows={3}
              autoFocus
            />

            {uploadedFiles.length > 0 && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">Attached Files:</Label>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 sm:gap-3">
                  {uploadedFiles.map((file, index) => {
                    if (!file || !file.filename || !file.url) return null

                    const isImage = file.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                    if (isImage) {
                      return (
                        <div key={index} className="relative group">
                          <div
                            className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => {
                              const contextImages = getImagesFromUploadedFiles(uploadedFiles)
                              openImageModalWithContext(file.url, contextImages)
                            }}
                          >
                            <img
                              src={file.url || "/placeholder.svg"}
                              alt={file.filename}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          </div>
                          <div className="absolute top-1 right-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="destructive"
                              size="sm"
                              className="h-7 w-7 sm:h-6 sm:w-6 p-0 text-sm"
                              onClick={(e) => {
                                e.stopPropagation()
                                removeUploadedFile(setUploadedFiles)(index)
                              }}
                            >
                              ×
                            </Button>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 truncate" title={file.filename}>
                            {file.filename}
                          </p>
                        </div>
                      )
                    } else {
                      return (
                        <div key={index} className="flex items-center gap-2 p-2 sm:p-3 bg-muted rounded-lg">
                          <span className="text-sm">📎</span>
                          <a
                            href={file.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs sm:text-sm text-primary hover:underline flex-1 truncate"
                            title={file.filename}
                          >
                            {file.filename}
                          </a>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                            onClick={() => removeUploadedFile(setUploadedFiles)(index)}
                          >
                            ×
                          </Button>
                        </div>
                      )
                    }
                  })}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2 sm:gap-3">
              <Dialog open={isFileUploadOpen} onOpenChange={setIsFileUploadOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm" className="text-foreground bg-transparent w-full sm:w-auto">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload File
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-[95vw] sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>Upload File</DialogTitle>
                    <DialogDescription>
                      Upload files to share with your team in this project discussion.
                    </DialogDescription>
                  </DialogHeader>
                  <FileUpload onFileUploaded={handleFileUploaded} className="mt-4" />
                </DialogContent>
              </Dialog>
              <Button
                onClick={() => createPost(newPost, undefined, uploadedFiles)}
                disabled={isPosting || (!newPost.trim() && uploadedFiles.length === 0)}
                className="w-full sm:w-auto"
              >
                <Send className="w-4 h-4 mr-2" />
                {isPosting ? "Posting..." : "Post"}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Posts */}
      <div className="space-y-4 sm:space-y-6">
        {posts.map((post) => (
          <div key={post.id} className="space-y-3 sm:space-y-4" data-post-id={post.id}>
            <div className="flex gap-2 sm:gap-3">
              <Avatar className="w-9 h-9 sm:w-8 sm:h-8 flex-shrink-0">
                <AvatarFallback className="text-background bg-foreground text-xs">
                  {getInitials(post.author.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 space-y-2 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                    <span className="font-medium text-sm text-foreground truncate">{post.author.full_name}</span>
                    <span className="text-xs text-muted-foreground">{new Date(post.created_at).toLocaleString()}</span>
                  </div>
                  {auth.user?.id === post.author_id && (
                    <DropdownMenu>
                      <DropdownMenuTrigger className="text-black flex-shrink-0" asChild>
                        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            setEditingPost(post.id)
                            setEditContent(post.content)
                            setEditExistingAttachments(post.attachments || [])
                            setEditUploadedFiles([])
                          }}
                        >
                          <Edit2 className="w-4 h-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => deletePost(post.id)} className="text-red-600">
                          <Trash2 className="w-4 h-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>

                {editingPost === post.id ? (
                  <div className="space-y-4">
                    <MentionTextarea value={editContent} onChange={setEditContent} rows={3} />

                    {editExistingAttachments.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">Existing Files:</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {editExistingAttachments.map((attachment) => {
                            const isImage = attachment.filename?.toLowerCase()?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                            if (isImage) {
                              return (
                                <div key={attachment.id} className="relative group">
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity">
                                    <img
                                      src={attachment.file_url || "/placeholder.svg"}
                                      alt={attachment.filename}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onClick={() => {
                                        setSelectedImage({ url: attachment.file_url, alt: attachment.filename })
                                        setImageModalOpen(true)
                                      }}
                                    />
                                  </div>
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-xs"
                                      onClick={() => removeExistingAttachment(attachment.id)}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                  <p
                                    className="text-xs text-muted-foreground mt-1 truncate"
                                    title={attachment.filename}
                                  >
                                    {attachment.filename}
                                  </p>
                                </div>
                              )
                            } else {
                              return (
                                <div key={attachment.id} className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                                  <span className="text-xs">📎</span>
                                  <a
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex-1 truncate"
                                    title={attachment.filename}
                                  >
                                    {attachment.filename}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeExistingAttachment(attachment.id)}
                                  >
                                    ×
                                  </Button>
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    )}

                    {editUploadedFiles.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">New Files:</Label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                          {editUploadedFiles.map((file, index) => {
                            const isImage = file.filename?.toLowerCase()?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                            if (isImage) {
                              return (
                                <div key={index} className="relative group">
                                  <div className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity">
                                    <img
                                      src={file.url || "/placeholder.svg"}
                                      alt={file.filename}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                      onClick={() => {
                                        setSelectedImage({ url: file.url, alt: file.filename })
                                        setImageModalOpen(true)
                                      }}
                                    />
                                  </div>
                                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      className="h-5 w-5 p-0 text-xs"
                                      onClick={() => removeUploadedFile(setEditUploadedFiles)(index)}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-1 truncate" title={file.filename}>
                                    {file.filename}
                                  </p>
                                </div>
                              )
                            } else {
                              return (
                                <div key={index} className="flex items-center gap-1 p-2 bg-muted rounded-lg">
                                  <span className="text-xs">📎</span>
                                  <a
                                    href={file.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-primary hover:underline flex-1 truncate"
                                    title={file.filename}
                                  >
                                    {file.filename}
                                  </a>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-3 w-3 p-0 text-muted-foreground hover:text-destructive"
                                    onClick={() => removeUploadedFile(setEditUploadedFiles)(index)}
                                  >
                                    ×
                                  </Button>
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2">
                      <Dialog open={isEditFileUploadOpen} onOpenChange={setIsEditFileUploadOpen}>
                        <DialogTrigger asChild>
                          <Button variant="outline" size="sm" className="text-foreground bg-transparent">
                            <Upload className="w-4 h-4 mr-2" />
                            Upload File
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Upload File</DialogTitle>
                            <DialogDescription>Upload additional files to attach to this post.</DialogDescription>
                          </DialogHeader>
                          <FileUpload onFileUploaded={handleEditFileUploaded} className="mt-4" />
                        </DialogContent>
                      </Dialog>
                    </div>

                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => updatePost(post.id, editContent)}>
                        Save
                      </Button>
                      <Button
                        className="text-foreground bg-transparent"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setEditingPost(null)
                          setEditContent("")
                          setEditUploadedFiles([])
                          setEditExistingAttachments([])
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div
                      className="text-foreground"
                      dangerouslySetInnerHTML={{ __html: formatContent(post.content) }}
                    />

                    {post.attachments && post.attachments.length > 0 && (
                      <div className="space-y-2">
                        {post.attachments.length > 1 && (
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm text-muted-foreground">
                              {post.attachments.length} files attached
                            </span>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => downloadAllFiles(post.attachments || [])}
                              className="h-8 text-xs md:text-sm text-black"
                            >
                              <Download className="w-3 h-3 mr-1 md:mr-2" />
                              <span className="hidden sm:inline">Download All</span>
                              <span className="sm:hidden">All</span>
                            </Button>
                          </div>
                        )}
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
                          {post.attachments.map((attachment) => {
                            const isImage = attachment.filename?.toLowerCase()?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                            if (isImage) {
                              return (
                                <div key={attachment.id} className="relative group">
                                  <div
                                    className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity"
                                    onClick={() => {
                                      const contextImages = getImagesFromAttachments(post.attachments)
                                      openImageModalWithContext(attachment.file_url, contextImages)
                                    }}
                                  >
                                    <img
                                      src={attachment.file_url || "/placeholder.svg"}
                                      alt={attachment.filename}
                                      className="w-full h-full object-cover"
                                      loading="lazy"
                                    />
                                  </div>
                                  <p
                                    className="text-xs text-muted-foreground mt-1 truncate"
                                    title={attachment.filename}
                                  >
                                    {attachment.filename}
                                  </p>
                                </div>
                              )
                            } else {
                              return (
                                <div
                                  key={attachment.id}
                                  className="flex items-center gap-2 p-2 md:p-3 bg-muted rounded-lg"
                                >
                                  <span className="text-sm">📎</span>
                                  <a
                                    href={attachment.file_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs md:text-sm text-primary hover:underline flex-1 truncate"
                                    title={attachment.filename}
                                  >
                                    {attachment.filename}
                                  </a>
                                </div>
                              )
                            }
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-1 flex-wrap">
                  {["✅", "👀", "🔥"].map((emoji) => {
                    const count = getReactionCount(post, emoji)
                    const hasReacted = hasUserReacted(post, emoji)
                    const reactedUsers = getReactionUsers(post, emoji)

                    return (
                      <TooltipProvider key={emoji}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant={hasReacted ? "secondary" : "ghost"}
                              size="sm"
                              className={`h-9 sm:h-9 px-2.5 sm:px-3 text-base hover:bg-muted ${hasReacted ? "bg-muted" : ""}`}
                              onClick={(e) => {
                                e.preventDefault()
                                toggleReaction(post.id, emoji)
                              }}
                            >
                              <span className="mr-1">{emoji}</span>
                              {count > 0 && <span className="text-sm text-foreground">{count}</span>}
                            </Button>
                          </TooltipTrigger>
                          {count > 0 && (
                            <TooltipContent>
                              <p className="text-xs">{reactedUsers.join(", ")}</p>
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    )
                  })}
                  {post.replies && post.replies.length > 0 && (
                    <span className="text-xs text-muted-foreground ml-1 sm:ml-2">{post.replies.length} replies</span>
                  )}
                </div>

                {/* Replies */}
                {post.replies && post.replies.length > 0 && (
                  <div className="space-y-3 pl-3 sm:pl-4 border-l-2">
                    {post.replies.map((reply) => (
                      <div key={reply.id} className="flex gap-2 sm:gap-3">
                        <Avatar className="w-7 h-7 sm:w-6 sm:h-6 flex-shrink-0">
                          <AvatarFallback className="text-xs text-black">
                            {getInitials(reply.author.full_name)}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 space-y-1 min-w-0">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 min-w-0">
                              <span className="font-medium text-xs sm:text-xs text-foreground truncate">
                                {reply.author.full_name}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(reply.created_at).toLocaleString()}
                              </span>
                            </div>
                            {auth.user?.id === reply.author_id && (
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 flex-shrink-0">
                                    <MoreHorizontal className="w-3 h-3 text-foreground" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={() => {
                                      setEditingPost(reply.id)
                                      setEditContent(reply.content)
                                      setEditExistingAttachments(reply.attachments || [])
                                      setEditUploadedFiles([])
                                    }}
                                  >
                                    <Edit2 className="w-4 h-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => deletePost(reply.id)} className="text-red-600">
                                    <Trash2 className="w-4 h-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            )}
                          </div>

                          {editingPost === reply.id ? (
                            <div className="space-y-4">
                              <MentionTextarea
                                className="text-foreground text-base"
                                value={editContent}
                                onChange={setEditContent}
                                rows={2}
                              />

                              {editExistingAttachments.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">Existing Files:</Label>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {editExistingAttachments.map((attachment) => {
                                      const isImage = attachment.filename
                                        ?.toLowerCase()
                                        ?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                                      if (isImage) {
                                        return (
                                          <div key={attachment.id} className="relative group">
                                            <div className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity">
                                              <img
                                                src={attachment.file_url || "/placeholder.svg"}
                                                alt={attachment.filename}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onClick={() => {
                                                  setSelectedImage({
                                                    url: attachment.file_url,
                                                    alt: attachment.filename,
                                                  })
                                                  setImageModalOpen(true)
                                                }}
                                              />
                                            </div>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-4 w-4 p-0 text-xs"
                                                onClick={() => removeExistingAttachment(attachment.id)}
                                              >
                                                ×
                                              </Button>
                                            </div>
                                          </div>
                                        )
                                      } else {
                                        return (
                                          <div
                                            key={attachment.id}
                                            className="flex items-center gap-1 p-2 bg-muted rounded-lg"
                                          >
                                            <span className="text-xs">📎</span>
                                            <a
                                              href={attachment.file_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-primary hover:underline flex-1 truncate"
                                              title={attachment.filename}
                                            >
                                              {attachment.filename}
                                            </a>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-3 w-3 p-0 text-muted-foreground hover:text-destructive"
                                              onClick={() => removeExistingAttachment(attachment.id)}
                                            >
                                              ×
                                            </Button>
                                          </div>
                                        )
                                      }
                                    })}
                                  </div>
                                </div>
                              )}

                              {editUploadedFiles.length > 0 && (
                                <div className="space-y-2">
                                  <Label className="text-sm font-medium">New Files:</Label>
                                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                    {editUploadedFiles.map((file, index) => {
                                      const isImage = file.filename
                                        ?.toLowerCase()
                                        ?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                                      if (isImage) {
                                        return (
                                          <div key={index} className="relative group">
                                            <div className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity">
                                              <img
                                                src={file.url || "/placeholder.svg"}
                                                alt={file.filename}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                                onClick={() => {
                                                  setSelectedImage({ url: file.url, alt: file.filename })
                                                  setImageModalOpen(true)
                                                }}
                                              />
                                            </div>
                                            <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Button
                                                variant="destructive"
                                                size="sm"
                                                className="h-4 w-4 p-0 text-xs"
                                                onClick={() => removeUploadedFile(setEditUploadedFiles)(index)}
                                              >
                                                ×
                                              </Button>
                                            </div>
                                          </div>
                                        )
                                      } else {
                                        return (
                                          <div key={index} className="flex items-center gap-1 p-2 bg-muted rounded-lg">
                                            <span className="text-xs">📎</span>
                                            <a
                                              href={file.url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-primary hover:underline flex-1 truncate"
                                              title={file.filename}
                                            >
                                              {file.filename}
                                            </a>
                                            <Button
                                              variant="ghost"
                                              size="sm"
                                              className="h-3 w-3 p-0 text-muted-foreground hover:text-destructive"
                                              onClick={() => removeUploadedFile(setEditUploadedFiles)(index)}
                                            >
                                              ×
                                            </Button>
                                          </div>
                                        )
                                      }
                                    })}
                                  </div>
                                </div>
                              )}

                              <div className="flex items-center gap-2">
                                <Dialog open={isEditFileUploadOpen} onOpenChange={setIsEditFileUploadOpen}>
                                  <DialogTrigger asChild>
                                    <Button variant="outline" size="sm" className="text-foreground bg-transparent">
                                      <Upload className="w-3 h-3 mr-1" />
                                      Upload
                                    </Button>
                                  </DialogTrigger>
                                  <DialogContent>
                                    <DialogHeader>
                                      <DialogTitle>Upload File</DialogTitle>
                                      <DialogDescription>
                                        Upload additional files to attach to this reply.
                                      </DialogDescription>
                                    </DialogHeader>
                                    <FileUpload onFileUploaded={handleEditFileUploaded} className="mt-4" />
                                  </DialogContent>
                                </Dialog>
                              </div>

                              <div className="flex gap-2">
                                <Button size="sm" onClick={() => updatePost(reply.id, editContent)}>
                                  Save
                                </Button>
                                <Button
                                  className="text-foreground bg-transparent"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEditingPost(null)
                                    setEditContent("")
                                    setEditUploadedFiles([])
                                    setEditExistingAttachments([])
                                  }}
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <div
                                className="text-foreground text-base"
                                dangerouslySetInnerHTML={{ __html: formatContent(reply.content) }}
                              />

                              {reply.attachments && reply.attachments.length > 0 && (
                                <div className="space-y-2">
                                  {reply.attachments.length > 1 && (
                                    <div className="flex items-center justify-between mb-2">
                                      <span className="text-xs text-muted-foreground">
                                        {reply.attachments.length} files attached
                                      </span>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => downloadAllFiles(reply.attachments || [])}
                                        className="h-7 text-xs text-black"
                                      >
                                        <Download className="w-3 h-3 mr-1" />
                                        <span className="hidden sm:inline">All</span>
                                      </Button>
                                    </div>
                                  )}
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {reply.attachments.map((attachment) => {
                                      const isImage = attachment.filename
                                        ?.toLowerCase()
                                        ?.match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                                      if (isImage) {
                                        return (
                                          <div key={attachment.id} className="relative group">
                                            <div
                                              className="aspect-square rounded-lg overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity"
                                              onClick={() => {
                                                const contextImages = getImagesFromAttachments(reply.attachments)
                                                openImageModalWithContext(attachment.file_url, contextImages)
                                              }}
                                            >
                                              <img
                                                src={attachment.file_url || "/placeholder.svg"}
                                                alt={attachment.filename}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                              />
                                            </div>
                                            <p
                                              className="text-xs text-muted-foreground mt-1 truncate"
                                              title={attachment.filename}
                                            >
                                              {attachment.filename}
                                            </p>
                                          </div>
                                        )
                                      } else {
                                        return (
                                          <div
                                            key={attachment.id}
                                            className="flex items-center gap-2 p-2 bg-muted rounded-lg"
                                          >
                                            <span className="text-xs">📎</span>
                                            <a
                                              href={attachment.file_url}
                                              target="_blank"
                                              rel="noopener noreferrer"
                                              className="text-xs text-primary hover:underline flex-1 truncate"
                                              title={attachment.filename}
                                            >
                                              {attachment.filename}
                                            </a>
                                          </div>
                                        )
                                      }
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="flex items-center gap-1 mt-2 flex-wrap">
                            {["✅", "👀", "🔥"].map((emoji) => {
                              const count = getReactionCount(reply, emoji)
                              const hasReacted = hasUserReacted(reply, emoji)
                              const reactedUsers = getReactionUsers(reply, emoji)

                              return (
                                <TooltipProvider key={emoji}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        type="button"
                                        variant={hasReacted ? "secondary" : "ghost"}
                                        size="sm"
                                        className={`h-8 sm:h-8 px-2 sm:px-2 text-sm hover:bg-muted ${hasReacted ? "bg-muted" : ""}`}
                                        onClick={(e) => {
                                          e.preventDefault()
                                          toggleReaction(reply.id, emoji)
                                        }}
                                      >
                                        <span className="mr-0.5">{emoji}</span>
                                        {count > 0 && <span className="text-xs text-foreground">{count}</span>}
                                      </Button>
                                    </TooltipTrigger>
                                    {count > 0 && (
                                      <TooltipContent>
                                        <p className="text-xs">{reactedUsers.join(", ")}</p>
                                      </TooltipContent>
                                    )}
                                  </Tooltip>
                                </TooltipProvider>
                              )
                            })}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-3 pl-3 sm:pl-4 border-l-4">
                  <div className="flex gap-2">
                    <Avatar className="w-7 h-7 sm:w-6 sm:h-6 flex-shrink-0">
                      <AvatarFallback className="text-xs text-foreground">
                        {auth.user ? getInitials(auth.user.full_name || auth.user.email) : "?"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-2 min-w-0">
                      <MentionTextarea
                        value={getReplyContent(post.id)}
                        onChange={(value) => updateReplyContent(post.id, value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && !e.shiftKey) {
                            e.preventDefault()
                            if (!isPosting && (getReplyContent(post.id).trim() || getReplyFiles(post.id).length > 0)) {
                              createReply(post.id)
                            }
                          }
                        }}
                        placeholder="Write a reply... Type @ to mention someone (Press Enter to reply, Shift+Enter for new line)"
                        rows={2}
                        className="flex-1 p-3 sm:p-6 bg-sidebar-primary-foreground text-primary placeholder:text-muted-foreground/40 text-sm sm:text-base"
                      />

                      {getReplyFiles(post.id).length > 0 && (
                        <div className="space-y-2">
                          <Label className="text-xs font-medium">Attached Files:</Label>
                          <div className="flex flex-wrap gap-2 items-start">
                            {getReplyFiles(post.id).map((file, index) => {
                              if (!file || !file.filename || !file.url) return null

                              const isImage = file.filename.toLowerCase().match(/\.(jpg|jpeg|png|gif|webp|svg)$/i)

                              if (isImage) {
                                return (
                                  <div key={index} className="relative group">
                                    <div
                                      className="aspect-square rounded-md overflow-hidden bg-muted/20 cursor-pointer hover:opacity-90 transition-opacity h-16 w-16"
                                      onClick={() => {
                                        setSelectedImage({ url: file.url, alt: file.filename })
                                        setImageModalOpen(true)
                                      }}
                                    >
                                      <img
                                        src={file.url || "/placeholder.svg"}
                                        alt={file.filename}
                                        className="w-full h-full object-cover"
                                        loading="lazy"
                                      />
                                    </div>
                                    <div className="absolute -top-1 -right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                      <Button
                                        variant="destructive"
                                        size="sm"
                                        className="h-4 w-4 p-0 text-xs"
                                        onClick={(e) => {
                                          e.stopPropagation()
                                          const currentFiles = getReplyFiles(post.id)
                                          updateReplyFiles(
                                            post.id,
                                            currentFiles.filter((_, i) => i !== index),
                                          )
                                        }}
                                      >
                                        ×
                                      </Button>
                                    </div>
                                  </div>
                                )
                              } else {
                                return (
                                  <div key={index} className="flex items-center gap-2 p-2 bg-muted rounded-md">
                                    <span className="text-xs">📎</span>
                                    <a
                                      href={file.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-xs text-primary hover:underline flex-1 truncate"
                                      title={file.filename}
                                    >
                                      {file.filename}
                                    </a>
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-4 w-4 p-0 text-muted-foreground hover:text-destructive"
                                      onClick={() => {
                                        const currentFiles = getReplyFiles(post.id)
                                        updateReplyFiles(
                                          post.id,
                                          currentFiles.filter((_, i) => i !== index),
                                        )
                                      }}
                                    >
                                      ×
                                    </Button>
                                  </div>
                                )
                              }
                            })}
                          </div>
                        </div>
                      )}

                      <div className="flex flex-col xs:flex-row items-stretch xs:items-center justify-between gap-2">
                        <Dialog
                          open={isReplyFileUploadOpen[post.id] || false}
                          onOpenChange={(open) => setIsReplyFileUploadOpen((prev) => ({ ...prev, [post.id]: open }))}
                        >
                          <DialogTrigger asChild>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-foreground bg-transparent w-full xs:w-auto"
                            >
                              <Upload className="w-3 h-3 sm:w-3 sm:h-3 mr-2" />
                              Upload File
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="max-w-[95vw] sm:max-w-lg">
                            <DialogHeader>
                              <DialogTitle>Upload File</DialogTitle>
                              <DialogDescription>Upload files to attach to your reply.</DialogDescription>
                            </DialogHeader>
                            <FileUpload
                              onFileUploaded={(file) => {
                                handleReplyFileUploaded(post.id, file)
                                setIsReplyFileUploadOpen((prev) => ({ ...prev, [post.id]: false }))
                              }}
                              className="mt-4"
                            />
                          </DialogContent>
                        </Dialog>

                        <Button
                          size="sm"
                          onClick={() => createReply(post.id)}
                          disabled={
                            isPosting || (!getReplyContent(post.id).trim() && getReplyFiles(post.id).length === 0)
                          }
                          className="w-full xs:w-auto"
                        >
                          <Send className="w-3 h-3 mr-2" />
                          Reply
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-[98vw] sm:max-w-3xl md:max-w-4xl lg:max-w-5xl max-h-[95vh] sm:max-h-[90vh] p-2 sm:p-3 sm:py-11">
          <DialogHeader className="px-3 sm:px-6 pb-0">
            <DialogTitle className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="truncate text-sm sm:text-base">{selectedImage?.alt || "Image"}</span>
                {allImages.length > 1 && (
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    ({currentImageIndex + 1} of {allImages.length})
                  </span>
                )}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full sm:w-auto bg-transparent"
                onClick={() => {
                  if (selectedImage?.url) {
                    const link = document.createElement("a")
                    link.href = selectedImage.url
                    link.download = selectedImage.alt || "image"
                    link.target = "_blank"
                    document.body.appendChild(link)
                    link.click()
                    document.body.removeChild(link)
                  }
                }}
              >
                <Download className="w-4 h-4 mr-1" />
                Download
              </Button>
            </DialogTitle>
            <DialogDescription className="sr-only">
              View and navigate through images. Use arrow keys to navigate between images.
            </DialogDescription>
          </DialogHeader>
          <div className="px-3 sm:px-6 pt-2 sm:pt-4">
            {selectedImage && (
              <div className="relative">
                <img
                  src={selectedImage.url || "/placeholder.svg"}
                  alt={selectedImage.alt}
                  className="w-full h-auto max-h-[70vh] sm:max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
