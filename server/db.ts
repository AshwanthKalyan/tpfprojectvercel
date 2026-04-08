import { drizzle } from "drizzle-orm/neon-serverless";
import { Pool, neonConfig } from "@neondatabase/serverless";
import * as schema from "../shared/schema";

// Prefer HTTPS fetch for Pool queries to avoid WebSocket restrictions.
neonConfig.poolQueryViaFetch = true;

export const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);

if (!hasDatabaseUrl) {
  console.warn(
    "DATABASE_URL is not set. Database-backed routes will run in fallback mode.",
  );
}

export const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ??
    "postgresql://placeholder:placeholder@127.0.0.1:5432/placeholder",
});

export const db = drizzle(pool, { schema });
