"use client"

import type { ReactNode } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { useAuth } from "@/lib/auth-context"
import { useEntitlements } from "@/lib/entitlements-context"
import { roleDashboardLabel, isGuardian, isSteward } from "@/lib/roles"
import { GLOSSARY, COMING_SOON_SECTIONS } from "@/lib/glossary"
import { GatewayProgressBadge } from "@/components/gateway/gateway-progress-badge"
import { format } from "date-fns"
import { Menu, Heart, Leaf, Shield, Settings, LogOut, Music, Upload, Eye, Landmark, Home, ScrollText, BarChart3, Headphones, Banknote, Coins, Store, Tags, ClipboardCheck, LifeBuoy, Clock, MoreHorizontal } from "lucide-react"

interface NavItem {
  href: string
  label: string
  icon: ReactNode
  /** Desktop-only: move out of the inline bar into the "More" dropdown. */
  overflow?: boolean
}

/** Primary destinations while working in the Guardian Dashboard workspace. */
const GUARDIAN_CONSOLE_NAV: NavItem[] = [
  { href: "/moderate", label: GLOSSARY.guardianDashboard, icon: <Shield className="w-4 h-4" /> },
  { href: "/moderate?tab=pending", label: "Pending Reviews", icon: <ClipboardCheck className="w-4 h-4" /> },
  { href: "/commons", label: GLOSSARY.symposium, icon: <Store className="w-4 h-4" /> },
  { href: "/member", label: GLOSSARY.sacredLibrary, icon: <Heart className="w-4 h-4" /> },
]

// Current-plan badge for the account menu; notes the end date when the
// subscription is set to cancel.
function PlanBadge() {
  const { entitlements, planName } = useEntitlements()

  const sub = entitlements?.subscription
  const cancelNote =
    sub?.cancel_at_period_end && sub.current_period_end
      ? ` until ${format(new Date(sub.current_period_end), "MMM d, yyyy")}`
      : ""

  return (
    <Badge variant="outline" className="w-fit bg-primary/10 text-primary border-primary/30 text-xs">
      {planName}
      {cancelNote}
    </Badge>
  )
}

