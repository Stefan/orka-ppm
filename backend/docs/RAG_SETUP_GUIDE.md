# RAG System Setup Guide

This guide walks you through setting up the RAG (Retrieval-Augmented Generation) system for AI-powered natural language queries.

## Prerequisites

- Supabase database with admin access
- OpenAI API key (or compatible API like Grok)
- Python 3.11+ environment
- Backend dependencies installed

## Step 1: Configure Environment Variables

Add the following environment variables to your `.env` file:

```bash
# Required: OpenAI API Key
OPENAI_API_KEY=sk-...

# Optional: Custom OpenAI-compatible API endpoint (e.g., for Grok)
OPENAI_BASE_URL=https://api.openai.com/v1

# Optional: Specific models to use
OPENAI_MODEL=gpt-4
OPENAI_EMBEDDING_MODEL=text-embedding-ada-002
```

### Getting an OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key (starts with `sk-`)
6. Add it to your `.env` file

### Using Alternative Providers (e.g., Grok)

If you want to use Grok or another OpenAI-compatible API:

```bash
OPENAI_API_KEY=your-grok-api-key
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning
```

## Step 2: Apply Database Migration

The RAG system requires a database table for storing vector embeddings.

### Option A: Using Supabase SQL Editor (Recommended)

1. Open your Supabase Dashboard
2. Navigate to SQL Editor
3. Open the file `backend/migrations/026_rag_embeddings_system.sql`
4. Copy the entire contents
5. Paste into the SQL Editor
6. Click "Run" to execute

### Option B: Using Python Script

```bash
cd backend/migrations
python apply_rag_embeddings_migration.py
```

**Note:** The Python script may require manual execution via SQL Editor due to Supabase client limitations.

### Verify Migration

Check that the following were created:

- ✅ `embeddings` table
- ✅ `vector_similarity_search` function
- ✅ `get_embedding_stats` function
- ✅ `delete_content_embedding` function
- ✅ `batch_delete_embeddings` function

You can verify by running:

```sql
SELECT * FROM embeddings LIMIT 1;
SELECT * FROM get_embedding_stats();
```

## Step 3: Index Existing Content

After the database is set up, index your existing content:

```bash
cd backend/scripts
python index_content_for_rag.py
```

### Indexing Options

```bash
# Index all content
python index_content_for_rag.py

# Index specific content types
python index_content_for_rag.py --types projects portfolios

# Index for specific organization
python index_content_for_rag.py --org-id <organization-uuid>

# Batch mode (no confirmation)
python index_content_for_rag.py --batch
```

### What Gets Indexed

The script indexes:
- **Projects**: Name, description, status, priority, budget, dates
- **Portfolios**: Name, description, owner
- **Resources**: Name, role, skills, location, availability
- **Risks**: Title, description, category, probability, impact, mitigation
- **Issues**: Title, description, severity, status, resolution

## Step 4: Test the RAG System

### Using the API

```bash
curl -X POST http://localhost:8000/ai/rag/query \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What projects are currently active?",
    "conversation_id": "test-conv-1"
  }'
```

### Using the Frontend

1. Navigate to the Reports page
2. Use the AI Chat interface
3. Ask natural language questions about your projects

### Expected Response

```json
{
  "response": "Based on your data, you have 5 active projects...",
  "sources": [
    {
      "type": "project",
      "id": "proj-123",
      "similarity": 0.92
    }
  ],
  "confidence_score": 0.85,
  "conversation_id": "test-conv-1",
  "response_time_ms": 1250
}
```

## Step 5: Set Up Automatic Indexing (Optional)

For real-time updates, you can set up automatic indexing when content changes.

### Option A: Database Triggers

Create triggers that call the indexing service when content is updated:

```sql
-- Example trigger for projects table
CREATE OR REPLACE FUNCTION trigger_reindex_project()
RETURNS TRIGGER AS $$
BEGIN
  -- Call your indexing service via webhook or queue
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

### Option B: Background Job

Set up a cron job or scheduled task to re-index periodically:

```bash
# Add to crontab (runs daily at 2 AM)
0 2 * * * cd /path/to/backend/scripts && python index_content_for_rag.py --batch
```

### Option C: Application-Level Hooks

Update your application code to call the indexing service after content changes:

```python
from services.content_indexing_service import ContentIndexingService

# After creating/updating a project
await indexing_service.index_single_content(
    content_type="project",
    content_id=project_id,
    content_data=project_data
)
```

## Monitoring and Maintenance

### Check Embedding Statistics

```sql
SELECT * FROM get_embedding_stats();
```

This shows:
- Number of embeddings per content type
- Average text length
- Latest update timestamp

### Monitor API Usage

Check your OpenAI API usage:
1. Go to [OpenAI Usage Dashboard](https://platform.openai.com/usage)
2. Monitor token consumption
3. Set up billing alerts

### Performance Optimization

For large datasets (>10,000 embeddings), consider:

1. **Adjust IVFFlat index lists**:
   ```sql
   -- Increase lists for better performance
   DROP INDEX embeddings_vector_idx;
   CREATE INDEX embeddings_vector_idx ON embeddings 
   USING ivfflat (embedding vector_cosine_ops)
   WITH (lists = 500);
   ```

2. **Batch indexing**: Process in smaller batches during off-peak hours

3. **Caching**: Implement caching for frequently asked questions

## Troubleshooting

### Issue: "OpenAI API key not set"

**Solution**: Ensure `OPENAI_API_KEY` is in your `.env` file and the backend is restarted.

### Issue: "embeddings table does not exist"

**Solution**: Run the database migration (Step 2).

### Issue: "vector extension not found"

**Solution**: Enable pgvector extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### Issue: "No results returned for queries"

**Solution**: 
1. Check if content is indexed: `SELECT COUNT(*) FROM embeddings;`
2. If count is 0, run the indexing script (Step 3)

### Issue: "Rate limit exceeded"

**Solution**:
1. Reduce batch size in `content_indexing_service.py`
2. Add delays between API calls
3. Upgrade your OpenAI plan

### Issue: "Low confidence scores"

**Solution**:
1. Improve content text generation (more descriptive)
2. Index more content for better context
3. Fine-tune similarity threshold

## Cost Estimation

### OpenAI API Costs

**Embedding Generation** (text-embedding-ada-002):
- $0.0001 per 1K tokens
- Average project: ~200 tokens
- 1,000 projects: ~$0.02

**Chat Completions** (gpt-4):
- Input: $0.03 per 1K tokens
- Output: $0.06 per 1K tokens
- Average query: ~$0.01-0.05

**Monthly Estimate** (1,000 projects, 1,000 queries/month):
- Initial indexing: $0.02
- Re-indexing (weekly): $0.08/month
- Queries: $10-50/month
- **Total: ~$10-50/month**

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for all sensitive data
3. **Rotate API keys** regularly
4. **Monitor usage** for unusual activity
5. **Implement rate limiting** on your endpoints
6. **Filter by organization_id** to prevent data leakage

## Next Steps

After setup is complete:

1. ✅ Test with sample queries
2. ✅ Monitor performance and costs
3. ✅ Set up automatic indexing
4. ✅ Train users on how to use the AI chat
5. ✅ Collect feedback and iterate

## Support

For issues or questions:
- Check the [RAG Implementation Status](../docs/RAG_IMPLEMENTATION_STATUS.md)
- Review the [API Documentation](../docs/api_documentation.py)
- Contact your system administrator

---

**Last Updated**: January 19, 2026
