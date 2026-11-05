"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { MessageCircle, Send, Sparkles, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { gaiaService } from "@/lib/gaia"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"
import type { GaiaRoute } from "@/lib/v1"

interface ChatMessage {
  id: number
  from: "user" | "gaia"
  text: string
}

const HIDDEN_ROUTES = new Set<string>(["/", "/auth/login", "/auth/register", "/consent"])

// Direct product routes shown whenever GAIA is off or unreachable —
// Zero Dependence means the platform must stay navigable without it.
const FALLBACK_ROUTES: GaiaRoute[] = [
  { id: "gateway", label: "Gateway education and application", route: "/gateway-quiz" },
  { id: "browse", label: "Browse the Commons", route: "/commons" },
  { id: "sanctuary", label: "My Sanctuary and licenses", route: "/member/my-sanctuary" },
  { id: "reflections", label: "Reflection Room", route: "/member/reflection-room" },
  { id: "creator", label: "Creator Studio", route: "/creator" },
  { id: "guardian", label: "Human Guardian support", route: "/moderate" },
  { id: "privacy", label: "Consent, export and deletion", route: "/privacy" },
]

const GREETING: ChatMessage = {
  id: 0,
  from: "gaia",
  text: "Hello. I am GAIA, your guide to Evonaire. Ask about rituals, sanctuaries, your account, privacy, or safety.",
}

