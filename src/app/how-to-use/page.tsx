'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function HowToUsePage() {
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
          <Link href="/app-info" className="hover:text-foreground transition-colors">App Info</Link>
          <Link href="/how-to-use" className="text-foreground font-bold transition-colors">How to Use</Link>
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
      <main className="pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto">
        <div className="mb-16">
          <h1 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">How to Use Kaktus.</h1>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Follow this simple guide to start designing circuits, generating firmware, and simulating your projects directly within Kaktus.
          </p>
        </div>

        <div className="flex flex-col gap-8">
          <div className="fabric-panel p-8 shadow-textile">
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Step 1</span>
            <h2 className="text-2xl font-bold mt-2 mb-4">Prompt the Assistant</h2>
            <p className="text-muted-foreground leading-relaxed">
              Open the IDE and use the chat input at the bottom to describe what you want to build. For example: <em>"Build an Arduino Uno circuit with a DHT22 temperature sensor and an OLED display."</em> The AI will process your requirements and start generating the wiring steps.
            </p>
          </div>

          <div className="fabric-panel p-8 shadow-textile">
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Step 2</span>
            <h2 className="text-2xl font-bold mt-2 mb-4">Review the Interactive Canvas</h2>
            <p className="text-muted-foreground leading-relaxed">
              The central canvas visualizes your board, components, and pin-to-pin connections in real-time. You can pan, zoom, and inspect wires. Hovering over a connection reveals the pin mappings, voltage, and signal types.
            </p>
          </div>

          <div className="fabric-panel p-8 shadow-textile">
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Step 3</span>
            <h2 className="text-2xl font-bold mt-2 mb-4">Navigate Through Assembly Steps</h2>
            <p className="text-muted-foreground leading-relaxed">
              The AI breaks down complex builds into sequential steps. Use the step slider or previous/next buttons to follow the build process stage-by-stage. Reorder or inspect component pin assignments on demand.
            </p>
          </div>

          <div className="fabric-panel p-8 shadow-textile">
            <span className="font-mono text-xs uppercase tracking-widest text-primary font-bold">Step 4</span>
            <h2 className="text-2xl font-bold mt-2 mb-4">Simulate & Flash Firmware</h2>
            <p className="text-muted-foreground leading-relaxed">
              Open the bottom Terminal panel to test logic against the hardware simulator. Connect your physical microcontroller via USB, click Flash in the Flash Panel, and burn your compiled C++ code directly without external tools.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
