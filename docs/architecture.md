# Architecture

This document describes how the simplified Battery Passport platform is put together and why.

## Overview

```
                        ┌──────────────────────────────┐
  Browser  ───────────► │ web (Next.js, :3000)         │
                        │ httpOnly session cookie,     │
                        │ server-side API forwarding   │
                        └──────┬──────────┬────────────┘
                               │ HTTP     │ HTTP
            ┌──────────────────┘          └──────────────────┐
            ▼                                                ▼
 ┌──────────────────────┐   HTTP: GET /api/auth/me  ┌──────────────────────┐
 │ passport-service     │ ────────────────────────► │ auth-service         │
 │ :4002                │ ◄──── document-service ── │ :4001                │
 └───┬──────────────┬───┘      (also verifies)      └──────────┬───────────┘
     │              │                                          │
     │ Mongoose     │ KafkaJS producer                         │ Mongoose
     ▼              ▼                                          ▼
 passport_db   topic: battery-passport-events              auth_db
                    │
                    │ KafkaJS consumer (group: notification-service)
                    ▼
        ┌─────────────────────────┐
        │ notification-service    │ ──► Winston log (default)
        │ :4004 (health only)     │ ──► SMTP via Nodemailer (optional)
        └─────────────────────────┘

 ┌──────────────────────┐  AWS SDK v3   ┌──────────────────────────────────┐
 │ document-service     │ ────────────► │ AWS S3 (LocalStack locally)      │
 │ :4003                │               │ private bucket, pre-signed GETs  │
 └───┬──────────────────┘               └──────────────────────────────────┘
     │ Mongoose           HTTP: GET /api/passports/:id (passport existence check)
     ▼
 document_db
```

## Services and data ownership

| Service              | Owns                                 | Database      | Collection  |
| -------------------- | ------------------------------------ | ------------- | ----------- |
| auth-service         | users, password hashes, JWT issuing  | `auth_db`     | `users`     |
| passport-service     | battery passports                    | `passport_db` | `passports` |
| document-service     | document metadata (files live in S3) | `document_db` | `documents` |
| notification-service | nothing persistent                   | –             | –           |

Each service owns its data and is the only process that reads or writes it. Other services
reach that data through the owning service's HTTP API, never through the database. This keeps
schemas free to evolve independently, keeps authorization logic in one place per resource and
allows each service to be deployed, scaled and backed up on its own. Cross-service references
(`createdBy`, `uploadedBy`, `passportId`) are stored as plain string ids, not database
references.

## Synchronous communication (HTTP)

- **Token verification.** The passport and document services do not know the JWT secret. For
  each request they call `GET /api/auth/me` on the auth service with the caller's bearer token.
  The auth service verifies the signature, issuer, audience and expiry, then re-reads the user so
  that deleted accounts or changed roles take effect immediately. The returned
  `{ id, email, role }` is attached to `req.user` and checked by `requireRole(...)`.
- **Passport existence.** Before linking a document to a passport, the document service calls
  `GET /api/passports/:id` on the passport service, forwarding the caller's token.
- All internal URLs come from environment variables (`AUTH_SERVICE_URL`,
  `PASSPORT_SERVICE_URL`); requests have timeouts and propagate `x-request-id`, so one id can be
  followed through the logs of every service a request touches.
- Failures map to explicit status codes: an unreachable dependency is `503`, an unexpected
  upstream response is `502`.

## Asynchronous communication (Kafka)

- The passport service publishes `passport.created`, `passport.updated` and
  `passport.deleted` to a single topic, `battery-passport-events` (3 partitions). Consumers route
  on the `eventType` field.
- Messages are keyed by `passportId`, so all events for one passport go to the same partition and
  are consumed in order.
- The producer is idempotent and waits for all in-sync replicas (`acks: -1`).
- Events are published after the MongoDB write commits. If publishing fails, the error is logged
  with the full event context and the API call still succeeds; the passport is not rolled back.
  A transactional outbox would make delivery guaranteed and is the natural next step for
  production.
- The notification service consumes with its own consumer group, validates every message
  against the shared Zod event schema, skips malformed messages (logging them) so one bad record
  cannot block a partition, and ignores redelivered events with an already-seen `eventId`.
- Both producer and consumer create the topic idempotently on start-up, so the start-up order
  does not matter.

## File storage (S3)

- Files are written with the AWS SDK v3 (`@aws-sdk/client-s3`) to a private bucket, with
  server-side encryption (`AES256`). Object keys are
  `documents/{passportId}/{uuid}-{sanitizedFileName}` (`unassigned` when no passport is linked);
  the user-supplied name is reduced to `[A-Za-z0-9._-]` and never used as-is.
- Downloads use pre-signed `GET` URLs valid for 300 seconds by default
  (`@aws-sdk/s3-request-presigner`). The bucket is never made public.
- The same code path runs against LocalStack locally and AWS S3 in production; only
  `AWS_S3_ENDPOINT` / `AWS_S3_PUBLIC_ENDPOINT` differ (both unset for AWS).
- Upload writes the object, then the metadata; if the metadata write fails the object is
  deleted again. Delete removes the object first, then the metadata; an S3 failure leaves both
  untouched (`502`), and a metadata failure after the object is gone is logged as an
  inconsistency.

## Frontend

The Next.js app keeps the JWT in an `httpOnly`, `SameSite=Lax` cookie that browser JavaScript
cannot read. Its route handlers log users in through the auth service and forward API calls to
the passport and document services, adding the `Authorization` header server-side. The services
still enforce authentication and roles on every request; the UI only hides actions a role cannot
perform. File downloads go straight from the browser to S3 through the pre-signed URL.

## Cross-cutting concerns

- **Shared package (`packages/shared`).** Zod schemas (also used by the frontend forms), the
  error model, the Express app factory (request ids, logging, Helmet, CORS, body limits, Swagger
  at `/docs`, `/health`), JWT/RBAC middleware, the auth service client, the Kafka client factory
  and runtime helpers (environment validation, MongoDB connection, graceful shutdown).
- **Errors.** Every service responds with
  `{ "success": false, "error": { "code", "message", "details?", "requestId" } }`; stack traces
  are logged, never returned.
- **Logging.** Winston writes structured JSON to stdout (`timestamp`, `level`, `service`,
  `message`, `requestId`, …). Passwords, tokens, cookies and AWS keys are redacted by key name.
- **Configuration.** Each service validates its environment with Zod at start-up and exits with
  a readable error if something is missing.
