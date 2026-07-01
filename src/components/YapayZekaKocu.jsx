import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Sparkles, RefreshCw, Calendar, TrendingUp, Brain, ChevronDown, ChevronUp } from 'lucide-react'

const OPENROUTER_API_KEY = import.meta.env.VITE_OPENROUTER_API_KEY || ''

async function geminiAnalyze(prompt) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'HTTP-Referer': 'https://fetiicolak.github.io/KPSS-Uygulamas-/',
      'X-Title': 'KPSS Asistanim',
    },
    body: JSON.stringify({
      model: 'google/gemini-2.0-flash-exp:free',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1200,
      temperature: 0.7,
    }),
  })
  const data = await res.json()
  if (data.error) throw new Error(data.error.message)
  return data.choices?.[0]?.message?.content || 'Yanıt alınamadı.'
}

export default function YapayZekaKocu({ user }) {
  const [raporlar, setRaporlar] = useState([])
  const [loading, setLoading] = useState(false)
  const [hata, setHata] = useState('')
  const [acikRapor, setAcikRapor] = useState(null)
  const [istatistik, setIstatistik] = useState(null)
  const [chatModu, setChatModu] = useState(false)
  const [chatMesaj, setChatMesaj] = useState('')
  const [chatGecmisi, setChatGecmisi] = useState([])
  const [chatLoading, setChatLoading] = useState(false)

  const fetchRaporlar = useCallback(async () => {
    const { data } = await supabase
      .from('ai_raporlar')
      .select('*')
      .eq('user_id', user.id)
      .order('hafta_basi', { ascending: false })
      .limit(5)
    setRaporlar(data || [])
  }, [user.id])

  const fetchIstatistik = useCallback(async () => {
    const bitis = new Date().toISOString().split('T')[0]
    const baslangic = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [takvimRes, denemeRes, hataRes, flashcardRes] = await Promise.all([
      supabase.from('takvim_hedefleri').select('tamamlandi').eq('user_id', user.id).gte('tarih', baslangic),
      supabase.from('denemeler').select('*').eq('user_id', user.id).gte('tarih', baslangic),
      supabase.from('hata_havuzu').select('konu, yanlis_sayisi').eq('user_id', user.id).eq('cozuldu', false),
      supabase.from('flashcards').select('zorluk').eq('user_id', user.id),
    ])

    const takvim = takvimRes.data || []
    const denemeler = denemeRes.data || []
    const hatalar = hataRes.data || []
    const kartlar = flashcardRes.data || []

    const tamamlanan = takvim.filter(t => t.tamamlandi).length
    const hedefToplam = takvim.length
    const takvimOrani = hedefToplam > 0 ? Math.round((tamamlanan / hedefToplam) * 100) : 0

    const sonDenemeNetleri = denemeler.map(d => ({
      isim: d.deneme_adi || d.tarih,
      gyNet: Math.max(0, d.gy_dogru - d.gy_yanlis / 4).toFixed(1),
      gkNet: Math.max(0, d.gk_dogru - d.gk_yanlis / 4).toFixed(1),
    }))

    setIstatistik({
      takvimOrani,
      hedefToplam,
      tamamlanan,
      sonDenemeNetleri,
      hatalarSayisi: hatalar.length,
      kritikHatalar: hatalar.filter(h => h.yanlis_sayisi >= 3),
      kartSayisi: kartlar.length,
      zorKart: kartlar.filter(k => k.zorluk === 'zor').length,
    })
  }, [user.id])

  useEffect(() => {
    fetchRaporlar()
    fetchIstatistik()
  }, [fetchRaporlar, fetchIstatistik])

  async function raporOlustur() {
    if (!OPENROUTER_API_KEY) {
      setHata('VITE_OPENROUTER_API_KEY ortam değişkeni ayarlanmamış. .env dosyasına ekle.')
      return
    }
    if (!istatistik) return
    setLoading(true)
    setHata('')

    const hafta = new Date().toISOString().split('T')[0]
    const prompt = `Sen bir KPSS hazırlık koçusun. Aşağıdaki verilere göre bu öğrenci için samimi, motive edici ve kişiselleştirilmiş Türkçe bir haftalık analiz raporu yaz.

**Bu Haftaki Veriler:**
- Takvim Hedef Tamamlama: ${istatistik.takvimOrani}% (${istatistik.tamamlanan}/${istatistik.hedefToplam} hedef)
- Son Deneme Netleri: ${istatistik.sonDenemeNetleri.map(d => `${d.isim}: GY=${d.gyNet}, GK=${d.gkNet}`).join(' | ') || 'Deneme girilmemiş'}
- Hata Havuzundaki Çözülmemiş Soru: ${istatistik.hatalarSayisi}
- Kritik Eksik Konu Sayısı (3+ yanlış): ${istatistik.kritikHatalar.length}
- Flashcard Sayısı: ${istatistik.kartSayisi} (Zor: ${istatistik.zorKart})

**Rapor formatı:**
1. 💪 Bu Hafta Nasıldı? (2-3 cümle değerlendirme)
2. 📈 Dikkat Çeken Noktalar (iyi giden ve geliştirilmesi gereken)
3. 🎯 Gelecek Hafta İçin Öncelikler (somut 3 madde)
4. 🌟 Motivasyon Mesajı (içten ve kişisel, 2-3 cümle)

Sınav tarihi: 6 Eylül 2026. Samimi ve pozitif bir dil kullan, abartmadan motive et.`

    try {
      const rapor = await geminiAnalyze(prompt)

      await supabase.from('ai_raporlar').insert({
        user_id: user.id,
        hafta_basi: hafta,
        rapor_metni: rapor,
      })

      await fetchRaporlar()
      setAcikRapor(0)
    } catch (e) {
      setHata('Rapor oluşturulamadı: ' + e.message)
    }
    setLoading(false)
  }

  async function chatGonder() {
    if (!chatMesaj.trim() || !OPENROUTER_API_KEY) return
    setChatLoading(true)
    const kullanicimesaj = chatMesaj.trim()
    setChatMesaj('')
    setChatGecmisi(prev => [...prev, { rol: 'kullanici', metin: kullanicimesaj }])

    const baglamPrompt = `Sen bir KPSS hazırlık koçusun. ${istatistik ? `Kullanıcının bu haftaki takvim tamamlama oranı: %${istatistik.takvimOrani}, hata havuzunda ${istatistik.hatalarSayisi} çözülmemiş soru var.` : ''} Türkçe, kısa ve yardımcı cevap ver. Soru: "${kullanicimesaj}"`

    try {
      const cevap = await geminiAnalyze(baglamPrompt)
      setChatGecmisi(prev => [...prev, { rol: 'ai', metin: cevap }])
    } catch (e) {
      setChatGecmisi(prev => [...prev, { rol: 'ai', metin: 'Bir hata oluştu: ' + e.message }])
    }
    setChatLoading(false)
  }

  const buHaftaPazartesi = () => {
    const d = new Date()
    const gun = d.getDay()
    const fark = gun === 0 ? 6 : gun - 1
    d.setDate(d.getDate() - fark)
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-lavender-400" />
          Yapay Zeka Koçum
        </h2>
      </div>

      {/* API Key Uyarısı */}
      {!OPENROUTER_API_KEY && (
        <div className="card bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-700">
            <strong>Yapay Zeka servisi yapılandırılmamış!</strong><br />
            Proje kök klasöründe <code className="bg-amber-100 px-1 rounded">.env</code> dosyası oluştur:<br />
            <code className="bg-amber-100 px-1 rounded text-[10px]">VITE_OPENROUTER_API_KEY=YOUR_KEY_HERE</code>
          </p>
        </div>
      )}

      {/* Bu Haftanın Özeti */}
      {istatistik && (
        <div className="card">
          <h3 className="text-xs font-medium text-gray-500 mb-3">{buHaftaPazartesi()} haftası — Durum Özeti</h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-sage-50 rounded-xl p-3">
              <div className="text-xl font-bold text-sage-600">%{istatistik.takvimOrani}</div>
              <div className="text-xs text-sage-500">Hedef Tamamlama</div>
            </div>
            <div className="bg-lavender-50 rounded-xl p-3">
              <div className="text-xl font-bold text-lavender-400">{istatistik.hatalarSayisi}</div>
              <div className="text-xs text-lavender-300">Bekleyen Hata</div>
            </div>
          </div>
          {istatistik.sonDenemeNetleri.length > 0 && (
            <div className="mt-2 bg-amber-50 rounded-xl p-3">
              <p className="text-xs text-amber-600 font-medium mb-1">Son Deneme:</p>
              <p className="text-xs text-amber-500">
                GY: {istatistik.sonDenemeNetleri[istatistik.sonDenemeNetleri.length - 1]?.gyNet} net ·
                GK: {istatistik.sonDenemeNetleri[istatistik.sonDenemeNetleri.length - 1]?.gkNet} net
              </p>
            </div>
          )}
        </div>
      )}

      {/* Rapor Oluştur */}
      <button
        onClick={raporOlustur}
        disabled={loading || !OPENROUTER_API_KEY}
        className="w-full py-3 bg-gradient-to-r from-lavender-300 to-lavender-400 text-white rounded-2xl font-medium text-sm flex items-center justify-center gap-2 shadow-card active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <><RefreshCw className="w-4 h-4 animate-spin" /> Rapor hazırlanıyor...</>
        ) : (
          <><Sparkles className="w-4 h-4" /> Haftalık Rapor Oluştur</>
        )}
      </button>

      {hata && (
        <div className="card bg-red-50 border border-red-100">
          <p className="text-xs text-red-600">{hata}</p>
        </div>
      )}

      {/* Geçmiş Raporlar */}
      {raporlar.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-gray-500 px-1">Geçmiş Raporlar</h3>
          {raporlar.map((rapor, idx) => (
            <div key={rapor.id} className="card">
              <button
                onClick={() => setAcikRapor(acikRapor === idx ? null : idx)}
                className="w-full flex items-center justify-between"
              >
                <div className="flex items-center gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-lavender-400" />
                  <span className="text-sm font-medium text-gray-700">{rapor.hafta_basi} Haftası</span>
                </div>
                {acikRapor === idx
                  ? <ChevronUp className="w-4 h-4 text-gray-400" />
                  : <ChevronDown className="w-4 h-4 text-gray-400" />
                }
              </button>
              {acikRapor === idx && (
                <div className="mt-3 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap bg-lavender-50 rounded-xl p-3 border border-lavender-100 animate-slide-up">
                  {rapor.rapor_metni}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Koçla Sohbet */}
      <div className="card">
        <button
          onClick={() => setChatModu(!chatModu)}
          className="w-full flex items-center gap-2 text-left"
        >
          <Brain className="w-4 h-4 text-lavender-400" />
          <span className="text-sm font-medium text-gray-700 flex-1">Koça Soru Sor</span>
          {chatModu ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </button>

        {chatModu && (
          <div className="mt-3 animate-slide-up">
            {/* Chat geçmişi */}
            {chatGecmisi.length > 0 && (
              <div className="space-y-2 mb-3 max-h-60 overflow-y-auto">
                {chatGecmisi.map((m, i) => (
                  <div key={i} className={`flex ${m.rol === 'kullanici' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`text-xs px-3 py-2 rounded-xl max-w-[85%] leading-relaxed ${
                      m.rol === 'kullanici'
                        ? 'bg-sage-500 text-white'
                        : 'bg-lavender-50 text-gray-700 border border-lavender-100'
                    }`}>
                      {m.metin}
                    </div>
                  </div>
                ))}
                {chatLoading && (
                  <div className="flex justify-start">
                    <div className="bg-lavender-50 border border-lavender-100 px-3 py-2 rounded-xl">
                      <div className="flex gap-1">
                        <div className="w-1.5 h-1.5 bg-lavender-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <div className="w-1.5 h-1.5 bg-lavender-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <div className="w-1.5 h-1.5 bg-lavender-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-2">
              <input
                className="input-field flex-1 text-sm"
                placeholder="Koçuna bir şey sor..."
                value={chatMesaj}
                onChange={e => setChatMesaj(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && chatGonder()}
                disabled={!OPENROUTER_API_KEY || chatLoading}
              />
              <button
                onClick={chatGonder}
                disabled={!chatMesaj.trim() || !OPENROUTER_API_KEY || chatLoading}
                className="btn-primary px-3 py-2"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
