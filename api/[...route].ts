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

function getRequestPath(req: any) {
  const routeParam = req.query?.route;
  const normalizeRouteValue = (value: string) =>
    decodeURIComponent(String(value))
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean);

  if (Array.isArray(routeParam) && routeParam.length > 0) {
    const segments = routeParam.flatMap((segment) =>
      normalizeRouteValue(String(segment))
    );
    return `/api/${segments.join("/")}`;
  }

  if (typeof routeParam === "string" && routeParam.length > 0) {
    return `/api/${normalizeRouteValue(routeParam).join("/")}`;
  }

  const host = req.headers?.host || "localhost";
  const url = new URL(req.url || "/", `https://${host}`);
  return url.pathname;
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

function getHeaderValue(req: any, name: string) {
  const directValue = req.headers?.[name];
  const lowerCaseValue = req.headers?.[name.toLowerCase()];
  const rawValue = directValue ?? lowerCaseValue;

  if (Array.isArray(rawValue)) {
    return typeof rawValue[0] === "string" ? rawValue[0] : null;
  }

  return typeof rawValue === "string" && rawValue.length > 0 ? rawValue : null;
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
    (typeof payload.primaryEmail === "string" && payload.primaryEmail) ||
    (typeof payload.email === "string" && payload.email) ||
    (typeof payload.email_address === "string" && payload.email_address) ||
    (typeof payload.primary_email_address === "string" &&
      payload.primary_email_address) ||
    getHeaderValue(req, "x-user-email") ||
    null;

  return { userId, email };
}

function getRollNumber(email: string | null | undefined) {
  if (!email || !email.includes("@")) {
    return null;
  }

  return email.split("@")[0] || null;
}

function isSyntheticNittIdentity(value: string | null | undefined) {
  if (!value) {
    return false;
  }

  const normalized = value.trim().toLowerCase();
  return normalized.startsWith("user_");
}

function hasMeaningfulValue(value: unknown) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return value !== null && typeof value !== "undefined";
}

function getCreatorDisplayName(params: {
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  fallbackId: string | null;
}) {
  const fullName =
    params.firstName && params.lastName
      ? `${params.firstName} ${params.lastName}`.trim()
      : null;

  return (
    fullName ||
    params.email ||
    getRollNumber(params.email) ||
    params.firstName ||
    params.lastName ||
    params.fallbackId
  );
}

function normalizeUserRow(row: Record<string, any> | null, authUser?: AuthUser | null) {
  if (!row && !authUser) {
    return null;
  }

  const firstName = row?.first_name ?? row?.firstName ?? null;
  const lastName = row?.last_name ?? row?.lastName ?? null;
  const rowEmail = row?.email ?? null;
  const email =
    rowEmail && !isSyntheticNittIdentity(rowEmail)
      ? rowEmail
      : authUser?.email ?? rowEmail ?? null;

  return {
    id: row?.id ?? authUser?.userId ?? null,
    email,
    firstName,
    lastName,
    department: row?.department ?? null,
    year: row?.year_of_study ?? row?.year ?? null,
    skills: row?.skills ?? null,
    bio: row?.bio ?? null,
    githubUrl: row?.github_url ?? row?.githubUrl ?? null,
    resumeUrl: row?.resume_url ?? row?.resumeUrl ?? null,
    creatorName: getCreatorDisplayName({
      firstName,
      lastName,
      email,
      fallbackId: row?.id ?? authUser?.userId ?? null,
    }),
  };
}

async function getUserById(userId: string) {
  const db = getPool();
  if (!db || !userId) {
    return null;
  }

  try {
    const result = await db.query("SELECT * FROM users WHERE id=$1", [userId]);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("User by id query failed:", error);
    return null;
  }
}

