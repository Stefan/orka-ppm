# Debug: Sprachwechsel Englisch → Deutsch funktioniert nicht

## Problem
Der Sprachwechsel von Englisch nach Deutsch funktioniert nicht im Help Chat.

## Mögliche Ursachen

### 1. currentLanguage wird nicht aktualisiert
**Test**: Console.log in HelpChatProvider hinzufügen
```typescript
useEffect(() => {
  console.log('🔍 [HelpChat] currentLanguage changed:', currentLanguage)
  console.log('🔍 [HelpChat] state.language:', state.language)
  
  if (currentLanguage && currentLanguage !== state.language) {
    console.log('✅ [HelpChat] Updating state.language to:', currentLanguage)
    setState(prevState => ({
      ...prevState,
      language: currentLanguage
    }))
  }
}, [currentLanguage, state.language])
```

### 2. sendMessage verwendet falsche Sprache
**Test**: Console.log in sendMessage hinzufügen
```typescript
const request: HelpQueryRequest = {
  query: message.trim(),
  sessionId: state.sessionId,
  context: state.currentContext,
  language: currentLanguage || state.language,
  includeProactiveTips: state.proactiveTipsEnabled
}

console.log('📤 [HelpChat] Sending query with language:', request.language)
console.log('📤 [HelpChat] currentLanguage:', currentLanguage)
console.log('📤 [HelpChat] state.language:', state.language)
```

### 3. Backend erhält falsche Sprache
**Test**: Backend-Logs prüfen
```bash
tail -f backend/backend.log | grep "language"
```

### 4. UI-Text ändert sich nicht
**Test**: Prüfen ob Übersetzungen geladen werden
```typescript
// In HelpChat.tsx
console.log('🌍 [HelpChat] Current translations:', {
  placeholder: t('helpChat.placeholder'),
  welcome: t('helpChat.welcome'),
  typing: t('helpChat.typing')
})
```

## Schneller Test

1. **Browser-Konsole öffnen** (F12)
2. **Sprache auf Deutsch umschalten**
3. **Folgendes in Konsole eingeben**:
```javascript
// Check i18n locale
console.log('i18n locale:', document.cookie.match(/NEXT_LOCALE=([^;]+)/)?.[1])
console.log('localStorage locale:', localStorage.getItem('i18n-locale'))

// Check if translations are loaded
console.log('German translations loaded:', 
  fetch('/locales/de.json').then(r => r.json()).then(console.log)
)
```

4. **Help Chat öffnen**
5. **Nachricht senden**: "Was ist Varianz-Tracking?"
6. **Network-Tab prüfen**:
   - Suche nach `/ai/help/query`
   - Prüfe Request Body → `language` sollte `"de"` sein

## Erwartetes Verhalten

### Wenn Sprache auf Deutsch umgeschaltet wird:
1. ✅ `i18n.locale` ändert sich zu `"de"`
2. ✅ `currentLanguage` in `useLanguage` wird `"de"`
3. ✅ `useEffect` in `HelpChatProvider` erkennt Änderung
4. ✅ `state.language` wird auf `"de"` aktualisiert
5. ✅ UI-Text ändert sich zu Deutsch
6. ✅ Nächste Nachricht wird mit `language: "de"` gesendet

### Wenn Nachricht gesendet wird:
1. ✅ `sendMessage` verwendet `currentLanguage || state.language`
2. ✅ Request enthält `language: "de"`
3. ✅ Backend empfängt `language: "de"`
4. ✅ Backend erkennt deutsche Keywords
5. ✅ Backend generiert Antwort auf Englisch
6. ✅ Backend übersetzt Antwort ins Deutsche
7. ✅ Frontend zeigt deutsche Antwort

## Mögliche Fehler

### Fehler 1: UI ändert sich nicht
**Symptom**: Placeholder bleibt "Ask me something about PPM..."
**Ursache**: Übersetzungen nicht geladen oder `t()` Funktion funktioniert nicht
**Lösung**: Prüfe `public/locales/de.json` existiert und `helpChat` Keys enthält

### Fehler 2: Antwort bleibt Englisch
**Symptom**: Antwort ist immer auf Englisch, egal welche Sprache
**Ursache**: `language` Parameter wird nicht korrekt gesendet
**Lösung**: Prüfe Network-Tab → Request Body → `language` Feld

### Fehler 3: "Out of scope" Fehler
**Symptom**: Backend sagt "I'm here to help you with PPM platform features..."
**Ursache**: Backend erkennt deutsche Keywords nicht
**Lösung**: Bereits behoben in `backend/services/help_rag_agent.py`

## Debugging-Schritte

### Schritt 1: Prüfe i18n-System
```javascript
// In Browser-Konsole
console.log('Current locale:', localStorage.getItem('i18n-locale'))
console.log('Cookie:', document.cookie)
```

### Schritt 2: Prüfe HelpChat State
```javascript
// Temporär in HelpChatProvider.tsx hinzufügen
console.log('HelpChat State:', {
  language: state.language,
  currentLanguage: currentLanguage,
  messages: state.messages.length
})
```

### Schritt 3: Prüfe API Request
```javascript
// In sendMessage vor API-Call
console.log('Sending request:', JSON.stringify(request, null, 2))
```

### Schritt 4: Prüfe Backend Response
```javascript
// In sendMessage nach API-Call
console.log('Received response:', {
  language: data.language,
  responseLength: data.response.length,
  confidence: data.confidence
})
```

## Temporäre Lösung

Wenn der automatische Sprachwechsel nicht funktioniert, kann man die Sprache manuell setzen:

```typescript
// In HelpChatProvider.tsx, nach dem useEffect für currentLanguage
useEffect(() => {
  // Force language to match global language
  if (currentLanguage) {
    console.log('🔧 [HelpChat] Forcing language to:', currentLanguage)
    setState(prevState => ({
      ...prevState,
      language: currentLanguage
    }))
  }
}, [currentLanguage])
```

## Nächste Schritte

1. ✅ Console-Logs hinzufügen
2. ⏳ Sprache umschalten und Logs prüfen
3. ⏳ Identifizieren wo der Sprachwechsel fehlschlägt
4. ⏳ Entsprechende Stelle fixen

---

*Erstellt: 22. Januar 2026*
*Status: Debugging in Progress*
