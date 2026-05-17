// Vitest configuration. Phase 0: minimal — node environment, no JSX/component
// testing yet. Add @vitejs/plugin-react + jsdom in Phase 2+ if/when we test
// React components directly.

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Tests must NOT hit the real database. The connectivity check is the
    // `scripts/db-ping.ts` script (run manually via `npm run db:ping`).
  },
});
