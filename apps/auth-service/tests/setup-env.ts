process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = 'mongodb://127.0.0.1:27017/auth_test';
process.env.JWT_SECRET = 'test-secret-that-is-at-least-thirty-two-characters';
process.env.BCRYPT_SALT_ROUNDS = '4';
process.env.ADMIN_ACCESS_CODE = 'test-access-code-2026';
// Generous limits so functional tests are not throttled; rate-limit.test.ts sets its own.
process.env.LOGIN_MAX_FAILED_ATTEMPTS ??= '1000';
process.env.PASSWORD_RESET_MAX_REQUESTS ??= '1000';
process.env.ACCESS_CODE_MAX_FAILED_ATTEMPTS ??= '1000';
