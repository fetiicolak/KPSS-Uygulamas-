import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, BarChart, Bar, Cell
} from 'recharts'
import {
  Plus, ChevronDown, ChevronRight, Trash2, TrendingUp,
  TrendingDown, Minus, Sparkles, RefreshCw, BookOpen,
  CheckCircle, XCircle, AlertCircle, Target
} from 'lucide-react'

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY || ''

const DERSLER = [
  { id: 'Tarih',       emoji: '🏛️', renk: '#f59e0b', acik: '#fef3c7' },
  { id: 'Coğrafya',    emoji: '🗺️', renk: '#3b82f6', acik: '#dbeafe' },
  { id: 'Vatandaşlık', emoji: '⚖️', renk: '#8b5cf6', acik: '#ede9fe' },
  { id: 'Türkçe',      emoji: '📖', renk: '#ec4899', acik: '#fce7f3' },
  { id: 'Matematik',   emoji: '📐', renk: '#10b981', acik: '#d1fae5' },
]

async function geminiOner(prompt) {
  if (!GEMINI_API_KEY) return null
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.6, maxOutputTokens: 400 },
      }),
    }
  )
  const data = await res.json()
  if (data.error) return null
  return data.candidates?.[0]?.content?.parts?.[0]?.text || null
}

function NetHesapla(d, y) {
  return parseFloat(Math.max(0, d - y / 4).toFixed(2))
}

function BasariYuzde(d, toplam) {
  if (!toplam) return 0
  return Math.round((d / toplam) * 100)
}

function TrendIkonu({ deger }) {
  if (deger > 0) return <TrendingUp className="w-3.5 h-3.5 text-sage-500" />
  if (deger < 0) return <TrendingDown className="w-3.5 h-3.5 text-red-400" />
  return <Minus className="w-3.5 h-3.5 text-gray-400" />
}

