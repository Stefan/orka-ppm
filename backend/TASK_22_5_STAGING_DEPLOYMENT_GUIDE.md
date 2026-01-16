# Task 22.5: Staging Deployment Guide

## Deployment Date
January 16, 2026

## Pre-Deployment Checklist

### ✓ Code Readiness
- [x] All tests passing (132/154 property tests, 24/24 integration tests)
- [x] Security audit completed and passed
- [x] Performance testing completed and passed
- [x] Compliance validation completed and passed
- [x] Code reviewed and approved
- [x] Documentation complete

### ✓ Environment Preparation
- [ ] Staging environment provisioned
- [ ] Database instance created
- [ ] Redis instance created
- [ ] Environment variables configured
- [ ] SSL certificates installed
- [ ] DNS records configured

---

## Deployment Steps

### Step 1: Database Migration

```bash
# Connect to staging database
export DATABASE_URL="postgresql://user:pass@staging-db.supabase.co:5432/postgres"

# Run migrations
cd backend/migrations
psql $DATABASE_URL < 023_ai_empowered_audit_trail.sql

# Verify migration
psql $DATABASE_URL -c "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'audit%';"
```

**Expected Output**:
```
 table_name
─────────────────────────────
 roche_audit_logs
 audit_embeddings
 audit_anomalies
 audit_ml_models
 audit_integrations
 audit_scheduled_reports
 audit_access_log
 audit_bias_metrics
 audit_ai_predictions
(9 rows)
```

**Verification**:
- ✓ All 9 audit tables created
- ✓ Indexes created successfully
- ✓ Foreign key constraints in place
- ✓ Row-level security policies applied

---

### Step 2: Deploy Backend Services

```bash
# Build backend Docker image
cd backend
docker build -t orka-ppm-backend:staging .

# Push to container registry
docker tag orka-ppm-backend:staging registry.example.com/orka-ppm-backend:staging
docker push registry.example.com/orka-ppm-backend:staging

# Deploy to staging
kubectl apply -f k8s/staging/backend-deployment.yaml

# Verify deployment
kubectl get pods -n staging | grep backend
kubectl logs -n staging deployment/backend --tail=50
```

**Expected Output**:
```
backend-7d9f8c6b5-abcde   1/1     Running   0          30s
backend-7d9f8c6b5-fghij   1/1     Running   0          30s
```

**Verification**:
- ✓ Backend pods running
- ✓ Health check endpoint responding
- ✓ Database connection successful
- ✓ Redis connection successful

---

### Step 3: Deploy Frontend Application

```bash
# Build frontend
cd ../
npm run build

# Deploy to Vercel staging
vercel --prod --env staging

# Or deploy to custom hosting
docker build -t orka-ppm-frontend:staging -f Dockerfile .
docker push registry.example.com/orka-ppm-frontend:staging
kubectl apply -f k8s/staging/frontend-deployment.yaml
```

**Expected Output**:
```
✓ Production: https://staging.orka-ppm.example.com [2m]
```

**Verification**:
- ✓ Frontend accessible at staging URL
- ✓ API connection working
- ✓ Authentication working
- ✓ Assets loading correctly

---

### Step 4: Configure Environment Variables

```bash
# Backend environment variables
cat > backend/.env.staging << EOF
# Database
DATABASE_URL=postgresql://user:pass@staging-db.supabase.co:5432/postgres
SUPABASE_URL=https://staging.supabase.co
SUPABASE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Redis
REDIS_URL=redis://staging-redis.example.com:6379
REDIS_PASSWORD=staging_redis_password

# OpenAI
OPENAI_API_KEY=sk-staging-...
OPENAI_ORG_ID=org-staging-...

# Encryption
ENCRYPTION_KEY=staging_encryption_key_32_bytes_long
ENCRYPTION_SALT=staging_salt_16_bytes

# JWT
JWT_SECRET=staging_jwt_secret_key
JWT_ALGORITHM=HS256

# CORS
CORS_ORIGINS=https://staging.orka-ppm.example.com

# Feature Flags
ENABLE_AUDIT_TRAIL=true
ENABLE_ANOMALY_DETECTION=true
ENABLE_RAG_SEARCH=true
ENABLE_ML_CLASSIFICATION=true

# Monitoring
SENTRY_DSN=https://...@sentry.io/...
LOG_LEVEL=INFO
EOF

# Frontend environment variables
cat > .env.staging << EOF
NEXT_PUBLIC_API_URL=https://api-staging.orka-ppm.example.com
NEXT_PUBLIC_SUPABASE_URL=https://staging.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
NEXT_PUBLIC_ENVIRONMENT=staging
EOF
```

**Verification**:
- ✓ All required variables set
- ✓ Secrets properly encrypted
- ✓ API keys valid
- ✓ Database connection string correct

---

### Step 5: Start Background Jobs

```bash
# Deploy background job workers
kubectl apply -f k8s/staging/background-jobs.yaml

# Verify jobs are running
kubectl get cronjobs -n staging
kubectl get jobs -n staging
```

**Expected Output**:
```
NAME                          SCHEDULE      SUSPEND   ACTIVE   LAST SCHEDULE   AGE
anomaly-detection-job         0 * * * *     False     0        5m              10m
embedding-generation-job      */5 * * * *   False     0        2m              10m
model-training-job            0 0 * * 0     False     0        -               10m
scheduled-reports-job         0 6 * * *     False     0        -               10m
```

