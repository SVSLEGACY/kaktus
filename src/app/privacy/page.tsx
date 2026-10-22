import Link from 'next/link';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen py-20 px-6 relative z-10 text-foreground">
      <div className="fabric-panel max-w-3xl mx-auto p-8 md:p-12 shadow-textile">
        <Link href="/" className="text-primary hover:underline mb-8 inline-block font-bold">&larr; Back to Home</Link>
        <h1 className="text-4xl font-bold mb-8">Privacy Policy</h1>
        
        <div className="space-y-6 text-muted-foreground leading-relaxed">
          <p>Last updated: {new Date().toLocaleDateString()}</p>
          
          <h2 className="text-2xl font-bold text-foreground pt-4">1. Information We Collect</h2>
          <p>We collect information you provide directly to us when you create an account, subscribe to a plan, or contact our support team. This includes your email address, name, and usage data within our IDE.</p>

          <h2 className="text-2xl font-bold text-foreground pt-4">2. How We Use Your Information</h2>
          <p>We use the information to provide, maintain, and improve our services, process transactions, send related information (including confirmations and invoices), and provide customer support.</p>

          <h2 className="text-2xl font-bold text-foreground pt-4">3. Data Security</h2>
          <p>We implement appropriate technical and organizational measures to protect your personal data against unauthorized or unlawful processing.</p>

          <h2 className="text-2xl font-bold text-foreground pt-4">4. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy, please contact us at admin@kaktus.com.</p>
        </div>
      </div>
    </div>
  );
}
