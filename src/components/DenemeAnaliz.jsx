import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import {
  Plus, TrendingUp, Check, X, Minus,
  Trash2, BarChart3, Clock, ChevronDown, ChevronUp
} from 'lucide-react'

// GY: Türkçe + Matematik  |  GK: Tarih + Coğrafya + Vatandaşlık
const GY_DERSLER = ['Türkçe', 'Matematik']
const GK_DERSLER = ['Tarih', 'Coğrafya', 'Vatandaşlık']

const DERS_RENK = {
  Türkçe:      '#ec4899',
  Matematik:   '#10b981',
  Tarih:       '#f59e0b',
  Coğrafya:    '#3b82f6',
  Vatandaşlık: '#8b5cf6',
}

function LocalInput({ value, onChange, className, placeholder, min = "0" }) {
  const [local, setLocal] = useState(value ?? '')
  useEffect(() => { setLocal(value ?? '') }, [value])
  return (
    <input
      type="number"
      min={min}
      className={className}
      placeholder={placeholder}
      value={local}
      onChange={e => setLocal(e.target.value)}
      onBlur={e => onChange(e.target.value)}
    />
  )
}

function netHesapla(d, y) {
  return parseFloat(Math.max(0, d - y / 4).toFixed(2))
}

function bos(toplam, d, y) {
  return Math.max(0, (toplam || 0) - (d || 0) - (y || 0))
}

const BOSAlani = () => ({ dogru: '', yanlis: '', toplam: '' })

function dersBlogu(dersler) {
  const obj = {}
  dersler.forEach(d => { obj[d] = BOSAlani() })
  return obj
}

