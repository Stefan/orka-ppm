# RAG System Schnellstart-Anleitung

## Übersicht

Diese Anleitung führt Sie durch die schnelle Einrichtung des RAG (Retrieval-Augmented Generation) Systems mit Ihrer bestehenden Grok API-Konfiguration.

## Voraussetzungen

✅ Sie haben bereits:
- Grok API-Key konfiguriert (`OPENAI_API_KEY` in `.env`)
- Grok Base URL konfiguriert (`OPENAI_BASE_URL=https://api.x.ai/v1`)
- `USE_LOCAL_EMBEDDINGS=true` gesetzt

## Schritt 1: Dependencies installieren

```bash
cd backend

# Sentence-transformers für lokale Embeddings installieren
pip install sentence-transformers

# Oder alle Dependencies neu installieren
pip install -r requirements.txt
```

Das Embedding-Modell wird beim ersten Start automatisch heruntergeladen (~80MB).

## Schritt 2: Database Migration anwenden

### Option A: Via Supabase SQL Editor (Empfohlen)

1. Öffnen Sie Ihr [Supabase Dashboard](https://supabase.com/dashboard)
2. Navigieren Sie zu **SQL Editor**
3. Öffnen Sie die Datei `backend/migrations/026_rag_embeddings_system.sql`
4. Kopieren Sie den **gesamten Inhalt**
5. Fügen Sie ihn in den SQL Editor ein
6. Klicken Sie auf **Run**

### Option B: Via Python Script

```bash
cd backend/migrations
python apply_rag_embeddings_migration.py
```

**Hinweis**: Das Python-Script zeigt Ihnen an, welche Statements manuell ausgeführt werden müssen.

### Überprüfung

```sql
-- Im Supabase SQL Editor ausführen
SELECT * FROM embeddings LIMIT 1;
SELECT * FROM get_embedding_stats();
```

## Schritt 3: Content indexieren

```bash
cd backend/scripts

# Alle Inhalte indexieren (Batch-Modus)
python index_content_for_rag.py --batch

# Oder interaktiv mit Bestätigung
python index_content_for_rag.py

# Nur bestimmte Content-Typen
python index_content_for_rag.py --types projects portfolios --batch
```

**Erwartete Ausgabe**:
```
🚀 Starting indexing at 2026-01-19 15:30:00
📝 Indexing projects...
✅ Projects: 45 items indexed
📝 Indexing portfolios...
✅ Portfolios: 12 items indexed
...
✅ Indexing complete!
```

**Dauer**: ~1-2 Minuten für 1000 Items (mit lokalen Embeddings)

## Schritt 4: System testen

```bash
cd backend/scripts
python test_rag_system.py
```

**Erwartete Ausgabe**:
```
✅ RAG agent initialized
✅ Embeddings table exists
✅ Embedding generated successfully
✅ RAG query successful
💬 Response: Based on your data, you have 45 active projects...
🎯 Confidence: 0.85
```

## Schritt 5: RAG System verwenden

### Via API

```bash
curl -X POST http://localhost:8000/ai/rag/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Welche Projekte sind aktuell aktiv?",
    "conversation_id": "test-conv-1"
  }'
```

### Via Frontend

1. Navigieren Sie zur **Reports** Seite
2. Verwenden Sie das **AI Chat** Interface
3. Stellen Sie natürlichsprachliche Fragen zu Ihren Projekten

## Konfiguration mit Grok

Ihre aktuelle `.env` Konfiguration:

```bash
# Grok API für Chat-Completions
OPENAI_API_KEY=xai-...
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning

# Lokale Embeddings (da Grok keine Embeddings hat)
USE_LOCAL_EMBEDDINGS=true
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002  # Wird ignoriert bei USE_LOCAL_EMBEDDINGS=true
```

### Wie es funktioniert

1. **Embeddings**: Verwendet `sentence-transformers` (all-MiniLM-L6-v2) lokal
   - Keine API-Kosten
   - Schnell (~10ms pro Embedding)
   - 384 Dimensionen (wird auf 1536 gepaddet für Kompatibilität)

2. **Chat-Completions**: Verwendet Grok API
   - Schnelle Antworten mit grok-4-fast-reasoning
   - Ihre bestehende API-Key-Konfiguration

## Troubleshooting

### Problem: "sentence-transformers not installed"

**Lösung**:
```bash
pip install sentence-transformers
```

### Problem: "embeddings table does not exist"

**Lösung**: Database Migration anwenden (Schritt 2)

### Problem: "No embeddings found"

**Lösung**: Content indexieren (Schritt 3)

### Problem: "Grok API error"

**Lösung**: Überprüfen Sie Ihren API-Key:
```bash
# In .env
OPENAI_API_KEY=xai-...  # Muss mit 'xai-' beginnen
OPENAI_BASE_URL=https://api.x.ai/v1  # Korrekte Grok URL
```

### Problem: Langsame Embedding-Generierung

**Lösung**: Das erste Mal dauert länger (Modell-Download). Danach ist es schnell.

## Performance

### Lokale Embeddings (sentence-transformers)

- **Geschwindigkeit**: ~10-50ms pro Embedding
- **Kosten**: Kostenlos (lokal)
- **Qualität**: Gut für die meisten Anwendungsfälle
- **Offline**: Funktioniert ohne Internet

### Grok Chat-Completions

- **Geschwindigkeit**: ~500-2000ms pro Query
- **Kosten**: Siehe Grok Pricing
- **Qualität**: Sehr gut mit grok-4-fast-reasoning

## Nächste Schritte

### Automatisches Re-Indexing einrichten

**Option A: Cron Job** (täglich um 2 Uhr)
```bash
0 2 * * * cd /path/to/backend/scripts && python index_content_for_rag.py --batch
```

**Option B: Database Trigger** (Echtzeit)
```sql
-- Trigger für automatisches Re-Indexing bei Projekt-Updates
CREATE OR REPLACE FUNCTION trigger_reindex_project()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify('content_updated', json_build_object(
    'content_type', 'project',
    'content_id', NEW.id,
    'action', TG_OP
  )::text);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER project_reindex_trigger
AFTER INSERT OR UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION trigger_reindex_project();
```

### Monitoring

```sql
-- Embedding-Statistiken anzeigen
SELECT * FROM get_embedding_stats();

-- Letzte Indexierungen
SELECT content_type, COUNT(*), MAX(updated_at) as last_update
FROM embeddings
GROUP BY content_type;
```

## Support

Bei Fragen oder Problemen:
- Siehe `RAG_SETUP_GUIDE.md` für detaillierte Dokumentation
- Siehe `APPLY_RAG_MIGRATION_GUIDE.md` für Migration-Hilfe
- Siehe `TASK_1_IMPLEMENTATION_SUMMARY.md` für technische Details

---

**Letzte Aktualisierung**: 19. Januar 2026
**Status**: Produktionsbereit mit Grok + lokalen Embeddings
