"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { ExternalLink } from "lucide-react"

const PRIVACY_POLICY_URL = "https://docs.google.com/document/d/e/2PACX-1vSJTVzLVd_GRZmOIkzFr6QFEICiLejBTcomzkDtDvhHFetBQ3mEDZNGnJoWQfJSgbGbqzTCuN2e-Thl/pub"
const TERMS_OF_SERVICE_URL = "https://docs.google.com/document/d/e/2PACX-1vQkObcMenNGYsN3sGYBqb0aQYFRbaTj2u12AKmOF7wxX-n_IC9VDZ-sUZWGMYmrw0K6b-QP4qcYoZUo/pub"

export function Footer() {
  const pathname = usePathname()

  // Don't show footer on landing page (it has its own) or consent page
  if (pathname === "/" || pathname === "/consent") {
    return null
  }

  return (
    <footer className="border-t border-border bg-dark-navy/50 py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span>&copy; {new Date().getFullYear()} Evonaire. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-6">
            <a
              href={PRIVACY_POLICY_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Privacy Policy
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href={TERMS_OF_SERVICE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Terms of Service
              <ExternalLink className="w-3 h-3" />
            </a>
            <Link
              href="/contact"
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Contact
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
