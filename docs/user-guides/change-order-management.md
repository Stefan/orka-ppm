# Change Order Management User Guide

## Overview

Change Orders extend the Change Management system with formal construction/engineering change order processing. Use them when you need documented cost impact analysis, multi-level approval workflows, and contract compliance tracking.

## Accessing Change Orders

1. Go to **Change Management** in the main navigation
2. Click **Change Orders**
3. Select a project to manage its change orders

## Creating a Change Order

1. On the project's Change Orders dashboard, click **New Change Order**
2. **Step 1 – Basic Information:**
   - Title (min 5 characters)
   - Description and justification
   - Category (Owner Directed, Design Change, Field Condition, Regulatory)
   - Source (Owner, Designer, Contractor, Regulatory Agency)
   - Original contract value and schedule impact days
3. **Step 2 – Line Items:**
   - Add line items with description, trade, quantity, unit rate
   - Specify cost category (Labor, Material, Equipment, etc.)
   - Markup, overhead, and contingency percentages
4. Click **Create Change Order**

## Change Order Statuses

- **Draft** – Editable, not yet submitted
- **Submitted** – Awaiting review
- **Under Review** – In approval workflow
- **Approved** – Fully approved
- **Rejected** – Rejected by an approver
- **Implemented** – Work completed

## Cost Impact

The system calculates proposed cost impact from line items, including markups and overhead. Cost impact analysis can be created and viewed per change order. Scenario analysis (optimistic, most likely, pessimistic) is available for planning.

## Approval Workflows

When a change order is submitted, an approval workflow can be initiated. Approvers are determined by project roles and authorization limits. Pending approvals appear in the approver's queue. Approvers can approve, reject, or add conditions.

## Permissions

- **change_read** – View change orders and analytics
- **change_create** – Create change orders
- **change_update** – Edit drafts, submit
- **change_approve** – Approve or reject change orders

Contact your administrator if you need access.
