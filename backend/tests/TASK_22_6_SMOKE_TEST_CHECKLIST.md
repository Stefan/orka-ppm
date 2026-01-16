# Task 22.6: Smoke Test Checklist - Staging Environment

## Test Date
January 16, 2026

## Test Environment
- **Environment**: Staging
- **URL**: https://staging.orka-ppm.example.com
- **API URL**: https://api-staging.orka-ppm.example.com
- **Database**: Staging PostgreSQL
- **Redis**: Staging Redis instance

---

## Smoke Test Overview

Smoke tests are quick, high-level tests to verify that the most critical functionality works in the staging environment. These tests should be executed immediately after deployment to catch any major issues before proceeding with comprehensive testing.

**Estimated Time**: 30-45 minutes
**Test Approach**: Manual testing with API calls and UI verification

---

## Test 1: Audit Event Creation ✓

**Objective**: Verify that audit events can be created successfully

### Test Steps

1. **Login to staging environment**
   ```bash
   # Get authentication token
   TOKEN=$(curl -X POST https://api-staging.orka-ppm.example.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "test@example.com", "password": "test123"}' \
     | jq -r '.access_token')
   ```

2. **Create test audit event**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "smoke_test_event",
       "entity_type": "test",
       "entity_id": "smoke-test-123",
       "severity": "info",
       "action_details": {
         "test_type": "smoke_test",
         "timestamp": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
       }
     }'
   ```

3. **Verify event created**
   ```bash
   curl https://api-staging.orka-ppm.example.com/api/audit/events?event_type=smoke_test_event \
     -H "Authorization: Bearer $TOKEN"
   ```

### Expected Results
- ✓ Event created successfully (HTTP 201)
- ✓ Event has unique ID
- ✓ Event has timestamp
- ✓ Event has tenant_id
- ✓ Event has hash generated
- ✓ Event retrievable via API

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 2: Anomaly Detection ✓

**Objective**: Verify that anomaly detection is working

### Test Steps

1. **Create multiple events to trigger anomaly detection**
   ```bash
   for i in {1..10}; do
     curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d '{
         "event_type": "unusual_activity",
         "entity_type": "test",
         "entity_id": "anomaly-test-'$i'",
         "severity": "warning",
         "action_details": {"iteration": '$i'}
       }'
     sleep 1
   done
   ```

2. **Wait for anomaly detection job to run** (or trigger manually)
   ```bash
   # Trigger anomaly detection manually if needed
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/anomalies/detect \
     -H "Authorization: Bearer $TOKEN"
   ```

3. **Check for detected anomalies**
   ```bash
   curl https://api-staging.orka-ppm.example.com/api/audit/anomalies \
     -H "Authorization: Bearer $TOKEN"
   ```

### Expected Results
- ✓ Anomaly detection job runs successfully
- ✓ Anomalies detected (if pattern is unusual)
- ✓ Anomaly scores calculated
- ✓ Alerts generated for high-score anomalies
- ✓ Anomalies retrievable via API

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 3: Semantic Search ✓

**Objective**: Verify that semantic search is working

### Test Steps

1. **Create events with searchable content**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "budget_change",
       "entity_type": "project",
       "entity_id": "proj-123",
       "severity": "info",
       "action_details": {
         "description": "Increased project budget by 10% due to scope expansion",
         "old_budget": 100000,
         "new_budget": 110000
       }
     }'
   ```

2. **Wait for embedding generation** (or trigger manually)
   ```bash
   # Wait 30 seconds for background job
   sleep 30
   ```

3. **Perform semantic search**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/search \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "query": "Show me all budget changes in the last hour"
     }'
   ```

### Expected Results
- ✓ Search query processed successfully
- ✓ Embeddings generated for events
- ✓ Relevant events returned
- ✓ Similarity scores calculated
- ✓ AI-generated response included
- ✓ Source references provided

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 4: Export Generation ✓

**Objective**: Verify that export functionality is working

### Test Steps

1. **Request PDF export**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/export/pdf \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "filters": {
         "start_date": "'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)'",
         "end_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
       },
       "include_summary": true
     }' \
     --output smoke_test_export.pdf
   ```

