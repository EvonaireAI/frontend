import type React from "react"
import type { Metadata } from "next"
import { Inter, Lexend, Playfair_Display } from "next/font/google"
import { GeistSans } from "geist/font/sans"
import { GeistMono } from "geist/font/mono"
import { AppShell } from "@/components/app-shell"
import "./globals.css"


const lexend = Lexend({
  subsets: ["latin"],
  variable: "--font-dyslexia-friendly",
  display: "swap",
})

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
  display: "swap",
})

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
    <html lang="en" className={`${lexend.variable} ${inter.variable} ${playfair.variable}`}>
      <head>
        {/* Chrome 69 (Android 8.0) has no globalThis, and Next's runtime
            assigns to it before any polyfill chunk loads. Define it first. */}
        <script dangerouslySetInnerHTML={{ __html: "if(typeof globalThis==='undefined'){window.globalThis=window}" }} />
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
