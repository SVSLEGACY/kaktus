'use client';

import dynamic from 'next/dynamic';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  Settings, Cpu, Cable, Zap, CircuitBoard, Usb, 
  TerminalSquare, Box, Component, MonitorDot, Database, Rocket,
  Brain, Code2, LogOut
} from 'lucide-react';
import { auth } from '@/lib/firebase';
import { signOut } from 'firebase/auth';

import { ScrollStitch } from '@/components/ScrollStitch';
import { useAuth } from '@/components/AuthProvider';
import embroideredBrain from '@/assets/embroidered-brain.png';

const HeroCanvas = dynamic(() => import('@/components/HeroCanvas'), { 
  ssr: false,
  loading: () => <div className="absolute inset-0 z-0 pointer-events-none" />
});

const PricingSection = dynamic(() => import('@/components/PricingSection').then(mod => mod.PricingSection), {
  ssr: false,
  loading: () => <div className="w-full py-28 text-center text-muted-foreground font-mono text-sm">Loading pricing...</div>
});

// Snappy typing animation component
function TypingText({ 
  text, 
  as: Component = "div", 
  className = "", 
  delaySpeed = 0.04, 
  duration = 0.3 
}: { 
  text: string; 
  as?: any; 
  className?: string; 
  delaySpeed?: number; 
  duration?: number;
}) {
  const words = text.split(" ");
  
  return (
    <Component className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          initial={{ opacity: 0, y: 8 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-10%" }}
          transition={{ duration: duration, delay: i * delaySpeed }}
          className="inline-block"
        >
          {word}&nbsp;
        </motion.span>
      ))}
      <motion.span 
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: words.length * delaySpeed, duration: 0.15 }}
        className="inline-block w-[3px] h-[0.9em] ml-1 rounded-sm bg-gradient-to-b from-yellow-500 via-green-500 to-orange-500 animate-pulse align-middle"
      />
    </Component>
  );
}

