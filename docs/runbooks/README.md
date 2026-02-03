# Incident runbooks

Step-by-step actions for common incidents. See also [audit-deployment-checklist.md](../audit-deployment-checklist.md) for rollback procedures.

---

## 1. API / backend down

**Symptom:** Frontend shows "Failed to fetch", 502/503, or health check fails.

**Checks:**
- `curl https://your-backend-url/health` (or Render dashboard health)
- Backend logs (Render → Logs, or server logs)
- [status.render.com](https://status.render.com) / hosting status

**Actions:**
1. Confirm backend process is running; restart from Render/hosting dashboard if needed.
2. Check recent deploys; if the failure started after a deploy, consider rollback (see [Rollback Plan](../audit-deployment-checklist.md#rollback-plan)).
3. Check database connectivity (Supabase status, connection limits).
4. Notify team and post in status channel if user-facing.

---

## 2. High error rate / 5xx

**Symptom:** Sentry or logs show spike in 5xx or unhandled exceptions.

**Checks:**
- Sentry (or error reporting) dashboard for stack traces and frequency.
- Backend logs for the same time window.
- Recent deployments (Vercel/Render) and feature flags.

**Actions:**
1. Identify the failing endpoint or component from Sentry/logs.
2. If caused by a recent deploy: rollback frontend or backend (see [Rollback Plan](../audit-deployment-checklist.md#rollback-plan)).
3. If not deploy-related: apply hotfix or disable feature flag; then root-cause and fix properly.
4. Communicate to users if impact is broad.

---

## 3. Database / Supabase issues

**Symptom:** Timeouts, connection errors, or "database unavailable".

**Checks:**
- [Supabase status](https://status.supabase.com) and project health.
- Supabase dashboard: connection pool usage, slow queries.
- Backend logs for connection or query errors.

**Actions:**
1. If Supabase incident: follow status page; consider read-only mode or maintenance page.
2. If connection pool exhausted: reduce concurrency, restart backend, or scale connection pool.
3. For data issues: use backups/point-in-time recovery per Supabase docs; involve DB admin if needed.

---

## 4. Frontend not loading / white screen

**Symptom:** App does not load or shows blank page; console errors (e.g. CSP, chunk load failed).

**Checks:**
- Browser console for errors (CSP, 404 for chunks, CORS).
- Vercel (or frontend host) build and deploy status.
- Recent frontend deploy and dependency changes.

**Actions:**
1. If CSP errors: adjust `Content-Security-Policy` in `next.config.ts` (see [SECURITY_CHECKLIST.md](../SECURITY_CHECKLIST.md)) and redeploy.
2. If chunk load failed: clear CDN cache or rollback frontend deploy (e.g. `vercel rollback`).
3. If build broken: fix build in branch and redeploy; rollback to last good deploy in the meantime.

---

## 5. Suspected security incident

**Symptom:** Unusual access patterns, reported breach, or exposed credentials.

**Checks:**
- Auth and API logs for anomalous requests.
- Sentry and error logs for unexpected access or errors.
- GitHub and hosting provider for unauthorized access.

**Actions:**
1. Rotate exposed credentials immediately (see [Secrets and rotation](../SECURITY_CHECKLIST.md#secrets-and-rotation)).
2. Revoke compromised sessions or tokens if applicable.
3. Escalate to security lead; preserve logs and follow incident process.
4. Notify affected users and authorities if required.

---

## Links

- [Deployment procedures](../DEPLOYMENT_PROCEDURES.md)
- [Audit deployment checklist – Rollback](../audit-deployment-checklist.md#rollback-plan)
- [Security checklist](../SECURITY_CHECKLIST.md)
