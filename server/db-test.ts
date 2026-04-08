import { pool } from "./db";

(async () => {
  try {
    // Run a simple query to check DB connection
    const res = await pool.query<{ now: string }>("SELECT NOW()");

    console.log("✅ DB is working:", res.rows[0].now);
  } catch (err) {
    console.error("❌ DB ERROR:", err);
  } finally {
    // Close the pool to exit cleanly
    await pool.end();
  }
})();