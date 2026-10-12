'use client';

import { useState, Suspense } from 'react';
import { signInWithGoogle } from '@/lib/firebase';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

function LoginContent() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const user = await signInWithGoogle();
      const userEmail = (user?.email || '').toLowerCase().trim();
      const isSuperAdmin = userEmail === 'mahesh.gupta8952@gmail.com' || userEmail === 'dixitshubham68359@gmail.com';
      let role = isSuperAdmin ? 'SUPER_ADMIN' : 'USER';
      
      try {
        const tokenResult = await user?.getIdTokenResult(true);
        if (tokenResult?.claims?.role) {
          role = tokenResult.claims.role as string;
        }
      } catch (e) {
        console.warn('Could not read custom claims:', e);
      }

      let redirectTo = searchParams.get('redirect');
      if (typeof window !== 'undefined' && window.location.hash === '#pricing') {
        redirectTo = '/#pricing';
      }
      if (!redirectTo || redirectTo === '/') {
        if (role === 'ADMIN' || role === 'SUPER_ADMIN' || isSuperAdmin) {
          redirectTo = '/admin';
        } else {
          redirectTo = '/ide';
        }
      }

      if (redirectTo.includes('#pricing')) {
        window.location.href = redirectTo;
      } else {
        router.push(redirectTo);
      }
    } catch (err: any) {
      setError(err.message || "Failed to sign in. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen text-foreground flex flex-col justify-center items-center font-sans selection:bg-primary/20 px-6 relative z-10">
      <Link href="/" className="absolute top-8 left-8 flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
        Back
      </Link>

      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="fabric-panel login-panel w-full max-w-md p-10 text-center flex flex-col items-center shadow-textile"
      >
        <div className="w-16 h-16 bg-muted/40 rounded-2xl flex items-center justify-center mb-6 border border-border">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary">
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
        </div>

        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome Back</h1>
        <p className="text-muted-foreground mb-8">Sign in to access your Kaktus workspace.</p>

        {error && (
          <div className="w-full p-4 mb-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-xl text-sm text-left">
            {error}
          </div>
        )}

        <Button
          variant="outline"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full h-auto flex items-center justify-center gap-3 px-6 py-4 bg-card border border-input text-foreground font-bold rounded-xl hover:bg-muted transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:pointer-events-none shadow-textile cursor-pointer"
        >
          {loading ? (
            <svg className="animate-spin h-5 w-5 text-muted-foreground" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
          )}
          Continue with Google
        </Button>
        
        <p className="mt-8 text-xs text-muted-foreground">
          By continuing, you agree to Kaktus's Terms of Service and Privacy Policy.
        </p>
      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center text-foreground font-sans">Loading...</div>}>
      <LoginContent />
    </Suspense>
  );
}
