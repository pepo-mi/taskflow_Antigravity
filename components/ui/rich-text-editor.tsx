"use client"

import type React from "react"
import { useEffect, useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { BoldIcon, ItalicIcon, Strikethrough, UnderlineIcon, List, ListOrdered, LinkIcon } from "lucide-react"
import { sanitizeContent, sanitizePastedContent } from "@/lib/content-sanitizer"

interface RichTextEditorProps {
  content: string
  onChange: (content: string) => void
  placeholder?: string
  className?: string
}

const formatUrls = (html: string) => {
  // Create a temporary div to parse HTML
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  // Function to process text nodes only
  const processTextNodes = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ""
      const urlRegex = /(https?:\/\/[^\s<>"]+|www\.[^\s<>"]+)/g

      if (urlRegex.test(text)) {
        const formattedText = text.replace(urlRegex, (url) => {
          const href = url.startsWith("www.") ? `https://${url}` : url
          return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:text-blue-800 underline">${url}</a>`
        })

        // Replace text node with formatted HTML
        const wrapper = document.createElement("span")
        wrapper.innerHTML = formattedText
        node.parentNode?.replaceChild(wrapper, node)

        // Replace wrapper with its contents
        while (wrapper.firstChild) {
          wrapper.parentNode?.insertBefore(wrapper.firstChild, wrapper)
        }
        wrapper.remove()
      }
    } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== "A") {
      // Process child nodes if not already a link
      Array.from(node.childNodes).forEach(processTextNodes)
    }
  }

  processTextNodes(tempDiv)
  return tempDiv.innerHTML
}

