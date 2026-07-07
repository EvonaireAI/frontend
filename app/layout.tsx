import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AuthProvider } from "@/lib/auth-context"
import { EntitlementsProvider } from "@/lib/entitlements-context"
import { UpgradeModalHost } from "@/components/payments/upgrade-modal"
import { Navigation } from "@/components/navigation"
import { ConsentGuard } from "@/components/consent-guard"
import { GatewayQuizGuard } from "@/components/gateway-quiz-guard"
import { Footer } from "@/components/footer"
import { GaiaChatWidget } from "@/components/gaia/chat-widget"
import { Toaster } from "@/components/ui/sonner"
import "./globals.css"

export const metadata: Metadata = {
  title: "Evonaire - Sacred Rituals & Reflections",
  description: "A sanctuary for rituals and reflections, grounded in NeuroPrivacy and somatic protections",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const fontStyle = `
html {
  font-family: ${GeistSans.style.fontFamily};
  --font-sans: ${GeistSans.variable};
  --font-mono: ${GeistMono.variable};
}
  `

  return (
    <html lang="en">
      <head>
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: fontStyle }} />
      </head>
      <body>
        <AuthProvider>
          <EntitlementsProvider>
            <ConsentGuard>
              <GatewayQuizGuard>
                <div className="min-h-screen flex flex-col">
                  <Navigation />
                  <div className="flex-1">{children}</div>
                  <Footer />
                </div>
                <GaiaChatWidget />
                <UpgradeModalHost />
                <Toaster richColors position="top-right" />
              </GatewayQuizGuard>
            </ConsentGuard>
          </EntitlementsProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