// Fade in component for sections
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-10%" }}
      transition={{ duration: 0.5, delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export default function LandingPage() {
  const { user } = useAuth();
  const icons = [
    Settings, CircuitBoard, Cpu, Cable, TerminalSquare, Box, 
    Component, Zap, Database, Usb, MonitorDot, Rocket
  ];

  const brainImgSrc = typeof embroideredBrain === 'string' 
    ? embroideredBrain 
    : (embroideredBrain as any)?.src || '/assets/embroidered-brain.png';

  return (
    <div className="kaktus-home w-full min-h-screen bg-background text-foreground font-sans selection:bg-primary/20 overflow-x-hidden">
      <ScrollStitch />
      
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
          <Link href="/how-to-use" className="hover:text-foreground transition-colors">How to Use</Link>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
        </nav>

        <div className="flex items-center gap-4">
          {!user ? (
            <Link 
              href="/login"
              className="px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-bold hover:scale-105 transition-all shadow-sm"
            >
              Sign In
            </Link>
          ) : (
            <Link 
              href="/ide"
              className="stitched-cta px-5 py-2.5 rounded-full bg-foreground text-background text-sm font-bold hover:scale-105 transition-all shadow-sm"
            >
              Open IDE
            </Link>
          )}
        </div>
      </header>

      {/* Hero Section */}
      <main className="fabric-hero relative w-full flex flex-col justify-center items-center text-center">
        {/* 3D Background */}
        <HeroCanvas />

        {/* Hero Content */}
        <div className="relative z-10 flex flex-col items-center max-w-5xl px-6 mt-10">
          <div className="flex items-center gap-2 mb-6">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <g stroke="url(#logoGrad)">
                <path d="M12 22V4" />
                <path d="M12 14H9a2 2 0 0 1-2-2V8" />
                <path d="M12 10h3a2 2 0 0 0 2-2V5" />
              </g>
            </svg>
            <span className="font-semibold text-xl">Kaktus</span>
          </div>
          
          <TypingText 
            text="Experience liftoff with the next-gen hardware platform"
            as="h1"
            delaySpeed={0.04}
            duration={0.35}
            className="hero-title leading-[1.12] font-black text-foreground mb-10 flex flex-wrap justify-center"
          />
        </div>
      </main>

      {/* Intro Arc Section */}
      <section className="intro-section w-full min-h-[60vh] flex flex-col items-center justify-center py-10 px-6 relative z-10">
        <div className="patch-arc flex justify-center items-end h-40 mb-16 gap-3 md:gap-5">
          {icons.map((Icon, i) => {
            const center = (icons.length - 1) / 2;
            const dist = Math.abs(i - center);
            const translateY = (dist * dist) * 1.5; 
            
            return (
              <motion.div 
                key={i}
                initial={{ opacity: 0, y: translateY + 20 }}
                whileInView={{ opacity: 1, y: translateY }}
                viewport={{ once: true, margin: "-10%" }}
                transition={{ duration: 0.4, delay: i * 0.03 }}
                className="icon-patch w-10 h-10 md:w-14 md:h-14 rounded-full flex items-center justify-center"
              >
                <Icon size={20} strokeWidth={1.5} />
              </motion.div>
            );
          })}
        </div>

        <div className="text-center px-4">
          <TypingText 
            text="Kaktus is our intelligent hardware engineering platform, allowing anyone to design, wire, and build in the AI-first era." 
            delaySpeed={0.025}
            duration={0.3}
            className="text-3xl md:text-5xl font-medium leading-tight flex flex-wrap gap-x-3 gap-y-2 justify-center max-w-4xl mx-auto"
          />
        </div>
      </section>

      {/* Intelligence Section */}
      <section className="intelligence-section relative w-full py-32 px-6 md:px-12">
        <div className="relative z-10 max-w-6xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-10 md:gap-16 items-center">
          <FadeIn>
            <div className="intelligence-badge w-14 h-14 flex items-center justify-center mb-8">
              <Brain className="w-7 h-7 text-accent" />
            </div>
            <h2 className="text-4xl md:text-6xl font-bold mb-6">Omniscient <span className="text-primary">Intelligence.</span></h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              We replaced thousands of datasheets and hours of manual routing with a single, omniscient AGI core that understands physics.
            </p>
            <Link href="/app-info" className="intelligence-link inline-flex items-center gap-2 text-accent font-bold hover:text-primary transition-colors">
              Read how the engine works <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </FadeIn>
          <FadeIn delay={0.15} className="intelligence-embroidery flex items-center justify-center">
            <img 
              src={brainImgSrc} 
              alt="Brain embroidered in cactus green and orange yarn" 
              loading="lazy" 
              width={1024} 
              height={1024} 
              className="w-full max-w-md h-auto drop-shadow-md" 
            />
          </FadeIn>
        </div>
      </section>

      {/* Simulation Section */}
      <section className="w-full py-32 px-6 md:px-12 relative z-10">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
          <FadeIn className="fabric-panel simulation-panel p-12 h-96 flex items-center justify-center order-2 md:order-1">
             <div className="flex flex-col gap-4 w-full max-w-xs">
               <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-primary w-3/4 animate-pulse"></div>
               </div>
               <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-secondary w-1/2 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
               </div>
               <div className="h-4 w-full bg-muted rounded-full overflow-hidden">
                 <div className="h-full bg-accent w-5/6 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
               </div>
             </div>
          </FadeIn>
          <FadeIn delay={0.15} className="order-1 md:order-2">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-8 border border-primary/20">
              <Code2 className="w-8 h-8 text-primary" />
            </div>
            <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Simulate Reality.</h2>
            <p className="text-xl text-muted-foreground leading-relaxed mb-8">
              Test your firmware directly against virtual hardware. The system compiles C++ instantly and simulates serial logic in real-time.
            </p>
            <Link href="/how-to-use" className="inline-flex items-center gap-2 text-primary font-medium hover:underline">
              See the step-by-step guide <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </Link>
          </FadeIn>
        </div>
      </section>
      
      {/* Pricing Section */}
      <PricingSection />

      {/* Complaint Section */}
      <section className="w-full py-24 px-6 relative z-10 flex justify-center">
        <FadeIn className="fabric-panel w-full max-w-3xl p-8 md:p-14 text-center relative overflow-hidden shadow-textile">
          <div className="relative z-10">
            <h3 className="text-3xl md:text-4xl font-bold mb-4 tracking-tight">Have an issue or complaint?</h3>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              We take your experience seriously. Drop your issue below and our engineering team will get back to you within <strong className="text-accent underline decoration-dashed">2 to 3 days</strong>.
            </p>
            <form 
              className="flex flex-col gap-4 text-left max-w-lg mx-auto" 
              onSubmit={(e) => { 
                e.preventDefault(); 
                alert('Thank you! Your complaint has been submitted. Our team will resolve it in 2-3 days.'); 
                (e.target as HTMLFormElement).reset(); 
              }}
            >
              <input 
                type="email" 
                placeholder="Your Email Address" 
                required 
                className="w-full px-5 py-4 rounded-xl border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 bg-card text-foreground placeholder-muted-foreground shadow-sm transition-all" 
              />
              <textarea 
                placeholder="Describe your issue or complaint in detail..." 
                required 
                rows={4} 
                className="w-full px-5 py-4 rounded-xl border border-input focus:outline-none focus:ring-2 focus:ring-primary/40 bg-card text-foreground placeholder-muted-foreground shadow-sm transition-all resize-none" 
              />
              <button 
                type="submit" 
                className="stitched-cta w-full bg-foreground text-background font-bold py-4 rounded-xl hover:scale-[1.02] transition-all shadow-md mt-2 cursor-pointer"
              >
                Submit Complaint
              </button>
            </form>
          </div>
        </FadeIn>
      </section>

      {/* Bottom CTA Section */}
      <section className="w-full py-36 px-6 flex flex-col items-center justify-center text-center relative z-10">
        <FadeIn className="flex flex-col items-center max-w-3xl">
          <div className="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mb-8 border border-primary/20">
            <Rocket className="text-primary w-10 h-10" />
          </div>
          <h2 className="text-5xl md:text-7xl font-bold tracking-tight mb-8">
            Ready to build?
          </h2>
          <p className="text-xl text-muted-foreground mb-12">
            Join the physical-first era. Enter the workspace and let Kaktus turn your ideas into reality.
          </p>
          <Link 
            href="/ide"
            className="stitched-cta group relative px-10 py-5 bg-foreground text-background text-xl font-bold rounded-full transition-all hover:scale-105 flex items-center gap-3 overflow-hidden shadow-2xl"
          >
            <span className="relative z-10 flex items-center gap-2">
              Enter Workspace 
              <svg className="w-6 h-6 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </span>
          </Link>
        </FadeIn>
      </section>

      {/* Footer */}
      <footer className="w-full relative z-10 border-t border-border/50 pt-16 pb-8 px-6 md:px-12 bg-background/50">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
          <div className="col-span-1 md:col-span-2">
            <Link href="/" className="flex items-center gap-2 mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
                <g stroke="url(#logoGrad)">
                  <path d="M12 22V4" />
                  <path d="M12 14H9a2 2 0 0 1-2-2V8" />
                  <path d="M12 10h3a2 2 0 0 0 2-2V5" />
                </g>
              </svg>
              <span className="font-bold text-xl tracking-tight">Kaktus</span>
            </Link>
            <p className="text-muted-foreground max-w-sm mb-6 leading-relaxed text-sm">
              The intelligent hardware engineering platform. Design, wire, and build in the AI-first era.
            </p>
          </div>
          
          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider">Legal</h4>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms & Conditions</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
              <li><Link href="/refund" className="hover:text-foreground transition-colors">Cancellation & Refund</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="font-bold mb-4 text-sm uppercase tracking-wider">Company</h4>
            <ul className="flex flex-col gap-2.5 text-sm text-muted-foreground">
              <li><Link href="/app-info" className="hover:text-foreground transition-colors">About Us</Link></li>
              <li><Link href="/how-to-use" className="hover:text-foreground transition-colors">How to Use</Link></li>
              <li><a href="mailto:admin@kaktus.com" className="hover:text-foreground transition-colors">Contact Us</a></li>
            </ul>
          </div>
        </div>
        
        <div className="max-w-7xl mx-auto pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Kaktus. All rights reserved.</p>
          <div className="flex gap-4">
            <p>Made with ❤️ for Hardware Engineers</p>
          </div>
        </div>
      </footer>

    </div>
  );
}
