-- Migration 050: Fulltext search support for Topbar Unified Search
-- Enables pg_trgm and GIN indexes for fast keyword search on projects (and optional commitments).
-- Vector search for KB remains in 025/026 (vector_chunks, embeddings).

-- Enable pg_trgm for trigram similarity and ILIKE optimization
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- GIN index on projects.name for fast trigram search (e.g. "pro" -> projects)
-- Requires table "projects" with column "name" (Supabase default schema).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'projects'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'name'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_projects_name_trgm
    ON public.projects USING gin (name gin_trgm_ops);
  END IF;
END $$;

-- Optional: GIN index on commitments.po_number for PO search
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'commitments'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'commitments' AND column_name = 'po_number'
  ) THEN
    CREATE INDEX IF NOT EXISTS idx_commitments_po_number_trgm
    ON public.commitments USING gin (po_number gin_trgm_ops);
  END IF;
END $$;

-- Note: Vector index for KB (vector_chunks.embedding, embeddings.embedding) is already
-- created in migrations 025_knowledge_base_rag_system.sql and 026_rag_embeddings_system.sql.
