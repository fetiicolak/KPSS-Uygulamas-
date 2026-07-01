import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../supabaseClient'
import {
  Youtube, Plus, Trash2, Check, ExternalLink,
  ChevronDown, ChevronRight, RefreshCw, PlayCircle
} from 'lucide-react'

const YT_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY || ''

async function playlistBilgisiCek(playlistId) {
  // Playlist meta
  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${YT_API_KEY}`
  )
  const metaData = await metaRes.json()
  if (!metaData.items?.length) throw new Error('Playlist bulunamadı.')
  const meta = metaData.items[0].snippet

  // Videolar (max 50 per page, paginate)
  let videolar = []
  let nextPageToken = ''
  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${YT_API_KEY}${nextPageToken ? `&pageToken=${nextPageToken}` : ''}`
    const res  = await fetch(url)
    const data = await res.json()
    if (data.error) throw new Error(data.error.message)
    videolar = [...videolar, ...(data.items || [])]
    nextPageToken = data.nextPageToken || ''
  } while (nextPageToken)

  return {
    baslik:      meta.title,
    kanal:       meta.channelTitle,
    video_sayisi: videolar.length,
    videolar:    videolar.map(v => ({
      video_id: v.snippet.resourceId.videoId,
      baslik:   v.snippet.title,
      sirano:   v.snippet.position + 1,
    })),
  }
}

function playlistIdCikar(url) {
  try {
    const u      = new URL(url)
    const listId = u.searchParams.get('list')
    if (listId) return listId
  } catch (_) {}
  // Direkt ID girilmişse
  if (/^PL|^UU|^FL/.test(url.trim())) return url.trim()
  return null
}

