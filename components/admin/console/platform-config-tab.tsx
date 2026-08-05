"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowRight, Settings2 } from "lucide-react"
import type { StewardTab } from "./tabs"

// Deferred, backend-blocked. There is no settings model: every platform knob is
// an environment variable read through django.conf.settings. Rendering a fake
// editor would be worse than saying so, so this names what it will hold and
// points at the one config surface that actually exists.

export function PlatformConfigTab({ onNavigate }: { onNavigate: (tab: StewardTab) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Settings2 className="h-5 w-5 text-primary" />
          Platform Configuration
        </CardTitle>
        <CardDescription>Not available yet — there is nothing to edit safely.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Every platform knob is currently an environment variable — royalty shadow mode, the idle-member pool
          fallback, plan prices, Stripe keys and throttle rates all live in deployment configuration, not in a
          database anyone can edit through an API.
        </p>

        <div>
          <p className="mb-2 text-sm font-medium text-foreground">What this tab needs before it can ship</p>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>A settings model for the runtime-changeable subset of keys.</li>
            <li>An explicit allow-list — secrets and webhook keys must never become editable over an API.</li>
            <li>Steward-gated read/write endpoints with per-key validation.</li>
            <li>A change log written into The Archive as a fifth source.</li>
          </ul>
        </div>

        <div className="rounded-lg border border-border p-4">
          <p className="text-sm text-foreground">
            The one configuration surface that exists today is the resonance model.
          </p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => onNavigate("resonance")}>
            Resonance Configuration
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