async function getUserByEmail(email: string | null | undefined) {
  const db = getPool();
  if (!db || !email) {
    return null;
  }

  try {
    const result = await db.query("SELECT * FROM users WHERE email=$1", [email]);
    return result.rows[0] ?? null;
  } catch (error) {
    console.error("User by email query failed:", error);
    return null;
  }
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

async function reassignUserReferences(sourceUserId: string, targetUserId: string) {
  const db = getPool();
  if (!db || !sourceUserId || !targetUserId || sourceUserId === targetUserId) {
    return;
  }

  const projectColumns = await getTableColumns("projects");
  if (projectColumns.has("owner_id")) {
    await db.query(
      `UPDATE projects
       SET owner_id=$1
       WHERE owner_id=$2`,
      [targetUserId, sourceUserId]
    );
  }

  const applicationColumns = await getTableColumns("applications");
  if (applicationColumns.has("applicant_id")) {
    await db.query(
      `UPDATE applications
       SET applicant_id=$1
       WHERE applicant_id=$2`,
      [targetUserId, sourceUserId]
    );
  }
}

async function mergeUserRecords(params: {
  targetUser: Record<string, any>;
  sourceUser: Record<string, any>;
  authEmail: string | null;
}) {
  const db = getPool();
  if (!db) {
    return params.targetUser;
  }

  const { targetUser, sourceUser, authEmail } = params;
  if (!targetUser?.id || !sourceUser?.id || targetUser.id === sourceUser.id) {
    return targetUser;
  }

  const userColumns = await getTableColumns("users");
  const assignments: string[] = [];
  const values: any[] = [];

  const maybeCopy = (column: string) => {
    if (!userColumns.has(column)) {
      return;
    }

    const targetValue = targetUser[column];
    const sourceValue = sourceUser[column];
    if (hasMeaningfulValue(targetValue) || !hasMeaningfulValue(sourceValue)) {
      return;
    }

    values.push(sourceValue);
    assignments.push(`${column}=$${values.length}`);
  };

  const targetEmail =
    typeof targetUser.email === "string" ? targetUser.email : null;
  const sourceEmail =
    typeof sourceUser.email === "string" ? sourceUser.email : null;
  const preferredEmail =
    authEmail ||
    (!isSyntheticNittIdentity(targetEmail) ? targetEmail : null) ||
    (!isSyntheticNittIdentity(sourceEmail) ? sourceEmail : null);

  if (
    userColumns.has("email") &&
    preferredEmail &&
    (!targetEmail || isSyntheticNittIdentity(targetEmail)) &&
    preferredEmail !== targetEmail
  ) {
    values.push(preferredEmail);
    assignments.push(`email=$${values.length}`);
  }

  maybeCopy("first_name");
  maybeCopy("last_name");
  maybeCopy("profile_image_url");
  maybeCopy("department");
  maybeCopy("year_of_study");
  maybeCopy("year");
  maybeCopy("skills");
  maybeCopy("bio");
  maybeCopy("github_url");
  maybeCopy("resume_url");

  if (assignments.length > 0) {
    values.push(targetUser.id);
    await db.query(
      `UPDATE users
       SET ${assignments.join(", ")}
       WHERE id=$${values.length}`,
      values
    );
  }

  await reassignUserReferences(sourceUser.id, targetUser.id);
  await db.query("DELETE FROM users WHERE id=$1", [sourceUser.id]);

  return (await getUserById(targetUser.id)) ?? targetUser;
}

async function ensureUser(authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    return null;
  }

  const userColumns = await getTableColumns("users");
  if (!userColumns.has("id")) {
    return null;
  }

  const existingUser = await getUserById(authUser.userId);
  const existingUserByEmail = await getUserByEmail(authUser.email);

  if (
    existingUser &&
    existingUserByEmail &&
    existingUser.id !== existingUserByEmail.id
  ) {
    return await mergeUserRecords({
      targetUser: existingUserByEmail,
      sourceUser: existingUser,
      authEmail: authUser.email,
    });
  }

  if (existingUser) {
    const assignments: string[] = [];
    const values: Array<string | null> = [];

    const currentEmail =
      typeof existingUser.email === "string" ? existingUser.email : null;
    if (
      userColumns.has("email") &&
      authUser.email &&
      (!currentEmail || isSyntheticNittIdentity(currentEmail))
    ) {
      values.push(authUser.email);
      assignments.push(`email=$${values.length}`);
    }

    if (assignments.length > 0) {
      values.push(authUser.userId);
      await db.query(
        `UPDATE users
         SET ${assignments.join(", ")}
         WHERE id=$${values.length}`,
        values
      );
    }

    return (await getUserById(authUser.userId)) ?? existingUser;
  }

  if (existingUserByEmail) {
    return existingUserByEmail;
  }

  if (!authUser.email) {
    return null;
  }

  const columns = ["id"];
  const values: Array<string | null> = [authUser.userId];

  const addInsertColumn = (column: string, value: string | null) => {
    if (!userColumns.has(column)) {
      return;
    }

    columns.push(column);
    values.push(value);
  };

  addInsertColumn("email", authUser.email);

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");

  await db.query(
    `INSERT INTO users (${columns.join(", ")})
     VALUES (${placeholders})
     ON CONFLICT (id) DO NOTHING`,
    values
  );

  return await getUserById(authUser.userId);
}

