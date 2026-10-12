import Link from 'next/link';

export default function TermsPage() {
  return (
    <div className="min-h-screen py-20 px-6 relative z-10 text-foreground">
      <div className="fabric-panel max-w-3xl mx-auto p-8 md:p-12 shadow-textile">
        <Link href="/" className="text-primary hover:underline mb-8 inline-block font-bold">&larr; Back to Home</Link>
        <h1 className="text-4xl font-bold mb-8">Terms and Conditions</h1>
        
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-2xl font-bold text-foreground pt-4">1. Acceptance of Terms</h2>
          <p>By accessing and using Kaktus (the &ldquo;Service&rdquo;), you agree to be bound by these Terms and Conditions.</p>

          <h2 className="text-2xl font-bold text-foreground pt-4">2. Use License</h2>
          <p>Permission is granted to temporarily use the materials and features on our platform for personal, educational, or commercial hardware design purposes subject to your subscription plan.</p>

          <h2 className="text-2xl font-bold text-foreground pt-4">3. Subscriptions and Payments</h2>
          <p>Some features are billed on a subscription basis. You will be billed in advance according to your selected plan (Free, Starter, Booster, Pro). Payments are securely processed by authorized payment partners including Cashfree.</p>

          <h2 className="text-2xl font-bold text-foreground pt-4">4. Limitations</h2>
          <p>In no event shall Kaktus or its suppliers be liable for any damages arising out of the use or inability to use the platform.</p>
        </div>
      </div>
    </div>
  );
}
