import { beforeAll, afterAll } from "vitest";

// Point DB client to test schema — must be set in .env.test
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL!;

beforeAll(async () => {
  // Seed minimal data if needed per-suite
});

afterAll(async () => {
  // Global cleanup if needed
});
