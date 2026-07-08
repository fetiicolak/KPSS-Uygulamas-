// AI istekleri için sunucu tarafı vekil (proxy).
// API key'ler Supabase secrets'ta tutulur; tarayıcıya ve repo'ya asla inmez.
// Çağıran tarafın geçerli bir Supabase JWT'si olmalı (verify_jwt varsayılan açık).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { provider, prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt gerekli')
    }

    let text: string | null = null

    if (provider === 'groq') {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('GROQ_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'llama-3.3-70b-versatile',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 1200,
          temperature: 0.7,
        }),
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error.message || 'Groq hatası')
      text = data.choices?.[0]?.message?.content ?? null
    } else if (provider === 'gemini') {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.6, maxOutputTokens: 800, thinkingConfig: { thinkingBudget: 0 } },
          }),
        },
      )
      const data = await res.json()
      if (data.error) throw new Error(data.error.message || 'Gemini hatası')
      text = data.candidates?.[0]?.content?.parts?.[0]?.text ?? null
    } else {
      throw new Error('geçersiz provider: groq veya gemini olmalı')
    }

    return new Response(JSON.stringify({ text }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
