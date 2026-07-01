import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabaseClient'
import Auth from './components/Auth'
import Dashboard from './components/Dashboard'
import Takvim from './components/Takvim'
import DersNotlari from './components/DersNotlari'
import Flashcards from './components/Flashcards'
import DenemeAnaliz from './components/DenemeAnaliz'
import DersBazliDeneme from './components/DersBazliDeneme'
import HataHavuzu from './components/HataHavuzu'
import YapayZekaKocu from './components/YapayZekaKocu'
import KonuTakip from './components/KonuTakip'
import YoutubeListeler from './components/YoutubeListeler'
import {
  LayoutDashboard, Calendar, BookOpen, Brain,
  BarChart3, Flame, Sparkles, LogOut, Menu, X,
  Target, Youtube, ClipboardList
} from 'lucide-react'

const TABS = [
  { id: 'dashboard',    label: 'Ana Sayfa',           icon: LayoutDashboard, short: 'Anasayfa' },
  { id: 'takvim',       label: 'Takvim',              icon: Calendar,        short: 'Takvim'   },
  { id: 'notlar',       label: 'Ders Notları',        icon: BookOpen,        short: 'Notlar'   },
  { id: 'flashcard',    label: 'Flashcard',           icon: Brain,           short: 'Kart'     },
  { id: 'konu',         label: 'Konu Takibi',         icon: Target,          short: 'Konu'     },
  { id: 'deneme',       label: 'Genel Denemeler',     icon: BarChart3,       short: 'Genel'    },
  { id: 'dersDeneme',   label: 'Ders Bazlı Deneme',  icon: ClipboardList,   short: 'Ders'     },
  { id: 'hata',         label: 'Hata Havuzu',         icon: Flame,           short: 'Hata'     },
  { id: 'youtube',      label: 'YouTube Listeleri',   icon: Youtube,         short: 'Video'    },
  { id: 'ai',           label: 'AI Koç',              icon: Sparkles,        short: 'AI Koç'   },
]

