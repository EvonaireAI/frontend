"use client"

import { useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckCircle } from "lucide-react"
import Link from "next/link"

export default function PaymentSuccessPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const sessionId = searchParams.get("session_id")

  useEffect(() => {
    // Auto-redirect after 5 seconds if they don't click the button
    const timer = setTimeout(() => {
      router.push("/member")
    }, 5000)

    return () => clearTimeout(timer)
  }, [router])

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full bg-card border-border">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <CheckCircle className="h-16 w-16 text-primary" />
          </div>
          <CardTitle className="text-foreground">Payment Successful!</CardTitle>
          <CardDescription>Thank you for upgrading to premium</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-secondary p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Your premium subscription is now active. You have full access to all premium features.
            </p>
            {sessionId && <p className="text-xs text-muted-foreground mt-2">Session: {sessionId}</p>}
          </div>

          <div className="flex gap-3 pt-4">
            <Button asChild className="flex-1 bg-primary text-primary-foreground hover:bg-gold-muted">
              <Link href="/member">Return to Dashboard</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">Redirecting automatically in 5 seconds...</p>
        </CardContent>
      </Card>
    </div>
  )
}
