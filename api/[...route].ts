import "dotenv/config";
import { Pool, neonConfig } from "@neondatabase/serverless";

neonConfig.poolQueryViaFetch = true;

type AuthUser = {
  userId: string;
  email: string | null;
};

let pool: Pool | null = null;
const tableColumnsCache = new Map<string, Promise<Set<string>>>();

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

function decodeJwtPayload(token: string) {
  try {
    const [, payload] = token.split(".");
    if (!payload) {
      return null;
    }

    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch (error) {
    console.error("Failed to decode auth token:", error);
    return null;
  }
}

function getAuthUser(req: any): AuthUser | null {
  const authHeader = req.headers?.authorization || req.headers?.Authorization;
  if (typeof authHeader !== "string" || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const payload = decodeJwtPayload(authHeader.slice("Bearer ".length));
  const userId = payload?.sub;

  if (typeof userId !== "string" || userId.length === 0) {
    return null;
  }

  const email =
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload.email_address === "string" && payload.email_address) ||
    (typeof payload.primary_email_address === "string" &&
      payload.primary_email_address) ||
    `${userId}@nitt.edu`;

  return { userId, email };
}

async function parseJsonBody(req: any) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string" && req.body.length > 0) {
    return JSON.parse(req.body);
  }

  const chunks: Buffer[] = [];

  await new Promise<void>((resolve, reject) => {
    req.on("data", (chunk: Buffer | string) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    req.on("end", () => resolve());
    req.on("error", (error: unknown) => reject(error));
  });

  if (chunks.length === 0) {
    return {};
  }

  const text = Buffer.concat(chunks).toString("utf8");
  return text ? JSON.parse(text) : {};
}

