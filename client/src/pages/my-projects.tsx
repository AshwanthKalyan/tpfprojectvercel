import { useMyProjects } from "@/hooks/use-projects";
import { ExternalLink, Plus, Terminal } from "lucide-react";
import { Link, useLocation } from "wouter";

export default function MyProjects() {
  const { data: projects, isLoading, isError } = useMyProjects();
  const [, setLocation] = useLocation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Terminal className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex items-center justify-center h-64 text-red-500 font-mono">
        Failed to load your projects. Please try again later.
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display border-l-4 border-primary pl-4 uppercase">
            My Projects
          </h1>

          <p className="text-muted-foreground mt-2 pl-5 font-mono">
            Projects you created.
          </p>
        </div>

        <Link
          href="/projects?create=1"
          className="bg-primary text-background px-6 py-3 font-bold font-display uppercase tracking-wider brutal-shadow hover:bg-white hover:text-black transition-all flex items-center gap-2"
        >
          <Plus className="h-5 w-5" /> Initialize Project
        </Link>
      </div>

      {/* PROJECT LIST */}
      <div className="grid grid-cols-1 gap-4 font-mono">
        {projects?.map((project: any) => (
          <div
            key={project.id}
            className="border border-primary/20 bg-card p-6 flex flex-col gap-3"
          >
            <h3 className="text-xl font-bold">
              <button
                type="button"
                onClick={() => setLocation(`/projects/${project.id}`)}
                className="flex items-center gap-2 hover:text-primary"
              >
                {project.title || "Untitled Project"}
                <ExternalLink className="h-4 w-4 text-muted-foreground" />
              </button>
            </h3>

            {project.description && (
              <p className="text-muted-foreground text-sm">
                {project.description}
              </p>
            )}

            <div className="text-xs text-primary/60">
              Created on:{" "}
              {project.created_at
                ? new Date(project.created_at).toLocaleDateString()
                : "Unknown"}
            </div>

            {Array.isArray(project.tech_stack) && project.tech_stack.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {project.tech_stack.map((tech: string) => (
                  <span
                    key={tech}
                    className="text-xs border border-primary/30 px-2 py-1 uppercase"
                  >
                    {tech}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {projects?.length === 0 && (
          <div className="border-2 border-dashed border-primary/20 p-12 text-center text-muted-foreground">
            NO PROJECTS YET
          </div>
        )}
      </div>
    </div>
  );
}
