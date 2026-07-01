import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import { Plus, Trash2, ClipboardList, Clock, TrendingUp, ChevronDown, ChevronRight } from 'lucide-react'

function LocalInput({ value, onChange, className, placeholder }) {
  const [local, setLocal] = useState(value ?? '')
  useEffect(() => { setLocal(value ?? '') }, [value])
  return (
    <input
      type="number"
      min="0"
      className={className}
      placeholder={placeholder}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={e => onChange(e.target.value)}
    />
  )
}

const DERSLER = [
  { id: 'Türkçe',      emoji: '📖', renk: '#ec4899', bg: 'bg-rose-50',    border: 'border-rose-100'    },
  { id: 'Matematik',   emoji: '📐', renk: '#10b981', bg: 'bg-sage-50',    border: 'border-sage-100'    },
  { id: 'Tarih',       emoji: '🏛️', renk: '#f59e0b', bg: 'bg-amber-50',   border: 'border-amber-100'   },
  { id: 'Coğrafya',    emoji: '🗺️', renk: '#3b82f6', bg: 'bg-blue-50',    border: 'border-blue-100'    },
  { id: 'Vatandaşlık', emoji: '⚖️', renk: '#8b5cf6', bg: 'bg-purple-50',  border: 'border-purple-100'  },
]

function netHesapla(d, y) {
  return parseFloat(Math.max(0, d - y / 4).toFixed(2))
}

