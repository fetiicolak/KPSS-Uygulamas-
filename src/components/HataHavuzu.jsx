import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Flame, AlertTriangle, Shuffle, Check, X, Trash2, Filter } from 'lucide-react'

export default function HataHavuzu({ user }) {
  const [hatalar, setHatalar] = useState([])
  const [kritikler, setKritikler] = useState([])
  const [eklemeAcik, setEklemeAcik] = useState(false)
  const [eritModu, setEritModu] = useState(false)
  const [aktifHata, setAktifHata] = useState(null)
  const [cevapGosteriliyor, setCevapGosteriliyor] = useState(false)
  const [filtre, setFiltre] = useState('hepsi') // 'hepsi' | 'cozulmemis' | 'kritik'
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ konu: '', soru_metni: '', dogru_cevap: '', kullanici_cevabi: '' })

  const fetchHatalar = useCallback(async () => {
    const { data } = await supabase
      .from('hata_havuzu')
      .select('*')
      .eq('user_id', user.id)
      .order('son_yanlis', { ascending: false })
    setHatalar(data || [])
    setKritikler((data || []).filter(h => h.yanlis_sayisi >= 3 && !h.cozuldu))
  }, [user.id])

  useEffect(() => { fetchHatalar() }, [fetchHatalar])

  async function hataEkle() {
    if (!form.konu.trim() || !form.soru_metni.trim()) return
    setLoading(true)
    await supabase.from('hata_havuzu').insert({
      user_id: user.id,
      konu: form.konu.trim(),
      soru_metni: form.soru_metni.trim(),
      dogru_cevap: form.dogru_cevap.trim(),
      kullanici_cevabi: form.kullanici_cevabi.trim(),
    })
    setForm({ konu: '', soru_metni: '', dogru_cevap: '', kullanici_cevabi: '' })
    setEklemeAcik(false)
    await fetchHatalar()
    setLoading(false)
  }

  async function hataSil(id) {
    await supabase.from('hata_havuzu').delete().eq('id', id)
    await fetchHatalar()
  }

  async function cozulduIsaretle(id) {
    await supabase.from('hata_havuzu').update({ cozuldu: true }).eq('id', id)
    if (aktifHata?.id === id) {
      hataAtla()
    }
    await fetchHatalar()
  }

  async function yanlisTekrar(id) {
    const hata = hatalar.find(h => h.id === id)
    if (!hata) return
    await supabase.from('hata_havuzu').update({
      yanlis_sayisi: (hata.yanlis_sayisi || 1) + 1,
      son_yanlis: new Date().toISOString(),
    }).eq('id', id)
    await fetchHatalar()
    hataAtla()
  }

  function eritBaslat() {
    const havuz = hatalar.filter(h => !h.cozuldu)
    if (havuz.length === 0) return
    const karistir = [...havuz].sort(() => Math.random() - 0.5)
    setAktifHata(karistir[0])
    setCevapGosteriliyor(false)
    setEritModu(true)
  }

  function hataAtla() {
    const havuz = hatalar.filter(h => !h.cozuldu && h.id !== aktifHata?.id)
    if (havuz.length === 0) {
      setEritModu(false)
      setAktifHata(null)
      return
    }
    const rastgele = havuz[Math.floor(Math.random() * havuz.length)]
    setAktifHata(rastgele)
    setCevapGosteriliyor(false)
  }

  const filtrelenmis = hatalar.filter(h => {
    if (filtre === 'cozulmemis') return !h.cozuldu
    if (filtre === 'kritik') return h.yanlis_sayisi >= 3 && !h.cozuldu
    return true
  })

  const cozulmemisler = hatalar.filter(h => !h.cozuldu)

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Başlık */}
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Flame className="w-4 h-4 text-orange-500" />
          Hata Havuzu
        </h2>
        <button onClick={() => setEklemeAcik(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Hata Ekle
        </button>
      </div>

      {/* Kritik Uyarı */}
      {kritikler.length > 0 && (
        <div className="card bg-red-50 border border-red-100 animate-slide-up">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold text-red-700">🚨 Kritik Eksik Alarmı!</p>
              <p className="text-xs text-red-600 mt-0.5">{kritikler.length} konuda üst üste 3+ yanlış yaptın:</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {kritikler.map(k => (
                  <span key={k.id} className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    {k.konu} ({k.yanlis_sayisi}×)
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Özet */}
      {hatalar.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          <div className="card text-center py-3">
            <div className="text-xl font-bold text-orange-500">{hatalar.length}</div>
            <div className="text-[10px] text-gray-400">Toplam</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-xl font-bold text-red-500">{cozulmemisler.length}</div>
            <div className="text-[10px] text-gray-400">Çözülmemiş</div>
          </div>
          <div className="card text-center py-3">
            <div className="text-xl font-bold text-sage-500">{hatalar.length - cozulmemisler.length}</div>
            <div className="text-[10px] text-gray-400">Eritildi</div>
          </div>
        </div>
      )}

      {/* Erit Butonu */}
      {cozulmemisler.length > 0 && (
        <button onClick={eritBaslat} className="w-full py-3 bg-gradient-to-r from-orange-400 to-red-400 text-white rounded-2xl font-medium text-sm flex items-center justify-center gap-2 shadow-card active:scale-95 transition-all">
          <Flame className="w-4 h-4" /> Hata Havuzunu Erit ({cozulmemisler.length} soru)
        </button>
      )}

      {/* Erit Modu Modal */}
      {eritModu && aktifHata && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 animate-fade-in">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-card-hover">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-medium text-orange-500 flex items-center gap-1">
                <Flame className="w-3.5 h-3.5" /> Konu: {aktifHata.konu}
              </span>
              <button onClick={() => { setEritModu(false); setAktifHata(null) }} className="p-1.5 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>

            <div className="bg-orange-50 rounded-xl p-4 mb-4 min-h-[100px] flex items-center">
              <p className="text-sm text-gray-800 leading-relaxed">{aktifHata.soru_metni}</p>
            </div>

            {cevapGosteriliyor ? (
              <div className="animate-slide-up">
                <div className="bg-sage-50 border border-sage-100 rounded-xl p-3 mb-4">
                  <p className="text-xs text-sage-600 font-medium mb-1">Doğru Cevap:</p>
                  <p className="text-sm text-sage-700">{aktifHata.dogru_cevap || 'Cevap girilmemiş'}</p>
                  {aktifHata.kullanici_cevabi && (
                    <>
                      <p className="text-xs text-red-400 font-medium mt-2 mb-1">Senin Cevabın:</p>
                      <p className="text-sm text-red-500">{aktifHata.kullanici_cevabi}</p>
                    </>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => cozulduIsaretle(aktifHata.id)}
                    className="bg-sage-50 text-sage-600 text-xs font-medium py-2.5 rounded-xl hover:bg-sage-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <Check className="w-3.5 h-3.5" /> Öğrendim!
                  </button>
                  <button
                    onClick={() => yanlisTekrar(aktifHata.id)}
                    className="bg-red-50 text-red-500 text-xs font-medium py-2.5 rounded-xl hover:bg-red-100 transition-colors flex items-center justify-center gap-1"
                  >
                    <X className="w-3.5 h-3.5" /> Yine Yanlış
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <button
                  onClick={() => setCevapGosteriliyor(true)}
                  className="w-full btn-primary"
                >
                  Cevabı Göster
                </button>
                <button onClick={hataAtla} className="w-full btn-ghost text-xs flex items-center justify-center gap-1">
                  <Shuffle className="w-3.5 h-3.5" /> Atla
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Yeni Hata Ekleme */}
      {eklemeAcik && (
        <div className="card border border-orange-100 animate-slide-up">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Yeni Hata Kaydı</h3>
          <div className="space-y-2">
            <input className="input-field" placeholder="Konu (örn: Osmanlı Tarihi)" value={form.konu} onChange={e => setForm({...form, konu: e.target.value})} autoFocus />
            <textarea className="textarea-field" rows={3} placeholder="Soru metni..." value={form.soru_metni} onChange={e => setForm({...form, soru_metni: e.target.value})} />
            <input className="input-field" placeholder="Doğru cevap" value={form.dogru_cevap} onChange={e => setForm({...form, dogru_cevap: e.target.value})} />
            <input className="input-field" placeholder="Senin cevabın (opsiyonel)" value={form.kullanici_cevabi} onChange={e => setForm({...form, kullanici_cevabi: e.target.value})} />
            <div className="flex gap-2">
              <button onClick={hataEkle} disabled={loading} className="btn-primary text-xs py-1.5 px-3">Kaydet</button>
              <button onClick={() => setEklemeAcik(false)} className="btn-ghost text-xs py-1.5 px-3">İptal</button>
            </div>
          </div>
        </div>
      )}

      {/* Filtreler */}
      {hatalar.length > 0 && (
        <div className="flex gap-2">
          {[
            { id: 'hepsi', label: 'Hepsi' },
            { id: 'cozulmemis', label: 'Çözülmemiş' },
            { id: 'kritik', label: '🔥 Kritik' },
          ].map(f => (
            <button
              key={f.id}
              onClick={() => setFiltre(f.id)}
              className={`text-xs px-3 py-1.5 rounded-xl font-medium transition-all ${filtre === f.id ? 'bg-sage-500 text-white' : 'bg-white text-gray-500 border border-gray-200'}`}
            >
              {f.label}
            </button>
          ))}
        </div>
      )}

      {/* Hata Listesi */}
      {hatalar.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <Flame className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Hata havuzu boş — harika!</p>
          <p className="text-xs mt-1">Deneme hatalarını buraya ekle 📝</p>
        </div>
      ) : filtrelenmis.length === 0 ? (
        <div className="card text-center py-6 text-gray-400 text-sm">Bu filtrede sonuç yok.</div>
      ) : (
        <div className="space-y-2">
          {filtrelenmis.map(hata => (
            <div key={hata.id} className={`card ${hata.cozuldu ? 'opacity-50' : ''} ${hata.yanlis_sayisi >= 3 && !hata.cozuldu ? 'border-l-2 border-red-300' : ''}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="badge-gray text-[10px]">{hata.konu}</span>
                    {hata.yanlis_sayisi >= 3 && !hata.cozuldu && (
                      <span className="text-[10px] text-red-500 font-medium">🔥 Kritik</span>
                    )}
                    {hata.cozuldu && (
                      <span className="text-[10px] text-sage-500 font-medium">✅ Eritildi</span>
                    )}
                  </div>
                  <p className="text-xs text-gray-600 line-clamp-2">{hata.soru_metni}</p>
                  <p className="text-[10px] text-gray-400 mt-1">{hata.yanlis_sayisi}× yanlış</p>
                </div>
                <div className="flex gap-1">
                  {!hata.cozuldu && (
                    <button onClick={() => cozulduIsaretle(hata.id)} className="p-1.5 bg-sage-50 hover:bg-sage-100 text-sage-500 rounded-lg transition-colors">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => hataSil(hata.id)} className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-400 rounded-lg transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