export default function DenemeAnaliz({ user }) {
  const [denemeler, setDenemeler]   = useState([])
  const [eklemeAcik, setEklemeAcik] = useState(false)
  const [loading, setLoading]       = useState(false)
  const [acikDetay, setAcikDetay]   = useState(null)

  const [form, setForm] = useState({
    deneme_adi: '',
    tarih: new Date().toISOString().split('T')[0],
    sure_dk: '',
    notlar: '',
    gy: dersBlogu(GY_DERSLER),
    gk: dersBlogu(GK_DERSLER),
  })

  const fetchDenemeler = useCallback(async () => {
    const { data } = await supabase
      .from('denemeler')
      .select('*')
      .eq('user_id', user.id)
      .order('tarih', { ascending: true })
    setDenemeler(data || [])
  }, [user.id])

  useEffect(() => { fetchDenemeler() }, [fetchDenemeler])

  function setDers(grup, ders, alan, deger) {
    setForm(prev => ({
      ...prev,
      [grup]: { ...prev[grup], [ders]: { ...prev[grup][ders], [alan]: deger } }
    }))
  }

  async function denemeEkle() {
    setLoading(true)

    // GY toplamları
    const gyD = GY_DERSLER.reduce((s, d) => s + (Number(form.gy[d].dogru)  || 0), 0)
    const gyY = GY_DERSLER.reduce((s, d) => s + (Number(form.gy[d].yanlis) || 0), 0)
    const gyT = GY_DERSLER.reduce((s, d) => s + (Number(form.gy[d].toplam) || 0), 0)
    // GK toplamları
    const gkD = GK_DERSLER.reduce((s, d) => s + (Number(form.gk[d].dogru)  || 0), 0)
    const gkY = GK_DERSLER.reduce((s, d) => s + (Number(form.gk[d].yanlis) || 0), 0)
    const gkT = GK_DERSLER.reduce((s, d) => s + (Number(form.gk[d].toplam) || 0), 0)

    const detay = {
      gy: Object.fromEntries(GY_DERSLER.map(d => [d, form.gy[d]])),
      gk: Object.fromEntries(GK_DERSLER.map(d => [d, form.gk[d]])),
    }

    await supabase.from('denemeler').insert({
      user_id:    user.id,
      deneme_adi: form.deneme_adi || `Deneme ${denemeler.length + 1}`,
      tarih:      form.tarih,
      sure_dk:    form.sure_dk ? Number(form.sure_dk) : null,
      gy_dogru:   gyD,
      gy_yanlis:  gyY,
      gy_bos:     bos(gyT, gyD, gyY),
      gk_dogru:   gkD,
      gk_yanlis:  gkY,
      gk_bos:     bos(gkT, gkD, gkY),
      notlar:     form.notlar,
      detay_json: JSON.stringify(detay),
    })

    setForm({
      deneme_adi: '',
      tarih: new Date().toISOString().split('T')[0],
      sure_dk: '',
      notlar: '',
      gy: dersBlogu(GY_DERSLER),
      gk: dersBlogu(GK_DERSLER),
    })
    setEklemeAcik(false)
    await fetchDenemeler()
    setLoading(false)
  }

  async function denemeySil(id) {
    if (!confirm('Bu denemeyi silmek istediğine emin misin?')) return
    await supabase.from('denemeler').delete().eq('id', id)
    await fetchDenemeler()
  }

  const grafikData = denemeler.map(d => ({
    isim:    d.deneme_adi || d.tarih,
    'GY Net': netHesapla(d.gy_dogru, d.gy_yanlis),
    'GK Net': netHesapla(d.gk_dogru, d.gk_yanlis),
    Toplam:   parseFloat((netHesapla(d.gy_dogru, d.gy_yanlis) + netHesapla(d.gk_dogru, d.gk_yanlis)).toFixed(2)),
  }))

  function DersGirisGrubu({ grup, baslik, dersler, renk }) {
    return (
      <div className={`rounded-xl border p-3 ${renk}`}>
        <p className="text-xs font-semibold text-gray-600 mb-2">{baslik}</p>
        <div className="space-y-2">
          {dersler.map(ders => {
            const val = form[grup][ders]
            const net = val.dogru || val.yanlis
              ? netHesapla(Number(val.dogru) || 0, Number(val.yanlis) || 0)
              : null
            return (
              <div key={ders}>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-[11px] font-medium text-gray-600 w-24 flex-shrink-0">{ders}</span>
                  <div className="grid grid-cols-3 gap-1 flex-1">
                    {[
                      { alan: 'toplam', ph: 'Top.',  cls: 'text-gray-500' },
                      { alan: 'dogru',  ph: 'D ✓',  cls: 'text-sage-600' },
                      { alan: 'yanlis', ph: 'Y ✗',  cls: 'text-red-400'  },
                    ].map(({ alan, ph, cls }) => (
                      <LocalInput
                        key={alan}
                        className={`input-field text-center text-xs py-1.5 ${cls}`}
                        placeholder={ph}
                        value={val[alan]}
                        onChange={v => setDers(grup, ders, alan, v)}
                      />
                    ))}
                  </div>
                  {net !== null && (
                    <span className="text-[11px] font-bold w-10 text-right flex-shrink-0"
                      style={{ color: DERS_RENK[ders] }}>
                      {net}
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Genel Denemeler</h2>
        <button onClick={() => setEklemeAcik(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Deneme Ekle
        </button>
      </div>

      {/* Grafik */}
      {denemeler.length >= 2 && (
        <div className="card">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Net Gelişim Grafiği</h3>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={grafikData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="isim" tick={{ fontSize: 10 }} tickLine={false} />
              <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}
                labelStyle={{ fontSize: 12, fontWeight: 600 }}
              />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="GY Net" stroke="#81c784" strokeWidth={2} dot={{ fill: '#81c784', r: 4 }} />
              <Line type="monotone" dataKey="GK Net" stroke="#a78bfa" strokeWidth={2} dot={{ fill: '#a78bfa', r: 4 }} />
              <Line type="monotone" dataKey="Toplam" stroke="#f59e0b" strokeWidth={2} strokeDasharray="5 5" dot={{ fill: '#f59e0b', r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Deneme Ekleme Formu */}
      {eklemeAcik && (
        <div className="card border border-sage-100 animate-slide-up space-y-3">
          <h3 className="text-sm font-semibold text-gray-800">Yeni Deneme Girişi</h3>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Deneme Adı</label>
              <input className="input-field" placeholder="KPSS Deneme 1"
                value={form.deneme_adi} onChange={e => setForm({ ...form, deneme_adi: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Tarih</label>
              <input type="date" className="input-field"
                value={form.tarih} onChange={e => setForm({ ...form, tarih: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-500 mb-1 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Süre (dakika)
            </label>
            <input type="number" min="0" className="input-field w-32" placeholder="130"
              value={form.sure_dk} onChange={e => setForm({ ...form, sure_dk: e.target.value })} />
          </div>

          {/* GY */}
          <DersGirisGrubu
            grup="gy" baslik="🧠 Genel Yetenek (GY)"
            dersler={GY_DERSLER}
            renk="bg-sage-50 border-sage-100"
          />

          {/* GK */}
          <DersGirisGrubu
            grup="gk" baslik="📚 Genel Kültür (GK)"
            dersler={GK_DERSLER}
            renk="bg-lavender-50 border-lavender-100"
          />

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Notlar</label>
            <textarea className="textarea-field" rows={2} placeholder="Bu denemede dikkat etmem gerekenler..."
              value={form.notlar} onChange={e => setForm({ ...form, notlar: e.target.value })} />
          </div>

          <div className="flex gap-2">
            <button onClick={denemeEkle} disabled={loading} className="btn-primary text-xs py-1.5 px-3">Kaydet</button>
            <button onClick={() => setEklemeAcik(false)} className="btn-ghost text-xs py-1.5 px-3">İptal</button>
          </div>
        </div>
      )}

      {/* Deneme Listesi */}
      {denemeler.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
          <p className="text-sm">Henüz deneme girilmemiş</p>
          <p className="text-xs mt-1">İlk denemeyi ekle ve gelişimini izle 📈</p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...denemeler].reverse().map(d => {
            const gyNet    = netHesapla(d.gy_dogru, d.gy_yanlis)
            const gkNet    = netHesapla(d.gk_dogru, d.gk_yanlis)
            const toplam   = parseFloat((gyNet + gkNet).toFixed(2))
            const detay    = d.detay_json ? JSON.parse(d.detay_json) : null
            const detayAcik = acikDetay === d.id

            return (
              <div key={d.id} className="card">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-medium text-gray-800">{d.deneme_adi || 'İsimsiz Deneme'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <p className="text-xs text-gray-400">{d.tarih}</p>
                      {d.sure_dk && (
                        <span className="text-xs text-gray-400 flex items-center gap-0.5">
                          <Clock className="w-3 h-3" /> {d.sure_dk} dk
                        </span>
                      )}
                    </div>
                  </div>
                  <button onClick={() => denemeySil(d.id)} className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-400 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-2">
                  <div className="bg-sage-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-bold text-sage-700">{gyNet}</div>
                    <div className="text-[10px] text-sage-500">GY Net</div>
                  </div>
                  <div className="bg-lavender-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-bold text-lavender-400">{gkNet}</div>
                    <div className="text-[10px] text-lavender-300">GK Net</div>
                  </div>
                  <div className="bg-amber-50 rounded-xl p-2 text-center">
                    <div className="text-sm font-bold text-amber-600">{toplam}</div>
                    <div className="text-[10px] text-amber-400">Toplam</div>
                  </div>
                </div>

                {/* Ders detayı */}
                {detay && (
                  <button
                    onClick={() => setAcikDetay(detayAcik ? null : d.id)}
                    className="w-full flex items-center justify-center gap-1 text-xs text-gray-400 hover:text-gray-600 py-1 transition-colors"
                  >
                    {detayAcik ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                    Ders detayı
                  </button>
                )}
                {detay && detayAcik && (
                  <div className="mt-2 space-y-1.5 animate-slide-up">
                    {[
                      { baslik: 'GY', dersler: GY_DERSLER, blok: detay.gy, renk: 'bg-sage-50' },
                      { baslik: 'GK', dersler: GK_DERSLER, blok: detay.gk, renk: 'bg-lavender-50' },
                    ].map(({ baslik, dersler, blok, renk }) => (
                      <div key={baslik} className={`${renk} rounded-xl p-2`}>
                        <p className="text-[10px] font-semibold text-gray-500 mb-1">{baslik}</p>
                        {dersler.map(ders => {
                          const v = blok?.[ders]
                          if (!v) return null
                          const n = netHesapla(Number(v.dogru) || 0, Number(v.yanlis) || 0)
                          return (
                            <div key={ders} className="flex items-center gap-2 text-xs py-0.5">
                              <span className="w-20 text-gray-600 flex-shrink-0">{ders}</span>
                              <span className="text-sage-600">{v.dogru || 0}D</span>
                              <span className="text-red-400">{v.yanlis || 0}Y</span>
                              <span className="text-gray-400">{bos(v.toplam, v.dogru, v.yanlis)}B</span>
                              <span className="ml-auto font-semibold" style={{ color: DERS_RENK[ders] }}>{n}</span>
                            </div>
                          )
                        })}
                      </div>
                    ))}
                  </div>
                )}

                {d.notlar && (
                  <p className="text-xs text-gray-500 mt-2 bg-gray-50 rounded-lg px-2.5 py-1.5">{d.notlar}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
