/* eslint-disable no-console */
/**
 * End-to-end check of every flow against the local Docker Compose stack:
 *   docker compose up -d --build && pnpm test:e2e
 * Creates throwaway accounts (…@e2e.test) and passports; reads container logs for the Kafka
 * notifications and the password reset link (SMTP is not configured locally).
 */
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = fileURLToPath(new URL('..', import.meta.url));

const AUTH = 'http://localhost:4001';
const PASS = 'http://localhost:4002';
const DOC = 'http://localhost:4003';
const WEB = 'http://localhost:3000';
const run = Date.now().toString(36);
const results = [];
let section = '';

function check(name, ok, detail = '') {
  results.push({ section, name, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  -> ${detail}`}`);
}
function head(title) {
  section = title;
  console.log(`\n== ${title}`);
}
async function call(method, url, { token, body, form, headers = {} } = {}) {
  const h = { ...headers };
  if (token) h.authorization = `Bearer ${token}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    h['content-type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const res = await fetch(url, { method, headers: h, body: payload, redirect: 'manual' });
  const text = await res.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: res.status, body: json, text, headers: res.headers };
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const logs = (svc, since) =>
  execSync(`docker compose logs --no-log-prefix --since ${since} ${svc}`, {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });

const samplePassport = (id) => ({
  data: {
    generalInformation: {
      batteryIdentifier: id,
      batteryModel: { id: 'LM3-BAT-2024', modelName: 'GMC WZX1' },
      batteryMass: 450,
      batteryCategory: 'EV',
      batteryStatus: 'Original',
      manufacturingDate: '2024-01-15',
      manufacturingPlace: 'Gigafactory Nevada',
      warrantyPeriod: '8',
      manufacturerInformation: { manufacturerName: 'Tesla Inc', manufacturerIdentifier: 'TESLA-001' },
    },
    materialComposition: {
      batteryChemistry: 'LiFePO4',
      criticalRawMaterials: ['Lithium', 'Iron'],
      hazardousSubstances: [
        { substanceName: 'Lithium Hexafluorophosphate', chemicalFormula: 'LiPF6', casNumber: '21324-40-3' },
      ],
    },
    carbonFootprint: {
      totalCarbonFootprint: 850,
      measurementUnit: 'kg CO2e',
      methodology: 'Life Cycle Assessment (LCA)',
    },
  },
});

const startedAt = new Date(Date.now() - 2000).toISOString();

// ---------------------------------------------------------------------------
head('1. Services, health and Swagger');
for (const [name, base] of [
  ['auth', AUTH],
  ['passport', PASS],
  ['document', DOC],
]) {
  const h = await call('GET', `${base}/health`);
  check(`${name}-service /health is ok`, h.status === 200 && h.body?.status === 'ok', h.text);
  const d = await call('GET', `${base}/docs.json`);
  check(`${name}-service Swagger spec served`, d.status === 200 && !!d.body?.openapi, d.status);
}
const nh = await call('GET', 'http://localhost:4004/health');
check('notification-service /health is ok', nh.status === 200, nh.text);

// ---------------------------------------------------------------------------
head('2. Auth: registration, login, JWT');
const pw = 'Passw0rd!' + run;
const acct = (r) => ({ email: `${r}-${run}@e2e.test`, password: pw });
const reg = {};
for (const role of ['admin', 'developer', 'tester', 'user']) {
  const r = await call('POST', `${AUTH}/api/auth/register`, { body: { ...acct(role), role } });
  reg[role] = r;
  check(
    `register with role "${role}" -> 201 and role ${role}`,
    r.status === 201 && r.body?.data?.user?.role === role,
    r.text,
  );
}
const noRole = await call('POST', `${AUTH}/api/auth/register`, { body: acct('norole') });
check(
  'register without role defaults to "user"',
  noRole.status === 201 && noRole.body?.data?.user?.role === 'user',
  noRole.text,
);
check('password is never returned', !JSON.stringify(reg.admin.body).includes(pw));
const dup = await call('POST', `${AUTH}/api/auth/register`, { body: { ...acct('admin'), role: 'admin' } });
check('duplicate email -> 409', dup.status === 409, dup.status);
const badRole = await call('POST', `${AUTH}/api/auth/register`, {
  body: { ...acct('bad'), role: 'superuser' },
});
check('unknown role -> 422', badRole.status === 422, badRole.status);
const badBody = await call('POST', `${AUTH}/api/auth/register`, { body: { email: 'nope', password: 'x' } });
check('invalid email/short password -> 422', badBody.status === 422, badBody.status);

const tokens = {};
for (const role of ['admin', 'developer', 'tester', 'user']) {
  const r = await call('POST', `${AUTH}/api/auth/login`, { body: acct(role) });
  tokens[role] = r.body?.data?.token;
  check(
    `login as ${role} -> JWT`,
    r.status === 200 && typeof tokens[role] === 'string' && r.body.data.tokenType === 'Bearer',
    r.text,
  );
}
const claims = JSON.parse(Buffer.from(tokens.admin.split('.')[1], 'base64url').toString());
check('JWT carries sub, email, role, exp', !!claims.sub && claims.role === 'admin' && !!claims.exp);
const wrong = await call('POST', `${AUTH}/api/auth/login`, {
  body: { ...acct('admin'), password: 'WrongPassw0rd' },
});
check('wrong password -> 401', wrong.status === 401, wrong.status);
const me = await call('GET', `${AUTH}/api/auth/me`, { token: tokens.developer });
check(
  '/api/auth/me returns current user',
  me.status === 200 && me.body?.data?.user?.role === 'developer',
  me.text,
);
const noTok = await call('GET', `${AUTH}/api/auth/me`);
check('/api/auth/me without token -> 401', noTok.status === 401);
const forged = await call('GET', `${AUTH}/api/auth/me`, { token: tokens.admin.slice(0, -4) + 'AAAA' });
check('tampered token -> 401', forged.status === 401);

// ---------------------------------------------------------------------------
head('3. Passport CRUD and role-based access (HTTP token check via auth service)');
const create = await call('POST', `${PASS}/api/passports`, {
  token: tokens.admin,
  body: samplePassport(`BP-E2E-${run}-A`),
});
const pid = create.body?.data?.id;
check('admin creates passport with the doc sample body -> 201', create.status === 201 && !!pid, create.text);
check(
  'manufacturerInformation stays nested in generalInformation',
  create.body?.data?.data?.generalInformation?.manufacturerInformation?.manufacturerName === 'Tesla Inc',
);
const devCreate = await call('POST', `${PASS}/api/passports`, {
  token: tokens.developer,
  body: samplePassport(`BP-E2E-${run}-D`),
});
check('developer can create -> 201', devCreate.status === 201, devCreate.status);
const testerCreate = await call('POST', `${PASS}/api/passports`, {
  token: tokens.tester,
  body: samplePassport(`BP-E2E-${run}-T`),
});
check('tester can create -> 201', testerCreate.status === 201, testerCreate.status);
const userCreate = await call('POST', `${PASS}/api/passports`, {
  token: tokens.user,
  body: samplePassport(`BP-E2E-${run}-U`),
});
check('user cannot create -> 403', userCreate.status === 403, userCreate.status);
const anonCreate = await call('POST', `${PASS}/api/passports`, { body: samplePassport(`BP-E2E-${run}-X`) });
check('no token -> 401', anonCreate.status === 401, anonCreate.status);
const dupPassport = await call('POST', `${PASS}/api/passports`, {
  token: tokens.admin,
  body: samplePassport(`BP-E2E-${run}-A`),
});
check('duplicate battery identifier -> 409', dupPassport.status === 409, dupPassport.status);
const invalid = await call('POST', `${PASS}/api/passports`, {
  token: tokens.admin,
  body: { data: { generalInformation: {} } },
});
check(
  'invalid body -> 422 with field details',
  invalid.status === 422 && invalid.body?.error?.details?.length > 0,
  invalid.status,
);

for (const role of ['admin', 'user']) {
  const g = await call('GET', `${PASS}/api/passports/${pid}`, { token: tokens[role] });
  check(`${role} can view passport -> 200`, g.status === 200 && g.body?.data?.id === pid, g.status);
}
check(
  'malformed id -> 400',
  (await call('GET', `${PASS}/api/passports/not-an-id`, { token: tokens.user })).status === 400,
);
check(
  'unknown id -> 404',
  (await call('GET', `${PASS}/api/passports/000000000000000000000000`, { token: tokens.user })).status ===
    404,
);

const updBody = samplePassport(`BP-E2E-${run}-A`);
updBody.data.generalInformation.batteryMass = 470;
const upd = await call('PUT', `${PASS}/api/passports/${pid}`, { token: tokens.admin, body: updBody });
check(
  'admin updates -> 200 with new value',
  upd.status === 200 && upd.body?.data?.data?.generalInformation?.batteryMass === 470,
  upd.text,
);
check(
  'developer can update -> 200',
  (await call('PUT', `${PASS}/api/passports/${pid}`, { token: tokens.developer, body: updBody })).status ===
    200,
);
check(
  'tester cannot update -> 403',
  (await call('PUT', `${PASS}/api/passports/${pid}`, { token: tokens.tester, body: updBody })).status === 403,
);
check(
  'user cannot update -> 403',
  (await call('PUT', `${PASS}/api/passports/${pid}`, { token: tokens.user, body: updBody })).status === 403,
);

const list = await call('GET', `${PASS}/api/passports?limit=100&q=BP-2024-01`, { token: tokens.user });
const seeded = ['BP-2024-011', 'BP-2024-012', 'BP-2024-013'].every((id) =>
  list.body?.data?.items?.some((p) => p.data.generalInformation.batteryIdentifier === id),
);
check(
  'list/search works and demo passports are seeded',
  list.status === 200 && seeded,
  list.text.slice(0, 200),
);
const all = await call('GET', `${PASS}/api/passports?limit=100`, { token: tokens.user });
check('at least 10 passports exist (demo seed)', (all.body?.data?.total ?? 0) >= 10, all.body?.data?.total);

// ---------------------------------------------------------------------------
head('4. Document service (S3 via LocalStack, metadata in MongoDB)');
const upload = (token, content, name = `report-${run}.txt`, type = 'text/plain', passportId = pid) => {
  const form = new FormData();
  form.append('file', new Blob([content], { type }), name);
  if (passportId) form.append('passportId', passportId);
  return call('POST', `${DOC}/api/documents/upload`, { token, form });
};
const up = await upload(tokens.admin, `hello from ${run}`);
const docId = up.body?.data?.docId;
check(
  'admin upload -> 201 with { docId, fileName, createdAt }',
  up.status === 201 && !!docId && !!up.body.data.fileName && !!up.body.data.createdAt,
  up.text,
);
check('tester upload -> 201', (await upload(tokens.tester, 'tester file')).status === 201);
check('developer upload -> 201', (await upload(tokens.developer, 'dev file')).status === 201);
check('user upload -> 403', (await upload(tokens.user, 'user file')).status === 403);
check('upload without token -> 401', (await upload(undefined, 'x')).status === 401);
check(
  'upload to unknown passport -> 422',
  (await upload(tokens.admin, 'x', 'a.txt', 'text/plain', '000000000000000000000000')).status === 422,
);
check(
  'disallowed file type -> 415',
  (await upload(tokens.admin, 'MZ', 'evil.exe', 'application/x-msdownload')).status === 415,
);

const link = await call('GET', `${DOC}/api/documents/${docId}`, { token: tokens.user });
const url = link.body?.data?.downloadUrl;
check(
  'user gets a pre-signed download link -> 200',
  link.status === 200 && typeof url === 'string' && url.includes('X-Amz-Signature'),
  link.text,
);
if (url) {
  const file = await fetch(url);
  check(
    'download link returns the uploaded bytes',
    file.ok && (await file.text()) === `hello from ${run}`,
    file.status,
  );
}
const rename = await call('PUT', `${DOC}/api/documents/${docId}`, {
  token: tokens.admin,
  body: { fileName: `renamed-${run}.txt` },
});
check(
  'admin updates metadata -> 200',
  rename.status === 200 && rename.body?.data?.fileName === `renamed-${run}.txt`,
  rename.text,
);
check(
  'developer updates metadata -> 200',
  (
    await call('PUT', `${DOC}/api/documents/${docId}`, {
      token: tokens.developer,
      body: { fileName: `dev-${run}.txt` },
    })
  ).status === 200,
);
check(
  'tester cannot update metadata -> 403',
  (await call('PUT', `${DOC}/api/documents/${docId}`, { token: tokens.tester, body: { fileName: 'x.txt' } }))
    .status === 403,
);
check(
  'developer cannot delete -> 403',
  (await call('DELETE', `${DOC}/api/documents/${docId}`, { token: tokens.developer })).status === 403,
);
const del = await call('DELETE', `${DOC}/api/documents/${docId}`, { token: tokens.admin });
check('admin deletes document -> 200/204', [200, 204].includes(del.status), del.status);
check(
  'deleted document -> 404',
  (await call('GET', `${DOC}/api/documents/${docId}`, { token: tokens.admin })).status === 404,
);
if (url) check('S3 object is gone after delete', !(await fetch(url)).ok);

// ---------------------------------------------------------------------------
head('5. Passport delete and Kafka events -> notification service');
check(
  'developer cannot delete passport -> 403',
  (await call('DELETE', `${PASS}/api/passports/${pid}`, { token: tokens.developer })).status === 403,
);
check(
  'tester cannot delete passport -> 403',
  (await call('DELETE', `${PASS}/api/passports/${pid}`, { token: tokens.tester })).status === 403,
);
const pdel = await call('DELETE', `${PASS}/api/passports/${pid}`, { token: tokens.admin });
check('admin deletes passport -> 200/204', [200, 204].includes(pdel.status), pdel.status);
check(
  'deleted passport -> 404',
  (await call('GET', `${PASS}/api/passports/${pid}`, { token: tokens.admin })).status === 404,
);

await sleep(4000);
const nlog = logs('notification-service', startedAt);
for (const type of ['passport.created', 'passport.updated', 'passport.deleted']) {
  const seen = nlog.split('\n').some((l) => l.includes(type) && l.includes(pid));
  check(`notification service consumed ${type} for this passport`, seen);
}
const allLogs = logs('passport-service', '24h') + logs('notification-service', '24h');
check('events use topic battery-passport-events', allLogs.includes('"topic":"battery-passport-events"'));

// ---------------------------------------------------------------------------
head('6. Password reset');
const f = await call('POST', `${AUTH}/api/auth/forgot-password`, { body: { email: acct('user').email } });
const fUnknown = await call('POST', `${AUTH}/api/auth/forgot-password`, {
  body: { email: `nobody-${run}@e2e.test` },
});
check('forgot-password -> 200', f.status === 200, f.text);
check(
  'same response for unknown email',
  fUnknown.status === 200 && JSON.stringify(fUnknown.body.data) === JSON.stringify(f.body.data),
);
await sleep(500);
const alog = logs('auth-service', startedAt);
const match = [...alog.matchAll(/"resetUrl":"([^"]+)"/g)]
  .map((m) => m[1])
  .filter((u) => u.includes('/reset-password?token='));
const resetUrl = match.at(-1);
check(
  'reset link generated (logged, since SMTP is not configured locally)',
  !!resetUrl && resetUrl.startsWith('http://localhost:3000/reset-password'),
);
if (resetUrl) {
  const token = new URL(resetUrl).searchParams.get('token');
  await sleep(1100);
  const newPw = 'N3wPassw0rd!' + run;
  const r = await call('POST', `${AUTH}/api/auth/reset-password`, { body: { token, password: newPw } });
  check('reset-password -> 200', r.status === 200, r.text);
  check(
    'old password rejected',
    (await call('POST', `${AUTH}/api/auth/login`, { body: acct('user') })).status === 401,
  );
  check(
    'new password works',
    (await call('POST', `${AUTH}/api/auth/login`, { body: { email: acct('user').email, password: newPw } }))
      .status === 200,
  );
  const revoked = await call('GET', `${AUTH}/api/auth/me`, { token: tokens.user });
  check(
    'session from before the reset is revoked',
    revoked.status === 401 && revoked.body?.error?.code === 'TOKEN_REVOKED',
    revoked.text,
  );
  const reuse = await call('POST', `${AUTH}/api/auth/reset-password`, {
    body: { token, password: 'AnotherPassw0rd' },
  });
  check('reset link works only once -> 400', reuse.status === 400, reuse.status);
}

// ---------------------------------------------------------------------------
head('7. Admin user-role management');
const users = await call('GET', `${AUTH}/api/auth/users?limit=100&q=${run}`, { token: tokens.admin });
check('admin lists users', users.status === 200 && users.body?.data?.items?.length >= 5, users.status);
check(
  'developer cannot list users -> 403',
  (await call('GET', `${AUTH}/api/auth/users`, { token: tokens.developer })).status === 403,
);
const target = users.body?.data?.items?.find((u) => u.email === acct('norole').email);
const promote = await call('PATCH', `${AUTH}/api/auth/users/${target?.id}/role`, {
  token: tokens.admin,
  body: { role: 'developer' },
});
check(
  'admin changes a user role',
  promote.status === 200 && promote.body?.data?.role === 'developer',
  promote.text,
);
const self = users.body?.data?.items?.find((u) => u.email === acct('admin').email);
check(
  'admin cannot change own role',
  (
    await call('PATCH', `${AUTH}/api/auth/users/${self?.id}/role`, {
      token: tokens.admin,
      body: { role: 'user' },
    })
  ).status >= 400,
);

// ---------------------------------------------------------------------------
head('8. Web app (BFF with httpOnly cookie)');
for (const p of ['/login', '/register', '/forgot-password', '/reset-password?token=x']) {
  check(`GET ${p} -> 200`, (await call('GET', `${WEB}${p}`)).status === 200);
}
check(
  'protected page redirects to /login when signed out',
  (await call('GET', `${WEB}/passports`)).status === 307,
);
const wl = await call('POST', `${WEB}/api/auth/login`, { body: acct('admin') });
const cookie = wl.headers.get('set-cookie') ?? '';
check(
  'web login sets an httpOnly session cookie, token not in body',
  wl.status === 200 && /httponly/i.test(cookie) && !wl.text.includes('eyJ'),
);
const session = cookie.split(';')[0];
const proxied = await call('GET', `${WEB}/api/proxy/passports?limit=5`, { headers: { cookie: session } });
check(
  'web proxy lists passports with the session',
  proxied.status === 200 && proxied.body?.success === true,
  proxied.status,
);
const proxiedDocs = await call('GET', `${WEB}/api/proxy/documents?limit=5`, { headers: { cookie: session } });
check('web proxy lists documents with the session', proxiedDocs.status === 200, proxiedDocs.status);
check('web proxy without session -> 401', (await call('GET', `${WEB}/api/proxy/passports`)).status === 401);
const wr = await call('POST', `${WEB}/api/auth/register`, { body: { ...acct('webreg'), role: 'admin' } });
check(
  'web sign-up ignores a role and creates "user"',
  wr.status === 201 && wr.body?.data?.user?.role === 'user',
  wr.text,
);

// ---------------------------------------------------------------------------
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
if (failed.length) {
  console.log('Failed:');
  for (const r of failed) console.log(`  [${r.section}] ${r.name}`);
  process.exit(1);
}
