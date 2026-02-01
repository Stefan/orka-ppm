# Feature Toggles API

**Last Updated:** February 2026  
**Spec:** `.kiro/specs/feature-toggle-system/`

## Overview

Backend API for global and organization-scoped feature flags. Used by the frontend context and admin UI at `/admin/feature-toggles`.

## Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/api/features` | Bearer | List merged flags for the user's org. `?list_all=true` for admin (unmerged). |
| POST | `/api/features` | Admin | Create a new flag. |
| PUT | `/api/features/{name}` | Admin | Update a flag (name immutable). Optional `?organization_id=`. |
| DELETE | `/api/features/{name}` | Admin | Delete a flag. Optional `?organization_id=`. |

## Auth

- **Read:** Any authenticated user (JWT). Organization ID from token for merge.
- **Write:** Admin only (`require_admin`).

## Realtime

Broadcasts on channel `feature_flags_changes`, event `flag_change`, with `action` (created/updated/deleted) and `flag` payload.

## Database

Table `feature_toggles`: `id`, `name`, `enabled`, `organization_id` (nullable), `description`, `created_at`, `updated_at`. RLS: read for authenticated, write for admin.
