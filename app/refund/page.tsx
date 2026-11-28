"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, FileText } from "lucide-react"
import { tr } from "@/lib/i18n"


export default function RefundPage() {
  return (
    <div className="min-h-screen bg-dark-navy">
      {/* Header */}
      <header className="border-b border-gold/20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.svg" alt={tr("Evonaire")} width={40} height={40} />
              <span className="text-xl font-semibold text-cream">{tr("Evonaire")}</span>
            </Link>
            <Link href="/">
              <Button variant="ghost" className="text-cream/70 hover:text-cream hover:bg-gold/10">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {tr("Back to Home")}
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <Card className="bg-dark-navy/50 border-gold/20 shadow-[0_0_30px_rgba(217,181,116,0.1)]">
          <CardHeader className="text-center pb-8">
            <div className="mx-auto w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mb-4">
              <FileText className="h-8 w-8 text-gold" />
            </div>
            <CardTitle className="text-3xl text-cream font-serif">{tr("Refund Policy")}</CardTitle>
            <p className="text-cream/60 mt-2">{tr("How refunds work for Evonaire memberships and marketplace purchases")}</p>
          </CardHeader>
          <CardContent className="space-y-8 text-cream/80 leading-relaxed">
            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("What this policy covers")}</h2>
              <p>
                {tr("This policy applies to Evonaire membership subscriptions and to one-time purchases made through the Commons marketplace. Payments are processed by our payment provider, which acts as the merchant of record for your purchase.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("Membership subscriptions")}</h2>
              <p>
                {tr("You can cancel a membership at any time from the billing page in your account. Cancellation stops future renewals, and your access continues until the end of the period you have already paid for.")}
              </p>
              <p className="mt-3">
                {tr("If you request a refund within 14 days of a charge, we will refund that charge in full. After 14 days, subscription charges are non-refundable, but you can still cancel at any time to prevent future charges. We do not prorate partial billing periods.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("Marketplace purchases")}</h2>
              <p>
                {tr("Commons marketplace purchases are one-time payments for digital items. If an item is defective, not as described, or was not delivered, contact us within 30 days of purchase and we will make it right, including a refund where appropriate.")}
              </p>
              <p className="mt-3">
                {tr("For other marketplace purchases, contact support within 14 days of the charge and we will review the request. Because marketplace items are digital and delivered instantly, refunds are granted at our discretion once the item has been accessed.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("How to request a refund")}</h2>
              <p>
                {tr("Email support@evonaire.ai or use the contact option in the app. Include the email address on your account and, if you have it, the invoice or order reference. We respond to refund requests within 5 business days.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("How refunds are paid")}</h2>
              <p>
                {tr("Approved refunds are returned to the original payment method through our payment processor. Depending on your bank or card issuer, it can take 5 to 10 business days for the funds to appear.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("Chargebacks")}</h2>
              <p>
                {tr("If you believe a charge is wrong, contact us before filing a dispute. Chargebacks filed without contacting us first may result in account restrictions while the dispute is resolved.")}
              </p>
            </section>

            <section>
              <h2 className="text-xl text-cream font-serif mb-3">{tr("Changes to this policy")}</h2>
              <p>
                {tr("We may update this policy from time to time. The version posted on this page applies to purchases made after the update date.")}
              </p>
            </section>
          </CardContent>
        </Card>

        {/* Footer Navigation */}
        <div className="mt-8 flex flex-col sm:flex-row justify-between items-center gap-4">
          <Link href="/terms">
            <Button variant="outline" className="border-gold/30 text-cream hover:bg-gold/10 hover:border-gold">
              {tr("View Terms of Service")}
            </Button>
          </Link>
          <div className="flex gap-4">
            <a href="mailto:support@evonaire.ai">
              <Button variant="ghost" className="text-cream/70 hover:text-cream hover:bg-gold/10">
                {tr("Contact Support")}
              </Button>
            </a>
            <Link href="/">
              <Button className="bg-gold text-dark-navy hover:bg-gold-muted">
                {tr("Back to Home")}
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </div>
  )
}
