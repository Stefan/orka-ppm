# Help Chat Multilingual System

## Overview

The Help Chat system now supports 6 languages with optimized performance and intelligent caching.

## Supported Languages

1. **English (en)** - Default
2. **German (de)** - Deutsch
3. **French (fr)** - Français
4. **Spanish (es)** - Español
5. **Polish (pl)** - Polski
6. **Swiss German (gsw)** - Baseldytsch

## Features

### Direct Language Generation
- AI responds directly in the target language
- No separate translation step (faster responses)
- Language-specific prompts for better quality

### Performance Optimizations
- **Response Time**: 2.5-3.7 seconds for new queries (down from 41s)
- **Cached Responses**: ~0ms (instant)
- **Cache TTL**: 5 minutes
- **Cache Type**: In-memory with language-specific keys

### Keyword Recognition
The system recognizes PPM-related keywords in all 6 languages, including:
- Projects, portfolios, resources
- Budgets, schedules, risks
- Dashboards, reports, analytics
- Polish declensions (projekt, projektu, projektów, etc.)

## Architecture

### Backend Components

#### `help_rag_agent.py`
- Main query processing
- Direct language generation
- Keyword validation for all languages
- Optimized prompts (max 300 tokens)

#### `help_chat_cache.py`
- In-memory caching
- Language-specific cache keys
- Automatic cleanup (>1000 entries)
- 5-minute TTL

#### `help_chat.py` (Router)
- Request handling
- Cache lookup/storage
- Language parameter passing

### Frontend Components

#### `HelpChatProvider.tsx`
- Language synchronization with global i18n
- State management
- Debug logging

#### `useLanguage.ts`
- Language preference management
- Integration with i18n system
- Disabled server sync (local preference only)

#### `GlobalLanguageSelector.tsx`
- Language switching UI
- Cookie synchronization
- All 6 languages supported

## Configuration

### Environment Variables

```bash
# XAI/Grok Configuration
OPENAI_API_KEY=xai-your-key-here
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning

# Local Embeddings (Grok doesn't support embeddings)
USE_LOCAL_EMBEDDINGS=true
```

### Model Settings
- **Model**: `grok-4-fast-reasoning`
- **Temperature**: 0 (deterministic)
- **Max Tokens**: 300 (concise responses)

## Usage

### Switching Languages

1. Click the language selector (globe icon)
2. Select desired language
3. Help Chat automatically syncs
4. Ask questions in the selected language

### Cache Behavior

- **First query**: ~3 seconds (AI generation)
- **Repeated query**: ~0ms (from cache)
- **Different language**: New cache entry
- **Cache expiry**: 5 minutes

### Example Queries

**English**: "What is variance tracking?"
**German**: "Was ist Varianz-Tracking?"
**French**: "Qu'est-ce que le suivi des écarts?"
**Spanish**: "¿Qué es el seguimiento de varianza?"
**Polish**: "Czym jest śledzenie wariancji?"
**Swiss German**: "Was isch Varianz-Tracking?"

## Performance Metrics

### Before Optimization
- Response time: 41 seconds
- No caching
- Separate translation step
- Long prompts

### After Optimization
- Response time: 2.5-3.7 seconds (16x faster)
- In-memory caching: ~0ms for cached
- Direct language generation
- Optimized prompts

## Troubleshooting

### Language Not Switching
1. Check browser console for debug logs
2. Verify `currentLanguage` is updating
3. Clear localStorage: `localStorage.clear()`
4. Reload page

### Slow Responses
1. Check if query is cached (should be instant)
2. Verify backend is using `grok-4-fast-reasoning`
3. Check network latency
4. Review backend logs for errors

### Wrong Language Response
1. Verify language parameter in request
2. Check cache key includes language
3. Clear cache: restart backend
4. Test with new query

## Development

### Adding New Language

1. Add to `SUPPORTED_LANGUAGES` in `lib/i18n/types.ts`
2. Create translation file: `public/locales/{code}.json`
3. Add keywords to `_is_ppm_domain_query()` in `help_rag_agent.py`
4. Add language instruction to `_build_help_system_prompt()`
5. Add redirect message to `_generate_scope_redirect_response()`
6. Test language switching and responses

### Testing

```bash
# Test direct API
curl -X POST "http://localhost:8000/ai/help/query" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer test" \
  -d '{"query": "Was ist ein Projekt?", "language": "de", "context": {"route": "/projects", "pageTitle": "Projects", "userRole": "user"}}'

# Test cache
# Run same query twice - second should be instant
```

## Future Improvements

1. **Streaming Responses**: Real-time token streaming
2. **Persistent Cache**: Redis/Supabase for multi-instance
3. **Language Detection**: Auto-detect query language
4. **Translation Memory**: Reuse common translations
5. **A/B Testing**: Compare model performance
