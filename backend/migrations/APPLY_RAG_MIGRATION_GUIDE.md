# RAG Migration Anwendungsanleitung

## Schritt 1: Supabase SQL Editor öffnen

1. Öffnen Sie Ihr Supabase Dashboard: https://supabase.com/dashboard
2. Wählen Sie Ihr Projekt aus
3. Navigieren Sie zu **SQL Editor** im linken Menü

## Schritt 2: Migration ausführen

1. Klicken Sie auf **New Query**
2. Öffnen Sie die Datei `backend/migrations/026_rag_embeddings_system.sql`
3. Kopieren Sie den **gesamten Inhalt** der Datei
4. Fügen Sie ihn in den SQL Editor ein
5. Klicken Sie auf **Run** (oder drücken Sie Cmd/Ctrl + Enter)

## Schritt 3: Überprüfung

Nach erfolgreicher Ausführung sollten Sie sehen:

```
Success. No rows returned
```

Überprüfen Sie, ob die Tabelle erstellt wurde:

```sql
SELECT * FROM embeddings LIMIT 1;
```

Überprüfen Sie die RPC-Funktionen:

```sql
SELECT * FROM get_embedding_stats();
```

## Schritt 4: Berechtigungen setzen (Optional)

Falls Sie Berechtigungsfehler erhalten, führen Sie aus:

```sql
GRANT SELECT, INSERT, UPDATE, DELETE ON embeddings TO authenticated;
GRANT EXECUTE ON FUNCTION vector_similarity_search TO authenticated;
GRANT EXECUTE ON FUNCTION get_embedding_stats TO authenticated;
GRANT EXECUTE ON FUNCTION delete_content_embedding TO authenticated;
GRANT EXECUTE ON FUNCTION batch_delete_embeddings TO authenticated;
```

## Troubleshooting

### Fehler: "extension vector does not exist"

Lösung: pgvector Extension muss aktiviert werden:

```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

Falls das nicht funktioniert, kontaktieren Sie den Supabase Support oder aktivieren Sie die Extension über das Dashboard unter **Database → Extensions**.

### Fehler: "permission denied"

Lösung: Verwenden Sie den Service Role Key statt des Anon Keys, oder führen Sie die Migration als Superuser aus.

### Fehler: "relation embeddings already exists"

Lösung: Die Tabelle existiert bereits. Sie können die Migration überspringen oder die Tabelle zuerst löschen:

```sql
DROP TABLE IF EXISTS embeddings CASCADE;
```

Dann die Migration erneut ausführen.

## Nächste Schritte nach erfolgreicher Migration

1. Content indexieren: `python backend/scripts/index_content_for_rag.py --batch`
2. RAG System testen über die API oder Frontend
3. Embedding-Statistiken überprüfen: `SELECT * FROM get_embedding_stats();`

---

**Wichtig**: Diese Migration ist **idempotent** - sie kann mehrfach ausgeführt werden ohne Fehler zu verursachen (dank `IF NOT EXISTS` Klauseln).
