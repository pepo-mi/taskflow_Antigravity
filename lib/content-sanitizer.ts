/**
 * Sanitizes HTML content while preserving a minimal set of formatting tags
 * Keeps: Bold, Italic, Underline, Strikethrough, Lists, Links
 * Strips: Inline styles, background colors, fonts, sizes, scripts, iframes, embeds, other non-whitelisted tags
 */
export const sanitizeContent = (html: string): string => {
  if (!html) return ""

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  // Define allowed tags and their allowed attributes
  const allowedTags = {
    strong: [],
    b: [],
    em: [],
    i: [],
    u: [],
    s: [],
    del: [],
    ul: [],
    ol: [],
    li: [],
    a: ["href", "target", "rel"],
    p: [],
    br: [],
    div: [],
  }

  // Recursively clean the DOM tree
  const cleanNode = (node: Node): Node | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()

      // If tag is not allowed, replace with its content
      if (!allowedTags[tagName as keyof typeof allowedTags]) {
        const fragment = document.createDocumentFragment()
        Array.from(element.childNodes).forEach((child) => {
          const cleanedChild = cleanNode(child)
          if (cleanedChild) {
            fragment.appendChild(cleanedChild)
          }
        })
        return fragment
      }

      // Create new clean element
      const cleanElement = document.createElement(tagName)
      const allowedAttrs = allowedTags[tagName as keyof typeof allowedTags]

      // Copy only allowed attributes
      Array.from(element.attributes).forEach((attr) => {
        if (allowedAttrs.includes(attr.name)) {
          // Special handling for href to prevent javascript: and other dangerous protocols
          if (attr.name === "href") {
            const href = attr.value.trim()
            if (
              href.startsWith("http://") ||
              href.startsWith("https://") ||
              href.startsWith("mailto:") ||
              href.startsWith("#")
            ) {
              cleanElement.setAttribute(attr.name, href)
            }
          } else if (attr.name === "target") {
            // Only allow _blank for security
            if (attr.value === "_blank") {
              cleanElement.setAttribute(attr.name, attr.value)
            }
          } else if (attr.name === "rel") {
            // Ensure noopener noreferrer for security
            cleanElement.setAttribute(attr.name, "noopener noreferrer")
          } else {
            cleanElement.setAttribute(attr.name, attr.value)
          }
        }
      })

      // Recursively clean child nodes
      Array.from(element.childNodes).forEach((child) => {
        const cleanedChild = cleanNode(child)
        if (cleanedChild) {
          cleanElement.appendChild(cleanedChild)
        }
      })

      return cleanElement
    }

    return null
  }

  // Clean all child nodes
  const cleanedFragment = document.createDocumentFragment()
  Array.from(tempDiv.childNodes).forEach((child) => {
    const cleanedChild = cleanNode(child)
    if (cleanedChild) {
      cleanedFragment.appendChild(cleanedChild)
    }
  })

  // Create a temporary container to get the cleaned HTML
  const cleanedDiv = document.createElement("div")
  cleanedDiv.appendChild(cleanedFragment)

  let cleanedHtml = cleanedDiv.innerHTML

  // Additional cleanup for any remaining dangerous content
  cleanedHtml = cleanedHtml
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "")
    .replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "")
    .replace(/<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "")
    .replace(/javascript:/gi, "")
    .replace(/vbscript:/gi, "")
    .replace(/data:text\/html/gi, "data:text/plain")
    .replace(/style\s*=\s*"[^"]*"/gi, "")
    .replace(/style\s*=\s*'[^']*'/gi, "")
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, "")
    .replace(/<div>\s*<\/div>/gi, "")
    .replace(/<p>\s*<br\s*\/?>\s*<\/p>/gi, "")
    .replace(/<p>\s*<\/p>/gi, "")
    .replace(/(<br\s*\/?>)\s*\1+/gi, "$1") // Remove consecutive br tags

  return cleanedHtml.trim()
}

/**
 * Sanitizes content specifically for paste events
 * More aggressive cleaning for pasted content
 */
export const sanitizePastedContent = (html: string): string => {
  // First apply standard sanitization
  let cleaned = sanitizeContent(html)

  // Remove common formatting artifacts from copy-paste
  cleaned = cleaned
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .replace(/<p>\s*<\/p>/g, "")
    .replace(/<div>\s*<\/div>/g, "")
    .replace(/<br\s*\/?>\s*<br\s*\/?>/g, "<br>")
    .replace(/<div>\s*<br\s*\/?>\s*<\/div>/gi, "")

  return cleaned.trim()
}

/**
 * Converts HTML content to plain text by stripping all HTML tags
 * Preserves line breaks and basic text structure while removing all formatting
 */
export const convertToPlainText = (html: string): string => {
  if (!html) return ""

  // Create a temporary DOM element to parse the HTML
  const tempDiv = document.createElement("div")
  tempDiv.innerHTML = html

  // Function to extract text content and preserve some structure
  const extractText = (node: Node): string => {
    if (node.nodeType === Node.TEXT_NODE) {
      return node.textContent || ""
    }

    if (node.nodeType === Node.ELEMENT_NODE) {
      const element = node as Element
      const tagName = element.tagName.toLowerCase()

      let text = ""

      // Add line breaks for block elements
      const blockElements = ["div", "p", "br", "li", "h1", "h2", "h3", "h4", "h5", "h6"]
      const listElements = ["ul", "ol"]

      if (tagName === "br") {
        return "\n"
      }

      // Process child nodes
      Array.from(element.childNodes).forEach((child, index) => {
        const childText = extractText(child)

        // Add bullet point for list items
        if (tagName === "li") {
          text += (index === 0 ? "• " : "") + childText
        } else {
          text += childText
        }
      })

      // Add line breaks after block elements
      if (blockElements.includes(tagName) && tagName !== "br") {
        text += "\n"
      }

      // Add extra line break after lists
      if (listElements.includes(tagName)) {
        text += "\n"
      }

      return text
    }

    return ""
  }

  let plainText = extractText(tempDiv)

  // Clean up the text
  plainText = plainText
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Remove excessive line breaks
    .replace(/^\s+|\s+$/g, "") // Trim whitespace
    .replace(/[ \t]+/g, " ") // Normalize spaces
    .replace(/\n /g, "\n") // Remove spaces at start of lines

  return plainText
}
