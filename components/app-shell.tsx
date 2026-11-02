"use client"

import { Fragment, type ReactNode } from "react"
import { usePathname } from "next/navigation"
import { AuthProvider, useAuth } from "@/lib/auth-context"
import { EntitlementsProvider } from "@/lib/entitlements-context"
import { GatewayProvider } from "@/lib/gateway-context"
import { UpgradeModalHost } from "@/components/payments/upgrade-modal"
import { Navigation } from "@/components/navigation"
import { ConsentGuard } from "@/components/consent-guard"
import { GatewayNudge } from "@/components/gateway/gateway-nudge"
import { GatewayCompletionModalHost } from "@/components/gateway/gateway-completion-modal"
import { Footer } from "@/components/footer"
import { GaiaChatWidget } from "@/components/gaia/chat-widget"
import { AccessibilityProvider } from "@/lib/accessibility-context"
import { AccessibilityWidget } from "@/components/accessibility/accessibility-widget"
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

/**
 * Everything below AuthProvider holds per-account state: entitlement and
 * gateway progress, the upgrade and completion modals, the nudge, and the
 * Gaia chat thread. React preserves that state across an account switch
 * because the component types at every position stay the same, so the new
 * account would inherit whatever the previous account left open.
 *
 * Keying this boundary on the authenticated user id forces a real remount
 * when the account changes. A profile refresh for the same account keeps the
 * same id and remounts nothing.
 */
function AccountScoped({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  return <Fragment key={user?.id ?? "anonymous"}>{children}</Fragment>
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname()

  if (isStandalone(pathname)) {
    return (
      <AccessibilityProvider>
        {children}
        <AccessibilityWidget />
      </AccessibilityProvider>
    )
  }

  return (
    <AccessibilityProvider>
      <AuthProvider>
        <AccountScoped>
          <EntitlementsProvider>
            <GatewayProvider>
              <ConsentGuard>
                <div className="min-h-screen flex flex-col">
                  <Navigation />
                  <div className="flex-1">{children}</div>
                  <Footer />
                </div>
                <GaiaChatWidget />
                <AccessibilityWidget />
                <UpgradeModalHost />
                <GatewayCompletionModalHost />
                <GatewayNudge />
                <Toaster richColors position="top-right" />
              </ConsentGuard>
            </GatewayProvider>
          </EntitlementsProvider>
        </AccountScoped>
      </AuthProvider>
    </AccessibilityProvider>
  )
}
