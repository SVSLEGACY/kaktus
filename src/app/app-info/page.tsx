'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function AppInfoPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen text-foreground font-sans selection:bg-primary/20 relative z-10">
      
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 md:px-12 z-50 bg-background/80 backdrop-blur-md border-b border-border/40">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
              <defs>
                <linearGradient id="logoGrad" x1="0" y1="24" x2="24" y2="0" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#eab308" />
                  <stop offset="50%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#f97316" />
                </linearGradient>
              </defs>
              <g stroke="url(#logoGrad)">
                <path d="M12 22V4" />
                <path d="M12 14H9a2 2 0 0 1-2-2V8" />
                <path d="M12 10h3a2 2 0 0 0 2-2V5" />
              </g>
            </svg>
            <span className="font-semibold text-lg tracking-tight font-sans">Kaktus</span>
          </Link>

          {user && (
            <button
              onClick={() => signOut(auth)}
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-muted-foreground hover:text-destructive bg-card/80 hover:bg-destructive/10 border border-border rounded-full transition-all shadow-xs cursor-pointer"
              title={`Logged in as ${user.email || 'User'} - Click to Logout`}
            >
              <LogOut size={13} />
              <span>Log out</span>
            </button>
          )}
        </div>
        
        <nav className="hidden lg:flex items-center gap-10 text-sm font-medium text-muted-foreground">
          <Link href="/app-info" className="text-foreground font-bold transition-colors">App Info</Link>
          <Link href="/how-to-use" className="hover:text-foreground transition-colors">How to Use</Link>
          <Link href="/#pricing" className="hover:text-foreground transition-colors">Pricing</Link>
          {!user ? (
            <Link href="/login" className="font-semibold text-primary hover:underline">Login</Link>
          ) : (
            <Link href="/ide" className="font-semibold text-primary hover:underline">Workspace</Link>
          )}
        </nav>
        
        <div className="w-[100px] hidden md:block"></div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-24 px-6 md:px-12 max-w-5xl mx-auto">
        <div className="mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Deep Dive into Kaktus Core.</h1>
          <p className="text-xl text-muted-foreground leading-relaxed max-w-3xl">
            Kaktus isn't just a drawing tool; it's an Omniscient Hardware AGI. Here is a detailed look at the technology powering the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="fabric-panel p-8 shadow-textile">
            <h2 className="text-2xl font-bold mb-4">Physics-First Wiring Engine</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              When Kaktus connects a wire, it doesn't just draw a line. It calculates voltage drop, current limits, and logic level compatibility. If you connect a 5V sensor to a 3.3V pin, the engine automatically injects a level shifter or divider.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Every connection is verified against real physics, ensuring circuits won't burn out physically.
            </p>
          </div>

          <div className="fabric-panel p-8 shadow-textile">
            <h2 className="text-2xl font-bold mb-4">Omniscient AGI</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              The AI model embedded in Kaktus has been trained on thousands of datasheets, schematics, and industry-standard engineering practices.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Whether you need to know stall currents or I2C pull-up resistor requirements, the AGI knows and applies it automatically.
            </p>
          </div>

          <div className="fabric-panel p-8 shadow-textile">
            <h2 className="text-2xl font-bold mb-4">Multi-Tab Architecture</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Hardware projects get complex. Kaktus allows you to split massive projects into isolated subsystems (e.g., Left Arm, Right Leg, Head).
            </p>
            <p className="text-muted-foreground leading-relaxed">
              The AI shares context across all tabs to prevent hardware conflicts and pin collisions globally.
            </p>
          </div>

          <div className="fabric-panel p-8 shadow-textile">
            <h2 className="text-2xl font-bold mb-4">Instant Firmware Compilation</h2>
            <p className="text-muted-foreground leading-relaxed mb-4">
              Drawing the circuit is only half the battle. Kaktus generates production-ready C++ firmware specifically tailored to the pins and components it just wired.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              The built-in terminal allows you to interact with simulated hardware and flash physically via USB.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
