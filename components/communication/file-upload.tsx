"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Upload, FileIcon, ImageIcon, X } from "lucide-react"
import { toast } from "@/hooks/use-toast"

interface FileUploadProps {
  onFileUploaded: (file: { url: string; filename: string }) => void // Updated to pass file object instead of separate parameters
  postId?: string
  className?: string
}

export function FileUpload({ onFileUploaded, postId, className }: FileUploadProps) {
  const [uploading, setUploading] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const handleFileUpload = async (file: File) => {
    if (!file) return

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        title: "File too large",
        description: "Please select a file smaller than 10MB",
        variant: "destructive",
      })
      return
    }

    try {
      const formData = new FormData()
      formData.append("file", file)
      if (postId) formData.append("postId", postId)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Upload failed")
      }

      const result = await response.json()
      onFileUploaded({ url: result.url, filename: result.filename })

      toast({
        title: "File uploaded",
        description: `${result.filename} uploaded successfully`,
      })
    } catch (error) {
      console.error("Upload error:", error)
      toast({
        title: "Upload failed",
        description: "Please try again",
        variant: "destructive",
      })
    }
  }

  const handleMultipleFiles = async (files: FileList) => {
    const fileArray = Array.from(files)
    setUploading(true)

    try {
      for (const file of fileArray) {
        await handleFileUpload(file)
      }
    } finally {
      setUploading(false)
      setDragActive(false)
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleMultipleFiles(e.dataTransfer.files)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      handleMultipleFiles(e.target.files)
    }
  }

  return (
    <div className={className}>
      <div
        className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors ${
          dragActive ? "border-primary bg-primary/5" : "border-gray-300 hover:border-gray-400"
        } ${uploading ? "opacity-50 pointer-events-none" : ""}`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <Upload className="mx-auto h-8 w-8 text-gray-400 mb-2" />
        <p className="text-sm text-gray-600 mb-2">
          {uploading ? "Uploading files..." : "Drag and drop files here, or click to select"}
        </p>
        <Input
          type="file"
          onChange={handleInputChange}
          disabled={uploading}
          className="hidden"
          id="file-upload"
          accept="image/*,.pdf,.doc,.docx,.txt"
          multiple // Added multiple attribute to allow selecting multiple files
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById("file-upload")?.click()}
        >
          {uploading ? "Uploading..." : "Select Files"} {/* Updated text to indicate multiple files */}
        </Button>
      </div>
    </div>
  )
}

interface FilePreviewProps {
  filename: string
  fileUrl: string
  fileType: string
  onRemove?: () => void
}

export function FilePreview({ filename, fileUrl, fileType, onRemove }: FilePreviewProps) {
  const isImage = fileType.startsWith("image/")

  return (
    <div className="flex items-center gap-2 p-2 bg-gray-50 rounded border">
      {isImage ? <ImageIcon className="h-4 w-4 text-blue-500" /> : <FileIcon className="h-4 w-4 text-gray-500" />}
      <a
        href={fileUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:underline flex-1 truncate"
      >
        {filename}
      </a>
      {onRemove && (
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} className="h-6 w-6 p-0">
          <X className="h-3 w-3" />
        </Button>
      )}
    </div>
  )
}
