# Vercel Auto-Deployment Setup

## 🚀 Automatisches Deployment bei jedem Git Push

Diese Anleitung zeigt, wie du automatische Deployments zu Vercel bei jedem Push zu GitHub einrichtest.

---

## 📋 Schritt 1: Vercel Token erstellen

1. Gehe zu https://vercel.com/account/tokens
2. Klicke auf "Create Token"
3. Name: `GitHub Actions Deploy`
4. Scope: `Full Account`
5. Expiration: `No Expiration` (oder nach Bedarf)
6. Klicke auf "Create"
7. **Kopiere den Token** (wird nur einmal angezeigt!)

---

## 📋 Schritt 2: Vercel Projekt-IDs abrufen

### Option A: Aus .vercel/project.json lesen

```bash
cat .vercel/project.json
```

Du siehst:
```json
{
  "orgId": "team_xxxxxxxxxxxxx",
  "projectId": "prj_xxxxxxxxxxxxx"
}
```

### Option B: Mit Vercel CLI

```bash
vercel project ls
```

---

## 📋 Schritt 3: GitHub Secrets hinzufügen

1. Gehe zu deinem GitHub Repository: https://github.com/Stefan/ppm-saas
2. Klicke auf **Settings** → **Secrets and variables** → **Actions**
3. Klicke auf **New repository secret**
4. Füge folgende Secrets hinzu:

### Secret 1: VERCEL_TOKEN
- **Name**: `VERCEL_TOKEN`
- **Value**: Der Token aus Schritt 1

### Secret 2: VERCEL_ORG_ID
- **Name**: `VERCEL_ORG_ID`
- **Value**: Die `orgId` aus `.vercel/project.json`

### Secret 3: VERCEL_PROJECT_ID
- **Name**: `VERCEL_PROJECT_ID`
- **Value**: Die `projectId` aus `.vercel/project.json`

---

## ✅ Schritt 4: Workflow aktivieren

Der Workflow ist bereits erstellt in `.github/workflows/deploy-vercel.yml`

### Was passiert automatisch:

1. **Bei Push zu `main`**: 
   - Automatisches Production-Deployment
   - URL: https://orka-ppm.vercel.app

2. **Bei Pull Request**:
   - Preview-Deployment
   - Eigene URL für jeden PR

---

## 🧪 Schritt 5: Testen

1. Committe und pushe eine kleine Änderung:
   ```bash
   git add .
   git commit -m "test: Trigger auto-deployment"
   git push origin main
   ```

2. Gehe zu GitHub Actions:
   - https://github.com/Stefan/ppm-saas/actions
   - Du solltest den Workflow "Deploy to Vercel" sehen
   - Klicke darauf, um den Fortschritt zu sehen

3. Nach ~2-3 Minuten:
   - Deployment ist live auf https://orka-ppm.vercel.app
   - GitHub zeigt ✅ grünen Haken

---

## 📊 Workflow-Details

### Trigger
- Push zu `main` Branch
- Pull Requests zu `main` Branch

### Schritte
1. Code auschecken
2. Node.js 20 installieren
3. Vercel CLI installieren
4. Vercel Environment laden
5. Projekt bauen
6. Zu Vercel deployen

### Dauer
- ~2-3 Minuten pro Deployment

---

## 🔧 Alternative: Vercel GitHub Integration (Empfohlen!)

**Noch einfacher**: Nutze die native Vercel-GitHub Integration:

### Vorteile
- Keine GitHub Actions nötig
- Keine Secrets manuell einrichten
- Automatische Preview-Deployments für PRs
- Deployment-Kommentare in PRs
- Bessere Integration mit Vercel Dashboard

### Setup
1. Gehe zu https://vercel.com/orka/orka-ppm/settings/git
2. Klicke auf "Connect Git Repository"
3. Wähle dein GitHub Repository
4. Fertig! 🎉

### Einstellungen
- **Production Branch**: `main`
- **Auto-Deploy**: ✅ Aktiviert
- **Preview Deployments**: ✅ Aktiviert für alle Branches

---

## 🎯 Empfehlung

Ich empfehle die **Vercel GitHub Integration** statt GitHub Actions, weil:

1. ✅ Einfacher einzurichten (keine Secrets)
2. ✅ Bessere Integration
3. ✅ Automatische PR-Kommentare mit Preview-URLs
4. ✅ Deployment-Status direkt in GitHub
5. ✅ Keine Wartung nötig

### So aktivierst du es:

1. Gehe zu https://vercel.com/orka/orka-ppm/settings/git
2. Stelle sicher, dass "Git Integration" aktiviert ist
3. Prüfe, dass "Production Branch" auf `main` steht
4. Aktiviere "Automatically deploy all commits"

---

## 🐛 Troubleshooting

### Workflow schlägt fehl: "Invalid token"
- Prüfe, ob `VERCEL_TOKEN` korrekt in GitHub Secrets eingetragen ist
- Erstelle einen neuen Token in Vercel

### Workflow schlägt fehl: "Project not found"
- Prüfe `VERCEL_ORG_ID` und `VERCEL_PROJECT_ID`
- Vergleiche mit `.vercel/project.json`

### Deployment dauert zu lange
- Normale Dauer: 2-3 Minuten
- Bei Problemen: Prüfe Vercel Dashboard für Details

---

## 📚 Weitere Ressourcen

- [Vercel GitHub Integration Docs](https://vercel.com/docs/git/vercel-for-github)
- [Vercel CLI Docs](https://vercel.com/docs/cli)
- [GitHub Actions Docs](https://docs.github.com/en/actions)

---

**Erstellt**: 22. Januar 2026  
**Status**: ✅ Workflow erstellt, Secrets müssen noch hinzugefügt werden
