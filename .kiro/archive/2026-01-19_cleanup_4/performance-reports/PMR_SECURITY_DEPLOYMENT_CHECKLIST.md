# PMR Security and Access Control - Deployment Checklist

## Pre-Deployment Checklist

### 1. Code Review
- [x] All security services implemented
- [x] RBAC permissions added
- [x] Security middleware created
- [x] Database migration prepared
- [x] Tests written
- [x] Documentation completed
- [x] No syntax errors in code

### 2. Database Preparation
- [ ] Review migration script: `backend/migrations/022_pmr_security_audit.sql`
- [ ] Backup existing database
- [ ] Test migration on staging environment
- [ ] Verify all indexes are created
- [ ] Test database functions

### 3. Configuration
- [ ] Review environment variables
- [ ] Configure audit log retention policy
- [ ] Set export expiration defaults
- [ ] Configure watermark settings
- [ ] Set up monitoring alerts

### 4. Testing
- [ ] Run unit tests: `pytest tests/test_pmr_security.py -v`
- [ ] Test RBAC permissions
- [ ] Test audit logging
- [ ] Test data masking
- [ ] Test export security
- [ ] Test watermarking
- [ ] Perform security penetration testing

## Deployment Steps

### Step 1: Database Migration

```bash
# Backup database first
pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql

# Run migration
psql -U username -d database_name -f backend/migrations/022_pmr_security_audit.sql

# Verify tables created
psql -U username -d database_name -c "\dt pmr_*"
```

Expected tables:
- pmr_audit_log
- pmr_export_security
- pmr_export_downloads
- pmr_data_sensitivity
- pmr_access_control

### Step 2: Update Application Code

```bash
# Pull latest code
git pull origin main

# Install dependencies (if any new ones)
pip install -r backend/requirements.txt

# Restart application
systemctl restart your-app-service
```

### Step 3: Verify Deployment

```bash
# Check application logs
tail -f /var/log/your-app/app.log

# Test health endpoint
curl http://localhost:8000/health

# Test PMR security endpoint
curl -H "Authorization: Bearer YOUR_TOKEN" \
     http://localhost:8000/api/reports/pmr/test-report-id
```

### Step 4: Configure Monitoring

Set up alerts for:
- High number of permission denied events
- Sensitive data access patterns
- Failed export attempts
- Unusual audit log activity

### Step 5: User Communication

- [ ] Notify users of new security features
- [ ] Provide documentation links
- [ ] Schedule training sessions
- [ ] Update user guides

## Post-Deployment Checklist

### Immediate (Day 1)
- [ ] Monitor application logs for errors
- [ ] Check audit log is recording events
- [ ] Verify permissions are working correctly
- [ ] Test export functionality
- [ ] Verify watermarks are applied

### Short-term (Week 1)
- [ ] Review audit logs for anomalies
- [ ] Check export download patterns
- [ ] Monitor permission denied events
- [ ] Gather user feedback
- [ ] Address any issues

### Long-term (Month 1)
- [ ] Generate compliance reports
- [ ] Review security metrics
- [ ] Optimize performance if needed
- [ ] Plan for audit log archival
- [ ] Update documentation based on feedback

## Rollback Plan

If issues occur:

### Step 1: Stop Application
```bash
systemctl stop your-app-service
```

### Step 2: Restore Database
```bash
# Restore from backup
psql -U username -d database_name < backup_YYYYMMDD.sql
```

### Step 3: Revert Code
```bash
git revert <commit-hash>
git push origin main
```

### Step 4: Restart Application
```bash
systemctl start your-app-service
```

## Environment Variables

Add these to your environment configuration:

