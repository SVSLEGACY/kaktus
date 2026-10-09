'use client';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function AppInfoPage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-transparent text-[#2c2420] font-sans selection:bg-green-500/20 relative z-10">
      
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 md:px-12 z-50 bg-transparent">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
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
            <span className="font-semibold text-lg tracking-tight">Kaktus</span>
          </Link>

          {user && (
            <button
              onClick={() => signOut(auth)}
              className="felt-patch flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-[#2c2420] hover:text-red-600 transition-all cursor-pointer"
              title={`Logged in as ${user.email || 'User'} - Click to Logout`}
            >
              <LogOut size={13} />
              <span>Log out</span>
            </button>
          )}
        </div>
        
        <nav className="hidden lg:flex items-center gap-6 text-sm font-medium text-[#5a4f45]">
          <Link href="/app-info" className="text-[#2c2420] transition-colors">App Info</Link>
          <Link href="/how-to-use" className="hover:text-[#2c2420] transition-colors">How to Use</Link>
          <Link href="/#pricing" className="hover:text-[#2c2420] transition-colors">Pricing</Link>
          {!user ? (
            <div className="flex items-center gap-3">
              <Link href="/login" className="felt-patch px-4 py-1.5 text-[#2c2420] font-semibold hover:opacity-80 transition-opacity">Log in</Link>
              <Link href="/login" className="felt-patch-dark px-4 py-1.5 font-semibold hover:opacity-90 transition-opacity text-sm">Sign In</Link>
            </div>
          ) : (
            <Link href="/ide" className="felt-patch px-4 py-1.5 font-semibold text-green-700 hover:opacity-80 transition-opacity">Workspace</Link>
          )}
        </nav>
        
        <div className="w-[100px] hidden md:block"></div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-24 px-6 md:px-12 max-w-5xl mx-auto">
        <div className="mb-16">
          <h1 className="text-5xl md:text-7xl tracking-tight mb-6 stitched-text">Deep Dive into Kaktus Core.</h1>
          <p className="text-xl text-[#6b5e52] leading-relaxed max-w-3xl">
            Kaktus isn't just a drawing tool; it's an Omniscient Hardware AGI. Here is a detailed look at the technology powering the platform.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="felt-card p-8">
            <h2 className="text-2xl mb-4 stitched-text">Physics-First Wiring Engine</h2>
            <p className="text-[#5a4f45] leading-relaxed mb-4">
              When Kaktus connects a wire, it doesn't just draw a line. It calculates the voltage drop, current limits, and logic level compatibility. If you try to connect a 5V sensor to a 3.3V ESP32 pin, the engine will automatically inject a logic level shifter or voltage divider.
            </p>
            <p className="text-[#5a4f45] leading-relaxed">
              Every connection is verified against real-world physics, ensuring that your circuits won't burn out when built physically.
            </p>
          </div>

          <div className="felt-card p-8">
            <h2 className="text-2xl mb-4 stitched-text">Omniscient AGI</h2>
            <p className="text-[#5a4f45] leading-relaxed mb-4">
              The AI model embedded in Kaktus has been trained on thousands of datasheets, schematics, and industry-standard engineering practices. 
            </p>
            <p className="text-[#5a4f45] leading-relaxed">
              Whether you need to know the stall current of an MG996R servo or the I2C pull-up resistor requirements for a 400kHz bus, the AGI knows it and applies it automatically.
            </p>
          </div>

          <div className="felt-card p-8">
            <h2 className="text-2xl mb-4 stitched-text">Multi-Tab Architecture</h2>
            <p className="text-[#5a4f45] leading-relaxed mb-4">
              Hardware projects get messy. Kaktus allows you to split massive projects (like a humanoid robot) into isolated subsystems (e.g., Left Arm, Right Leg, Head). 
            </p>
            <p className="text-[#5a4f45] leading-relaxed">
              The AI shares context across all tabs. If you used PWM channel 0 in Tab A, it knows to use PWM channel 1 in Tab B, preventing hardware conflicts globally.
            </p>
          </div>

          <div className="felt-card p-8">
            <h2 className="text-2xl mb-4 stitched-text">Instant Firmware Compilation</h2>
            <p className="text-[#5a4f45] leading-relaxed mb-4">
              Drawing the circuit is only half the battle. Kaktus generates production-ready C++ firmware specifically tailored to the pins and components it just wired.
            </p>
            <p className="text-[#5a4f45] leading-relaxed">
              The built-in terminal allows you to interact with the simulated hardware, testing logic without waiting for physical parts to arrive.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