async function getTableColumns(tableName: string) {
  const db = getPool();
  if (!db) {
    return new Set<string>();
  }

  let columnsPromise = tableColumnsCache.get(tableName);
  if (!columnsPromise) {
    columnsPromise = db
      .query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1`,
        [tableName]
      )
      .then((result) => new Set(result.rows.map((row) => row.column_name)))
      .catch((error) => {
        tableColumnsCache.delete(tableName);
        throw error;
      });
    tableColumnsCache.set(tableName, columnsPromise);
  }

  return columnsPromise;
}

async function ensureUser(authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    return;
  }

  const userColumns = await getTableColumns("users");
  if (!userColumns.has("id")) {
    return;
  }

  const columns = ["id"];
  const values: Array<string | null> = [authUser.userId];

  if (userColumns.has("email")) {
    columns.push("email");
    values.push(authUser.email);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const updateClause = userColumns.has("email")
    ? "ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email"
    : "ON CONFLICT (id) DO NOTHING";

  await db.query(
    `INSERT INTO users (${columns.join(", ")})
     VALUES (${placeholders})
     ${updateClause}`,
    values
  );
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

async function getProjectsForOwner(ownerId: string) {
  const db = getPool();
  if (!db) {
    return [];
  }

  try {
    const result = await db.query(
      "SELECT * FROM projects WHERE owner_id=$1 ORDER BY created_at DESC",
      [ownerId]
    );
    return result.rows;
  } catch (error) {
    console.error("Owner projects query failed:", error);
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

async function createProject(body: any, authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  await ensureUser(authUser);

  const projectColumns = await getTableColumns("projects");
  const values: any[] = [];
  const columns: string[] = [];

  const add = (column: string, value: any) => {
    if (!projectColumns.has(column)) {
      return;
    }

    columns.push(column);
    values.push(value);
  };

  add("title", body.title ?? "Untitled Project");
  add("description", body.description ?? null);
  add("owner_id", authUser.userId);
  add("tech_stack", Array.isArray(body.tech_stack) ? body.tech_stack : null);
  add(
    "skills_required",
    Array.isArray(body.skills_required) ? body.skills_required : null
  );
  add("collaborators_needed", body.collaborators_needed ?? null);
  add("project_type", body.project_type ?? null);
  add("duration", body.duration ?? null);
  add("contact_info", body.contact_info ?? null);
  add("required_skills", body.required_skills ?? null);
  add("comms_link", body.comms_link ?? null);
  add("members_needed", body.members_needed ?? null);

  if (!columns.includes("title")) {
    throw new Error("Projects table is missing a title column");
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const result = await db.query(
    `INSERT INTO projects (${columns.join(", ")})
     VALUES (${placeholders})
     RETURNING *`,
    values
  );

  return result.rows[0] ?? null;
}

async function getApplicationsForProject(projectId: number, authUser: AuthUser | null) {
  const db = getPool();
  if (!db || !authUser) {
    return [];
  }

  const project = await getProjectById(projectId);
  if (!project) {
    return [];
  }

  const isOwner = project.owner_id === authUser.userId;

  try {
    if (isOwner) {
      const result = await db.query(
        `SELECT
          a.*,
          u.id AS user_id,
          u.email,
          u.first_name,
          u.last_name,
          u.department,
          u.year_of_study,
          u.year,
          u.skills,
          u.bio,
          u.github_url,
          u.resume_url AS user_resume_url
         FROM applications a
         LEFT JOIN users u ON a.applicant_id = u.id
         WHERE a.project_id = $1
         ORDER BY a.created_at DESC`,
        [projectId]
      );

      return result.rows.map((row) => ({
        id: row.id,
        projectId: row.project_id,
        applicantId: row.applicant_id,
        resumeUrl: row.resume_url,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
        applicant: {
          id: row.user_id,
          email: row.email,
          firstName: row.first_name ?? null,
          lastName: row.last_name ?? null,
          department: row.department ?? null,
          year: row.year_of_study ?? row.year ?? null,
          skills: row.skills ?? null,
          bio: row.bio ?? null,
          githubUrl: row.github_url ?? null,
          resumeUrl: row.user_resume_url ?? null,
        },
      }));
    }

    const result = await db.query(
      `SELECT *
       FROM applications
       WHERE project_id=$1 AND applicant_id=$2
       ORDER BY created_at DESC`,
      [projectId, authUser.userId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      applicantId: row.applicant_id,
      resumeUrl: row.resume_url,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
    }));
  } catch (error) {
    console.error("Project applications query failed:", error);
    return [];
  }
}

async function createApplication(projectId: number, body: any, authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.owner_id === authUser.userId) {
    throw new Error("Cannot apply to your own project");
  }

  await ensureUser(authUser);

  try {
    const existing = await db.query(
      "SELECT id FROM applications WHERE project_id=$1 AND applicant_id=$2",
      [projectId, authUser.userId]
    );

    if (existing.rows[0]) {
      throw new Error("Already applied");
    }
  } catch (error: any) {
    if (error instanceof Error && error.message === "Already applied") {
      throw error;
    }
    console.error("Existing application lookup failed:", error);
  }

  const result = await db.query(
    `INSERT INTO applications
      (project_id, applicant_id, resume_url, message, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [projectId, authUser.userId, body.resumeUrl ?? null, body.message ?? null]
  );

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    applicantId: row.applicant_id,
    resumeUrl: row.resume_url,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function updateProject(projectId: number, body: any, authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.owner_id !== authUser.userId) {
    throw new Error("Not authorized");
  }

  const projectColumns = await getTableColumns("projects");
  const assignments: string[] = [];
  const values: any[] = [];

  const add = (column: string, value: any) => {
    if (!projectColumns.has(column) || typeof value === "undefined") {
      return;
    }

    values.push(value);
    assignments.push(`${column}=$${values.length}`);
  };

  add("title", body.title);
  add("description", body.description);
  add("duration", body.duration);
  add("comms_link", body.comms_link);

  if (assignments.length === 0) {
    return project;
  }

  values.push(projectId);
  values.push(authUser.userId);

  const result = await db.query(
    `UPDATE projects
     SET ${assignments.join(", ")}
     WHERE id=$${values.length - 1} AND owner_id=$${values.length}
     RETURNING *`,
    values
  );

  return result.rows[0] ?? project;
}

async function deleteProject(projectId: number, authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (project.owner_id !== authUser.userId) {
    throw new Error("Not authorized");
  }

  try {
    await db.query("DELETE FROM applications WHERE project_id=$1", [projectId]);
  } catch (error) {
    console.warn("Delete project applications warning:", error);
  }

  await db.query("DELETE FROM projects WHERE id=$1 AND owner_id=$2", [
    projectId,
    authUser.userId,
  ]);
}

async function updateApplicationStatus(
  applicationId: number,
  status: "pending" | "accepted" | "rejected",
  authUser: AuthUser
) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const result = await db.query(
    `UPDATE applications a
     SET status=$1
     WHERE a.id=$2
       AND EXISTS (
         SELECT 1
         FROM projects p
         WHERE p.id = a.project_id
           AND p.owner_id = $3
       )
     RETURNING *`,
    [status, applicationId, authUser.userId]
  );

  if (!result.rows[0]) {
    throw new Error("Application not found");
  }

  const row = result.rows[0];
  return {
    id: row.id,
    projectId: row.project_id,
    applicantId: row.applicant_id,
    resumeUrl: row.resume_url,
    message: row.message,
    status: row.status,
    createdAt: row.created_at,
  };
}

