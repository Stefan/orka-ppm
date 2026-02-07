# SSO (Single Sign-On) Setup

This app supports OAuth2 (Google, Microsoft) via Supabase Auth. Configure providers in the Supabase Dashboard; use the Admin SSO page (`/admin/sso`) to enable or disable which providers appear on the login page.

## Supabase Dashboard

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard) → **Authentication** → **Providers**.
2. **Google**: Enable Google, enter your OAuth Client ID and Client Secret from [Google Cloud Console](https://console.cloud.google.com/apis/credentials) (OAuth 2.0 Client ID for Web application). Add authorized redirect URI: `https://<your-project>.supabase.co/auth/v1/callback` (Supabase shows this).
3. **Microsoft (Azure)**: Enable Azure, enter Application (client) ID and Secret from [Azure Portal](https://portal.azure.com/) (App registration). Configure redirect URI in Azure to match Supabase callback.

## Redirect URLs

In Supabase: **Authentication** → **URL Configuration** add:

- Development: `http://localhost:3000/auth/callback`
- Production: `https://<your-app-domain>/auth/callback`

Users are sent to `/auth/callback` after IdP login; the app then redirects to `/dashboards` or back to `/login` with an error.

## Admin SSO Page

Go to **Admin** → **SSO** to enable/disable each provider for the login page. Client ID and Secret are only configured in Supabase; the admin page only toggles visibility of the SSO buttons.

## RLS

OAuth users get the same RLS as email users: `auth.uid()` is set after Supabase completes the flow. Ensure `organization_id` (or tenant) is set in user metadata in Supabase if you use multi-tenancy.
