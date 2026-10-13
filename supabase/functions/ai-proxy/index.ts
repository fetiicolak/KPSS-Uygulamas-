// AI istekleri için sunucu tarafı vekil (proxy).
// API key'ler Supabase secrets'ta tutulur; tarayıcıya ve repo'ya asla inmez.
// Yalnızca oturum açmış kullanıcılar çağırabilir. verify_jwt tek başına yetmez:
// herkese açık anon key de geçerli bir JWT olduğundan, burada gerçek kullanıcı aranır.

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_PROMPT_LENGTH = 20000

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

// Token'ı Supabase Auth'a sorar; anon key veya geçersiz/süresi dolmuş token için null döner.
async function getUserId(req: Request): Promise<string | null> {
  const token = req.headers.get('Authorization')?.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '' },
  })
  if (!res.ok) return null
  const user = await res.json()
  return typeof user?.id === 'string' ? user.id : null
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'yalnızca POST' }, 405)
  }
  if (!(await getUserId(req))) {
    return jsonResponse({ error: 'Bu özellik için giriş yapmalısın' }, 401)
  }

  try {
    const { provider, prompt } = await req.json()
    if (!prompt || typeof prompt !== 'string') {
      throw new Error('prompt gerekli')
    }
    if (prompt.length > MAX_PROMPT_LENGTH) {
      throw new Error('prompt çok uzun')
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
