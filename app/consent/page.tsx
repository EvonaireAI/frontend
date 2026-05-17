"use client"

import { useEffect, useState, useRef } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { useAuth } from "@/lib/auth-context"
import { gatewayQuizService } from "@/lib/gateway-quiz"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Loader2, CheckCircle2, ScrollText } from "lucide-react"
import { toast } from "sonner"

const PRIVACY_POLICY_URL = "https://docs.google.com/document/d/e/2PACX-1vSJTVzLVd_GRZmOIkzFr6QFEICiLejBTcomzkDtDvhHFetBQ3mEDZNGnJoWQfJSgbGbqzTCuN2e-Thl/pub?embedded=true"
const TERMS_OF_SERVICE_URL = "https://docs.google.com/document/d/e/2PACX-1vQkObcMenNGYsN3sGYBqb0aQYFRbaTj2u12AKmOF7wxX-n_IC9VDZ-sUZWGMYmrw0K6b-QP4qcYoZUo/pub?embedded=true"

export default function ConsentPage() {
  const { user, loading, consentsAccepted, acceptConsent } = useAuth()
  const router = useRouter()
  
  const [privacyScrolled, setPrivacyScrolled] = useState(false)
  const [termsScrolled, setTermsScrolled] = useState(false)
  const [privacyAccepted, setPrivacyAccepted] = useState(false)
  const [termsAccepted, setTermsAccepted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeDoc, setActiveDoc] = useState<"privacy" | "terms">("privacy")
  
  const privacyScrollRef = useRef<HTMLDivElement>(null)
  const termsScrollRef = useRef<HTMLDivElement>(null)

  // Redirect if already consented — the GatewayQuizGuard will forward
  // unfinished quiz takers from /dashboard onward.
  useEffect(() => {
    if (!loading && consentsAccepted) {
      router.push("/dashboard")
    }
  }, [loading, consentsAccepted, router])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login")
    }
  }, [loading, user, router])

  const handleScroll = (type: "privacy" | "terms") => {
    const ref = type === "privacy" ? privacyScrollRef.current : termsScrollRef.current
    if (!ref) return

    const { scrollTop, scrollHeight, clientHeight } = ref
    const isAtBottom = scrollTop + clientHeight >= scrollHeight - 20

    if (isAtBottom) {
      if (type === "privacy") {
        setPrivacyScrolled(true)
      } else {
        setTermsScrolled(true)
      }
    }
  }

  const handleSubmit = async () => {
    if (!privacyAccepted || !termsAccepted) {
      toast.error("Please accept both documents to continue")
      return
    }

    setSubmitting(true)
    try {
      await acceptConsent(true, true)
      toast.success("Welcome to Evonaire!")
      // Send them to the Gateway Quiz next if it hasn't been completed.
      try {
        const quizStatus = await gatewayQuizService.getStatus()
        if (quizStatus.status !== "completed") {
          router.push("/gateway-quiz")
          return
        }
      } catch {
        // Fall through to the dashboard; the guard will catch any gap.
      }
      router.push("/dashboard")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save consent")
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dark-navy">
        <Loader2 className="h-8 w-8 animate-spin text-gold" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  return (
    <div className="min-h-screen bg-dark-navy flex flex-col">
      {/* Header */}
      <header className="p-6 border-b border-gold/10">
        <Link href="/" className="inline-flex items-center gap-3 group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Evonaire"
            width={44}
            height={44}
            className="drop-shadow-[0_0_12px_rgba(217,181,116,0.4)]"
          />
          <span className="text-cream font-serif text-lg tracking-wide">Evonaire</span>
        </Link>
      </header>

      <main className="flex-1 container mx-auto px-4 py-8 max-w-4xl">
        {/* Title Section */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gold/10 mb-4">
            <ScrollText className="w-8 h-8 text-gold" />
          </div>
          <h1 className="text-3xl font-serif text-cream mb-3">Welcome, {user.first_name}</h1>
          <p className="text-cream/60 max-w-md mx-auto">
            Before you begin your journey with Evonaire, please review and accept our Privacy Policy and Terms of Service.
          </p>
        </div>

        {/* Document Tabs */}
        <div className="bg-[#141f2a] border border-gold/20 rounded-2xl overflow-hidden shadow-xl">
          <div className="flex border-b border-gold/10">
            <button
              onClick={() => setActiveDoc("privacy")}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeDoc === "privacy"
                  ? "bg-gold/10 text-gold border-b-2 border-gold"
                  : "text-cream/60 hover:text-cream hover:bg-gold/5"
              }`}
            >
              Privacy Policy
              {privacyScrolled && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </button>
            <button
              onClick={() => setActiveDoc("terms")}
              className={`flex-1 py-4 px-6 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                activeDoc === "terms"
                  ? "bg-gold/10 text-gold border-b-2 border-gold"
                  : "text-cream/60 hover:text-cream hover:bg-gold/5"
              }`}
            >
              Terms of Service
              {termsScrolled && <CheckCircle2 className="w-4 h-4 text-green-500" />}
            </button>
          </div>

          {/* Privacy Policy Document */}
          <div className={activeDoc === "privacy" ? "block" : "hidden"}>
            <div
              ref={privacyScrollRef}
              onScroll={() => handleScroll("privacy")}
              className="h-[400px] overflow-y-auto bg-white"
            >
              <iframe
                src={PRIVACY_POLICY_URL}
                className="w-full h-[800px] border-0"
                title="Privacy Policy"
              />
            </div>
            {!privacyScrolled && (
              <div className="px-6 py-3 bg-gold/5 border-t border-gold/10">
                <p className="text-cream/50 text-sm text-center">
                  Please scroll to the bottom of the document to enable the checkbox
                </p>
              </div>
            )}
            <div className="p-6 border-t border-gold/10">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="privacy-checkbox"
                  checked={privacyAccepted}
                  onCheckedChange={(checked) => setPrivacyAccepted(checked === true)}
                  disabled={!privacyScrolled}
                  className="mt-0.5 border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                />
                <label
                  htmlFor="privacy-checkbox"
                  className={`text-sm cursor-pointer ${
                    privacyScrolled ? "text-cream" : "text-cream/40"
                  }`}
                >
                  I have read and accept the Privacy Policy
                </label>
              </div>
            </div>
          </div>

          {/* Terms of Service Document */}
          <div className={activeDoc === "terms" ? "block" : "hidden"}>
            <div
              ref={termsScrollRef}
              onScroll={() => handleScroll("terms")}
              className="h-[400px] overflow-y-auto bg-white"
            >
              <iframe
                src={TERMS_OF_SERVICE_URL}
                className="w-full h-[800px] border-0"
                title="Terms of Service"
              />
            </div>
            {!termsScrolled && (
              <div className="px-6 py-3 bg-gold/5 border-t border-gold/10">
                <p className="text-cream/50 text-sm text-center">
                  Please scroll to the bottom of the document to enable the checkbox
                </p>
              </div>
            )}
            <div className="p-6 border-t border-gold/10">
              <div className="flex items-start gap-3">
                <Checkbox
                  id="terms-checkbox"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  disabled={!termsScrolled}
                  className="mt-0.5 border-gold/40 data-[state=checked]:bg-gold data-[state=checked]:border-gold"
                />
                <label
                  htmlFor="terms-checkbox"
                  className={`text-sm cursor-pointer ${
                    termsScrolled ? "text-cream" : "text-cream/40"
                  }`}
                >
                  I have read and accept the Terms of Service
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Summary and Submit */}
        <div className="mt-8 bg-[#141f2a] border border-gold/20 rounded-2xl p-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                {privacyAccepted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-cream/30" />
                )}
                <span className={privacyAccepted ? "text-cream" : "text-cream/50"}>Privacy Policy</span>
              </div>
              <div className="flex items-center gap-2">
                {termsAccepted ? (
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                ) : (
                  <div className="w-5 h-5 rounded-full border-2 border-cream/30" />
                )}
                <span className={termsAccepted ? "text-cream" : "text-cream/50"}>Terms of Service</span>
              </div>
            </div>
            <Button
              onClick={handleSubmit}
              disabled={!privacyAccepted || !termsAccepted || submitting}
              className="w-full sm:w-auto min-w-[180px] bg-gold text-dark-navy hover:bg-gold-muted disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Processing...
                </>
              ) : (
                "Continue to Evonaire"
              )}
            </Button>
          </div>
        </div>
      </main>
    </div>
  )
}
