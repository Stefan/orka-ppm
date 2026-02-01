# XAI (Grok) API Setup Instructions

## Current Status
The backend code has been updated to support XAI/Grok API. You now need to add your actual XAI API key.

## Important Note About xAI API Compatibility
✅ **Good News**: The OpenAI Python client we're using calls `/v1/chat/completions`, which is **fully supported** by xAI and will continue to work.

❌ The deprecated `/v1/messages` endpoint (Anthropic-compatible) is NOT used by our code, so the deprecation notice doesn't affect us.

## Steps to Configure

### 1. Get Your XAI API Key
- Go to https://console.x.ai/
- Sign in and get your API key (it should start with `xai-`)

### 2. Update the Backend Environment File
Edit `backend/.env` and replace `your-xai-api-key-here` with your actual XAI API key:

```bash
# Grok/XAI API Configuration (OpenAI-compatible)
# Uses /v1/chat/completions endpoint (NOT the deprecated /v1/messages)
OPENAI_API_KEY=xai-your-actual-key-here
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning

# Use local embeddings since Grok doesn't support embeddings
USE_LOCAL_EMBEDDINGS=true
```

**Note**: We use the OpenAI-compatible `/v1/chat/completions` endpoint, which is fully supported and not affected by the `/v1/messages` deprecation.

### 3. Install Required Dependencies (if not already installed)
The local embeddings feature requires `sentence-transformers`:

```bash
cd backend
pip install sentence-transformers
```

### 4. Restart the Backend Server
After updating the `.env` file, restart your backend server:

```bash
cd backend
# Stop the current server (Ctrl+C)
# Then restart it
python main.py
# or
uvicorn main:app --reload --port 8000
```

## What Was Changed

1. **backend/.env** - Added XAI/Grok configuration with placeholders
2. **backend/routers/help_chat.py** - Updated `get_help_rag_agent()` and `get_translation_service()` to pass `base_url` parameter
3. **Local embeddings enabled** - Since Grok doesn't support embeddings, the system will use local sentence-transformers

## Testing the Help Chat

Once configured, test the help chat by:
1. Opening your application at http://localhost:3000
2. Clicking the help chat button
3. Asking a question like "How do I create a new project?"

The help chat should now work without the "OpenAI API key not configured" error.

## Troubleshooting

### Error: "sentence-transformers not installed"
Install it: `pip install sentence-transformers`

### Error: "Help chat service unavailable"
- Check that `OPENAI_API_KEY` is set in `backend/.env`
- Verify the key starts with `xai-`
- Make sure you restarted the backend server after updating `.env`

### Error: "Invalid API key"
- Verify your XAI API key is correct
- Check that you have access to the Grok API at https://console.x.ai/

## Alternative: Use OpenAI Instead

If you prefer to use OpenAI instead of Grok, update `backend/.env`:

```bash
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-key-here
# Remove or comment out OPENAI_BASE_URL to use default OpenAI endpoint
# OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=gpt-4
# Set to false to use OpenAI's embeddings
USE_LOCAL_EMBEDDINGS=false
```