async function getEffectiveUserId(authUser: AuthUser) {
  const user = await ensureUser(authUser);
  return user?.id ?? authUser.userId;
}

async function getUserIdentityCandidates(authUser: AuthUser | null) {
  if (!authUser) {
    return [];
  }

  const identities = new Set<string>();

  if (authUser.userId) {
    identities.add(authUser.userId);
  }

  if (authUser.email) {
    identities.add(authUser.email);
  }

  const ensuredUser = await ensureUser(authUser);
  if (ensuredUser?.id) {
    identities.add(ensuredUser.id);
  }

  if (ensuredUser?.email) {
    identities.add(ensuredUser.email);
  }

  const userByEmail = await getUserByEmail(authUser.email);
  if (userByEmail?.id) {
    identities.add(userByEmail.id);
  }

  return Array.from(identities).filter(Boolean);
}

async function getCurrentUser(authUser: AuthUser | null) {
  if (!authUser) {
    return null;
  }

  const user = await ensureUser(authUser);
  return normalizeUserRow(user, authUser);
}

async function updateUserProfile(authUser: AuthUser, body: Record<string, any>) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const user = await ensureUser(authUser);
  if (!user) {
    throw new Error("Email is unavailable for this session");
  }

  const userColumns = await getTableColumns("users");
  const assignments: string[] = [];
  const values: any[] = [];

  const add = (column: string, value: any) => {
    if (!userColumns.has(column) || typeof value === "undefined") {
      return;
    }

    values.push(value);
    assignments.push(`${column}=$${values.length}`);
  };

  add("first_name", body.firstName ?? null);
  add("last_name", body.lastName ?? null);
  add("department", body.department ?? null);

  if (userColumns.has("year_of_study")) {
    add("year_of_study", body.year ?? null);
  } else {
    add("year", body.year ?? null);
  }

  add("skills", Array.isArray(body.skills) ? body.skills : null);
  add("bio", body.bio ?? null);
  add("github_url", body.githubUrl ?? null);
  add("resume_url", body.resumeUrl ?? null);

  if (assignments.length > 0) {
    values.push(user.id);
    await db.query(
      `UPDATE users
       SET ${assignments.join(", ")}
       WHERE id=$${values.length}`,
      values
    );
  }

  const updatedUser = await getUserById(user.id);
  return normalizeUserRow(updatedUser, {
    ...authUser,
    userId: user.id,
    email: updatedUser?.email ?? authUser.email,
  });
}

async function decorateProject(project: Record<string, any> | null) {
  if (!project) {
    return null;
  }

  const creator = project.owner_id ? await getUserById(project.owner_id) : null;
  const creatorData = normalizeUserRow(creator, null);

  return {
    ...project,
    creatorName: creatorData?.creatorName ?? project.owner_id ?? null,
    creatorEmail: creatorData?.email ?? null,
  };
}

