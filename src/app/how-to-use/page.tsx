'use client';

import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';
import { LogOut } from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

export default function HowToUsePage() {
  const { user } = useAuth();
  return (
    <div className="min-h-screen bg-white text-[#111] font-sans selection:bg-green-500/20">
      
      {/* Navbar */}
      <header className="fixed top-0 left-0 right-0 h-20 flex items-center justify-between px-6 md:px-12 z-50 bg-white/90 backdrop-blur-md border-b border-gray-100">
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
              className="flex items-center gap-1.5 px-3 py-1 text-xs font-semibold text-gray-600 hover:text-red-600 bg-gray-100/90 hover:bg-red-50 border border-gray-200 hover:border-red-200 rounded-full transition-all shadow-xs cursor-pointer"
              title={`Logged in as ${user.email || 'User'} - Click to Logout`}
            >
              <LogOut size={13} />
              <span>Log out</span>
            </button>
          )}
        </div>
        
        <nav className="hidden lg:flex items-center gap-10 text-sm font-medium text-gray-500">
          <Link href="/app-info" className="hover:text-black transition-colors">App Info</Link>
          <Link href="/how-to-use" className="text-black transition-colors">How to Use</Link>
          <Link href="/#pricing" className="hover:text-black transition-colors">Pricing</Link>
          {!user ? (
            <Link href="/login" className="font-semibold text-green-600 hover:text-green-700">Login</Link>
          ) : (
            <Link href="/ide" className="font-semibold text-green-600 hover:text-green-700">Workspace</Link>
          )}
        </nav>
        
        <div className="w-[100px] hidden md:block"></div>
      </header>

      {/* Main Content */}
      <main className="pt-32 pb-24 px-6 md:px-12 max-w-4xl mx-auto">
        <div className="mb-16">
          <h1 className="text-5xl md:text-7xl font-bold tracking-tight mb-6">How to Use Kaktus.</h1>
          <p className="text-xl text-gray-500 leading-relaxed max-w-2xl">
            A step-by-step guide to designing, wiring, and simulating hardware inside the Kaktus IDE.
          </p>
        </div>

        <div className="space-y-16 flex flex-col">
          
          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center font-bold text-xl flex-shrink-0">1</div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Initialize a Workspace</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Click on the <strong>Enter Workspace</strong> button from the homepage. This will launch the Kaktus IDE. You will see a blank canvas in the center, a chat pane on the left, and a terminal at the bottom.
              </p>
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-xl font-mono text-sm text-gray-500">
                Tip: Use the "+" icon in the tab bar to create multiple subsystems for larger projects.
              </div>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center font-bold text-xl flex-shrink-0">2</div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Chat with the Engineering AGI</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Use the left sidebar to describe your project. You can write in English, Hindi, or Hinglish. 
              </p>
              <p className="text-gray-600 leading-relaxed mb-4">
                Example prompt: <em>"Mujhe ek weather station banana hai using ESP32 aur DHT22 sensor, aur usme ek OLED display bhi lagao."</em>
              </p>
              <p className="text-gray-600 leading-relaxed">
                The AI will process your request, select the correct components, and begin generating a step-by-step assembly tutorial.
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-bold text-xl flex-shrink-0">3</div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Observe the Canvas</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                As the AI replies, you will see components magically appear on the visual canvas. The AI will physically route wires (VCC, GND, SDA, SCL) and place them exactly where they need to go.
              </p>
              <p className="text-gray-600 leading-relaxed">
                You can drag to pan and use the scroll wheel to zoom in on specific microcontroller pins.
              </p>
            </div>
          </div>

          <div className="flex gap-6">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xl flex-shrink-0">4</div>
            <div>
              <h2 className="text-3xl font-bold mb-4">Simulate in the Terminal</h2>
              <p className="text-gray-600 leading-relaxed mb-4">
                Once wiring is complete, open the Terminal tab at the bottom. The AI will output the exact C++/Arduino code required.
              </p>
              <p className="text-gray-600 leading-relaxed">
                You can compile the code virtually and view simulated serial outputs to ensure the logic works perfectly before purchasing real hardware.
              </p>
            </div>
          </div>

        </div>
      </main>

    </div>
  );
}
