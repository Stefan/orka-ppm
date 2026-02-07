# AI-Empowered Audit Trail User Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Getting Started](#getting-started)
3. [Audit Timeline](#audit-timeline)
4. [Anomaly Detection](#anomaly-detection)
5. [Semantic Search](#semantic-search)
6. [Export Functionality](#export-functionality)
7. [Real-Time Dashboard](#real-time-dashboard)
8. [Best Practices](#best-practices)
9. [Troubleshooting: No events showing](#troubleshooting-no-events-showing)
10. [FAQ](#faq)

---

## Introduction

The AI-Empowered Audit Trail provides comprehensive visibility into all system activities with intelligent insights powered by artificial intelligence. This feature helps you:

- **Track all system changes** with detailed audit logs
- **Detect unusual patterns** automatically using ML-based anomaly detection
- **Search naturally** using plain English queries
- **Understand context** with AI-generated explanations
- **Export reports** with executive summaries
- **Monitor in real-time** with live dashboard updates

### Key Features

✨ **AI-Powered Insights**: Every event is analyzed and tagged automatically  
🔍 **Semantic Search**: Ask questions in natural language  
⚠️ **Anomaly Detection**: Unusual patterns are flagged automatically  
📊 **Visual Timeline**: See events in an interactive timeline  
📄 **Smart Exports**: Generate reports with AI summaries  
🔔 **Real-Time Alerts**: Get notified of critical events instantly  

---

## Getting Started

### Accessing the Audit Trail

1. Navigate to **Audit** from the main menu
2. You'll see the Audit Dashboard with four main tabs:
   - **Timeline**: Visual timeline of all events
   - **Anomalies**: Detected unusual patterns
   - **Search**: Natural language search
   - **Dashboard**: Real-time statistics

### Required Permissions

To access audit features, you need:
- **audit:read** - View audit logs and search
- **audit:export** - Export reports (PDF/CSV)
- **audit:admin** - Configure integrations (admin only)

Contact your administrator if you don't have the necessary permissions.

---

## Audit Timeline

The Timeline view provides a chronological visualization of all system events with AI-generated insights.

### Viewing the Timeline

1. Click the **Timeline** tab
2. Events are displayed chronologically with:
   - **Timestamp**: When the event occurred
   - **Event Type**: What happened (login, budget change, etc.)
   - **User**: Who performed the action
   - **Severity**: Info, Warning, Error, or Critical
   - **AI Tags**: Automatically generated insights

### Understanding Event Colors

Events are color-coded by severity:
- 🔵 **Blue**: Info - Routine operations
- 🟡 **Yellow**: Warning - Noteworthy changes
- 🟠 **Orange**: Error - Issues requiring attention
- 🔴 **Red**: Critical - Urgent security or compliance events

### Filtering Events

Use the filter panel to narrow down events:

#### Date Range Filter
1. Click the **Date Range** picker
2. Select start and end dates
3. Events outside this range are hidden

#### Event Type Filter
1. Click **Event Type** dropdown
2. Select one or more event types:
   - User Login
   - Budget Change
   - Permission Change
   - Resource Assignment
   - Risk Event
   - Report Generated
3. Only selected types are shown

#### Severity Filter
1. Click **Severity** dropdown
2. Select severity levels to display
3. Combine with other filters for precise results

#### Category Filter
Categories are AI-assigned classifications:
- **Security Change**: Permission changes, access control
- **Financial Impact**: Budget changes, cost updates
- **Resource Allocation**: Resource assignments, capacity changes
- **Risk Event**: Risk creation, mitigation actions
- **Compliance Action**: Audit access, compliance-related changes

#### Risk Level Filter
Risk levels are AI-assigned based on impact:
- **Low**: Routine operations
- **Medium**: Standard changes
- **High**: Significant changes (>10% budget changes, permission escalations)
- **Critical**: Security breaches, compliance violations

### Viewing Event Details

1. Click on any event in the timeline
2. A detailed panel opens showing:
   - **Full action details**: Complete JSON of what changed
   - **User information**: Who performed the action
   - **Entity details**: What was affected
   - **AI insights**: Contextual analysis
   - **Related events**: Connected activities
   - **Anomaly score**: If flagged as unusual

### AI-Generated Insights

Each event includes AI-generated tags and insights:

**Example Tags:**
- "Budget Impact: High" - Significant financial change
- "Security Risk Detected" - Potential security concern
- "Compliance Relevant" - Requires documentation
- "Resource Change" - Affects resource allocation

**Example Insights:**
```
Summary: Unusual admin access grant detected
Impact: High security impact - elevated permissions granted
Recommendations:
  • Review access justification
  • Verify user identity
  • Document approval process
```

### Drill-Down Navigation

From event details, you can navigate to:
- **Project Details**: View the affected project
- **User Profile**: See user's activity history
- **Resource Details**: View resource information
- **Related Events**: See connected activities

**Example Workflow:**
1. Click on a "Budget Change" event
2. View the project affected
3. Click "View Project" to see full project details
4. Review all budget changes for this project

---

## Anomaly Detection

The system automatically detects unusual patterns using machine learning.

### Understanding Anomalies

An anomaly is an event that deviates significantly from normal patterns. The system considers:
- **Time patterns**: Events at unusual times
- **User behavior**: Actions outside normal patterns
- **Event frequency**: Rare or excessive events
- **Context**: Unusual combinations of actions

### Anomaly Scores

Each anomaly has a score from 0 to 1:
- **0.7 - 0.79**: Mild anomaly - Worth reviewing
- **0.8 - 0.89**: Moderate anomaly - Requires attention
- **0.9 - 1.0**: Severe anomaly - Urgent review needed

### Viewing Anomalies

1. Click the **Anomalies** tab
2. See all detected anomalies sorted by score
3. Each anomaly shows:
   - **Anomaly Score**: How unusual it is
   - **Detection Time**: When it was detected
   - **Event Summary**: What happened
   - **Affected Entities**: What was impacted
   - **Suggested Actions**: What to do next

### Understanding Anomaly Explanations

Click on an anomaly to see why it was flagged:

**Example Explanation:**
```
Top Contributing Factors:
  • Unusual time of day (35% contribution)
    - Event occurred at 2:30 AM, outside normal business hours
  
  • Rare event type (28% contribution)
    - Admin access grants are infrequent (< 5 per month)
  
  • High privilege escalation (29% contribution)
    - Full admin access granted, highest privilege level

Summary: This event is unusual due to occurring outside normal 
business hours and involving high-privilege access changes.
```

### Providing Feedback

Help improve anomaly detection by providing feedback:

1. Click on an anomaly
2. If it's a **false positive** (normal behavior):
   - Click **Mark as False Positive**
   - Add notes explaining why it's normal
   - Example: "Scheduled maintenance by IT team"
3. If it's a **true anomaly**:
   - Document your investigation
   - Take appropriate action
   - The system learns from your feedback

### Real-Time Anomaly Alerts

Critical anomalies trigger real-time notifications:
- **Toast notification** appears in the UI
- **Email alert** sent to configured recipients
- **Slack/Teams message** if integrations are configured

**Example Alert:**
```
🚨 Critical Anomaly Detected

Anomaly Score: 0.95
Event: Admin access granted to external user
Time: 2024-01-15 02:30 AM
Action Required: Immediate review
```

---

## Semantic Search

Search audit logs using natural language queries instead of complex filters.

### How Semantic Search Works

The system uses AI to:
1. Understand your question in plain English
2. Find relevant events using semantic similarity
3. Generate a natural language answer
4. Provide source references for verification

### Using Semantic Search

1. Click the **Search** tab
2. Type your question in natural language
3. Click **Search** or press Enter
4. Review the AI-generated response and results

### Example Queries

**Budget-Related:**
- "Show me all budget changes last week"
- "Which projects had budget increases over 10%?"
- "Find budget changes approved by John Smith"

**Security-Related:**
- "Show me failed login attempts this month"
- "Find all permission changes for Project Alpha"
- "Who granted admin access in the last 7 days?"

**Resource-Related:**
- "Show me resource assignments for Sarah Johnson"
- "Find all capacity changes in January"
- "Which resources were reassigned last week?"

**Compliance-Related:**
- "Show me all audit log exports this quarter"
- "Find compliance-related events for Project Beta"
- "Who accessed sensitive data last month?"

### Understanding Search Results

Results include:

**AI Response:**
```
I found 3 significant budget changes in the past week that 
exceeded 10% of project budgets. The largest change was a 15% 
increase to Project Alpha's budget on January 12th, approved 
by John Smith. Two other projects (Beta and Gamma) had budget 
increases of 12% and 11% respectively.
```

**Source Events:**
Each result shows:
- **Similarity Score**: How relevant (0-1)
- **Event Details**: Full event information
- **Relevance Explanation**: Why it matches your query

**Example Result:**
```
Similarity: 0.94
Event: Budget Change - Project Alpha
Date: January 12, 2024
Relevance: This event directly matches your query - it's a 
budget change from last week that exceeded 10%
```

### Search Tips

**Be Specific:**
- ❌ "Show me changes"
- ✅ "Show me budget changes in Project Alpha last week"

**Include Time Periods:**
- ❌ "Find permission changes"
- ✅ "Find permission changes in the last 30 days"

**Mention Entities:**
- ❌ "Show me events"
- ✅ "Show me events for Project Beta by user John Smith"

**Use Natural Language:**
- ✅ "What happened to the budget last week?"
- ✅ "Who changed permissions yesterday?"
- ✅ "Show me unusual activity this month"

### Suggested Queries

Click on suggested queries to get started:
- "Show me critical events from the last 24 hours"
- "Find all budget changes this month"
- "What security events occurred last week?"
- "Show me anomalies detected today"

---

## Export Functionality

Generate comprehensive reports with AI-powered summaries.

### PDF Export

PDF exports include:
- **Executive Summary**: AI-generated overview
- **Statistics**: Event counts, trends, key metrics
- **Trend Charts**: Visual analysis of patterns
- **Detailed Event List**: All matching events
- **Anomaly Highlights**: Flagged unusual patterns

#### Creating a PDF Export

1. Apply filters to select events
2. Click **Export** → **PDF**
3. Choose options:
   - ☑️ Include Executive Summary
   - ☑️ Include Trend Charts
   - ☑️ Include Anomaly Details
4. Click **Generate PDF**
5. Download the file when ready

**Example Executive Summary:**
```
Audit Report: January 1-31, 2024

Executive Summary:
This month showed elevated activity levels with 1,247 total 
events recorded. Five anomalies were detected, primarily 
related to unusual access patterns during non-business hours. 
Budget changes were within expected ranges, with three projects 
receiving increases totaling $450,000. Security events included 
15 failed login attempts and 2 permission escalations that 
required review and documentation.

Key Findings:
• Resource allocation activity increased 15% vs. previous month
• Security events decreased 8%
• Budget change frequency remained stable
• Anomaly detection rate: 0.4% (within normal range)

Recommendations:
• Review the 2 permission escalations for compliance
• Investigate failed login patterns
• Continue monitoring resource allocation trends
```

### CSV Export

CSV exports provide raw data for analysis in Excel or other tools.

#### Creating a CSV Export

1. Apply filters to select events
2. Click **Export** → **CSV**
3. Click **Generate CSV**
4. Download the file when ready

**CSV Columns:**
- ID
- Timestamp
- Event Type
- User ID
- Entity Type
- Entity ID
- Severity
- Category
- Risk Level
- Anomaly Score
- Is Anomaly
- Action Details (JSON)
- Tags (JSON)

### Scheduled Reports

Administrators can configure automatic report generation:

1. Navigate to **Settings** → **Scheduled Reports**
2. Click **New Scheduled Report**
3. Configure:
   - **Report Name**: "Weekly Security Review"
   - **Schedule**: Weekly on Monday at 9 AM
   - **Filters**: Severity = Critical or High
   - **Format**: PDF with summary
   - **Recipients**: security@example.com
4. Click **Save**

Reports are automatically generated and emailed on schedule.

### Export Best Practices

**For Executive Reports:**
- Include AI summary
- Focus on critical and high-risk events
- Add trend charts
- Use PDF format

**For Compliance Audits:**
- Export all events (no filters)
- Include full action details
- Use CSV for detailed analysis
- Retain for 7 years per regulations

**For Security Reviews:**
- Filter by Security Change category
- Include anomaly details
- Export weekly
- Review with security team

---

## Real-Time Dashboard

Monitor system activity and anomalies in real-time.

### Dashboard Overview

The dashboard displays:
- **Event Counts**: Total events, critical events, anomalies
- **Event Volume Chart**: 24-hour activity graph
- **Top Users**: Most active users
- **Top Event Types**: Most frequent events
- **Category Breakdown**: Events by category
- **Recent Anomalies**: Latest detected anomalies
- **System Health**: Performance metrics

### Understanding Dashboard Metrics

#### Event Counts
```
Total Events (24h): 1,247
Last Hour: 52
Critical Events: 12
Anomalies Detected: 5
```

**What it means:**
- System activity level
- Critical events requiring attention
- Anomaly detection rate

#### Event Volume Chart

Shows events per hour for the last 24 hours:
- **Peaks**: High activity periods
- **Valleys**: Low activity periods
- **Anomalies**: Marked with red dots

**Example Interpretation:**
```
Peak at 2 AM (85 events) - Unusual for off-hours
Valley at 3 PM (12 events) - Lower than typical business hours
```

#### Top Users

Shows most active users:
```
1. John Smith - 87 events
2. Jane Doe - 65 events
3. Bob Wilson - 54 events
```

**Click on a user** to see their activity timeline.

#### Top Event Types

Shows most frequent events:
```
1. User Login - 342 events
2. Resource Assignment - 156 events
3. Budget Change - 45 events
```

**Click on an event type** to filter timeline.

#### Category Breakdown

Shows events by AI-assigned category:
```
Security Change: 45 (15%)
Financial Impact: 23 (8%)
Resource Allocation: 178 (60%)
Risk Event: 34 (11%)
Compliance Action: 12 (4%)
```

**Click on a category** to view those events.

### Real-Time Updates

The dashboard updates automatically every 30 seconds:
- Event counts refresh
- Charts update with new data
- Anomaly list updates
- System health metrics refresh

**Live Indicator:**
🟢 Live - Updates every 30 seconds

### Anomaly Notifications

When a critical anomaly is detected:
1. **Toast notification** appears
2. **Anomaly count** updates
3. **Recent anomalies** list updates
4. **Red badge** appears on Anomalies tab

**Example Notification:**
```
🚨 Critical Anomaly Detected

Admin access granted to external user
Anomaly Score: 0.95
View Details →
```

### System Health Metrics

Monitor system performance:
```
Anomaly Detection: 245ms (Good)
Search Response: 1.85s (Good)
Last Model Training: Jan 10, 2024
```

**Status Indicators:**
- 🟢 **Good**: Within normal range
- 🟡 **Degraded**: Slower than usual
- 🔴 **Poor**: Performance issues

---

## Best Practices

### Daily Workflow

**Morning Review (5 minutes):**
1. Check dashboard for overnight activity
2. Review any critical anomalies
3. Verify no security events require action

**Weekly Review (15 minutes):**
1. Generate weekly summary report
2. Review all anomalies and provide feedback
3. Check for unusual patterns or trends
4. Export report for team review

**Monthly Review (30 minutes):**
1. Generate monthly executive summary
2. Review compliance-related events
3. Analyze trends and patterns
4. Update security policies if needed

### Security Best Practices

**Monitor These Events:**
- Failed login attempts (>3 from same user)
- Permission escalations (especially admin access)
- Off-hours activity (2 AM - 6 AM)
- External user access
- Bulk data exports

**Respond Quickly To:**
- Critical anomalies (score > 0.9)
- Multiple failed logins
- Unauthorized permission changes
- Unusual data access patterns

**Document Everything:**
- Anomaly investigations
- False positive justifications
- Security incident responses
- Compliance-related events

### Compliance Best Practices

**For FDA 21 CFR Part 11:**
- Export audit logs quarterly
- Verify hash chain integrity
- Document all access to audit logs
- Retain logs for 7 years

**For GDPR:**
- Export user data on request
- Document data access events
- Verify encryption at rest
- Maintain access logs

**For SOC 2:**
- Review security events weekly
- Document anomaly investigations
- Export monthly compliance reports
- Monitor access control changes

### Performance Tips

**Optimize Searches:**
- Use specific date ranges
- Apply filters before searching
- Limit result sets to what you need

**Efficient Exports:**
- Schedule large exports during off-peak hours
- Use filters to reduce export size
- Export incrementally (weekly vs. yearly)

**Dashboard Usage:**
- Keep dashboard open for real-time monitoring
- Use WebSocket connection (automatic)
- Refresh manually only if needed

---

## Troubleshooting: No events showing

If the Audit Trail (Timeline or Dashboard) shows no events, check the following.

### 1. Backend and API

- **Backend running:** The audit page loads events from the backend (`/api/audit/logs`). Ensure the backend is running (e.g. `./start-local.sh` or your usual backend process) and reachable from the frontend (e.g. `NEXT_PUBLIC_BACKEND_URL` or Next.js rewrites). The Next.js rewrites must send `/api/audit/*` to the backend’s `/api/audit/*` path so that the audit router receives the request.
- **No 401/403:** If you see "Authorization missing" or "Session expired", log in again. The audit endpoints require a valid Supabase session.

### 2. Permissions

- Your user needs **audit:read** (or equivalent) to see the Audit page. If you only get empty lists and no error, permissions are usually fine; missing permission typically returns 403.

### 3. Tenant / organization

- Events are filtered by **tenant/organization**. The backend shows only events where `tenant_id` matches your user’s `tenant_id` (or `organization_id`), or events with `tenant_id` = null for "default" tenants.
- If your JWT has a `tenant_id` (or `organization_id`) and no events were ever written with that tenant, the list will be empty.

### 4. Create events that appear in the Audit Trail

Events are written to the `audit_logs` table by various features. To see something in the Trail:

- **Use features that log to audit_logs:**
  - **Resources:** Create, update, or delete a resource (Resources page). These writes include `tenant_id` when available.
  - **Audit access:** Opening the Audit page and loading logs creates an "audit_access" event (so after the first load, a refresh may show that event).
  - **RBAC / Admin:** Role assignments and removals (if your backend writes them to `audit_logs` with the correct tenant).
  - **Batch insert (API):** You can POST audit events to the backend batch endpoint with your user’s `tenant_id` (see API docs) for testing.

- **Test events via API (for development):**  
  POST to the backend batch endpoint (e.g. `/api/audit/events/batch`) with a valid Bearer token and a body like:
  ```json
  [
    {
      "event_type": "test_event",
      "entity_type": "test",
      "severity": "info",
      "action_details": { "message": "Test audit entry" }
    }
  ]
  ```
  The backend adds `tenant_id` from the current user. Then reload the Audit Trail; the new events should appear (same tenant).

### 5. Database and migrations

- Ensure migrations have been applied so that the **audit_logs** table (and optional columns like `tenant_id`, `created_at`) exist. Relevant migrations include `023_ai_empowered_audit_trail.sql` and any later audit-related migrations.

### Summary

| Cause | What to do |
|-------|------------|
| Backend not running / not reachable | Start backend, check `NEXT_PUBLIC_BACKEND_URL` / rewrites |
| Not logged in / session expired | Log in again |
| No permission | Get `audit:read` (or equivalent) |
| No events for your tenant | Use features that write to `audit_logs` (Resources, Audit page load, RBAC) or insert test events via batch API with your tenant |
| Table missing / wrong schema | Run audit-related migrations |

---

## FAQ

### General Questions

**Q: Why don’t I see any events in the Audit Trail?**  
A: See [Troubleshooting: No events showing](#troubleshooting-no-events-showing). Typical causes: backend not reachable, no events written for your tenant, or missing migrations.

**Q: How far back can I search audit logs?**  
A: All audit logs are retained for 7 years. Logs older than 1 year are archived but remain searchable.

**Q: Can I delete or modify audit logs?**  
A: No. Audit logs are immutable (append-only) for compliance reasons. Once created, they cannot be modified or deleted.

**Q: How often are anomalies detected?**  
A: The anomaly detection system runs every hour, analyzing the last 24 hours of events.

**Q: Are my searches private?**  
A: Yes. All audit log access is logged (audit-of-audit), but your searches are only visible to administrators for security purposes.

### Anomaly Detection

**Q: Why was this flagged as an anomaly?**  
A: Click on the anomaly to see the explanation, which shows which features contributed to the score.

**Q: How do I reduce false positives?**  
A: Provide feedback on false positives. The system learns from your feedback and improves over time.

**Q: Can I adjust anomaly sensitivity?**  
A: Administrators can adjust the anomaly threshold (default: 0.7). Contact your admin if you're seeing too many or too few anomalies.

**Q: What happens when an anomaly is detected?**  
A: Critical anomalies trigger notifications via configured channels (email, Slack, Teams). All anomalies appear in the dashboard.

### Semantic Search

**Q: Why didn't my search return results?**  
A: Try being more specific with time periods and entities. The system searches based on semantic meaning, not exact keyword matching.

**Q: Can I search in other languages?**  
A: Currently, semantic search works best in English. Other languages may have limited accuracy.

**Q: How accurate is the AI response?**  
A: The AI synthesizes information from actual audit events. Always verify by checking the source references provided.

**Q: Can I save searches?**  
A: Not currently, but you can bookmark URLs with filter parameters applied.

### Exports

**Q: How long does export generation take?**  
A: Small exports (< 1,000 events): < 10 seconds  
Medium exports (1,000-10,000 events): 30-60 seconds  
Large exports (> 10,000 events): 2-5 minutes

**Q: What's the maximum export size?**  
A: PDF exports are limited to 50,000 events. CSV exports can handle up to 1 million events.

**Q: Can I schedule automatic exports?**  
A: Yes, administrators can configure scheduled reports. Contact your admin to set this up.

**Q: Are exports encrypted?**  
A: Yes, all exports are encrypted in transit (HTTPS) and can be encrypted at rest if needed.

### Permissions

**Q: I can't access the audit trail. Why?**  
A: You need the `audit:read` permission. Contact your administrator to request access.

**Q: I can't export reports. Why?**  
A: You need the `audit:export` permission. Contact your administrator to request access.

**Q: Can I see other users' audit logs?**  
A: Yes, if you have `audit:read` permission, you can see all audit logs for your organization (tenant). Logs are isolated by tenant for security.

### Technical Questions

**Q: What AI models are used?**  
A: - Anomaly Detection: Isolation Forest (scikit-learn)  
- Classification: Random Forest and Gradient Boosting (scikit-learn)  
- Semantic Search: OpenAI GPT-4 with text-embedding-ada-002  
- Summaries: OpenAI GPT-4

**Q: How is my data secured?**  
A: - Encryption at rest (AES-256)  
- Encryption in transit (TLS 1.3)  
- Hash chain for tamper detection  
- Row-level security for tenant isolation  
- Access logging (audit-of-audit)

**Q: What's the data retention policy?**  
A: Audit logs are retained for 7 years per compliance requirements. After 1 year, logs are moved to cold storage but remain accessible.

**Q: Can I integrate with external tools?**  
A: Yes, administrators can configure integrations with Slack, Microsoft Teams, Zapier, and email. Contact your admin to set this up.

---

## Getting Help

### Support Resources

- **Documentation**: https://docs.yourplatform.com/audit
- **Video Tutorials**: https://docs.yourplatform.com/audit/videos
- **API Reference**: https://docs.yourplatform.com/audit/api
- **Status Page**: https://status.yourplatform.com

### Contact Support

- **Email**: support@yourplatform.com
- **Chat**: Available in-app (bottom right corner)
- **Phone**: 1-800-XXX-XXXX (Business hours: 9 AM - 5 PM EST)

### Feedback

We'd love to hear your feedback:
- **Feature Requests**: feedback@yourplatform.com
- **Bug Reports**: bugs@yourplatform.com
- **In-App Feedback**: Click the feedback button in the audit dashboard

---

## Appendix: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + K` | Open search |
| `Ctrl/Cmd + F` | Open filters |
| `Ctrl/Cmd + E` | Export current view |
| `Ctrl/Cmd + R` | Refresh dashboard |
| `Esc` | Close modal/panel |
| `?` | Show keyboard shortcuts |

---

**Last Updated:** January 2024  
**Version:** 1.0
