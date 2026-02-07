# i18n Extension – Design

## 1. LanguageSwitcher-Komponente

### 1.1 Verantwortung

- Anzeige der aktuellen Sprache (Icon + Kurzcode oder Name).
- Dropdown mit allen unterstützten Locales (aus `lib/i18n/types`: `SUPPORTED_LANGUAGES`).
- Bei Klick auf eine Sprache: Cookie + localStorage setzen, `setLocale()` aufrufen, Dropdown schließen.

### 1.2 UI (Tailwind + lucide-react)

- **Trigger**: Button mit `Globe`-Icon (lucide-react), optional Kurzcode (z. B. "EN", "es-MX").
- **Dropdown**: `absolute right-0 mt-2`, `rounded-xl`, `shadow-lg`, `border`, `bg-white dark:bg-slate-800`; Liste von Buttons pro Sprache.
- **Pro Eintrag**: Flag/Emoji (oder Icon) + `nativeName` / `name` aus `SUPPORTED_LANGUAGES`.
- **Loading**: Während `setLocale` lädt: Spinner (z. B. `Loader2`) im Trigger oder in der Liste; Buttons disabled.

### 1.3 Props & Integration

- **Varianten** (wie bestehender `GlobalLanguageSelector`): `topbar` | `dropdown` | `sidebar`.
- In **AppLayout** wird der Switcher nicht direkt eingebaut; er sitzt in der **TopBar** (rechts im Header). AppLayout rendert nur `<TopBar />` und Content – die TopBar enthält bereits `GlobalLanguageSelector variant="topbar"`. Erweiterung: **GlobalLanguageSelector** um die neuen Locales erweitern ODER neue **LanguageSwitcher**-Komponente, die dieselbe Datenquelle (`SUPPORTED_LANGUAGES`) nutzt und in der TopBar neben/instead of dem bisherigen Selector verwendet wird.

**Empfehlung**: Eine gemeinsame Komponente (z. B. **LanguageSwitcher.tsx**) die `SUPPORTED_LANGUAGES` aus `lib/i18n/types` liest und alle Locales (inkl. es-MX, zh-CN, hi-IN, ja-JP, ko-KR, vi-VN) anzeigt. Bestehenden **GlobalLanguageSelector** durch Nutzung von `SUPPORTED_LANGUAGES` aus types erweitern, sodass nur eine Datenquelle existiert.

### 1.4 RTL

- Für Locales mit `rtl: true` (z. B. hi-IN, falls RTL gewünscht): Kein automatisches Layout-RTL in der Komponente selbst; RTL wird im **Layout** (siehe unten) gesetzt.

---

## 2. AppLayout / TopBar

- **TopBar**: Bereits Integration von `GlobalLanguageSelector variant="topbar"`. Erweiterung: **GlobalLanguageSelector** verwendet erweiterte `SUPPORTED_LANGUAGES` (mit neuen Locales) und ggf. umbenennen/refaktor zu **LanguageSwitcher** für Klarheit.
- **AppLayout**: Keine direkte Änderung der Kind-Struktur; optional **RTL-Wrapper**: wenn aktuelle Locale RTL ist, z. B. `<div dir="rtl" className="rtl">` um den Main-Content (oder in `layout.tsx` auf `<html>` / Haupt-Container). Tailwind: `rtl:` Utilities für Abstände und Textrichtung nutzbar.

---

## 3. Locale-JSON-Struktur

- Eine Datei pro Locale: `public/locales/{locale}.json`.
- Verschachtelte Keys wie bisher, z. B.:

```json
{
  "common": {
    "save": "Save",
    "cancel": "Cancel",
    "loading": "Loading..."
  },
  "costbook": {
    "variance": "Variance",
    "eac": "EAC",
    "bac": "BAC",
    "predictiveSimulations": "Predictive Simulations"
  },
  "financials": {
    "variance": "Variance",
    "varianceAnalysis": "Budget Variance Analysis"
  },
  "nav": {
    "financials": "Financials",
    "dashboards": "Dashboards"
  }
}
```

- Neue Locales (es-MX, zh-CN, …) können zunächst einen **Teilset** (z. B. `common`, `costbook`, `financials.variance*`, `nav`) enthalten; Rest fallback auf `en` über den Loader.

---

## 4. API: Translate (DeepL + RAG-Check)

- **Route**: `POST /api/translate/route.ts` (Next.js App Router).
- **Body**: `{ sourceLocale, targetLocale, payload }` – `payload` = Objekt mit Key-Value (flach oder verschachtelt).
- **Verhalten**:
  1. DeepL (oder Mock) aufrufen: Übersetzung pro String-Wert; Keys unverändert.
  2. Optional: RAG-Check – z. B. Backend-Service oder interne Logik, die Fachbegriffe (aus Help/Docs) erkennt und Vorschläge zurückgibt; Response kann `suggestions` oder `warnings` enthalten.
- **Response**: `{ translated: { ... }, suggestions?: [...], sourceLocale, targetLocale }`.
- **Sicherheit**: DeepL API-Key nur in Server-Umgebung (Env).

---

## 5. i18n-Config (loader / context)

- **Fallback**: Bereits `DEFAULT_LOCALE = 'en'`. Loader lädt `/locales/${locale}.json` und bei Fehler Fallback auf `en`.
- **Neue Locales**: In `lib/i18n/types.ts`: `SupportedLocale` um `'es-MX' | 'zh-CN' | 'hi-IN' | 'ja-JP' | 'ko-KR' | 'vi-VN'` erweitern; `SUPPORTED_LANGUAGES` um Einträge mit `code`, `name`, `nativeName`, `formalTone`, optional `rtl` ergänzen.
- **Context**: Keine Änderung der API; `setLocale` akzeptiert bereits String; Validierung gegen `SUPPORTED_LOCALES` (abgeleitet aus `SUPPORTED_LANGUAGES`).

---

## 6. Tests (Jest)

- **Language Switching**: Render LanguageSwitcher (oder GlobalLanguageSelector), klicke auf eine andere Sprache, prüfe dass `setLocale` mit dem richtigen Code aufgerufen wird und Cookie/localStorage gesetzt wird.
- **Costbook-Rendering**: Render eine Costbook-relevante Komponente (oder Minimal-Seite) mit verschiedenen Locales (Mock von `useI18n` / Provider mit `locale`), prüfe dass übersetzte Strings (z. B. "Variance", "EAC") vorkommen.
- **Suspense**: Kein Layout-Shift – z. B. Platzhalter für Switcher bis Locale geladen; Tests mit `Suspense`-Wrapper wo nötig.
