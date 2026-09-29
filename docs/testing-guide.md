# Testing guide

Three ways to check the platform, from quickest to most thorough:

1. [Automated end-to-end check](#1-automated-end-to-end-check): one command, runs every flow below
   against the local Docker stack.
2. [Web app walkthrough](#2-web-app-walkthrough): click through each flow in the browser.
3. [API walkthrough with curl](#3-api-walkthrough-with-curl): call every endpoint from the
   assignment by hand, locally or on the hosted deployment.

The hosted web app runs on Vercel and is always up. The backend services run on Render's free plan
and sleep when idle: opening the web app wakes them, and the first page can take up to a minute to
load. When calling the APIs directly, open each `/health` URL once first.

| Service      | Local                 | Hosted                                              |
| ------------ | --------------------- | --------------------------------------------------- |
| Web app      | http://localhost:3000 | your Vercel URL (e.g. https://<project>.vercel.app) |
| Auth         | http://localhost:4001 | https://bpp-auth-service.onrender.com               |
| Passport     | http://localhost:4002 | https://bpp-passport-service.onrender.com           |
| Document     | http://localhost:4003 | https://bpp-document-service.onrender.com           |
| Notification | http://localhost:4004 | https://bpp-notification-service.onrender.com       |

Each API service serves Swagger UI at `/docs`: click **Authorize**, paste a JWT from login, and use
**Try it out** as an alternative to curl.

## 1. Automated end-to-end check

```bash
docker compose up -d --build
pnpm test:e2e
```

[`scripts/e2e.mjs`](../scripts/e2e.mjs) creates throwaway `…@e2e.test` accounts for every role and
checks about 90 behaviours: health and Swagger, registration and login, role checks on every
endpoint, document upload/download/rename/delete against S3, Kafka events arriving at the
notification service, password reset, user-role management and the web app's session handling.
It prints `PASS`/`FAIL` per check and exits non-zero on any failure.

The unit and integration tests (Jest, in-memory MongoDB, no Docker needed) run with `pnpm test`.

## 2. Web app walkthrough

Use a private window per account so sessions don't mix.

| #   | Flow                   | Steps                                                                                                                                                         | Expected                                                                                               |
| --- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| 1   | Sign up                | **Create one** on the sign-in page, register with an email and password                                                                                       | Lands on the dashboard; the sidebar shows role **User**                                                |
| 2   | Read-only access       | As that user, open **Passports** and a passport                                                                                                               | The 10 sample passports are listed; no New, Edit, Delete or upload controls                            |
| 3   | Admin access           | Sign in as an admin (bootstrap admin, or an account registered through the API with `"role":"admin"`, see 3.1)                                                | **User roles** appears in the sidebar; New passport, Edit and Delete are available                     |
| 4   | Assign roles           | **User roles** → change the account from step 1 to **Tester**                                                                                                 | Saved; your own role cannot be changed                                                                 |
| 5   | Tester permissions     | Back in the step 1 window, refresh                                                                                                                            | Sidebar shows **Tester**; **New passport** and document upload appear; Edit and Delete do not          |
| 6   | Create a passport      | As tester or admin: **New passport**, fill the form, save                                                                                                     | Passport page opens with the passport card and QR code                                                 |
| 7   | Edit and delete        | As admin: **Edit** the passport, change the mass, save; then **Delete**                                                                                       | Change is shown; after deleting, the passport is gone from the list                                    |
| 8   | Upload a document      | On a passport page (or **Documents**), drop a PDF or image                                                                                                    | Appears in the list with its size and date                                                             |
| 9   | Preview and download   | Click the document's preview and download actions                                                                                                             | PDF/image opens in the app; download fetches the file through a short-lived S3 link                    |
| 10  | Rename and delete file | As admin or developer rename it; as admin delete it                                                                                                           | Name updates; the file disappears after deleting                                                       |
| 11  | Search and filter      | Type in the passport search, use the category/status filters and column sorting, or press ⌘K / Ctrl K                                                         | List narrows and re-orders; ⌘K jumps to passports and pages                                            |
| 12  | QR code                | Click the QR code on a passport, scan it with a phone or press **Open passport**                                                                              | Opens that passport's page                                                                             |
| 13  | Forgot password        | Sign out → **Forgot password?** → enter the account email                                                                                                     | "Check your email" screen (same message for unknown emails)                                            |
| 14  | Reset password         | Open the link from the email (without SMTP, find `resetUrl` in the auth-service log: `docker compose logs auth-service \| grep resetUrl`), set a new password | Redirected to sign-in with "Your password has been updated"; the old password fails, the new one works |
| 15  | Sessions end on reset  | Before step 14, stay signed in with that account in another window; after the reset, click around there                                                       | That window is sent back to the sign-in page                                                           |
| 16  | Google sign-in         | **Continue with Google** (only shown when Google OAuth is configured)                                                                                         | Signed in as a **User**                                                                                |
| 17  | Notifications          | After creating, editing and deleting a passport, run `docker compose logs notification-service` (or open the notification service logs on Render)             | One `[Notification] Battery passport created/updated/deleted` line per action, with the passport id    |
| 18  | Dark mode              | Moon icon in the top bar                                                                                                                                      | Whole app switches theme                                                                               |

## 3. API walkthrough with curl

Set the base URLs once (hosted shown; use the local URLs from the table above for Docker):

```bash
AUTH=https://bpp-auth-service.onrender.com
PASS=https://bpp-passport-service.onrender.com
DOC=https://bpp-document-service.onrender.com
```

`jq` is used to pull values out of responses (`brew install jq`).

### 3.1 Auth: register, login, roles

```bash
# Register one account per role (role is optional and defaults to "user")
for r in admin developer tester user; do
  curl -s -X POST $AUTH/api/auth/register -H 'content-type: application/json' \
    -d "{\"email\":\"$r.demo@example.com\",\"password\":\"Passw0rd!demo\",\"role\":\"$r\"}"; echo
done

# Log in and keep each token
login() { curl -s -X POST $AUTH/api/auth/login -H 'content-type: application/json' \
  -d "{\"email\":\"$1.demo@example.com\",\"password\":\"Passw0rd!demo\"}" | jq -r .data.token; }
ADMIN=$(login admin); DEV=$(login developer); TESTER=$(login tester); USER=$(login user)

curl -s $AUTH/api/auth/me -H "authorization: Bearer $DEV" | jq       # role: developer
curl -s -o /dev/null -w '%{http_code}\n' -X POST $AUTH/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin.demo@example.com","password":"wrong-password"}'  # 401
```

Expected: `201` for each registration (`409` if it already exists), a JWT for each login, `401`
for the wrong password.

### 3.2 Passports: CRUD and role checks

```bash
BODY='{"data":{"generalInformation":{"batteryIdentifier":"BP-DEMO-001","batteryModel":{"id":"LM3-BAT-2024","modelName":"GMC WZX1"},"batteryMass":450,"batteryCategory":"EV","batteryStatus":"Original","manufacturingDate":"2024-01-15","manufacturingPlace":"Gigafactory Nevada","warrantyPeriod":"8","manufacturerInformation":{"manufacturerName":"Tesla Inc","manufacturerIdentifier":"TESLA-001"}},"materialComposition":{"batteryChemistry":"LiFePO4","criticalRawMaterials":["Lithium","Iron"],"hazardousSubstances":[{"substanceName":"Lithium Hexafluorophosphate","chemicalFormula":"LiPF6","casNumber":"21324-40-3"}]},"carbonFootprint":{"totalCarbonFootprint":850,"measurementUnit":"kg CO2e","methodology":"Life Cycle Assessment (LCA)"}}}'

# Create (admin) -> 201
PID=$(curl -s -X POST $PASS/api/passports -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d "$BODY" | jq -r .data.id); echo $PID

# Create as user -> 403 (tester and developer -> 201 with a different batteryIdentifier)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $PASS/api/passports \
  -H "authorization: Bearer $USER" -H 'content-type: application/json' -d "$BODY"

# View (any role) -> 200
curl -s $PASS/api/passports/$PID -H "authorization: Bearer $USER" | jq .data.data.generalInformation

# Update: admin/developer -> 200, tester/user -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X PUT $PASS/api/passports/$PID \
  -H "authorization: Bearer $TESTER" -H 'content-type: application/json' -d "$BODY"
curl -s -X PUT $PASS/api/passports/$PID -H "authorization: Bearer $DEV" \
  -H 'content-type: application/json' -d "${BODY/450/470}" | jq .data.data.generalInformation.batteryMass

# No token -> 401, bad id -> 400, invalid body -> 422
curl -s -o /dev/null -w '%{http_code}\n' $PASS/api/passports/$PID
curl -s -o /dev/null -w '%{http_code}\n' $PASS/api/passports/nope -H "authorization: Bearer $USER"
curl -s -X POST $PASS/api/passports -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d '{"data":{}}' | jq .error
```

### 3.3 Documents: upload, link, update, delete

```bash
echo "battery test report" > report.txt

# Upload -> 201 { docId, fileName, createdAt } (admin, developer, tester; user -> 403)
DOCID=$(curl -s -X POST $DOC/api/documents/upload -H "authorization: Bearer $TESTER" \
  -F file=@report.txt -F passportId=$PID | tee /dev/stderr | jq -r .data.docId)

# Downloadable link (any role) -> pre-signed S3 URL valid for 300 s
URL=$(curl -s $DOC/api/documents/$DOCID -H "authorization: Bearer $USER" | jq -r .data.downloadUrl)
curl -s "$URL"                                              # prints the file contents

# Update metadata: admin/developer -> 200, tester -> 403
curl -s -X PUT $DOC/api/documents/$DOCID -H "authorization: Bearer $DEV" \
  -H 'content-type: application/json' -d '{"fileName":"lca-report.txt"}' | jq .data.fileName

# Delete: developer -> 403, admin -> 200
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $DOC/api/documents/$DOCID -H "authorization: Bearer $DEV"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $DOC/api/documents/$DOCID -H "authorization: Bearer $ADMIN"
curl -s -o /dev/null -w '%{http_code}\n' "$URL"            # the S3 object is gone
```

### 3.4 Delete the passport and check Kafka notifications

```bash
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $PASS/api/passports/$PID -H "authorization: Bearer $DEV"    # 403
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $PASS/api/passports/$PID -H "authorization: Bearer $ADMIN"  # 200
```

Locally, `docker compose logs notification-service | grep $PID` shows the `passport.created`,
`passport.updated` and `passport.deleted` events for that passport. On Render, open
**bpp-notification-service → Logs** (the free instance only consumes while awake).

### 3.5 Password reset

```bash
curl -s -X POST $AUTH/api/auth/forgot-password -H 'content-type: application/json' \
  -d '{"email":"user.demo@example.com"}' | jq          # same response for any email
```

Take the token from the emailed link (or the `resetUrl` in the auth-service log when SMTP is not
configured), then:

```bash
TOKEN='paste-token-here'
curl -s -X POST $AUTH/api/auth/reset-password -H 'content-type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"N3wPassw0rd!demo\"}" | jq        # 200
curl -s $AUTH/api/auth/me -H "authorization: Bearer $USER" | jq .error.code  # TOKEN_REVOKED
```

Using the same link again returns `400 INVALID_RESET_TOKEN`.

### 3.6 User-role management (admin only)

```bash
curl -s "$AUTH/api/auth/users?q=demo" -H "authorization: Bearer $ADMIN" | jq '.data.items[] | {id,email,role}'
curl -s -o /dev/null -w '%{http_code}\n' $AUTH/api/auth/users -H "authorization: Bearer $DEV"   # 403
USER_ID=$(curl -s "$AUTH/api/auth/users?q=user.demo" -H "authorization: Bearer $ADMIN" | jq -r '.data.items[0].id')
curl -s -X PATCH $AUTH/api/auth/users/$USER_ID/role -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d '{"role":"developer"}' | jq .data.role
```

## Requirements covered

| Assignment requirement                                           | Where to see it                                                                   |
| ---------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Register/login with JWT, bcrypt, role middleware                 | 3.1, web steps 1–5                                                                |
| Passport create/view/update/delete, admin-only writes            | 3.2, 3.4, web steps 6–7                                                           |
| Kafka `passport.created/updated/deleted` → notification service  | 3.4, web step 17                                                                  |
| Document upload/metadata update/delete/download link, S3 + Mongo | 3.3, web steps 8–10                                                               |
| Services verify JWTs through the auth service over HTTP          | Every 3.2/3.3 call (401 without a token)                                          |
| Docker Compose, `.env`, one container per service                | Section 1                                                                         |
| Swagger, Winston logs, HTTP error codes, CI, tests               | `/docs`, service logs, 400/401/403/404/409/422 above, GitHub Actions, `pnpm test` |
