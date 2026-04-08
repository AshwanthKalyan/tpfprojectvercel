import { Express } from "express";
import { clerkClient, getAuth } from "@clerk/express";
import { pool } from "./db";

const NITT_EMAIL_REGEX = /^[a-z0-9]+@nitt\.edu$/i;

function isNittEmail(email: string | null | undefined) {
  return !!email && NITT_EMAIL_REGEX.test(email);
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
    const { userId } = getAuth(req);

    if (!userId) {
      return res.status(401).json({ message: "Not logged in" });
    }

    try {
      let email: string | null = null;
      let dbUserId = userId;

      const existingById = await pool.query(
        "SELECT id, email FROM users WHERE id=$1",
        [userId]
      );

      email = existingById.rows[0]?.email || null;

      if (!email) {
        const clerkUser = await clerkClient.users.getUser(userId);
        email = clerkUser.emailAddresses?.[0]?.emailAddress || null;
      }

      if (!isNittEmail(email)) {
        return res.status(403).json({ message: "Use nitt webmail only" });
      }

      if (!existingById.rows[0] && email) {
        const existingByEmail = await pool.query(
          "SELECT id FROM users WHERE email=$1",
          [email]
        );

        if (existingByEmail.rows[0]) {
          dbUserId = existingByEmail.rows[0].id;
        }
      }

      req.user = { id: dbUserId, email };
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
      let result = await pool.query(
        `SELECT 
          id,
          email,
          first_name,
          last_name,
          department,
          year_of_study,
          skills,
          bio,
          github_url,
          resume_url
        FROM users
        WHERE id=$1`,
        [req.user.id]
      );

      let user = result.rows[0];

      if (!user) {
        const clerkUser = await clerkClient.users.getUser(req.user.id);
        const primaryEmail =
          clerkUser.emailAddresses?.[0]?.emailAddress || null;

        await pool.query(
          `INSERT INTO users (id, email, first_name, last_name)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (id) DO UPDATE
           SET email = EXCLUDED.email,
               first_name = EXCLUDED.first_name,
               last_name = EXCLUDED.last_name`,
          [
            clerkUser.id,
            primaryEmail,
            clerkUser.firstName || null,
            clerkUser.lastName || null,
          ]
        );

        result = await pool.query(
          `SELECT 
            id,
            email,
            first_name,
            last_name,
            department,
            year_of_study,
            skills,
            bio,
            github_url,
            resume_url
          FROM users
          WHERE id=$1`,
          [req.user.id]
        );

        user = result.rows[0];
      }

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        department: user.department,
        year: user.year_of_study,
        skills: user.skills,
        bio: user.bio,
        githubUrl: user.github_url,
        resumeUrl: user.resume_url,
      });
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

      await pool.query(
        `UPDATE users 
        SET first_name=$1,
            last_name=$2,
            department=$3,
            year_of_study=$4,
            skills=$5,
            bio=$6,
            github_url=$7,
            resume_url=$8
        WHERE id=$9`,
        [
          firstName,
          lastName,
          department,
          year,
          skills,
          bio,
          githubUrl,
          resumeUrl,
          userId,
        ]
      );

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

      const result = await pool.query(
        `SELECT 
          id,
          email,
          first_name,
          last_name,
          department,
          year_of_study,
          skills,
          bio,
          github_url,
          resume_url
        FROM users
        WHERE id=$1`,
        [userId]
      );

      const user = result.rows[0];

      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      res.json({
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        department: user.department,
        year: user.year_of_study,
        skills: user.skills,
        bio: user.bio,
        githubUrl: user.github_url,
        resumeUrl: user.resume_url,
      });
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
