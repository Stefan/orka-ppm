# Vercel Auto-Deploy - Schnellanleitung

## ✅ Einfachste Lösung: Vercel GitHub Integration

Vercel bietet eine native GitHub Integration, die automatisch bei jedem Push deployed.

---

## 🚀 Schritt 1: Vercel mit GitHub verbinden

1. Gehe zu: https://vercel.com/orka/orka-ppm/settings/git
2. Prüfe, ob dein GitHub Repository bereits verbunden ist
3. Falls nicht: Klicke auf "Connect Git Repository" und wähle dein Repo

---

## ⚙️ Schritt 2: Auto-Deploy Einstellungen

In den Git-Einstellungen stelle sicher:

### Production Branch
```
main
```

### Auto-Deploy Settings
- ✅ **Production Deployments**: Aktiviert für `main` Branch
- ✅ **Preview Deployments**: Aktiviert für alle anderen Branches
- ✅ **Deploy Hooks**: Optional

---

## 🎯 Das war's!

Ab jetzt:
- **Push zu `main`** → Automatisches Production-Deployment zu https://orka-ppm.vercel.app
- **Push zu anderen Branches** → Preview-Deployment mit eigener URL
- **Pull Requests** → Automatischer Kommentar mit Preview-URL

---

## 🧪 Testen

```bash
# Kleine Änderung machen
echo "# Auto-deploy test" >> README.md

# Committen und pushen
git add README.md
git commit -m "test: Trigger auto-deployment"
git push origin main
```

Dann:
1. Gehe zu https://vercel.com/orka/orka-ppm
2. Du siehst das neue Deployment in der Liste
3. Nach ~2 Minuten ist es live

---

## 📊 Deployment-Status in GitHub

Vercel fügt automatisch hinzu:
- ✅ Status-Checks in Pull Requests
- 🔗 Deployment-URLs als Kommentare
- 📈 Deployment-Status in Commits

---

## 🔧 Alternative: GitHub Actions (falls gewünscht)

Falls du lieber GitHub Actions nutzen möchtest:
- Siehe `VERCEL_AUTO_DEPLOY_SETUP.md` für Details
- Workflow bereits erstellt in `.github/workflows/deploy-vercel.yml`
- Benötigt 3 GitHub Secrets (siehe Setup-Anleitung)

---

## 💡 Empfehlung

**Nutze die Vercel GitHub Integration** - sie ist:
- Einfacher (keine Secrets)
- Schneller
- Besser integriert
- Automatisch aktiviert

---

**Projekt-IDs** (für GitHub Actions, falls benötigt):
```
VERCEL_ORG_ID: team_npDe8vfGavzZIKjjuQbMEqWE
VERCEL_PROJECT_ID: prj_BVrjgiPBJU8Jp7aoSbYQ47pgojRi
```
