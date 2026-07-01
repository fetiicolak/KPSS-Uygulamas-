import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Timer, Lock, CheckCircle, XCircle, AlertCircle, Sparkles } from 'lucide-react'

const SINAV_TARIHI = new Date('2026-09-06T10:00:00')

function useCountdown() {
  const [timeLeft, setTimeLeft] = useState({})
  useEffect(() => {
    function calc() {
      const now  = new Date()
      const diff = SINAV_TARIHI - now
      if (diff <= 0) return setTimeLeft({ passed: true })
      setTimeLeft({
        days:    Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours:   Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60)),
        seconds: Math.floor((diff % (1000 * 60)) / 1000),
      })
    }
    calc()
    const id = setInterval(calc, 1000)
    return () => clearInterval(id)
  }, [])
  return timeLeft
}

export default function Dashboard({ user, onUnlocked }) {
  const timeLeft = useCountdown()
  const [sorular, setSorular]               = useState([])
  const [cevaplar, setCevaplar]             = useState({})
  const [sonuclar, setSonuclar]             = useState({})
  const [loading, setLoading]               = useState(true)
  const [gununTamamlandi, setGununTamamlandi] = useState(false)

  const bugun = new Date().toISOString().split('T')[0]

  const fetchGunlukSorular = useCallback(async () => {
    setLoading(true)

    // Bugün zaten çözülmüş mü?
    const { data: mevcutlar } = await supabase
      .from('gunluk_sorular')
      .select('*, cikmis_sorular(*)')
      .eq('user_id', user.id)
      .eq('tarih', bugun)

    if (mevcutlar && mevcutlar.length > 0) {
      const sorularData = mevcutlar.map(m => m.cikmis_sorular).filter(Boolean)
      setSorular(sorularData)
      const cevapMap = {}, sonucMap = {}
      mevcutlar.forEach(m => {
        if (m.cevap) {
          cevapMap[m.soru_id] = m.cevap
          sonucMap[m.soru_id] = m.dogru_mu
        }
      })
      setCevaplar(cevapMap)
      setSonuclar(sonucMap)
      if (mevcutlar.filter(m => m.cevap).length === sorularData.length && sorularData.length > 0) {
        setGununTamamlandi(true)
        onUnlocked(true)
      }
      setLoading(false)
      return
    }

    // Daha önce sorulmuş soru id'lerini al
    const { data: gecmisSorular } = await supabase
      .from('gunluk_sorular')
      .select('soru_id')
      .eq('user_id', user.id)

    const gorulmusIds = new Set((gecmisSorular || []).map(g => g.soru_id))

    // Tüm soruları çek
    const { data: tumSorular } = await supabase
      .from('cikmis_sorular')
      .select('*')

    if (!tumSorular || tumSorular.length === 0) {
      setLoading(false)
      return
    }

    // Görülmemiş soruları filtrele
    let gorulememisSorular = tumSorular.filter(s => !gorulmusIds.has(s.id))

    // Hiç görülmemiş soru kalmadıysa → sıfırla (tüm soruları tekrar kullan)
    if (gorulememisSorular.length === 0) {
      gorulememisSorular = tumSorular
    }

    // Günlük 6 soru seç
    const karistir = [...gorulememisSorular].sort(() => Math.random() - 0.5)
    const secilen  = karistir.slice(0, Math.min(6, karistir.length))

    await supabase.from('gunluk_sorular').insert(
      secilen.map(s => ({ user_id: user.id, soru_id: s.id, tarih: bugun }))
    )

    setSorular(secilen)
    setLoading(false)
  }, [user.id, bugun, onUnlocked])

  useEffect(() => { fetchGunlukSorular() }, [fetchGunlukSorular])

  async function handleCevap(soruId, secenek) {
    if (sonuclar[soruId] !== undefined) return
    const soru  = sorular.find(s => s.id === soruId)
    const dogru = secenek === soru.dogru_cevap

    setCevaplar(prev  => ({ ...prev,  [soruId]: secenek }))
    setSonuclar(prev  => ({ ...prev,  [soruId]: dogru   }))

    await supabase
      .from('gunluk_sorular')
      .update({ cevap: secenek, dogru_mu: dogru })
      .eq('user_id', user.id)
      .eq('soru_id', soruId)
      .eq('tarih', bugun)

    const yeniSonuclar = { ...sonuclar, [soruId]: dogru }
    if (Object.keys(yeniSonuclar).length === sorular.length) {
      setGununTamamlandi(true)
      onUnlocked(true)
    }
  }

  const dogruSayisi  = Object.values(sonuclar).filter(Boolean).length
  const yanlisSayisi = Object.values(sonuclar).filter(v => v === false).length

  return (
    <div className="space-y-4 animate-fade-in">

      {/* Geri Sayım */}
      <div className="card bg-gradient-to-br from-sage-500 to-sage-600 text-white">
        <div className="flex items-center gap-2 mb-3">
          <Timer className="w-4 h-4" />
          <span className="text-sm font-medium opacity-90">KPSS Lisans Sınavına</span>
        </div>
        {timeLeft.passed ? (
          <div className="text-2xl font-bold">Sınav günü geldi! 🎉</div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {[
              { val: timeLeft.days,    label: 'Gün'     },
              { val: timeLeft.hours,   label: 'Saat'    },
              { val: timeLeft.minutes, label: 'Dakika'  },
              { val: timeLeft.seconds, label: 'Saniye'  },
            ].map(({ val, label }) => (
              <div key={label} className="bg-white/20 rounded-xl p-2 text-center">
                <div className="text-2xl font-bold leading-none">
                  {String(val ?? 0).padStart(2, '0')}
                </div>
                <div className="text-[10px] opacity-75 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs opacity-75 mt-3">6 Eylül 2026 — Başarılar! 🌿</p>
      </div>

      {/* Günün Çıkmış Soruları */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <h2 className="section-title mb-0 flex items-center gap-2">
            {gununTamamlandi
              ? <CheckCircle className="w-4 h-4 text-sage-500" />
              : <Lock className="w-4 h-4 text-amber-500" />
            }
            Günün Çıkmış Soruları
          </h2>
          {gununTamamlandi && (
            <div className="badge-green animate-pop">
              <Sparkles className="w-3 h-3" /> Tamamlandı!
            </div>
          )}
        </div>

        {!gununTamamlandi && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-3 py-2 mb-3 flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">
              Diğer modülleri açmak için önce günün çıkmış sorularını çöz!
            </p>
          </div>
        )}

        {loading ? (
          <div className="card flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-sage-300 border-t-sage-500 rounded-full animate-spin" />
          </div>
        ) : sorular.length === 0 ? (
          <div className="card text-center py-6 text-gray-400 text-sm">
            Henüz çıkmış soru eklenmemiş. Supabase Table Editor'den
            <span className="font-medium text-gray-600"> cikmis_sorular </span>
            tablosuna soru ekle.
          </div>
        ) : (
          <div className="space-y-3">
            {sorular.map((soru, idx) => {
              const secenekler = {
                A: soru.a_secenegi,
                B: soru.b_secenegi,
                C: soru.c_secenegi,
                D: soru.d_secenegi,
                E: soru.e_secenegi,
              }
              const cevaplandi  = sonuclar[soru.id] !== undefined

              return (
                <div key={soru.id} className="card">
                  <div className="flex items-start justify-between mb-2">
                    <span className="text-xs text-gray-400">
                      Soru {idx + 1} · {soru.ders}{soru.yil ? ` (${soru.yil})` : ''}
                    </span>
                    {cevaplandi && (
                      sonuclar[soru.id]
                        ? <CheckCircle className="w-4 h-4 text-sage-500 flex-shrink-0" />
                        : <XCircle    className="w-4 h-4 text-red-400  flex-shrink-0" />
                    )}
                  </div>
                  <p className="text-sm text-gray-800 mb-3 leading-relaxed">{soru.soru_metni}</p>
                  <div className="space-y-1.5">
                    {Object.entries(secenekler).map(([harf, metin]) => {
                      let cls = 'w-full text-left text-sm px-3 py-2 rounded-xl border transition-all duration-200 '
                      if (!cevaplandi) {
                        cls += 'border-gray-100 hover:border-sage-300 hover:bg-sage-50 bg-gray-50'
                      } else if (harf === soru.dogru_cevap) {
                        cls += 'border-sage-300 bg-sage-50 text-sage-700 font-medium'
                      } else if (harf === cevaplar[soru.id] && !sonuclar[soru.id]) {
                        cls += 'border-red-200 bg-red-50 text-red-600'
                      } else {
                        cls += 'border-gray-100 bg-gray-50 text-gray-400'
                      }
                      return (
                        <button
                          key={harf}
                          className={cls}
                          onClick={() => handleCevap(soru.id, harf)}
                          disabled={cevaplandi}
                        >
                          <span className="font-medium">{harf})</span> {metin}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {gununTamamlandi && (
          <div className="card mt-3 bg-sage-50 border border-sage-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-sage-500 rounded-xl flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-sage-700">Harika! Gün kilidi açıldı 🎉</p>
                <p className="text-xs text-sage-600">{dogruSayisi} doğru · {yanlisSayisi} yanlış</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
