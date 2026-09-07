"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { authService, type User } from "@/lib/auth"
import { isSteward } from "@/lib/roles"
import { CreatorRtsDetailView } from "@/components/rts/creator-rts-detail-view"

export default function StewardCreatorRTSDetail() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const params = useParams()
  const userId = Number.parseInt(params.userId as string)

  useEffect(() => {
    const loadData = async () => {
      try {
        if (!authService.isAuthenticated()) {
          router.push("/auth/login")
          return
        }

        const userData = await authService.getProfile()
        if (!isSteward(userData.role)) {
          router.push("/dashboard")
          return
        }

        setUser(userData)
      } catch (err) {
        console.error("Failed to load data:", err)
        router.push("/auth/login")
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [router])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!user || Number.isNaN(userId)) {
    return null
  }

  return (
    <CreatorRtsDetailView
      userId={userId}
      backHref="/steward?tab=trust-care"
      backLabel="Back to Trust & Care"
    />
  )
}
