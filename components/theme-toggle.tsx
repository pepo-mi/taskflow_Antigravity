"use client"

import * as React from "react"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  const [localTheme, setLocalTheme] = React.useState<"light" | "dark">("light")

  React.useEffect(() => {
    setMounted(true)
    const htmlElement = document.documentElement
    const hasDark = htmlElement.classList.contains("dark")

    const storedTheme = localStorage.getItem("theme") as "light" | "dark" | null

    if (storedTheme) {
      setLocalTheme(storedTheme)
      if (storedTheme === "dark") {
        htmlElement.classList.add("dark")
        htmlElement.classList.remove("light")
      } else {
        htmlElement.classList.add("light")
        htmlElement.classList.remove("dark")
      }
    } else if (hasDark) {
      setLocalTheme("dark")
    } else {
      // Default to light mode
      setLocalTheme("light")
      htmlElement.classList.add("light")
      htmlElement.classList.remove("dark")
    }
  }, [])

  if (!mounted) {
    return (
      <Button variant="ghost" size="icon" className="h-9 w-9" disabled aria-label="Loading theme toggle">
        <Sun className="h-4 w-4" />
      </Button>
    )
  }

  const isDark = resolvedTheme === "dark" || localTheme === "dark"

  const toggleTheme = () => {
    const newTheme = isDark ? "light" : "dark"

    setTheme(newTheme)

    const htmlElement = document.documentElement
    if (newTheme === "dark") {
      htmlElement.classList.remove("light")
      htmlElement.classList.add("dark")
    } else {
      htmlElement.classList.remove("dark")
      htmlElement.classList.add("light")
    }

    setLocalTheme(newTheme)

    try {
      localStorage.setItem("theme", newTheme)
    } catch (e) {
      console.log("[v0] localStorage not available")
    }
  }

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            className="h-9 w-9 transition-colors hover:bg-accent"
            aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
            aria-pressed={isDark}
            role="switch"
          >
            {isDark ? (
              <Moon className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
            ) : (
              <Sun className="h-4 w-4 transition-transform duration-200" aria-hidden="true" />
            )}
            <span className="sr-only">{isDark ? "Switch to light mode" : "Switch to dark mode"}</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="text-xs">
          <p>{isDark ? "Light Mode" : "Dark Mode"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
