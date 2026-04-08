import { Express } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { pool } from "./db";

const NITT_EMAIL_REGEX = /^[a-z0-9]+@nitt\.edu$/i;
const SESSION_EMAIL_CLAIM_KEYS = [
  "primaryEmail",
  "email",
  "email_address",
  "primary_email_address",
] as const;
const OPTIONAL_USER_COLUMNS = ["email", "first_name", "last_name"] as const;

function isNittEmail(email: string | null | undefined) {
  return !!email && NITT_EMAIL_REGEX.test(email);
}

function getEmailFromSessionClaims(sessionClaims: unknown) {
  if (!sessionClaims || typeof sessionClaims !== "object") {
    return null;
  }

  for (const key of SESSION_EMAIL_CLAIM_KEYS) {
    const value = (sessionClaims as Record<string, unknown>)[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }

  return null;
}

function mapUserRow(row: Record<string, any> | undefined | null) {
  if (!row) {
    return null;
  }

  return {
    id: row.id,
    email: row.email ?? null,
    firstName: row.first_name ?? row.firstname ?? row.firstName ?? null,
    lastName: row.last_name ?? row.lastname ?? row.lastName ?? null,
    department: row.department ?? null,
    year: row.year_of_study ?? row.year ?? null,
    skills: row.skills ?? null,
    bio: row.bio ?? null,
    githubUrl: row.github_url ?? row.githubUrl ?? null,
    resumeUrl: row.resume_url ?? row.resumeUrl ?? null,
  };
}

let usersTableColumnsPromise: Promise<Set<string>> | null = null;

async function getUsersTableColumns() {
  if (!usersTableColumnsPromise) {
    usersTableColumnsPromise = pool
      .query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'users'`
      )
      .then((result) => new Set(result.rows.map((row) => row.column_name)))
      .catch((error) => {
        usersTableColumnsPromise = null;
        throw error;
      });
  }

  return usersTableColumnsPromise;
}

async function getUserRowById(userId: string) {
  const result = await pool.query("SELECT * FROM users WHERE id=$1", [userId]);
  return result.rows[0] ?? null;
}

async function getUserIdByEmail(email: string) {
  const result = await pool.query("SELECT id FROM users WHERE email=$1", [email]);
  return result.rows[0]?.id ?? null;
}

async function getClerkUserSafe(userId: string) {
  try {
    return await clerkClient.users.getUser(userId);
  } catch (error) {
    console.warn(`Clerk lookup failed for ${userId}:`, error);
    return null;
  }
}

async function upsertUserRecord(params: {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
}) {
  const availableColumns = await getUsersTableColumns();
  const columnNames = ["id"];
  const values: Array<string | null> = [params.id];
  const updateAssignments: string[] = [];

  for (const column of OPTIONAL_USER_COLUMNS) {
    if (!availableColumns.has(column)) {
      continue;
    }

    const value =
      column === "email"
        ? params.email
        : column === "first_name"
          ? params.firstName
          : params.lastName;

    columnNames.push(column);
    values.push(value);
    updateAssignments.push(`${column} = EXCLUDED.${column}`);
  }

  const placeholders = values.map((_, index) => `$${index + 1}`).join(", ");
  const conflictClause =
    updateAssignments.length > 0
      ? `ON CONFLICT (id) DO UPDATE SET ${updateAssignments.join(", ")}`
      : "ON CONFLICT (id) DO NOTHING";

  await pool.query(
    `INSERT INTO users (${columnNames.join(", ")})
     VALUES (${placeholders})
     ${conflictClause}`,
    values
  );
}

async function updateUserRecord(
  userId: string,
  profile: {
    firstName: string | null;
    lastName: string | null;
    department: string | null;
    year: number | null;
    skills: string[] | null;
    bio: string | null;
    githubUrl: string | null;
    resumeUrl: string | null;
  }
) {
  const availableColumns = await getUsersTableColumns();
  const assignments: string[] = [];
  const values: Array<string | number | string[] | null> = [];

  const pushAssignment = (
    column: string,
    value: string | number | string[] | null
  ) => {
    if (!availableColumns.has(column)) {
      return;
    }

    values.push(value);
    assignments.push(`${column}=$${values.length}`);
  };

  pushAssignment("first_name", profile.firstName);
  pushAssignment("last_name", profile.lastName);
  pushAssignment("department", profile.department);

  if (availableColumns.has("year_of_study")) {
    pushAssignment("year_of_study", profile.year);
  } else {
    pushAssignment("year", profile.year);
  }

  pushAssignment("skills", profile.skills);
  pushAssignment("bio", profile.bio);
  pushAssignment("github_url", profile.githubUrl);
  pushAssignment("resume_url", profile.resumeUrl);

  if (assignments.length === 0) {
    return;
  }

  values.push(userId);

  await pool.query(
    `UPDATE users
     SET ${assignments.join(", ")}
     WHERE id=$${values.length}`,
    values
  );
}

export async function registerRoutes(app: Express) {
  console.log("Register Routes HIT!");

  const testDbHandler = async (_req: any, res: any) => {
    console.log("in test-db");
    try {
      const result = await pool.query("SELECT NOW()");
      res.json(result.rows);
    } catch (err) {
      console.error("test-db error:", err);
      res.status(500).json({ message: "DB test failed" });
    }
  };

  app.get("/api/test-db", testDbHandler);

  // =========================
  // LOGOUT
  // =========================
  app.post("/api/logout", (_req: any, res: any) => {
    res.json({ message: "Logged out" });
  });

  // middleware to check login
  async function isAuthenticated(req: any, res: any, next: any) {
    const auth = getAuth(req);
    const { userId } = auth;

    if (!userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    try {
      let email = getEmailFromSessionClaims(auth.sessionClaims);
      let dbUserId = userId;
      let userRow: Record<string, any> | null = null;

      try {
        userRow = await getUserRowById(userId);
        email = userRow?.email || email;
      } catch (dbError) {
        console.warn("Auth user lookup warning:", dbError);
      }

      if (!email) {
        const clerkUser = await getClerkUserSafe(userId);
        email = clerkUser?.emailAddresses?.[0]?.emailAddress || null;
      }

      if (!isNittEmail(email)) {
        if (email) {
          return res.status(403).json({ message: "Use nitt webmail only" });
        }
      }

      if (!userRow && email) {
        try {
          const existingUserId = await getUserIdByEmail(email);
          if (existingUserId) {
            dbUserId = existingUserId;
          }
        } catch (dbError) {
          console.warn("Auth email lookup warning:", dbError);
        }
      }

      req.user = { id: dbUserId, clerkUserId: userId, email };
      next();
    } catch (error) {
      console.error("Auth check error:", error);
      res.status(500).json({ message: "Auth check failed" });
    }
  }

  // =========================
  // GET USER PROFILE
  // =========================
  app.get("/api/me", isAuthenticated, async (req: any, res) => {
    try {
      let user: Record<string, any> | null = null;

      try {
        user = await getUserRowById(req.user.id);
      } catch (dbError) {
        console.warn("Current user lookup warning:", dbError);
      }

      if (!user) {
        const clerkUser = await getClerkUserSafe(req.user.clerkUserId || req.user.id);
        const primaryEmail =
          clerkUser?.emailAddresses?.[0]?.emailAddress || req.user.email || null;

        if (clerkUser) {
          try {
            await upsertUserRecord({
              id: clerkUser.id,
              email: primaryEmail,
              firstName: clerkUser.firstName || null,
              lastName: clerkUser.lastName || null,
            });

            user = await getUserRowById(req.user.id);
          } catch (dbError) {
            console.warn("Current user upsert warning:", dbError);
          }
        }
      }

      if (!user) {
        return res.json({
          id: req.user.id,
          email: req.user.email ?? null,
          firstName: null,
          lastName: null,
          department: null,
          year: null,
          skills: null,
          bio: null,
          githubUrl: null,
          resumeUrl: null,
        });
      }

      res.json(mapUserRow(user));
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // =========================
  // UPDATE USER PROFILE
  // =========================
  app.put("/api/users/profile", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.id;

      const {
        firstName,
        lastName,
        department,
        year,
        skills,
        bio,
        githubUrl,
        resumeUrl,
      } = req.body;

      await updateUserRecord(userId, {
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        department: department ?? null,
        year: year ?? null,
        skills: Array.isArray(skills) ? skills : null,
        bio: bio ?? null,
        githubUrl: githubUrl ?? null,
        resumeUrl: resumeUrl ?? null,
      });

      res.json({ message: "Profile updated successfully" });
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to update profile" });
    }
  });

  // =========================
  // GET USER PROFILE BY ID
  // =========================
  app.get("/api/users/:id", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.params.id;
      const user = await getUserRowById(userId);

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json(mapUserRow(user));
    } catch (error) {
      console.error("FETCH USER BY ID ERROR:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // =========================
  // CREATE PROJECT
  // =========================
  app.post("/api/projects", isAuthenticated, async (req: any, res: any) => {
    try {
      const userId = req.user.id;

      const {
        title,
        description,
        tech_stack,
        skills_required,
        collaborators_needed,
        project_type,
        duration,
        contact_info,
        required_skills,
        comms_link,
        members_needed,
      } = req.body;

      const result = await pool.query(
        `INSERT INTO projects
        (
          title,
          description,
          owner_id,
          tech_stack,
          skills_required,
          collaborators_needed,
          project_type,
          duration,
          contact_info,
          required_skills,
          comms_link,
          members_needed
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
        RETURNING *`,
        [
          title,
          description,
          userId,
          tech_stack,
          skills_required,
          collaborators_needed,
          project_type,
          duration,
          contact_info,
          required_skills,
          comms_link,
          members_needed,
        ]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error("CREATE PROJECT ERROR:", error);
      res.status(500).json({ message: "Failed to create project" });
    }
  });

  // =========================
  // GET ALL PROJECTS
  // =========================
  app.get("/api/projects", isAuthenticated, async (_req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM projects ORDER BY created_at DESC"
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch projects" });
    }
  });

  // =========================
  // GET MY PROJECTS
  // =========================
  app.get("/api/my-projects", isAuthenticated, async (req, res) => {
    try {
      const result = await pool.query(
        "SELECT * FROM projects WHERE owner_id=$1 ORDER BY created_at DESC",
        [req.user.id]
      );

      res.json(result.rows);
    } catch (error) {
      console.error(error);
      res.status(500).json({ message: "Failed to fetch your projects" });
    }
  });

  // =========================
  // SINGLE PROJECT
  // =========================
  app.get("/api/projects/:id", isAuthenticated, async (req, res) => {
    const result = await pool.query(
      "SELECT * FROM projects WHERE id=$1",
      [req.params.id]
    );

    res.json(result.rows[0]);
  });

  // =========================
  // UPDATE PROJECT (OWNER ONLY)
  // =========================
  app.patch("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (!projectId) {
        return res.status(400).json({ message: "Invalid project id" });
      }

      const { title, description, duration, comms_link } = req.body;

      const result = await pool.query(
        `UPDATE projects
         SET title=$1,
             description=$2,
             duration=$3,
             comms_link=$4
         WHERE id=$5 AND owner_id=$6
         RETURNING *`,
        [title, description, duration, comms_link, projectId, req.user.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ message: "Project not found" });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error("UPDATE PROJECT ERROR:", error);
      res.status(500).json({ message: "Failed to update project" });
    }
  });

  // =========================
  // DELETE PROJECT (OWNER ONLY)
  // =========================
  app.delete("/api/projects/:id", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.id);
      if (!projectId) {
        return res.status(400).json({ message: "Invalid project id" });
      }

      const ownerCheck = await pool.query(
        "SELECT owner_id FROM projects WHERE id=$1",
        [projectId]
      );

      if (!ownerCheck.rows[0]) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (ownerCheck.rows[0].owner_id !== req.user.id) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await pool.query("BEGIN");

      try {
        await pool.query(
          "DELETE FROM applications WHERE project_id=$1",
          [projectId]
        );
      } catch (error) {
        console.warn("DELETE APPLICATIONS WARNING:", error);
      }

      const result = await pool.query(
        "DELETE FROM projects WHERE id=$1 RETURNING id",
        [projectId]
      );

      await pool.query("COMMIT");

      res.json({ message: "Project deleted" });
    } catch (error) {
      try {
        await pool.query("ROLLBACK");
      } catch (rollbackError) {
        console.error("DELETE PROJECT ROLLBACK ERROR:", rollbackError);
      }
      console.error("DELETE PROJECT ERROR:", error);
      res.status(500).json({ message: "Failed to delete project" });
    }
  });

  // =========================
  // LIST APPLICATIONS FOR PROJECT
  // =========================
  app.get("/api/projects/:projectId/applications", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const ownerRes = await pool.query(
        "SELECT owner_id FROM projects WHERE id=$1",
        [projectId]
      );

      if (!ownerRes.rows[0]) {
        return res.status(404).json({ message: "Project not found" });
      }

      const isOwner = ownerRes.rows[0].owner_id === req.user.id;

      if (isOwner) {
        const result = await pool.query(
          `SELECT 
            a.id,
            a.project_id,
            a.applicant_id,
            a.resume_url,
            a.message,
            a.status,
            a.created_at,
            u.id AS user_id,
            u.email,
            u.first_name,
            u.last_name,
            u.department,
            u.year_of_study,
            u.skills,
            u.bio,
            u.github_url,
            u.resume_url AS user_resume_url
          FROM applications a
          JOIN users u ON a.applicant_id = u.id
          WHERE a.project_id = $1
          ORDER BY a.created_at DESC`,
          [projectId]
        );

        return res.json(
          result.rows.map((row) => ({
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
              firstName: row.first_name,
              lastName: row.last_name,
              department: row.department,
              year: row.year_of_study,
              skills: row.skills,
              bio: row.bio,
              githubUrl: row.github_url,
              resumeUrl: row.user_resume_url,
            },
          }))
        );
      }

      const result = await pool.query(
        `SELECT 
          id,
          project_id,
          applicant_id,
          resume_url,
          message,
          status,
          created_at
        FROM applications
        WHERE project_id=$1 AND applicant_id=$2
        ORDER BY created_at DESC`,
        [projectId, req.user.id]
      );

      return res.json(
        result.rows.map((row) => ({
          id: row.id,
          projectId: row.project_id,
          applicantId: row.applicant_id,
          resumeUrl: row.resume_url,
          message: row.message,
          status: row.status,
          createdAt: row.created_at,
        }))
      );
    } catch (error) {
      console.error("FETCH PROJECT APPLICATIONS ERROR:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });

  // =========================
  // CREATE APPLICATION
  // =========================
  app.post("/api/projects/:projectId/applications", isAuthenticated, async (req, res) => {
    try {
      const projectId = Number(req.params.projectId);
      const { resumeUrl, message } = req.body;

      const projectRes = await pool.query(
        "SELECT owner_id FROM projects WHERE id=$1",
        [projectId]
      );

      if (!projectRes.rows[0]) {
        return res.status(404).json({ message: "Project not found" });
      }

      if (projectRes.rows[0].owner_id === req.user.id) {
        return res.status(400).json({ message: "Cannot apply to your own project" });
      }

      const existing = await pool.query(
        "SELECT id FROM applications WHERE project_id=$1 AND applicant_id=$2",
        [projectId, req.user.id]
      );

      if (existing.rows[0]) {
        return res.status(409).json({ message: "Already applied" });
      }

      const result = await pool.query(
        `INSERT INTO applications
          (project_id, applicant_id, resume_url, message, status)
         VALUES ($1, $2, $3, $4, 'pending')
         RETURNING *`,
        [projectId, req.user.id, resumeUrl || null, message || null]
      );

      const row = result.rows[0];
      res.status(201).json({
        id: row.id,
        projectId: row.project_id,
        applicantId: row.applicant_id,
        resumeUrl: row.resume_url,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
      });
    } catch (error) {
      console.error("CREATE APPLICATION ERROR:", error);
      res.status(500).json({ message: "Failed to apply" });
    }
  });

  // =========================
  // LIST MY SUBMISSIONS
  // =========================
  app.get("/api/users/applications", isAuthenticated, async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT 
          a.id,
          a.project_id,
          a.message,
          a.status,
          a.created_at,
          p.title AS project_title
        FROM applications a
        JOIN projects p ON a.project_id = p.id
        WHERE a.applicant_id = $1
        ORDER BY a.created_at DESC`,
        [req.user.id]
      );

      res.json(
        result.rows.map((row) => ({
          id: row.id,
          projectId: row.project_id,
          projectTitle: row.project_title,
          message: row.message,
          status: row.status,
          createdAt: row.created_at,
        }))
      );
    } catch (error) {
      console.error("FETCH MY APPLICATIONS ERROR:", error);
      res.status(500).json({ message: "Failed to fetch your applications" });
    }
  });

  // =========================
  // UPDATE APPLICATION STATUS
  // =========================
  app.patch("/api/applications/:id/status", isAuthenticated, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status } = req.body;

      if (!["pending", "accepted", "rejected"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      const result = await pool.query(
        `UPDATE applications a
         SET status = $1
         WHERE a.id = $2
           AND EXISTS (
             SELECT 1 FROM projects p
             WHERE p.id = a.project_id
               AND p.owner_id = $3
           )
         RETURNING *`,
        [status, id, req.user.id]
      );

      if (!result.rows[0]) {
        return res.status(404).json({ message: "Application not found" });
      }

      const row = result.rows[0];
      res.json({
        id: row.id,
        projectId: row.project_id,
        applicantId: row.applicant_id,
        resumeUrl: row.resume_url,
        message: row.message,
        status: row.status,
        createdAt: row.created_at,
      });
    } catch (error) {
      console.error("UPDATE APPLICATION STATUS ERROR:", error);
      res.status(500).json({ message: "Failed to update status" });
    }
  });

  // =========================
  // APPLICATIONS TO MY PROJECTS
  // =========================
  app.get("/api/my-project-applications", isAuthenticated, async (req, res) => {
    try {
      const result = await pool.query(
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
          u.skills,
          u.bio,
          u.github_url,
          u.resume_url AS user_resume_url
        FROM applications a
        JOIN projects p ON a.project_id = p.id
        JOIN users u ON a.applicant_id = u.id
        WHERE p.owner_id = $1
        ORDER BY a.created_at DESC`,
        [req.user.id]
      );

      res.json(
        result.rows.map((row) => ({
          applicationId: row.id,
          projectId: row.project_id,
          applicantId: row.applicant_id,
          resumeUrl: row.resume_url,
          message: row.message,
          status: row.status,
          createdAt: row.created_at,
          projectTitle: row.project_title,
          applicant: {
            id: row.user_id,
            email: row.email,
            firstName: row.first_name,
            lastName: row.last_name,
            department: row.department,
            year: row.year_of_study,
            skills: row.skills,
            bio: row.bio,
            githubUrl: row.github_url,
            resumeUrl: row.user_resume_url,
          },
        }))
      );
    } catch (error) {
      console.error("FETCH MY PROJECT APPLICATIONS ERROR:", error);
      res.status(500).json({ message: "Failed to fetch applications" });
    }
  });
}
