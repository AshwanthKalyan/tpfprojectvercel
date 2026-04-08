import { Pool, neonConfig } from "@neondatabase/serverless";

// Prefer HTTPS fetch for Pool queries to avoid WebSocket restrictions.
neonConfig.poolQueryViaFetch = true;

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