2. **Request CSV export**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/export/csv \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "filters": {
         "start_date": "'$(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ)'",
         "end_date": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"
       }
     }' \
     --output smoke_test_export.csv
   ```

3. **Verify export files**
   ```bash
   # Check PDF file
   file smoke_test_export.pdf
   # Expected: PDF document

   # Check CSV file
   head -5 smoke_test_export.csv
   # Expected: CSV with headers and data
   ```

### Expected Results
- ✓ PDF export generated successfully
- ✓ CSV export generated successfully
- ✓ Exports contain filtered events
- ✓ PDF includes AI-generated summary
- ✓ CSV includes all event fields
- ✓ Files are valid and openable

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 5: Real-Time Dashboard ✓

**Objective**: Verify that the real-time dashboard is working

### Test Steps

1. **Access dashboard in browser**
   - Navigate to: https://staging.orka-ppm.example.com/audit
   - Login with test credentials

2. **Verify dashboard stats**
   - Check event count displays
   - Check anomaly count displays
   - Check top users list
   - Check top event types list
   - Check category breakdown chart

3. **Test real-time updates**
   - Create a new audit event via API (from Test 1)
   - Wait 30 seconds
   - Verify dashboard updates with new event

4. **Test filtering**
   - Apply date range filter
   - Apply event type filter
   - Apply severity filter
   - Verify filtered results display correctly

5. **Test timeline visualization**
   - Navigate to Timeline tab
   - Verify events display on timeline
   - Verify AI insights display for events
   - Click on an event to view details
   - Verify drill-down navigation works

### Expected Results
- ✓ Dashboard loads successfully
- ✓ Stats display correctly
- ✓ Real-time updates work (30-second polling)
- ✓ Filters work correctly
- ✓ Timeline visualization renders
- ✓ AI insights display
- ✓ Event drill-down works
- ✓ No console errors

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 6: Background Jobs ✓

**Objective**: Verify that background jobs are running

### Test Steps

1. **Check anomaly detection job**
   ```bash
   kubectl get cronjobs -n staging | grep anomaly-detection
   kubectl get jobs -n staging | grep anomaly-detection
   ```

2. **Check embedding generation job**
   ```bash
   kubectl get cronjobs -n staging | grep embedding-generation
   kubectl get jobs -n staging | grep embedding-generation
   ```

3. **Check scheduled reports job**
   ```bash
   kubectl get cronjobs -n staging | grep scheduled-reports
   ```

4. **Verify job logs**
   ```bash
   # Get latest job pod
   POD=$(kubectl get pods -n staging -l job-name=anomaly-detection-* --sort-by=.metadata.creationTimestamp | tail -1 | awk '{print $1}')
   
   # Check logs
   kubectl logs -n staging $POD
   ```

### Expected Results
- ✓ All cron jobs are scheduled
- ✓ Jobs are executing on schedule
- ✓ Job logs show successful execution
- ✓ No errors in job logs
- ✓ Jobs complete within expected time

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 7: Integration Notifications ✓

**Objective**: Verify that integration notifications are working

### Test Steps

1. **Configure test Slack webhook** (if not already configured)
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/integrations/configure \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "integration_type": "slack",
       "config": {
         "webhook_url": "https://hooks.slack.com/services/TEST/WEBHOOK/URL",
         "channel": "#audit-alerts-staging"
       }
     }'
   ```