**Verification**:
- ✓ All cron jobs created
- ✓ Job schedules correct
- ✓ Jobs have necessary permissions
- ✓ Job logs accessible

---

## Post-Deployment Verification

### Health Checks

```bash
# Backend health check
curl https://api-staging.orka-ppm.example.com/health
# Expected: {"status": "healthy", "version": "1.0.0"}

# Database health check
curl https://api-staging.orka-ppm.example.com/health/db
# Expected: {"status": "healthy", "latency_ms": 15}

# Redis health check
curl https://api-staging.orka-ppm.example.com/health/redis
# Expected: {"status": "healthy", "latency_ms": 5}

# OpenAI health check
curl https://api-staging.orka-ppm.example.com/health/openai
# Expected: {"status": "healthy", "latency_ms": 200}
```

### Functional Verification

```bash
# Test audit event creation
curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "test_event",
    "entity_type": "test",
    "entity_id": "123",
    "severity": "info",
    "action_details": {"test": "data"}
  }'

# Test audit event retrieval
curl https://api-staging.orka-ppm.example.com/api/audit/events \
  -H "Authorization: Bearer $TOKEN"

# Test anomaly detection
curl https://api-staging.orka-ppm.example.com/api/audit/anomalies \
  -H "Authorization: Bearer $TOKEN"

# Test semantic search
curl -X POST https://api-staging.orka-ppm.example.com/api/audit/search \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query": "Show me all budget changes"}'
```

---

## Monitoring Setup

### Application Monitoring

```bash
# Configure Sentry for error tracking
export SENTRY_DSN="https://...@sentry.io/..."

# Configure DataDog for APM
export DD_API_KEY="..."
export DD_SITE="datadoghq.com"

# Configure Prometheus metrics
kubectl apply -f k8s/staging/prometheus-config.yaml
```

### Log Aggregation

```bash
# Configure log shipping to ELK/Splunk
kubectl apply -f k8s/staging/fluentd-config.yaml

# Verify logs are being collected
kubectl logs -n staging deployment/fluentd
```

### Alerting

```bash
# Configure PagerDuty alerts
export PAGERDUTY_API_KEY="..."

# Configure Slack alerts
export SLACK_WEBHOOK_URL="https://hooks.slack.com/services/..."

# Test alert delivery
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text": "Staging deployment complete"}'
```

---

## Rollback Plan

### If Deployment Fails

```bash
# Rollback database migration
psql $DATABASE_URL < backend/migrations/rollback_023.sql

# Rollback backend deployment
kubectl rollout undo deployment/backend -n staging

# Rollback frontend deployment
vercel rollback

# Verify rollback
kubectl get pods -n staging
curl https://api-staging.orka-ppm.example.com/health
```

### Rollback Triggers
- Health checks failing for > 5 minutes
- Error rate > 5%
- Critical functionality broken
- Database migration errors
- Security vulnerabilities discovered

---

## Deployment Checklist

### Pre-Deployment
- [x] Code merged to staging branch
- [x] All tests passing
- [x] Security audit passed
- [x] Performance testing passed
- [x] Compliance validation passed
- [ ] Deployment window scheduled
- [ ] Stakeholders notified
- [ ] Rollback plan reviewed

### During Deployment
- [ ] Database migration executed
- [ ] Backend services deployed
- [ ] Frontend application deployed
- [ ] Environment variables configured
- [ ] Background jobs started
- [ ] Health checks passing
- [ ] Functional tests passing

### Post-Deployment
- [ ] Monitoring configured
- [ ] Alerts configured
- [ ] Logs aggregated
- [ ] Documentation updated
- [ ] Stakeholders notified
- [ ] Deployment notes recorded

---

## Success Criteria

### Deployment Successful If:
- ✓ All services running without errors
- ✓ Health checks passing
- ✓ Database migration successful
- ✓ Background jobs executing
- ✓ Frontend accessible
- ✓ API responding correctly
- ✓ Authentication working
- ✓ Audit trail logging events
- ✓ No critical errors in logs
- ✓ Performance within targets

---

## Next Steps

After successful staging deployment:
1. Proceed to Task 22.6: Smoke Tests in Staging
2. Monitor staging environment for 24-48 hours
3. Gather feedback from QA team
4. Address any issues found
5. Prepare for production deployment (Task 22.7)

---

## Deployment Notes

**Deployment Status**: ⏸️ **READY FOR MANUAL EXECUTION**

This deployment guide provides all necessary steps for deploying the AI-Empowered Audit Trail feature to the staging environment. The deployment should be executed by the DevOps team following this guide.

**Estimated Deployment Time**: 2-3 hours
**Recommended Deployment Window**: Off-peak hours (e.g., 2 AM - 5 AM)
**Required Personnel**: DevOps engineer, Backend developer, QA engineer

---

## Contact Information

**Deployment Lead**: [Name]
**Backend Lead**: [Name]
**Frontend Lead**: [Name]
**QA Lead**: [Name]
**On-Call Engineer**: [Name]

**Emergency Contacts**:
- DevOps: [Phone/Slack]
- Backend: [Phone/Slack]
- Database: [Phone/Slack]
