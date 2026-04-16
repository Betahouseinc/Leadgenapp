const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function triggerApify(
  actorId: string,
  input: unknown,
  apiKey: string,
  webhookUrl: string,
  meta: Record<string, string>
) {
  const webhookPayload = {
    eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
    requestUrl: webhookUrl,
    payloadTemplate: JSON.stringify({
      defaultDatasetId: '{{defaultDatasetId}}',
      actorRunId: '{{actorRunId}}',
      eventType: '{{eventType}}',
      ...meta,
    }),
  }

  const res = await fetch(
    `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...input as object, webhooks: [webhookPayload] }),
    }
  )
  if (!res.ok) throw new Error(`Apify trigger failed: ${await res.text()}`)
  return res.json()
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { industry, city, sources, limit } = await req.json()

    const apifyKey = Deno.env.get('APIFY_API_KEY') || ''
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || 'https://dbmtdeensqawntawaoyf.supabase.co'
    const webhookUrl = `${supabaseUrl}/functions/v1/apify-webhook`

    const tasks: Promise<unknown>[] = []

    if (sources.includes('gmaps')) {
      tasks.push(triggerApify(
        'nwua9Gu5YrADL7ZDj',
        {
          searchStringsArray: [`${industry} companies in ${city} India`],
          maxCrawledPlaces: Math.min(limit, 20),
          language: 'en',
          maxImages: 0,
          maxReviews: 0,
        },
        apifyKey,
        webhookUrl,
        { industry, city, source: 'gmaps' }
      ))
    }

    if (sources.includes('linkedin')) {
      tasks.push(triggerApify(
        'UwSdACBp7ymaGUJjS',
        {
          searchUrl: `https://www.linkedin.com/search/results/companies/?keywords=${encodeURIComponent(industry)}+${encodeURIComponent(city)}`,
          maxResults: Math.min(limit, 20),
        },
        apifyKey,
        webhookUrl,
        { industry, city, source: 'linkedin' }
      ))
    }

    await Promise.all(tasks)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Scrape started! Leads will appear in 5–10 minutes.',
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
