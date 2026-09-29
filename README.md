# Battery Passport Platform

A simplified, microservices-based backend for managing digital battery passports, built for the
MEAtec backend assignment. It covers user registration and JWT authentication with role-based
access, battery passport CRUD, document storage in AWS S3, Kafka domain events with a
notification consumer, and a web interface for demonstrating the system.

> This is the simplified platform described in the assignment. It is not a certified
> implementation of the EU Battery Passport.

![Passport detail with the digital passport card and QR code](docs/screenshots/passport-detail.png)

## Contents

1. [Screenshots](#screenshots)
2. [Architecture](#architecture)
3. [Services](#services)
4. [Technology stack](#technology-stack)
5. [Repository structure](#repository-structure)
6. [Running locally with Docker Compose](#running-locally-with-docker-compose)
7. [Environment variables](#environment-variables)
8. [AWS S3 configuration](#aws-s3-configuration)
9. [API](#api)
10. [Authentication and RBAC](#authentication-and-rbac)
11. [Kafka topics and payloads](#kafka-topics-and-payloads)
12. [Swagger documentation](#swagger-documentation)
13. [Testing](#testing)
14. [CI](#ci)
15. [Deployment](#deployment)
16. [Design notes](#design-notes)

## Screenshots

Captured from the running Docker Compose stack with sample data.

| Dashboard                                                                               | Dashboard (dark theme)                                              |
| --------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
| ![Dashboard with live counts and recent passport cards](docs/screenshots/dashboard.png) | ![Dashboard in the dark theme](docs/screenshots/dashboard-dark.png) |

| Passports: table with search, filters and sorting                                        | Passports: card view                                              |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| ![Sortable passport table with search and filters](docs/screenshots/passports-table.png) | ![Passports shown as cards](docs/screenshots/passports-cards.png) |

| Passport detail (dark theme)                                                               | Command bar (⌘K)                                                         |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ |
| ![Passport card with QR code in the dark theme](docs/screenshots/passport-detail-dark.png) | ![Command bar searching passports](docs/screenshots/command-palette.png) |

| Documents                                                    | In-app document preview                                                                      |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------- |
| ![Document list with upload](docs/screenshots/documents.png) | ![Image preview served through a short-lived S3 link](docs/screenshots/document-preview.png) |

| User roles (admin only)                                                 | Edit passport form                                              |
| ----------------------------------------------------------------------- | --------------------------------------------------------------- |
| ![Admin page for assigning user roles](docs/screenshots/user-roles.png) | ![Structured passport form](docs/screenshots/passport-form.png) |

| Sign in                                       | Mobile                                                            |
| --------------------------------------------- | ----------------------------------------------------------------- |
| ![Sign-in screen](docs/screenshots/login.png) | ![Passport card on a phone](docs/screenshots/mobile-passport.png) |

## Architecture

```
 Browser ──► web (Next.js :3000) ──HTTP──► passport-service (:4002) ──Kafka──► notification-service (:4004)
                    │                        │   │                    topic:        │
                    │                        │   └─► passport_db      battery-      ├─► Winston log
                    │                        │                        passport-     └─► SMTP (optional)
                    │                        │ HTTP /api/auth/me      events
                    ├──HTTP──► auth-service (:4001) ──► auth_db
                    │                        ▲
                    │                        │ HTTP /api/auth/me
                    └──HTTP──► document-service (:4003) ──► document_db
                                             │
                                             ├── HTTP /api/passports/:id ──► passport-service
                                             └── AWS SDK ──► S3 (LocalStack locally, AWS in production)
```

- **Synchronous (HTTP):** the passport and document services verify every JWT by calling the
  auth service (`GET /api/auth/me`) using internal service URLs from environment variables. The
  document service also checks with the passport service that a passport exists before linking a
  document to it.
- **Asynchronous (Kafka):** the passport service emits `passport.created`, `passport.updated`
  and `passport.deleted`; the notification service consumes them.
- **Data ownership:** each service has its own MongoDB database and nobody else touches it.

See [docs/architecture.md](docs/architecture.md) for the full design, including failure handling.

## Services

| Service              | Port | Responsibility                                                              |
| -------------------- | ---- | --------------------------------------------------------------------------- |
| auth-service         | 4001 | Registration, login, bcrypt hashing, JWT issuing and verification, roles    |
| passport-service     | 4002 | Battery passport CRUD, Zod validation, Kafka event publishing               |
| document-service     | 4003 | Multipart upload to S3, metadata in MongoDB, pre-signed downloads           |
| notification-service | 4004 | Kafka consumer; logs notifications and optionally emails them (health only) |
| web                  | 3000 | Next.js interface for demonstrating the platform                            |

Every service has its own `package.json`, Dockerfile, configuration, tests and `GET /health`.

## Technology stack

- **Backend:** Node.js 22, TypeScript (strict), Express 5, Mongoose 8, KafkaJS, jsonwebtoken,
  bcrypt, AWS SDK v3 (`@aws-sdk/client-s3`, `@aws-sdk/s3-request-presigner`), Multer, Zod,
  Winston, swagger-ui-express, Nodemailer
- **Frontend:** Next.js 15, React 19, Tailwind CSS 4, TanStack Query, React Hook Form, Zod,
  Radix UI primitives, cmdk, next-themes, qrcode.react, Lucide icons, Framer Motion
- **Infrastructure:** MongoDB 7, Apache Kafka 3.8 (KRaft), LocalStack (S3) for local
  development, Docker Compose, GitHub Actions
- **Testing:** Jest, Supertest, mongodb-memory-server

## Repository structure

```
.
├── apps/
│   ├── auth-service/          # src/{config,models,repositories,services,controllers,routes,docs}, tests/
│   ├── passport-service/      # + src/events (Kafka producer)
│   ├── document-service/      # + src/storage (S3), src/clients (passport service)
│   ├── notification-service/  # src/consumer (Kafka), src/notifications (log / email)
│   └── web/                   # Next.js app (src/app, src/components, src/lib)
├── packages/
│   └── shared/                # Zod schemas, errors, Express app factory, auth middleware,
│                              # auth client, Kafka helpers, logging, runtime helpers
├── infrastructure/localstack/ # creates the private bucket in LocalStack
├── docs/architecture.md
├── .github/workflows/ci.yml
├── docker-compose.yml
└── .env.example
```

## Running locally with Docker Compose

Requirements: Docker with Compose v2. Node.js 22 and pnpm are only needed to run the tests or
the seed script outside Docker (`corepack enable` installs the pinned pnpm version).

```bash
cp .env.example .env
```

Set `JWT_SECRET` (at least 32 characters, e.g. `openssl rand -base64 48`), replace
`replace-with-a-local-password` in the three MongoDB URIs and `MONGO_ROOT_PASSWORD`, and choose a
`BOOTSTRAP_ADMIN_PASSWORD` for the first admin account (`BOOTSTRAP_ADMIN_EMAIL`). Then:

```bash
docker compose up --build -d
```

Compose starts MongoDB, Kafka, LocalStack, the four services and the web app. Health checks gate
start-up: services wait for MongoDB, Kafka, LocalStack and the auth service to be healthy, and
each service also retries its own connections, so the stack is usable once all containers show
`healthy` (`docker compose ps`), usually within a minute.

| URL                          | What                                   |
| ---------------------------- | -------------------------------------- |
| http://localhost:3000        | Web interface                          |
| http://localhost:4001/docs   | Auth service Swagger UI                |
| http://localhost:4002/docs   | Passport service Swagger UI            |
| http://localhost:4003/docs   | Document service Swagger UI            |
| http://localhost:4004/health | Notification service health (loopback) |

Sign in with the bootstrap admin from `.env`. The passport service adds ten sample passports on
start-up (`SEED_DEMO_DATA=true`; only identifiers that are not present yet are inserted, so edits
and deletions are kept). Optionally create demo accounts for the other roles:

```bash
corepack enable && pnpm install && pnpm seed
```

This registers `developer@batterypassport.local` / `DeveloperPassw0rd!`,
`tester@batterypassport.local` / `TesterPassw0rd!` and `viewer@batterypassport.local` /
`ViewerPassw0rd!` through the public API, then signs in as the bootstrap admin to give the first
two the developer and tester roles. These credentials are for local demonstration only.

Watch notifications arrive:

```bash
docker compose logs -f notification-service
```

### Running a service without Docker

Infrastructure can stay in Docker (`docker compose up -d mongodb kafka localstack`). Kafka is
reachable from the host at `localhost:29092`. Then, per service:

```bash
pnpm install && pnpm build:shared
MONGODB_URI=mongodb://bpp:<password>@localhost:27017/auth_db?authSource=admin \
JWT_SECRET=<secret> pnpm --filter auth-service dev
```

The web app reads `apps/web/.env.example` values (`cp apps/web/.env.example apps/web/.env.local`).

### Web interface

The BatteryPass web app (http://localhost:3000) demonstrates every backend capability:

- **Dashboard:** live counts of passports and documents and the most recent passports.
- **Passports:** a sortable table (or card grid) with search and category/status filters; the
  view is kept in the URL so it can be shared.
- **Passport detail:** each battery shown as a digital passport card with a QR code linking to
  its page, followed by the full passport data and its documents.
- **Documents:** upload with progress, in-app preview for PDFs and images, rename, download
  and delete.
- **Command bar:** ⌘K / Ctrl+K searches passports and jumps to any page or action.
- **Light and dark themes**, following the system setting by default.

Admin-only actions are hidden from users, but the services enforce every permission.

## Environment variables

All variables are documented in [.env.example](.env.example). Docker Compose maps them onto each
service; every service validates its own variables with Zod on start-up and refuses to start if
one is missing or invalid.

| Variable                                                                                                    | Used by                               | Description                                                                                       |
| ----------------------------------------------------------------------------------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `NODE_ENV`, `LOG_LEVEL`                                                                                     | all                                   | Runtime mode and Winston level                                                                    |
| `CORS_ORIGINS`                                                                                              | auth, passport, document              | Comma-separated allowed browser origins, or `*`                                                   |
| `AUTH_SERVICE_PORT` … `WEB_PORT`                                                                            | compose                               | Host ports                                                                                        |
| `JWT_SECRET`                                                                                                | auth                                  | HMAC secret, ≥ 32 characters; only the auth service has it                                        |
| `JWT_EXPIRES_IN`                                                                                            | auth                                  | Token lifetime (default `1h`)                                                                     |
| `BOOTSTRAP_ADMIN_EMAIL`, `BOOTSTRAP_ADMIN_PASSWORD`                                                         | auth                                  | First admin account, created (or promoted) at startup; the password is only used when creating it |
| `BCRYPT_SALT_ROUNDS`                                                                                        | auth                                  | bcrypt work factor (default 12)                                                                   |
| `MONGO_ROOT_USERNAME`, `MONGO_ROOT_PASSWORD`                                                                | mongodb                               | Local MongoDB root user                                                                           |
| `AUTH_MONGODB_URI`, `PASSPORT_MONGODB_URI`, `DOCUMENT_MONGODB_URI`                                          | respective service (as `MONGODB_URI`) | One database per service                                                                          |
| `KAFKA_BROKERS`                                                                                             | passport, notification                | Bootstrap servers                                                                                 |
| `KAFKA_GROUP_ID`                                                                                            | notification                          | Consumer group                                                                                    |
| `KAFKA_SSL`, `KAFKA_SASL_MECHANISM`, `KAFKA_SASL_USERNAME`, `KAFKA_SASL_PASSWORD`                           | passport, notification                | For hosted Kafka                                                                                  |
| `AWS_REGION`, `AWS_S3_BUCKET`                                                                               | document                              | Bucket location                                                                                   |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`                                                                | document                              | Optional; the SDK default chain (e.g. IAM role) is used when unset                                |
| `AWS_S3_ENDPOINT`, `AWS_S3_PUBLIC_ENDPOINT`, `AWS_S3_FORCE_PATH_STYLE`                                      | document                              | LocalStack only; leave empty for AWS                                                              |
| `DOWNLOAD_URL_TTL_SECONDS`                                                                                  | document                              | Pre-signed URL lifetime (default 300)                                                             |
| `AUTH_SERVICE_URL`                                                                                          | passport, document, web               | Internal auth service URL                                                                         |
| `PASSPORT_SERVICE_URL`                                                                                      | document, web                         | Internal passport service URL                                                                     |
| `DOCUMENT_SERVICE_URL`                                                                                      | web                                   | Internal document service URL                                                                     |
| `NOTIFICATION_SERVICE_URL`                                                                                  | web                                   | Optional; pinged on each visit so a sleeping notification service wakes up                        |
| `SESSION_COOKIE_SECURE`                                                                                     | web                                   | `true` when served over HTTPS                                                                     |
| `GOOGLE_CLIENT_ID`                                                                                          | auth, web                             | Optional Google OAuth client id; Google sign-in is off when empty                                 |
| `GOOGLE_CLIENT_SECRET`                                                                                      | web                                   | Optional Google OAuth client secret                                                               |
| `PUBLIC_APP_URL`                                                                                            | auth, web                             | Public URL of the web app, used for the OAuth redirect URI and password reset links               |
| `PASSWORD_RESET_TTL_MINUTES`                                                                                | auth                                  | Password reset link lifetime (default 30)                                                         |
| `SEED_DEMO_DATA`                                                                                            | passport                              | Adds ten sample passports at start-up (default `true` in Compose)                                 |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM`, `NOTIFICATION_EMAIL_TO` | auth, notification                    | Optional email delivery (reset links, notifications); logging only when `SMTP_HOST` is empty      |

The frontend needs no `NEXT_PUBLIC_*` variables: the browser only talks to the Next.js server,
which reaches the services with the server-side URLs above.

## AWS S3 configuration

Locally, LocalStack emulates S3 and `infrastructure/localstack/init-s3.sh` creates the bucket
with public access blocked. For AWS:

1. **Create a bucket** in your region, e.g.
   `aws s3api create-bucket --bucket <name> --region eu-central-1 --create-bucket-configuration LocationConstraint=eu-central-1`.
2. **Keep it private:** leave _Block all public access_ enabled
   (`aws s3api put-public-access-block --bucket <name> --public-access-block-configuration BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true`).
   Do not add a bucket policy granting public reads; downloads use pre-signed URLs.
3. **Create credentials** limited to that bucket, preferably an IAM role attached to the
   compute running the document service, otherwise an IAM user with an access key:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       { "Effect": "Allow", "Action": ["s3:ListBucket"], "Resource": "arn:aws:s3:::<name>" },
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject", "s3:DeleteObject"],
         "Resource": "arn:aws:s3:::<name>/documents/*"
       }
     ]
   }
   ```

4. **Configure the document service:** set `AWS_REGION`, `AWS_S3_BUCKET` and (unless using a
   role) `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY`; leave `AWS_S3_ENDPOINT`,
   `AWS_S3_PUBLIC_ENDPOINT` empty and `AWS_S3_FORCE_PATH_STYLE=false`.
5. **Run** the service. At start-up it checks the bucket with `HeadBucket` and fails fast if it
   is unreachable.

Never commit credentials; `.env` files are ignored by Git.

## API

All responses share one envelope:

```json
{ "success": true, "data": { } }
{ "success": false, "error": { "code": "PASSPORT_NOT_FOUND", "message": "Battery passport … not found", "requestId": "…" } }
```

Validation failures (`422 VALIDATION_ERROR`) include `details: [{ "field", "message" }]`.

### Auth service (`:4001`)

| Method | Path                        | Auth    | Description                                                                    |
| ------ | --------------------------- | ------- | ------------------------------------------------------------------------------ |
| POST   | `/api/auth/register`        | public  | `{ email, password, role? }` → `201`; `role` defaults to `user`                |
| POST   | `/api/auth/login`           | public  | `{ email, password }` → JWT                                                    |
| POST   | `/api/auth/google`          | public  | `{ idToken }` (Google) → JWT                                                   |
| POST   | `/api/auth/forgot-password` | public  | `{ email }` → emails a single-use reset link; same response for unknown emails |
| POST   | `/api/auth/reset-password`  | public  | `{ token, password }` → sets the password and signs out existing sessions      |
| GET    | `/api/auth/me`              | any JWT | Current user; used by other services                                           |
| GET    | `/api/auth/users`           | admin   | Users with roles and sign-in methods (`q`, `role`)                             |
| PATCH  | `/api/auth/users/:id/role`  | admin   | `{ role }`; admins cannot change their own role                                |

### Passport service (`:4002`)

| Method | Path                 | Roles                    | Description                                     |
| ------ | -------------------- | ------------------------ | ----------------------------------------------- |
| POST   | `/api/passports`     | admin, developer, tester | Create; emits `passport.created`                |
| GET    | `/api/passports/:id` | all roles                | Retrieve                                        |
| PUT    | `/api/passports/:id` | admin, developer         | Replace passport data; emits `passport.updated` |
| DELETE | `/api/passports/:id` | admin                    | Delete; emits `passport.deleted`                |
| GET    | `/api/passports`     | all roles                | Paginated list, used by the UI (see below)      |

`GET /api/passports` accepts `page`, `limit`, `q` (case-insensitive search across battery
identifier, model and manufacturer; matched literally), `category`, `status`, `sort`
(`createdAt`, `batteryIdentifier`, `modelName`, `batteryCategory`, `batteryStatus`,
`manufacturerName`, `manufacturingDate`) and `order` (`asc` / `desc`). Unknown values are
rejected with `422`.

### Document service (`:4003`)

| Method | Path                    | Roles                    | Description                                                                             |
| ------ | ----------------------- | ------------------------ | --------------------------------------------------------------------------------------- |
| POST   | `/api/documents/upload` | admin, developer, tester | `multipart/form-data`: `file`, optional `passportId` → `{ docId, fileName, createdAt }` |
| GET    | `/api/documents/:docId` | all roles                | Metadata and a pre-signed download URL (`expiresIn: 300`)                               |
| PUT    | `/api/documents/:docId` | admin, developer         | Update metadata (`fileName`, `passportId`)                                              |
| DELETE | `/api/documents/:docId` | admin                    | Delete the S3 object and its metadata                                                   |
| GET    | `/api/documents`        | all roles                | Paginated list, optional `passportId` filter, used by the UI                            |

Uploads accept PDF, PNG, JPEG, WebP, plain text, CSV, JSON, DOCX and XLSX up to 10 MB.
`GET /api/documents/:docId?disposition=inline` returns a link the browser can display (used for
in-app preview); it is honoured for PDFs and images only, other types are always served as
downloads.

### Example session

```bash
# Log in as the bootstrap admin (BOOTSTRAP_ADMIN_EMAIL / BOOTSTRAP_ADMIN_PASSWORD in .env)
TOKEN=$(curl -s -X POST localhost:4001/api/auth/login -H 'content-type: application/json' \
  -d '{"email":"admin@batterypassport.local","password":"<BOOTSTRAP_ADMIN_PASSWORD>"}' | jq -r .data.token)

# Create a passport
curl -s -X POST localhost:4002/api/passports -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d @- <<'JSON'
{
  "data": {
    "generalInformation": {
      "batteryIdentifier": "BP-2024-011",
      "batteryModel": { "id": "LM3-BAT-2024", "modelName": "GMC WZX1" },
      "batteryMass": 450,
      "batteryCategory": "EV",
      "batteryStatus": "Original",
      "manufacturingDate": "2024-01-15",
      "manufacturingPlace": "Gigafactory Nevada",
      "warrantyPeriod": "8",
      "manufacturerInformation": { "manufacturerName": "Tesla Inc", "manufacturerIdentifier": "TESLA-001" }
    },
    "materialComposition": {
      "batteryChemistry": "LiFePO4",
      "criticalRawMaterials": ["Lithium", "Iron"],
      "hazardousSubstances": [
        { "substanceName": "Lithium Hexafluorophosphate", "chemicalFormula": "LiPF6", "casNumber": "21324-40-3" }
      ]
    },
    "carbonFootprint": { "totalCarbonFootprint": 850, "measurementUnit": "kg CO2e", "methodology": "Life Cycle Assessment (LCA)" }
  }
}
JSON

# Upload a document for it and fetch a download link
curl -s -X POST localhost:4003/api/documents/upload -H "authorization: Bearer $TOKEN" \
  -F file=@report.pdf -F passportId=<passport id>
curl -s localhost:4003/api/documents/<docId> -H "authorization: Bearer $TOKEN"
```

Validation accepts battery categories `EV`, `LMT`, `Industrial`, `SLI`, `Portable` and statuses
`Original`, `Repurposed`, `Reused`, `Remanufactured`, `Waste`; unknown properties are rejected.

## Authentication and RBAC

- Passwords are hashed with bcrypt (work factor 12 by default) and never returned or logged.
- Login returns an HS256 JWT containing only `sub` (user id), `email` and `role`, with issuer,
  audience and expiry (`1h`) checked on verification.
- `authenticateJWT`, `requireRole(...roles)` and `requirePermission(permission)` live in
  `packages/shared`. The auth service verifies tokens locally; the passport and document services
  verify them over HTTP through the auth service and then check the permission.
- Permissions are defined once in `packages/shared` (`PERMISSIONS`), enforced by every service and
  mirrored by the web UI:

  | Permission                                     | admin | developer | tester | user |
  | ---------------------------------------------- | :---: | :-------: | :----: | :--: |
  | View passports, preview and download documents |   ✓   |     ✓     |   ✓    |  ✓   |
  | Create passports and upload documents          |   ✓   |     ✓     |   ✓    |      |
  | Edit passports and rename documents            |   ✓   |     ✓     |        |      |
  | Delete passports and documents                 |   ✓   |           |        |      |
  | Manage user roles (User roles page)            |   ✓   |           |        |      |

- **Registration follows the assignment:** `POST /api/auth/register` accepts an optional `role`
  (`admin`, `developer`, `tester` or `user`, default `user`), so API clients can register an admin
  directly. The web sign-up form and Google sign-in always create a `user`. Admins assign roles on the **User roles** page
  (`PATCH /api/auth/users/:id/role`). Role changes apply on the user's next request, because each
  token is re-checked against the stored role. Admins cannot change their own role, so the
  platform always keeps at least one admin.
- **The first admin** comes from configuration: at startup the auth service creates the account in
  `BOOTSTRAP_ADMIN_EMAIL` with `BOOTSTRAP_ADMIN_PASSWORD`, or promotes it if it already exists
  (its password is never changed). `pnpm seed` then creates demo developer, tester and viewer
  accounts and assigns their roles through the admin API.

### Password reset

1. **Forgot password?** on the sign-in page asks for the account email
   (`POST /api/auth/forgot-password`). The response is identical whether or not the email is
   registered, so it cannot be used to discover accounts.
2. The auth service stores only a SHA-256 hash of a random 256-bit token and emails
   `{PUBLIC_APP_URL}/reset-password?token=…`. The link expires after `PASSWORD_RESET_TTL_MINUTES`
   (30 by default), works once, and a newer request replaces an older link.
3. The reset page sets the new password (`POST /api/auth/reset-password`). Tokens issued before
   the change are rejected (`TOKEN_REVOKED`), so every existing session is signed out. Accounts
   created with Google can use this to add a password.

Emails are sent with the `SMTP_*` settings on the auth service. Without `SMTP_HOST` (local
development) the link is written to the auth-service log instead:
`docker compose logs auth-service | grep resetUrl`.

### Google sign-in (optional)

Users can also sign in with Google. It is disabled until OAuth credentials are configured, and
local startup never depends on it.

- The web app runs the OAuth 2.0 authorization-code flow with PKCE and a `state` check on its
  server, then sends Google's ID token to `POST /api/auth/google`.
- The auth service verifies the token with `google-auth-library` (signature, issuer, expiry and
  audience), requires a verified email, and issues the platform's normal JWT, so the rest of the
  system is unchanged.
- First sign-in creates an account with the `user` role. If the verified email already belongs to
  an account, the Google identity is linked to it and its role is kept, so admin rights can never be
  obtained through Google alone. Accounts created through Google have no password.

To enable it:

1. In Google Cloud Console, create an OAuth client ID of type **Web application**.
2. Add the authorized redirect URI `http://localhost:3000/api/auth/google/callback` (or
   `<your public URL>/api/auth/google/callback` when deployed).
3. Set `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` and `PUBLIC_APP_URL` in `.env` and restart:
   `docker compose up -d auth-service web`. "Continue with Google" then appears on the sign-in and
   registration pages.

## Kafka topics and payloads

| Topic                     | Producer         | Consumer (group)                              | Key          |
| ------------------------- | ---------------- | --------------------------------------------- | ------------ |
| `battery-passport-events` | passport-service | notification-service (`notification-service`) | `passportId` |

Event types: `passport.created`, `passport.updated`, `passport.deleted`. Every message carries an
`eventType` header and, when available, the originating `x-request-id`.

```json
{
  "eventId": "0b9c5f0e-3f4a-4d0c-9a51-6f1f2f3c1a77",
  "eventType": "passport.created",
  "version": 1,
  "timestamp": "2024-10-05T10:00:00.000Z",
  "data": { "passportId": "6700f1c2a7d4e5f601234567" }
}
```

`passport.updated` and `passport.deleted` use the same shape with their own `eventType`. The
notification service validates each message against this schema and logs, for example:

```json
{
  "level": "info",
  "service": "notification-service",
  "message": "[Notification] Battery passport created: 6700f1c2a7d4e5f601234567",
  "eventType": "passport.created",
  "eventId": "…",
  "passportId": "…",
  "timestamp": "…"
}
```

With `SMTP_HOST` and `NOTIFICATION_EMAIL_TO` set it also emails the notification via Nodemailer;
an email failure is logged and does not stop the log notification.

## Swagger documentation

Each HTTP service serves Swagger UI at `/docs` and the raw OpenAPI document at `/docs.json`,
including request bodies, required roles, example responses and error responses:
[auth](http://localhost:4001/docs), [passport](http://localhost:4002/docs),
[document](http://localhost:4003/docs).

## Testing

```bash
pnpm install
pnpm test
```

Tests use Jest and Supertest against in-memory MongoDB (mongodb-memory-server); Kafka, S3 and
cross-service HTTP calls are replaced by fakes at their interfaces.

| Service      | Covered                                                                                                                                                                                                                        |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| auth         | registration, duplicate email, validation, login, wrong password, JWT claims and verification, forged/stale tokens, `requireRole`                                                                                              |
| passport     | admin create/update/delete, user forbidden for each, retrieval by both roles, 404/400, validation, duplicate identifier, event emission and payload, Kafka failure handling, producer topic/key/payload                        |
| document     | upload to storage with metadata, key format, type and size limits, unknown passport, S3 failure, pre-signed URL, metadata update, delete (including partial failure), S3 client commands and URL signing, file-name sanitising |
| notification | consuming all three event types, invalid messages, duplicates, log and email channels, channel failure isolation, health                                                                                                       |

End to end against the running Docker Compose stack (about 90 checks: every role on every
endpoint, S3 upload/download/delete, Kafka notifications, password reset, the web app's session):

```bash
docker compose up -d --build
pnpm test:e2e
```

[docs/testing-guide.md](docs/testing-guide.md) walks through every flow by hand, in the web app
and with curl against the local or hosted services.

Other checks: `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `pnpm build`.

## CI

`.github/workflows/ci.yml` runs on every push to `main` and every pull request: install
(frozen lockfile), formatting check, lint, typecheck, tests and build, then builds all Docker
images. Any failing step fails the workflow.

## Deployment

Each service is an independent container image (build from the repository root, e.g.
`docker build -f apps/passport-service/Dockerfile .`) and can be deployed on its own. A typical
setup:

| Component                                       | Suggested host                                                                                             |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| auth, passport, document, notification services | Render (Docker web services) or another container platform                                                 |
| web                                             | Vercel (`apps/web`); the Docker image also runs on any container host                                      |
| MongoDB                                         | MongoDB Atlas, one database per service                                                                    |
| Object storage                                  | AWS S3 (see above)                                                                                         |
| Kafka                                           | A hosted Kafka-compatible provider; set `KAFKA_BROKERS`, `KAFKA_SSL=true` and the `KAFKA_SASL_*` variables |

Points to consider:

- Set `NODE_ENV=production`, a strong `JWT_SECRET`, `CORS_ORIGINS` and, behind HTTPS,
  `SESSION_COOKIE_SECURE=true`.
- Point `AUTH_SERVICE_URL`, `PASSPORT_SERVICE_URL` and `DOCUMENT_SERVICE_URL` at the internal or
  public URLs of the deployed services.
- The notification service consumes events only while running; on platforms that put idle web
  services to sleep it catches up after waking, or use an always-on instance or background worker.
- Local Docker Compose does not depend on any of this deployment configuration.

### Deploying the backend services to Render

[`render.yaml`](render.yaml) is a Render Blueprint that creates the four backend services
(`bpp-auth-service`, `bpp-passport-service`, `bpp-document-service`, `bpp-notification-service`)
as Docker web services built from this repository, with health checks and a generated
`JWT_SECRET`. The web app runs on Vercel (next section).

1. **Prepare the external services:**
   - a MongoDB Atlas cluster, with a URI for each of `auth_db`, `passport_db` and `document_db`
     (allow access from Render);
   - an AWS S3 bucket and IAM credentials ([AWS S3 configuration](#aws-s3-configuration));
   - a hosted Kafka cluster: the bootstrap server, SASL username/password and mechanism.
2. **Create the Blueprint:** in Render choose **New → Blueprint**, select this repository and
   apply. Render prompts for every value marked `sync: false`.
3. **Connect the services:** once Render shows each service's URL (normally
   `https://<service-name>.onrender.com`), set:

   | Service                  | Variable               | Value                            |
   | ------------------------ | ---------------------- | -------------------------------- |
   | passport, document       | `AUTH_SERVICE_URL`     | URL of `bpp-auth-service`        |
   | document                 | `PASSPORT_SERVICE_URL` | URL of `bpp-passport-service`    |
   | auth                     | `PUBLIC_APP_URL`       | URL of the web app (reset links) |
   | auth, passport, document | `CORS_ORIGINS`         | URL of the web app               |

4. **Redeploy** the affected services.

### Deploying the web app to Vercel

The web app is a standard Next.js app in `apps/web`; [`apps/web/vercel.json`](apps/web/vercel.json)
installs and builds it together with the shared package from the monorepo root.

1. In Vercel choose **Add New → Project** and import this repository.
2. Set **Root Directory** to `apps/web` (the framework is detected as Next.js; keep the default
   that includes files outside the root directory).
3. Add the environment variables:

   | Variable                                   | Value                                                      |
   | ------------------------------------------ | ---------------------------------------------------------- |
   | `AUTH_SERVICE_URL`                         | `https://bpp-auth-service.onrender.com`                    |
   | `PASSPORT_SERVICE_URL`                     | `https://bpp-passport-service.onrender.com`                |
   | `DOCUMENT_SERVICE_URL`                     | `https://bpp-document-service.onrender.com`                |
   | `NOTIFICATION_SERVICE_URL`                 | `https://bpp-notification-service.onrender.com` (optional) |
   | `PUBLIC_APP_URL`                           | the Vercel URL, e.g. `https://<project>.vercel.app`        |
   | `SESSION_COOKIE_SECURE`                    | `true`                                                     |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | optional, for Google sign-in                               |
   | `ENABLE_EXPERIMENTAL_COREPACK`             | `1` (uses the pnpm version pinned in `package.json`)       |

4. **Deploy**, then point the backends at the new URL: `PUBLIC_APP_URL` on `bpp-auth-service` and
   `CORS_ORIGINS` on auth, passport and document. For Google sign-in, add
   `https://<Vercel URL>/api/auth/google/callback` as an authorized redirect URI.

Sign in with the `BOOTSTRAP_ADMIN_EMAIL` / `BOOTSTRAP_ADMIN_PASSWORD` you gave
`bpp-auth-service`; web sign-ups start as `user` and get other roles on the **User roles** page.

Notes:

- **Always-on front end, backends on demand.** Vercel does not put the web app to sleep. The
  Render backends use the free instance type and sleep after 15 minutes without traffic. Every page
  of the web app pings them (at most once a minute), and while a service is starting, Render
  answers with an HTML 502 page that the web app recognises (the services always answer with
  JSON): it waits and retries for up to 50 seconds instead of showing an error. Free instance hours
  (750 a month per workspace) are therefore only used while people are using the platform.
- The notification service consumes Kafka only while awake; after waking it processes the events
  it missed from its committed offset. Use a paid instance type for it if notifications must be
  immediate.
- [`.github/workflows/keep-alive.yml`](.github/workflows/keep-alive.yml) wakes every backend on
  demand (**Actions → Keep alive → Run workflow**), e.g. just before a demo.
- Render re-applies fixed `value:` entries from `render.yaml` on every Blueprint sync. Settings
  that depend on your accounts (`AWS_REGION`, `KAFKA_SSL`, `KAFKA_SASL_MECHANISM`, …) are therefore
  `sync: false`, so values edited in the dashboard are kept. `AWS_REGION` must be the bucket's
  region; if it is not, the document service stops at startup and logs the region to use.
- The Docker image in `apps/web/Dockerfile` still works for any container host (it is what Docker
  Compose uses locally).

## Design notes

- **Passport schema.** The request body follows the assignment document exactly, including
  `manufacturerInformation` inside `generalInformation`. `manufacturingDate` is stored as a
  MongoDB date and returned in its original `YYYY-MM-DD` form.
- **PUT semantics.** `PUT /api/passports/:id` takes the same full body as create and replaces the
  passport data.
- **Event delivery.** Events are published after the database write. A broker failure is logged
  with the full event context but does not roll back the change; a transactional outbox would
  guarantee delivery in production.
- **LocalStack.** The community edition does not enforce S3 access policies, so unsigned requests
  succeed locally even though public access is blocked. On AWS the bucket settings above apply.
