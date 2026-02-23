"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { authService, type User } from "@/lib/auth"
import { sanctuariesService } from "@/lib/sanctuaries"
import { Loader2, ArrowLeft, Plus, X } from "lucide-react"
import Link from "next/link"

export default function CreateSanctuaryPage() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    welcome_message: "",
    privacy: "public" as "public" | "invite_only",
    capacity: 20,
    allow_open_join: false,
    tags: [] as string[],
  })
  const [tagInput, setTagInput] = useState("")

  useEffect(() => {
    const loadUser = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (userData.role !== "creator") {
          router.push("/dashboard")
          return
        }

        setUser(userData)
      } catch (err) {
        console.error("Failed to load user:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadUser()
  }, [router])

  const handleAddTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData((prev) => ({
        ...prev,
        tags: [...prev.tags, tagInput.trim()],
      }))
      setTagInput("")
    }
  }

  const handleRemoveTag = (tag: string) => {
    setFormData((prev) => ({
      ...prev,
      tags: prev.tags.filter((t) => t !== tag),
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const sanctuary = await sanctuariesService.createSanctuary({
        title: formData.title,
        description: formData.description,
        welcome_message: formData.welcome_message,
        privacy: formData.privacy,
        capacity: formData.capacity,
        allow_open_join: formData.allow_open_join,
        tags_write: formData.tags,
      })

      router.push(`/creator/sanctuaries/${sanctuary.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create sanctuary")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="mb-8">
          <Button asChild variant="outline" className="mb-4 bg-transparent">
            <Link href="/creator">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creator Studio
            </Link>
          </Button>
          <h1 className="text-4xl font-bold text-foreground mb-2">Create New Sanctuary</h1>
          <p className="text-muted-foreground">Build a community around your sacred practices</p>
        </div>

        <Card className="bg-card border-border">
          <CardHeader>
            <CardTitle className="text-foreground">Sanctuary Details</CardTitle>
            <CardDescription>Set up your sanctuary with basic information</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Sanctuary Title *</label>
                <Input
                  placeholder="e.g., Luminous Roots Circle"
                  value={formData.title}
                  onChange={(e) => setFormData((prev) => ({ ...prev, title: e.target.value }))}
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Description</label>
                <Textarea
                  placeholder="Describe your sanctuary and what members can expect..."
                  value={formData.description}
                  onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                  className="min-h-24"
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Welcome Message</label>
                <Textarea
                  placeholder="A message to greet new members..."
                  value={formData.welcome_message}
                  onChange={(e) => setFormData((prev) => ({ ...prev, welcome_message: e.target.value }))}
                  className="min-h-20"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Privacy</label>
                  <select
                    value={formData.privacy}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, privacy: e.target.value as "public" | "invite_only" }))
                    }
                    className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
                  >
                    <option value="public">Public</option>
                    <option value="invite_only">Invite Only</option>
                  </select>
                </div>

                <div>
                  <label className="text-sm font-medium mb-2 block">Capacity</label>
                  <Input
                    type="number"
                    min="1"
                    value={formData.capacity}
                    onChange={(e) => setFormData((prev) => ({ ...prev, capacity: Number.parseInt(e.target.value) }))}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="open_join"
                  checked={formData.allow_open_join}
                  onChange={(e) => setFormData((prev) => ({ ...prev, allow_open_join: e.target.checked }))}
                  className="w-4 h-4"
                />
                <label htmlFor="open_join" className="text-sm font-medium cursor-pointer">
                  Allow open join (members can join without approval)
                </label>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Practice Types (Tags)</label>
                <div className="flex gap-2 mb-2">
                  <Input
                    placeholder="Add a tag..."
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyPress={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
                  />
                  <Button type="button" variant="outline" onClick={handleAddTag}>
                    <Plus className="w-4 h-4" />
                  </Button>
                </div>
                {formData.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {formData.tags.map((tag) => (
                      <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                        {tag}
                        <button
                          type="button"
                          onClick={() => handleRemoveTag(tag)}
                          className="ml-1 hover:text-destructive"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {error && <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">{error}</div>}

              <div className="flex gap-2 pt-4">
                <Button type="submit" disabled={submitting} className="flex-1">
                  {submitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                  Create Sanctuary
                </Button>
                <Button type="button" variant="outline" asChild>
                  <Link href="/creator">Cancel</Link>
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
