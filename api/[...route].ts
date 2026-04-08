import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";

neonConfig.poolQueryViaFetch = true;

let pool: Pool | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
  }

  return pool;
}

function sendJson(res: any, status: number, body: unknown) {
  res.status(status);
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function getProjects() {
  const db = getPool();

  if (!db) {
    return [];
  }

  try {
    const result = await db.query("SELECT * FROM projects ORDER BY created_at DESC");
    return result.rows;
  } catch (error) {
    console.error("Ordered projects query failed:", error);
  }

  try {
    const result = await db.query("SELECT * FROM projects");
    return result.rows;
  } catch (error) {
    console.error("Projects query failed:", error);
    return [];
  }
}

async function getProjectById(projectId: number) {
  const db = getPool();

  if (!db) {
    return null;
  }

  try {
    const result = await db.query("SELECT * FROM projects WHERE id=$1", [projectId]);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("Project by id query failed:", error);
    return null;
  }
}

export default async function handler(req: any, res: any) {
  try {
    const host = req.headers?.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);
    const path = url.pathname;
    const method = (req.method || "GET").toUpperCase();

    if (method === "GET" && path === "/api/me") {
      return sendJson(res, 200, null);
    }

    if (method === "POST" && path === "/api/logout") {
      return sendJson(res, 200, { message: "Logged out" });
    }

    if (method === "GET" && path === "/api/projects") {
      const projects = await getProjects();
      return sendJson(res, 200, projects);
    }

    if (method === "GET" && path === "/api/my-projects") {
      return sendJson(res, 200, []);
    }

    const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
    if (method === "GET" && projectMatch) {
      const project = await getProjectById(Number(projectMatch[1]));
      return sendJson(res, 200, project);
    }

    return sendJson(res, 404, { message: "Not found" });
  } catch (error: any) {
    console.error("API handler error:", error);
    return sendJson(res, 500, {
      message: error?.message || "API handler failed",
    });
  }
}