export default function KonuTakip({ user }) {
  const [kayitlar, setKayitlar] = useState([])       // tüm konu_test_kayitlari
  const [acikDers, setAcikDers] = useState(null)
  const [acikKonu, setAcikKonu] = useState(null)
  const [eklemeAcik, setEklemeAcik] = useState(null) // { ders, konu } veya null
  const [yeniKonu, setYeniKonu] = useState('')
  const [yeniKonuDers, setYeniKonuDers] = useState(null)
  const [konuEklemeAcik, setKonuEklemeAcik] = useState(false)
  const [form, setForm] = useState({ toplam: '', dogru: '', yanlis: '', bos: '', tarih: new Date().toISOString().split('T')[0] })
  const [aiOnerileri, setAiOnerileri] = useState({}) // { 'Ders-Konu': 'metin' }
  const [aiYukleniyor, setAiYukleniyor] = useState({})
  const [loading, setLoading] = useState(false)

  const fetchKayitlar = useCallback(async () => {
    const { data } = await supabase
      .from('konu_test_kayitlari')
      .select('*')
      .eq('user_id', user.id)
      .order('tarih', { ascending: true })
    setKayitlar(data || [])
  }, [user.id])

  useEffect(() => { fetchKayitlar() }, [fetchKayitlar])

  // Belirli ders+konu'nun kayıtları
  function konuKayitlari(ders, konu) {
    return kayitlar.filter(k => k.ders === ders && k.konu === konu)
  }

  // Dersteki tüm benzersiz konular
  function dersKonulari(dersId) {
    const konular = [...new Set(kayitlar.filter(k => k.ders === dersId).map(k => k.konu))]
    return konular
  }

  // Ders özet istatistikleri
  function dersOzet(dersId) {
    const dersKayitlari = kayitlar.filter(k => k.ders === dersId)
    if (!dersKayitlari.length) return null
    const toplamDogru = dersKayitlari.reduce((s, k) => s + (k.dogru || 0), 0)
    const toplamSoru  = dersKayitlari.reduce((s, k) => s + (k.soru_sayisi || 0), 0)
    const sonKayit = dersKayitlari[dersKayitlari.length - 1]
    const oncekiKayit = dersKayitlari[dersKayitlari.length - 2]
    const sonBasari = BasariYuzde(sonKayit?.dogru || 0, sonKayit?.soru_sayisi || 1)
    const oncekiBasari = oncekiKayit ? BasariYuzde(oncekiKayit.dogru || 0, oncekiKayit.soru_sayisi || 1) : null
    return { toplamDogru, toplamSoru, basariYuzde: BasariYuzde(toplamDogru, toplamSoru), sonBasari, trend: oncekiBasari !== null ? sonBasari - oncekiBasari : null }
  }

  // Konu özet
  function konuOzet(ders, konu) {
    const list = konuKayitlari(ders, konu)
    if (!list.length) return null
    const son = list[list.length - 1]
    const onceki = list[list.length - 2]
    const sonNet = NetHesapla(son.dogru || 0, son.yanlis || 0)
    const oncekiNet = onceki ? NetHesapla(onceki.dogru || 0, onceki.yanlis || 0) : null
    const toplamDogru = list.reduce((s, k) => s + (k.dogru || 0), 0)
    const toplamSoru  = list.reduce((s, k) => s + (k.soru_sayisi || 0), 0)
    return {
      girisler: list.length,
      toplamSoru,
      toplamDogru,
      ortalama: BasariYuzde(toplamDogru, toplamSoru),
      sonNet,
      trend: oncekiNet !== null ? sonNet - oncekiNet : null,
    }
  }

  async function testKaydet(ders, konu) {
    const d = Number(form.dogru) || 0
    const y = Number(form.yanlis) || 0
    const b = Number(form.bos) || 0
    const t = Number(form.toplam) || (d + y + b)
    if (!t || !konu) return
    setLoading(true)
    await supabase.from('konu_test_kayitlari').insert({
      user_id: user.id,
      ders,
      konu,
      soru_sayisi: t,
      dogru: d,
      yanlis: y,
      bos: b,
      net: NetHesapla(d, y),
      tarih: form.tarih,
    })
    setForm({ toplam: '', dogru: '', yanlis: '', bos: '', tarih: new Date().toISOString().split('T')[0] })
    setEklemeAcik(null)
    await fetchKayitlar()
    setLoading(false)
  }

  async function kayitSil(id) {
    await supabase.from('konu_test_kayitlari').delete().eq('id', id)
    await fetchKayitlar()
  }

  async function aiOnerisiGetir(ders, konu) {
    const key = `${ders}-${konu}`
    if (aiOnerileri[key] || aiYukleniyor[key]) return
    setAiYukleniyor(prev => ({ ...prev, [key]: true }))

    const list = konuKayitlari(ders, konu)
    const ozet = list.map(k =>
      `${k.tarih}: ${k.soru_sayisi} soru, ${k.dogru}D ${k.yanlis}Y ${k.bos}B, net=${k.net}`
    ).join('\n')

    const prompt = `Sen bir KPSS hazırlık koçusun. Öğrencinin "${ders} - ${konu}" konusundaki test verileri:
${ozet}

Bu verilere bakarak:
1. Tek cümleyle gidişatı değerlendir (iyi mi, kötü mü, stabil mi)
2. Bu konuda somut 2 öneri ver

Türkçe, kısa ve net yaz. Emoji kullanabilirsin.`

    const oneri = await geminiOner(prompt)
    setAiOnerileri(prev => ({ ...prev, [key]: oneri || 'Öneri alınamadı.' }))
    setAiYukleniyor(prev => ({ ...prev, [key]: false }))
  }

  async function yeniKonuEkle(dersId) {
    if (!yeniKonu.trim()) return
    // Dummy kayıt yok, sadece konuyu kayıtlara eklemek için boş kayıt YOK
    // Bunun yerine ders altında konu grubunu track ediyoruz
    // Yeni konuyu "pending" state'de tutuyoruz, ilk test girişinde kaydolacak
    setEklemeAcik({ ders: dersId, konu: yeniKonu.trim() })
    setYeniKonu('')
    setKonuEklemeAcik(false)
    setYeniKonuDers(null)
  }

  // Grafik verisi
  function konuGrafikData(ders, konu) {
    return konuKayitlari(ders, konu).map((k, i) => ({
      isim: `Test ${i + 1}`,
      tarih: k.tarih,
      Net: k.net,
      'Başarı %': BasariYuzde(k.dogru, k.soru_sayisi),
      Doğru: k.dogru,
    }))
  }

  // Genel özet bar chart
  const genelBarData = DERSLER.map(d => {
    const oz = dersOzet(d.id)
    return { name: d.id.substring(0, 4), ders: d.id, basari: oz?.basariYuzde || 0, renk: d.renk }
  })

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Konu Takibi</h2>
        <div className="badge-green">{kayitlar.length} test kaydı</div>
      </div>

      {/* Genel Özet Bar */}
      {kayitlar.length >= 2 && (
        <div className="card">
          <h3 className="text-xs font-medium text-gray-500 mb-3">Ders Bazlı Başarı Oranları</h3>
          <ResponsiveContainer width="100%" height={130}>
            <BarChart data={genelBarData} barSize={32}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} domain={[0, 100]} tickFormatter={v => `%${v}`} />
              <Tooltip
                formatter={(val) => [`%${val}`, 'Başarı']}
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)', fontSize: 12 }}
              />
              <Bar dataKey="basari" radius={[6, 6, 0, 0]}>
                {genelBarData.map((entry, i) => (
                  <Cell key={i} fill={entry.renk} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Ders Listesi */}
      {DERSLER.map(ders => {
        const konular = dersKonulari(ders.id)
        // Eğer eklemeAcik.ders bu ders ise ve konu yoksa onu da göster
        const bekleyenKonu = eklemeAcik?.ders === ders.id ? eklemeAcik.konu : null
        const tumKonular = bekleyenKonu && !konular.includes(bekleyenKonu)
          ? [...konular, bekleyenKonu]
          : konular
        const oz = dersOzet(ders.id)
        const dersAcik = acikDers === ders.id

        return (
          <div key={ders.id} className="card p-0 overflow-hidden">
            {/* Ders Başlık */}
            <button
              onClick={() => { setAcikDers(dersAcik ? null : ders.id); setAcikKonu(null) }}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{ders.emoji}</span>
              <div className="flex-1 text-left">
                <span className="font-medium text-gray-800 text-sm">{ders.id}</span>
                {oz && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">%{oz.basariYuzde} başarı</span>
                    {oz.trend !== null && (
                      <span className={`text-[10px] font-medium flex items-center gap-0.5 ${oz.trend > 0 ? 'text-sage-500' : oz.trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                        <TrendIkonu deger={oz.trend} />
                        {oz.trend > 0 ? `+${oz.trend}` : oz.trend}%
                      </span>
                    )}
                  </div>
                )}
              </div>
              {oz && (
                <div className="text-right mr-2">
                  <div className="w-16">
                    <div className="progress-bar">
                      <div className="progress-fill" style={{ width: `${oz.basariYuzde}%`, background: ders.renk }} />
                    </div>
                  </div>
                </div>
              )}
              {dersAcik ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />}
            </button>

            {/* Konular */}
            {dersAcik && (
              <div className="border-t border-gray-50">
                {tumKonular.length === 0 && (
                  <div className="px-4 py-4 text-center text-xs text-gray-400">
                    Henüz konu eklenmemiş. Aşağıdan konu ekle.
                  </div>
                )}

                {tumKonular.map(konu => {
                  const konuAcik = acikKonu === `${ders.id}-${konu}`
                  const oz2 = konuOzet(ders.id, konu)
                  const grafikData = konuGrafikData(ders.id, konu)
                  const aiKey = `${ders.id}-${konu}`
                  const bekleyenBuKonu = eklemeAcik?.ders === ders.id && eklemeAcik?.konu === konu

                  return (
                    <div key={konu} className="border-b border-gray-50 last:border-0">
                      <button
                        onClick={() => setAcikKonu(konuAcik ? null : `${ders.id}-${konu}`)}
                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {konuAcik
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        }
                        <span className="text-sm text-gray-700 flex-1 text-left">{konu}</span>
                        {oz2 && (
                          <div className="flex items-center gap-2">
                            <span className={`text-xs font-medium ${oz2.ortalama >= 70 ? 'text-sage-500' : oz2.ortalama >= 50 ? 'text-amber-500' : 'text-red-400'}`}>
                              %{oz2.ortalama}
                            </span>
                            {oz2.trend !== null && <TrendIkonu deger={oz2.trend} />}
                          </div>
                        )}
                        {!oz2 && (
                          <span className="text-[10px] text-gray-300">Test girilmemiş</span>
                        )}
                      </button>

                      {konuAcik && (
                        <div className="px-4 pb-4 space-y-3 animate-slide-up">
                          {/* Özet İstatistikler */}
                          {oz2 && (
                            <div className="grid grid-cols-4 gap-2">
                              <div className="bg-gray-50 rounded-xl p-2 text-center">
                                <div className="text-sm font-bold text-gray-700">{oz2.girisler}</div>
                                <div className="text-[9px] text-gray-400">Test</div>
                              </div>
                              <div className="bg-sage-50 rounded-xl p-2 text-center">
                                <div className="text-sm font-bold text-sage-600">{oz2.toplamDogru}</div>
                                <div className="text-[9px] text-sage-400">Doğru</div>
                              </div>
                              <div className="bg-amber-50 rounded-xl p-2 text-center">
                                <div className="text-sm font-bold text-amber-600">%{oz2.ortalama}</div>
                                <div className="text-[9px] text-amber-400">Ort.</div>
                              </div>
                              <div className="bg-lavender-50 rounded-xl p-2 text-center">
                                <div className="text-sm font-bold text-lavender-400">{oz2.sonNet}</div>
                                <div className="text-[9px] text-lavender-300">Son Net</div>
                              </div>
                            </div>
                          )}

                          {/* Grafik */}
                          {grafikData.length >= 2 && (
                            <div className="bg-gray-50 rounded-xl p-3">
                              <p className="text-[10px] text-gray-400 mb-2">Net Gelişim</p>
                              <ResponsiveContainer width="100%" height={110}>
                                <LineChart data={grafikData}>
                                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                                  <XAxis dataKey="isim" tick={{ fontSize: 9 }} tickLine={false} />
                                  <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                                  <Tooltip
                                    contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 11, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
                                    labelFormatter={(_,payload) => payload?.[0]?.payload?.tarih || ''}
                                  />
                                  <Line type="monotone" dataKey="Net" stroke={ders.renk} strokeWidth={2.5} dot={{ fill: ders.renk, r: 4 }} />
                                  <Line type="monotone" dataKey="Başarı %" stroke="#a78bfa" strokeWidth={1.5} strokeDasharray="4 4" dot={false} />
                                </LineChart>
                              </ResponsiveContainer>
                            </div>
                          )}

                          {/* Test Geçmişi */}
                          {grafikData.length > 0 && (
                            <div>
                              <p className="text-[10px] text-gray-400 mb-1.5">Test Geçmişi</p>
                              <div className="space-y-1.5">
                                {konuKayitlari(ders.id, konu).map((k, i, arr) => {
                                  const onceki = arr[i - 1]
                                  const trend = onceki ? k.net - onceki.net : null
                                  return (
                                    <div key={k.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                                      <span className="text-[10px] text-gray-400 w-14 flex-shrink-0">{k.tarih}</span>
                                      <div className="flex gap-1.5 flex-1">
                                        <span className="text-[10px] px-1.5 py-0.5 bg-sage-100 text-sage-600 rounded-lg">{k.dogru}D</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-400 rounded-lg">{k.yanlis}Y</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-lg">{k.bos}B</span>
                                        <span className="text-[10px] px-1.5 py-0.5 bg-lavender-100 text-lavender-400 rounded-lg font-medium">/{k.soru_sayisi}</span>
                                      </div>
                                      <span className="text-xs font-bold" style={{ color: ders.renk }}>
                                        {k.net}
                                      </span>
                                      {trend !== null && (
                                        <span className={`text-[10px] ${trend > 0 ? 'text-sage-500' : trend < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                                          {trend > 0 ? `▲${trend.toFixed(1)}` : trend < 0 ? `▼${Math.abs(trend).toFixed(1)}` : '—'}
                                        </span>
                                      )}
                                      <button onClick={() => kayitSil(k.id)} className="p-0.5 hover:text-red-400 text-gray-200 transition-colors">
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* Yeni Test Giriş Formu */}
                          {bekleyenBuKonu || eklemeAcik?.ders === ders.id && eklemeAcik?.konu === konu ? (
                            <div className="bg-sage-50 border border-sage-100 rounded-xl p-3 animate-slide-up">
                              <p className="text-xs font-medium text-sage-700 mb-2">Test Sonucu Gir</p>
                              <div className="grid grid-cols-2 gap-2 mb-2">
                                <div>
                                  <label className="text-[10px] text-gray-500 mb-0.5 block">Tarih</label>
                                  <input type="date" className="input-field text-xs py-1.5" value={form.tarih} onChange={e => setForm({...form, tarih: e.target.value})} />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-500 mb-0.5 block">Toplam Soru</label>
                                  <input type="number" min="1" className="input-field text-xs py-1.5 text-center" placeholder="20" value={form.toplam} onChange={e => setForm({...form, toplam: e.target.value})} />
                                </div>
                              </div>
                              <div className="grid grid-cols-3 gap-2 mb-3">
                                <div>
                                  <label className="text-[10px] text-sage-600 mb-0.5 flex items-center gap-0.5"><CheckCircle className="w-2.5 h-2.5" /> Doğru</label>
                                  <input type="number" min="0" className="input-field text-xs py-1.5 text-center" placeholder="0" value={form.dogru} onChange={e => setForm({...form, dogru: e.target.value})} autoFocus />
                                </div>
                                <div>
                                  <label className="text-[10px] text-red-400 mb-0.5 flex items-center gap-0.5"><XCircle className="w-2.5 h-2.5" /> Yanlış</label>
                                  <input type="number" min="0" className="input-field text-xs py-1.5 text-center" placeholder="0" value={form.yanlis} onChange={e => setForm({...form, yanlis: e.target.value})} />
                                </div>
                                <div>
                                  <label className="text-[10px] text-gray-400 mb-0.5 flex items-center gap-0.5"><AlertCircle className="w-2.5 h-2.5" /> Boş</label>
                                  <input type="number" min="0" className="input-field text-xs py-1.5 text-center" placeholder="0" value={form.bos} onChange={e => setForm({...form, bos: e.target.value})} />
                                </div>
                              </div>
                              {(form.dogru || form.yanlis) && (
                                <p className="text-xs text-center text-lavender-400 mb-2 font-medium">
                                  Net: {NetHesapla(Number(form.dogru) || 0, Number(form.yanlis) || 0)}
                                </p>
                              )}
                              <div className="flex gap-2">
                                <button onClick={() => testKaydet(ders.id, konu)} disabled={loading} className="btn-primary text-xs py-1.5 px-3">
                                  Kaydet
                                </button>
                                <button onClick={() => setEklemeAcik(null)} className="btn-ghost text-xs py-1.5 px-3">
                                  İptal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setEklemeAcik({ ders: ders.id, konu })}
                              className="w-full py-2 text-xs text-sage-600 bg-sage-50 hover:bg-sage-100 rounded-xl transition-colors flex items-center justify-center gap-1"
                            >
                              <Plus className="w-3.5 h-3.5" /> Test Sonucu Ekle
                            </button>
                          )}

                          {/* AI Öneri */}
                          {oz2 && GEMINI_API_KEY && (
                            <div className="bg-lavender-50 border border-lavender-100 rounded-xl p-3">
                              <div className="flex items-center justify-between mb-2">
                                <span className="text-xs font-medium text-lavender-400 flex items-center gap-1">
                                  <Sparkles className="w-3 h-3" /> AI Koç Görüşü
                                </span>
                                <button
                                  onClick={() => aiOnerisiGetir(ders.id, konu)}
                                  disabled={aiYukleniyor[aiKey]}
                                  className="p-1 hover:bg-lavender-100 rounded-lg transition-colors"
                                >
                                  <RefreshCw className={`w-3 h-3 text-lavender-400 ${aiYukleniyor[aiKey] ? 'animate-spin' : ''}`} />
                                </button>
                              </div>
                              {aiOnerileri[aiKey] ? (
                                <p className="text-xs text-lavender-400 leading-relaxed">{aiOnerileri[aiKey]}</p>
                              ) : aiYukleniyor[aiKey] ? (
                                <p className="text-xs text-lavender-300">Analiz ediliyor...</p>
                              ) : (
                                <button
                                  onClick={() => aiOnerisiGetir(ders.id, konu)}
                                  className="text-xs text-lavender-300 hover:text-lavender-400 transition-colors"
                                >
                                  Koç görüşü al →
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Konu Ekleme */}
                {konuEklemeAcik && yeniKonuDers === ders.id ? (
                  <div className="px-4 py-3 border-t border-gray-50 bg-sage-50/50 animate-slide-up">
                    <input
                      className="input-field text-sm mb-2"
                      placeholder="Konu adı (örn: Osmanlı Devleti'nin Kuruluşu)"
                      value={yeniKonu}
                      onChange={e => setYeniKonu(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && yeniKonuEkle(ders.id)}
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button onClick={() => yeniKonuEkle(ders.id)} className="btn-primary text-xs py-1.5 px-3">Ekle</button>
                      <button onClick={() => { setKonuEklemeAcik(false); setYeniKonu(''); setYeniKonuDers(null) }} className="btn-ghost text-xs py-1.5 px-3">İptal</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => { setKonuEklemeAcik(true); setYeniKonuDers(ders.id); setAcikDers(ders.id) }}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs text-sage-600 hover:bg-sage-50 transition-colors border-t border-gray-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {ders.id} konusu ekle
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {kayitlar.length === 0 && (
        <div className="card text-center py-8 text-gray-400">
          <Target className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Henüz konu takibi yapılmamış</p>
          <p className="text-xs mt-1">Bir ders seç → Konu ekle → Test sonuçlarını gir 📊</p>
        </div>
      )}
    </div>
  )
}
