
import { sql } from "drizzle-orm";
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  integer,
  serial
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { relations } from "drizzle-orm";

/* ======================
   SESSIONS
====================== */

export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

/* ======================
   USERS
====================== */

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),

  email: varchar("email").unique(),

  firstName: varchar("first_name"),

  lastName: varchar("last_name"),

  profileImageUrl: varchar("profile_image_url"),

  department: text("department"),

  year: integer("year"),

  skills: text("skills").array(),

  bio: text("bio"),

  resumeUrl: text("resume_url"),

  githubUrl: text("github_url"),

  createdAt: timestamp("created_at").defaultNow(),

  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ======================
   PROJECTS
   (MATCHES YOUR TABLE)
====================== */

export const projects = pgTable("projects", {
  id: serial("id").primaryKey(),

  title: text("title").notNull(),

  description: text("description"),

  ownerId: varchar("owner_id").references(() => users.id),

  createdAt: timestamp("created_at").defaultNow(),

  techStack: text("tech_stack").array(),

  skillsRequired: text("skills_required").array(),

  collaboratorsNeeded: integer("collaborators_needed"),

  projectType: text("project_type"),

  duration: text("duration"),

  contactInfo: text("contact_info"),

  requiredSkills: text("required_skills"),

  commsLink: text("comms_link"),

  membersNeeded: integer("members_needed"),
});

/* ======================
   APPLICATIONS
====================== */

export const applications = pgTable("applications", {
  id: serial("id").primaryKey(),

  projectId: integer("project_id")
    .references(() => projects.id)
    .notNull(),

  applicantId: varchar("applicant_id")
    .references(() => users.id)
    .notNull(),

  resumeUrl: text("resume_url"),

  message: text("message"),

  status: text("status").notNull().default("pending"),

  createdAt: timestamp("created_at").defaultNow(),

  updatedAt: timestamp("updated_at").defaultNow(),
});

/* ======================
   RELATIONS
====================== */

export const usersRelations = relations(users, ({ many }) => ({
  projects: many(projects),
  applications: many(applications),
}));

export const projectsRelations = relations(projects, ({ one, many }) => ({
  owner: one(users, {
    fields: [projects.ownerId],
    references: [users.id],
  }),

  applications: many(applications),
}));

export const applicationsRelations = relations(applications, ({ one }) => ({
  project: one(projects, {
    fields: [applications.projectId],
    references: [projects.id],
  }),

  applicant: one(users, {
    fields: [applications.applicantId],
    references: [users.id],
  }),
}));

/* ======================
   ZOD SCHEMAS
====================== */

export const insertProjectSchema = createInsertSchema(projects).omit({
  id: true,
  createdAt: true,
});

export const insertApplicationSchema = createInsertSchema(applications).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  email: true,
});

/* ======================
   TYPES
====================== */

export type User = typeof users.$inferSelect;
export type UpsertUser = typeof users.$inferInsert;

export type Project = typeof projects.$inferSelect;
export type Application = typeof applications.$inferSelect;

export type InsertProject = z.infer<typeof insertProjectSchema>;
export type InsertApplication = z.infer<typeof insertApplicationSchema>;
export type UpdateUser = z.infer<typeof updateUserSchema>;

export type ProjectWithOwner = Project & {
  owner?: User;
};

export type ApplicationWithApplicant = Application & {
  applicant?: User;
};

export type ApplicationWithProject = Application & {
  project?: Project;
};

