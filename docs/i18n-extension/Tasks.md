# i18n Extension – Tasks

## Task 1: Neue Locale-Ordner und -Dateien

- **1.1** Locale-Dateien anlegen: `public/locales/es-MX.json`, `zh-CN.json`, `hi-IN.json`, `ja-JP.json`, `ko-KR.json`, `vi-VN.json`.
- **1.2** In jeder Datei mindestens 5–10 Keys für Costbook/Financials (z. B. `common.loading`, `common.save`, `costbook.variance`, `financials.variance`, `financials.varianceAnalysis`, `nav.financials`, `nav.dashboards`, `variance.trends`, `variance.netVariance`, EAC/BAC falls in en vorhanden). Struktur an `en.json` anlehnen (Ausschnitt).
- **1.3** Optional: Script oder Doku, wie man per DeepL aus `en.json` die ersten Versionen erzeugt (siehe Task 2).

**Akzeptanz**: Alle 6 JSON-Dateien existieren, sind valide, und enthalten die genannten Keys.

---

## Task 2: DeepL-Endpoint für Übersetzung (Next.js API)

- **2.1** Route anlegen: `app/api/translate/route.ts`.
- **2.2** POST-Handler: Body `{ sourceLocale, targetLocale, payload }`. `payload` = Objekt mit String-Werten (verschachtelt erlaubt).
- **2.3** DeepL API aufrufen (serverseitig, Env `DEEPL_API_KEY`). Wenn Key fehlt: Fallback auf Mock (Echo oder einfache Platzhalter-Übersetzung).
- **2.4** Response: `{ translated: { ... }, sourceLocale, targetLocale }`. Optional: `suggestions` für Fachbegriffe (RAG-Check, siehe FR-6.2).
- **2.5** Doku: Kurze Anleitung in `docs/i18n-extension/` wie man ein neues Locale-JSON per API aus `en` erzeugt.

**Akzeptanz**: POST /api/translate mit gültigem Body liefert übersetztes JSON; ohne API-Key funktioniert Mock.

**Implementiert**: `app/api/translate/route.ts` – DeepL-Integration (Env `DEEPL_API_KEY`, optional `DEEPL_API_URL`); ohne Key werden Keys unverändert zurückgegeben. Optionaler RAG-Check über `getTermSuggestions()` erweiterbar (z. B. Backend Help-RAG).

---

## Task 3: LanguageSwitcher-Komponente + Integration in TopBar/AppLayout

- **3.1** Komponente **LanguageSwitcher.tsx** (oder Erweiterung **GlobalLanguageSelector**): Tailwind-Dropdown, Globe-Icon, Liste aus `SUPPORTED_LANGUAGES` (siehe Task 4), mit Name/Flag pro Sprache.
- **3.2** Nutzung von `useI18n()`: `locale`, `setLocale`, `isLoading`. Bei Wechsel: Cookie setzen (wie bisher), `setLocale(code)` aufrufen.
- **3.3** In **TopBar**: LanguageSwitcher rechts im Header einbinden (ggf. GlobalLanguageSelector durch erweiterte Liste ersetzen).
- **3.4** Optional: In **AppLayout** oder Layout nur RTL-Container (Task 5), keine weitere Strukturänderung nötig.

**Akzeptanz**: In der TopBar sichtbar; Wechsel auf es-MX/zh-CN/… lädt die passende Locale und aktualisiert die UI.

---

## Task 4: i18n-Config erweitern (neue Locales + Fallback)

- **4.1** In `lib/i18n/types.ts`: `SupportedLocale` um `'es-MX' | 'zh-CN' | 'hi-IN' | 'ja-JP' | 'ko-KR' | 'vi-VN'` erweitern.
- **4.2** `SUPPORTED_LANGUAGES` um 6 Einträge ergänzen: `code`, `name`, `nativeName`, `formalTone`, optional `rtl` (z. B. hi-IN: false, sofern kein RTL gewünscht).
- **4.3** Sicherstellen, dass Loader weiterhin `/locales/${locale}.json` lädt und bei 404/Fehler auf `en` fallbackt (bereits so implementiert).
- **4.4** Optional: `npm run generate-types` ausführen, falls Keys aus en.json generiert werden – neue Locales nutzen dieselben Keys.

**Akzeptanz**: `setLocale('es-MX')` lädt `es-MX.json`; fehlende Keys zeigen Fallback aus `en`.

---

## Task 5: RTL-Support (hi-IN, falls nötig)

- **5.1** In `lib/i18n/types.ts`: pro Sprache optional `rtl?: boolean` (z. B. hi-IN: false, da Hindi meist LTR; nur wenn explizit RTL gewünscht, auf true setzen).
- **5.2** Im Root-Layout oder AppLayout: wenn aktuelle Locale `rtl === true`, dann `dir="rtl"` und ggf. Klasse `rtl` setzen (z. B. auf `<html>` oder Haupt-Container).
- **5.3** Tailwind: `rtl:` Varianten für relevante Komponenten (z. B. Sidebar, Tabellen) nutzbar halten; keine Pflichtänderungen, wenn hi-IN LTR bleibt.

**Akzeptanz**: Wenn eine Locale als RTL markiert ist, erscheint die App in RTL ohne visuelle Brüche.

---

## Task 6: Tests (Jest)

- **6.1** Test: Language-Switching – Render LanguageSwitcher (oder GlobalLanguageSelector), simuliere Klick auf andere Sprache, prüfe Aufruf von `setLocale` mit korrektem Code und Cookie/localStorage.
- **6.2** Test: Costbook-Seite (oder eine Komponente mit Costbook-Strings) – mit verschiedenen Locales (Provider mit `locale` gesetzt), prüfe dass z. B. "Variance" / "EAC" / "Varianza" (oder entsprechende Übersetzung) im gerenderten Output vorkommt.
- **6.3** Optional: Test für Multilingual AI-Chat – Mock Help-Chat-Response und prüfe Anzeige in gewählter Sprache.
- **6.4** Suspense: Switcher oder Layout mit Suspense-Boundary testen, kein Layout-Shift.

**Akzeptanz**: Jest-Tests grün; Costbook- und Switcher-Tests vorhanden.

**Implementiert**: `__tests__/i18n-extension/language-switching.test.tsx` (Switcher listet alle Locales, Cookie bei Wechsel), `__tests__/i18n-extension/costbook-locale-rendering.test.tsx` (Costbook-Labels in Default- und es-MX-Locale).

---

## Abhängigkeiten zwischen Tasks

- Task 4 (i18n-Config) sollte vor Task 3 (LanguageSwitcher) erledigt werden.
- Task 1 (Locale-Dateien) kann parallel zu Task 2 und 4; Task 2 liefert ggf. Inhalte für Task 1.
- Task 5 (RTL) baut auf Task 4 auf (rtl-Flag in Metadaten).
- Task 6 (Tests) baut auf Task 3 und 4 auf.

**Empfohlene Reihenfolge**: 1 → 4 → 3 → 2 → 5 → 6 (oder 1 und 4 parallel, dann 3, 2, 5, 6).
