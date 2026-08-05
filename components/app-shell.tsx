"use client"

import type { ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AuthProvider } from "@/lib/auth-context"
import { EntitlementsProvider } from "@/lib/entitlements-context"
import { GatewayProvider } from "@/lib/gateway-context"
import { UpgradeModalHost } from "@/components/payments/upgrade-modal"
import { Navigation } from "@/components/navigation"
import { ConsentGuard } from "@/components/consent-guard"
import { GatewayNudge } from "@/components/gateway/gateway-nudge"
import { GatewayCompletionModalHost } from "@/components/gateway/gateway-completion-modal"
import { Footer } from "@/components/footer"
import { GaiaChatWidget } from "@/components/gaia/chat-widget"
import { Toaster } from "@/components/ui/sonner"

/**
 * Routes that render on their own, outside the signed-in application shell.
 *
 * `/verify/<claim_token>` is the one that matters (Session 13): it is a public
 * license verification page shared with distribution platforms and lawyers, and
 * it must not depend on — or reveal — a session. Rendering it inside the shell
 * would mount `AuthProvider`, which reads the stored token and fetches the
 * profile on mount, and `ConsentGuard`, which can redirect. Neither belongs
 * anywhere near a page whose whole promise is that it verifies without an
 * account and leaks nothing about the people involved.
 *
 * So the providers are not merely inert here, they are never mounted.
 */
const STANDALONE_ROUTE_PREFIXES = ["/verify"]

function isStandalone(pathname: string | null): boolean {
  if (!pathname) return false
  return STANDALONE_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  )
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (isStandalone(pathname)) {
    return <>{children}</>
  }

  return (
    <AuthProvider>
      <EntitlementsProvider>
        <GatewayProvider>
          <ConsentGuard>
            <div className="min-h-screen flex flex-col">
              <Navigation />
              <div className="flex-1">{children}</div>
              <Footer />
            </div>
            <GaiaChatWidget />
            <UpgradeModalHost />
            <GatewayCompletionModalHost />
            <GatewayNudge />
            <Toaster richColors position="top-right" />
          </ConsentGuard>
        </GatewayProvider>
      </EntitlementsProvider>
    </AuthProvider>
  )
}
