// Razorpay — create order
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const PLANS: Record<string, { name: string; amount: number; leads_per_month: number }> = {
  starter: { name: 'Starter', amount: 99900,  leads_per_month: 500  }, // paise
  pro:     { name: 'Pro',     amount: 299900, leads_per_month: 2000 },
  agency:  { name: 'Agency',  amount: 799900, leads_per_month: -1   },
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { plan_id } = await req.json()
    const plan = PLANS[plan_id]
    if (!plan) throw new Error('Invalid plan')

    const rpKeyId     = Deno.env.get('RAZORPAY_KEY_ID') || ''
    const rpKeySecret = Deno.env.get('RAZORPAY_KEY_SECRET') || ''

    // Get user
    const authHeader = req.headers.get('Authorization') || ''
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') || '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
    )
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''))
    if (!user) throw new Error('Unauthorized')

    // Create Razorpay order
    const credentials = btoa(`${rpKeyId}:${rpKeySecret}`)
    const orderRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: 'INR',
        receipt: `order_${user.id}_${plan_id}_${Date.now()}`,
        notes: { user_id: user.id, plan_id },
      }),
    })

    if (!orderRes.ok) throw new Error(`Razorpay error: ${await orderRes.text()}`)
    const order = await orderRes.json()

    return new Response(
      JSON.stringify({
        order_id: order.id,
        amount: order.amount,
        currency: order.currency,
        plan_name: plan.name,
        key_id: rpKeyId,
        user_email: user.email,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
