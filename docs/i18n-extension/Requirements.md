# i18n Extension – Requirements

## Overview

Erweiterung des bestehenden i18n-Systems (Next.js 16, Tailwind, JSON-Locales, `lib/i18n`) um sechs neue Sprachen für die PPM-SaaS-App. Fokus: Costbook, AI-Chat und konsistente Fachbegriffe (z. B. Variance → Varianza / 差異).

## Functional Requirements

### FR-1: Neue Locale-Dateien

- **FR-1.1** Neue Locales: **es-MX** (Spanisch Mexiko), **zh-CN** (Chinesisch vereinfacht, China), **hi-IN** (Hindi, Indien), **ja-JP** (Japanisch, Japan), **ko-KR** (Koreanisch, Korea), **vi-VN** (Vietnamesisch, Vietnam).
- **FR-1.2** Locale-Dateien unter `public/locales/{locale}.json` (bestehendes Muster), z. B. `public/locales/es-MX.json`.
- **FR-1.3** Struktur wie bestehende Locales: verschachtelte Keys (z. B. `costbook.variance`, `financials.variance`, `common.save`). Mindestens Costbook-relevante Keys (Variance, EAC, BAC, etc.) in jeder neuen Locale.

### FR-2: Auto-Translate (DeepL API)

- **FR-2.1** Initiale Übersetzung neuer Locale-Dateien per **DeepL API** (JSON-Export von `en`, Übersetzung pro Wert, Rückgabe als JSON).
- **FR-2.2** Manueller Review für Fachbegriffe: z. B. "Variance" → "Varianza" (es-MX), "差異" (ja-JP); "EAC" / "BAC" je nach Konvention (Beibehaltung oder Lokalisierung).
- **FR-2.3** API-Endpoint: z. B. `POST /api/translate` mit Body `{ sourceLocale, targetLocale, payload }` (payload = flache Key-Value oder verschachteltes JSON). Response: übersetztes JSON.

### FR-3: Language-Switcher in Topbar

- **FR-3.1** Language-Switcher in der **Topbar** (rechts, z. B. neben Benachrichtigungen/User-Menü): Dropdown mit **Globe-Icon** (lucide-react).
- **FR-3.2** Liste aller unterstützten Locales mit **Name + Flag/Icon** (Emoji oder Icon-Components).
- **FR-3.3** Aktuelle Sprache sichtbar; Wechsel speichert in localStorage/Cookie (bestehendes Verhalten) und lädt die passende Locale-Datei.

### FR-4: RTL-Support (hi-IN optional)

- **FR-4.1** RTL-Support für **hi-IN**, falls erforderlich (Tailwind `rtl:` Utilities, `dir="rtl"` am Layout/Container).
- **FR-4.2** Kein RTL für es-MX, zh-CN, ja-JP, ko-KR, vi-VN (LTR).

### FR-5: Tests

- **FR-5.1** **Multilingual AI-Chat**: Test, dass Help-Chat-Antworten bzw. UI-Labels in der gewählten Sprache angezeigt werden (z. B. Costbook-Begriffe).
- **FR-5.2** **Costbook-Seite**: Test, dass z. B. "EAC", "Variance", "Budget" in jeder unterstützten Sprache gerendert werden (Übersetzung oder Fallback en).

### FR-6: AI-Übersetzungs-Optimierung (10x)

- **FR-6.1** Optional: Kontextspezifische Übersetzung (z. B. "Predictive Simulations" in vi-VN, pharma-spezifisch) per **Grok/Fine-Tune** oder Prompt mit Domänen-Kontext.
- **FR-6.2** Anbindung an bestehendes **RAG** (Help/Dokumentation): Übersetzungsvorschläge gegen RAG prüfen (Fachbegriffe, konsistente Terminologie).

## Non-Functional Requirements

- **NFR-1** Keine Breaking Changes am bestehenden i18n-System (loader, context, `t()`).
- **NFR-2** Neue Locales mit **Fallback auf `en`** bei fehlenden Keys.
- **NFR-3** Language-Switcher **testbar** (Jest) und **Suspense-kompatibel** (kein Layout-Shift beim Locale-Wechsel).
- **NFR-4** DeepL-API-Calls nur serverseitig; API-Key nicht im Client exponieren.

## Abhängigkeiten

- Bestehend: `lib/i18n` (loader, context, types), `public/locales/*.json`, `GlobalLanguageSelector`, TopBar.
- Optional: Backend `translation_service.py` / Help-RAG für Übersetzungs-Check.
