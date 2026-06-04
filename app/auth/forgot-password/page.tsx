"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authService } from "@/lib/auth"
import { Loader2, ArrowLeft, Mail } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await authService.forgotPassword(email)
    } catch {
      // Silently ignore errors — always show the generic success message
      // per spec, to prevent email enumeration
    } finally {
      setLoading(false)
      setSubmitted(true)
    }
  }

  return (
    <div className="min-h-screen bg-dark-navy flex flex-col">
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
            <h1 className="text-3xl font-serif text-cream mb-2 tracking-wide">Reset Password</h1>
            <p className="text-cream/50 text-sm">
              {submitted
                ? "Check your inbox for a reset link"
                : "Enter your email and we'll send you a reset link"}
            </p>
          </div>

          <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
            {submitted ? (
              <div className="space-y-6">
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center">
                    <Mail className="w-6 h-6 text-gold" />
                  </div>
                  <p className="text-cream/70 text-sm text-center leading-relaxed">
                    If an account with that email exists, a password reset link has been sent. Please
                    check your inbox and spam folder.
                  </p>
                </div>
                <Link
                  href="/auth/login"
                  className="w-full h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.25)]"
                >
                  Back to Sign In
                </Link>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {error && (
                  <Alert variant="destructive" className="bg-red-900/30 border-red-500/40 text-red-300">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                <div className="space-y-2">
                  <label htmlFor="email" className="text-cream/70 text-sm font-medium">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="you@example.com"
                    className="w-full bg-dark-navy border border-gold/20 rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.25)] mt-2"
                >
                  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                  Send Reset Link
                </button>
              </form>
            )}
          </div>

          {!submitted && (
            <p className="text-center text-cream/40 text-sm mt-6">
              <Link
                href="/auth/login"
                className="inline-flex items-center gap-1 text-gold/70 hover:text-gold transition-colors"
              >
                <ArrowLeft className="w-3 h-3" />
                Back to Sign In
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  )
}