export default function YoutubeListeler({ user }) {
  const [listeler, setListeler]   = useState([])   // playlist kayıtları
  const [videolar, setVideolar]   = useState([])   // tüm videolar
  const [acikListe, setAcikListe] = useState(null)
  const [url, setUrl]             = useState('')
  const [eklemeAcik, setEklemeAcik] = useState(false)
  const [yukleniyor, setYukleniyor] = useState(false)
  const [hata, setHata]           = useState('')

  const fetchListeler = useCallback(async () => {
    const { data: pl } = await supabase
      .from('youtube_playlists')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at')

    const { data: vd } = await supabase
      .from('youtube_videolar')
      .select('*')
      .eq('user_id', user.id)

    setListeler(pl || [])
    setVideolar(vd || [])
  }, [user.id])

  useEffect(() => { fetchListeler() }, [fetchListeler])

  async function listeEkle() {
    setHata('')
    const pid = playlistIdCikar(url.trim())
    if (!pid) { setHata('Geçerli bir YouTube playlist linki veya ID gir.'); return }
    if (!YT_API_KEY) { setHata('VITE_YOUTUBE_API_KEY .env dosyasına eklenmemiş.'); return }

    setYukleniyor(true)
    try {
      const bilgi = await playlistBilgisiCek(pid)

      // Playlist kaydet
      const { data: pl, error } = await supabase.from('youtube_playlists').insert({
        user_id:      user.id,
        playlist_id:  pid,
        baslik:       bilgi.baslik,
        kanal:        bilgi.kanal,
        video_sayisi: bilgi.video_sayisi,
      }).select().single()

      if (error) throw error

      // Videoları kaydet
      if (bilgi.videolar.length) {
        await supabase.from('youtube_videolar').insert(
          bilgi.videolar.map(v => ({
            user_id:     user.id,
            playlist_db_id: pl.id,
            video_id:    v.video_id,
            baslik:      v.baslik,
            sirano:      v.sirano,
            tamamlandi:  false,
          }))
        )
      }

      setUrl('')
      setEklemeAcik(false)
      await fetchListeler()
    } catch (e) {
      setHata('Hata: ' + e.message)
    }
    setYukleniyor(false)
  }

  async function toggleVideo(videoId, suankiDurum) {
    await supabase
      .from('youtube_videolar')
      .update({ tamamlandi: !suankiDurum, tamamlanma_tarihi: !suankiDurum ? new Date().toISOString() : null })
      .eq('id', videoId)
    setVideolar(prev => prev.map(v => v.id === videoId ? { ...v, tamamlandi: !suankiDurum } : v))
  }

  async function listeSil(playlistDbId) {
    if (!confirm('Bu listeyi ve tüm videolarını silmek istiyor musun?')) return
    await supabase.from('youtube_videolar').delete().eq('playlist_db_id', playlistDbId)
    await supabase.from('youtube_playlists').delete().eq('id', playlistDbId)
    await fetchListeler()
  }

  function listeVideolari(playlistDbId) {
    return videolar
      .filter(v => v.playlist_db_id === playlistDbId)
      .sort((a, b) => a.sirano - b.sirano)
  }

  function ilerlemeHesapla(playlistDbId) {
    const list     = listeVideolari(playlistDbId)
    if (!list.length) return 0
    const tamam    = list.filter(v => v.tamamlandi).length
    return Math.round((tamam / list.length) * 100)
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h2 className="section-title mb-0 flex items-center gap-2">
          <Youtube className="w-4 h-4 text-red-500" />
          YouTube Listeleri
        </h2>
        <button onClick={() => setEklemeAcik(true)} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
          <Plus className="w-3.5 h-3.5" /> Liste Ekle
        </button>
      </div>

      {!YT_API_KEY && (
        <div className="card bg-amber-50 border border-amber-100">
          <p className="text-xs text-amber-700">
            <strong>YouTube API Key gerekli!</strong><br />
            .env dosyasına ekle:<br />
            <code className="bg-amber-100 px-1 rounded text-[10px]">VITE_YOUTUBE_API_KEY=YOUR_KEY</code>
          </p>
        </div>
      )}

      {/* Ekleme Formu */}
      {eklemeAcik && (
        <div className="card border border-red-100 animate-slide-up">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Playlist Ekle</h3>
          <p className="text-xs text-gray-400 mb-2">
            YouTube'da playlist sayfasını aç → adres çubuğundaki linki buraya yapıştır.
          </p>
          <input
            className="input-field mb-2"
            placeholder="https://youtube.com/playlist?list=PLxxx..."
            value={url}
            onChange={e => setUrl(e.target.value)}
            autoFocus
          />
          {hata && <p className="text-xs text-red-500 mb-2">{hata}</p>}
          <div className="flex gap-2">
            <button onClick={listeEkle} disabled={yukleniyor || !url.trim()} className="btn-primary text-xs py-1.5 px-3 flex items-center gap-1">
              {yukleniyor ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              {yukleniyor ? 'Yükleniyor...' : 'Ekle'}
            </button>
            <button onClick={() => { setEklemeAcik(false); setUrl(''); setHata('') }} className="btn-ghost text-xs py-1.5 px-3">İptal</button>
          </div>
        </div>
      )}

      {/* Playlist Listesi */}
      {listeler.length === 0 ? (
        <div className="card text-center py-8 text-gray-400">
          <Youtube className="w-10 h-10 mx-auto mb-2 opacity-30" />
          <p className="text-sm">Henüz playlist eklenmemiş</p>
          <p className="text-xs mt-1">KPSS ders videolarını takip et 📺</p>
        </div>
      ) : (
        <div className="space-y-3">
          {listeler.map(pl => {
            const yuzde      = ilerlemeHesapla(pl.id)
            const plVideolar = listeVideolari(pl.id)
            const tamam      = plVideolar.filter(v => v.tamamlandi).length
            const acik       = acikListe === pl.id

            return (
              <div key={pl.id} className="card p-0 overflow-hidden">
                {/* Playlist Başlık */}
                <button
                  onClick={() => setAcikListe(acik ? null : pl.id)}
                  className="w-full flex items-center gap-3 p-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Youtube className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">{pl.baslik}</p>
                    <p className="text-xs text-gray-400 truncate">{pl.kanal} · {pl.video_sayisi} video</p>
                    {/* İlerleme barı */}
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="progress-bar flex-1" style={{ height: '4px' }}>
                        <div className="progress-fill" style={{ width: `${yuzde}%` }} />
                      </div>
                      <span className="text-[10px] text-sage-600 font-medium flex-shrink-0">
                        {tamam}/{pl.video_sayisi} · %{yuzde}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={e => { e.stopPropagation(); listeSil(pl.id) }}
                      className="p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    {acik
                      ? <ChevronDown className="w-4 h-4 text-gray-400" />
                      : <ChevronRight className="w-4 h-4 text-gray-400" />
                    }
                  </div>
                </button>

                {/* Video Listesi */}
                {acik && (
                  <div className="border-t border-gray-50 max-h-96 overflow-y-auto">
                    {plVideolar.map(v => (
                      <div
                        key={v.id}
                        className={`flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0 transition-colors ${v.tamamlandi ? 'bg-sage-50/50' : 'hover:bg-gray-50'}`}
                      >
                        {/* Tik Kutusu */}
                        <button
                          onClick={() => toggleVideo(v.id, v.tamamlandi)}
                          className={`w-5 h-5 flex-shrink-0 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${
                            v.tamamlandi ? 'bg-sage-500 border-sage-500' : 'border-gray-300 hover:border-sage-400'
                          }`}
                        >
                          {v.tamamlandi && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                        </button>

                        {/* Video Bilgisi */}
                        <span className="text-[10px] text-gray-300 flex-shrink-0 w-5 text-right">{v.sirano}</span>
                        <p className={`text-xs flex-1 leading-snug ${v.tamamlandi ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                          {v.baslik}
                        </p>

                        {/* YouTube'da Aç */}
                        <a
                          href={`https://youtube.com/watch?v=${v.video_id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={e => e.stopPropagation()}
                          className="flex-shrink-0 p-1.5 hover:bg-red-50 text-gray-300 hover:text-red-400 rounded-lg transition-colors"
                        >
                          <PlayCircle className="w-4 h-4" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
