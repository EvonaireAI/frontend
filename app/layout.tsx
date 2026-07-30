import type React from "react"
import type { Metadata } from "next"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AppShell } from "@/components/app-shell"
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
        {/* The auth providers, nav and consent guard live in AppShell, which
            skips them entirely on standalone public routes like /verify. */}
        <AppShell>{children}</AppShell>
      </body>
    </html>
  )
}
