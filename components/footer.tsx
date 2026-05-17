"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"

export function Footer() {
  const pathname = usePathname()

  // Don't show footer on landing page (it has its own), consent page, privacy, terms, or Gateway Quiz
  if (
    pathname === "/" ||
    pathname === "/consent" ||
    pathname === "/privacy" ||
    pathname === "/terms" ||
    pathname?.startsWith("/gateway-quiz")
  ) {
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
            <Link
              href="/privacy"
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Terms of Service
            </Link>
            <a
              href="mailto:support@evonaire.ai"
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
