// Razorpay webhook — update plan after successful payment
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const PLAN_LIMITS: Record<string, number> = {
  starter: 500,
  pro: 2000,
  agency: -1,
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const webhookSecret = Deno.env.get('RAZORPAY_WEBHOOK_SECRET') || ''
    const signature    = req.headers.get('x-razorpay-signature') || ''
    const body         = await req.text()

    // Verify webhook signature
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
    const sigBytes  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(body))
    const expected  = Array.from(new Uint8Array(sigBytes)).map(b => b.toString(16).padStart(2, '0')).join('')

    if (expected !== signature) {
      return new Response('Invalid signature', { status: 400 })
    }

    const event = JSON.parse(body)
    console.log('Razorpay event:', event.event)

    if (event.event === 'payment.captured') {
      const payment = event.payload.payment.entity
      const { user_id, plan_id } = payment.notes || {}

      if (!user_id || !plan_id) {
        console.error('Missing user_id or plan_id in notes')
        return new Response('ok', { headers: corsHeaders })
      }

      const db = createClient(
        Deno.env.get('SUPABASE_URL') || '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || ''
      )

      // Update user plan and reset usage
      const { error } = await db
        .from('profiles')
        .update({
          plan_id,
          leads_used: 0,
          stripe_subscription_id: payment.id, // reusing field for RP payment ID
        })
        .eq('id', user_id)

      if (error) console.error('Profile update error:', error)
      else console.log(`Updated user ${user_id} to plan ${plan_id}`)
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    console.error(err)
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
