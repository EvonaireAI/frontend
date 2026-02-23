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
import { useAuth } from "@/lib/auth-context"
import { Loader2, ArrowLeft, Upload } from "lucide-react"
import Link from "next/link"

export default function ProfilePage() {
  const { user, loading: authLoading, refreshUser } = useAuth()
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
  })
  const [profilePicture, setProfilePicture] = useState<File | null>(null)
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
      setMessage("Profile updated successfully!")
      setProfilePicture(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update profile")
    } finally {
      setSaving(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setProfilePicture(file)
    }
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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="flex items-center space-x-4 mb-8">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Profile Settings</h1>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your profile information and settings</CardDescription>
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
                <AvatarImage
                  src={user.profile_picture || "/placeholder.svg"}
                  alt={`${user.first_name} ${user.last_name}`}
                />
                <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
              </Avatar>
                <div>
                  <Label htmlFor="profile_picture" className="cursor-pointer">
                    <div className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-700">
                      <Upload className="w-4 h-4" />
                      <span>Change profile picture</span>
                    </div>
                  </Label>
                  <Input
                    id="profile_picture"
                    type="file"
                    accept="image/*"
                    onChange={handleFileChange}
                    className="hidden"
                  />
                  {profilePicture && <p className="text-xs text-gray-600 mt-1">Selected: {profilePicture.name}</p>}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, first_name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, last_name: e.target.value }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={user.email} disabled className="bg-gray-50 dark:bg-gray-800" />
                <p className="text-xs text-gray-600 dark:text-gray-400">
                  Email cannot be changed. Contact support if needed.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <Input value={user.role} disabled className="bg-gray-50 dark:bg-gray-800 capitalize" />
                <p className="text-xs text-gray-600 dark:text-gray-400">Role changes require admin approval.</p>
              </div>

              <div className="space-y-2">
                <Label>Member Since</Label>
                <Input
                  value={new Date(user.date_joined).toLocaleDateString()}
                  disabled
                  className="bg-gray-50 dark:bg-gray-800"
                />
              </div>

              <Button type="submit" disabled={saving} className="w-full">
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
