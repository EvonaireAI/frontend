"use client"

import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
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
import { useAuth } from "@/lib/auth-context"
import { useEntitlements } from "@/lib/entitlements-context"
import { format } from "date-fns"
import { Sparkles, Heart, Leaf, Shield, Settings, LogOut, Music, Upload, Eye, CreditCard, Landmark, Home, ScrollText } from "lucide-react"

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
      case "admin":
        return "/admin"
      case "moderator":
        return "/moderate"
      default:
        return "/dashboard"
    }
  }

  const getNavigationItems = (role: string) => {
    const items = []

    switch (role) {
      case "creator":
        items.push(
          { href: "/creator", label: "Studio", icon: <Music className="w-4 h-4" /> },
          { href: "/creator/upload", label: "Upload", icon: <Upload className="w-4 h-4" /> },
          { href: "/member", label: "Library", icon: <Heart className="w-4 h-4" /> },
        )
        break
      case "member":
        items.push(
          { href: "/member", label: "Library", icon: <Heart className="w-4 h-4" /> },
          { href: "/member/agora", label: "The Agora", icon: <Landmark className="w-4 h-4" /> },
          { href: "/member/my-sanctuary", label: "My Sanctuary", icon: <Home className="w-4 h-4" /> },
          { href: "/member/ledger", label: "The Ledger", icon: <ScrollText className="w-4 h-4" /> },
          { href: "/member/billing", label: "Billing", icon: <CreditCard className="w-4 h-4" /> },
        )
        break
      case "admin":
        items.push(
          { href: "/admin", label: "Admin", icon: <Shield className="w-4 h-4" /> },
          { href: "/member", label: "Library", icon: <Heart className="w-4 h-4" /> },
        )
        break
      case "moderator":
        items.push(
          { href: "/moderate", label: "Moderate", icon: <Shield className="w-4 h-4" /> },
          { href: "/member", label: "Library", icon: <Heart className="w-4 h-4" /> },
        )
        break
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

  const navigationItems = getNavigationItems(user.role)

  return (
    <nav className="border-b border-border bg-dark-navy/95 backdrop-blur supports-[backdrop-filter]:bg-dark-navy/80 sticky top-0 z-50">
      <div className="container mx-auto px-4">
        <div className="flex h-14 items-center justify-between">
          <div className="flex items-center space-x-8">
            <Link href={getRoleDashboard(user.role)} className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-lg font-bold text-foreground tracking-wide">Evonaire</span>
            </Link>

            {navigationItems.length > 0 && (
              <div className="hidden md:flex items-center space-x-6">
                {navigationItems.map((item) => (
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
              </div>
            )}
          </div>

          <div className="flex items-center space-x-4">
            <Badge variant="outline" className={getRoleColor(user.role)}>
              {getRoleIcon(user.role)}
              <span className="ml-1 capitalize">{user.role}</span>
            </Badge>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage
                      src={user.profile_picture || "/placeholder.svg"}
                      alt={`${user.first_name} ${user.last_name}`}
                    />
                    <AvatarFallback>
                      {user.first_name[0]}
                      {user.last_name[0]}
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
                {user.role === "admin" && (
                  <DropdownMenuItem asChild>
                    <Link href="/admin" className="flex items-center">
                      <Shield className="mr-2 h-4 w-4" />
                      <span>Admin Panel</span>
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