export function Navigation() {
  const { user, loading, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  const handleLogout = () => {
    logout()
    router.replace("/auth/login")
    router.refresh()
  }

  const getRoleIcon = (role: string) => {
    switch (role) {
      case "superadmin":
      case "admin":
        return <Shield className="w-4 h-4" />
      case "creator":
        return <Leaf className="w-4 h-4" />
      case "moderator":
        return <Shield className="w-4 h-4" />
      default:
        return <Heart className="w-4 h-4" />
    }
  }

  const getRoleColor = (role: string) => {
    switch (role) {
      case "superadmin":
      case "admin":
        return "bg-destructive/10 text-destructive border-destructive/20"
      case "creator":
        return "bg-primary/10 text-primary border-primary/20"
      case "moderator":
        return "bg-gold-muted/10 text-gold-muted border-gold-muted/20"
      default:
        return "bg-secondary text-secondary-foreground border-border"
    }
  }

  const getRoleDashboard = (role: string) => {
    switch (role) {
      case "creator":
        return "/creator"
      case "member":
        return "/member"
      case "superadmin":
      case "admin":
        return "/steward"
      case "moderator":
        return "/moderate"
      default:
        return "/dashboard"
    }
  }

  // `overflow: true` keeps an item out of the inline desktop bar (it moves to
  // the "More" dropdown) without hiding it — the mobile sheet always lists
  // every item. Only the creator role has enough destinations to need it.
  const getNavigationItems = (role: string): NavItem[] => {
    const items: NavItem[] = []

    switch (role) {
      case "creator":
        items.push(
          { href: "/creator", label: GLOSSARY.creatorStudio, icon: <Music className="w-4 h-4" /> },
          { href: "/creator/upload", label: GLOSSARY.uploadRitual, icon: <Upload className="w-4 h-4" /> },
          { href: "/member", label: GLOSSARY.sacredLibrary, icon: <Heart className="w-4 h-4" /> },
          { href: "/member/agora", label: GLOSSARY.agora, icon: <Landmark className="w-4 h-4" /> },
          // One financial hub: The Ledger carries Billing and links out to the
          // creator-only Earnings / Payouts pages (kept below as overflow).
          { href: "/member/ledger", label: GLOSSARY.ledger, icon: <ScrollText className="w-4 h-4" /> },
          { href: "/member/my-sanctuary", label: GLOSSARY.mySanctuary, icon: <Home className="w-4 h-4" />, overflow: true },
          { href: "/creator/earnings", label: GLOSSARY.earnings, icon: <Coins className="w-4 h-4" />, overflow: true },
          { href: "/creator/payouts", label: GLOSSARY.payouts, icon: <Banknote className="w-4 h-4" />, overflow: true },
          { href: "/creator/listening", label: "Listening", icon: <Headphones className="w-4 h-4" />, overflow: true },
          { href: "/creator/listings", label: "My Listings", icon: <Tags className="w-4 h-4" />, overflow: true },
          { href: "/creator/provenance", label: "Provenance", icon: <ScrollText className="w-4 h-4" />, overflow: true },
          { href: "/commons", label: GLOSSARY.commons, icon: <Store className="w-4 h-4" />, overflow: true },
        )
        break
      case "member":
        items.push(
          { href: "/member", label: GLOSSARY.sacredLibrary, icon: <Heart className="w-4 h-4" /> },
          { href: "/commons", label: GLOSSARY.commons, icon: <Store className="w-4 h-4" /> },
          { href: "/member/agora", label: GLOSSARY.agora, icon: <Landmark className="w-4 h-4" /> },
          { href: "/member/my-sanctuary", label: GLOSSARY.mySanctuary, icon: <Home className="w-4 h-4" /> },
          { href: "/member/reflection-room", label: GLOSSARY.reflectionRoom, icon: <LifeBuoy className="w-4 h-4" /> },
          // DECISION(fitsum): "The Ledger" is the single financial destination in
          // the nav. Billing & Invoices lives as a section inside it, so the
          // standalone "Billing" nav entry was removed to avoid redundancy.
          // The /member/billing route still exists and is reachable from Ledger.
          { href: "/member/ledger", label: GLOSSARY.ledger, icon: <ScrollText className="w-4 h-4" /> },
        )
        break
      // Stewards get BOTH consoles — the backend's IsModerator admits
      // admin/superadmin, so a steward can work care cases too.
      case "superadmin":
      case "admin":
        items.push(
          { href: "/steward", label: GLOSSARY.stewardDashboard, icon: <Shield className="w-4 h-4" /> },
          { href: "/moderate", label: GLOSSARY.guardianDashboard, icon: <ClipboardCheck className="w-4 h-4" /> },
          // { href: "/steward?tab=memberships", label: "Memberships", icon: <BarChart3 className="w-4 h-4" /> },
          // { href: "/steward?tab=earnings", label: "Creator Earnings", icon: <Coins className="w-4 h-4" />, overflow: true },
          // { href: "/steward?tab=archive", label: GLOSSARY.archive, icon: <ScrollText className="w-4 h-4" />, overflow: true },
          { href: "/commons", label: GLOSSARY.symposium, icon: <Store className="w-4 h-4" />, overflow: true },
          { href: "/member", label: GLOSSARY.sacredLibrary, icon: <Heart className="w-4 h-4" />, overflow: true },
        )
        break
      case "moderator":
        items.push(...GUARDIAN_CONSOLE_NAV)
        break
    }

    return items
  }

  /** Stewards use separate dashboards — don't cross-link while inside one console. */
  function filterConsoleCrossLinks(items: NavItem[], currentPath: string | null): NavItem[] {
    if (!currentPath) return items
    if (currentPath.startsWith("/moderate")) {
      return items.filter((item) => !item.href.startsWith("/steward"))
    }
    if (currentPath.startsWith("/steward")) {
      return items.filter((item) => !item.href.startsWith("/moderate"))
    }
    return items
  }

  // Don't show navigation on auth pages, landing page, or the Gateway Quiz
  // (the quiz uses its own immersive header).
  if (
    pathname?.startsWith("/auth") ||
    pathname === "/" ||
    pathname === "/activate" ||
    pathname?.startsWith("/gateway-quiz")
  ) {
    return null
  }

  if (loading || !user) {
    return null
  }

  const navigationItems =
    pathname?.startsWith("/moderate") && isGuardian(user.role)
      ? GUARDIAN_CONSOLE_NAV
      : filterConsoleCrossLinks(getNavigationItems(user.role), pathname)
  const inlineItems = navigationItems.filter((item) => !item.overflow)
  const overflowItems = navigationItems.filter((item) => item.overflow)

  return (
    <nav className="border-b border-border bg-dark-navy/95 backdrop-blur supports-[backdrop-filter]:bg-dark-navy/80 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center space-x-4 md:space-x-8">
            {/* Mobile section menu — primary destinations on phones. */}
            {navigationItems.length > 0 && (
              <Sheet>
                <SheetTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="md:hidden h-9 w-9"
                    aria-label="Open menu"
                  >
                    <Menu className="h-5 w-5" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-72 bg-card border-border p-0">
                  <SheetHeader className="p-4 border-b border-border text-left">
                    <SheetTitle className="flex items-center gap-2 text-foreground">
                      <span className="flex items-center justify-center h-6 w-6 rounded-md bg-white p-0.5">
                        <Image src="/logo.svg" alt="" width={512} height={512} className="h-full w-full object-contain" />
                      </span>
                      Evonaire
                    </SheetTitle>
                  </SheetHeader>
                  <nav className="flex flex-col p-2">
                    {navigationItems.map((item) => (
                      <SheetClose asChild key={item.href}>
                        <Link
                          href={item.href}
                          className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors hover:bg-secondary ${
                            pathname === item.href ? "text-primary bg-secondary" : "text-muted-foreground"
                          }`}
                        >
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      </SheetClose>
                    ))}
                    {COMING_SOON_SECTIONS.map((label) => (
                      <div
                        key={label}
                        aria-disabled="true"
                        className="flex items-center justify-between gap-3 rounded-md px-3 py-2.5 text-sm font-medium text-muted-foreground/50 cursor-not-allowed"
                      >
                        <span className="flex items-center gap-3">
                          <Clock className="w-4 h-4" />
                          {label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide">Soon</span>
                      </div>
                    ))}
                  </nav>
                </SheetContent>
              </Sheet>
            )}

            <Link href={getRoleDashboard(user.role)} className="flex items-center space-x-2">
              <span className="flex items-center justify-center h-10 w-10 rounded-lg p-0.5 shadow-sm">
                <Image src="/logo.svg" alt="Evonaire" width={512} height={512} className="h-full w-full object-contain" priority />
              </span>
              <span className="text-lg font-bold text-foreground tracking-wide">Evonaire</span>
            </Link>

            {navigationItems.length > 0 && (
              <div className="hidden md:flex items-center space-x-6">
                {inlineItems.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center space-x-2 text-sm font-medium transition-colors hover:text-primary ${
                      pathname === item.href ? "text-primary" : "text-muted-foreground"
                    }`}
                  >
                    {item.icon}
                    <span>{item.label}</span>
                  </Link>
                ))}

                {/* Overflow + the not-yet-built sections, so every destination
                    stays reachable on desktop without crowding the bar. */}
                <DropdownMenu>
                  <DropdownMenuTrigger className="flex items-center space-x-2 text-sm font-medium text-muted-foreground transition-colors hover:text-primary">
                    <MoreHorizontal className="w-4 h-4" />
                    <span>More</span>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56 bg-card border-border">
                    {overflowItems.map((item) => (
                      <DropdownMenuItem asChild key={item.href}>
                        <Link href={item.href} className="flex items-center gap-2">
                          {item.icon}
                          <span>{item.label}</span>
                        </Link>
                      </DropdownMenuItem>
                    ))}
                    {COMING_SOON_SECTIONS.map((label) => (
                      <DropdownMenuItem key={label} disabled className="flex items-center justify-between gap-2">
                        <span className="flex items-center gap-2">
                          <Clock className="w-4 h-4" />
                          {label}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide">Soon</span>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <GatewayProgressBadge />

            <Badge variant="outline" className={`hidden sm:inline-flex ${getRoleColor(user.role)}`}>
              {getRoleIcon(user.role)}
              <span className="ml-1">{roleDashboardLabel(user.role)}</span>
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    {user.profile_picture ? (
                      <AvatarImage
                        src={user.profile_picture}
                        alt={`${user.first_name} ${user.last_name}`}
                      />
                    ) : null}
                    <AvatarFallback>
                      {user.first_name?.[0]}
                      {user.last_name?.[0]}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 bg-card border-border" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1.5 leading-none">
                    <p className="font-medium text-foreground">
                      {user.first_name} {user.last_name}
                    </p>
                    <p className="w-[200px] truncate text-sm text-muted-foreground">{user.email}</p>
                    <PlanBadge />
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/dashboard" className="flex items-center">
                    <Eye className="mr-2 h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/profile" className="flex items-center">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Profile Settings</span>
                  </Link>
                </DropdownMenuItem>
                {isSteward(user.role) && !pathname?.startsWith("/steward") && (
                  <DropdownMenuItem asChild>
                    <Link href="/steward" className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>{GLOSSARY.stewardDashboard}</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </nav>
  )
}
