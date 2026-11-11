"use client"

import type React from "react"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Loader2 } from "lucide-react"
import { tr, trNode } from "@/lib/i18n"


interface JoinRequestFormProps {
  sanctuaryId: number
  sanctuaryTitle: string
  onSubmit: (note?: string, inviteToken?: string) => Promise<void>
  onSuccess?: () => void
}

export function JoinRequestForm({ sanctuaryId, sanctuaryTitle, onSubmit, onSuccess }: JoinRequestFormProps) {
  const [note, setNote] = useState("")
  const [inviteToken, setInviteToken] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      await onSubmit(note || undefined, inviteToken || undefined)
      setNote("")
      setInviteToken("")
      onSuccess?.()
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Failed to submit request"))
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{tr("Request to Join")}</CardTitle>
        <CardDescription>{trNode("Request access to {p0}", { p0: sanctuaryTitle })}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">{tr("Tell us about yourself (optional)")}</label>
            <Textarea
              placeholder={tr("Share why you're interested in joining this sanctuary...")}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-24"
            />
          </div>

          <div>
            <label className="text-sm font-medium mb-2 block">{tr("Invite Token (if you have one)")}</label>
            <Input
              placeholder={tr("Enter your invite token")}
              value={inviteToken}
              onChange={(e) => setInviteToken(e.target.value)}
            />
          </div>

          {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>}

          <Button type="submit" disabled={loading} className="w-full">
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {tr("Submit Request")}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
