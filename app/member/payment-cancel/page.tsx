"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { AlertCircle } from "lucide-react"
import Link from "next/link"

export default function PaymentCancelPage() {
  const router = useRouter()

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
            <AlertCircle className="h-16 w-16 text-gold-muted" />
          </div>
          <CardTitle className="text-foreground">Payment Cancelled</CardTitle>
          <CardDescription>Your subscription request was not completed</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-secondary p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">
              No charges have been made to your account. Feel free to try again whenever you're ready.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-4">
            <Button asChild variant="default" className="w-full bg-primary text-primary-foreground hover:bg-gold-muted">
              <Link href="/member">Return to Dashboard</Link>
            </Button>
            <Button asChild variant="outline" className="w-full bg-transparent border-border text-foreground hover:bg-secondary">
              <Link href="/member?retry-premium=true">Try Again</Link>
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">Redirecting automatically in 5 seconds...</p>
        </CardContent>
      </Card>
    </div>
  )
}
