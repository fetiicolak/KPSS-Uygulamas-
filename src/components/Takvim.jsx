import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { ChevronLeft, ChevronRight, Plus, Check, Trash2, Target } from 'lucide-react'

const AYLAR = ['Ocak','Şubat','Mart','Nisan','Mayıs','Haziran','Temmuz','Ağustos','Eylül','Ekim','Kasım','Aralık']
const GUNLER = ['Pzt','Sal','Çar','Per','Cum','Cmt','Paz']

export default function Takvim({ user }) {
  const bugun = new Date()
  const [yil, setYil] = useState(bugun.getFullYear())
  const [ay, setAy] = useState(bugun.getMonth())
  const [seciliGun, setSeciliGun] = useState(bugun.toISOString().split('T')[0])
  const [hedefler, setHedefler] = useState([])
  const [ayHedefleri, setAyHedefleri] = useState({}) // { 'YYYY-MM-DD': [{...}] }
  const [yeniHedef, setYeniHedef] = useState('')
  const [loading, setLoading] = useState(false)
  const [eklemeAcik, setEklemeAcik] = useState(false)

  const fetchAyHedefleri = useCallback(async () => {
    const baslangic = new Date(yil, ay, 1).toISOString().split('T')[0]
    const bitis = new Date(yil, ay + 1, 0).toISOString().split('T')[0]

    const { data } = await supabase
      .from('takvim_hedefleri')
      .select('*')
      .eq('user_id', user.id)
      .gte('tarih', baslangic)
      .lte('tarih', bitis)

    const gruplu = {}
    ;(data || []).forEach(h => {
      if (!gruplu[h.tarih]) gruplu[h.tarih] = []
      gruplu[h.tarih].push(h)
    })
    setAyHedefleri(gruplu)
  }, [user.id, yil, ay])

  const fetchGunHedefleri = useCallback(async () => {
    const { data } = await supabase
      .from('takvim_hedefleri')
      .select('*')
      .eq('user_id', user.id)
      .eq('tarih', seciliGun)
      .order('created_at')
    setHedefler(data || [])
  }, [user.id, seciliGun])

  useEffect(() => { fetchAyHedefleri() }, [fetchAyHedefleri])
  useEffect(() => { fetchGunHedefleri() }, [fetchGunHedefleri])

  async function hedefEkle() {
    if (!yeniHedef.trim()) return
    setLoading(true)
    await supabase.from('takvim_hedefleri').insert({
      user_id: user.id,
      tarih: seciliGun,
      hedef_metni: yeniHedef.trim(),
    })
    setYeniHedef('')
    setEklemeAcik(false)
    await fetchGunHedefleri()
    await fetchAyHedefleri()
    setLoading(false)
  }

  async function toggleTamamla(hedef) {
    await supabase
      .from('takvim_hedefleri')
      .update({ tamamlandi: !hedef.tamamlandi })
      .eq('id', hedef.id)
    setHedefler(prev => prev.map(h => h.id === hedef.id ? { ...h, tamamlandi: !h.tamamlandi } : h))
    await fetchAyHedefleri()
  }

  async function hedefSil(id) {
    await supabase.from('takvim_hedefleri').delete().eq('id', id)
    await fetchGunHedefleri()
    await fetchAyHedefleri()
  }

  // Takvim grid
  const ayin1i = new Date(yil, ay, 1)
  const ayin1iGunu = (ayin1i.getDay() + 6) % 7 // Pazartesi = 0
  const ayinSonGunu = new Date(yil, ay + 1, 0).getDate()

  const gunler = []
  for (let i = 0; i < ayin1iGunu; i++) gunler.push(null)
  for (let i = 1; i <= ayinSonGunu; i++) {
    const tarih = `${yil}-${String(ay + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`
    gunler.push({ gun: i, tarih })
  }

  function ayDegistir(delta) {
    let yeniAy = ay + delta
    let yeniYil = yil
    if (yeniAy < 0) { yeniAy = 11; yeniYil-- }
    if (yeniAy > 11) { yeniAy = 0; yeniYil++ }
    setAy(yeniAy)
    setYil(yeniYil)
  }

  const tamamlananSayisi = hedefler.filter(h => h.tamamlandi).length
  const tamamlananYuzde = hedefler.length > 0 ? Math.round((tamamlananSayisi / hedefler.length) * 100) : 0

  const formatSeciliGun = () => {
    const d = new Date(seciliGun + 'T12:00:00')
    return `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()}`
  }

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Takvim Başlık */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => ayDegistir(-1)}>
            <ChevronLeft className="w-4 h-4 text-gray-600" />
          </button>
          <h2 className="font-semibold text-gray-800 text-sm">{AYLAR[ay]} {yil}</h2>
          <button className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors" onClick={() => ayDegistir(1)}>
            <ChevronRight className="w-4 h-4 text-gray-600" />
          </button>
        </div>

        {/* Gün başlıkları */}
        <div className="grid grid-cols-7 mb-1">
          {GUNLER.map(g => (
            <div key={g} className="text-center text-[10px] font-medium text-gray-400 py-1">{g}</div>
          ))}
        </div>

        {/* Günler */}
        <div className="grid grid-cols-7 gap-0.5">
          {gunler.map((item, idx) => {
            if (!item) return <div key={`empty-${idx}`} />

            const gunHedefleri = ayHedefleri[item.tarih] || []
            const tamam = gunHedefleri.filter(h => h.tamamlandi).length
            const toplam = gunHedefleri.length
            const bugunMu = item.tarih === bugun.toISOString().split('T')[0]
            const seciliMi = item.tarih === seciliGun

            return (
              <button
                key={item.tarih}
                onClick={() => setSeciliGun(item.tarih)}
                className={`relative aspect-square flex flex-col items-center justify-center rounded-xl text-xs font-medium transition-all duration-200 ${
                  seciliMi
                    ? 'bg-sage-500 text-white'
                    : bugunMu
                    ? 'bg-sage-100 text-sage-700 ring-1 ring-sage-300'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                {item.gun}
                {toplam > 0 && (
                  <div className="flex gap-0.5 mt-0.5">
                    {Array.from({ length: Math.min(toplam, 3) }).map((_, i) => (
                      <div
                        key={i}
                        className={`w-1 h-1 rounded-full ${
                          i < tamam
                            ? seciliMi ? 'bg-white' : 'bg-sage-400'
                            : seciliMi ? 'bg-white/40' : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Seçili Gün Detayı */}
      <div className="card">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-gray-800 text-sm">{formatSeciliGun()}</h3>
            {hedefler.length > 0 && (
              <p className="text-xs text-gray-500 mt-0.5">{tamamlananSayisi}/{hedefler.length} hedef tamamlandı</p>
            )}
          </div>
          <button
            onClick={() => setEklemeAcik(true)}
            className="btn-primary flex items-center gap-1 text-xs py-1.5 px-3"
          >
            <Plus className="w-3.5 h-3.5" /> Hedef Ekle
          </button>
        </div>

        {/* İlerleme Barı */}
        {hedefler.length > 0 && (
          <div className="mb-3">
            <div className="flex justify-between text-xs text-gray-500 mb-1">
              <span>Tamamlanma</span>
              <span className="font-medium text-sage-600">{tamamlananYuzde}%</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${tamamlananYuzde}%` }} />
            </div>
          </div>
        )}

        {/* Hedef Ekleme Formu */}
        {eklemeAcik && (
          <div className="bg-sage-50 rounded-xl p-3 mb-3 border border-sage-100 animate-slide-up">
            <input
              className="input-field mb-2"
              placeholder="Hedefini yaz..."
              value={yeniHedef}
              onChange={e => setYeniHedef(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && hedefEkle()}
              autoFocus
            />
            <div className="flex gap-2">
              <button onClick={hedefEkle} disabled={loading} className="btn-primary text-xs py-1.5 px-3">
                Kaydet
              </button>
              <button onClick={() => { setEklemeAcik(false); setYeniHedef('') }} className="btn-ghost text-xs py-1.5 px-3">
                İptal
              </button>
            </div>
          </div>
        )}

        {/* Hedef Listesi */}
        {hedefler.length === 0 ? (
          <div className="text-center py-6 text-gray-400">
            <Target className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Bu gün için henüz hedef yok</p>
            <p className="text-xs mt-1">Hedef ekle ve başar! 🎯</p>
          </div>
        ) : (
          <div className="space-y-2">
            {hedefler.map(hedef => (
              <div
                key={hedef.id}
                className={`flex items-center gap-3 p-2.5 rounded-xl border transition-all duration-200 ${
                  hedef.tamamlandi ? 'bg-sage-50 border-sage-100' : 'bg-white border-gray-100'
                }`}
              >
                <button
                  onClick={() => toggleTamamla(hedef)}
                  className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                    hedef.tamamlandi
                      ? 'bg-sage-500 border-sage-500 check-animation'
                      : 'border-gray-300 hover:border-sage-400'
                  }`}
                >
                  {hedef.tamamlandi && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                </button>
                <span className={`text-sm flex-1 ${hedef.tamamlandi ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                  {hedef.hedef_metni}
                </span>
                <button
                  onClick={() => hedefSil(hedef.id)}
                  className="p-1 hover:bg-red-50 rounded-lg text-gray-300 hover:text-red-400 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