export function RichTextEditor({ content, onChange, placeholder, className }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const [isFocused, setIsFocused] = useState(false)
  const isInternalChange = useRef(false)
  const toggleInProgress = useRef(false) // Prevent double-toggle

  useEffect(() => {
    if (editorRef.current && content !== editorRef.current.innerHTML && !isInternalChange.current) {
      editorRef.current.innerHTML = content
    }
    // Reset the flag after processing
    isInternalChange.current = false
  }, [content])

  const handleInput = () => {
    if (editorRef.current) {
      const rawContent = editorRef.current.innerHTML
      const sanitizedContent = sanitizeContent(rawContent)

      isInternalChange.current = true
      onChange(sanitizedContent)
    }
  }

  const formatText = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    isInternalChange.current = true
    handleInput()
  }

  const insertList = (listType: "ul" | "ol") => {
    if (toggleInProgress.current) {
      return
    }

    const selection = window.getSelection()
    if (!selection || !editorRef.current) return

    const range = selection.getRangeAt(0)

    const startContainer = range.startContainer
    const startOffset = range.startOffset

    const existingListItem = range.startContainer.parentElement?.closest("li")
    const existingList = existingListItem?.closest("ul, ol")

    if (existingList) {
      const currentListType = existingList.tagName.toLowerCase() as "ul" | "ol"

      if (currentListType === listType) {
        toggleInProgress.current = true

        const listItems = Array.from(existingList.querySelectorAll("li"))
        const fragment = document.createDocumentFragment()

        listItems.forEach((li) => {
          const p = document.createElement("p")
          p.innerHTML = li.innerHTML || "<br>"
          p.style.margin = "0.5em 0"
          fragment.appendChild(p)
        })

        existingList.parentNode?.replaceChild(fragment, existingList)

        requestAnimationFrame(() => {
          const newRange = document.createRange()
          const firstP = fragment.firstChild as HTMLElement
          if (firstP && firstP.firstChild) {
            newRange.setStart(firstP.firstChild, 0)
          } else if (firstP) {
            newRange.setStart(firstP, 0)
          }
          newRange.collapse(true)
          selection.removeAllRanges()
          selection.addRange(newRange)
          editorRef.current?.focus()

          setTimeout(() => {
            toggleInProgress.current = false
          }, 100)
        })

        handleInput()
        return
      } else {
        const newList = document.createElement(listType)
        newList.style.paddingLeft = "1.5em"
        newList.style.margin = "0.5em 0"

        const listItems = Array.from(existingList.querySelectorAll("li"))
        listItems.forEach((li) => {
          const newLi = document.createElement("li")
          newLi.innerHTML = li.innerHTML
          newLi.style.marginBottom = "0.25em"
          newList.appendChild(newLi)
        })

        existingList.parentNode?.replaceChild(newList, existingList)

        const newListItems = Array.from(newList.querySelectorAll("li"))
        const targetListItem = newListItems.find(
          (li) => li.contains(existingListItem) || li.innerHTML === existingListItem?.innerHTML,
        )

        if (targetListItem) {
          requestAnimationFrame(() => {
            const newRange = document.createRange()

            if (startContainer.nodeType === Node.TEXT_NODE && targetListItem.firstChild) {
              const textNode = targetListItem.firstChild
              if (textNode.nodeType === Node.TEXT_NODE) {
                const maxOffset = Math.min(startOffset, textNode.textContent?.length || 0)
                newRange.setStart(textNode, maxOffset)
              } else {
                newRange.setStart(targetListItem, 0)
              }
            } else {
              newRange.setStart(targetListItem, 0)
            }

            newRange.collapse(true)
            selection.removeAllRanges()
            selection.addRange(newRange)

            editorRef.current?.focus()
          })
        }

        isInternalChange.current = true
        handleInput()
        return
      }
    }

    let currentBlock = startContainer
    while (currentBlock && currentBlock.nodeType !== Node.ELEMENT_NODE) {
      currentBlock = currentBlock.parentNode
    }

    while (currentBlock && currentBlock !== editorRef.current) {
      const tagName = (currentBlock as Element).tagName?.toLowerCase()
      if (tagName === "p" || tagName === "div" || currentBlock === editorRef.current) {
        break
      }
      currentBlock = currentBlock.parentNode
    }

    if (currentBlock === editorRef.current) {
      currentBlock = document.createElement("p")
      currentBlock.innerHTML = "<br>"
      editorRef.current.appendChild(currentBlock)
    }

    const blockContent = (currentBlock as Element).innerHTML
    const textBeforeCursor = range.toString() || ""

    const listHTML =
      listType === "ul"
        ? `<ul style="padding-left: 1.5em; margin: 0.5em 0;"><li style="margin-bottom: 0.25em;">${blockContent}</li></ul>`
        : `<ol style="padding-left: 1.5em; margin: 0.5em 0;"><li style="margin-bottom: 0.25em;">${blockContent}</li></ol>`

    const tempDiv = document.createElement("div")
    tempDiv.innerHTML = listHTML
    const listElement = tempDiv.firstChild as HTMLElement

    currentBlock.parentNode?.replaceChild(listElement, currentBlock)

    const listItem = listElement.querySelector("li")
    if (listItem) {
      requestAnimationFrame(() => {
        const newRange = document.createRange()

        if (startContainer.nodeType === Node.TEXT_NODE && listItem.firstChild) {
          const textNode = listItem.firstChild
          if (textNode.nodeType === Node.TEXT_NODE) {
            const maxOffset = Math.min(startOffset, textNode.textContent?.length || 0)
            newRange.setStart(textNode, maxOffset)
          } else {
            newRange.setStart(listItem, 0)
          }
        } else {
          newRange.setStart(listItem, 0)
        }

        newRange.collapse(true)
        selection.removeAllRanges()
        selection.addRange(newRange)

        editorRef.current?.focus()
      })
    }

    isInternalChange.current = true
    handleInput()
  }

  const insertLink = () => {
    const url = window.prompt("Enter URL:")
    if (url) {
      formatText("createLink", url)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Backspace") {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const listItem = range.startContainer.parentElement?.closest("li")

        if (listItem) {
          const isAtStart =
            range.startOffset === 0 &&
            (range.startContainer === listItem || range.startContainer === listItem.firstChild)

          const isEmpty = !listItem.textContent?.trim() || listItem.innerHTML === "<br>" || listItem.innerHTML === ""

          if (isAtStart && isEmpty) {
            e.preventDefault()

            const list = listItem.closest("ul, ol")
            if (list) {
              if (list.children.length === 1) {
                const newP = document.createElement("p")
                newP.innerHTML = "<br>"
                newP.style.margin = "0.5em 0"
                list.parentNode?.replaceChild(newP, list)

                const newRange = document.createRange()
                newRange.setStart(newP, 0)
                newRange.collapse(true)
                selection.removeAllRanges()
                selection.addRange(newRange)
              } else {
                const newP = document.createElement("p")
                newP.innerHTML = "<br>"
                newP.style.margin = "0.5em 0"
                list.parentNode?.insertBefore(newP, list.nextSibling)

                listItem.remove()

                const newRange = document.createRange()
                newRange.setStart(newP, 0)
                newRange.collapse(true)
                selection.removeAllRanges()
                selection.addRange(newRange)
              }

              isInternalChange.current = true
              handleInput()
            }
          }
        }
      }
    }

    if (e.key === "Enter") {
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        const listItem = range.startContainer.parentElement?.closest("li")

        if (listItem) {
          e.preventDefault()

          const currentText = listItem.textContent?.trim()
          if (!currentText || currentText === "") {
            const list = listItem.closest("ul, ol")
            if (list) {
              const newP = document.createElement("p")
              newP.innerHTML = "<br>"
              newP.style.margin = "0.5em 0"
              list.parentNode?.insertBefore(newP, list.nextSibling)

              if (listItem.parentNode?.children.length === 1) {
                list.remove()
              } else {
                listItem.remove()
              }

              const newRange = document.createRange()
              newRange.setStart(newP, 0)
              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)
            }
          } else {
            const newLi = document.createElement("li")
            newLi.style.marginBottom = "0.25em"

            const currentNode = range.startContainer
            const offset = range.startOffset

            if (currentNode.nodeType === Node.TEXT_NODE) {
              const beforeText = currentNode.textContent?.substring(0, offset) || ""
              const afterText = currentNode.textContent?.substring(offset) || ""

              if (beforeText) {
                listItem.textContent = beforeText
              } else {
                listItem.innerHTML = "<br>"
              }

              if (afterText.trim()) {
                newLi.textContent = afterText
              } else {
                newLi.innerHTML = "<br>"
              }
            } else {
              newLi.innerHTML = "<br>"
            }

            listItem.parentNode?.insertBefore(newLi, listItem.nextSibling)

            requestAnimationFrame(() => {
              const newRange = document.createRange()

              if (newLi.firstChild && newLi.firstChild.nodeType === Node.TEXT_NODE) {
                newRange.setStart(newLi.firstChild, 0)
              } else {
                newRange.setStart(newLi, 0)
              }

              newRange.collapse(true)
              selection.removeAllRanges()
              selection.addRange(newRange)

              editorRef.current?.focus()
            })
          }

          isInternalChange.current = true
          handleInput()
        }
      }
    }

    if (e.key === " " || e.key === "Enter") {
      setTimeout(() => {
        isInternalChange.current = true
        handleInput()
      }, 10)
    }
  }

  const handleBlur = () => {
    setIsFocused(false)
    if (editorRef.current) {
      const rawContent = editorRef.current.innerHTML
      const sanitizedContent = sanitizeContent(rawContent)
      const formattedContent = formatUrls(sanitizedContent)

      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = formattedContent
      const links = tempDiv.querySelectorAll("a")
      links.forEach((link) => {
        if (!link.hasAttribute("target")) {
          link.setAttribute("target", "_blank")
        }
        if (!link.hasAttribute("rel")) {
          link.setAttribute("rel", "noopener noreferrer")
        }
      })
      const finalContent = tempDiv.innerHTML

      if (finalContent !== rawContent) {
        editorRef.current.innerHTML = finalContent
        isInternalChange.current = true
        onChange(finalContent)
      }
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()

    const pastedData = e.clipboardData.getData("text/html") || e.clipboardData.getData("text/plain")

    if (!pastedData) return

    const sanitizedContent = sanitizePastedContent(pastedData)

    const selection = window.getSelection()
    if (selection && selection.rangeCount > 0) {
      const range = selection.getRangeAt(0)
      range.deleteContents()

      const tempDiv = document.createElement("div")
      tempDiv.innerHTML = sanitizedContent

      let lastInsertedNode: Node | null = null
      while (tempDiv.firstChild) {
        lastInsertedNode = tempDiv.firstChild
        range.insertNode(lastInsertedNode)
        range.setStartAfter(lastInsertedNode)
      }

      if (lastInsertedNode) {
        range.setStartAfter(lastInsertedNode)
        range.collapse(true)
        selection.removeAllRanges()
        selection.addRange(range)
      }

      isInternalChange.current = true
      handleInput()
    }
  }

  return (
    <div className={`border rounded-md ${className}`}>
      <div className="flex items-center gap-1 p-2 border-b bg-muted/30">
        <Button type="button" variant="ghost" size="sm" onClick={() => formatText("bold")}>
          <BoldIcon className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => formatText("italic")}>
          <ItalicIcon className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => formatText("underline")}>
          <UnderlineIcon className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => formatText("strikeThrough")}>
          <Strikethrough className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" onClick={() => insertList("ul")}>
          <List className="w-4 h-4" />
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={() => insertList("ol")}>
          <ListOrdered className="w-4 h-4" />
        </Button>
        <div className="w-px h-6 bg-border mx-1" />
        <Button type="button" variant="ghost" size="sm" onClick={insertLink}>
          <LinkIcon className="w-4 h-4" />
        </Button>
      </div>

      <div className="min-h-[100px] max-h-[200px] overflow-y-auto relative">
        <div
          ref={editorRef}
          contentEditable
          className="p-3 outline-none min-h-[100px] prose prose-sm max-w-none rich-text-content"
          onInput={handleInput}
          onFocus={() => setIsFocused(true)}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          style={{
            fontSize: "14px",
            lineHeight: "1.5",
          }}
          suppressContentEditableWarning={true}
        />
        {!isFocused && !content && (
          <div className="absolute top-3 left-3 text-muted-foreground pointer-events-none">
            {placeholder || "Enter text..."}
          </div>
        )}
      </div>

      <style jsx global>{`
        .rich-text-content ul, .rich-text-content ol {
          padding-left: 1.5em !important;
          margin: 0.5em 0 !important;
          list-style-position: outside !important;
        }
        .rich-text-content ul {
          list-style-type: disc !important;
        }
        .rich-text-content ol {
          list-style-type: decimal !important;
        }
        .rich-text-content li {
          margin-bottom: 0.25em !important;
          line-height: 1.5 !important;
          display: list-item !important;
        }
        .rich-text-content li::marker {
          color: #6b7280 !important;
        }
        .rich-text-content a {
          color: #2563eb !important;
          text-decoration: underline !important;
          word-break: break-all !important;
          overflow-wrap: break-word !important;
          hyphens: auto !important;
          display: inline !important;
        }
        .rich-text-content a:hover {
          color: #1d4ed8 !important;
        }
        .rich-text-content p {
          margin: 0.5em 0 !important;
        }
        .rich-text-content div {
          margin: 0.5em 0 !important;
        }
        .rich-text-content strong {
          font-weight: 600 !important;
        }
        .rich-text-content em {
          font-style: italic !important;
        }
      `}</style>
    </div>
  )
}
