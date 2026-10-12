"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Loader2 } from "lucide-react"

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (loading) return

    if (!user) {
      router.push("/auth/login")
      return
    }

    switch (user.role) {
      case "creator":
        router.push("/creator")
        break
      case "member":
        router.push("/member")
        break
      // `superadmin` lands on the Steward Console too — the backend admits it
      // everywhere `admin` is admitted.
      case "admin":
      case "superadmin":
        router.push("/steward")
        break
      case "moderator":
        router.push("/moderate")
        break
    }
  }, [user, loading, router])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  )
}
