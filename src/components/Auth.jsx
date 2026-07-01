import { useState } from 'react'
import { supabase } from '../supabaseClient'
import { BookOpen, Eye, EyeOff, Loader2 } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [beniHatirla, setBeniHatirla] = useState(true)

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')
    setLoading(true)

    if (mode === 'register') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) {
        setError(error.message)
      } else {
        setSuccess('Kayıt başarılı! E-posta adresini doğrulayarak giriş yapabilirsin.')
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { persistSession: beniHatirla }
      })
      if (error) setError('E-posta veya şifre hatalı.')
    }

    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-sage-50 via-cream-100 to-lavender-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm animate-slide-up">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-sage-500 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-card">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800">KPSS Asistanım</h1>
          <p className="text-sm text-gray-500 mt-1">6 Eylül 2026'ya birlikte hazırlan 🌿</p>
        </div>

        {/* Card */}
        <div className="card shadow-card-hover">
          {/* Tabs */}
          <div className="flex bg-gray-100 rounded-xl p-1 mb-5">
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${mode === 'login' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
              onClick={() => { setMode('login'); setError(''); setSuccess('') }}
            >
              Giriş Yap
            </button>
            <button
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${mode === 'register' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500'}`}
              onClick={() => { setMode('register'); setError(''); setSuccess('') }}
            >
              Kayıt Ol
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {mode === 'register' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="Adın ve soyadın"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">E-posta</label>
              <input
                type="email"
                className="input-field"
                placeholder="ornek@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Şifre</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  className="input-field pr-10"
                  placeholder="••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  minLength={6}
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {mode === 'login' && (
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="beniHatirla"
                  checked={beniHatirla}
                  onChange={e => setBeniHatirla(e.target.checked)}
                  className="w-4 h-4 rounded accent-sage-500 cursor-pointer"
                />
                <label htmlFor="beniHatirla" className="text-xs text-gray-500 cursor-pointer select-none">
                  Beni hatırla
                </label>
              </div>
            )}

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-xs rounded-xl px-3 py-2">
                {error}
              </div>
            )}
            {success && (
              <div className="bg-sage-50 border border-sage-200 text-sage-700 text-xs rounded-xl px-3 py-2">
                {success}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {mode === 'login' ? 'Giriş Yap' : 'Kayıt Ol'}
            </button>
          </form>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          Hedefin büyük, yolun uzun — ama her gün bir adım 🌱
        </p>
      </div>
    </div>
  )
}
