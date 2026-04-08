import { useProjects, useCreateProject } from "@/hooks/use-projects";
import { Link, useLocation } from "wouter";
import { Plus, Search, Terminal } from "lucide-react";
import { useEffect, useState } from "react";

export default function Projects() {
  const { data: projects, isLoading, isError } = useProjects();
  const createProject = useCreateProject();
  const [, setLocation] = useLocation();

  const [showCreate, setShowCreate] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const params = new URLSearchParams(window.location.search);
    if (params.get("create") === "1") {
      setShowCreate(true);
      setLocation("/projects", { replace: true });
    }
  }, [setLocation]);

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
        Failed to load projects. Please try again later.
      </div>
    );
  }

  const filteredProjects = projects?.filter((p: any) =>
    p.title?.toLowerCase().includes(search.toLowerCase()) ||
    p.tech_stack?.some((t: string) =>
      t.toLowerCase().includes(search.toLowerCase())
    )
  );

  const handleCreate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    const data = {
      title: fd.get("title"),
      description: fd.get("description"),
      tech_stack: (fd.get("techStack") as string)?.split(",").map(s => s.trim()),
      skills_required: (fd.get("skillsRequired") as string)?.split(",").map(s => s.trim()),
      collaborators_needed: Number(fd.get("collaboratorsNeeded")),
      project_type: fd.get("projectType"),
      duration: fd.get("duration"),
      contact_info: fd.get("contactInfo"),
      comms_link: fd.get("contactInfo"),
      members_needed: Number(fd.get("collaboratorsNeeded")),
    };

    createProject.mutate(data, {
      onSuccess: () => setShowCreate(false),
    });
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500 px-4 md:px-8 lg:px-16">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-4xl font-display text-foreground border-l-4 border-primary pl-4 uppercase">
            Project Hub
          </h1>
          <p className="text-muted-foreground mt-2 pl-5 font-mono">
            Discover and join active systems.
          </p>
        </div>

        <button
          onClick={() => setShowCreate(true)}
          className="bg-primary text-background px-6 py-3 font-bold font-display uppercase tracking-wider brutal-shadow hover:bg-white hover:text-black transition-all flex items-center gap-2"
        >
          <Plus className="h-5 w-5" /> Initialize Project
        </button>
      </div>

      {/* SEARCH */}
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-primary h-5 w-5" />
        <input
          type="text"
          placeholder="QUERY PROJECTS OR TECH STACK..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-background border-2 border-primary/30 p-4 pl-12 text-primary font-mono placeholder:text-primary/40 focus:outline-none focus:border-primary focus:brutal-shadow transition-all rounded-none"
        />
      </div>

      {/* CREATE PROJECT MODAL */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="bg-card border-2 border-primary p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto brutal-shadow">
            <h2 className="text-2xl font-display text-primary uppercase mb-6 border-b-2 border-primary/20 pb-4">
              Initialize New Project
            </h2>

            <form onSubmit={handleCreate} className="space-y-4 font-mono">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <input name="title" required placeholder="Title" className="border p-3 bg-background border-primary/30"/>
                <input name="projectType" required placeholder="Project Type" className="border p-3 bg-background border-primary/30"/>
                <textarea name="description" required rows={3} placeholder="Description" className="border p-3 bg-background border-primary/30"/>
                <input name="techStack" required placeholder="Required Tech Stack" className="border p-3 bg-background border-primary/30"/>
                <input name="skillsRequired" required placeholder="Skills Required" className="border p-3 bg-background border-primary/30"/>
                <input name="collaboratorsNeeded" type="number" min="1" required placeholder="Number of Collaborators Needed" className="border p-3 bg-background border-primary/30"/>
                <input name="duration" required placeholder="Duration" className="border p-3 bg-background border-primary/30"/>
                <input name="contactInfo" required placeholder="Contact Info" className="border p-3 bg-background border-primary/30"/>
              </div>

              <div className="flex justify-end gap-4 pt-6">
                <button type="button" onClick={() => setShowCreate(false)} className="px-6 py-2 border border-primary/50">
                  Cancel
                </button>

                <button type="submit" disabled={createProject.isPending} className="px-6 py-2 bg-primary text-background">
                  {createProject.isPending ? "Deploying..." : "Deploy Project"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PROJECT GRID */}
      {filteredProjects && filteredProjects.length > 0 ? (
        <div className="columns-1 md:columns-2 xl:columns-3 gap-6">
          {filteredProjects.map((project: any) => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="mb-6 block break-inside-avoid"
            >
              <div className="border p-6 bg-background/20 hover:bg-background/40 transition rounded-lg shadow-md hover:shadow-lg cursor-pointer flex flex-col gap-3 min-h-[220px]">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg">{project.title}</h3>
                  <span className="text-xs font-mono text-primary/70 uppercase">
                    {project.project_type || "Project"}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-4">
                  {project.description}
                </p>
                {Array.isArray(project.tech_stack) && project.tech_stack.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-auto">
                    {project.tech_stack.slice(0, 4).map((tech: string) => (
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
            </Link>
          ))}
        </div>
      ) : (
        <div className="text-muted-foreground text-center font-mono mt-8">
          No projects found.
        </div>
      )}
    </div>
  );
}
