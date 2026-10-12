'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { Button } from '@/components/ui/button';

// Reusing FadeIn for smooth reveals
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
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

export function PricingSection() {
  const { user } = useAuth();
  const router = useRouter();
  
  const [selectedPlan, setSelectedPlan] = useState<{ id: string, name: string, price: string } | null>(null);
  const [error, setError] = useState('');
  const [loadingPlanId, setLoadingPlanId] = useState<string | null>(null);
  const [cashfreeInstance, setCashfreeInstance] = useState<any>(null);

  const handlePlanClick = async (planId: string, planName: string, price: string) => {
    if (!user) {
      router.push(planId === 'free' ? '/login?redirect=/ide' : '/login?redirect=' + encodeURIComponent('/#pricing'));
      return;
    }

    if (planId === 'free') {
      router.push('/ide');
      return;
    }

    setLoadingPlanId(planId);
    setError('');

    try {
      // 1. Create order session
      const response = await fetch('/api/cashfree/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          amount: price,
          customerId: user.uid,
          customerEmail: user.email,
        }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create payment session.');

      const paymentSessionId = data.payment_session_id;

      // 2. Ensure Cashfree instance is loaded on-demand
      let cf = cashfreeInstance;
      if (!cf) {
        const { load } = await import('@cashfreepayments/cashfree-js');
        cf = await load({
          mode: process.env.NEXT_PUBLIC_CASHFREE_ENV === 'PRODUCTION' ? 'production' : 'sandbox',
        });
        setCashfreeInstance(cf);
      }

      // 3. Launch checkout
      cf.checkout({
        paymentSessionId,
        redirectTarget: "_self",
      });
    } catch (err: any) {
      console.error("Checkout error:", err);
      setError(typeof err === 'string' ? err : (err.message || 'Payment initialization failed.'));
      setSelectedPlan({ id: planId, name: planName, price });
    } finally {
      setLoadingPlanId(null);
    }
  };

  return (
    <section id="pricing" className="pricing-section w-full py-28 px-6 md:px-12 relative z-10">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <FadeIn className="text-center mb-16 max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-5">Simple, transparent pricing.</h2>
          <p className="text-lg md:text-xl text-muted-foreground leading-relaxed">
            Start building for free. Upgrade for advanced reasoning and complex projects using our Pro models.
          </p>
        </FadeIn>

        <div className="price-grid grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-6xl">
          {/* Free Plan */}
          <FadeIn delay={0.05} className="price-card fabric-panel flex flex-col p-6 relative">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <p className="text-muted-foreground mb-4 text-sm">Perfect for learning and simple circuits.</p>
            <div className="text-4xl md:text-5xl font-black mb-6">₹0<span className="text-base text-muted-foreground font-normal">/mo</span></div>
            <ul className="flex flex-col gap-3.5 mb-8 flex-grow text-sm">
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">25k Daily Tokens</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="text-muted-foreground">Standard Speed</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="text-muted-foreground">Gemini 2.5 Flash & Lite</span></li>
            </ul>
            <Button 
              variant="outline" 
              onClick={() => handlePlanClick('free', 'Free', '0')} 
              className="w-full py-3.5 h-auto text-center font-bold"
            >
              Current Plan
            </Button>
          </FadeIn>

          {/* Starter Plan */}
          <FadeIn delay={0.1} className="price-card featured-price fabric-panel flex flex-col p-6 relative z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-primary text-primary-foreground px-3.5 py-0.5 rounded-full text-xs font-bold tracking-wider uppercase">POPULAR</div>
            <h3 className="text-2xl font-bold mb-2">Starter</h3>
            <p className="text-muted-foreground mb-4 text-sm">Unlock better reasoning (1 week).</p>
            <div className="text-4xl md:text-5xl font-black mb-6">₹39<span className="text-base text-muted-foreground font-normal">/1 week</span></div>
            <ul className="flex flex-col gap-3.5 mb-8 flex-grow text-sm">
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">50k Daily Tokens Quota</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-medium">Fast Processing Speed</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">Unlocks Gemini 3.5 Flash</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="text-muted-foreground">7 Days Full Access</span></li>
            </ul>
            <Button 
              disabled={loadingPlanId !== null}
              onClick={() => handlePlanClick('starter', 'Starter', '39')} 
              className="w-full py-3.5 h-auto text-center font-bold flex items-center justify-center gap-2 shadow-textile"
            >
              {loadingPlanId === 'starter' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Opening Checkout...</>
              ) : (
                'Pay ₹39 Now'
              )}
            </Button>
          </FadeIn>

          {/* Booster Plan */}
          <FadeIn delay={0.15} className="price-card fabric-panel flex flex-col p-6 relative">
            <h3 className="text-2xl font-bold mb-2">Booster</h3>
            <p className="text-muted-foreground mb-4 text-sm">For mid-term projects (2 weeks).</p>
            <div className="text-4xl md:text-5xl font-black mb-6">₹69<span className="text-base text-muted-foreground font-normal">/2 weeks</span></div>
            <ul className="flex flex-col gap-3.5 mb-8 flex-grow text-sm">
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">75k Daily Tokens Quota</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-medium">Priority Speed</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">Unlocks 3.5 & 3.6 Flash</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="text-muted-foreground">14 Days Full Access</span></li>
            </ul>
            <Button 
              disabled={loadingPlanId !== null}
              onClick={() => handlePlanClick('booster', 'Booster', '69')} 
              className="w-full py-3.5 h-auto text-center font-bold flex items-center justify-center gap-2 shadow-textile"
            >
              {loadingPlanId === 'booster' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Opening Checkout...</>
              ) : (
                'Pay ₹69 Now'
              )}
            </Button>
          </FadeIn>

          {/* Pro Plan */}
          <FadeIn delay={0.2} className="price-card fabric-panel flex flex-col p-6 relative">
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <p className="text-muted-foreground mb-4 text-sm">For serious builders (1 month).</p>
            <div className="text-4xl md:text-5xl font-black mb-6">₹169<span className="text-base text-muted-foreground font-normal">/1 month</span></div>
            <ul className="flex flex-col gap-3.5 mb-8 flex-grow text-sm">
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">100k Daily Tokens Quota</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-medium">Max Processing Speed</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="font-bold">Unlocks 3.7 & 3.8 Flash</span></li>
              <li className="flex items-center gap-2.5"><CheckCircle2 className="w-4 h-4 text-primary flex-shrink-0" /><span className="text-muted-foreground">30 Days Full Access</span></li>
            </ul>
            <Button 
              disabled={loadingPlanId !== null}
              onClick={() => handlePlanClick('pro', 'Pro', '169')} 
              className="w-full py-3.5 h-auto text-center font-bold flex items-center justify-center gap-2 shadow-textile"
            >
              {loadingPlanId === 'pro' ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Opening Checkout...</>
              ) : (
                'Pay ₹169 Now'
              )}
            </Button>
          </FadeIn>
        </div>

        {/* Enterprise / Custom Plan */}
        <FadeIn delay={0.25} className="mt-8 w-full max-w-6xl">
          <div className="fabric-panel p-8 md:p-10 flex flex-col md:flex-row items-center justify-between shadow-textile">
            <div className="mb-6 md:mb-0 text-center md:text-left">
              <h3 className="text-2xl md:text-3xl font-bold mb-2">Need Custom Tokens?</h3>
              <p className="text-muted-foreground max-w-xl text-sm md:text-base">
                Require massive token limits, custom enterprise models, or team API access? Contact our admin to get a personalized pricing plan tailored for your heavy workloads.
              </p>
            </div>
            <a 
              href="mailto:admin@kaktus.com?subject=Custom Enterprise Pricing Inquiry" 
              className="stitched-cta bg-foreground text-background font-bold py-3.5 px-8 rounded-xl transition-all duration-300 hover:scale-105 active:scale-95 shadow-textile whitespace-nowrap"
            >
              Contact Admin
            </a>
          </div>
        </FadeIn>
      </div>

      {/* Payment Modal */}
      <AnimatePresence>
        {selectedPlan && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setSelectedPlan(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              className="fabric-panel relative w-full max-w-md p-6 md:p-8 shadow-2xl flex flex-col overflow-hidden"
            >
              <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 text-muted-foreground hover:text-foreground transition-colors cursor-pointer">
                <X size={20} />
              </button>
              
              <h2 className="text-2xl font-bold mb-2 text-center">Complete Payment</h2>
              <p className="text-muted-foreground text-center mb-6 text-sm">Plan: {selectedPlan.name} (₹{selectedPlan.price})</p>

              <div className="flex flex-col items-center bg-card p-6 rounded-2xl border border-border mb-6">
                <p className="text-xs text-muted-foreground mb-2 font-medium uppercase tracking-wider">Total Amount</p>
                <div className="text-5xl font-black">₹{selectedPlan.price}</div>
              </div>

              {!user ? (
                <div className="flex flex-col gap-2 mt-2">
                  <p className="text-sm text-muted-foreground text-center mb-2">You must be logged in to proceed with payment.</p>
                  <Button 
                    onClick={() => router.push('/login?redirect=' + encodeURIComponent('/#pricing'))}
                    className="w-full py-3.5 font-bold"
                  >
                    Log In to Continue
                  </Button>
                </div>
              ) : (
                <div className="flex flex-col gap-4 mt-2">
                  {error && <p className="text-destructive text-xs text-center bg-destructive/10 p-3 rounded-lg border border-destructive/20">{error}</p>}
                  <Button 
                    onClick={() => handlePlanClick(selectedPlan.id, selectedPlan.name, selectedPlan.price)}
                    disabled={loadingPlanId !== null}
                    className="w-full py-3.5 font-bold flex items-center justify-center text-sm gap-2"
                  >
                    {loadingPlanId !== null ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Opening Gateway...</>
                    ) : (
                      `Pay ₹${selectedPlan.price} with Cashfree`
                    )}
                  </Button>
                  <p className="text-xs text-muted-foreground text-center mt-1">Payment will securely open in Cashfree checkout.</p>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
