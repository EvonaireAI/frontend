"use client"

import Link from "next/link"
import { Shield, Heart, Sparkles } from "lucide-react"

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-dark-navy relative overflow-hidden">
      {/* Starfield background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="stars" />
        <div className="stars2" />
        <div className="stars3" />
      </div>

      {/* Top navigation */}
      <nav className="relative z-10 flex justify-end p-6">
        <Link
          href="#features"
          className="text-cream/80 hover:text-cream transition-colors text-sm underline underline-offset-4"
        >
          Learn More
        </Link>
      </nav>

      {/* Hero section */}
      <main className="relative z-10 flex flex-col items-center justify-center min-h-[calc(100vh-80px)] px-4 -mt-20">
        {/* Logo */}
        <div className="mb-8 animate-float">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.svg"
            alt="Evonaire Logo"
            width={180}
            height={180}
            className="drop-shadow-[0_0_30px_rgba(217,181,116,0.3)]"
          />
        </div>

        {/* Headline */}
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif text-cream text-center mb-6 tracking-wide">
          Welcome To Evonaire
        </h1>

        {/* Subtitle */}
        <p className="text-cream/70 text-center max-w-2xl mx-auto text-base md:text-lg leading-relaxed mb-12 px-4">
          A secure platform where creators and community members share and experience content with care, consent, and
          privacy at the center. A protected space for your voice, rituals, and creative offerings.
        </p>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-6">
          <Link
            href="/auth/register"
            className="w-44 h-12 flex items-center justify-center rounded-full bg-dark-navy border-2 border-gold text-cream font-medium text-sm hover:bg-gold/10 transition-all duration-300 shadow-[0_0_20px_rgba(217,181,116,0.15)]"
          >
            Sign Up
          </Link>
          <Link
            href="/auth/login"
            className="w-44 h-12 flex items-center justify-center rounded-full bg-gold text-dark-navy font-medium text-sm hover:bg-gold-muted transition-all duration-300 shadow-[0_0_20px_rgba(217,181,116,0.3)]"
          >
            Log In
          </Link>
        </div>
      </main>

      {/* Features Section */}
      <section id="features" className="relative z-10 py-24 px-4">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-serif text-cream text-center mb-4">Built for Creators & Members</h2>
          <p className="text-cream/60 text-center max-w-xl mx-auto mb-16">
            Everything you need to share and experience sacred rituals in a protected environment.
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="bg-dark-navy/50 border border-gold/20 rounded-2xl p-8 backdrop-blur-sm hover:border-gold/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                <Shield className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-xl font-semibold text-cream mb-3">NeuroPrivacy First</h3>
              <p className="text-cream/60 text-sm leading-relaxed">
                Your emotional and somatic data is protected with industry-leading privacy protocols. Share with
                confidence.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="bg-dark-navy/50 border border-gold/20 rounded-2xl p-8 backdrop-blur-sm hover:border-gold/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                <Heart className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-xl font-semibold text-cream mb-3">Sacred Sanctuaries</h3>
              <p className="text-cream/60 text-sm leading-relaxed">
                Create or join private communities. Experience rituals together in curated, invitation-only spaces.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="bg-dark-navy/50 border border-gold/20 rounded-2xl p-8 backdrop-blur-sm hover:border-gold/40 transition-colors">
              <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mb-6">
                <Sparkles className="w-6 h-6 text-gold" />
              </div>
              <h3 className="text-xl font-semibold text-cream mb-3">Creator Empowerment</h3>
              <p className="text-cream/60 text-sm leading-relaxed">
                Upload rituals, track engagement, manage your RTS score, and build a thriving community around your
                offerings.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 py-8 border-t border-gold/10">
        <div className="max-w-6xl mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.svg" alt="Evonaire" width={32} height={32} />
            <span className="text-cream/60 text-sm">Evonaire</span>
          </div>
          <div className="flex items-center gap-6">
            <Link
              href="/privacy"
              className="text-cream/50 hover:text-gold text-xs transition-colors"
            >
              Privacy Policy
            </Link>
            <Link
              href="/terms"
              className="text-cream/50 hover:text-gold text-xs transition-colors"
            >
              Terms of Service
            </Link>
          </div>
          <p className="text-cream/40 text-xs">A sanctuary for rituals and reflections.</p>
        </div>
      </footer>

      {/* Inline styles for starfield animation */}
      <style jsx>{`
        .stars,
        .stars2,
        .stars3 {
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          width: 100%;
          height: 100%;
          display: block;
        }

        .stars {
          background: transparent
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='400' height='400' viewBox='0 0 800 800'%3E%3Cg fill='none' stroke='%23d9b574' stroke-width='1'%3E%3Ccircle cx='100' cy='100' r='1' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='200' cy='50' r='0.5' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='300' cy='150' r='1' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='400' cy='80' r='0.5' fill='%23d9b574' opacity='0.6'/%3E%3Ccircle cx='500' cy='200' r='1' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='600' cy='120' r='0.5' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='700' cy='180' r='1' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='150' cy='300' r='0.5' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='250' cy='350' r='1' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='350' cy='280' r='0.5' fill='%23d9b574' opacity='0.6'/%3E%3Ccircle cx='450' cy='400' r='1' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='550' cy='320' r='0.5' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='650' cy='380' r='1' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='750' cy='300' r='0.5' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='50' cy='450' r='1' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='180' cy='500' r='0.5' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='280' cy='480' r='1' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='420' cy='550' r='0.5' fill='%23d9b574' opacity='0.6'/%3E%3Ccircle cx='520' cy='480' r='1' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='620' cy='520' r='0.5' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='720' cy='450' r='1' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='80' cy='600' r='0.5' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='200' cy='650' r='1' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='320' cy='620' r='0.5' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='460' cy='680' r='1' fill='%23d9b574' opacity='0.6'/%3E%3Ccircle cx='580' cy='620' r='0.5' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='680' cy='660' r='1' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='780' cy='600' r='0.5' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='120' cy='750' r='1' fill='%23d9b574' opacity='0.5'/%3E%3Ccircle cx='240' cy='720' r='0.5' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='380' cy='780' r='1' fill='%23d9b574' opacity='0.4'/%3E%3Ccircle cx='500' cy='750' r='0.5' fill='%23d9b574' opacity='0.6'/%3E%3Ccircle cx='640' cy='720' r='1' fill='%23d9b574' opacity='0.3'/%3E%3Ccircle cx='760' cy='780' r='0.5' fill='%23d9b574' opacity='0.5'/%3E%3C/g%3E%3C/svg%3E")
            repeat top center;
          animation: twinkle 4s ease-in-out infinite;
        }

        .stars2 {
          background: transparent
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='600' height='600' viewBox='0 0 600 600'%3E%3Cg fill='%23d9b574'%3E%3Ccircle cx='50' cy='50' r='0.8' opacity='0.4'/%3E%3Ccircle cx='150' cy='120' r='0.6' opacity='0.3'/%3E%3Ccircle cx='250' cy='80' r='0.8' opacity='0.5'/%3E%3Ccircle cx='350' cy='150' r='0.6' opacity='0.4'/%3E%3Ccircle cx='450' cy='100' r='0.8' opacity='0.3'/%3E%3Ccircle cx='550' cy='180' r='0.6' opacity='0.5'/%3E%3Ccircle cx='100' cy='250' r='0.8' opacity='0.4'/%3E%3Ccircle cx='200' cy='300' r='0.6' opacity='0.3'/%3E%3Ccircle cx='300' cy='220' r='0.8' opacity='0.5'/%3E%3Ccircle cx='400' cy='280' r='0.6' opacity='0.4'/%3E%3Ccircle cx='500' cy='350' r='0.8' opacity='0.3'/%3E%3Ccircle cx='50' cy='400' r='0.6' opacity='0.5'/%3E%3Ccircle cx='150' cy='450' r='0.8' opacity='0.4'/%3E%3Ccircle cx='250' cy='380' r='0.6' opacity='0.3'/%3E%3Ccircle cx='350' cy='420' r='0.8' opacity='0.5'/%3E%3Ccircle cx='450' cy='500' r='0.6' opacity='0.4'/%3E%3Ccircle cx='550' cy='450' r='0.8' opacity='0.3'/%3E%3Ccircle cx='100' cy='550' r='0.6' opacity='0.5'/%3E%3Ccircle cx='200' cy='520' r='0.8' opacity='0.4'/%3E%3Ccircle cx='300' cy='580' r='0.6' opacity='0.3'/%3E%3Ccircle cx='400' cy='550' r='0.8' opacity='0.5'/%3E%3Ccircle cx='500' cy='520' r='0.6' opacity='0.4'/%3E%3C/g%3E%3C/svg%3E")
            repeat top center;
          animation: twinkle 6s ease-in-out infinite;
          animation-delay: -2s;
        }

        .stars3 {
          background: transparent
            url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='500' height='500' viewBox='0 0 500 500'%3E%3Cg fill='%23f3e5c8'%3E%3Ccircle cx='80' cy='80' r='0.5' opacity='0.2'/%3E%3Ccircle cx='180' cy='140' r='0.4' opacity='0.3'/%3E%3Ccircle cx='280' cy='60' r='0.5' opacity='0.2'/%3E%3Ccircle cx='380' cy='120' r='0.4' opacity='0.3'/%3E%3Ccircle cx='480' cy='80' r='0.5' opacity='0.2'/%3E%3Ccircle cx='40' cy='200' r='0.4' opacity='0.3'/%3E%3Ccircle cx='140' cy='260' r='0.5' opacity='0.2'/%3E%3Ccircle cx='240' cy='180' r='0.4' opacity='0.3'/%3E%3Ccircle cx='340' cy='240' r='0.5' opacity='0.2'/%3E%3Ccircle cx='440' cy='200' r='0.4' opacity='0.3'/%3E%3Ccircle cx='60' cy='320' r='0.5' opacity='0.2'/%3E%3Ccircle cx='160' cy='380' r='0.4' opacity='0.3'/%3E%3Ccircle cx='260' cy='340' r='0.5' opacity='0.2'/%3E%3Ccircle cx='360' cy='400' r='0.4' opacity='0.3'/%3E%3Ccircle cx='460' cy='360' r='0.5' opacity='0.2'/%3E%3Ccircle cx='100' cy='440' r='0.4' opacity='0.3'/%3E%3Ccircle cx='200' cy='480' r='0.5' opacity='0.2'/%3E%3Ccircle cx='300' cy='420' r='0.4' opacity='0.3'/%3E%3Ccircle cx='400' cy='460' r='0.5' opacity='0.2'/%3E%3Ccircle cx='480' cy='440' r='0.4' opacity='0.3'/%3E%3C/g%3E%3C/svg%3E")
            repeat top center;
          animation: twinkle 8s ease-in-out infinite;
          animation-delay: -4s;
        }

        @keyframes twinkle {
          0%,
          100% {
            opacity: 0.5;
          }
          50% {
            opacity: 1;
          }
        }

        @keyframes float {
          0%,
          100% {
            transform: translateY(0px);
          }
          50% {
            transform: translateY(-10px);
          }
        }

        .animate-float {
          animation: float 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  )
}
