'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, X, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from './AuthProvider';
import { getAdminPaymentSettings, submitPaymentVerification, approvePayment, PaymentSettings } from '@/lib/payments';

declare global {
  interface Window {
    Razorpay: any;
  }
}
import { Button } from '@/components/ui/button';

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

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (window.Razorpay) {
        resolve(true);
        return;
      }
      
      const existingScript = document.getElementById("razorpay-sdk");
      if (existingScript) {
        // If it's already injecting but not loaded yet
        existingScript.addEventListener('load', () => resolve(true));
        existingScript.addEventListener('error', () => resolve(false));
        return;
      }
      
      const script = document.createElement("script");
      script.id = "razorpay-sdk";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  useEffect(() => {
    getAdminPaymentSettings().then(setPaymentSettings);
    loadRazorpay(); // Preload SDK
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

  const handleRazorpayPayment = async () => {
    if (!user) {
      setError('Please login first to submit your payment.');
      router.push('/login?redirect=/#pricing');
      return;
    }

    setSubmitting(true);
    setError('');

    const res = await loadRazorpay();
    if (!res) {
      setError('Razorpay SDK failed to load. Are you online?');
      setSubmitting(false);
      return;
    }

    const options = {
      key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || '', 
      amount: parseInt(selectedPlan!.price) * 100, // in paise
      currency: "INR",
      name: "Hardware Studio",
      description: `Subscription for ${selectedPlan!.name}`,
      handler: async function (response: any) {
        try {
          // Create the payment record
          const pId = await submitPaymentVerification(user.uid, user.email, selectedPlan!.id, response.razorpay_payment_id);
          // Automatically approve it since Razorpay checkout succeeded
          await approvePayment({
            id: pId,
            uid: user.uid,
            email: user.email,
            planId: selectedPlan!.id,
            txnId: response.razorpay_payment_id,
            status: 'pending',
            createdAt: new Date()
          });
          setSuccess(true);
          setTimeout(() => {
            setSelectedPlan(null);
            router.push('/ide');
          }, 3000);
        } catch (err: any) {
          setError(err.message || 'Failed to process payment.');
        }
      },
      prefill: {
        email: user.email || '',
      },
      theme: {
        color: "#2563eb",
      },
    };

    const paymentObject = new window.Razorpay(options);
    paymentObject.on("payment.failed", function (response: any) {
      setError(response.error.description || 'Payment failed');
      setSubmitting(false);
    });
    
    paymentObject.on("payment.modal.closed", function() {
      setSubmitting(false);
    });
    
    paymentObject.open();
  };

  return (
    <section id="pricing" className="pricing-section w-full py-32 px-6 md:px-12">
      <div className="max-w-7xl mx-auto flex flex-col items-center">
        <FadeIn className="text-center mb-20 max-w-3xl">
          <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-6">Simple, transparent pricing.</h2>
          <p className="text-xl text-gray-500 leading-relaxed">
            Start building for free. Upgrade for advanced reasoning and complex projects using our Pro models.
          </p>
        </FadeIn>

        <div className="price-grid grid grid-cols-1 md:grid-cols-4 gap-6 w-full max-w-6xl">
          {/* Free Plan */}
          <FadeIn delay={0.1} className="price-card fabric-panel flex flex-col p-6 relative">
            <h3 className="text-2xl font-bold mb-2">Free</h3>
            <p className="text-gray-500 mb-6">Perfect for learning and simple circuits.</p>
            <div className="text-5xl font-black mb-8">₹0<span className="text-lg text-gray-400 font-normal">/week</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium text-black">25 Flash Runs / week</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Standard AI Models</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Circuit Canvas</span></li>
            </ul>
            <Button variant="outline" onClick={() => handlePlanClick('free', 'Free', '0')} className="w-full py-4 h-auto text-center font-bold">
              Get Started
            </Button>
          </FadeIn>

          {/* 1 Week Plan */}
          <FadeIn delay={0.2} className="price-card featured-price fabric-panel flex flex-col p-6 relative z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-green-500 text-white px-4 py-1 rounded-full text-sm font-bold tracking-wide">TESTING</div>
            <h3 className="text-2xl font-bold mb-2">Starter</h3>
            <p className="text-gray-500 mb-6">Try the full power for a week.</p>
            <div className="text-5xl font-black mb-8">₹29<span className="text-lg text-gray-400 font-normal">/week</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium">Unlimited Flash</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-bold text-black">10 Pro Runs</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Complex Reasoning</span></li>
            </ul>
            <Button onClick={() => handlePlanClick('starter', 'Starter', '29')} className="w-full py-4 h-auto text-center font-bold">
              Start Trial
            </Button>
          </FadeIn>

          {/* 2 Week Plan */}
          <FadeIn delay={0.3} className="price-card fabric-panel flex flex-col p-6 relative">
            <h3 className="text-2xl font-bold mb-2">Booster</h3>
            <p className="text-gray-500 mb-6">For your mid-term projects.</p>
            <div className="text-5xl font-black mb-8">₹59<span className="text-lg text-gray-400 font-normal">/2 wks</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium">Unlimited Flash</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-bold text-black">20 Pro Runs</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Zero-bug Generation</span></li>
            </ul>
            <Button variant="secondary" onClick={() => handlePlanClick('booster', 'Booster', '59')} className="dark-patch w-full py-4 h-auto text-center font-bold">
              Upgrade
            </Button>
          </FadeIn>

          {/* 1 Month Plan */}
          <FadeIn delay={0.4} className="price-card fabric-panel flex flex-col p-6 relative">
            <h3 className="text-2xl font-bold mb-2">Pro</h3>
            <p className="text-gray-500 mb-6">For serious builders and engineers.</p>
            <div className="text-5xl font-black mb-8">₹159<span className="text-lg text-gray-400 font-normal">/mo</span></div>
            <ul className="flex flex-col gap-4 mb-8 flex-grow">
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-medium">Unlimited Flash</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600 font-bold text-black">50 Pro Runs</span></li>
              <li className="flex items-center gap-3"><CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0" /><span className="text-gray-600">Priority Processing</span></li>
            </ul>
            <Button variant="secondary" onClick={() => handlePlanClick('pro', 'Pro', '159')} className="dark-patch w-full py-4 h-auto text-center font-bold">
              Upgrade
            </Button>
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
              className="relative w-full max-w-md bg-white rounded-3xl p-6 md:p-8 shadow-2xl flex flex-col overflow-hidden fabric-panel"
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
                  <h3 className="text-xl font-bold text-green-600 mb-2">Payment Successful</h3>
                  <p className="text-center text-gray-500">Your plan has been activated successfully! Redirecting...</p>
                </div>
              ) : (
                <>
                  <div className="flex flex-col items-center bg-gray-50 p-6 rounded-2xl border border-gray-100 mb-6">
                    <p className="text-sm text-gray-500 mb-2 font-medium uppercase tracking-wider">Total Amount</p>
                    <div className="text-5xl font-black text-black">₹{selectedPlan.price}</div>
                  </div>

                  {!user ? (
                    <div className="flex flex-col gap-2 mt-2">
                      <p className="text-sm text-gray-600 text-center mb-2">You must be logged in to proceed with payment.</p>
                      <button 
                        onClick={() => router.push('/login?redirect=/#pricing')}
                        className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3.5 rounded-xl transition-colors shadow-md flex items-center justify-center"
                      >
                        Log In to Continue
                      </button>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2 mt-2">
                      {error && <p className="text-red-500 text-sm mb-3 text-center bg-red-50 p-2 rounded-lg">{error}</p>}
                      <button 
                        onClick={handleRazorpayPayment}
                        disabled={submitting}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-blue-500/30 flex items-center justify-center text-lg gap-2"
                      >
                        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : `Pay ₹${selectedPlan.price} Now`}
                      </button>
                      <p className="text-xs text-gray-400 text-center mt-3">Secured by Razorpay</p>
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
