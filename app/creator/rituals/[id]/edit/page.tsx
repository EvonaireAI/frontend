"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authService, type User, type Ritual } from "@/lib/auth"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import Link from "next/link"

export default function EditRitualPage() {
  const [user, setUser] = useState<User | null>(null)
  const [ritual, setRitual] = useState<Ritual | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [careLevel, setCareLevel] = useState<"level1" | "level2" | "level3">("level1")
  const [culturalDeclaration, setCulturalDeclaration] = useState("")
  const [tags, setTags] = useState<string[]>([])
  const [newTag, setNewTag] = useState("")

  const router = useRouter()
  const params = useParams()
  const ritualId = Number.parseInt(params.id as string)

  useEffect(() => {
    const loadData = async () => {
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

        const rituals = await authService.getMyRituals()
        const found = rituals.find((r) => r.id === ritualId)

        if (!found) {
          setError("Ritual not found or you do not have permission to edit it.")
          setLoading(false)
          return
        }

        setRitual(found)
        setTitle(found.title)
        setDescription(found.description)
        setCareLevel(found.care_level)
        setCulturalDeclaration(found.cultural_declaration || "")
        setTags(found.tags.map((t) => (typeof t === "string" ? t : t.name)))
      } catch (err) {
        console.error("Failed to load ritual:", err)
        setError("Failed to load ritual data.")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router, ritualId])

  const addTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()])
      setNewTag("")
    }
  }

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((tag) => tag !== tagToRemove))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSuccess(false)
    setSaving(true)

    try {
      await authService.updateRitual(ritualId, {
        title,
        description,
        care_level: careLevel,
        cultural_declaration: culturalDeclaration,
        tags,
      })
      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update ritual")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (error && !ritual) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-8 max-w-2xl">
          <Button asChild variant="outline" className="mb-4 bg-transparent">
            <Link href="/creator">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Creator Studio
            </Link>
          </Button>
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center gap-4 mb-8">
          <Button asChild variant="outline" className="bg-transparent">
            <Link href="/creator">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-foreground">Edit Ritual</h1>
            <p className="text-muted-foreground">Update your sacred practice details</p>
          </div>
        </div>

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50 text-green-800">
            <AlertDescription>Ritual updated successfully.</AlertDescription>
          </Alert>
        )}

        {error && ritual && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle className="text-foreground">Ritual Details</CardTitle>
              <CardDescription>
                Update the information for your sacred practice.
                {ritual?.status === "approved" && " Note: Changes to approved rituals may trigger re-review."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="title">Title</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ritual title..."
                  required
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the purpose and practice..."
                  rows={4}
                  required
                />
              </div>

              <div>
                <Label htmlFor="care_level">Care Level</Label>
                <Select
                  value={careLevel}
                  onValueChange={(value: "level1" | "level2" | "level3") => setCareLevel(value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="level1">Level 1 - Gentle</SelectItem>
                    <SelectItem value="level2">Level 2 - Moderate</SelectItem>
                    <SelectItem value="level3">Level 3 - Intensive</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="tags">Tags</Label>
                <div className="flex gap-2 mb-2">
                  <Input
                    id="tags"
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add a tag..."
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault()
                        addTag()
                      }
                    }}
                  />
                  <Button type="button" onClick={addTag} variant="outline" className="bg-transparent">
                    Add
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {tags.map((tag) => (
                    <Badge key={tag} variant="secondary" className="cursor-pointer" onClick={() => removeTag(tag)}>
                      {tag} x
                    </Badge>
                  ))}
                </div>
              </div>

              <div>
                <Label htmlFor="cultural_declaration">Cultural Declaration</Label>
                <Textarea
                  id="cultural_declaration"
                  value={culturalDeclaration}
                  onChange={(e) => setCulturalDeclaration(e.target.value)}
                  placeholder="Acknowledge any cultural traditions..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-4">
            <Button asChild type="button" variant="outline" className="flex-1 bg-transparent">
              <Link href="/creator">Cancel</Link>
            </Button>
            <Button type="submit" disabled={saving || !title || !description} className="flex-1">
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Changes
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
