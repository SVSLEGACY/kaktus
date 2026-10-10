import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { planId, amount, customerId, customerEmail, customerPhone } = await req.json();

    if (!amount || !customerId || !planId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const orderId = `order_${Date.now()}_${customerId.substring(0, 10)}`;
    
    const isProd = process.env.CASHFREE_ENV === 'PRODUCTION';
    const endpoint = isProd ? 'https://api.cashfree.com/pg/orders' : 'https://sandbox.cashfree.com/pg/orders';

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'x-client-id': process.env.CASHFREE_APP_ID || '',
        'x-client-secret': process.env.CASHFREE_SECRET_KEY || '',
        'x-api-version': '2023-08-01',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        order_amount: amount,
        order_currency: 'INR',
        customer_details: {
          customer_id: customerId,
          customer_email: customerEmail || 'guest@example.com',
          customer_phone: customerPhone || '9999999999',
        },
        order_meta: {
          return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'https://yc-drab.vercel.app'}/verify-payment?order_id={order_id}&plan_id=${planId}`
        }
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      console.error('Cashfree Create Order Error:', data);
      throw new Error(data.message || 'Failed to create Cashfree order');
    }

    return NextResponse.json({
      payment_session_id: data.payment_session_id,
      order_id: data.order_id
    });
  } catch (error: any) {
    console.error("Cashfree Order API Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
