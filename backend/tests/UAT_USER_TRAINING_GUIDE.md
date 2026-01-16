# User Acceptance Testing - Training Guide
## Roche Construction PPM Features

**Version:** 1.0  
**Date:** January 2026  
**Audience:** UAT Testers, Project Managers, Stakeholders

---

## Table of Contents

1. [Introduction](#introduction)
2. [Feature Overview](#feature-overview)
3. [Getting Started](#getting-started)
4. [Feature Walkthroughs](#feature-walkthroughs)
5. [Common Workflows](#common-workflows)
6. [Troubleshooting](#troubleshooting)
7. [Known Limitations](#known-limitations)
8. [Feedback Process](#feedback-process)

---

## Introduction

This guide provides comprehensive training materials for user acceptance testing of the six new Roche Construction PPM features:

1. **Shareable Project URLs** - Secure external project sharing
2. **Monte Carlo Risk Simulations** - Probabilistic risk analysis
3. **What-If Scenario Analysis** - Project parameter modeling
4. **Integrated Change Management** - Change request workflows
5. **SAP PO Breakdown Management** - Purchase order hierarchy tracking
6. **Google Suite Report Generation** - Automated report creation

### Training Objectives

By the end of this training, you will be able to:
- Navigate and use all six new features
- Understand the business value of each feature
- Identify and report issues during UAT
- Provide constructive feedback for improvements

---

## Feature Overview

### 1. Shareable Project URLs

**Purpose:** Share project information securely with external stakeholders without requiring full system access.

**Key Benefits:**
- Time-limited access control
- Granular permission settings
- Audit trail of all access
- One-click URL generation

**Use Cases:**
- Sharing project status with clients
- Providing vendors with relevant project information
- Board presentations with real-time data

### 2. Monte Carlo Risk Simulations

**Purpose:** Perform probabilistic analysis on project risks to understand potential cost and schedule impacts.

**Key Benefits:**
- Statistical confidence intervals (P10, P50, P90)
- 10,000+ iteration accuracy
- Historical comparison tracking
- Automatic cache invalidation

**Use Cases:**
- Budget contingency planning
- Schedule risk assessment
- Executive decision support

### 3. What-If Scenario Analysis

**Purpose:** Model the impact of project parameter changes before making decisions.

**Key Benefits:**
- Real-time impact calculations
- Side-by-side scenario comparison
- Timeline, cost, and resource analysis
- Scenario persistence for collaboration

**Use Cases:**
- Resource allocation decisions
- Schedule acceleration analysis
- Scope reduction evaluation

### 4. Integrated Change Management

**Purpose:** Manage project changes with structured workflows and full traceability.

**Key Benefits:**
- Automated approval routing
- PO linkage and financial tracking
- Implementation progress monitoring
- Complete audit trails

**Use Cases:**
- Scope change requests
- Budget modification approvals
- Emergency change processing

### 5. SAP PO Breakdown Management

**Purpose:** Import and manage hierarchical SAP Purchase Order structures.

**Key Benefits:**
- CSV import with automatic hierarchy detection
- Tree-view navigation
- Cost rollup calculations
- Version history tracking

**Use Cases:**
- Budget allocation tracking
- Variance analysis
- Financial reporting

### 6. Google Suite Report Generation

**Purpose:** Generate professional Google Slides presentations from project data.

**Key Benefits:**
- Template-based generation
- Automatic chart creation
- Google Drive integration
- Customizable data mappings

**Use Cases:**
- Executive briefings
- Stakeholder updates
- Monthly status reports

---

## Getting Started

### Prerequisites

1. **System Access:** Ensure you have appropriate user credentials
2. **Test Data:** UAT test data has been pre-loaded into the system
3. **Browser:** Use Chrome, Firefox, or Edge (latest versions)
4. **Google Account:** Required for Google Suite report generation feature

### Login Process

1. Navigate to the PPM system URL
2. Enter your UAT credentials
3. Accept the UAT terms and conditions
4. You will be directed to the dashboard

### Test Environment

- **Environment:** UAT Testing Environment
- **Data:** Sample data only - safe to experiment
- **Reset:** Test data can be reset daily if needed

---

## Feature Walkthroughs

### Walkthrough 1: Creating a Shareable Project URL

**Objective:** Generate a secure shareable URL for external stakeholder access

**Steps:**

1. Navigate to the project dashboard
2. Select "Construction Project Alpha" from the project list
3. Click the "Share" button in the top-right corner
4. Configure permissions:
   - ✅ Can view basic info
   - ✅ Can view timeline
   - ✅ Can view risks
   - ❌ Can view financial (uncheck for external users)
   - ❌ Can view resources
5. Set expiration date (default: 30 days)
6. Click "Generate Shareable URL"
7. Copy the URL using the one-click copy button
8. Test the URL in an incognito browser window

**Expected Results:**
- URL is generated within 2 seconds
- URL is cryptographically secure (long, random token)
- Access is restricted to selected permissions
- Audit log entry is created

**Success Criteria:**
- ✅ URL generation completes successfully
- ✅ Permission restrictions are enforced
- ✅ URL expires after set date
- ✅ Access attempts are logged

---

### Walkthrough 2: Running a Monte Carlo Simulation

**Objective:** Perform probabilistic risk analysis on project costs and schedule

**Steps:**

1. Navigate to the "Risk Management" page
2. Select "Construction Project Alpha"
3. Click "Run Monte Carlo Simulation"
4. Configure simulation:
   - Iterations: 10,000 (default)
   - Confidence levels: P10, P50, P90
   - Include cost analysis: ✅
   - Include schedule analysis: ✅
5. Click "Run Simulation"
6. Wait for completion (should be < 30 seconds)
7. Review results:
   - Cost percentiles (P10, P50, P90)
   - Schedule percentiles
   - Probability distribution charts
   - Statistical summary

**Expected Results:**
- Simulation completes within 30 seconds
- Results show realistic cost and schedule distributions
- Charts are clear and interpretable
- Results are cached for future access

**Success Criteria:**
- ✅ Simulation completes within performance requirements
- ✅ Statistical results are mathematically correct
- ✅ Charts render properly
- ✅ Results can be compared with historical simulations

---

### Walkthrough 3: Creating a What-If Scenario

**Objective:** Model the impact of adding resources to accelerate the schedule

**Steps:**

1. Navigate to the main dashboard
2. Find the "What-If Scenarios" panel
3. Click "Create New Scenario"
4. Enter scenario details:
   - Name: "Accelerated Schedule - Add 5 Workers"
   - Description: "Analyze impact of adding 5 additional workers"
5. Configure parameter changes:
   - Additional resources: 5
   - Resource cost increase: $150,000
   - Target schedule reduction: 30 days
6. Click "Calculate Impact"
7. Review impact analysis:
   - Timeline impact: -30 days
   - Cost impact: +$150,000
   - Resource utilization: +20%
   - ROI analysis
8. Compare with baseline scenario
9. Save scenario for future reference

**Expected Results:**
- Impact calculations complete in real-time
- All three impact areas (timeline, cost, resource) are calculated
- Comparison view shows clear deltas
- Scenario is saved and retrievable

**Success Criteria:**
- ✅ Impact calculations are deterministic
- ✅ Comparison view is accurate
- ✅ Scenario can be edited and recalculated
- ✅ Multiple scenarios can be compared side-by-side

---

### Walkthrough 4: Submitting a Change Request

**Objective:** Create and submit a change request through the approval workflow

**Steps:**

1. Navigate to the "Changes" page
2. Click "Create Change Request"
3. Fill in change details:
   - Title: "Emergency Safety System Upgrade"
   - Description: "Install enhanced emergency safety systems"
   - Change type: Safety
   - Priority: High
   - Estimated cost impact: $250,000
   - Estimated schedule impact: 21 days
   - Justification: "Required for regulatory compliance"
4. Click "Save as Draft"
5. Review and click "Submit for Approval"
6. System determines approval workflow automatically
7. Track approval progress in the workflow visualization
8. (As approver) Review and approve the change request
9. Link to relevant PO breakdowns
10. Start implementation tracking

**Expected Results:**
- Change request is created successfully
- Appropriate approval workflow is triggered
- Notifications are sent to approvers
- Implementation can be tracked

**Success Criteria:**
- ✅ Change request workflow completes end-to-end
- ✅ Approvals are routed correctly
- ✅ PO linkage works properly
- ✅ Audit trail is complete

---

### Walkthrough 5: Importing SAP PO Breakdown

**Objective:** Import a SAP Purchase Order CSV file and navigate the hierarchy

**Steps:**

1. Navigate to the "Financials" page
2. Find the "PO Breakdown" section
3. Click "Import SAP CSV"
4. Select the sample CSV file: `sample_po_breakdown.csv`
5. Review import preview:
   - Total records: 15
   - Hierarchy levels: 3
   - Total planned amount: $4,300,000
6. Click "Confirm Import"
7. Wait for import to complete (progress bar shown)
8. Navigate the tree view:
   - Expand "Construction Materials"
   - View child items (Steel, Concrete, Rebar)
   - Check cost rollups
9. Update actual costs for a line item
10. Verify variance calculations

**Expected Results:**
- CSV import completes successfully
- Hierarchy is correctly detected
- Tree view is navigable
- Cost rollups are accurate

**Success Criteria:**
- ✅ Import handles 10MB files efficiently
- ✅ Hierarchy integrity is maintained
- ✅ Variance calculations are correct
- ✅ Version history is tracked

---

### Walkthrough 6: Generating a Google Slides Report

**Objective:** Create an executive status report in Google Slides

**Steps:**

1. Navigate to the "Reports" page
2. Click "Generate Google Suite Report"
3. Select template: "Executive Project Status Report"
4. Configure report:
   - Project: Construction Project Alpha
   - Date range: Last 30 days
   - Include charts: ✅
   - Include risk details: ✅
   - Include financial breakdown: ✅
5. Click "Generate Report"
6. Wait for generation (should be < 60 seconds)
7. Progress indicator shows:
   - Template loading
   - Data collection
   - Chart generation
   - Upload to Google Drive
8. Click the Google Drive link to view report
9. Verify report contents:
   - All data fields populated
   - Charts rendered correctly
   - Formatting is professional

**Expected Results:**
- Report generates within 60 seconds
- All data elements are included
- Charts are clear and accurate
- Report is accessible in Google Drive

**Success Criteria:**
- ✅ Report generation completes successfully
- ✅ All template variables are populated
- ✅ Charts match project data
- ✅ Google Drive link is valid

---

## Common Workflows

### Workflow 1: Complete Project Risk Assessment

**Scenario:** You need to present a comprehensive risk assessment to executives

**Steps:**
1. Run Monte Carlo simulation on project risks
2. Create what-if scenarios for risk mitigation options
3. Submit change requests for approved mitigation strategies
4. Generate executive risk assessment report
5. Create shareable URL for board members

**Time Required:** 30-45 minutes

---

### Workflow 2: Budget Variance Analysis

**Scenario:** Monthly budget review requires detailed variance analysis

**Steps:**
1. Import latest SAP PO breakdown data
2. Review variance by category
3. Create change requests for budget adjustments
4. Run what-if scenarios for cost reduction options
5. Generate detailed financial status report

**Time Required:** 20-30 minutes

---

### Workflow 3: Schedule Acceleration Decision

**Scenario:** Client requests earlier completion date

**Steps:**
1. Create what-if scenario for accelerated schedule
2. Run Monte Carlo simulation with new parameters
3. Analyze cost and resource impacts
4. Submit change request if approved
5. Update PO breakdowns with additional costs
6. Generate decision support report for stakeholders

**Time Required:** 45-60 minutes

---

## Troubleshooting

### Common Issues and Solutions

#### Issue 1: Shareable URL Not Working

**Symptoms:** URL returns "Invalid or expired token" error

**Solutions:**
1. Check if URL has expired (check expiration date)
2. Verify URL was copied completely (no truncation)
3. Check if URL was revoked by administrator
4. Try generating a new URL

---

#### Issue 2: Monte Carlo Simulation Timeout

**Symptoms:** Simulation exceeds 30 second limit

**Solutions:**
1. Reduce number of iterations (try 5,000 instead of 10,000)
2. Check if there are too many risks (>50 risks may slow down)
3. Clear browser cache and retry
4. Contact support if issue persists

---

#### Issue 3: PO Import Fails

**Symptoms:** CSV import shows errors or fails to complete

**Solutions:**
1. Verify CSV format matches template
2. Check for special characters in data
3. Ensure parent references are valid
4. Try importing smaller batches
5. Review error log for specific issues

---

#### Issue 4: Report Generation Fails

**Symptoms:** Google Slides report generation fails or times out

**Solutions:**
1. Verify Google account is connected
2. Check OAuth token hasn't expired
3. Ensure template is still accessible
4. Try with smaller date range
5. Check Google Drive storage space

---

## Known Limitations

### Current Limitations

1. **Monte Carlo Simulations**
   - Maximum 50 risks per simulation
   - Correlation matrix limited to 10x10
   - Cache expires after 24 hours

2. **What-If Scenarios**
   - Maximum 10 active scenarios per project
   - Real-time updates limited to 5 concurrent users
   - Historical scenarios archived after 90 days

3. **Change Management**
   - Maximum 3 approval levels per workflow
   - Emergency changes require special permissions
   - PO linkage limited to 10 POs per change

4. **PO Breakdown**
   - CSV import limited to 10MB files
   - Maximum hierarchy depth of 5 levels
   - Custom fields limited to 20 per breakdown

5. **Google Suite Reports**
   - Template size limited to 50MB
   - Maximum 20 charts per report
   - Generation queue limited to 5 concurrent reports

6. **Shareable URLs**
   - Maximum 50 active URLs per project
   - Minimum expiration time: 1 hour
   - Maximum expiration time: 90 days

### Workarounds

**For large PO imports:**
- Split CSV into multiple smaller files
- Import in batches during off-peak hours
- Use custom breakdown for complex hierarchies

**For complex simulations:**
- Group related risks into categories
- Run separate simulations for different risk types
- Use scenario analysis for detailed modeling

**For report generation:**
- Use simpler templates for faster generation
- Generate reports during off-peak hours
- Cache frequently used report configurations

---

## Feedback Process

### How to Provide Feedback

1. **Bug Reports:**
   - Use the "Report Issue" button in the system
   - Include screenshots and steps to reproduce
   - Specify severity: Critical, High, Medium, Low

2. **Feature Requests:**
   - Submit via the feedback form
   - Describe the business need
   - Provide examples of desired functionality

3. **Usability Feedback:**
   - Complete the UAT survey after each session
   - Note any confusing workflows
   - Suggest UI/UX improvements

### Feedback Categories

- **Critical:** System crashes, data loss, security issues
- **High:** Feature doesn't work as expected, major usability issues
- **Medium:** Minor bugs, performance issues, missing features
- **Low:** Cosmetic issues, nice-to-have features

### Response Times

- Critical issues: 4 hours
- High priority: 24 hours
- Medium priority: 3 business days
- Low priority: 1 week

---

## Additional Resources

### Documentation
- API Documentation: `/docs/api`
- User Guide: `/docs/user-guide`
- Video Tutorials: `/docs/videos`

### Support
- Email: uat-support@example.com
- Slack Channel: #uat-roche-ppm
- Office Hours: Monday-Friday, 9 AM - 5 PM EST

### Training Sessions
- Weekly Q&A: Thursdays at 2 PM EST
- One-on-one training: By appointment
- Recorded sessions: Available on demand

---

## Conclusion

Thank you for participating in the UAT process! Your feedback is crucial for ensuring these features meet the needs of Roche Construction projects.

**Remember:**
- Take your time exploring each feature
- Document any issues you encounter
- Provide constructive feedback
- Ask questions during office hours

**UAT Success Criteria:**
- All critical and high-priority bugs resolved
- 90% of test scenarios pass
- Positive feedback from majority of testers
- Performance requirements met

---

**Document Version:** 1.0  
**Last Updated:** January 15, 2026  
**Next Review:** February 1, 2026
