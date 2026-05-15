import { defineConfig } from "vitest/config";
import path from "path";
import { config } from "dotenv";

// Load .env.test so TEST_DATABASE_URL is available at config time
config({ path: ".env.test" });

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/setup.ts"],
    // Inject DATABASE_URL before any test module (including db/db.ts) is loaded
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "",
    },
    coverage: {
      reporter: ["text", "html"],
      include: ["app/api/**", "lib/**", "workers/src/**"],
    },
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, ".") },
  },
});
