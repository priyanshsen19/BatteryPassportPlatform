/* eslint-disable no-console */
/**
 * Development helper: registers one admin and one regular user through the public API so
 * the frontend can be explored immediately. Not used by the service at runtime.
 */
const baseUrl = process.env.AUTH_SERVICE_URL ?? 'http://localhost:4001';

const accounts = [
  {
    email: process.env.SEED_ADMIN_EMAIL ?? 'admin@batterypassport.local',
    password: process.env.SEED_ADMIN_PASSWORD ?? 'AdminPassw0rd!',
    role: 'admin',
  },
  {
    email: process.env.SEED_USER_EMAIL ?? 'viewer@batterypassport.local',
    password: process.env.SEED_USER_PASSWORD ?? 'ViewerPassw0rd!',
    role: 'user',
  },
];

async function main(): Promise<void> {
  for (const account of accounts) {
    const response = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(account),
    });

    if (response.status === 201) console.log(`Created ${account.role}: ${account.email}`);
    else if (response.status === 409) console.log(`Already exists: ${account.email}`);
    else
      throw new Error(
        `Registering ${account.email} failed with HTTP ${response.status}: ${await response.text()}`,
      );
  }
}

main().catch((err: Error) => {
  console.error(err.message);
  process.exit(1);
});
