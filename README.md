# KPSS Asistanım 🌿

6 Eylül 2026 KPSS Lisans sınavına hazırlık için kişiselleştirilmiş PWA.

## Kurulum Adımları

### 1. Supabase Veritabanını Kur

1. [Supabase Dashboard](https://app.supabase.com)'a gir
2. Projen → **SQL Editor** → New Query
3. `schema.sql` dosyasının tüm içeriğini yapıştır ve **Run** butonuna bas

### 2. Projeyi Kur

```bash
cd KPSS-Uygulamasi
npm install
```

### 3. Yapay Zeka Kurulumu (Supabase Edge Function)

AI key'leri güvenlik için tarayıcıya inmez; Supabase'de sunucu tarafında tutulur.
`supabase/functions/ai-proxy` fonksiyonunu yükle ve key'leri secret olarak ekle:

```bash
# Supabase access token al: https://supabase.com/dashboard/account/tokens
set SUPABASE_ACCESS_TOKEN=sbp_...

npx supabase functions deploy ai-proxy --project-ref PROJE_REF
npx supabase secrets set GROQ_API_KEY=... GEMINI_API_KEY=... --project-ref PROJE_REF
```

- Groq key (AI Koç): [Groq Console](https://console.groq.com/keys)
- Gemini key (Konu Takip önerileri): [Google AI Studio](https://aistudio.google.com/app/apikey)

### 4. Geliştirme Sunucusunu Başlat

```bash
npm run dev
```

### 5. GitHub Pages'e Deploy Et

```bash
# Önce GitHub repo oluştur ve push et
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/KULLANICI/REPO.git
git push -u origin main

# Build
npm run build

# GitHub Pages için gh-pages paketi kur
npm install --save-dev gh-pages

# package.json'a şunu ekle (scripts içine):
# "deploy": "gh-pages -d dist"

npm run deploy
```

## Modüller

| Modül | Açıklama |
|-------|----------|
| 🏠 Ana Sayfa | Geri sayım + günlük 3 kilitli çıkmış soru |
| 📅 Takvim | Gün gün hedef takibi + % ilerleme |
| 📖 Notlar | Ders → Alt başlık → Not CRUD |
| 🃏 Flashcard | Aralıklı tekrar kartları (3/7 gün algoritması) |
| 📊 Denemeler | Net girişi + Recharts grafik |
| 🔥 Hata Havuzu | Yanlışları erit + kritik alarm |
| ✨ AI Koç | Groq ile haftalık analiz + sohbet |

## Teknoloji

- **React + Vite** — Frontend
- **Tailwind CSS** — Stil
- **Supabase** — Veritabanı + Auth
- **Recharts** — Grafikler
- **Groq API** — Yapay Zeka (AI Koç, Supabase Edge Function üzerinden)
- **Gemini API** — Yapay Zeka (Konu Takip önerileri, Supabase Edge Function üzerinden)
- **Lucide React** — İkonlar
