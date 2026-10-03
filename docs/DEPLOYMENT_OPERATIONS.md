# PASS — Deployment & Operations

## 1. Deployment principle

The first implementation includes deployment. The product is not considered complete until it is accessible from a real deployed environment and the critical flows have been exercised there.

## 2. Environments

### Local

Used for feature development and mocked provider tests.

### Preview

A deployable environment for branch/iteration review.

### Production

Stable public environment for the demo and submission.

## 3. Hosting model

Recommended:

```text
Vercel
  -> PASS web

Backend host
  -> API
  -> worker

Managed PostgreSQL
  -> database
```

Vercel's current preview model gives branches/PRs individual deployment URLs, which we should use for iterative review.

## 4. Required production components

- web application;
- API;
- worker/job runner;
- PostgreSQL;
- HTTPS/custom domain if available;
- monitoring/logging;
- environment configuration;
- extension package.

## 5. Environment variables

### Web

```text
NEXT_PUBLIC_APP_URL
NEXT_PUBLIC_API_URL
NEXT_PUBLIC_ENV
```

### API

```text
DATABASE_URL
APP_URL
CORS_ORIGINS
SESSION_SECRET
X_CLIENT_ID
X_CLIENT_SECRET
X_REDIRECT_URI
ETHOS_API_BASE_URL
HYPERLIQUID_INFO_URL
HYPERLIQUID_EXCHANGE_URL
ENCRYPTION_KEY
LOG_LEVEL
```

Exact variables may change with implementation. Never place secrets under `NEXT_PUBLIC_*`.

## 6. Secrets

Use host-managed secret storage/environment variables.

Separate preview and production credentials.

Never commit `.env` files containing secrets.

## 7. Database migrations

- migration files are version-controlled;
- migrations run deterministically;
- destructive migrations require explicit review;
- backup before production destructive migrations.

## 8. Deployment pipeline

```text
push branch
 -> CI
 -> lint/typecheck
 -> unit tests
 -> integration tests
 -> build
 -> preview deployment
 -> manual/automated smoke tests
 -> merge main
 -> production deployment
 -> production smoke tests
```

## 9. One-shot build deployment

The coding agent must complete one full deployment after the first implementation.

The deployment report must include:

- production URL;
- API URL;
- extension artifact path;
- commit SHA;
- test summary;
- known issues;
- external integrations that were live vs mocked.

## 10. Observability

Provide:

- `/health` endpoint;
- structured request logs;
- provider error counts;
- execution failure events;
- job failures;
- deployment status.

## 11. Background workers

Jobs should be safe to retry.

Every job should have:

- stable job identifier;
- retry limit;
- exponential backoff where appropriate;
- dead-letter/failed state or equivalent;
- structured logs.

## 12. Rollback

Every deployment must be reversible.

Do not perform irreversible DB schema changes without a migration/rollback strategy.

## 13. Iteration workflow

```text
Observe deployed issue
 -> reproduce locally
 -> fix
 -> tests
 -> preview deploy
 -> inspect
 -> production deploy
 -> smoke test
```

## 14. Extension delivery

The extension is built as a separate artifact from the web deployment.

Development testing can use Chrome's unpacked-extension workflow.

Chrome Web Store publication is separate from Vercel deployment. For hackathon/demo purposes, an unpacked extension build can be documented if store publication is not required.

## 15. Production readiness gate

Before calling PASS complete:

- no known critical security issue;
- critical web path works;
- execution path is tested;
- API is healthy;
- database migration state is known;
- extension loads in Chrome;
- production URLs are documented;
- secrets are not exposed.
