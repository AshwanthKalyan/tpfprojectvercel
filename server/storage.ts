import { db } from "./db";
import { projects, applications, users } from "@shared/schema";
import type { InsertProject, InsertApplication, UpdateUser } from "@shared/schema";
import { eq } from "drizzle-orm";

export interface IStorage {
  getProjects(): Promise<(typeof projects.$inferSelect & { creator: typeof users.$inferSelect })[]>;
  getProject(id: number): Promise<(typeof projects.$inferSelect & { creator: typeof users.$inferSelect }) | undefined>;
  createProject(project: InsertProject & { creatorId: string }): Promise<typeof projects.$inferSelect>;
  getApplicationsForProject(projectId: number): Promise<(typeof applications.$inferSelect & { applicant: typeof users.$inferSelect })[]>;
  getApplicationsForUser(userId: string): Promise<(typeof applications.$inferSelect & { project: typeof projects.$inferSelect })[]>;
  createApplication(application: InsertApplication & { projectId: number, applicantId: string }): Promise<typeof applications.$inferSelect>;
  updateApplicationStatus(id: number, status: string): Promise<typeof applications.$inferSelect | undefined>;
  updateUserProfile(userId: string, profile: Partial<UpdateUser>): Promise<typeof users.$inferSelect | undefined>;
}

export class DatabaseStorage implements IStorage {
  async getProjects() {
    const allProjects = await db.query.projects.findMany({
      with: {
        creator: true
      },
      orderBy: (projects, { desc }) => [desc(projects.createdAt)]
    });
    // @ts-ignore - drizzle with query typing issue
    return allProjects;
  }

  async getProject(id: number) {
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
      with: {
        creator: true
      }
    });
    // @ts-ignore
    return project;
  }

  async createProject(project: InsertProject & { creatorId: string }) {
    const [newProject] = await db.insert(projects).values(project).returning();
    return newProject;
  }

  async getApplicationsForProject(projectId: number) {
    const apps = await db.query.applications.findMany({
      where: eq(applications.projectId, projectId),
      with: {
        applicant: true
      }
    });
    // @ts-ignore
    return apps;
  }

  async getApplicationsForUser(userId: string) {
    const apps = await db.query.applications.findMany({
      where: eq(applications.applicantId, userId),
      with: {
        project: true
      }
    });
    // @ts-ignore
    return apps;
  }

  async createApplication(application: InsertApplication & { projectId: number, applicantId: string }) {
    const [newApp] = await db.insert(applications).values({
      ...application,
      status: "pending"
    }).returning();
    return newApp;
  }

  async updateApplicationStatus(id: number, status: string) {
    const [updatedApp] = await db.update(applications)
      .set({ status })
      .where(eq(applications.id, id))
      .returning();
    return updatedApp;
  }

  async updateUserProfile(userId: string, profile: Partial<UpdateUser>) {
    const [updatedUser] = await db.update(users)
      .set(profile)
      .where(eq(users.id, userId))
      .returning();
    return updatedUser;
  }
}

export const storage = new DatabaseStorage();
