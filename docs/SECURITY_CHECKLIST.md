# Production Security Checklist

## Pre-Deployment Security Review

### ✅ Environment Configuration
- [ ] `ENVIRONMENT=production` is set
- [ ] `DISABLE_BOOTSTRAP=true` is set
- [ ] `ENABLE_DEVELOPMENT_MODE=false` is set
- [ ] All sensitive credentials are in environment variables (not hardcoded)
- [ ] `.env.production` file is not committed to version control
- [ ] Development environment variables are removed

### ✅ Authentication & Authorization
- [ ] Supabase Auth is properly configured
- [ ] JWT token validation is enabled and strict
- [ ] Service role key is secured and not exposed
- [ ] Row Level Security (RLS) policies are enabled on all tables
- [ ] Default admin user credentials are changed
- [ ] Multi-factor authentication is enabled for admin accounts

### ✅ Database Security
- [ ] Database connection uses SSL/TLS
- [ ] Database credentials are rotated regularly
- [ ] Backup encryption is enabled
- [ ] Database access is restricted to application servers only
- [ ] Audit logging is enabled for database operations

### ✅ API Security
- [ ] CORS is configured with specific allowed origins (no wildcards)
- [ ] Rate limiting is enabled and configured appropriately
- [ ] Input validation is implemented on all endpoints
- [ ] SQL injection protection is verified
- [ ] XSS protection headers are enabled
- [ ] CSRF protection is enabled for state-changing operations

### ✅ Network Security
- [ ] HTTPS is enforced (no HTTP traffic allowed)
- [ ] Security headers are configured (HSTS, CSP, etc.)  
  **Implemented in Next.js:** `next.config.ts` `headers()` sets X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy; in production also Strict-Transport-Security and Content-Security-Policy-Report-Only. To change or add domains (e.g. for CSP), edit `next.config.ts`.
- [ ] API endpoints are behind a firewall/WAF
- [ ] Internal services are not exposed to public internet
- [ ] VPN or private networking is used for admin access

### ✅ Data Protection
- [ ] Sensitive data is encrypted at rest
- [ ] Data transmission uses encryption (TLS 1.2+)
- [ ] Personal data handling complies with GDPR/privacy laws
- [ ] Data retention policies are implemented
- [ ] Regular data backups are performed and tested

### ✅ Monitoring & Logging
- [ ] Security event logging is enabled
- [ ] Failed authentication attempts are monitored
- [ ] Unusual API usage patterns are detected
- [ ] Log files are secured and access-controlled
- [ ] Real-time alerting is configured for security events

### ✅ Application Security
- [ ] Dependencies are updated and vulnerability-scanned
- [ ] File upload restrictions are enforced
- [ ] Error messages don't expose sensitive information
- [ ] Debug mode is disabled in production
- [ ] Source code is not exposed in client bundles

### ✅ Admin Panel Security
- [ ] Admin access is restricted to authorized personnel only
- [ ] Admin actions are logged and auditable
- [ ] Bootstrap/setup endpoints are disabled
- [ ] Admin documentation is not exposed in the application
- [ ] Privileged operations require additional confirmation

## Secrets and rotation

### Where production secrets are stored

- **Frontend (Vercel):** Environment variables in Vercel project (Settings → Environment Variables). Used at build and runtime for `NEXT_PUBLIC_*` and server-side vars.
- **Backend (Render or host):** Environment variables in the service dashboard.
- **Database / Auth:** Supabase dashboard (Project Settings → API, Database).
- **CI/CD:** GitHub repository Secrets and variables (Actions). Used for deploy keys, `LOAD_TEST_AUTH_TOKEN`, etc.

Do not commit secrets to the repo; use `.env.local` locally and never commit it.

### Critical secrets (no values here)

- Supabase: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and (backend) service role or DB URL if used.
- Sentry: `NEXT_PUBLIC_SENTRY_DSN` (optional).
- Backend: `OPENAI_API_KEY`, Redis URL, any API keys for integrations.
- GitHub: secrets used by workflows (e.g. deploy tokens, `LOAD_TEST_AUTH_TOKEN`).

### Who can change them and how

- **Vercel:** Project admins; change in dashboard then redeploy or wait for next deploy.
- **Render / backend host:** Team with access; change in service env, then restart/redeploy.
- **Supabase:** Project owners; rotate in dashboard and update all consumers (frontend env, backend env).
- **GitHub:** Repo admins; change in Settings → Secrets and variables → Actions.

### Recommended rotation cadence and procedure

- **Database credentials / Supabase keys:** At least every 90 days, or immediately on compromise.
- **API keys (OpenAI, etc.):** Annually or on compromise.
- **Deploy tokens and CI secrets:** On personnel change or compromise.

**Procedure (generic):** (1) Generate new secret in the provider (Supabase, OpenAI, etc.). (2) Update the secret in every consumer (Vercel, Render, GitHub). (3) Redeploy or restart services so they use the new value. (4) Revoke or delete the old secret after confirming the app works. (5) Document the rotation date and next due date.

## Post-Deployment Security Monitoring

### Daily Checks
- [ ] Review failed authentication logs
- [ ] Monitor unusual API usage patterns
- [ ] Check system health and performance metrics
- [ ] Verify backup completion

### Weekly Checks
- [ ] Review user access and permissions
- [ ] Check for new security vulnerabilities in dependencies
- [ ] Analyze audit logs for suspicious activities
- [ ] Test security monitoring alerts

### Monthly Checks
- [ ] Rotate API keys and database credentials
- [ ] Review and update security policies
- [ ] Conduct security training for team members
- [ ] Test disaster recovery procedures

### Quarterly Checks
- [ ] Perform penetration testing
- [ ] Review and update access controls
- [ ] Audit user accounts and remove inactive users
- [ ] Update security documentation

## Incident Response Plan

### Security Incident Detection
1. **Automated Alerts**: Configure monitoring for suspicious activities
2. **Manual Reporting**: Provide clear channels for reporting security concerns
3. **Log Analysis**: Regular review of security logs and audit trails

### Incident Response Steps
1. **Immediate Response**:
   - Isolate affected systems
   - Preserve evidence
   - Notify security team

2. **Investigation**:
   - Determine scope and impact
   - Identify root cause
   - Document findings

3. **Containment**:
   - Stop ongoing attack
   - Prevent further damage
   - Implement temporary fixes

4. **Recovery**:
   - Restore systems from clean backups
   - Apply security patches
   - Verify system integrity

5. **Post-Incident**:
   - Conduct lessons learned review
   - Update security procedures
   - Implement preventive measures

## Emergency Contacts

### Internal Team
- **Security Lead**: [Contact Information]
- **System Administrator**: [Contact Information]
- **Development Lead**: [Contact Information]

### External Support
- **Hosting Provider**: [Support Contact]
- **Security Consultant**: [Contact Information]
- **Legal Counsel**: [Contact Information]

## Security Tools & Resources

### Recommended Tools
- **Vulnerability Scanning**: OWASP ZAP, Nessus
- **Dependency Checking**: npm audit, Snyk
- **Log Analysis**: ELK Stack, Splunk
- **Monitoring**: DataDog, New Relic

### Security Resources
- **OWASP Top 10**: https://owasp.org/www-project-top-ten/
- **Security Headers**: https://securityheaders.com/
- **SSL Test**: https://www.ssllabs.com/ssltest/

---
**Document Version**: 1.0  
**Last Updated**: January 2026  
**Review Schedule**: Quarterly