// Server-side Drizzle client.
//
// IMPORTANT: do NOT import this from a client component. It opens a Postgres
// connection using DATABASE_URL (a server secret). Use server actions /
// route handlers / RSCs only.
//
// Connection: postgres-js driver pointed at Supabase's Session Pooler
// (port 5432, IPv4-proxied). `prepare: false` is required because the pooler
// doesn't keep prepared statements across queries.

import "server-only";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set.");
}

// Module-level singleton — hot reload may instantiate multiple, but Next's
// dev server caches modules so in practice we get one pool per worker.
const queryClient = postgres(process.env.DATABASE_URL, {
  prepare: false,
});

export const db = drizzle(queryClient, { schema });
export { schema };
