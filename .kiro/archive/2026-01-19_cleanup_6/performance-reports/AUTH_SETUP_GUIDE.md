# Authentication Setup Guide

## Übersicht

Ihre App verwendet derzeit **Supabase Auth** im Backend. Es gibt zwei Modi:

1. **Development Mode** (aktiv): Keine Auth erforderlich, automatische Admin-Rechte
2. **Production Mode**: Vollständige Supabase Auth mit RBAC

## Aktueller Status

✅ **Backend läuft mit Development Mode**
- Automatische Admin-Berechtigungen für Entwicklung
- Keine Authentifizierung erforderlich
- Perfekt für lokale Entwicklung und Tests

## Option 1: Development Mode nutzen (Empfohlen für lokale Entwicklung)

### Wie es funktioniert

Das Backend hat einen eingebauten Development Mode in `backend/auth/dependencies.py`:

```python
async def get_current_user(credentials: Optional[HTTPAuthorizationCredentials] = Depends(security)):
    if not credentials:
        # Development mode: Verwende Standard-Entwicklungsbenutzer
        return {"user_id": "00000000-0000-0000-0000-000000000001", "email": "dev@example.com"}
```

Und in `backend/auth/rbac.py`:

```python
async def get_user_permissions(self, user_id: str):
    # Development fix: Admin-Berechtigungen für Standard-Entwicklungsbenutzer
    if user_id == "00000000-0000-0000-0000-000000000001":
        return DEFAULT_ROLE_PERMISSIONS[UserRole.admin]
```

### Vorteile

✅ Keine Authentifizierung erforderlich
✅ Automatische Admin-Rechte
✅ Schnelle Entwicklung
✅ Keine Supabase-Konfiguration nötig

### Nachteile

⚠️ Nicht für Production geeignet
⚠️ Keine echte Benutzerverwaltung
⚠️ Alle haben Admin-Rechte

### So verwenden Sie es

Das ist bereits aktiv! Einfach:

```bash
cd backend
./start-dev.sh
```

Das Dashboard sollte jetzt funktionieren ohne Login.

## Option 2: Echten Benutzer als Admin hinzufügen

Wenn Sie mit echten Supabase-Benutzern arbeiten möchten:

### Schritt 1: Authentifizierungsstatus überprüfen

```bash
cd backend
python scripts/check_auth_status.py
```

Das zeigt:
- Alle Benutzer in Supabase
- Alle Rollen in der Datenbank
- Alle Rollenzuweisungen
- Environment-Konfiguration

### Schritt 2: Admin-Rolle zu Benutzer hinzufügen

**Option A: Mit E-Mail**

```bash
python scripts/add_admin_user.py ihre-email@example.com
```

**Option B: Mit User ID**

```bash
python scripts/add_admin_user.py --user-id bf1b1732-2449-4987-9fdb-fefa2a93b816
```

### Schritt 3: Überprüfen

```bash
python scripts/check_auth_status.py
```

Sie sollten jetzt Ihre Rollenzuweisung sehen.

### Schritt 4: Im Browser testen

1. Öffnen Sie http://localhost:3000
2. Melden Sie sich mit Ihrem Supabase-Konto an
3. Gehen Sie zu http://localhost:3000/admin/performance
4. Sie sollten jetzt echte Daten sehen!

## Option 3: Vercel Auth deaktivieren

Wenn Sie Vercel Auth verwenden und zu Supabase Auth wechseln möchten:

### Frontend-Änderungen

1. **Supabase Auth Provider hinzufügen**

```typescript
// app/providers/AuthProvider.tsx
import { createClient } from '@supabase/supabase-js'
import { SessionContextProvider } from '@supabase/auth-helpers-react'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionContextProvider supabaseClient={supabase}>
      {children}
    </SessionContextProvider>
  )
}
```

2. **Login-Komponente erstellen**

```typescript
// components/auth/LoginForm.tsx
import { useSupabaseClient } from '@supabase/auth-helpers-react'

export function LoginForm() {
  const supabase = useSupabaseClient()
  
  const handleLogin = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    
    if (error) {
      console.error('Login error:', error)
    }
  }
  
  // ... Rest der Komponente
}
```

3. **Auth Hook verwenden**

```typescript
// hooks/useAuth.ts
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react'

export function useAuth() {
  const session = useSession()
  const supabase = useSupabaseClient()
  
  return {
    user: session?.user,
    isAuthenticated: !!session,
    signOut: () => supabase.auth.signOut()
  }
}
```

### Environment Variables

Fügen Sie zu `.env.local` hinzu:

