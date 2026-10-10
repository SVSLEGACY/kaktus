import { NextResponse } from 'next/server';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { utr, amount, secret } = body;

    // A simple secret to prevent random people from hitting this endpoint
    const validSecret = process.env.SMS_WEBHOOK_SECRET || 'my-super-secret-key';
    
    if (secret !== validSecret) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!utr) {
      return NextResponse.json({ error: 'UTR is required' }, { status: 400 });
    }

    // Save the received UTR to Firestore
    const utrRef = doc(db, 'received_utrs', String(utr).trim());
    await setDoc(utrRef, {
      utr: String(utr).trim(),
      amount: amount || 0,
      used: false,
      receivedAt: serverTimestamp()
    });

    return NextResponse.json({ success: true, message: 'UTR saved successfully' });
  } catch (error: any) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