```bash
# Audit Settings
PMR_AUDIT_ENABLED=true
PMR_AUDIT_RETENTION_DAYS=365

# Export Security
PMR_EXPORT_EXPIRATION_DAYS=30
PMR_EXPORT_DOWNLOAD_LIMIT=10
PMR_WATERMARK_ENABLED=true

# Privacy Settings
PMR_DATA_MASKING_ENABLED=true
PMR_DEFAULT_MASK_LEVEL=partial

# Monitoring
PMR_SECURITY_ALERTS_ENABLED=true
PMR_ALERT_EMAIL=security@yourcompany.com
```

## Monitoring Queries

### Check Audit Log Activity
```sql
SELECT 
    action,
    COUNT(*) as count,
    DATE(timestamp) as date
FROM pmr_audit_log
WHERE timestamp > NOW() - INTERVAL '7 days'
GROUP BY action, DATE(timestamp)
ORDER BY date DESC, count DESC;
```

### Check Permission Denied Events
```sql
SELECT 
    user_id,
    COUNT(*) as denied_count,
    MAX(timestamp) as last_attempt
FROM pmr_audit_log
WHERE action = 'permission_denied'
AND timestamp > NOW() - INTERVAL '24 hours'
GROUP BY user_id
HAVING COUNT(*) > 5
ORDER BY denied_count DESC;
```

### Check Export Activity
```sql
SELECT 
    export_format,
    security_level,
    COUNT(*) as export_count,
    AVG(download_count) as avg_downloads
FROM pmr_export_security
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY export_format, security_level
ORDER BY export_count DESC;
```

### Check Sensitive Data Access
```sql
SELECT 
    user_id,
    report_id,
    COUNT(*) as access_count,
    MAX(timestamp) as last_access
FROM pmr_audit_log
WHERE action = 'sensitive_data_viewed'
AND timestamp > NOW() - INTERVAL '7 days'
GROUP BY user_id, report_id
ORDER BY access_count DESC;
```

## Security Hardening

### Additional Recommendations

1. **Enable HTTPS**: Ensure all API endpoints use HTTPS
2. **Rate Limiting**: Implement rate limiting on sensitive endpoints
3. **IP Whitelisting**: Consider IP restrictions for admin operations
4. **MFA**: Enable multi-factor authentication for sensitive operations
5. **Session Management**: Implement secure session handling
6. **Input Validation**: Ensure all inputs are validated
7. **Output Encoding**: Prevent XSS attacks
8. **CORS Configuration**: Properly configure CORS policies

## Compliance Verification

### GDPR Checklist
- [ ] Right to access implemented (audit trails)
- [ ] Right to erasure implemented (anonymization)
- [ ] Data minimization (PII masking)
- [ ] Consent management (access control)
- [ ] Data breach notification process

### SOC 2 Checklist
- [ ] Access controls documented
- [ ] Change management process
- [ ] Monitoring and alerting
- [ ] Data protection measures
- [ ] Incident response plan

## Support Contacts

- **Security Team**: security@yourcompany.com
- **DevOps Team**: devops@yourcompany.com
- **Database Admin**: dba@yourcompany.com
- **On-Call Engineer**: oncall@yourcompany.com

## Documentation Links

- Implementation Guide: `backend/docs/PMR_SECURITY_IMPLEMENTATION.md`
- Quick Reference: `backend/services/PMR_SECURITY_README.md`
- Integration Examples: `backend/examples/pmr_security_integration_example.py`
- API Documentation: [Your API Docs URL]

## Success Criteria

Deployment is successful when:

✅ All database tables created successfully
✅ Application starts without errors
✅ Audit logging is working
✅ Permissions are enforced correctly
✅ Data masking is functioning
✅ Export security is operational
✅ Watermarks are applied correctly
✅ No security vulnerabilities detected
✅ Performance is acceptable
✅ Users can access features appropriately

## Notes

- Keep this checklist updated as you complete items
- Document any issues encountered during deployment
- Share lessons learned with the team
- Update runbooks based on deployment experience

---

**Deployment Date**: _________________

**Deployed By**: _________________

**Verified By**: _________________

**Sign-off**: _________________
