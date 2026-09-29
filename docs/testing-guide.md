# Testing guide

Three ways to check the platform, from quickest to most thorough:

1. [Automated end-to-end check](#1-automated-end-to-end-check): one command that runs every flow
   below against the local Docker stack.
2. [Web app walkthrough](#2-web-app-walkthrough): click through each flow in the browser.
3. [API walkthrough with curl](#3-api-walkthrough-with-curl): call every endpoint from the
   assignment by hand, locally or on the live deployment.

## URLs

| Service      | Local                 | Live                                          |
| ------------ | --------------------- | --------------------------------------------- |
| Web app      | http://localhost:3000 | https://battery-pass-io.vercel.app            |
| Auth         | http://localhost:4001 | https://bpp-auth-service.onrender.com         |
| Passport     | http://localhost:4002 | https://bpp-passport-service.onrender.com     |
| Document     | http://localhost:4003 | https://bpp-document-service.onrender.com     |
| Notification | http://localhost:4004 | https://bpp-notification-service.onrender.com |

- The live web app is on Vercel and always up. The services run on Render's free plan and sleep
  when idle: opening the web app wakes them, and the first page can take up to a minute.
- Before calling the live APIs directly, open each `/health` URL once to wake the service.
- Each API service serves Swagger UI at `/docs`. Click **Authorize**, paste a JWT from login, and
  use **Try it out** as an alternative to curl.

## 1. Automated end-to-end check

```bash
docker compose up -d --build
pnpm test:e2e
```

[`scripts/e2e.mjs`](../scripts/e2e.mjs) creates throwaway `…@e2e.test` accounts for every role and
checks about 90 behaviours:

- health and Swagger for every service
- registration and login
- role checks on every endpoint
- document upload, download, rename and delete against S3
- Kafka events arriving at the notification service
- password reset
- user-role management
- the web app's session handling

It prints `PASS` or `FAIL` for each check and exits non-zero on any failure. The unit and
integration tests (Jest, in-memory MongoDB, no Docker needed) run with `pnpm test`.

## 2. Web app walkthrough

Use a separate private window for each account so sessions don't mix.

**1. Sign up**

- Do: **Create one** on the sign-in page; register with an email and password.
- Expect: the dashboard opens and the sidebar shows the role **User**.

**2. Read-only access**

- Do: as that user, open **Passports**, then a passport.
- Expect: the 10 sample passports are listed; there are no New, Edit, Delete or upload controls.

**3. Admin access**

- Do: sign in as an admin: the bootstrap admin, or an account registered through the API with
  `"role":"admin"` (see [3.1](#31-auth-register-login-roles)).
- Expect: **User roles** appears in the sidebar; New passport, Edit and Delete are available.

**4. Assign a role**

- Do: **User roles** → change the account from step 1 to **Tester**.
- Expect: the change is saved. Your own role cannot be changed.

**5. Tester permissions**

- Do: go back to the step 1 window and refresh.
- Expect: the sidebar shows **Tester**; **New passport** and document upload appear; Edit and
  Delete do not.

**6. Create a passport**

- Do: as tester or admin, **New passport** → fill in the form → save.
- Expect: the passport page opens with the passport card and QR code.

**7. Edit and delete a passport**

- Do: as admin, **Edit** the passport, change the mass and save; then **Delete** it.
- Expect: the change is shown; after deleting, the passport is gone from the list.

**8. Upload a document**

- Do: on a passport page (or **Documents**), drop a PDF or image.
- Expect: it appears in the list with its size and date.

**9. Preview and download**

- Do: use the document's preview and download actions.
- Expect: PDFs and images open in the app; the download fetches the file through a short-lived S3
  link.

**10. Rename and delete a document**

- Do: rename it as admin or developer; delete it as admin.
- Expect: the name updates; the file disappears after deleting.

**11. Search and filter**

- Do: type in the passport search, use the category and status filters and column sorting, or
  press ⌘K / Ctrl+K.
- Expect: the list narrows and re-orders; ⌘K jumps to passports and pages.

**12. QR code**

- Do: click a passport's QR code; scan it with a phone or press **Open passport**.
- Expect: that passport's page opens.

**13. Forgot password**

- Do: sign out → **Forgot password?** → enter the account email.
- Expect: a "Check your email" screen (the same message appears for unknown emails).

**14. Reset password**

- Do: open the link from the email and set a new password. Without SMTP, the link is in the
  auth-service log: `docker compose logs auth-service | grep resetUrl`.
- Expect: the sign-in page says "Your password has been updated"; the old password fails and the
  new one works.

**15. Sessions end on reset**

- Do: before step 14, stay signed in with that account in another window; after the reset, click
  around in that window.
- Expect: that window is sent back to the sign-in page.

**16. Google sign-in**

- Do: **Continue with Google** (shown only when Google OAuth is configured).
- Expect: you are signed in as a **User** (or with your existing role, if the email already has an
  account).

**17. Notifications**

- Do: create, edit and delete a passport, then run `docker compose logs notification-service`
  (or open the notification service logs on Render).
- Expect: one `[Notification] Battery passport created/updated/deleted` line per action, with the
  passport id.

**18. Dark mode**

- Do: click the moon icon in the top bar.
- Expect: the whole app switches theme.

## 3. API walkthrough with curl

Set the base URLs once. The live URLs are shown; for Docker use the local URLs from the table
above.

```bash
AUTH=https://bpp-auth-service.onrender.com
PASS=https://bpp-passport-service.onrender.com
DOC=https://bpp-document-service.onrender.com
```

The commands use `jq` to pull values out of responses (`brew install jq`).

### 3.1 Auth: register, login, roles

```bash
# Register one account per role (role is optional and defaults to "user")
for r in admin developer tester user; do
  curl -s -X POST $AUTH/api/auth/register -H 'content-type: application/json' \
    -d "{\"email\":\"$r.demo@example.com\",\"password\":\"Passw0rd!demo\",\"role\":\"$r\"}"
  echo
done

# Log in and keep each token
login() {
  curl -s -X POST $AUTH/api/auth/login -H 'content-type: application/json' \
    -d "{\"email\":\"$1.demo@example.com\",\"password\":\"Passw0rd!demo\"}" | jq -r .data.token
}
ADMIN=$(login admin); DEV=$(login developer); TESTER=$(login tester); USER=$(login user)

# Current user -> role "developer"
curl -s $AUTH/api/auth/me -H "authorization: Bearer $DEV" | jq

# Wrong password -> 401
curl -s -o /dev/null -w '%{http_code}\n' -X POST $AUTH/api/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"admin.demo@example.com","password":"wrong-password"}'
```

Expected: `201` for each registration (`409` if it already exists), a JWT for each login and `401`
for the wrong password.

### 3.2 Passports: CRUD and role checks

```bash
# The passport body from the assignment
cat > passport.json <<'JSON'
{
  "data": {
    "generalInformation": {
      "batteryIdentifier": "BP-DEMO-001",
      "batteryModel": { "id": "LM3-BAT-2024", "modelName": "GMC WZX1" },
      "batteryMass": 450,
      "batteryCategory": "EV",
      "batteryStatus": "Original",
      "manufacturingDate": "2024-01-15",
      "manufacturingPlace": "Gigafactory Nevada",
      "warrantyPeriod": "8",
      "manufacturerInformation": {
        "manufacturerName": "Tesla Inc",
        "manufacturerIdentifier": "TESLA-001"
      }
    },
    "materialComposition": {
      "batteryChemistry": "LiFePO4",
      "criticalRawMaterials": ["Lithium", "Iron"],
      "hazardousSubstances": [
        {
          "substanceName": "Lithium Hexafluorophosphate",
          "chemicalFormula": "LiPF6",
          "casNumber": "21324-40-3"
        }
      ]
    },
    "carbonFootprint": {
      "totalCarbonFootprint": 850,
      "measurementUnit": "kg CO2e",
      "methodology": "Life Cycle Assessment (LCA)"
    }
  }
}
JSON

# Create as admin -> 201
PID=$(curl -s -X POST $PASS/api/passports -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d @passport.json | jq -r .data.id)
echo $PID

# Create as user -> 403 (developer and tester -> 201 with another batteryIdentifier)
curl -s -o /dev/null -w '%{http_code}\n' -X POST $PASS/api/passports \
  -H "authorization: Bearer $USER" -H 'content-type: application/json' -d @passport.json

# View as any role -> 200
curl -s $PASS/api/passports/$PID -H "authorization: Bearer $USER" \
  | jq .data.data.generalInformation

# Update as tester -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X PUT $PASS/api/passports/$PID \
  -H "authorization: Bearer $TESTER" -H 'content-type: application/json' -d @passport.json

# Update as developer -> 200, mass 470
sed 's/"batteryMass": 450/"batteryMass": 470/' passport.json > passport-updated.json
curl -s -X PUT $PASS/api/passports/$PID -H "authorization: Bearer $DEV" \
  -H 'content-type: application/json' -d @passport-updated.json \
  | jq .data.data.generalInformation.batteryMass

# No token -> 401
curl -s -o /dev/null -w '%{http_code}\n' $PASS/api/passports/$PID

# Malformed id -> 400
curl -s -o /dev/null -w '%{http_code}\n' $PASS/api/passports/nope \
  -H "authorization: Bearer $USER"

# Invalid body -> 422 with field details
curl -s -X POST $PASS/api/passports -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d '{"data":{}}' | jq .error
```

### 3.3 Documents: upload, link, update, delete

```bash
echo "battery test report" > report.txt

# Upload as tester -> 201 { docId, fileName, createdAt } (as user -> 403)
DOCID=$(curl -s -X POST $DOC/api/documents/upload -H "authorization: Bearer $TESTER" \
  -F file=@report.txt -F passportId=$PID | tee /dev/stderr | jq -r .data.docId)

# Download link as any role -> pre-signed S3 URL, valid for 300 s
URL=$(curl -s $DOC/api/documents/$DOCID -H "authorization: Bearer $USER" \
  | jq -r .data.downloadUrl)
curl -s "$URL"   # prints the file contents

# Update metadata as developer -> 200 (as tester -> 403)
curl -s -X PUT $DOC/api/documents/$DOCID -H "authorization: Bearer $DEV" \
  -H 'content-type: application/json' -d '{"fileName":"lca-report.txt"}' | jq .data.fileName

# Delete as developer -> 403, then as admin -> 200
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $DOC/api/documents/$DOCID \
  -H "authorization: Bearer $DEV"
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $DOC/api/documents/$DOCID \
  -H "authorization: Bearer $ADMIN"

# The S3 object is gone -> 403 or 404
curl -s -o /dev/null -w '%{http_code}\n' "$URL"
```

### 3.4 Delete the passport and check Kafka notifications

```bash
# As developer -> 403
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $PASS/api/passports/$PID \
  -H "authorization: Bearer $DEV"

# As admin -> 200
curl -s -o /dev/null -w '%{http_code}\n' -X DELETE $PASS/api/passports/$PID \
  -H "authorization: Bearer $ADMIN"
```

Locally, `docker compose logs notification-service | grep $PID` shows the `passport.created`,
`passport.updated` and `passport.deleted` events for that passport. On Render, open
**bpp-notification-service → Logs**; the free instance only consumes while awake and catches up
after waking.

### 3.5 Password reset

```bash
# Same response for any email
curl -s -X POST $AUTH/api/auth/forgot-password -H 'content-type: application/json' \
  -d '{"email":"user.demo@example.com"}' | jq
```

Take the token from the emailed link (or from `resetUrl` in the auth-service log when SMTP is not
configured), then:

```bash
TOKEN='paste-token-here'

# -> 200
curl -s -X POST $AUTH/api/auth/reset-password -H 'content-type: application/json' \
  -d "{\"token\":\"$TOKEN\",\"password\":\"N3wPassw0rd!demo\"}" | jq

# The old session is revoked -> TOKEN_REVOKED
curl -s $AUTH/api/auth/me -H "authorization: Bearer $USER" | jq .error.code
```

Using the same link again returns `400 INVALID_RESET_TOKEN`.

### 3.6 User-role management (admin only)

```bash
# List users as admin
curl -s "$AUTH/api/auth/users?q=demo" -H "authorization: Bearer $ADMIN" \
  | jq '.data.items[] | {id, email, role}'

# List users as developer -> 403
curl -s -o /dev/null -w '%{http_code}\n' $AUTH/api/auth/users -H "authorization: Bearer $DEV"

# Promote the user account to developer
USER_ID=$(curl -s "$AUTH/api/auth/users?q=user.demo" -H "authorization: Bearer $ADMIN" \
  | jq -r '.data.items[0].id')
curl -s -X PATCH $AUTH/api/auth/users/$USER_ID/role -H "authorization: Bearer $ADMIN" \
  -H 'content-type: application/json' -d '{"role":"developer"}' | jq .data.role
```

## Requirements covered

- **Register and login with JWT, bcrypt and role middleware:** 3.1 and web steps 1–5.
- **Passport create, view, update and delete, with admin-only writes:** 3.2, 3.4 and web
  steps 6–7.
- **Kafka `passport.created`, `passport.updated`, `passport.deleted` → notification service:**
  3.4 and web step 17.
- **Document upload, metadata update, delete and download link, with S3 and MongoDB:** 3.3 and
  web steps 8–10.
- **Services verify JWTs through the auth service over HTTP:** every call in 3.2 and 3.3 (401
  without a token).
- **Docker Compose, `.env`, one container per service:** section 1.
- **Swagger, Winston logs, HTTP error codes, CI and tests:** `/docs`, the service logs, the
  400/401/403/404/409/422 checks above, GitHub Actions and `pnpm test`.
