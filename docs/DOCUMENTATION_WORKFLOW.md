# Documentation Workflow Guide

## 📝 Workflow für neue Features

### 1. Feature implementieren
```bash
# Implementiere dein Feature
# z.B. backend/routers/my_feature.py
# z.B. components/my-feature/MyFeature.tsx
```

### 2. Dokumentation erstellen

#### Option A: Template Generator verwenden (Empfohlen)
```bash
./scripts/generate-feature-docs.sh "My Feature" "my-feature"
```

Dies erstellt automatisch:
- `docs/my-feature.md` mit vollständigem Template
- Alle notwendigen Sektionen
- Beispiele und Platzhalter

#### Option B: Manuell erstellen
```bash
# Erstelle neue Markdown-Datei
touch docs/my-feature.md

# Bearbeite die Datei
code docs/my-feature.md
```

### 3. Dokumentation ausfüllen

Fülle das Template aus:
- ✅ Overview - Was macht das Feature?
- ✅ Getting Started - Wie startet man?
- ✅ Core Concepts - Wichtige Konzepte
- ✅ How-To Guides - Schritt-für-Schritt Anleitungen
- ✅ API Reference - API Dokumentation
- ✅ Examples - Code-Beispiele
- ✅ Troubleshooting - Häufige Probleme

### 4. Dokumentation indexieren

Damit der Help Chat die neue Dokumentation findet:

```bash
cd backend
python scripts/index_documentation.py
```

Oder nur eine spezifische Datei:
```bash
cd backend
python scripts/index_documentation.py ../docs/my-feature.md
```

### 5. Testen

Teste den Help Chat:
1. Öffne http://localhost:3000
2. Klicke auf Help Chat
3. Stelle eine Frage über dein neues Feature
4. Der Chat sollte jetzt Informationen aus deiner Dokumentation verwenden

### 6. Commit

```bash
git add docs/my-feature.md
git commit -m "docs: Add documentation for My Feature"
```

---

## 🔄 Automatisierung

### Pre-Commit Hook

Der Pre-Commit Hook erinnert dich automatisch:

```bash
# Wenn du neue Features committest
git commit -m "feat: Add my feature"

# Output:
⚠️  New backend features detected:
backend/routers/my_feature.py

📝 Have you updated the documentation in docs/?

Continue with commit? (y/n)
```

### Automatisches Indexing (Optional)

Du kannst einen Post-Commit Hook erstellen:

```bash
# .git/hooks/post-commit
#!/bin/bash

# Check if docs were changed
DOCS_CHANGED=$(git diff HEAD~1 HEAD --name-only | grep "^docs/")

if [ ! -z "$DOCS_CHANGED" ]; then
    echo "📚 New documentation detected, indexing..."
    cd backend
    python scripts/index_documentation.py
fi
```

---

## 📋 Dokumentations-Checkliste

Bevor du committest:

- [ ] Feature ist implementiert
- [ ] Dokumentation ist erstellt
- [ ] Alle Sektionen sind ausgefüllt
- [ ] Code-Beispiele sind hinzugefügt
- [ ] API Endpoints sind dokumentiert
- [ ] Troubleshooting ist dokumentiert
- [ ] Dokumentation ist indexiert
- [ ] Help Chat wurde getestet
- [ ] Commit mit aussagekräftiger Message

---

## 🎯 Best Practices

### 1. Dokumentiere während der Entwicklung
Nicht am Ende, sondern während du entwickelst.

### 2. Verwende Screenshots
Füge Screenshots für UI-Features hinzu:
```markdown
![Feature Screenshot](../assets/my-feature-screenshot.png)
```

### 3. Füge Code-Beispiele hinzu
Zeige echte, funktionierende Beispiele:
```typescript
// Gutes Beispiel
const { data } = useMyFeature({ id: '123' })
```

### 4. Erkläre das "Warum"
Nicht nur "wie", sondern auch "warum":
```markdown
## Why use this feature?
This feature solves the problem of...
```

### 5. Halte es aktuell
Wenn du das Feature änderst, aktualisiere die Dokumentation:
```bash
# Nach Feature-Update
vim docs/my-feature.md
python backend/scripts/index_documentation.py
```

---

## 🔍 Dokumentation finden

### Im Help Chat
Der Help Chat findet automatisch relevante Dokumentation:
```
User: "How do I use the schedule management feature?"
AI: "Based on the documentation, here's how..."
```

### In der Codebase
```bash
# Suche nach Dokumentation
ls docs/

# Suche nach spezifischem Feature
grep -r "schedule management" docs/
```

### Im Browser
Öffne die Markdown-Dateien direkt:
```
docs/schedule-management.md
```

---

## 📊 Dokumentations-Status prüfen

Prüfe, welche Features dokumentiert sind:

```bash
# Zeige alle Dokumentations-Dateien
ls -la docs/

# Prüfe Dokumentations-Abdeckung
cat FEATURE_INVENTORY.md
```

---

## 🚀 Schnellstart

Neues Feature dokumentieren in 5 Minuten:

```bash
# 1. Template generieren (30 Sekunden)
./scripts/generate-feature-docs.sh "My Feature" "my-feature"

# 2. Template ausfüllen (3 Minuten)
code docs/my-feature.md

# 3. Indexieren (30 Sekunden)
cd backend && python scripts/index_documentation.py

# 4. Testen (30 Sekunden)
# Öffne Help Chat und teste

# 5. Commit (30 Sekunden)
git add docs/my-feature.md
git commit -m "docs: Add My Feature documentation"
```

---

## 📚 Weitere Ressourcen

- [Feature Inventory](../FEATURE_INVENTORY.md) - Alle Features und ihr Dokumentations-Status
- [Documentation Gaps](../DOCUMENTATION_GAPS_AND_RECOMMENDATIONS.md) - Was fehlt noch
- [Feature Analysis](../FEATURE_DOCUMENTATION_ANALYSIS.md) - Detaillierte Analyse

---

*Last Updated: January 2026*
