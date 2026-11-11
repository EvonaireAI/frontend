"use client"

import { Globe } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useI18n } from "@/lib/i18n/provider"
import { LOCALES, tr, type Locale } from "@/lib/i18n"

export function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale } = useI18n()

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={className}
          aria-label={tr("Language")}
        >
          <Globe className="w-4 h-4" />
          <span className="ml-1 text-xs uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="max-h-80 overflow-y-auto">
        {LOCALES.map((l) => (
          <DropdownMenuItem
            key={l.code}
            onClick={() => setLocale(l.code as Locale)}
            className={locale === l.code ? "bg-accent" : undefined}
          >
            <span className="w-8 text-xs uppercase text-muted-foreground">{l.code}</span>
            <span>{l.nativeName}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
