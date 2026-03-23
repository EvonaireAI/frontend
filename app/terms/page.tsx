"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, FileText } from "lucide-react"

const TERMS_OF_SERVICE_EMBED_URL = "https://docs.google.com/document/d/e/2PACX-1vQkObcMenNGYsN3sGYBqb0aQYFRbaTj2u12AKmOF7wxX-n_IC9VDZ-sUZWGMYmrw0K6b-QP4qcYoZUo/pub?embedded=true"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-dark-navy">
      {/* Header */}
      <header className="border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt="Evonaire" width={40} height={40} />
              <span className="text-xl font-semibold text-cream">Evonaire</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="text-cream/70 hover:text-cream hover:bg-gold/10">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-dark-navy/50 border-gold/20 shadow-[0_0_30px_rgba(217,181,116,0.1)]">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-gold" />
            </div>
            <CardTitle className="text-3xl text-cream font-serif">Terms of Service</CardTitle>
            <p className="text-cream/60 mt-2">Please review our terms and conditions for using Evonaire</p>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-gold/20 overflow-hidden bg-white">
              <iframe
                src={TERMS_OF_SERVICE_EMBED_URL}
                className="w-full border-0"
                style={{ height: "calc(100vh - 350px)", minHeight: "600px" }}
                title="Evonaire Terms of Service"
                loading="lazy"
                sandbox="allow-same-origin allow-scripts allow-popups allow-forms"
              />
            </div>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/privacy">
            <Button variant="outline" className="border-gold/30 text-cream hover:bg-gold/10 hover:border-gold">
              View Privacy Policy
            </Button>
          </Link>
          <div className="flex gap-4">
            <a href="mailto:support@evonaire.ai">
              <Button variant="ghost" className="text-cream/70 hover:text-cream hover:bg-gold/10">
                Contact Support
              </Button>
            </a>
            <Link href="/">
              <Button className="bg-gold text-dark-navy hover:bg-gold-muted">
                Back to Home
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
