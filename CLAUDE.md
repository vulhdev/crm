# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A lightweight CRM platform using **Google Sheets as the primary database**, structured as a **Turborepo monorepo**.

## Monorepo Structure

```
root/
├── apps/
│   ├── web/        # Vite + React/Vue frontend
│   └── api/        # NestJS backend
└── packages/
    └── types/      # Shared TypeScript interfaces (used by both apps)
```

Initialize with: `npx create-turbo@latest`

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Monorepo | Turborepo |
| Frontend | Vite, React or Vue, Tailwind CSS, shadcn/ui |
| Backend | Node.js, NestJS |
| Auth | `@nestjs/passport` + `passport-google-oauth20`, JWT (`@nestjs/jwt`) |
| Data | Google Sheets API v4 via `googleapis` (Service Account) |

## Architecture

- The **Service Account** JSON key is used exclusively by the backend (`apps/api`) for Google Sheets access — end users never touch Sheets directly.
- Users authenticate via **Google OAuth20**; the backend issues a **JWT** which the frontend stores and attaches as a `Bearer` token on all subsequent API requests.
- The `packages/types` shared package holds TypeScript interfaces consumed by both `apps/web` and `apps/api`.

## Google Sheet Schema

First row is headers: `id | first_name | last_name | email | phone | company | status | last_contact_date | notes | created_at`

- `status` enum: `Lead | Active | Churned | Archived`
- No hard deletes — set `status = Archived` or move to an Archived sheet tab.

## Backend API Routes

| Method | Path | Action |
|--------|------|--------|
| GET | `/auth/google` | Initiate OAuth flow |
| GET | `/auth/google/callback` | OAuth callback, issues JWT |
| GET | `/customers` | Read all rows from Sheet (`Sheet1!A:J`) |
| POST | `/customers` | Append new row |
| PATCH | `/customers/:id` | Find row by `id` column, update range |

All `/customers` routes are protected by a JWT Auth Guard.

## Key Implementation Notes

- `SheetsService` in the API wraps all `googleapis` calls; the `CustomersController` delegates to it.
- Client-side sorting and filtering are applied on the frontend after fetching the full list.
- Frontend must handle the OAuth redirect, extract the JWT from the response, and persist it (e.g., localStorage or a secure cookie).

## Environment Variables

Must be in `.env` / `.env.local`, never committed:
- `GOOGLE_SERVICE_ACCOUNT_KEY` / `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SHEET_ID`
- `JWT_SECRET`
- `GOOGLE_OAUTH_CLIENT_ID` / `GOOGLE_OAUTH_CLIENT_SECRET`

## Full Specification

[.specifications/crm_specification.md](.specifications/crm_specification.md)
