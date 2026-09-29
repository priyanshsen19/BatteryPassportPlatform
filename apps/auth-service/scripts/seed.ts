/* eslint-disable no-console */
/**
 * Development helper: registers demo accounts for the developer, tester and user roles through
 * the public API so the frontend can be explored immediately. The admin comes from
 * BOOTSTRAP_ADMIN_EMAIL/PASSWORD. Not used by the service at runtime.
 */
const baseUrl = process.env.AUTH_SERVICE_URL?.startsWith('http://localhost')
  ? process.env.AUTH_SERVICE_URL
  : 'http://localhost:4001';

const accounts = [
  { email: 'developer@batterypassport.local', password: 'DeveloperPassw0rd!', role: 'developer' },
  { email: 'tester@batterypassport.local', password: 'TesterPassw0rd!', role: 'tester' },
  { email: 'viewer@batterypassport.local', password: 'ViewerPassw0rd!', role: 'user' },
];

async function main(): Promise<void> {
  for (const account of accounts) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(account),
    });
    if (response.status === 201) console.log(`Registered ${account.email} (${account.role})`);
    else if (response.status === 409) console.log(`Already exists: ${account.email}`);
    else throw new Error(`Registering ${account.email} failed with HTTP ${response.status}`);
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