```bash
# Supabase Auth
NEXT_PUBLIC_SUPABASE_URL=https://ihre-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=ihre-anon-key

# Backend URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:8000
```

## Datenbank-Schema

### Erforderliche Tabellen

```sql
-- Rollen-Tabelle
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  permissions TEXT[] NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Benutzer-Rollen-Tabelle
CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role_id)
);

-- Indizes
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
```

### Admin-Rolle erstellen

```sql
-- Admin-Rolle mit allen Berechtigungen
INSERT INTO roles (name, description, permissions)
VALUES (
  'admin',
  'Full system administrator with all permissions',
  ARRAY[
    'portfolio_create', 'portfolio_read', 'portfolio_update', 'portfolio_delete',
    'project_create', 'project_read', 'project_update', 'project_delete',
    'resource_create', 'resource_read', 'resource_update', 'resource_delete',
    'financial_read', 'financial_create', 'financial_update', 'financial_delete',
    'user_manage', 'role_manage', 'admin_read', 'admin_update', 'system_admin',
    'pmr_create', 'pmr_read', 'pmr_update', 'pmr_delete', 'pmr_approve',
    'audit:read', 'audit:export'
  ]
);
```

### Benutzer als Admin hinzufügen

```sql
-- Ihre User ID finden
SELECT id, email FROM auth.users WHERE email = 'ihre-email@example.com';

-- Admin-Rolle zuweisen
INSERT INTO user_roles (user_id, role_id)
VALUES (
  'ihre-user-id-hier',
  (SELECT id FROM roles WHERE name = 'admin')
);
```

## Troubleshooting

### Problem: 403 Forbidden Fehler

**Ursache**: Benutzer hat keine Admin-Berechtigung

**Lösung**:
```bash
python scripts/add_admin_user.py ihre-email@example.com
```

### Problem: "User not found"

**Ursache**: Benutzer existiert nicht in Supabase Auth

**Lösung**:
1. Registrieren Sie sich in der App
2. Oder erstellen Sie einen Benutzer in Supabase Dashboard
3. Dann führen Sie `add_admin_user.py` aus

### Problem: "Cannot access admin API"

**Ursache**: Kein Service Role Key konfiguriert

**Lösung**:
1. Gehen Sie zu Supabase Dashboard → Settings → API
2. Kopieren Sie den "service_role" Key
3. Fügen Sie zu `.env` hinzu:
   ```bash
   SUPABASE_SERVICE_ROLE_KEY=ihr-service-role-key
   ```

### Problem: Development Mode funktioniert nicht

**Ursache**: Backend sendet echte Auth-Anforderungen

**Lösung**:
1. Überprüfen Sie `backend/auth/dependencies.py`
2. Stellen Sie sicher, dass der Development-Fallback aktiv ist
3. Starten Sie das Backend neu: `./start-dev.sh`

## Empfohlener Workflow

### Für lokale Entwicklung

1. ✅ **Verwenden Sie Development Mode** (bereits aktiv)
2. Keine Auth-Konfiguration erforderlich
3. Automatische Admin-Rechte
4. Schnelle Entwicklung

### Für Staging/Testing

1. Erstellen Sie Test-Benutzer in Supabase
2. Fügen Sie Admin-Rolle hinzu mit `add_admin_user.py`
3. Testen Sie echte Auth-Flows
4. Überprüfen Sie RBAC-Berechtigungen

### Für Production

1. Deaktivieren Sie Development Mode
2. Verwenden Sie echte Supabase Auth
3. Konfigurieren Sie Rollen und Berechtigungen
4. Implementieren Sie Row Level Security (RLS)

## Nächste Schritte

### Sofort (Development)

```bash
# Backend läuft bereits mit Development Mode
# Dashboard sollte funktionieren ohne weitere Konfiguration
```

### Später (Production)

1. Erstellen Sie Rollen in der Datenbank
2. Fügen Sie Admin-Benutzer hinzu
3. Implementieren Sie Frontend Auth
4. Testen Sie RBAC-Berechtigungen
5. Aktivieren Sie RLS in Supabase

## Zusammenfassung

| Modus | Auth erforderlich | Admin-Rechte | Verwendung |
|-------|------------------|--------------|------------|
| **Development** | ❌ Nein | ✅ Automatisch | Lokale Entwicklung |
| **Staging** | ✅ Ja | 🔧 Manuell | Testing |
| **Production** | ✅ Ja | 🔧 Manuell | Live-System |

**Aktuell**: Sie sind im **Development Mode** - alles sollte funktionieren! 🚀

Wenn Sie Probleme haben, führen Sie aus:
```bash
python scripts/check_auth_status.py
```