export default function DersBazliDeneme({ user }) {
  const [kayitlar, setKayitlar]     = useState([])
  const [acikDers, setAcikDers]     = useState(null)
  const [eklemeAcik, setEklemeAcik] = useState(null) // ders id
  const [loading, setLoading]       = useState(false)
  const [form, setForm] = useState({
    deneme_adi: '',
    tarih: new Date().toISOString().split('T')[0],
    toplam: '', dogru: '', yanlis: '',
    sure_dk: '', notlar: '',
  })

  const fetchKayitlar = useCallback(async () => {
    const { data } = await supabase
      .from('ders_bazli_denemeler')
      .select('*')
      .eq('user_id', user.id)
      .order('tarih', { ascending: true })
    setKayitlar(data || [])
  }, [user.id])

  useEffect(() => { fetchKayitlar() }, [fetchKayitlar])

  function dersKayitlari(dersId) {
    return kayitlar.filter(k => k.ders === dersId)
  }

  async function kaydet(dersId) {
    const d = Number(form.dogru)  || 0
    const y = Number(form.yanlis) || 0
    const t = Number(form.toplam) || (d + y)
    if (!t) return
    setLoading(true)
    await supabase.from('ders_bazli_denemeler').insert({
      user_id:    user.id,
      ders:       dersId,
      deneme_adi: form.deneme_adi || `${dersId} Test`,
      tarih:      form.tarih,
      soru_sayisi: t,
      dogru:      d,
      yanlis:     y,
      bos:        Math.max(0, t - d - y),
      net:        netHesapla(d, y),
      sure_dk:    form.sure_dk ? Number(form.sure_dk) : null,
      notlar:     form.notlar,
    })
    setForm({ deneme_adi: '', tarih: new Date().toISOString().split('T')[0], toplam: '', dogru: '', yanlis: '', sure_dk: '', notlar: '' })
    setEklemeAcik(null)
    await fetchKayitlar()
    setLoading(false)
  }

  async function sil(id) {
    await supabase.from('ders_bazli_denemeler').delete().eq('id', id)
    await fetchKayitlar()
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Ders Bazlı Deneme Sonuçları</h2>
        <div className="badge-gray">{kayitlar.length} kayıt</div>
      </div>

      {DERSLER.map(ders => {
        const list    = dersKayitlari(ders.id)
        const dersAcik = acikDers === ders.id
        const formAcik = eklemeAcik === ders.id

        const sonKayit   = list[list.length - 1]
        const ortalamNet = list.length
          ? parseFloat((list.reduce((s, k) => s + (k.net || 0), 0) / list.length).toFixed(2))
          : null

        const grafikData = list.map((k, i) => ({
          isim: `#${i + 1}`,
          tarih: k.tarih,
          Net:  k.net,
          'Başarı %': k.soru_sayisi ? Math.round((k.dogru / k.soru_sayisi) * 100) : 0,
        }))

        return (
          <div key={ders.id} className="card p-0 overflow-hidden">
            {/* Ders Başlık */}
            <button
              onClick={() => { setAcikDers(dersAcik ? null : ders.id); setEklemeAcik(null) }}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{ders.emoji}</span>
              <div className="flex-1 text-left">
                <span className="font-medium text-gray-800 text-sm">{ders.id}</span>
                {ortalamNet !== null && (
                  <p className="text-xs text-gray-400 mt-0.5">
                    {list.length} test · Ort. net: <span className="font-medium" style={{ color: ders.renk }}>{ortalamNet}</span>
                  </p>
                )}
              </div>
              {/* Son net badge */}
              {sonKayit && (
                <div className={`px-2.5 py-1 rounded-xl text-xs font-bold ${ders.bg} border ${ders.border}`}
                  style={{ color: ders.renk }}>
                  {sonKayit.net}
                </div>
              )}
              {dersAcik
                ? <ChevronDown className="w-4 h-4 text-gray-400 flex-shrink-0" />
                : <ChevronRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              }
            </button>

            {dersAcik && (
              <div className="border-t border-gray-50 p-4 space-y-3">

                {/* Grafik */}
                {grafikData.length >= 2 && (
                  <div className={`${ders.bg} rounded-xl p-3`}>
                    <p className="text-[10px] text-gray-500 mb-2">Net Gelişim</p>
                    <ResponsiveContainer width="100%" height={110}>
                      <LineChart data={grafikData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                        <XAxis dataKey="isim" tick={{ fontSize: 9 }} tickLine={false} />
                        <YAxis tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ borderRadius: '10px', border: 'none', fontSize: 11, boxShadow: '0 2px 12px rgba(0,0,0,0.1)' }}
                          labelFormatter={(_, p) => p?.[0]?.payload?.tarih || ''}
                        />
                        <Line type="monotone" dataKey="Net" stroke={ders.renk} strokeWidth={2.5}
                          dot={{ fill: ders.renk, r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Geçmiş */}
                {list.length > 0 && (
                  <div className="space-y-1.5">
                    {[...list].reverse().map((k, i, arr) => {
                      const onceki = arr[i + 1]
                      const delta  = onceki ? parseFloat((k.net - onceki.net).toFixed(2)) : null
                      return (
                        <div key={k.id} className="flex items-center gap-2 bg-gray-50 rounded-xl px-3 py-2">
                          <span className="text-[10px] text-gray-400 w-20 flex-shrink-0">{k.tarih}</span>
                          <span className="text-xs text-gray-600 flex-1 truncate">{k.deneme_adi}</span>
                          <div className="flex gap-1">
                            <span className="text-[10px] px-1.5 py-0.5 bg-sage-100 text-sage-600 rounded-lg">{k.dogru}D</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-400 rounded-lg">{k.yanlis}Y</span>
                            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-400 rounded-lg">{k.bos}B</span>
                          </div>
                          <span className="text-xs font-bold w-8 text-right flex-shrink-0" style={{ color: ders.renk }}>{k.net}</span>
                          {delta !== null && (
                            <span className={`text-[10px] w-10 text-right flex-shrink-0 ${delta > 0 ? 'text-sage-500' : delta < 0 ? 'text-red-400' : 'text-gray-400'}`}>
                              {delta > 0 ? `▲${delta}` : delta < 0 ? `▼${Math.abs(delta)}` : '—'}
                            </span>
                          )}
                          {k.sure_dk && (
                            <span className="text-[10px] text-gray-300 flex items-center gap-0.5 flex-shrink-0">
                              <Clock className="w-2.5 h-2.5" />{k.sure_dk}dk
                            </span>
                          )}
                          <button onClick={() => sil(k.id)} className="p-0.5 text-gray-200 hover:text-red-400 transition-colors">
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Ekleme Formu */}
                {formAcik ? (
                  <div className={`${ders.bg} border ${ders.border} rounded-xl p-3 animate-slide-up space-y-2`}>
                    <p className="text-xs font-medium text-gray-600">{ders.emoji} {ders.id} — Test Sonucu Ekle</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Test Adı</label>
                        <input className="input-field text-xs py-1.5" placeholder={`${ders.id} Test 1`}
                          value={form.deneme_adi} onChange={e => setForm({ ...form, deneme_adi: e.target.value })} />
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 mb-0.5 block">Tarih</label>
                        <input type="date" className="input-field text-xs py-1.5"
                          value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
                      </div>
                    </div>
                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        { alan: 'toplam', ph: 'Toplam', cls: '' },
                        { alan: 'dogru',  ph: 'Doğru ✓', cls: 'text-sage-600' },
                        { alan: 'yanlis', ph: 'Yanlış ✗', cls: 'text-red-400' },
                        { alan: 'sure_dk',ph: 'Süre(dk)', cls: '' },
                      ].map(({ alan, ph, cls }) => (
                        <LocalInput key={alan}
                          className={`input-field text-center text-xs py-1.5 ${cls}`}
                          placeholder={ph}
                          value={form[alan]}
                          onChange={v => setForm(f => ({ ...f, [alan]: v }))}
                        />
                      ))}
                    </div>
                    {(form.dogru || form.yanlis) && (
                      <p className="text-xs font-bold text-center" style={{ color: ders.renk }}>
                        Net: {netHesapla(Number(form.dogru) || 0, Number(form.yanlis) || 0)}
                      </p>
                    )}
                    <textarea className="textarea-field text-xs" rows={2} placeholder="Notlar..."
                      value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
                    <div className="flex gap-2">
                      <button onClick={() => kaydet(ders.id)} disabled={loading} className="btn-primary text-xs py-1.5 px-3">Kaydet</button>
                      <button onClick={() => setEklemeAcik(null)} className="btn-ghost text-xs py-1.5 px-3">İptal</button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setEklemeAcik(ders.id)}
                    className="w-full flex items-center justify-center gap-1 text-xs text-sage-600 bg-sage-50 hover:bg-sage-100 rounded-xl py-2.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" /> Test Sonucu Ekle
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {kayitlar.length === 0 && (
        <div className="card text-center py-8 text-gray-400">
          <ClipboardList className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Henüz ders bazlı test girilmemiş</p>
          <p className="text-xs mt-1">Bir ders seç ve test sonuçlarını ekle 📝</p>
        </div>
      )}
    </div>
  )
}