async function getProjects() {
  const db = getPool();
  if (!db) {
    return [];
  }

  try {
    const result = await db.query("SELECT * FROM projects ORDER BY created_at DESC");
    return Promise.all(result.rows.map((row) => decorateProject(row)));
  } catch (error) {
    console.error("Ordered projects query failed:", error);
  }

  try {
    const result = await db.query("SELECT * FROM projects");
    return Promise.all(result.rows.map((row) => decorateProject(row)));
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
    return Promise.all(result.rows.map((row) => decorateProject(row)));
  } catch (error) {
    console.error("Owner projects query failed:", error);
    return [];
  }
}

async function getProjectsForOwners(ownerIds: string[]) {
  const db = getPool();
  if (!db || ownerIds.length === 0) {
    return [];
  }

  try {
    const result = await db.query(
      "SELECT * FROM projects WHERE owner_id = ANY($1::text[]) ORDER BY created_at DESC",
      [ownerIds]
    );
    return Promise.all(result.rows.map((row) => decorateProject(row)));
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
    return decorateProject(result.rows[0] ?? null);
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

  const user = await ensureUser(authUser);

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
  add("owner_id", user?.id ?? authUser.userId);
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

  return decorateProject(result.rows[0] ?? null);
}

async function getApplicationsForProject(projectId: number, authUser: AuthUser | null) {
  const db = getPool();
  if (!db || !authUser) {
    return [];
  }

  const effectiveUserId = await getEffectiveUserId(authUser);
  const identityCandidates = await getUserIdentityCandidates(authUser);

  const project = await getProjectById(projectId);
  if (!project) {
    return [];
  }

  const isOwner =
    !!project.owner_id &&
    (project.owner_id === effectiveUserId ||
      identityCandidates.includes(project.owner_id));

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
       WHERE project_id=$1 AND applicant_id = ANY($2::text[])
       ORDER BY created_at DESC`,
      [projectId, identityCandidates]
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

async function getApplicationsForUser(authUser: AuthUser | null) {
  const db = getPool();
  if (!db || !authUser) {
    return [];
  }

  const identityCandidates = await getUserIdentityCandidates(authUser);
  if (identityCandidates.length === 0) {
    return [];
  }

  try {
    const result = await db.query(
      `SELECT
        a.id,
        a.project_id,
        a.applicant_id,
        a.resume_url,
        a.message,
        a.status,
        a.created_at,
        p.title AS project_title
       FROM applications a
       LEFT JOIN projects p ON a.project_id = p.id
       WHERE a.applicant_id = ANY($1::text[])
       ORDER BY a.created_at DESC`,
      [identityCandidates]
    );

    return result.rows.map((row) => ({
      id: row.id,
      projectId: row.project_id,
      applicantId: row.applicant_id,
      resumeUrl: row.resume_url,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      projectTitle: row.project_title ?? null,
    }));
  } catch (error) {
    console.error("User applications query failed:", error);
    return [];
  }
}

async function getApplicationsToMyProjects(authUser: AuthUser | null) {
  const db = getPool();
  if (!db || !authUser) {
    return [];
  }

  const identityCandidates = await getUserIdentityCandidates(authUser);
  if (identityCandidates.length === 0) {
    return [];
  }

  try {
    const result = await db.query(
      `SELECT
        a.id,
        a.project_id,
        a.applicant_id,
        a.resume_url,
        a.message,
        a.status,
        a.created_at,
        p.title AS project_title,
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
       JOIN projects p ON a.project_id = p.id
       LEFT JOIN users u ON a.applicant_id = u.id
       WHERE p.owner_id = ANY($1::text[])
       ORDER BY a.created_at DESC`,
      [identityCandidates]
    );

    return result.rows.map((row) => ({
      applicationId: row.id,
      projectId: row.project_id,
      applicantId: row.applicant_id,
      resumeUrl: row.resume_url,
      message: row.message,
      status: row.status,
      createdAt: row.created_at,
      projectTitle: row.project_title ?? null,
      applicant: {
        id: row.user_id ?? row.applicant_id ?? null,
        email: row.email ?? null,
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
  } catch (error) {
    console.error("My project applications query failed:", error);
    return [];
  }
}

async function createApplication(projectId: number, body: any, authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const effectiveUserId = await getEffectiveUserId(authUser);
  const identityCandidates = await getUserIdentityCandidates(authUser);

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (
    project.owner_id === effectiveUserId ||
    identityCandidates.includes(project.owner_id)
  ) {
    throw new Error("Cannot apply to your own project");
  }

  const applicationColumns = await getTableColumns("applications");
  let existingApplicationId: number | null = null;

  try {
    const existing = await db.query(
      "SELECT id FROM applications WHERE project_id=$1 AND applicant_id = ANY($2::text[])",
      [projectId, identityCandidates]
    );

    existingApplicationId = existing.rows[0]?.id ?? null;
  } catch (error) {
    console.error("Existing application lookup failed:", error);
  }

  if (existingApplicationId) {
    const assignments = [
      "applicant_id=$2",
      "resume_url=$3",
      "message=$4",
      "status='pending'",
    ];

    if (applicationColumns.has("updated_at")) {
      assignments.push("updated_at=NOW()");
    }

    if (applicationColumns.has("created_at")) {
      assignments.push("created_at=NOW()");
    }

    const updated = await db.query(
      `UPDATE applications
       SET ${assignments.join(", ")}
       WHERE id=$1
       RETURNING *`,
      [
        existingApplicationId,
        effectiveUserId,
        body.resumeUrl ?? null,
        body.message ?? null,
      ]
    );

    const row = updated.rows[0];
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

  const result = await db.query(
    `INSERT INTO applications
      (project_id, applicant_id, resume_url, message, status)
     VALUES ($1, $2, $3, $4, 'pending')
     RETURNING *`,
    [projectId, effectiveUserId, body.resumeUrl ?? null, body.message ?? null]
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

  const effectiveUserId = await getEffectiveUserId(authUser);
  const identityCandidates = await getUserIdentityCandidates(authUser);

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (
    project.owner_id !== effectiveUserId &&
    !identityCandidates.includes(project.owner_id)
  ) {
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
  values.push(project.owner_id);

  const result = await db.query(
    `UPDATE projects
     SET ${assignments.join(", ")}
     WHERE id=$${values.length - 1} AND owner_id=$${values.length}
     RETURNING *`,
    values
  );

  return decorateProject(result.rows[0] ?? project);
}

async function deleteProject(projectId: number, authUser: AuthUser) {
  const db = getPool();
  if (!db) {
    throw new Error("DATABASE_URL is not set");
  }

  const effectiveUserId = await getEffectiveUserId(authUser);
  const identityCandidates = await getUserIdentityCandidates(authUser);

  const project = await getProjectById(projectId);
  if (!project) {
    throw new Error("Project not found");
  }

  if (
    project.owner_id !== effectiveUserId &&
    !identityCandidates.includes(project.owner_id)
  ) {
    throw new Error("Not authorized");
  }

  try {
    await db.query("DELETE FROM applications WHERE project_id=$1", [projectId]);
  } catch (error) {
    console.warn("Delete project applications warning:", error);
  }

  await db.query("DELETE FROM projects WHERE id=$1 AND owner_id=$2", [
    projectId,
    project.owner_id,
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

  const effectiveUserId = await getEffectiveUserId(authUser);
  const identityCandidates = await getUserIdentityCandidates(authUser);

  const result = await db.query(
    `UPDATE applications a
     SET status=$1
     WHERE a.id=$2
       AND EXISTS (
         SELECT 1
         FROM projects p
         WHERE p.id = a.project_id
           AND p.owner_id = ANY($3::text[])
       )
     RETURNING *`,
    [status, applicationId, identityCandidates]
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
    const path = getRequestPath(req);
    const method = (req.method || "GET").toUpperCase();
    const authUser = getAuthUser(req);

    if (method === "GET" && path === "/api/me") {
      const currentUser = await getCurrentUser(authUser);
      return sendJson(res, 200, currentUser);
    }

    if (method === "POST" && path === "/api/logout") {
      return sendJson(res, 200, { message: "Logged out" });
    }

    if (
      method === "PUT" &&
      (path === "/api/users/profile" || path === "/api/profile")
    ) {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const body = await parseJsonBody(req);
      const user = await updateUserProfile(authUser, body);
      return sendJson(res, 200, user);
    }

    if (method === "GET" && path === "/api/users") {
      const requestedUserId = url.searchParams.get("id") || "";
      const user = requestedUserId
        ? normalizeUserRow(await getUserById(requestedUserId), null)
        : null;
      return sendJson(res, user ? 200 : 404, user ?? { message: "User not found" });
    }

    if (method === "GET" && path === "/api/projects") {
      const requestedId = Number(url.searchParams.get("id") || 0);
      if (requestedId) {
        const project = await getProjectById(requestedId);
        return sendJson(
          res,
          project ? 200 : 404,
          project ?? { message: "Project not found" }
        );
      }

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

    if (method === "PATCH" && path === "/api/projects") {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const projectId = Number(url.searchParams.get("id") || 0);
      if (!projectId) {
        return sendJson(res, 400, { message: "Project not found" });
      }

      const body = await parseJsonBody(req);
      const project = await updateProject(projectId, body, authUser);
      return sendJson(res, 200, project);
    }

    if (method === "DELETE" && path === "/api/projects") {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const projectId = Number(url.searchParams.get("id") || 0);
      if (!projectId) {
        return sendJson(res, 400, { message: "Project not found" });
      }

      await deleteProject(projectId, authUser);
      return sendJson(res, 200, { message: "Project deleted" });
    }

    if (method === "GET" && path === "/api/my-projects") {
      if (!authUser) {
        return sendJson(res, 200, []);
      }

      const identityCandidates = await getUserIdentityCandidates(authUser);
      const projects = await getProjectsForOwners(identityCandidates);
      return sendJson(res, 200, projects);
    }

    if (
      method === "GET" &&
      (path === "/api/users/applications" || path === "/api/my-applications")
    ) {
      const applications = await getApplicationsForUser(authUser);
      return sendJson(res, 200, applications);
    }

    if (method === "GET" && path === "/api/my-project-applications") {
      const applications = await getApplicationsToMyProjects(authUser);
      return sendJson(res, 200, applications);
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

    if (method === "GET" && path === "/api/project-applications") {
      const projectId = Number(url.searchParams.get("projectId") || 0);
      const applications = await getApplicationsForProject(projectId, authUser);
      return sendJson(res, 200, applications);
    }

    if (method === "POST" && path === "/api/project-applications") {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const projectId = Number(url.searchParams.get("projectId") || 0);
      if (!projectId) {
        return sendJson(res, 400, { message: "Project not found" });
      }

      const body = await parseJsonBody(req);
      const application = await createApplication(projectId, body, authUser);
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

    if (method === "PATCH" && path === "/api/application-status") {
      if (!authUser) {
        return sendJson(res, 401, { message: "Not logged in" });
      }

      const applicationId = Number(url.searchParams.get("id") || 0);
      if (!applicationId) {
        return sendJson(res, 400, { message: "Application not found" });
      }

      const body = await parseJsonBody(req);
      const status =
        body?.status === "accepted" || body?.status === "rejected"
          ? body.status
          : "pending";
      const application = await updateApplicationStatus(
        applicationId,
        status,
        authUser
      );
      return sendJson(res, 200, application);
    }

    const userMatch = path.match(/^\/api\/users\/(.+)$/);
    if (method === "GET" && userMatch) {
      const user = normalizeUserRow(
        await getUserById(decodeURIComponent(userMatch[1])),
        null
      );
      return sendJson(res, user ? 200 : 404, user ?? { message: "User not found" });
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
          : message === "Email is unavailable for this session"
            ? 409
          : message === "Project not found" || message === "Application not found"
            ? 404
            : message === "Already applied" || message === "Cannot apply to your own project"
              ? 409
              : 500;
    return sendJson(res, status, { message });
  }
}
