"use client"

import type React from "react"
import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { authService } from "@/lib/auth"
import { Loader2, Eye, EyeOff } from "lucide-react"

export default function RegisterPage() {
  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    email: "",
    password: "",
    role: "member" as "member" | "creator" | "moderator",
    reason: "",
  })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState("")
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setSuccess("")
    setLoading(true)
    try {
      const submitData = { ...formData }
      if (formData.role === "member") delete submitData.reason
      await authService.register(submitData)
      setSuccess("Registration successful! Please check your email for an activation link.")
      setTimeout(() => router.push("/auth/login"), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed")
    } finally {
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
  }

  const inputClass =
    "w-full bg-dark-navy border border-gold/20 rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all"

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
            <h1 className="text-3xl font-serif text-cream mb-2 tracking-wide">Join Evonaire</h1>
            <p className="text-cream/50 text-sm">Create your account to get started</p>
          </div>

          {/* Card */}
          <div className="bg-[#141f2a] border border-gold/20 rounded-2xl p-8 shadow-[0_8px_40px_rgba(0,0,0,0.4)]">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <Alert variant="destructive" className="bg-red-900/30 border-red-500/40 text-red-300">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              {success && (
                <Alert className="bg-green-900/30 border-green-500/40 text-green-300">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="first_name" className="text-cream/70 text-sm font-medium">
                    First Name
                  </label>
                  <input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => handleInputChange("first_name", e.target.value)}
                    required
                    placeholder="Jane"
                    className={inputClass}
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="last_name" className="text-cream/70 text-sm font-medium">
                    Last Name
                  </label>
                  <input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => handleInputChange("last_name", e.target.value)}
                    required
                    placeholder="Doe"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="email" className="text-cream/70 text-sm font-medium">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange("email", e.target.value)}
                  required
                  placeholder="you@example.com"
                  className={inputClass}
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
                    value={formData.password}
                    onChange={(e) => handleInputChange("password", e.target.value)}
                    required
                    placeholder="Choose a strong password"
                    className={`${inputClass} pr-12`}
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

              <div className="space-y-2">
                <label htmlFor="role" className="text-cream/70 text-sm font-medium">
                  Role
                </label>
                <Select value={formData.role} onValueChange={(v) => handleInputChange("role", v)}>
                  <SelectTrigger className="bg-dark-navy border-gold/20 text-cream rounded-xl h-12 focus:ring-gold/30 focus:border-gold/60">
                    <SelectValue placeholder="Select your role" />
                  </SelectTrigger>
                  <SelectContent className="bg-[#141f2a] border-gold/20 text-cream">
                    <SelectItem value="member" className="focus:bg-gold/10 focus:text-cream">Member</SelectItem>
                    <SelectItem value="creator" className="focus:bg-gold/10 focus:text-cream">Creator</SelectItem>
                    <SelectItem value="moderator" className="focus:bg-gold/10 focus:text-cream">Moderator</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {(formData.role === "creator" || formData.role === "moderator") && (
                <div className="space-y-2">
                  <label htmlFor="reason" className="text-cream/70 text-sm font-medium">
                    Reason for {formData.role} role
                  </label>
                  <textarea
                    id="reason"
                    value={formData.reason}
                    onChange={(e) => handleInputChange("reason", e.target.value)}
                    required
                    placeholder={`Please explain why you want to be a ${formData.role}...`}
                    rows={3}
                    className="w-full bg-dark-navy border border-gold/20 rounded-xl px-4 py-3 text-cream placeholder:text-cream/30 text-sm focus:outline-none focus:border-gold/60 focus:ring-1 focus:ring-gold/30 transition-all resize-none"
                  />
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full h-12 rounded-xl bg-gold text-dark-navy font-semibold text-sm hover:bg-gold-muted transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(217,181,116,0.25)] mt-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Account
              </button>
            </form>
          </div>

          <p className="text-center text-cream/40 text-sm mt-6">
            Already have an account?{" "}
            <Link href="/auth/login" className="text-gold hover:text-gold-muted transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
