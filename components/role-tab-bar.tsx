"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { tr } from "@/lib/i18n"
import { Compass, GraduationCap, Footprints } from "lucide-react"

/**
 * The prototype's bottom tab bar (RoleNavigation): Explore/Dashboard, School,
 * Journey. Mobile-only — the desktop top nav stays the primary navigation.
 * School and Journey land on the closest existing surfaces until dedicated
 * pages exist.
 */
const ROLE_TABS: Record<string, { href: string; label: string; icon: typeof Compass; match: string }[]> = {
  member: [
    { href: "/member", label: "Explore", icon: Compass, match: "/member" },
    { href: "/member/agora", label: "School", icon: GraduationCap, match: "/member/agora" },
    { href: "/member/my-sanctuary", label: "Journey", icon: Footprints, match: "/member/my-sanctuary" },
  ],
  creator: [
    { href: "/creator", label: "Dashboard", icon: Compass, match: "/creator" },
    { href: "/creator/listings", label: "School", icon: GraduationCap, match: "/creator/listings" },
    { href: "/member/my-sanctuary", label: "Journey", icon: Footprints, match: "/member/my-sanctuary" },
  ],
  moderator: [
    { href: "/moderate", label: "Dashboard", icon: Compass, match: "/moderate" },
    { href: "/member/agora", label: "School", icon: GraduationCap, match: "/member/agora" },
    { href: "/member/my-sanctuary", label: "Journey", icon: Footprints, match: "/member/my-sanctuary" },
  ],
  admin: [
    { href: "/steward", label: "Dashboard", icon: Compass, match: "/steward" },
    { href: "/member/agora", label: "School", icon: GraduationCap, match: "/member/agora" },
    { href: "/member/my-sanctuary", label: "Journey", icon: Footprints, match: "/member/my-sanctuary" },
  ],
  superadmin: [
    { href: "/steward", label: "Dashboard", icon: Compass, match: "/steward" },
    { href: "/member/agora", label: "School", icon: GraduationCap, match: "/member/agora" },
    { href: "/member/my-sanctuary", label: "Journey", icon: Footprints, match: "/member/my-sanctuary" },
  ],
}

export function RoleTabBar() {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading || !user?.role) return null
  const tabs = ROLE_TABS[user.role]
  if (!tabs) return null

  return (
    <nav
      aria-label={tr("Primary")}
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-dark-navy/95 backdrop-blur pb-[env(safe-area-inset-bottom)] md:hidden"
    >
      <div className="grid grid-cols-3">
        {tabs.map((tab) => {
          const active = pathname === tab.href || (tab.match !== "/member" && pathname?.startsWith(tab.match))
          const Icon = tab.icon
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <Icon className="h-5 w-5" />
              {tr(tab.label)}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
