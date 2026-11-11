"use client"

import type React from "react"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authService } from "@/lib/auth"
import { avatarFileError } from "@/lib/image-upload"
import { useAuth } from "@/lib/auth-context"
import { roleDashboardLabel } from "@/lib/roles"
import { Loader2, ArrowLeft, Upload } from "lucide-react"
import Link from "next/link"
import { GaiaInfoTip } from "@/components/gaia/info-tip"
import { fmtLocale, tr, trNode } from "@/lib/i18n"


export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
  })
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const router = useRouter()

  useEffect(() => {
    if (authLoading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
    })
  }, [authLoading, user, router])

  // Build a local preview URL for the pending file and clean it up afterwards.
  useEffect(() => {
    if (!profilePicture) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(profilePicture)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [profilePicture])

  const initials = useMemo(() => {
    if (!user) return "U"
    const first = user.first_name?.trim()?.[0] || ""
    const last = user.last_name?.trim()?.[0] || ""
    const value = `${first}${last}`.toUpperCase()
    return value || "U"
  }, [user])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    setSaving(true)

    try {
      const formDataToSend = new FormData()
      formDataToSend.append("first_name", formData.first_name)
      formDataToSend.append("last_name", formData.last_name)

      if (profilePicture) {
        formDataToSend.append("profile_picture", profilePicture)
      }

      const updatedUser = await authService.updateProfile(formDataToSend)
      await refreshUser()
      setFormData({
        first_name: updatedUser.first_name || "",
        last_name: updatedUser.last_name || "",
      })
      setMessage(tr("Profile updated successfully!"))
      setProfilePicture(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : tr("Failed to update profile"))
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const problem = avatarFileError(file)
    if (problem) {
      setError(problem)
      setProfilePicture(null)
      // Let the same file be chosen again after a rejection.
      e.target.value = ""
      return
    }

    setError("")
    setProfilePicture(file)
  }

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center space-x-4 mb-8">
          <Button asChild className="cursor-pointer">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              {tr("Back to Dashboard")}
            </Link>
          </Button>
          <h1 className="text-3xl font-serif text-cream tracking-wide inline-flex items-center gap-2">
            {tr("Profile Settings")}
            <GaiaInfoTip infoKey="profile.picture" ariaLabel={tr("About profile settings")} side="bottom" />
          </h1>
        </div>

        <Card className="bg-[#141f2a] border-gold/20 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
          <CardHeader>
            <CardTitle>{tr("Personal Information")}</CardTitle>
            <CardDescription>{tr("Update your profile information and settings")}</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {message && (
                <Alert>
                  <AlertDescription>{message}</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center space-x-6">
                <Avatar className="w-24 h-24">
                  {previewUrl || user.profile_picture ? (
                    <AvatarImage
                      src={previewUrl || user.profile_picture || undefined}
                      alt={`${user.first_name} ${user.last_name}`}
                    />
                  ) : null}
                  <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
                </Avatar>
                <div>
                  {/*
                    Real, focusable file input activated by its label. It's kept
                    visually hidden with sr-only positioning (NOT display:none /
                    hidden) because iOS Safari won't trigger a display:none input
                    from a <label htmlFor>. accept="image/*" lets mobile offer
                    the camera + photo library.
                  */}
                  <input
                    id="profile_picture"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="sr-only"
                  />
                  <Label
                    htmlFor="profile_picture"
                    className="inline-flex cursor-pointer items-center space-x-2 rounded-md border border-gold/30 px-3 py-2 text-sm text-gold-light hover:bg-gold/10 focus-within:ring-2 focus-within:ring-ring"
                  >
                    <Upload className="w-4 h-4" />
                    <span>{profilePicture ? "Change photo" : "Change profile picture"}</span>
                  </Label>
                  {profilePicture ? (
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-2">
                      {trNode("Selected: {p0} — press Save Changes to upload.", { p0: profilePicture.name })}
                    </p>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      {tr("PNG, JPEG, WebP, or GIF. Camera or library on mobile.")}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">{tr("First Name")}</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">{tr("Last Name")}</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="divide-y divide-gold/10 rounded-md border border-gold/20 bg-[#0f1820]">
                <div className="px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-cream/50">{tr("Email")}</p>
                  <p className="mt-1 text-sm text-cream">{user.email}</p>
                  <p className="mt-1 text-xs text-cream/40">{tr("Email cannot be changed. Contact support if needed.")}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-cream/50">{tr("Role")}</p>
                  <p className="mt-1 text-sm text-cream">{roleDashboardLabel(user.role)}</p>
                  <p className="mt-1 text-xs text-cream/40">{tr("Role changes require admin approval.")}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs uppercase tracking-wide text-cream/50">{tr("Member Since")}</p>
                  <p className="mt-1 text-sm text-cream">{new Date(user.date_joined).toLocaleDateString(fmtLocale())}</p>
                </div>
              </div>

              <Button type="submit" disabled={saving} className="w-full cursor-pointer">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {tr("Save Changes")}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
