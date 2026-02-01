# xAI API Endpoint Information

## What We Use

Our application uses the **OpenAI Python client** which calls:
```
POST https://api.x.ai/v1/chat/completions
```

This endpoint is:
- ✅ **Fully supported** by xAI
- ✅ **OpenAI-compatible**
- ✅ **NOT deprecated**
- ✅ **Will continue to work indefinitely**

## What's Being Deprecated

xAI is deprecating the **Anthropic-compatible** endpoint:
```
POST https://api.x.ai/v1/messages  ❌ DEPRECATED (Feb 20, 2026)
```

**We don't use this endpoint**, so the deprecation doesn't affect us.

## API Endpoint Comparison

| Endpoint | Status | Used By | Our Code |
|----------|--------|---------|----------|
| `/v1/chat/completions` | ✅ Active | OpenAI SDK | ✅ **We use this** |
| `/v1/responses` | ✅ Active | xAI native SDK | ❌ Not used |
| `/v1/messages` | ❌ Deprecated | Anthropic SDK | ❌ Not used |

## How Our Code Works

```python
# backend/ai_agents.py (line 26-30)
if base_url:
    self.openai_client = OpenAI(api_key=openai_api_key, base_url=base_url)
else:
    self.openai_client = OpenAI(api_key=openai_api_key)
```

When we set `OPENAI_BASE_URL=https://api.x.ai/v1`, the OpenAI client automatically uses:
- `https://api.x.ai/v1/chat/completions` for chat
- `https://api.x.ai/v1/embeddings` for embeddings (not supported by Grok, so we use local)

## Configuration

Our current configuration in `backend/.env`:
```bash
OPENAI_API_KEY=xai-your-key-here
OPENAI_BASE_URL=https://api.x.ai/v1
OPENAI_MODEL=grok-4-fast-reasoning
USE_LOCAL_EMBEDDINGS=true
```

This tells the OpenAI client to:
1. Use xAI's base URL instead of OpenAI's
2. Call `/v1/chat/completions` (OpenAI-compatible endpoint)
3. Use `grok-beta` model instead of `gpt-4`
4. Use local embeddings since Grok doesn't support embeddings API

## Why This Works

The xAI API is **OpenAI-compatible**, meaning:
- Same request format as OpenAI
- Same response format as OpenAI
- Same authentication method (Bearer token)
- Same endpoint paths (`/v1/chat/completions`)

This allows us to use the OpenAI Python client without any code changes - we just point it to a different base URL.

## Future-Proofing

If xAI changes their API in the future, we have several options:

### Option 1: Continue with OpenAI-compatible endpoint (recommended)
xAI has committed to maintaining OpenAI compatibility, so this should work long-term.

### Option 2: Switch to xAI native SDK
```bash
pip install xai-sdk
```

Then update code to use xAI's native gRPC-based SDK.

### Option 3: Use Responses API
Switch to xAI's new `/v1/responses` endpoint (also OpenAI-compatible).

### Option 4: Switch to OpenAI
Simply remove `OPENAI_BASE_URL` from `.env` and use an OpenAI API key.

## Verification

Run the test script to verify we're using the correct endpoint:
```bash
python backend/test_xai_connection.py
```

You should see:
```
ℹ️  Using xAI (Grok) API
   Endpoint: /v1/chat/completions (OpenAI-compatible)
   ✅ NOT affected by /v1/messages deprecation
```

## References

- [xAI API Reference](https://docs.x.ai/docs/api-reference) - Shows all available endpoints
- [xAI Chat Guide](https://docs.x.ai/docs/guides/chat) - Documentation for Responses API
- [OpenAI Python Client](https://github.com/openai/openai-python) - The client we use

## Summary

✅ **No action needed** - Our code uses the correct, non-deprecated endpoint.

The deprecation notice you received is about the `/v1/messages` endpoint (Anthropic-compatible), which we don't use. We use `/v1/chat/completions` (OpenAI-compatible), which is fully supported and will continue to work.
