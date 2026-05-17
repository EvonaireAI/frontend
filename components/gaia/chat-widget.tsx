"use client"

import { useEffect, useRef, useState, type FormEvent } from "react"
import { usePathname } from "next/navigation"
import { MessageCircle, Send, Sparkles, X, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { gaiaService } from "@/lib/gaia"
import { useAuth } from "@/lib/auth-context"
import { cn } from "@/lib/utils"

interface ChatMessage {
  id: number
  from: "user" | "gaia"
  text: string
}

const HIDDEN_ROUTES = new Set<string>(["/", "/auth/login", "/auth/register", "/consent"])

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
    gaiaService
      .quickReplies()
      .then((res) => setQuickReplies(res.quick_replies))
      .catch(() => setQuickReplies([]))
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

          {quickReplies.length > 0 && messages.length <= 1 && (
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
        </div>
      )}
    </>
  )
}
