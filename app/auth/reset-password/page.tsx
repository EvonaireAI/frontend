"use client"

import type React from "react"
import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { authService } from "@/lib/auth"
import { Loader2, Eye, EyeOff, ArrowLeft } from "lucide-react"
import { toast } from "sonner"

function ResetPasswordForm() {
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const router = useRouter()

  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showNew, setShowNew] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const inputClass =
    "w-full bg-dark-navy border border-gold/20 rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all"

  if (!token) {
    return (
      <div className="space-y-6">
        <Alert className="bg-red-900/30 border-red-500/40 text-red-300">
          <AlertDescription>
            This reset link is invalid or missing a token.
          </AlertDescription>
        </Alert>
        <Link
          href="/auth/forgot-password"
          className="w-full h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.25)]"
        >
          Request a New Link
        </Link>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.")
      return
    }

    setLoading(true)
    try {
      await authService.resetPassword(token, newPassword, confirmPassword)
      toast.success("Password updated — please log in.")
      router.push("/auth/login")
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to reset password"
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="space-y-3">
          <Alert variant="destructive" className="bg-red-900/30 border-red-500/40 text-red-300">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          {(error.includes("invalid") || error.includes("expired")) && (
            <p className="text-sm text-center">
              <Link
                href="/auth/forgot-password"
                className="text-gold/70 hover:text-gold transition-colors underline underline-offset-4"
              >
                Request a new reset link
              </Link>
            </p>
          )}
        </div>
      )}

      <div className="space-y-2">
        <label htmlFor="new_password" className="text-cream/70 text-sm font-medium">
          New Password
        </label>
        <div className="relative">
          <input
            id="new_password"
            type={showNew ? "text" : "password"}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="Enter your new password"
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowNew(!showNew)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream/70 transition-colors"
            aria-label={showNew ? "Hide password" : "Show password"}
          >
            {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="space-y-2">
        <label htmlFor="confirm_password" className="text-cream/70 text-sm font-medium">
          Confirm Password
        </label>
        <div className="relative">
          <input
            id="confirm_password"
            type={showConfirm ? "text" : "password"}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            placeholder="Confirm your new password"
            className={`${inputClass} pr-12`}
          />
          <button
            type="button"
            onClick={() => setShowConfirm(!showConfirm)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream/70 transition-colors"
            aria-label={showConfirm ? "Hide password" : "Show password"}
          >
            {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.25)] mt-2"
      >
        {loading && <Loader2 className="w-4 h-4 animate-spin" />}
        Update Password
      </button>
    </form>
  )
}

export default function ResetPasswordPage() {
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
            <h1 className="text-3xl font-serif text-cream mb-2 tracking-wide">Set New Password</h1>
            <p className="text-cream/50 text-sm">Choose a strong password for your account</p>
          </div>

          <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
            <Suspense
              fallback={
                <div className="flex justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gold" />
                </div>
              }
            >
              <ResetPasswordForm />
            </Suspense>
          </div>

          <p className="text-center text-cream/40 text-sm mt-6">
            <Link
              href="/auth/login"
              className="inline-flex items-center gap-1 text-gold/70 hover:text-gold transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              Back to Sign In
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
