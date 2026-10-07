"use client"

import type React from "react"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authService } from "@/lib/auth"
import { Loader2 } from "lucide-react"

export default function ResendActivationPage() {
  const [email, setEmail] = useState("")
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setMessage("")
    setLoading(true)

    try {
      const result = await authService.resendActivation(email)
      setMessage(result.message)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to resend activation")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-navy flex flex-col">
      {/* min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4 */}

      <header className="p-6">
        <Link href="/" className="inline-flex items-center gap-3 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Evonaire"
            width={44}
            height={44}
            className="drop-shadow-[0_0_12px_rgba(217,181,116,0.4)] group-hover:drop-shadow-[0_0_18px_rgba(217,181,116,0.6)] transition-all duration-300"
          />
          <span className="text-cream font-serif text-lg tracking-wide group-hover:text-gold transition-colors duration-300">
            Evonaire
          </span>
        </Link>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
          <div className="text-center mb-10">
            <h1 className="text-3xl font-serif text-cream mb-2 tracking-wide">Resend Activation</h1>
            <p className="text-cream/50 text-sm">Enter your email to receive a new activation link</p>
          </div>

        <Card className="w-full max-w-md justify-center" >
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
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

              <div className="space-y-2">
                <Label htmlFor="email" className="text-cream/70 text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  placeholder="Enter your email address"
                  className="w-full bg-dark-navy border border-gold/20 rounded-md px-4 py-3 text-cream placeholder:text-cream/30 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all focus-visible:ring-1 focus-visible:ring-gold/30 focus-visible:border-gold/60"
                />
              </div>

              <Button type="submit" className="w-full cursor-pointer" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Resend Activation Link
              </Button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Remember your password?{" "}
                <Link href="/auth/login" className="text-blue-600 hover:underline">
                  Sign in
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
        </div>
      </main>




    </div>
  )
}
