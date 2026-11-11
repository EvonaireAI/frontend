"use client"

import Link from "next/link"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"
import { tr } from "@/lib/i18n"
import { Heart, Leaf, Shield, Landmark, ArrowRight } from "lucide-react"

const DOORS = [
  { role: "member", label: "Seeker", href: "/member", icon: Heart, blurb: "Explore rituals and sanctuaries at your own pace" },
  { role: "creator", label: "Creator", href: "/creator", icon: Leaf, blurb: "Share your rituals and grow your sanctuary" },
  { role: "moderator", label: "Guardian", href: "/moderate", icon: Shield, blurb: "Protect cultural safety and emotional wellbeing" },
  { role: "admin", label: "Steward", href: "/steward", icon: Landmark, blurb: "Nurture the sacred system" },
]

export default function EnterPage() {
  const { user } = useAuth()

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-dark-navy px-4 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <div className="stars" />
        <div className="stars2" />
        <div className="stars3" />
      </div>

      <div className="relative z-10 flex w-full max-w-md flex-col items-center text-center">
        <Image src="/logo.svg" alt={tr("Evonaire")} width={512} height={512} className="mb-8 h-32 w-auto drop-shadow-[0_0_24px_rgba(217,181,116,0.3)]" priority />
        <h1 className="text-3xl font-serif text-cream tracking-wide">{tr("Welcome to Evonaire")}</h1>
        <p className="mt-3 text-cream/70">{tr("Choose how you wish to enter this sanctuary")}</p>

        {user && (
          <p className="mt-4 text-sm text-gold-muted">
            {tr("Signed in as")} {user.first_name} {user.last_name}
          </p>
        )}

        <div className="mt-10 grid w-full gap-3">
          {DOORS.map((door) => {
            const Icon = door.icon
            return (
              <Link
                key={door.role}
                href={door.href}
                className="group flex items-center gap-4 rounded-2xl border border-gold/20 bg-dark-navy/60 px-5 py-4 text-left backdrop-blur transition-colors hover:border-gold/50 hover:bg-gold/5"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gold/10">
                  <Icon className="h-5 w-5 text-gold" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-base font-semibold text-cream">{tr(door.label)}</span>
                  <span className="block truncate text-sm text-cream/60">{tr(door.blurb)}</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-cream/40 transition-transform group-hover:translate-x-1 group-hover:text-gold" />
              </Link>
            )
          })}
        </div>

        {!user && (
          <div className="mt-8 flex gap-4 text-sm">
            <Link href="/auth/login" className="text-cream/70 underline underline-offset-4 hover:text-cream">{tr("Log In")}</Link>
            <Link href="/auth/register" className="text-cream/70 underline underline-offset-4 hover:text-cream">{tr("Sign Up")}</Link>
          </div>
        )}
      </div>

      <style jsx>{`
        .stars, .stars2, .stars3 {
          position: absolute; top: 0; left: 0; right: 0; bottom: 0; width: 100%; height: 100%;
          background-repeat: repeat top center;
        }
        .stars { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400'%3E%3Cg fill='%23d9b574'%3E%3Ccircle cx='100' cy='100' r='1' opacity='0.5'/%3E%3Ccircle cx='250' cy='180' r='0.8' opacity='0.4'/%3E%3Ccircle cx='380' cy='90' r='1' opacity='0.5'/%3E%3Ccircle cx='120' cy='320' r='0.6' opacity='0.3'/%3E%3Ccircle cx='330' cy='300' r='1' opacity='0.4'/%3E%3Ccircle cx='60' cy='220' r='0.8' opacity='0.5'/%3E%3C/g%3E%3C/svg%3E"); animation: twinkle 4s ease-in-out infinite; }
        .stars2 { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600'%3E%3Cg fill='%23d9b574'%3E%3Ccircle cx='80' cy='60' r='0.8' opacity='0.4'/%3E%3Ccircle cx='300' cy='140' r='0.6' opacity='0.3'/%3E%3Ccircle cx='520' cy='220' r='0.8' opacity='0.5'/%3E%3Ccircle cx='160' cy='420' r='0.6' opacity='0.4'/%3E%3Ccircle cx='440' cy='500' r='0.8' opacity='0.3'/%3E%3C/g%3E%3C/svg%3E"); animation: twinkle 6s ease-in-out infinite; animation-delay: -2s; }
        .stars3 { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='800' height='800'%3E%3Cg fill='%23d9b574'%3E%3Ccircle cx='200' cy='80' r='0.7' opacity='0.4'/%3E%3Ccircle cx='600' cy='260' r='0.9' opacity='0.3'/%3E%3Ccircle cx='350' cy='560' r='0.7' opacity='0.5'/%3E%3Ccircle cx='720' cy='640' r='0.6' opacity='0.3'/%3E%3C/g%3E%3C/svg%3E"); animation: twinkle 5s ease-in-out infinite; animation-delay: -1s; }
        @keyframes twinkle { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
      `}</style>
    </div>
  )
}
