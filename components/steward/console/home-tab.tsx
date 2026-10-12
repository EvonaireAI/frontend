"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Settings, UserCheck, Activity, ArrowRight, ClipboardCheck } from "lucide-react"
import { GLOSSARY } from "@/lib/glossary"

export function StewardHomeTab() {
  const destinations = [
    {
      title: GLOSSARY.stewardRequests,
      description: "Review and approve or reject requests for elevated roles.",
      href: "/steward/requests",
      icon: UserCheck,
    },
    {
      title: "RTS Monitoring",
      description: "View creator scores, alerts, and open a creator's full RTS detail.",
      href: "/steward?tab=trust-care",
      icon: Activity,
    },
    {
      title: "Resonance Configuration",
      description: "Edit RTS signal weights and thresholds.",
      href: "/steward?tab=resonance",
      icon: Settings,
    },
  ]

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {destinations.map(({ title, description, href, icon: Icon }) => (
          <Card key={href}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Icon className="h-5 w-5 text-primary" />
                {title}
              </CardTitle>
              <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild variant="outline" size="sm">
                <Link href={href}>
                  Open
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}