export function GaiaChatWidget() {
  const pathname = usePathname()
  const { user, loading } = useAuth()
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState("")
  const [sending, setSending] = useState(false)
  const [quickReplies, setQuickReplies] = useState<string[]>([])
  const [consent, setConsent] = useState<"loading" | "on" | "off">("loading")
  const [routes, setRoutes] = useState<GaiaRoute[]>(FALLBACK_ROUTES)
  const [toggling, setToggling] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const idRef = useRef(1)

  // Hide on landing, auth screens, the activate code page (covers /activate/*),
  // and the immersive Gateway Quiz flow.
  const hideOnRoute =
    !pathname ||
    HIDDEN_ROUTES.has(pathname) ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/activate") ||
    pathname.startsWith("/gateway-quiz")

  useEffect(() => {
    if (!open) return
    let cancelled = false
    gaiaService
      .status()
      .then((res) => {
        if (cancelled) return
        setConsent(res.gaia_lite_permission_active ? "on" : "off")
        if (res.routes?.length) setRoutes(res.routes)
      })
      .catch(() => {
        // Status unreachable — fail closed into the off panel, which
        // still offers direct navigation without GAIA.
        if (!cancelled) setConsent("off")
      })
    gaiaService
      .quickReplies()
      .then((res) => {
        if (!cancelled) setQuickReplies(res.quick_replies)
      })
      .catch(() => setQuickReplies([]))
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const node = scrollRef.current
    if (node) node.scrollTop = node.scrollHeight
  }, [messages, open])

  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 80)
      return () => clearTimeout(t)
    }
  }, [open])

  if (loading || !user || hideOnRoute) {
    return null
  }

  const send = async (text: string) => {
    const trimmed = text.trim()
    if (!trimmed || sending) return
    const userMsg: ChatMessage = { id: idRef.current++, from: "user", text: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInput("")
    setSending(true)
    try {
      const res = await gaiaService.guidance(trimmed)
      const reply: ChatMessage = {
        id: idRef.current++,
        from: "gaia",
        text: res.voice_script,
      }
      setMessages((prev) => [...prev, reply])
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          from: "gaia",
          text: "I could not reach the guidance service. Please try again in a moment.",
        },
      ])
    } finally {
      setSending(false)
    }
  }

  const onSubmit = (event: FormEvent) => {
    event.preventDefault()
    void send(input)
  }

  const enableGaia = async () => {
    setToggling(true)
    try {
      await gaiaService.enable()
      setConsent("on")
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: idRef.current++,
          from: "gaia",
          text: "The consent service is unreachable. Your pages below still work without GAIA.",
        },
      ])
    } finally {
      setToggling(false)
    }
  }

  const disableGaia = async () => {
    setToggling(true)
    try {
      const res = await gaiaService.disableAll()
      if (res.routes?.length) setRoutes(res.routes)
    } catch {
      // Even on failure the panel switches to navigation-only mode.
    } finally {
      setToggling(false)
      setConsent("off")
    }
  }

  return (
    <>
      {!open && (
        <button
          type="button"
          aria-label="Open GAIA guide"
          onClick={() => setOpen(true)}
          className={cn(
            "fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full",
            "bg-primary text-primary-foreground shadow-lg shadow-black/40",
            "ring-1 ring-gold-light/30 transition-transform hover:scale-105",
            "focus:outline-none focus-visible:ring-2 focus-visible:ring-gold-light"
          )}
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="GAIA guide"
          className={cn(
            "fixed bottom-5 right-5 z-50 flex w-[min(22rem,calc(100vw-2.5rem))] flex-col",
            "h-[min(32rem,calc(100vh-6rem))] overflow-hidden rounded-xl border border-border",
            "bg-card text-card-foreground shadow-2xl shadow-black/50"
          )}
        >
          <div className="flex items-center justify-between border-b border-border bg-dark-navy-lighter/60 px-4 py-3">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <div className="leading-tight">
                <div className="text-sm font-semibold text-foreground">GAIA</div>
                <div className="text-[11px] text-muted-foreground">Deterministic guide</div>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close GAIA guide"
              onClick={() => setOpen(false)}
              className="h-8 w-8 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          {consent === "off" ? (
            <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
              <p className="text-sm leading-relaxed text-muted-foreground">
                GAIA Lite is off. It only answers approved platform
                questions and never reads your text, reflections, or
                history. Every page below works without it.
              </p>
              <Button
                type="button"
                onClick={() => void enableGaia()}
                disabled={toggling}
                className="w-full bg-primary text-primary-foreground hover:bg-gold-muted"
              >
                {toggling ? "Enabling…" : "Enable GAIA Lite"}
              </Button>
              <div>
                <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                  Go directly
                </div>
                <div className="flex flex-col gap-1">
                  {routes.map((r) => (
                    <Link
                      key={r.id}
                      href={r.route}
                      onClick={() => setOpen(false)}
                      className="rounded-md border border-border bg-dark-navy-lighter/40 px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    >
                      {r.label}
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ) : (
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.map((m) => (
              <div
                key={m.id}
                className={cn(
                  "flex w-full",
                  m.from === "user" ? "justify-end" : "justify-start"
                )}
              >
                <div
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words",
                    m.from === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground border border-border"
                  )}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex justify-start">
                <div className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm text-muted-foreground">
                  <Loader2 className="inline h-3 w-3 animate-spin" /> thinking
                </div>
              </div>
            )}
          </div>
          )}

          {consent === "on" && quickReplies.length > 0 && messages.length <= 1 && (
            <div className="border-t border-border px-3 pb-2 pt-2">
              <div className="mb-1 text-[11px] uppercase tracking-wide text-muted-foreground">
                Try asking
              </div>
              <div className="flex flex-wrap gap-1.5">
                {quickReplies.map((q) => (
                  <button
                    key={q}
                    type="button"
                    disabled={sending}
                    onClick={() => void send(q)}
                    className={cn(
                      "rounded-full border border-border bg-dark-navy-lighter/40 px-2.5 py-1 text-xs",
                      "text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary",
                      "disabled:cursor-not-allowed disabled:opacity-60"
                    )}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          )}

          {consent === "on" && (
          <form onSubmit={onSubmit} className="flex items-center gap-2 border-t border-border bg-dark-navy-lighter/40 p-2">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about anything on the platform"
              maxLength={256}
              disabled={sending}
              className={cn(
                "flex-1 rounded-md bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground",
                "border border-border focus:border-primary/60 focus:outline-none focus:ring-1 focus:ring-primary/40",
                "disabled:opacity-60"
              )}
            />
            <Button
              type="submit"
              size="icon"
              disabled={sending || !input.trim()}
              aria-label="Send"
              className="h-9 w-9 bg-primary text-primary-foreground hover:bg-gold-muted"
            >
              <Send className="h-4 w-4" />
            </Button>
          </form>
          )}

          {consent === "on" && (
            <div className="border-t border-border px-3 py-1.5 text-right">
              <button
                type="button"
                onClick={() => void disableGaia()}
                disabled={toggling}
                className="text-[11px] text-muted-foreground transition-colors hover:text-primary disabled:opacity-60"
              >
                Turn off GAIA
              </button>
            </div>
          )}
        </div>
      )}
    </>
  )
}
