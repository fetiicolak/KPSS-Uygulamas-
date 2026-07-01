-- ============================================================
-- KPSS Asistanı — Supabase Schema
-- Supabase SQL Editor'e yapıştırıp çalıştır
-- ============================================================

-- Profiles (Auth user'ına bağlı ek bilgiler)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Çıkmış Sorular (Admin tarafından doldurulacak soru havuzu)
CREATE TABLE IF NOT EXISTS cikmis_sorular (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  soru_metni TEXT NOT NULL,
  secenekler JSONB NOT NULL, -- {"A":"...","B":"...","C":"...","D":"...","E":"..."}
  dogru_cevap CHAR(1) NOT NULL,
  konu TEXT NOT NULL, -- GY veya GK
  yil INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Günlük Kilitli Sorular (Kullanıcının günlük çözdüğü sorular)
CREATE TABLE IF NOT EXISTS gunluk_sorular (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  soru_id UUID REFERENCES cikmis_sorular(id) ON DELETE CASCADE NOT NULL,
  tarih DATE NOT NULL DEFAULT CURRENT_DATE,
  cevap CHAR(1),
  dogru_mu BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, soru_id, tarih)
);

-- Takvim Hedefleri
CREATE TABLE IF NOT EXISTS takvim_hedefleri (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tarih DATE NOT NULL,
  hedef_metni TEXT NOT NULL,
  tamamlandi BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ders Notları (Hiyerarşik)
CREATE TABLE IF NOT EXISTS ders_notlari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  ders TEXT NOT NULL, -- Tarih, Coğrafya, Vatandaşlık, Türkçe, Matematik
  alt_baslik TEXT NOT NULL,
  icerik TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Flashcard'lar (Dijital Kartlar)
CREATE TABLE IF NOT EXISTS flashcards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  not_id UUID REFERENCES ders_notlari(id) ON DELETE SET NULL,
  on_yuz TEXT NOT NULL,
  arka_yuz TEXT NOT NULL,
  son_gorulme TIMESTAMPTZ,
  gorulme_sayisi INTEGER DEFAULT 0,
  zorluk TEXT DEFAULT 'orta', -- kolay, orta, zor
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Denemeler
CREATE TABLE IF NOT EXISTS denemeler (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tarih DATE NOT NULL DEFAULT CURRENT_DATE,
  deneme_adi TEXT,
  gy_dogru INTEGER DEFAULT 0,
  gy_yanlis INTEGER DEFAULT 0,
  gy_bos INTEGER DEFAULT 0,
  gk_dogru INTEGER DEFAULT 0,
  gk_yanlis INTEGER DEFAULT 0,
  gk_bos INTEGER DEFAULT 0,
  notlar TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hata Havuzu
CREATE TABLE IF NOT EXISTS hata_havuzu (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  konu TEXT NOT NULL,
  soru_metni TEXT NOT NULL,
  dogru_cevap TEXT,
  kullanici_cevabi TEXT,
  yanlis_sayisi INTEGER DEFAULT 1,
  deneme_id UUID REFERENCES denemeler(id) ON DELETE SET NULL,
  cozuldu BOOLEAN DEFAULT FALSE,
  son_yanlis TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Haftalık AI Raporları
CREATE TABLE IF NOT EXISTS ai_raporlar (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  hafta_basi DATE NOT NULL,
  rapor_metni TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- Row Level Security (RLS) Politikaları
-- ============================================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE cikmis_sorular ENABLE ROW LEVEL SECURITY;
ALTER TABLE gunluk_sorular ENABLE ROW LEVEL SECURITY;
ALTER TABLE takvim_hedefleri ENABLE ROW LEVEL SECURITY;
ALTER TABLE ders_notlari ENABLE ROW LEVEL SECURITY;
ALTER TABLE flashcards ENABLE ROW LEVEL SECURITY;
ALTER TABLE denemeler ENABLE ROW LEVEL SECURITY;
ALTER TABLE hata_havuzu ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_raporlar ENABLE ROW LEVEL SECURITY;

-- Profiles
CREATE POLICY "Kullanicı kendi profilini görebilir" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Kullanicı kendi profilini güncelleyebilir" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Kullanicı profil oluşturabilir" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Çıkmış Sorular (herkes okuyabilir)
CREATE POLICY "Herkes çıkmış soruları görebilir" ON cikmis_sorular FOR SELECT TO authenticated USING (true);

-- Günlük Sorular
CREATE POLICY "Kullanicı kendi günlük sorularını yönetebilir" ON gunluk_sorular FOR ALL USING (auth.uid() = user_id);

-- Takvim Hedefleri
CREATE POLICY "Kullanicı kendi takvim hedeflerini yönetebilir" ON takvim_hedefleri FOR ALL USING (auth.uid() = user_id);

-- Ders Notları
CREATE POLICY "Kullanicı kendi ders notlarını yönetebilir" ON ders_notlari FOR ALL USING (auth.uid() = user_id);

-- Flashcards
CREATE POLICY "Kullanicı kendi flashcard'larını yönetebilir" ON flashcards FOR ALL USING (auth.uid() = user_id);

-- Denemeler
CREATE POLICY "Kullanicı kendi denemelerini yönetebilir" ON denemeler FOR ALL USING (auth.uid() = user_id);

-- Hata Havuzu
CREATE POLICY "Kullanicı kendi hata havuzunu yönetebilir" ON hata_havuzu FOR ALL USING (auth.uid() = user_id);

-- AI Raporlar
CREATE POLICY "Kullanicı kendi raporlarını yönetebilir" ON ai_raporlar FOR ALL USING (auth.uid() = user_id);

-- ============================================================
-- Trigger: Yeni kullanıcı kaydında profil oluştur
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- Örnek Çıkmış Sorular (Test verisi)
-- ============================================================
INSERT INTO cikmis_sorular (soru_metni, secenekler, dogru_cevap, konu, yil) VALUES
(
  'Türkiye Büyük Millet Meclisi kaç milletvekilinden oluşur?',
  '{"A":"450","B":"500","C":"550","D":"600","E":"650"}',
  'D', 'GK', 2022
),
(
  'Aşağıdakilerden hangisi yürütme organının unsurundan biri değildir?',
  '{"A":"Cumhurbaşkanı","B":"Bakanlar Kurulu","C":"Yargıtay","D":"Cumhurbaşkanı Yardımcısı","E":"Bakanlar"}',
  'C', 'GK', 2021
),
(
  'Türkiye''nin en uzun nehri aşağıdakilerden hangisidir?',
  '{"A":"Sakarya","B":"Kızılırmak","C":"Fırat","D":"Dicle","E":"Yeşilırmak"}',
  'B', 'GY', 2020
),
(
  'Aşağıdaki cümlelerin hangisinde yazım yanlışı vardır?',
  '{"A":"Yarın okula gideceğim","B":"Bu hafta sonu pikniğe gidiyoruz","C":"Herşeyi hallettim","D":"Sizi çok özledim","E":"Bugün hava çok güzel"}',
  'C', 'GY', 2023
),
(
  '2^10 işleminin sonucu kaçtır?',
  '{"A":"512","B":"1024","C":"2048","D":"256","E":"4096"}',
  'B', 'GY', 2022
),
(
  'Türkiye Cumhuriyeti Anayasası kaçıncı yılında kabul edilmiştir?',
  '{"A":"1961","B":"1971","C":"1980","D":"1982","E":"1987"}',
  'D', 'GK', 2021
),
(
  'İstanbul''un fethinin tarihi aşağıdakilerden hangisidir?',
  '{"A":"1453","B":"1461","C":"1521","D":"1396","E":"1402"}',
  'A', 'GY', 2020
),
(
  'Bir üçgenin iç açıları toplamı kaç derecedir?',
  '{"A":"90","B":"180","C":"270","D":"360","E":"120"}',
  'B', 'GY', 2019
),
(
  'Türkiye hangi kıtada yer almaktadır?',
  '{"A":"Yalnızca Asya","B":"Yalnızca Avrupa","C":"Hem Asya hem Avrupa","D":"Afrika","E":"Okyanusya"}',
  'C', 'GY', 2023
),
(
  'Atatürk ilkeleri arasında aşağıdakilerden hangisi yer almaz?',
  '{"A":"Cumhuriyetçilik","B":"Milliyetçilik","C":"Sosyalizm","D":"Laiklik","E":"İnkılapçılık"}',
  'C', 'GK', 2022
);
