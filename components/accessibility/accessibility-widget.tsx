"use client"

import { useEffect, useId, useState } from "react"
import { PersonStanding, X } from "lucide-react"
import { useAccessibility } from "@/lib/accessibility-context"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { cn } from "@/lib/utils"

const PREFERENCE_OPTIONS = [
  {
    key: "highContrast" as const,
    label: "Higher contrast",
    description: "Stronger colors and borders for readability.",
  },
  {
    key: "reducedMotion" as const,
    label: "Reduced motion",
    description: "Minimize movement, transitions, and smooth scrolling.",
  },
  {
    key: "pausedAnimations" as const,
    label: "Paused animations",
    description: "Freeze repeating animations in place.",
  },
  {
    key: "biggerText" as const,
    label: "Bigger text",
    description: "Increase the base text size across the site.",
  },
  {
    key: "biggerTextSpacing" as const,
    label: "Bigger text spacing",
    description: "Add more space between letters and lines.",
  },
  {
    key: "dyslexiaFriendly" as const,
    label: "Dyslexia friendly",
    description: "Change the font to a dyslexia friendly font.",
  },
]

export function AccessibilityWidget() {
  const { preferences, setPreference, resetPreferences } = useAccessibility()
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKeyDown)
    return () => window.removeEventListener("keydown", onKeyDown)
  }, [open])

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open accessibility menu"
          aria-expanded={open}
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-5 left-5 z-[60] flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg shadow-black/40",
            "ring-1 ring-gold-light/30 transition-transform hover:scale-105",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light cursor-pointer",
          )}
        >
          <PersonStanding className="h-9 w-9" aria-hidden="true" />
        </button>
      )}

      {open && (
        <>
          <button
            type="button"
            aria-label="Close accessibility menu"
            className="fixed inset-0 z-[59] cursor-default bg-black/20"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-labelledby={titleId}
            aria-label="Accessibility options"
            className={cn(
              "fixed inset-y-0 left-0 z-[60] flex h-screen w-[min(22rem,100vw)] flex-col overflow-hidden",
              "rounded-none border-y border-r border-border sm:rounded-r-xl",
              "bg-card text-card-foreground shadow-2xl shadow-black/50",
            )}
          >
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-dark-navy-lighter/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <PersonStanding className="h-6 w-6 text-primary" aria-hidden="true" />
              <h2 id={titleId} className="text-xl font-semibold text-foreground">
                Accessibility Menu
              </h2>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close accessibility menu"
              onClick={() => setOpen(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 min-h-0 space-y-4 overflow-y-auto px-4 py-4">
            {PREFERENCE_OPTIONS.map(({ key, label, description }) => {
              const switchId = `a11y-${key}`
              return (
                <div
                  key={key}
                  className="flex items-start justify-between gap-4 rounded-lg border border-border/60 bg-background/40 px-3 py-3"
                >
                  <div className="min-w-0 space-y-1">
                    <Label htmlFor={switchId} className="text-foreground text-base">
                      {label}
                    </Label>
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                  </div>
                  <Switch
                    id={switchId}
                    checked={preferences[key]}
                    onCheckedChange={(checked) => setPreference(key, checked === true)}
                    aria-label={label}
                    className={cn(
                      "mt-0.5 shrink-0",
                      "data-[state=unchecked]:border data-[state=unchecked]:border-gold/50 data-[state=unchecked]:bg-cream/30",
                      "data-[state=unchecked]:[&_[data-slot=switch-thumb]]:bg-gold-muted",
                    )}
                  />
                </div>
              )
            })}
          </div>

          <div className="shrink-0 border-t border-border px-4 py-3">
            <Button
              type="button"
              variant="outline"
              className="w-full text-base"
              onClick={() => {
                resetPreferences()
              }}
            >
              Reset to defaults
            </Button>
          </div>
        </div>
        </>
      )}
    </>
  )
}
