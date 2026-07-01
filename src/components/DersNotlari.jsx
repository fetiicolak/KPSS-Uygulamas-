import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, BookOpen, ChevronDown, ChevronRight, Edit3, Trash2, Save, X, Layers } from 'lucide-react'

const DERSLER = [
  { id: 'Tarih', label: 'Tarih', emoji: '🏛️', renk: 'bg-amber-50 text-amber-700 border-amber-100' },
  { id: 'Coğrafya', label: 'Coğrafya', emoji: '🗺️', renk: 'bg-blue-50 text-blue-700 border-blue-100' },
  { id: 'Vatandaşlık', label: 'Vatandaşlık', emoji: '⚖️', renk: 'bg-purple-50 text-purple-700 border-purple-100' },
  { id: 'Türkçe', label: 'Türkçe', emoji: '📖', renk: 'bg-rose-50 text-rose-700 border-rose-100' },
  { id: 'Matematik', label: 'Matematik', emoji: '📐', renk: 'bg-sage-50 text-sage-700 border-sage-100' },
]

export default function DersNotlari({ user, onFlashcardIste }) {
  const [notlar, setNotlar] = useState([])
  const [acikDers, setAcikDers] = useState(null)
  const [acikNot, setAcikNot] = useState(null)
  const [yeniAltBaslik, setYeniAltBaslik] = useState('')
  const [yeniIcerik, setYeniIcerik] = useState('')
  const [duzenleme, setDuzenleme] = useState(null) // { id, alt_baslik, icerik }
  const [loading, setLoading] = useState(false)
  const [notEklemeAcik, setNotEklemeAcik] = useState(false)

  const fetchNotlar = useCallback(async () => {
    const { data } = await supabase
      .from('ders_notlari')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
    setNotlar(data || [])
  }, [user.id])

  useEffect(() => { fetchNotlar() }, [fetchNotlar])

  async function notEkle() {
    if (!yeniAltBaslik.trim() || !acikDers) return
    setLoading(true)
    await supabase.from('ders_notlari').insert({
      user_id: user.id,
      ders: acikDers,
      alt_baslik: yeniAltBaslik.trim(),
      icerik: yeniIcerik.trim(),
    })
    setYeniAltBaslik('')
    setYeniIcerik('')
    setNotEklemeAcik(false)
    await fetchNotlar()
    setLoading(false)
  }

  async function notGuncelle() {
    if (!duzenleme) return
    setLoading(true)
    await supabase
      .from('ders_notlari')
      .update({ alt_baslik: duzenleme.alt_baslik, icerik: duzenleme.icerik, updated_at: new Date().toISOString() })
      .eq('id', duzenleme.id)
    setDuzenleme(null)
    await fetchNotlar()
    setLoading(false)
  }

  async function notSil(id) {
    if (!confirm('Bu notu silmek istediğine emin misin?')) return
    await supabase.from('ders_notlari').delete().eq('id', id)
    if (acikNot === id) setAcikNot(null)
    await fetchNotlar()
  }

  const dersNotlari = (dersId) => notlar.filter(n => n.ders === dersId)

  return (
    <div className="space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0">Ders Notları</h2>
        <div className="badge-gray">{notlar.length} not</div>
      </div>

      {DERSLER.map(ders => {
        const dersNots = dersNotlari(ders.id)
        const acik = acikDers === ders.id

        return (
          <div key={ders.id} className="card p-0 overflow-hidden">
            {/* Ders Başlığı */}
            <button
              onClick={() => {
                setAcikDers(acik ? null : ders.id)
                setAcikNot(null)
                setNotEklemeAcik(false)
              }}
              className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
            >
              <span className="text-xl">{ders.emoji}</span>
              <div className="flex-1 text-left">
                <span className="font-medium text-gray-800 text-sm">{ders.label}</span>
                <span className="text-xs text-gray-400 ml-2">({dersNots.length} konu)</span>
              </div>
              {acik
                ? <ChevronDown className="w-4 h-4 text-gray-400" />
                : <ChevronRight className="w-4 h-4 text-gray-400" />
              }
            </button>

            {/* Alt Başlıklar */}
            {acik && (
              <div className="border-t border-gray-50">
                {dersNots.map(not => {
                  const notAcik = acikNot === not.id
                  const duzenlemeModu = duzenleme?.id === not.id

                  return (
                    <div key={not.id} className="border-b border-gray-50 last:border-0">
                      <button
                        onClick={() => setAcikNot(notAcik ? null : not.id)}
                        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-gray-50 transition-colors"
                      >
                        {notAcik
                          ? <ChevronDown className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                          : <ChevronRight className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        }
                        <span className="text-sm text-gray-700 flex-1 text-left">{not.alt_baslik}</span>
                        <Layers className="w-3 h-3 text-gray-300" />
                      </button>

                      {notAcik && (
                        <div className="px-4 pb-4 animate-slide-up">
                          {duzenlemeModu ? (
                            <div className="space-y-2">
                              <input
                                className="input-field text-sm"
                                value={duzenleme.alt_baslik}
                                onChange={e => setDuzenleme({ ...duzenleme, alt_baslik: e.target.value })}
                                placeholder="Alt başlık"
                              />
                              <textarea
                                className="textarea-field text-sm"
                                rows={5}
                                value={duzenleme.icerik}
                                onChange={e => setDuzenleme({ ...duzenleme, icerik: e.target.value })}
                                placeholder="Not içeriği..."
                              />
                              <div className="flex gap-2">
                                <button onClick={notGuncelle} disabled={loading} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                                  <Save className="w-3.5 h-3.5" /> Kaydet
                                </button>
                                <button onClick={() => setDuzenleme(null)} className="btn-ghost text-xs py-1.5 px-3 flex items-center gap-1">
                                  <X className="w-3.5 h-3.5" /> İptal
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              {not.icerik ? (
                                <div className="bg-gray-50 rounded-xl p-3 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed mb-2">
                                  {not.icerik}
                                </div>
                              ) : (
                                <div className="text-xs text-gray-400 italic mb-2">İçerik henüz eklenmemiş.</div>
                              )}
                              <div className="flex gap-2 flex-wrap">
                                <button
                                  onClick={() => setDuzenleme({ id: not.id, alt_baslik: not.alt_baslik, icerik: not.icerik || '' })}
                                  className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1"
                                >
                                  <Edit3 className="w-3 h-3" /> Düzenle
                                </button>
                                <button
                                  onClick={() => onFlashcardIste(not)}
                                  className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 bg-lavender-50 text-lavender-400 hover:bg-lavender-100"
                                >
                                  🃏 Kart Yap
                                </button>
                                <button
                                  onClick={() => notSil(not.id)}
                                  className="btn-danger text-xs py-1 px-2.5 flex items-center gap-1"
                                >
                                  <Trash2 className="w-3 h-3" /> Sil
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Yeni Not Ekleme */}
                {notEklemeAcik ? (
                  <div className="px-4 py-3 border-t border-gray-50 bg-sage-50/50 animate-slide-up">
                    <input
                      className="input-field text-sm mb-2"
                      placeholder="Konu başlığı (örn: Osmanlı Devleti'nin Kuruluşu)"
                      value={yeniAltBaslik}
                      onChange={e => setYeniAltBaslik(e.target.value)}
                      autoFocus
                    />
                    <textarea
                      className="textarea-field text-sm mb-2"
                      rows={4}
                      placeholder="Notlarını buraya yaz..."
                      value={yeniIcerik}
                      onChange={e => setYeniIcerik(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={notEkle} disabled={loading} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
                        <Save className="w-3.5 h-3.5" /> Kaydet
                      </button>
                      <button onClick={() => { setNotEklemeAcik(false); setYeniAltBaslik(''); setYeniIcerik('') }} className="btn-ghost text-xs py-1.5 px-3">
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setNotEklemeAcik(true)}
                    className="w-full flex items-center gap-2 px-4 py-3 text-xs text-sage-600 hover:bg-sage-50 transition-colors border-t border-gray-50"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    {ders.label} konusu ekle
                  </button>
                )}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
