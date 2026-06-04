"use client"


import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useAuth } from "@/lib/auth-context"
import { gatewayQuizService } from "@/lib/gateway-quiz"
import { Loader2, Eye, EyeOff } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const { login } = useAuth()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      const loginResponse = await login(email, password)
      // Consent must come first; the quiz follows once consent is recorded.
      if (!loginResponse.consents_accepted) {
        router.push("/consent")
        return
      }
      try {
        const quizStatus = await gatewayQuizService.getStatus()
        if (quizStatus.status !== "completed") {
          router.push("/gateway-quiz")
          return
        }
      } catch {
        // If status fetch fails, fall through to dashboard — the
        // GatewayQuizGuard will redirect once the auth context refreshes.
      }
      router.push("/dashboard")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Login failed")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-dark-navy flex flex-col">
      {/* Top-left logo — links back to home */}
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

      {/* Centered form */}
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-10">
            <h1 className="text-3xl font-serif text-cream mb-2 tracking-wide">Welcome Back</h1>
            <p className="text-cream/50 text-sm">Sign in to your Evonaire account</p>
          </div>

          {/* Card */}
          <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/40 text-red-300">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-2">
                <label htmlFor="email" className="text-cream/70 text-sm font-medium">
                  Email
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

              <div className="space-y-2">
                <label htmlFor="password" className="text-cream/70 text-sm font-medium">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="Enter your password"
                    className="w-full bg-dark-navy border border-gold/20 rounded-xl px-4 py-3 pr-12 text-cream placeholder:text-cream/30 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-cream/40 hover:text-cream/70 transition-colors"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="flex justify-between">
                <Link
                  href="/auth/forgot-password"
                  className="text-xs text-gold/70 hover:text-gold transition-colors"
                >
                  Forgot password?
                </Link>
                <Link
                  href="/auth/resend-activation"
                  className="text-xs text-gold/70 hover:text-gold transition-colors"
                >
                  Resend activation email
                </Link>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.25)] mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign In
              </button>
            </form>
          </div>

          <p className="text-center text-cream/40 text-sm mt-6">
            {"Don't have an account? "}
            <Link href="/auth/register" className="text-gold hover:text-gold-muted transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