export default async function handler(req: any, res: any) {
  try {
    const host = req.headers?.host || "localhost";
    const url = new URL(req.url || "/", `https://${host}`);
    const path = url.pathname;
    const method = (req.method || "GET").toUpperCase();
    const authUser = getAuthUser(req);

    if (method === "GET" && path === "/api/me") {
      return sendJson(
        res,
        200,
        authUser
          ? {
              id: authUser.userId,
              email: authUser.email,
              firstName: null,
              lastName: null,
              department: null,
              year: null,
              skills: null,
              bio: null,
              githubUrl: null,
              resumeUrl: null,
            }
          : null
      );
    }

    if (method === "POST" && path === "/api/logout") {
      return sendJson(res, 200, { message: "Logged out" });
    }

    if (method === "GET" && path === "/api/projects") {
      const projects = await getProjects();
      return sendJson(res, 200, projects);
    }

    if (method === "POST" && path === "/api/projects") {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const body = await parseJsonBody(req);
      const project = await createProject(body, authUser);
      return sendJson(res, 201, project);
    }

    if (method === "GET" && path === "/api/my-projects") {
      if (!authUser) {
        return sendJson(res, 200, []);
      }

      const projects = await getProjectsForOwner(authUser.userId);
      return sendJson(res, 200, projects);
    }

    const projectMatch = path.match(/^\/api\/projects\/(\d+)$/);
    if (method === "GET" && projectMatch) {
      const project = await getProjectById(Number(projectMatch[1]));
      return sendJson(res, project ? 200 : 404, project ?? { message: "Project not found" });
    }

    if (method === "PATCH" && projectMatch) {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const body = await parseJsonBody(req);
      const project = await updateProject(Number(projectMatch[1]), body, authUser);
      return sendJson(res, 200, project);
    }

    if (method === "DELETE" && projectMatch) {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      await deleteProject(Number(projectMatch[1]), authUser);
      return sendJson(res, 200, { message: "Project deleted" });
    }

    const projectApplicationsMatch = path.match(
      /^\/api\/projects\/(\d+)\/applications$/
    );
    if (method === "GET" && projectApplicationsMatch) {
      const applications = await getApplicationsForProject(
        Number(projectApplicationsMatch[1]),
        authUser
      );
      return sendJson(res, 200, applications);
    }

    if (method === "POST" && projectApplicationsMatch) {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const body = await parseJsonBody(req);
      const application = await createApplication(
        Number(projectApplicationsMatch[1]),
        body,
        authUser
      );
      return sendJson(res, 201, application);
    }

    const applicationStatusMatch = path.match(/^\/api\/applications\/(\d+)\/status$/);
    if (method === "PATCH" && applicationStatusMatch) {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const body = await parseJsonBody(req);
      const status =
        body?.status === "accepted" || body?.status === "rejected"
          ? body.status
          : "pending";
      const application = await updateApplicationStatus(
        Number(applicationStatusMatch[1]),
        status,
        authUser
      );
      return sendJson(res, 200, application);
    }

    return sendJson(res, 404, { message: "Not found" });
  } catch (error: any) {
    console.error("API handler error:", error);
    const message = error?.message || "API handler failed";
    const status =
      message === "Not logged in"
        ? 401
        : message === "Not authorized"
          ? 403
          : message === "Project not found" || message === "Application not found"
            ? 404
            : message === "Already applied" || message === "Cannot apply to your own project"
              ? 409
              : 500;
    return sendJson(res, status, { message });
  }
}
