'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { getAdminPaymentSettings, submitPaymentVerification, PaymentSettings } from '@/lib/payments';

// Reusing FadeIn for smooth reveals
function FadeIn({ children, delay = 0, className = "" }: { children: React.ReactNode, delay?: number, className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-15%" }}
      transition={{ duration: 0.8, delay }}
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
  const [paymentSettings, setPaymentSettings] = useState<PaymentSettings | null>(null);
  const [txnId, setTxnId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    getAdminPaymentSettings().then(setPaymentSettings);
  }, []);

  const handlePlanClick = (planId: string, planName: string, price: string) => {
    if (!user) {
      router.push(planId === 'free' ? '/login?redirect=/ide' : '/login?redirect=/#pricing');
      return;
    }

    if (planId === 'free') {
      router.push('/ide');
      return;
    }

    setSelectedPlan({ id: planId, name: planName, price });
    setTxnId('');
    setSuccess(false);
    setError('');
  };

  const handleSubmitTxn = async () => {
    if (!user) {
      setError('Please login first to submit your payment verification.');
      router.push('/login?redirect=/#pricing');
      return;
    }

    if (!txnId.trim()) {
      setError('Please enter the UPI Transaction ID (UTR)');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      await submitPaymentVerification(user.uid, user.email, selectedPlan!.id, txnId.trim());
      setSuccess(true);
      setTimeout(() => {
        setSelectedPlan(null);
        router.push('/ide');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to submit verification.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="pricing" className="w-full py-32 px-6 md:px-12 bg-transparent">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <FadeIn className="text-center mb-20 max-w-3xl">
          <h2 className="text-4xl md:text-6xl tracking-tight mb-6 stitched-text">Simple, transparent pricing.</h2>
          <p className="text-xl text-[#6b5e52] leading-relaxed">
            Start building for free. Upgrade for advanced reasoning and complex projects using our Pro models.
          </p>
        </FadeIn>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 w-full max-w-6xl">
          {/* Free Plan */}
          <FadeIn delay={0.1} className="flex flex-col p-8 felt-card relative">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <p className="text-gray-500 mb-6">Perfect for learning and simple circuits.</p>
            <div className="text-5xl font-black mb-8">₹0<span className="text-lg text-gray-400 font-normal">/week</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium text-black">25 Flash Runs / week</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Standard AI Models</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Circuit Canvas</span></li>
            </ul>
            <button onClick={() => handlePlanClick('free', 'Free', '0')} className="w-full py-4 text-center felt-btn-light">
              Get Started
            </button>
          </FadeIn>

          {/* 1 Week Plan */}
          <FadeIn delay={0.2} className="flex flex-col p-8 felt-card-highlight relative scale-105 z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 felt-badge">TESTING</div>
            <h3 className="text-2xl font-bold mb-2">Starter</h3>
            <p className="text-gray-500 mb-6">Try the full power for a week.</p>
            <div className="text-5xl font-black mb-8">₹29<span className="text-lg text-gray-400 font-normal">/week</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium">Unlimited Flash</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-bold text-black">10 Pro Runs</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Complex Reasoning</span></li>
            </ul>
            <button onClick={() => handlePlanClick('starter', 'Starter', '29')} className="w-full py-4 text-center felt-btn-green">
              Start Trial
            </button>
          </FadeIn>

          {/* 2 Week Plan */}
          <FadeIn delay={0.3} className="flex flex-col p-8 felt-card relative">
            <h3 className="text-2xl font-bold mb-2">Booster</h3>
            <p className="text-gray-500 mb-6">For your mid-term projects.</p>
            <div className="text-5xl font-black mb-8">₹59<span className="text-lg text-gray-400 font-normal">/2 wks</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium">Unlimited Flash</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-bold text-black">20 Pro Runs</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Zero-bug Generation</span></li>
            </ul>
            <button onClick={() => handlePlanClick('booster', 'Booster', '59')} className="w-full py-4 text-center felt-btn-dark">
              Upgrade
            </button>
          </FadeIn>

          {/* 1 Month Plan */}
          <FadeIn delay={0.4} className="flex flex-col p-8 felt-card relative">
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <p className="text-gray-500 mb-6">For serious builders and engineers.</p>
            <div className="text-5xl font-black mb-8">₹159<span className="text-lg text-gray-400 font-normal">/mo</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium">Unlimited Flash</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-bold text-black">50 Pro Runs</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Priority Processing</span></li>
            </ul>
            <button onClick={() => handlePlanClick('pro', 'Pro', '159')} className="w-full py-4 text-center felt-btn-dark">
              Upgrade
            </button>
          </FadeIn>
        </div>
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
              className="relative w-full max-w-md felt-patch p-6 md:p-8 shadow-2xl flex flex-col overflow-hidden"
            >
              <button onClick={() => setSelectedPlan(null)} className="absolute top-4 right-4 text-gray-400 hover:text-black">
                <X size={24} />
              </button>
              
              <h2 className="text-2xl font-bold mb-2 text-center text-black">Complete Payment</h2>
              <p className="text-gray-500 text-center mb-6">Plan: {selectedPlan.name} (₹{selectedPlan.price})</p>

              {success ? (
                <div className="flex flex-col items-center justify-center py-10">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                    <CheckCircle2 className="w-8 h-8 text-green-600" />
                  </div>
                  <h3 className="text-xl font-bold text-green-600 mb-2">Verification Pending</h3>
                  <p className="text-center text-gray-500">Your payment details have been submitted. Your plan will be activated shortly.</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
                    <p className="text-sm text-gray-500 mb-4 font-medium uppercase tracking-wider">Scan & Pay via UPI</p>
                    
                    <img src="/qr-code.png" alt="UPI QR Code" className="w-56 h-56 object-contain mb-4 rounded-xl border border-gray-200 bg-white p-2 shadow-sm" />

                    <div className="w-full flex items-center gap-3 bg-white p-3 rounded-xl border border-gray-100 shadow-sm mb-2 text-left">
                      <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <span className="text-xl">🏦</span>
                      </div>
                      <div className="flex-1">
                        <p className="font-semibold text-black leading-tight">Svc Co-operative Bank Ltd</p>
                        <p className="text-xs text-gray-500">X00213 • Primary</p>
                      </div>
                    </div>
                  </div>

                  {!user ? (
                    <div className="flex flex-col gap-2 mt-2">
                      <p className="text-sm text-gray-600 text-center mb-2">You must be logged in to submit a payment.</p>
                      <button 
                        onClick={() => router.push('/login?redirect=/#pricing')}
                        className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl transition-colors shadow-md flex items-center justify-center"
                      >
                        Log In to Continue
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <label className="text-sm font-semibold text-gray-700">UPI Transaction ID (UTR)</label>
                      <input 
                        type="text" 
                        value={txnId} 
                        onChange={e => setTxnId(e.target.value)} 
                        placeholder="e.g. 312345678901"
                        className="w-full px-4 py-3 rounded-xl border border-gray-300 focus:border-green-500 focus:ring-2 focus:ring-green-200 outline-none transition-all text-black"
                      />
                      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
                      
                      <button 
                        onClick={handleSubmitTxn}
                        disabled={submitting}
                        className="w-full mt-4 bg-green-500 hover:bg-green-600 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md flex items-center justify-center"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : "Submit Verification"}
                      </button>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </section>
  );
}