export default function App() {
  const [session, setSession]               = useState(null)
  const [loading, setLoading]               = useState(true)
  const [aktifTab, setAktifTab]             = useState('dashboard')
  const [gunKilitAcik, setGunKilitAcik]     = useState(false)

  function tabDegistir(tab) {
    setAktifTab(tab)
    localStorage.setItem('aktifTab', tab)
  }
  const [menuAcik, setMenuAcik]             = useState(false)
  const [flashcardNotTalebi, setFlashcardNotTalebi] = useState(null)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setLoading(false)
      if (session) {
        // Sayfa yenilemede son sekmeyi geri yükle
        const kaydedilen = localStorage.getItem('aktifTab')
        if (kaydedilen) setAktifTab(kaydedilen)

        // Kilit durumunu kontrol et
        const bugun = new Date().toISOString().split('T')[0]
        supabase
          .from('gunluk_sorular')
          .select('cevap')
          .eq('user_id', session.user.id)
          .eq('tarih', bugun)
          .then(({ data }) => {
            if (data && data.length > 0 && data.every(d => d.cevap)) {
              setGunKilitAcik(true)
            }
          })
      }
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setSession(session)
      if (event === 'SIGNED_OUT') {
        setAktifTab('dashboard')
        setGunKilitAcik(false)
      }
      if (event === 'SIGNED_IN' && session) {
        const kaydedilen = localStorage.getItem('aktifTab')
        if (kaydedilen) setAktifTab(kaydedilen)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  const handleTabDegistir = useCallback((tabId) => {
    if (tabId !== 'dashboard' && !gunKilitAcik) return
    tabDegistir(tabId)
    setMenuAcik(false)
  }, [gunKilitAcik])

  async function cikisYap() {
    localStorage.removeItem('aktifTab')
    setAktifTab('dashboard')
    await supabase.auth.signOut()
  }

  function handleFlashcardIste(not) {
    setFlashcardNotTalebi(not)
    tabDegistir('flashcard')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream-100">
        <div className="w-8 h-8 border-2 border-sage-300 border-t-sage-500 rounded-full animate-spin" />
      </div>
    )
  }

  if (!session) return <Auth />

  const user = session.user

  function renderIcerik() {
    switch (aktifTab) {
      case 'dashboard':  return <Dashboard user={user} onUnlocked={setGunKilitAcik} />
      case 'takvim':     return <Takvim user={user} />
      case 'notlar':     return <DersNotlari user={user} onFlashcardIste={handleFlashcardIste} />
      case 'flashcard':  return (
        <Flashcards
          user={user}
          notFromParent={flashcardNotTalebi}
          onNotConsumed={() => setFlashcardNotTalebi(null)}
        />
      )
      case 'konu':       return <KonuTakip user={user} />
      case 'deneme':     return <DenemeAnaliz user={user} />
      case 'dersDeneme': return <DersBazliDeneme user={user} />
      case 'hata':       return <HataHavuzu user={user} />
      case 'youtube':    return <YoutubeListeler user={user} />
      case 'ai':         return <YapayZekaKocu user={user} />
      default:           return null
    }
  }

  const aktifTabBilgi = TABS.find(t => t.id === aktifTab)
  // Mobil alt barı: Anasayfa, Takvim, Konu, Genel Deneme, Hata + hamburger
  const altBarTabs = [TABS[0], TABS[1], TABS[4], TABS[5], TABS[7]]

  return (
    <div className="min-h-screen bg-cream-100 flex">

      {/* ── Masaüstü Sidebar ── */}
      <aside className="hidden md:flex flex-col w-60 bg-white border-r border-gray-100 h-screen sticky top-0 shadow-card">
        <div className="p-5 border-b border-gray-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-sage-500 rounded-xl flex items-center justify-center flex-shrink-0">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-sm font-bold text-gray-800">KPSS Asistanım</h1>
              <p className="text-[10px] text-gray-400">6 Eylül 2026 🌿</p>
            </div>
          </div>
        </div>

        <div className="px-4 py-3 border-b border-gray-50">
          <p className="text-xs text-gray-500 truncate">{user.email}</p>
        </div>

        <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
          {TABS.map(tab => {
            const Icon    = tab.icon
            const aktif   = aktifTab === tab.id
            const kilitli = tab.id !== 'dashboard' && !gunKilitAcik
            return (
              <button
                key={tab.id}
                onClick={() => handleTabDegistir(tab.id)}
                disabled={kilitli}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200 ${
                  aktif   ? 'bg-sage-500 text-white font-medium'
                  : kilitli ? 'text-gray-300 cursor-not-allowed'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                }`}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                <span>{tab.label}</span>
                {kilitli && <span className="ml-auto text-[10px]">🔒</span>}
              </button>
            )
          })}
        </nav>

        <div className="p-4 border-t border-gray-50">
          <button
            onClick={cikisYap}
            className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 hover:bg-red-50 px-3 py-2 rounded-xl transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" />
            Çıkış Yap
          </button>
        </div>
      </aside>

      {/* ── Mobil Yan Menü ── */}
      {menuAcik && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="fixed inset-0 bg-black/40" onClick={() => setMenuAcik(false)} />
          <div className="relative w-64 bg-white h-full flex flex-col shadow-card-hover animate-fade-in">
            <div className="p-4 border-b border-gray-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-sage-500 rounded-xl flex items-center justify-center">
                  <BookOpen className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-800">KPSS Asistanım</h1>
                  <p className="text-[10px] text-gray-400">6 Eylül 2026 🌿</p>
                </div>
              </div>
              <button onClick={() => setMenuAcik(false)} className="p-1 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="px-3 py-2 border-b border-gray-50">
              <p className="text-xs text-gray-400 truncate">{user.email}</p>
            </div>
            <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
              {TABS.map(tab => {
                const Icon    = tab.icon
                const aktif   = aktifTab === tab.id
                const kilitli = tab.id !== 'dashboard' && !gunKilitAcik
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabDegistir(tab.id)}
                    disabled={kilitli}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all ${
                      aktif   ? 'bg-sage-500 text-white font-medium'
                      : kilitli ? 'text-gray-300 cursor-not-allowed'
                      : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                    {kilitli && <span className="ml-auto text-[10px]">🔒</span>}
                  </button>
                )
              })}
            </nav>
            <div className="p-4 border-t border-gray-50">
              <button onClick={cikisYap} className="w-full flex items-center gap-2 text-xs text-gray-400 hover:text-red-400 px-3 py-2 rounded-xl transition-colors">
                <LogOut className="w-3.5 h-3.5" /> Çıkış Yap
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Ana İçerik ── */}
      <main className="flex-1 flex flex-col min-h-screen min-w-0">

        {/* Mobil Üst Bar */}
        <header className="md:hidden sticky top-0 z-30 bg-white border-b border-gray-100 px-4 py-3 flex items-center justify-between shadow-sm">
          <button onClick={() => setMenuAcik(true)} className="p-1.5 hover:bg-gray-100 rounded-lg">
            <Menu className="w-5 h-5 text-gray-600" />
          </button>
          <span className="text-sm font-semibold text-gray-800">{aktifTabBilgi?.label}</span>
          <div className="w-8" />
        </header>

        {/* Masaüstü Üst Bar */}
        <header className="hidden md:flex sticky top-0 z-20 bg-white border-b border-gray-100 px-6 py-4 items-center justify-between">
          <h2 className="text-base font-semibold text-gray-800">{aktifTabBilgi?.label}</h2>
          {!gunKilitAcik && (
            <div className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 px-3 py-1.5 rounded-xl">
              🔒 Günün sorularını çözerek diğer modülleri aç
            </div>
          )}
        </header>

        {/* Sayfa İçeriği */}
        <div className="flex-1 p-4 md:p-6 max-w-2xl w-full mx-auto pb-24 md:pb-6">
          {renderIcerik()}
        </div>

        {/* Mobil Alt Navigasyon */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 safe-bottom z-30">
          <div className="flex items-stretch">
            {altBarTabs.map(tab => {
              const Icon    = tab.icon
              const aktif   = aktifTab === tab.id
              const kilitli = tab.id !== 'dashboard' && !gunKilitAcik
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabDegistir(tab.id)}
                  disabled={kilitli}
                  className={`flex-1 flex flex-col items-center gap-0.5 py-3 transition-all duration-200 ${
                    aktif   ? 'text-sage-600'
                    : kilitli ? 'text-gray-200'
                    : 'text-gray-400 hover:text-gray-600'
                  }`}
                >
                  <div className={`p-1 rounded-lg ${aktif ? 'bg-sage-50' : ''}`}>
                    <Icon className="w-5 h-5" />
                  </div>
                  <span className="text-[9px] font-medium">{tab.short}</span>
                </button>
              )
            })}
            <button
              onClick={() => setMenuAcik(true)}
              className="flex-1 flex flex-col items-center gap-0.5 py-3 text-gray-400 hover:text-gray-600 transition-colors"
            >
              <div className="p-1 rounded-lg">
                <Menu className="w-5 h-5" />
              </div>
              <span className="text-[9px] font-medium">Daha</span>
            </button>
          </div>
        </nav>
      </main>
    </div>
  )
}
