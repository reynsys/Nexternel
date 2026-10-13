/**
 * Loaded before the API tests: the settings a running server gets from .env, filled with
 * harmless test values, so the tests run on any machine (nothing here connects anywhere).
 */
process.env.JWT_SECRET ??= "test-only-secret-not-used-by-any-server";
process.env.DATABASE_URL ??= "postgres://test:test@127.0.0.1:1/nexternel_test";
