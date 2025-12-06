"use client"

import type React from "react"
import { useState, useRef } from "react"
import { Textarea } from "@/components/ui/textarea"
import { MentionAutocomplete } from "./mention-autocomplete"

interface User {
  id: string
  full_name: string
  email: string
  role: string
}

interface MentionTextareaProps {
  value: string
  onChange: (value: string) => void
  onKeyDown?: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void
  placeholder?: string
  rows?: number
  className?: string
  autoFocus?: boolean
}

export function MentionTextarea({
  value,
  onChange,
  onKeyDown,
  placeholder,
  rows = 3,
  className,
  autoFocus,
}: MentionTextareaProps) {
  const [showMentions, setShowMentions] = useState(false)
  const [mentionQuery, setMentionQuery] = useState("")
  const [mentionPosition, setMentionPosition] = useState({ top: 0, left: 0 })
  const [cursorPosition, setCursorPosition] = useState(0)
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const cursorPos = e.target.selectionStart
    onChange(newValue)
    setCursorPosition(cursorPos)

    const textBeforeCursor = newValue.slice(0, cursorPos)
    const mentionMatch = textBeforeCursor.match(/@([\p{L}\p{N}_]*)$/u);


    if (mentionMatch) {
      const query = mentionMatch[1]
      setMentionQuery(query)
      setShowMentions(true)
      setHighlightedIndex(0) // reset highlight when new list shows

      if (textareaRef.current) {
        const textarea = textareaRef.current
        const rect = textarea.getBoundingClientRect()

        // Create a temporary element to measure the @ position
        const div = document.createElement("div")
        const styles = window.getComputedStyle(textarea)
        div.style.position = "absolute"
        div.style.visibility = "hidden"
        div.style.whiteSpace = "pre-wrap"
        div.style.wordWrap = "break-word"
        div.style.font = styles.font
        div.style.padding = styles.padding
        div.style.width = styles.width
        div.textContent = textBeforeCursor
        document.body.appendChild(div)

        const span = document.createElement("span")
        span.textContent = "@"
        div.appendChild(span)

        const spanRect = span.getBoundingClientRect()
        document.body.removeChild(div)

        setMentionPosition({
          top: rect.top + textarea.scrollTop + 24,
          left: Math.min(spanRect.left, rect.right - 260),
        })
      }
    } else {
      setShowMentions(false)
      setMentionQuery("")
    }
  }

  const handleMentionSelect = (user: User) => {
    if (!textareaRef.current) return

    const textBeforeCursor = value.slice(0, cursorPosition)
    const textAfterCursor = value.slice(cursorPosition)
    const mentionStartIndex = textBeforeCursor.lastIndexOf("@")

   // inside handleMentionSelect
const mention = `@${user.full_name}`;
const newValue = value.slice(0, mentionStartIndex) + mention + " " + textAfterCursor;



    onChange(newValue)
    setShowMentions(false)
    setMentionQuery("")

    setTimeout(() => {
      if (textareaRef.current) {
        const newCursorPos = mentionStartIndex + mention.length + 1
        textareaRef.current.setSelectionRange(newCursorPos, newCursorPos)
        textareaRef.current.focus()
      }
    }, 0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions) {
      if (e.key === "ArrowDown") {
        e.preventDefault()
        setHighlightedIndex((prev) => prev + 1)
        return
      }
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setHighlightedIndex((prev) => Math.max(prev - 1, 0))
        return
      }
      if (e.key === "Enter") {
        e.preventDefault()
        // Let autocomplete handle selection by index
        ;(window as any).selectMention?.(highlightedIndex)
        return
      }
      if (e.key === "Escape") {
        setShowMentions(false)
        return
      }
    }

    if (onKeyDown) {
      onKeyDown(e)
    }
  }

  return (
    <div className="relative">
      <Textarea
        ref={textareaRef}
        value={value}
        onChange={handleTextChange}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        rows={rows}
        className={className}
        autoFocus={autoFocus}
      />
      {showMentions && (
        <MentionAutocomplete
          searchQuery={mentionQuery}
          position={mentionPosition}
          highlightedIndex={highlightedIndex}
          onSelect={handleMentionSelect}
          onClose={() => setShowMentions(false)}
          setSelectHandler={(fn) => ((window as any).selectMention = fn)} // pass selection handler
        />
      )}
    </div>
  )
}