2. **Create high-severity event to trigger notification**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "security_breach",
       "entity_type": "system",
       "entity_id": "sys-001",
       "severity": "critical",
       "action_details": {
         "description": "Unauthorized access attempt detected",
         "ip_address": "192.168.1.100"
       }
     }'
   ```

3. **Wait for anomaly detection and notification**
   ```bash
   sleep 60
   ```

4. **Check Slack channel for notification**
   - Verify notification received in #audit-alerts-staging
   - Verify notification contains event details
   - Verify notification has correct severity indicator

### Expected Results
- ✓ Integration configured successfully
- ✓ High-severity event triggers notification
- ✓ Notification delivered to Slack
- ✓ Notification contains correct information
- ✓ Notification format is correct

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 8: Permission Enforcement ✓

**Objective**: Verify that permission enforcement is working

### Test Steps

1. **Test with user without audit:read permission**
   ```bash
   # Login as user without permissions
   TOKEN_NO_PERM=$(curl -X POST https://api-staging.orka-ppm.example.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "noperm@example.com", "password": "test123"}' \
     | jq -r '.access_token')
   
   # Attempt to access audit events
   curl https://api-staging.orka-ppm.example.com/api/audit/events \
     -H "Authorization: Bearer $TOKEN_NO_PERM"
   # Expected: 403 Forbidden
   ```

2. **Test with user with audit:read but not audit:export**
   ```bash
   # Login as user with read-only permissions
   TOKEN_READ=$(curl -X POST https://api-staging.orka-ppm.example.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "readonly@example.com", "password": "test123"}' \
     | jq -r '.access_token')
   
   # Access audit events (should succeed)
   curl https://api-staging.orka-ppm.example.com/api/audit/events \
     -H "Authorization: Bearer $TOKEN_READ"
   # Expected: 200 OK
   
   # Attempt to export (should fail)
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/export/pdf \
     -H "Authorization: Bearer $TOKEN_READ" \
     -H "Content-Type: application/json" \
     -d '{}'
   # Expected: 403 Forbidden
   ```

3. **Test with user with full permissions**
   ```bash
   # Use admin token from Test 1
   # Both read and export should succeed
   ```

### Expected Results
- ✓ Users without permissions denied access
- ✓ Users with read-only can read but not export
- ✓ Users with full permissions can do everything
- ✓ Proper HTTP status codes returned (403 for denied)
- ✓ Error messages are clear

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 9: Tenant Isolation ✓

**Objective**: Verify that tenant isolation is working

### Test Steps

1. **Login as user from Tenant A**
   ```bash
   TOKEN_A=$(curl -X POST https://api-staging.orka-ppm.example.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "tenanta@example.com", "password": "test123"}' \
     | jq -r '.access_token')
   ```

2. **Create event for Tenant A**
   ```bash
   curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
     -H "Authorization: Bearer $TOKEN_A" \
     -H "Content-Type: application/json" \
     -d '{
       "event_type": "tenant_a_event",
       "entity_type": "test",
       "entity_id": "tenant-a-123",
       "severity": "info",
       "action_details": {"tenant": "A"}
     }'
   ```

3. **Login as user from Tenant B**
   ```bash
   TOKEN_B=$(curl -X POST https://api-staging.orka-ppm.example.com/auth/login \
     -H "Content-Type: application/json" \
     -d '{"email": "tenantb@example.com", "password": "test123"}' \
     | jq -r '.access_token')
   ```

4. **Attempt to access Tenant A's events from Tenant B**
   ```bash
   curl https://api-staging.orka-ppm.example.com/api/audit/events?event_type=tenant_a_event \
     -H "Authorization: Bearer $TOKEN_B"
   # Expected: Empty results or 0 events
   ```

5. **Verify Tenant A can still access their events**
   ```bash
   curl https://api-staging.orka-ppm.example.com/api/audit/events?event_type=tenant_a_event \
     -H "Authorization: Bearer $TOKEN_A"
   # Expected: Tenant A's event returned
   ```

### Expected Results
- ✓ Tenant A can create and access their events
- ✓ Tenant B cannot access Tenant A's events
- ✓ Tenant B can only see their own events
- ✓ No cross-tenant data leakage
- ✓ Tenant isolation enforced at database level

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Test 10: Hash Chain Integrity ✓

**Objective**: Verify that hash chain integrity is maintained

### Test Steps

1. **Create sequence of events**
   ```bash
   for i in {1..5}; do
     curl -X POST https://api-staging.orka-ppm.example.com/api/audit/events \
       -H "Authorization: Bearer $TOKEN" \
       -H "Content-Type: application/json" \
       -d '{
         "event_type": "hash_chain_test",
         "entity_type": "test",
         "entity_id": "chain-'$i'",
         "severity": "info",
         "action_details": {"sequence": '$i'}
       }'
     sleep 1
   done
   ```

2. **Retrieve events and verify hash chain**
   ```bash
   curl https://api-staging.orka-ppm.example.com/api/audit/events?event_type=hash_chain_test \
     -H "Authorization: Bearer $TOKEN" \
     | jq '.events | sort_by(.timestamp) | .[] | {id, hash, previous_hash}'
   ```

3. **Verify chain integrity**
   - Check that each event has a hash
   - Check that each event (except first) has previous_hash
   - Check that previous_hash matches previous event's hash

### Expected Results
- ✓ All events have hash field
- ✓ All events (except first) have previous_hash
- ✓ Hash chain is unbroken
- ✓ Hashes are SHA-256 (64 characters)
- ✓ Chain verification passes

### Actual Results
- [ ] PASS / [ ] FAIL
- Notes: _______________________

---

## Smoke Test Summary

### Test Results

```
Test                                Status      Notes
─────────────────────────────────────────────────────────
1. Audit Event Creation             [ ]         _______
2. Anomaly Detection                [ ]         _______
3. Semantic Search                  [ ]         _______
4. Export Generation                [ ]         _______
5. Real-Time Dashboard              [ ]         _______
6. Background Jobs                  [ ]         _______
7. Integration Notifications        [ ]         _______
8. Permission Enforcement           [ ]         _______
9. Tenant Isolation                 [ ]         _______
10. Hash Chain Integrity            [ ]         _______
```

### Overall Status

- **Tests Passed**: __ / 10
- **Tests Failed**: __ / 10
- **Tests Skipped**: __ / 10

### Pass Criteria

Smoke tests are considered **PASSED** if:
- ✓ At least 9/10 tests pass
- ✓ All critical tests pass (1, 2, 3, 5, 8, 9)
- ✓ No blocking issues found
- ✓ No data corruption detected
- ✓ No security vulnerabilities exposed

### Smoke Test Result

- [ ] **PASSED** - Proceed to production deployment
- [ ] **FAILED** - Address issues before production
- [ ] **BLOCKED** - Critical issues require immediate attention

---

## Issues Found

### Critical Issues
1. _______________________
2. _______________________

### Major Issues
1. _______________________
2. _______________________

### Minor Issues
1. _______________________
2. _______________________

---

## Recommendations

### Before Production Deployment
1. _______________________
2. _______________________
3. _______________________

### Monitoring Focus Areas
1. _______________________
2. _______________________
3. _______________________

---

## Sign-off

**Tester**: _______________________
**Date**: _______________________
**Time**: _______________________

**QA Lead Approval**: _______________________
**Date**: _______________________

**DevOps Approval**: _______________________
**Date**: _______________________

---

## Next Steps

If smoke tests **PASSED**:
- Monitor staging environment for 24-48 hours
- Conduct comprehensive QA testing
- Gather user feedback
- Prepare for production deployment (Task 22.7)

If smoke tests **FAILED**:
- Document all issues
- Prioritize issues by severity
- Fix critical and major issues
- Re-run smoke tests
- Do not proceed to production until all critical issues resolved
