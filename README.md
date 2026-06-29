# App Store Connect Manager

> 🇬🇧 English · [Türkçe](README-tr.md)

An internal Next.js tool for managing App Store Connect metadata in the browser, editing multi-locale localizations, and generating translations and screenshots with AI.

It combines the Apple App Store Connect API, Google Gemini, and Wiro AI in a single interface. All credentials are stored only in your browser (`localStorage`) and are never persisted on the server.

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Requirements](#requirements)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
  - [Apple App Store Connect](#apple-app-store-connect)
  - [Google Gemini](#google-gemini)
  - [Wiro AI](#wiro-ai)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Endpoints](#api-endpoints)
- [AI Prompt Files](#ai-prompt-files)
- [Development](#development)
- [Security Notes](#security-notes)

---

## Features

### App Store Connect

- **App listing** — View all apps in your ASC account with icon, bundle ID, and primary locale
- **Metadata editing** — Edit name, subtitle, description, keywords, what's new, and URL fields per locale
- **Character limit tracking** — Live counters and over-limit warnings based on App Store Connect limits
- **Multi-locale navigation** — Visual badges for unsaved changes and limit errors
- **Screenshot viewing** — Browse iPhone / iPad sets with a lightbox
- **Screenshot upload** — Upload AI-generated images directly to ASC

### Bulk import tools

| Tool | Description |
|------|-------------|
| **Privacy Policy** | Copy a privacy policy URL from a template to all locales |
| **Sync URLs** | Sync support / marketing URLs from the primary locale to other languages |
| **Auto Translate** | Translate metadata with Gemini; auto-correct when limits are exceeded |
| **Auto Image Generation** | Generate localized screenshots for target locales from a source locale |

### AI integrations

| Provider | Use case |
|----------|----------|
| **Google Gemini** | Metadata translation, screenshot localization (text + image models) |
| **Wiro AI** | Image generation / editing models (settings ready; integration extensible) |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Browser (Client)                         │
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

Credentials are sent from the client to the server on each request, used for external API calls, and returned. There is no server-side database or persistent credential store.

---

## Requirements

- **Node.js** 20+
- **npm** (or a compatible package manager)
- App Store Connect **API Key** (.p8 private key)
- (Optional) [Google AI Studio](https://aistudio.google.com/) Gemini API key
- (Optional) [Wiro](https://wiro.ai/) API key + secret

---

## Getting Started

```bash
git clone <repo-url>
cd appstore-manager
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). On first visit, if Apple credentials are not configured, you are redirected to **Settings → Apple Settings**.

### Other commands

```bash
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
npm run test     # Vitest unit tests
```

---

## Configuration

All settings are managed from the **Settings** page (`/settings`).

### Apple App Store Connect

Under **Settings → Apple Settings**:

| Field | Description |
|-------|-------------|
| **Issuer ID** | App Store Connect → Users and Access → Keys → Issuer ID (UUID) |
| **Key ID** | 10-character ID of your API key |
| **Private Key** | Contents of your `.p8` file (drag-and-drop or paste) |

Use **Test Connection** to verify, then **Save** to store credentials in the browser.

> Your API key must be created with **App Manager** or an appropriate role.

### Google Gemini

Under **Settings → Gemini Settings**:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/apikey)
2. Click **Verify API Key**
3. **Text Model** — for metadata translation (e.g. `gemini-2.5-flash`)
4. **Image Model** — for screenshot localization (e.g. `gemini-2.5-flash-image`)
5. **Save Settings**

Auto Translate and Auto Image Generation require saved Gemini settings.

### Wiro AI

Under **Settings → Wiro AI Settings**:

1. Create a project in the [Wiro Dashboard](https://wiro.ai/panel)
2. Enter your **API Key** and **API Secret** (signature-based authentication)
3. Click **Verify Credentials**
4. **Image Model** — lists models in image-generation, image-to-image, and image-editing categories
5. **Save Settings**

Model ID format: `owner-slug/model-slug` (e.g. `wiro/virtual-try-on`)

---

## Usage

### 1. Select an app

Open `/apps` and click an app. The detail page shows version info, primary locale, and all localizations.

### 2. Edit metadata

- Pick a locale from the locale badges
- Edit fields under the **Text** tab
- Character counters reflect App Store limits
- Click **Save** to push changes to App Store Connect

**Editable fields:** Name, Subtitle, Description, Keywords, What's New, Support URL, Marketing URL, Privacy Policy URL

### 3. Screenshots

- View iPhone / iPad sets under the **Screenshots** tab
- Use **Create with AI** on a locale to generate localized screenshots from a source locale
- Preview generated images and upload them to ASC

### 4. Bulk actions (Import Toolbar)

The toolbar at the top of the app detail page:

- **Privacy Policy** — Apply a privacy policy URL template to all locales
- **Auto Translate** — Gemini translation for selected locales; partial translation and optional what's new
- **Auto Image Generation** — Bulk AI screenshot localization from a source locale; review and upload in batch

### 5. URL sync

Use the **Sync URLs** modal to copy support and marketing URLs from the primary locale to other languages.

---

## Project Structure

```
appstore-manager/
├── app/
│   ├── api/
│   │   ├── apple/          # App Store Connect proxy
│   │   ├── gemini/         # Gemini verify, models, translate, screenshot
│   │   ├── wiro/           # Wiro verify, models
│   │   └── image/          # Image resizing (sharp)
│   ├── apps/               # App list and detail pages
│   └── settings/           # Settings page
├── components/
│   ├── import/             # Bulk import modals
│   ├── settings/           # Apple, Gemini, Wiro settings forms
│   └── ui/                 # shadcn/ui components
├── lib/
│   ├── apple/              # ASC client, auth, screenshots, types
│   ├── gemini/             # Gemini client, translate, prompts
│   ├── wiro/               # Wiro client, settings
│   ├── image/              # iPhone screenshot resize
│   └── screenshots/        # AI generation batch logic
└── public/prompts/         # Editable AI prompt templates
```

---

## API Endpoints

### Apple (`/api/apple/*`)

| Endpoint | Description |
|----------|-------------|
| `POST /api/apple/test` | Verify credentials |
| `POST /api/apple/apps` | List apps |
| `POST /api/apple/apps/[appId]` | App detail |
| `POST /api/apple/apps/[appId]/localizations` | Save metadata |
| `POST /api/apple/apps/[appId]/import/privacy-policy` | Import privacy policy URL |
| `POST /api/apple/apps/[appId]/import/urls` | Import support / marketing URLs |
| `POST /api/apple/apps/[appId]/screenshots` | Fetch screenshots |
| `POST /api/apple/apps/[appId]/screenshots/upload` | Upload screenshot |

### Gemini (`/api/gemini/*`)

| Endpoint | Description |
|----------|-------------|
| `POST /api/gemini/verify` | Verify API key |
| `POST /api/gemini/models` | List available models |
| `POST /api/gemini/translate-metadata` | Translate metadata / fix limits |
| `POST /api/gemini/generate-screenshot` | Generate localized screenshot |

### Wiro (`/api/wiro/*`)

| Endpoint | Description |
|----------|-------------|
| `POST /api/wiro/verify` | Verify API key + secret |
| `POST /api/wiro/models` | List image models |

### Image (`/api/image/*`)

| Endpoint | Description |
|----------|-------------|
| `POST /api/image/resize-iphone-screenshot` | Resize iPhone screenshot |

---

## AI Prompt Files

Text files under `public/prompts/` can be edited to customize AI behavior:

| File | Purpose |
|------|---------|
| `metadata-translation.txt` | Metadata translation prompt |
| `metadata-limit-correction.txt` | Character limit correction prompt |
| `screenshot-localization.txt` | Screenshot localization prompt |

Changes take effect after a server restart or cache clear.

---

## Development

### Tech stack

- **Framework:** Next.js 16 (App Router)
- **UI:** React 19, Tailwind CSS 4, shadcn/ui, Radix UI
- **Auth:** Apple JWT (`jose`)
- **Image processing:** sharp
- **Testing:** Vitest

### Metadata character limits

```typescript
// lib/apple/metadata-limits.ts
name:       30
subtitle:   30
description: 4000
keywords:   100
whatsNew:   4000
```

### localStorage keys

| Key | Contents |
|-----|----------|
| `asc_credentials` | Apple Issuer ID, Key ID, Private Key |
| `gemini_settings` | Gemini API key, text/image model, verified |
| `wiro_settings` | Wiro API key, secret, image model, verified |

---

## Security Notes

- This tool is designed for **internal use**; credentials live in browser `localStorage`
- Use HTTPS in production
- Never commit `.p8` private keys or API secrets to version control
- On shared machines, use **Disconnect** to clear Apple credentials
- Gemini and Wiro API keys pass through client → server → external API; they are not stored on the server

---

## License

Private — internal use only.
