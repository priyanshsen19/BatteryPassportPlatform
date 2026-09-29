/* eslint-disable no-console */
/**
 * Development helper: creates demo accounts through the public API so the frontend can be
 * explored immediately. Registration always creates `user` accounts, so roles are then
 * assigned by signing in as the bootstrap admin (BOOTSTRAP_ADMIN_EMAIL/PASSWORD from .env).
 * Not used by the service at runtime.
 */
type Role = 'developer' | 'tester' | 'user';

const baseUrl = process.env.AUTH_SERVICE_URL?.startsWith('http://localhost')
  ? process.env.AUTH_SERVICE_URL
  : 'http://localhost:4001';

const admin = {
  email: process.env.SEED_ADMIN_EMAIL ?? process.env.BOOTSTRAP_ADMIN_EMAIL,
  password: process.env.SEED_ADMIN_PASSWORD ?? process.env.BOOTSTRAP_ADMIN_PASSWORD,
};

const accounts: { email: string; password: string; role: Role }[] = [
  { email: 'developer@batterypassport.local', password: 'DeveloperPassw0rd!', role: 'developer' },
  { email: 'tester@batterypassport.local', password: 'TesterPassw0rd!', role: 'tester' },
  { email: 'viewer@batterypassport.local', password: 'ViewerPassw0rd!', role: 'user' },
];

async function call<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init.token ? { authorization: `Bearer ${init.token}` } : {}),
    },
  });
  return { status: response.status, body: (await response.json()) as T };
}

async function main(): Promise<void> {
  for (const account of accounts) {
    const { status } = await call('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ email: account.email, password: account.password }),
    });
    if (status === 201) console.log(`Registered ${account.email}`);
    else if (status === 409) console.log(`Already exists: ${account.email}`);
    else throw new Error(`Registering ${account.email} failed with HTTP ${status}`);
  }

  if (!admin.email || !admin.password) {
    console.log(
      '\nNo bootstrap admin configured (BOOTSTRAP_ADMIN_EMAIL/PASSWORD); all accounts stay "user".',
    );
    return;
  }

  const login = await call<{ data: { token: string } }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(admin),
  });
  if (login.status !== 200) throw new Error(`Signing in as ${admin.email} failed with HTTP ${login.status}`);
  const token = login.body.data.token;

  const users = await call<{ data: { items: { id: string; email: string }[] } }>(
    '/api/auth/users?limit=100',
    {
      token,
    },
  );
  for (const account of accounts.filter((a) => a.role !== 'user')) {
    const user = users.body.data.items.find((u) => u.email === account.email);
    if (!user) continue;
    const { status } = await call(`/api/auth/users/${user.id}/role`, {
      method: 'PATCH',
      token,
      body: JSON.stringify({ role: account.role }),
    });
    console.log(
      status === 200 ? `Set ${account.email} to ${account.role}` : `Could not set role (HTTP ${status})`,
    );
  }
  console.log(`\nAdmin: ${admin.email} (from BOOTSTRAP_ADMIN_EMAIL)`);
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
