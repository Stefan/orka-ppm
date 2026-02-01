# Help Chat Language Switching - Manual Test Plan

## ✅ Backend Status: WORKING
All multilingual keywords are recognized correctly. Backend tests pass for EN, DE, and FR.

## ⏳ Frontend Status: READY FOR TESTING

---

## Quick Test (5 minutes)

### Prerequisites
1. Backend running on port 8000
2. Frontend running on port 3000
3. XAI API key configured in `backend/.env`

### Test Steps

1. **Open the application**: http://localhost:3000

2. **Open Help Chat**:
   - Click the Help Chat button (bottom right corner)
   - Verify it opens

3. **Test English (Default)**:
   - Verify UI is in English
   - Placeholder should say: "Ask me something about PPM..."
   - Type: "What is variance tracking?"
   - Click Send
   - Wait ~10 seconds
   - ✅ Response should be in English

4. **Switch to German**:
   - Click language selector (top right)
   - Select "Deutsch"
   - Verify Help Chat UI changes:
     - Placeholder: "Frage mich etwas über PPM..."
     - Welcome: "Willkommen beim KI-Hilfe-Assistenten!"
   - Type: "Was ist Varianz-Tracking?"
   - Click Send
   - Wait ~30-50 seconds (translation takes time)
   - ✅ Response should be in German

5. **Switch to French**:
   - Click language selector
   - Select "Français"
   - Verify Help Chat UI changes:
     - Placeholder: "Demandez-moi quelque chose sur PPM..."
     - Welcome: "Bienvenue dans l'assistant d'aide IA!"
   - Type: "Qu'est-ce que le suivi des écarts?"
   - Click Send
   - Wait ~30-50 seconds
   - ✅ Response should be in French

---

## Expected Results

### ✅ Success Criteria
- [ ] Help Chat UI text changes when language changes
- [ ] Placeholder text translates correctly
- [ ] Welcome message translates correctly
- [ ] Responses are in the selected language
- [ ] No console errors
- [ ] Session persists across language changes

### ❌ Failure Indicators
- Console errors about missing translation keys
- UI text doesn't change when language changes
- Responses are always in English
- "Out of scope" error for non-English queries
- Chat resets when changing language

---

## Troubleshooting

### Issue: UI doesn't translate
**Check**:
1. Open browser console
2. Look for errors like "Translation key not found"
3. Verify `public/locales/{language}.json` has `helpChat` keys

**Fix**: Translation keys are already added, should work

### Issue: Responses always in English
**Check**:
1. Open browser Network tab
2. Find the `/ai/help/query` request
3. Check the `language` parameter in request body

**Expected**: Should match selected language (e.g., "de", "fr")

**Fix**: Already implemented in `HelpChatProvider.tsx` line 345

### Issue: "Out of scope" error for non-English
**Check**:
1. Backend logs: `backend/backend.log`
2. Look for "_is_ppm_domain_query" rejecting query

**Fix**: Already fixed with multilingual keywords

### Issue: Very slow responses (>60 seconds)
**Cause**: Translation overhead + no caching

**Workaround**: 
- First query is slow (30-50s)
- Subsequent similar queries should be faster (if caching works)

---

## Console Commands for Testing

### Check if backend is running:
```bash
curl http://localhost:8000/health
```

### Check supported languages:
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:8000/ai/help/languages
```

### Test backend directly (German):
```bash
curl -X POST http://localhost:8000/ai/help/query \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "query": "Was ist Varianz-Tracking?",
    "language": "de",
    "context": {
      "route": "/dashboards",
      "pageTitle": "Dashboard",
      "userRole": "user"
    }
  }'
```

---

## Known Limitations

1. **Response Time**: 30-50 seconds for non-English (translation overhead)
2. **No Streaming**: User sees nothing until complete response
3. **No Cache**: Translation cache table doesn't exist yet
4. **Confidence Score**: Always shows 60% regardless of quality

---

## Next Steps After Testing

### If Tests Pass ✅
1. Mark task as complete
2. Document any performance issues
3. Create tickets for:
   - Translation caching implementation
   - Streaming responses
   - Confidence score improvement

### If Tests Fail ❌
1. Note specific failure
2. Check browser console for errors
3. Check backend logs
4. Report findings with:
   - Language being tested
   - Query used
   - Error message
   - Screenshots if possible

---

## Quick Reference

### Translation Keys Location
- English: `public/locales/en.json`
- German: `public/locales/de.json`
- French: `public/locales/fr.json`
- Spanish: `public/locales/es.json`
- Polish: `public/locales/pl.json`
- Swiss German: `public/locales/gsw.json`

### Backend Files
- Multilingual keywords: `backend/services/help_rag_agent.py` (line 300-350)
- API endpoint: `backend/routers/help_chat.py`
- Translation service: `backend/services/translation_service.py`

### Frontend Files
- Language sync: `app/providers/HelpChatProvider.tsx` (line 255-262, 345)
- UI component: `components/HelpChat.tsx`
- Translation hook: `lib/i18n/context.tsx`

---

*Ready for testing! Backend is confirmed working.* ✅
