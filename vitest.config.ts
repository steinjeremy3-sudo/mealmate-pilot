// Vitest configuration.
//
// node environment, no JSX/component testing yet. Two resolve aliases
// let server-side modules load under test:
//   - "@/…"        → src/…  (the app's import alias; mirrors tsconfig)
//   - "server-only" → an empty stub (the real package throws outside a
//                     React Server context, breaking any test that
//                     imports a server module)

import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

const root = import.meta.dirname;

export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(root, "src"),
      "server-only": resolve(root, "src/test-support/empty-module.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    // Unit tests must NOT hit the real database. DB-dependent code is
    // exercised against the in-memory fake (src/test-support/
    // fake-supabase.ts); real connectivity is the `npm run db:ping`
    // script.
  },
});
