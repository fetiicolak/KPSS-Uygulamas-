import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, RotateCcw, Check, X, Bell, Trash2, Brain, Star } from 'lucide-react'

export default function Flashcards({ user, notFromParent, onNotConsumed }) {
  const [kartlar, setKartlar] = useState([])
  const [bugunkartlar, setBugunkartlar] = useState([])
  const [aktifKart, setAktifKart] = useState(null)
  const [cevirili, setCevirili] = useState(false)
  const [yeniOn, setYeniOn] = useState('')
  const [yeniArka, setYeniArka] = useState('')
  const [eklemeAcik, setEklemeAcik] = useState(false)
  const [loading, setLoading] = useState(false)
  const [mod, setMod] = useState('liste') // 'liste' | 'tekrar'

  const bugun = new Date()

  const fetchKartlar = useCallback(async () => {
    const { data } = await supabase
      .from('flashcards')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
    setKartlar(data || [])

    // Bugün tekrar edilmesi gerekenler: 3 veya 7 gün önce görülenler
    const esik3 = new Date(bugun); esik3.setDate(esik3.getDate() - 3)
    const esik7 = new Date(bugun); esik7.setDate(esik7.getDate() - 7)

    const bekleyenler = (data || []).filter(k => {
      if (!k.son_gorulme) return true // Hiç görülmemiş
      const gorulme = new Date(k.son_gorulme)
      const fark = Math.floor((bugun - gorulme) / (1000 * 60 * 60 * 24))
      return fark >= 3
    })
    setBugunkartlar(bekleyenler)
  }, [user.id])

  useEffect(() => { fetchKartlar() }, [fetchKartlar])

  // Not'tan gelen kart talebi
  useEffect(() => {
    if (notFromParent) {
      setYeniOn(notFromParent.alt_baslik || '')
      setYeniArka(notFromParent.icerik ? notFromParent.icerik.substring(0, 200) : '')
      setEklemeAcik(true)
      onNotConsumed()
    }
  }, [notFromParent, onNotConsumed])

  async function kartEkle() {
    if (!yeniOn.trim() || !yeniArka.trim()) return
    setLoading(true)
    await supabase.from('flashcards').insert({
      user_id: user.id,
      on_yuz: yeniOn.trim(),
      arka_yuz: yeniArka.trim(),
    })
    setYeniOn('')
    setYeniArka('')
    setEklemeAcik(false)
    await fetchKartlar()
    setLoading(false)
  }

  async function kartGoster(kart) {
    setAktifKart(kart)
    setCevirili(false)
    // son_gorulme güncelle
    await supabase
      .from('flashcards')
      .update({ son_gorulme: new Date().toISOString(), gorulme_sayisi: (kart.gorulme_sayisi || 0) + 1 })
      .eq('id', kart.id)
  }

  async function zorluguGuncelle(id, zorluk) {
    await supabase.from('flashcards').update({ zorluk }).eq('id', id)
    await fetchKartlar()
    setAktifKart(null)
  }

  async function kartSil(id) {
    await supabase.from('flashcards').delete().eq('id', id)
    await fetchKartlar()
  }

  const zorlukRenk = {
    kolay: 'text-sage-500 bg-sage-50',
    orta: 'text-amber-500 bg-amber-50',
    zor: 'text-red-500 bg-red-50',
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Flashcard'larım</h2>
        <button onClick={() => setEklemeAcik(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Kart Ekle
        </button>
      </div>

      {/* Bugün Tekrar Edilmesi Gerekenler */}
      {bugunkartlar.length > 0 && (
        <div className="card bg-lavender-50 border border-lavender-100">
          <div className="flex items-center gap-2 mb-2">
            <Bell className="w-4 h-4 text-lavender-400" />
            <span className="text-sm font-medium text-lavender-400">Bugün Tekrar Et</span>
            <span className="badge bg-lavender-200 text-lavender-400">{bugunkartlar.length}</span>
          </div>
          <p className="text-xs text-lavender-300 mb-3">Bu kartları 3+ gün görmemişsin, tekrar vakti!</p>
          <div className="flex gap-2 flex-wrap">
            {bugunkartlar.slice(0, 3).map(k => (
              <button
                key={k.id}
                onClick={() => { kartGoster(k); setMod('tekrar') }}
                className="bg-white border border-lavender-200 text-lavender-400 text-xs px-3 py-1.5 rounded-xl hover:bg-lavender-50 transition-colors truncate max-w-[140px]"
              >
                {k.on_yuz}
              </button>
            ))}
            {bugunkartlar.length > 3 && (
              <span className="text-xs text-lavender-300 flex items-center">+{bugunkartlar.length - 3} daha</span>
            )}
          </div>
        </div>
      )}

      {/* Kart Ekleme Formu */}
      {eklemeAcik && (
        <div className="card border border-sage-100 animate-slide-up">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Yeni Flashcard</h3>
          <div className="space-y-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Ön Yüz (Soru)</label>
              <input
                className="input-field"
                placeholder="Kart sorusu veya konusu..."
                value={yeniOn}
                onChange={e => setYeniOn(e.target.value)}
                autoFocus
              />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Arka Yüz (Cevap)</label>
              <textarea
                className="textarea-field"
                rows={3}
                placeholder="Cevap veya açıklama..."
                value={yeniArka}
                onChange={e => setYeniArka(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={kartEkle} disabled={loading || !yeniOn.trim() || !yeniArka.trim()} className="btn-primary text-xs py-1.5 px-3">
                Kaydet
              </button>
              <button onClick={() => { setEklemeAcik(false); setYeniOn(''); setYeniArka('') }} className="btn-ghost text-xs py-1.5 px-3">
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aktif Kart - Tekrar Modu */}
      {aktifKart && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-card-hover">
            <div className="flex items-center justify-between mb-4">
              <span className="badge-lavender">
                <Brain className="w-3 h-3" /> Tekrar
              </span>
              <button onClick={() => setAktifKart(null)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            {/* Kart */}
            <div
              className="bg-gradient-to-br from-sage-50 to-lavender-50 rounded-2xl p-6 min-h-[140px] flex items-center justify-center text-center mb-4 cursor-pointer border border-sage-100"
              onClick={() => setCevirili(!cevirili)}
            >
              <div>
                <p className="text-xs text-gray-400 mb-2">{cevirili ? 'Arka Yüz' : 'Ön Yüz — tıkla çevir'}</p>
                <p className="text-base font-medium text-gray-800">
                  {cevirili ? aktifKart.arka_yuz : aktifKart.on_yuz}
                </p>
              </div>
            </div>

            {cevirili && (
              <div className="animate-slide-up">
                <p className="text-xs text-center text-gray-500 mb-3">Bu kartı nasıl değerlendirirsin?</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => zorluguGuncelle(aktifKart.id, 'kolay')}
                    className="bg-sage-50 text-sage-600 text-xs font-medium py-2 rounded-xl hover:bg-sage-100 transition-colors"
                  >
                    ✅ Kolay
                  </button>
                  <button
                    onClick={() => zorluguGuncelle(aktifKart.id, 'orta')}
                    className="bg-amber-50 text-amber-600 text-xs font-medium py-2 rounded-xl hover:bg-amber-100 transition-colors"
                  >
                    🤔 Orta
                  </button>
                  <button
                    onClick={() => zorluguGuncelle(aktifKart.id, 'zor')}
                    className="bg-red-50 text-red-500 text-xs font-medium py-2 rounded-xl hover:bg-red-100 transition-colors"
                  >
                    ❌ Zor
                  </button>
                </div>
              </div>
            )}

            {!cevirili && (
              <button
                onClick={() => setCevirili(true)}
                className="w-full btn-secondary flex items-center justify-center gap-2 mt-1"
              >
                <RotateCcw className="w-4 h-4" /> Kartı Çevir
              </button>
            )}
          </div>
        </div>
      )}

      {/* Kart Listesi */}
      {kartlar.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <Brain className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Henüz flashcard yok</p>
          <p className="text-xs mt-1">Ders notundan kart yap veya manuel ekle 🃏</p>
        </div>
      ) : (
        <div className="space-y-2">
          {kartlar.map(kart => (
            <div key={kart.id} className="card flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">{kart.on_yuz}</p>
                <p className="text-xs text-gray-400 truncate mt-0.5">{kart.arka_yuz}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${zorlukRenk[kart.zorluk] || zorlukRenk.orta}`}>
                    {kart.zorluk}
                  </span>
                  {kart.gorulme_sayisi > 0 && (
                    <span className="text-xs text-gray-400">{kart.gorulme_sayisi}× görüldü</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 flex-shrink-0">
                <button
                  onClick={() => kartGoster(kart)}
                  className="p-2 bg-sage-50 hover:bg-sage-100 text-sage-600 rounded-xl transition-colors"
                >
                  <Star className="w-4 h-4" />
                </button>
                <button
                  onClick={() => kartSil(kart.id)}
                  className="p-2 hover:bg-red-50 text-gray-300 hover:text-red-400 rounded-xl transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
