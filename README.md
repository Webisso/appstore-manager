# App Store Connect Manager

App Store Connect metadata'sını tarayıcıdan yönetmek, çoklu dil lokalizasyonlarını düzenlemek ve AI ile çeviri / ekran görüntüsü üretmek için geliştirilmiş dahili bir Next.js aracı.

Apple App Store Connect API, Google Gemini ve Wiro AI entegrasyonlarını tek bir arayüzde birleştirir. Tüm kimlik bilgileri yalnızca tarayıcınızda (`localStorage`) saklanır; sunucuya kalıcı olarak yazılmaz.

---

## İçindekiler

- [Özellikler](#özellikler)
- [Mimari](#mimari)
- [Gereksinimler](#gereksinimler)
- [Kurulum](#kurulum)
- [Yapılandırma](#yapılandırma)
  - [Apple App Store Connect](#apple-app-store-connect)
  - [Google Gemini](#google-gemini)
  - [Wiro AI](#wiro-ai)
- [Kullanım](#kullanım)
- [Proje yapısı](#proje-yapısı)
- [API uç noktaları](#api-uç-noktaları)
- [AI prompt dosyaları](#ai-prompt-dosyaları)
- [Geliştirme](#geliştirme)
- [Güvenlik notları](#güvenlik-notları)

---

## Özellikler

### App Store Connect

- **Uygulama listesi** — ASC hesabınızdaki tüm uygulamaları ikon, bundle ID ve birincil locale ile görüntüleme
- **Metadata düzenleme** — Her locale için name, subtitle, description, keywords, what's new, URL alanlarını düzenleme
- **Karakter limiti takibi** — App Store Connect limitlerine göre anlık sayaç ve limit aşımı uyarıları
- **Çoklu locale gezinme** — Kaydedilmemiş değişiklikler ve limit hataları için görsel rozetler
- **Ekran görüntüsü görüntüleme** — iPhone / iPad setlerini lightbox ile inceleme
- **Ekran görüntüsü yükleme** — AI ile üretilen görselleri doğrudan ASC'ye yükleme

### Toplu import araçları

| Araç | Açıklama |
|------|----------|
| **Privacy Policy** | Bir URL şablonundan tüm locale'lere gizlilik politikası URL'si kopyalama |
| **Sync URLs** | Birincil locale'deki support / marketing URL'lerini diğer dillere senkronize etme |
| **Auto Translate** | Gemini ile metadata çevirisi; limit aşımlarında otomatik düzeltme |
| **Auto Image Generation** | Kaynak locale ekran görüntülerinden hedef dillere AI ile lokalize görsel üretimi |

### AI entegrasyonları

| Sağlayıcı | Kullanım alanı |
|-----------|----------------|
| **Google Gemini** | Metadata çevirisi, ekran görüntüsü lokalizasyonu (metin + görsel modelleri) |
| **Wiro AI** | Görsel oluşturma / düzenleme modelleri (ayarlar hazır; entegrasyon genişletilebilir) |

---

## Mimari

```
┌─────────────────────────────────────────────────────────────┐
│                     Tarayıcı (Client)                        │
│  localStorage: Apple credentials, Gemini settings, Wiro      │
└──────────────────────────┬──────────────────────────────────┘
                           │ POST (credentials in body)
                           ▼
┌─────────────────────────────────────────────────────────────┐
│                  Next.js API Routes (Server)                 │
│  /api/apple/*  /api/gemini/*  /api/wiro/*  /api/image/*     │
└──────┬─────────────────┬──────────────────┬───────────────┘
       │                 │                  │
       ▼                 ▼                  ▼
 App Store Connect   Google Gemini API   Wiro AI API
     REST API
```

Kimlik bilgileri her istekte istemciden sunucuya iletilir, harici API çağrısı yapılır ve yanıt döndürülür. Sunucu tarafında veritabanı veya kalıcı credential deposu yoktur.

---

## Gereksinimler

- **Node.js** 20+
- **npm** (veya uyumlu paket yöneticisi)
- App Store Connect **API Key** (.p8 private key)
- (İsteğe bağlı) [Google AI Studio](https://aistudio.google.com/) Gemini API key
- (İsteğe bağlı) [Wiro](https://wiro.ai/) API key + secret

---

## Kurulum

```bash
git clone <repo-url>
cd appstore-manager
npm install
npm run dev
```

Uygulama [http://localhost:3000](http://localhost:3000) adresinde açılır. İlk ziyarette Apple kimlik bilgileri yapılandırılmamışsa otomatik olarak **Settings → Apple Settings** sayfasına yönlendirilirsiniz.

### Diğer komutlar

```bash
npm run build    # Production build
npm run start    # Production sunucu
npm run lint     # ESLint
npm run test     # Vitest (birim testleri)
```

---

## Yapılandırma

Tüm ayarlar **Settings** sayfasından (`/settings`) yönetilir.

### Apple App Store Connect

**Settings → Apple Settings** sekmesinde:

| Alan | Açıklama |
|------|----------|
| **Issuer ID** | App Store Connect → Users and Access → Keys → Issuer ID (UUID) |
| **Key ID** | API anahtarının 10 karakterlik ID'si |
| **Private Key** | `.p8` dosyasının içeriği (sürükle-bırak veya yapıştır) |

**Test Connection** ile bağlantı doğrulanır, ardından **Save** ile tarayıcıya kaydedilir.

> API anahtarınızın **App Manager** veya uygun rol ile oluşturulmuş olması gerekir.

### Google Gemini

**Settings → Gemini Settings** sekmesinde:

1. [Google AI Studio](https://aistudio.google.com/apikey) üzerinden API key alın
2. **Verify API Key** ile doğrulayın
3. **Text Model** — metadata çevirisi için (ör. `gemini-2.5-flash`)
4. **Image Model** — ekran görüntüsü lokalizasyonu için (ör. `gemini-2.5-flash-image`)
5. **Save Settings**

Auto Translate ve Auto Image Generation özellikleri Gemini ayarları kaydedilmeden çalışmaz.

### Wiro AI

**Settings → Wiro AI Settings** sekmesinde:

1. [Wiro Dashboard](https://wiro.ai/panel) üzerinden proje oluşturun
2. **API Key** ve **API Secret** girin (signature-based authentication)
3. **Verify Credentials** ile doğrulayın
4. **Image Model** — image-generation, image-to-image ve image-editing kategorilerindeki modeller listelenir
5. **Save Settings**

Model ID formatı: `owner-slug/model-slug` (ör. `wiro/virtual-try-on`)

---

## Kullanım

### 1. Uygulama seçimi

`/apps` sayfasından bir uygulamaya tıklayın. Uygulama detay sayfasında sürüm bilgisi, birincil locale ve tüm lokalizasyonlar görüntülenir.

### 2. Metadata düzenleme

- Locale rozetlerinden dil seçin
- **Text** sekmesinde alanları düzenleyin
- Karakter sayaçları App Store limitlerini gösterir
- **Save** ile değişiklikleri App Store Connect'e gönderin

**Düzenlenebilir alanlar:** Name, Subtitle, Description, Keywords, What's New, Support URL, Marketing URL, Privacy Policy URL

### 3. Ekran görüntüleri

- **Screenshots** sekmesinde iPhone / iPad setlerini görüntüleyin
- Tek bir locale için **Create with AI** ile kaynak dilden hedef dile lokalize ekran görüntüsü üretin
- Üretilen görselleri önizleyip ASC'ye yükleyin

### 4. Toplu işlemler (Import Toolbar)

Uygulama detay sayfasının üst kısmındaki araç çubuğu:

- **Privacy Policy** — URL şablonu ile tüm dillere gizlilik politikası linki
- **Auto Translate** — Seçili locale'lere Gemini çevirisi; kısmi çeviri ve what's new dahil/hariç seçenekleri
- **Auto Image Generation** — Kaynak locale ekran görüntülerinden toplu AI lokalizasyonu; üretim sonrası inceleme ve toplu yükleme

### 5. URL senkronizasyonu

Birincil locale'deki support ve marketing URL'lerini diğer dillere kopyalamak için **Sync URLs** modalını kullanın.

---

## Proje yapısı

```
appstore-manager/
├── app/
│   ├── api/
│   │   ├── apple/          # App Store Connect proxy
│   │   ├── gemini/         # Gemini verify, models, translate, screenshot
│   │   ├── wiro/           # Wiro verify, models
│   │   └── image/          # Görsel boyutlandırma (sharp)
│   ├── apps/               # Uygulama listesi ve detay sayfaları
│   └── settings/           # Ayarlar sayfası
├── components/
│   ├── import/             # Toplu import modalları
│   ├── settings/           # Apple, Gemini, Wiro ayar formları
│   └── ui/                 # shadcn/ui bileşenleri
├── lib/
│   ├── apple/              # ASC client, auth, screenshots, types
│   ├── gemini/             # Gemini client, translate, prompts
│   ├── wiro/               # Wiro client, settings
│   ├── image/              # iPhone screenshot resize
│   └── screenshots/        # AI generation batch mantığı
└── public/prompts/         # Düzenlenebilir AI prompt şablonları
```

---

## API uç noktaları

### Apple (`/api/apple/*`)

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/apple/test` | Kimlik bilgisi doğrulama |
| `POST /api/apple/apps` | Uygulama listesi |
| `POST /api/apple/apps/[appId]` | Uygulama detayı |
| `POST /api/apple/apps/[appId]/localizations` | Metadata kaydetme |
| `POST /api/apple/apps/[appId]/import/privacy-policy` | Gizlilik politikası URL import |
| `POST /api/apple/apps/[appId]/import/urls` | Support / marketing URL import |
| `POST /api/apple/apps/[appId]/screenshots` | Ekran görüntülerini getir |
| `POST /api/apple/apps/[appId]/screenshots/upload` | Ekran görüntüsü yükle |

### Gemini (`/api/gemini/*`)

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/gemini/verify` | API key doğrulama |
| `POST /api/gemini/models` | Kullanılabilir modelleri listele |
| `POST /api/gemini/translate-metadata` | Metadata çevirisi / limit düzeltme |
| `POST /api/gemini/generate-screenshot` | Lokalize ekran görüntüsü üret |

### Wiro (`/api/wiro/*`)

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/wiro/verify` | API key + secret doğrulama |
| `POST /api/wiro/models` | Görsel modelleri listele |

### Görsel (`/api/image/*`)

| Endpoint | Açıklama |
|----------|----------|
| `POST /api/image/resize-iphone-screenshot` | iPhone ekran görüntüsü boyutlandırma |

---

## AI prompt dosyaları

`public/prompts/` altındaki metin dosyaları, AI davranışını özelleştirmek için düzenlenebilir:

| Dosya | Kullanım |
|-------|----------|
| `metadata-translation.txt` | Metadata çeviri prompt'u |
| `metadata-limit-correction.txt` | Karakter limiti aşımı düzeltme prompt'u |
| `screenshot-localization.txt` | Ekran görüntüsü lokalizasyon prompt'u |

Değişiklikler sunucu yeniden başlatıldığında veya cache temizlendiğinde uygulanır.

---

## Geliştirme

### Teknoloji yığını

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui, Radix UI
- **Auth:** Apple JWT (`jose`)
- **Görsel işleme:** sharp
- **Test:** Vitest

### Metadata karakter limitleri

```typescript
// lib/apple/metadata-limits.ts
name:       30
subtitle:   30
description: 4000
keywords:   100
whatsNew:   4000
```

### localStorage anahtarları

| Anahtar | İçerik |
|---------|--------|
| `asc_credentials` | Apple Issuer ID, Key ID, Private Key |
| `gemini_settings` | Gemini API key, text/image model, verified |
| `wiro_settings` | Wiro API key, secret, image model, verified |

---

## Güvenlik notları

- Bu araç **dahili kullanım** için tasarlanmıştır; kimlik bilgileri tarayıcı `localStorage`'ında tutulur
- Production ortamında HTTPS kullanın
- `.p8` private key ve API secret'larını asla versiyon kontrolüne eklemeyin
- Paylaşımlı bilgisayarlarda **Disconnect** ile Apple oturumunu kapatın
- Gemini ve Wiro API anahtarları istemci → sunucu → harici API akışında geçici olarak kullanılır; sunucuda kalıcı depolanmaz

---

## Lisans

Private — dahili kullanım.
