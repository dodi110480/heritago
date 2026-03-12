# API Conventions

This document defines the API conventions for Heritago.

## Base Rules

- **All resource endpoints are tree-scoped**  
  Use `/api/tree/:tree/...` for any data that belongs to a specific tree.

## Unscoped Endpoints

Only allowed for:
- Auth (`/api/auth/*`)
- System (`/api/health`, `/api/version`)
- Tree Management (collection routes like `/api/trees`)

Resource endpoints should not be unscoped.

## Tree Scope

`/api/tree/:tree/...`

`:tree` can be:
- a tree **name** (preferred, slug), or
- a tree **UUID** (fallback for API clients).

Tree‑scoped routes must validate access permissions.

## Auth

- Auth is handled exclusively via **JWT in HttpOnly + Secure + SameSite=Strict cookies**.
- Cookie name: `auth_token` (access token, **15 minutes**)
- Additional cookie: `refresh_token` (valid for **7 days**, only for `/api/auth/refresh`)
- Frontend must send `withCredentials: true` / `credentials: 'include'` on API requests.

Endpoints:
- `POST /api/auth/login`
- `POST /api/auth/register`
- `POST /api/auth/refresh`
- `POST /api/auth/logout`
- `GET /api/auth/me`

## Response Format

### Success

**Success (from v2.0 onward)**  
Always:

```json
{
  "success": true,
  "data": {}
}
```

`data` can be any JSON object or array. Legacy fields like `tree` or `person`
are tolerated until v2.0 and then removed.

### Error

All errors must follow the unified error format:

```json
{
  "success": false,
  "message": "Human readable error",
  "code": "SOME_ERROR_CODE"
}
```

**Notes**
- `code` is required for predictable frontend behavior.
- `message` is user‑facing (German UI).
- Use consistent HTTP status codes:
  - `400` validation errors
  - `401` unauthenticated
  - `403` unauthorized
  - `404` not found
  - `409` conflict (e.g., duplicate tree name)
  - `500` unexpected errors

## Examples

### Create Tree

`POST /api/trees`

```json
{
  "name": "family-sperlich",
  "title": "Familie Sperlich",
  "firstName": "Dominik",
  "lastName": "Sperlich",
  "gender": "M",
  "birthDate": "11 APR 1980"
}
```

Success:

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "name": "family-sperlich",
    "title": "Familie Sperlich"
  }
}
```

Error:

```json
{
  "success": false,
  "message": "Tree name already exists.",
  "code": "TREE_NAME_CONFLICT"
}
```

## Migration Guideline

Legacy endpoints returning non‑standard responses should be migrated in this order:

1. Add `code` fields to all error responses.
2. Wrap success payloads into `data`.
3. Remove unscoped resource routes.

## Security Notes

- Logout should clear both cookies; refresh tokens may be blacklisted server‑side (e.g. Redis).
- All endpoints should be rate‑limited.

## Versioning

Either:
- Use `/api/v1/...` prefixes, or
- Keep `/api/...` and expose API semver via response headers.
