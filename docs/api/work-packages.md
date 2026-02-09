# Work Packages API

Work packages are deliverable units under a project, used for planning, budgeting, and earned value (e.g. in Project Controls).

## Base path

All endpoints are under the projects router: `/projects/{project_id}/work-packages`.

## Authentication

Requires a valid JWT (e.g. from Supabase). Project access is enforced by the backend.

---

## Endpoints

### List work packages

**Endpoint:** `GET /projects/{project_id}/work-packages`

**Query:** `active_only` (boolean, default `true`) – when true, only active work packages are returned.

**Response:** Array of work package objects (id, project_id, name, budget, actual_cost, earned_value, percent_complete, start_date, end_date, responsible_manager, parent_package_id, etc.).

### Get one work package

**Endpoint:** `GET /projects/{project_id}/work-packages/{wp_id}`

**Response:** Single work package object or `404` if not found.

### Create work package

**Endpoint:** `POST /projects/{project_id}/work-packages` (201 on success)

**Body:** Work package payload; `project_id` in body must match the path. Fields include name, budget, start_date, end_date, responsible_manager, parent_package_id, etc. (see `backend/models/project_controls.py` – `WorkPackageCreate`).

### Update work package

**Endpoint:** `PUT /projects/{project_id}/work-packages/{wp_id}`

**Body:** Partial work package (e.g. name, budget, percent_complete, actual_cost, earned_value, start_date, end_date, responsible_manager). Only provided fields are updated.

### Delete work package

**Endpoint:** `DELETE /projects/{project_id}/work-packages/{wp_id}`

Soft-delete (or hard delete depending on service implementation). Returns 204 or 200.

---

## Frontend / Next.js

The app exposes these via Next.js API routes under `/api/projects/[projectId]/work-packages` and `/api/projects/[projectId]/work-packages/[wpId]`, which proxy to the backend. See `lib/work-package-queries.ts` and `lib/project-controls-api.ts` for client usage.

## Backend

- **Router:** `backend/routers/work_packages.py`
- **Service:** `backend/services/work_package_service.py`
- **Models:** `backend/models/project_controls.py` (WorkPackageCreate, WorkPackageUpdate, WorkPackageResponse)
