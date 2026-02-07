# Locale-Dateien mit der xAI API erzeugen

Das Script `scripts/generate-locale-files-with-grok.ts` übersetzt `public/locales/en.json` in die neuen Sprachen (es-MX, zh-CN, hi-IN, ja-JP, ko-KR, vi-VN) über die **xAI API** (Grok) und schreibt die JSON-Dateien nach `public/locales/`.

## Voraussetzungen

- **API-Key**: Von [console.x.ai](https://console.x.ai) (xAI API).
- **Env**: Script lädt automatisch `.env`, `.env.local` und `backend/.env`. Key entweder als `XAI_API_KEY` setzen oder (wie im Backend) als `OPENAI_API_KEY` + `OPENAI_BASE_URL=https://api.x.ai/v1`.

## Ausführung

```bash
# Alle 6 neuen Locales aus en.json erzeugen (Key aus .env/backend/.env)
npm run generate-locales

# Key explizit übergeben
XAI_API_KEY=your-xai-key npx tsx scripts/generate-locale-files-with-grok.ts

# Nur bestimmte Locales (kommagetrennt)
GENERATE_LOCALES=es-MX,zh-CN npm run generate-locales
```

## Umgebungsvariablen

| Variable | Bedeutung | Default |
|----------|-----------|---------|
| `XAI_API_KEY` oder `OPENAI_API_KEY` | xAI API Key (erforderlich) | – |
| `XAI_API_URL` / `OPENAI_BASE_URL` | Chat-Completions-Endpoint | `https://api.x.ai/v1/chat/completions` |
| `XAI_MODEL` / `OPENAI_MODEL` | Modellname | `grok-beta` |
| `GENERATE_LOCALES` | Nur diese Locales (kommagetrennt) | `es-MX,zh-CN,hi-IN,ja-JP,ko-KR,vi-VN` |

## Verhalten

- Liest `public/locales/en.json`.
- Übersetzt alle String-Werte in Batches (ca. 45 Einträge pro Request) über die xAI API.
- **Placeholder** wie `{count}`, `{date}`, `{error}` werden nicht verändert.
- Bestehende Dateien (z. B. `es-MX.json`) werden als `.bak.<timestamp>` gesichert, bevor überschrieben wird.
- PPM-Fachbegriffe (Variance, EAC, BAC, Commitments, Actuals) werden in der System-Prompt erklärt für konsistente Übersetzungen.

## Nach dem Lauf

- **Review**: Übersetzungen von Muttersprachlern prüfen (v. a. Fachbegriffe).
- **Types**: Optional `npm run generate-types` ausführen, wenn neue Keys in `en.json` dazukommen.
