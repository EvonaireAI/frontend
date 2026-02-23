"use client"

import { useEffect, useState } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { authService } from "@/lib/auth"
import { CheckCircle, XCircle, Loader2 } from "lucide-react"

export default function ActivatePage() {
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading")
  const [message, setMessage] = useState("")
  const searchParams = useSearchParams()
  const router = useRouter()

  useEffect(() => {
    const code = searchParams.get("code")

    if (!code) {
      setStatus("error")
      setMessage("No activation code provided")
      return
    }

    const activateAccount = async () => {
      try {
        const result = await authService.activate(code)
        setStatus("success")
        setMessage(result.message)

        // Redirect to login after 3 seconds
        setTimeout(() => {
          router.push("/auth/login")
        }, 3000)
      } catch (err) {
        setStatus("error")
        setMessage(err instanceof Error ? err.message : "Activation failed")
      }
    }

    activateAccount()
  }, [searchParams, router])

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md text-center bg-card border-border">
        <CardHeader>
          <CardTitle className="text-2xl font-bold text-foreground">Account Activation</CardTitle>
          <CardDescription>Activating your Evonaire account</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {status === "loading" && (
            <div className="flex flex-col items-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
              <p className="text-muted-foreground">Activating your account...</p>
            </div>
          )}

          {status === "success" && (
            <div className="flex flex-col items-center space-y-4">
              <CheckCircle className="h-12 w-12 text-primary" />
              <Alert>
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <p className="text-sm text-muted-foreground">Redirecting to login page...</p>
            </div>
          )}

          {status === "error" && (
            <div className="flex flex-col items-center space-y-4">
              <XCircle className="h-12 w-12 text-destructive" />
              <Alert variant="destructive">
                <AlertDescription>{message}</AlertDescription>
              </Alert>
              <div className="space-y-2">
                <Button asChild className="bg-primary text-primary-foreground hover:bg-gold-muted">
                  <Link href="/auth/login">Go to Login</Link>
                </Button>
                <Button asChild variant="outline" className="bg-transparent border-border text-foreground hover:bg-secondary">
                  <Link href="/auth/resend-activation">Resend Activation</Link>
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
