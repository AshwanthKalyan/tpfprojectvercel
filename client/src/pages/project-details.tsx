import { useProject, useDeleteProject, useUpdateProject } from "@/hooks/use-projects";
import {
  useProjectApplications,
  useCreateApplication,
  useUpdateApplicationStatus,
} from "@/hooks/use-applications";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "@/hooks/use-toast";
import { useRoute, Link, useLocation } from "wouter";
import {
  Terminal,
  ArrowLeft,
  Send,
  CheckCircle,
  XCircle,
  Pencil,
  Trash2,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

function looksLikeInternalId(value: unknown) {
  return typeof value === "string" && value.startsWith("user_");
}

function getProjectCreatorLabel(project: any) {
  if (project?.creatorName && !looksLikeInternalId(project.creatorName)) {
    return project.creatorName;
  }

  if (project?.creatorEmail) {
    return project.creatorEmail;
  }

  if (project?.owner_id && !looksLikeInternalId(project.owner_id)) {
    return project.owner_id;
  }

  return "Project Creator";
}

export default function ProjectDetails() {
  const [, params] = useRoute("/projects/:id");
  const projectId = Number(params?.id || 0);

  const { data: project, isLoading } = useProject(projectId);
  const { data: applications } = useProjectApplications(projectId);

  const { user } = useAuth();

  const applyMutation = useCreateApplication(projectId);
  const updateStatusMutation = useUpdateApplicationStatus();
  const deleteMutation = useDeleteProject();
  const updateMutation = useUpdateProject();

  const [, setLocation] = useLocation();

  const [showApply, setShowApply] = useState(false);
  const [editing, setEditing] = useState(false);
  const editFormRef = useRef<HTMLDivElement | null>(null);

  const normalizeUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  };

  /* ---------------- DELETE PROJECT ---------------- */


  const handleDelete = () => {
    console.log("Delete button clicked");

    if (!confirm("Are you sure you want to delete this project?")) {
      console.log("User cancelled delete");
      return;
    }

    console.log("Project ID being sent:", project.id);
    console.log("Delete mutation object:", deleteMutation);

    deleteMutation.mutate(project.id, {
      onSuccess: (data) => {
        console.log("Delete success:", data);
        toast({
          title: "Project deleted",
          description: "Your project has been removed.",
        });
        setLocation("/projects");
      },
      onError: (error) => {
        console.error("Delete failed:", error);
        toast({
          title: "Delete failed",
          description:
            error instanceof Error ? error.message : "Unable to delete project.",
        });
      },
      onSettled: (data, error) => {
        console.log("Mutation settled:", { data, error });
      }
    });
  };
  /* ---------------- APPLY ---------------- */

  const handleApply = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    applyMutation.mutate(
      {
        resumeUrl: (fd.get("resumeUrl") as string) || null,
        message: (fd.get("message") as string) || null,
      },
      {
        onSuccess: () => {
          toast({
            title: "Application sent",
            description: "Your application has been submitted.",
          });
          setShowApply(false);
        },
        onError: (error) => {
          toast({
            title: "Apply failed",
            description:
              error instanceof Error ? error.message : "Unable to submit application.",
          });
        },
      }
    );
  };

  /* ---------------- UPDATE PROJECT ---------------- */

  const handleEdit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const fd = new FormData(e.currentTarget);

    updateMutation.mutate(
      {
        id: project.id,
        title: fd.get("title"),
        description: fd.get("description"),
        duration: fd.get("duration"),
        comms_link: fd.get("comms_link"),
      },
      {
        onSuccess: () => {
          toast({
            title: "Project updated",
            description: "Your changes were saved.",
          });
          setEditing(false);
        },
        onError: (error) => {
          toast({
            title: "Edit failed",
            description:
              error instanceof Error ? error.message : "Unable to update project.",
          });
        },
      }
    );
  };

  useEffect(() => {
    if (!editing || !editFormRef.current) {
      return;
    }

    editFormRef.current.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [editing]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Terminal className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-primary font-mono text-xl">
        ERROR 404: PROJECT NOT FOUND
      </div>
    );
  }

  const isCreator = user?.id === project.owner_id;
  const existingApplication = !isCreator ? applications?.[0] ?? null : null;
  const hasApplied = !isCreator && !!existingApplication;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">

      {/* BACK BUTTON */}

      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-primary hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      {/* PROJECT CARD */}

      <div className="border-2 border-primary p-6 relative">

        <div className="absolute top-0 right-0 bg-primary text-black px-4 py-1 text-sm">
          {project.project_type}
        </div>

        <h1 className="text-4xl font-bold mb-4">{project.title}</h1>

        {/* OWNER CONTROLS */}

        {isCreator && (
          <div className="flex gap-3 mb-6">

            <button
              onClick={() => {
                setEditing(true);
                toast({
                  title: "Scroll down",
                  description: "The edit form is below.",
                });
              }}
              className="border border-primary px-4 py-2 flex items-center gap-2 hover:bg-primary hover:text-black"
            >
              <Pencil className="h-4 w-4" />
              Edit
            </button>

            <button
              onClick={handleDelete}
              className="border border-red-500 text-red-500 px-4 py-2 flex items-center gap-2 hover:bg-red-500 hover:text-white"
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>

          </div>
        )}

        {/* PROJECT META */}

        <div className="flex gap-4 mb-6 text-sm border-b pb-4">

          <span>
            Creator:
            <span className="ml-2 font-bold">
              {getProjectCreatorLabel(project)}
            </span>
          </span>

          <Link
            href={`/users/${project.owner_id}`}
            className="text-primary hover:text-white"
          >
            View Creator Profile
          </Link>

          <span>•</span>

          <span>
            Duration:
            <span className="ml-2 font-bold">
              {project.duration}
            </span>
          </span>

          <span>•</span>

          <span>
            Members Needed:
            <span className="ml-2 text-primary font-bold">
              {project.members_needed || project.collaborators_needed}
            </span>
          </span>

        </div>

        {/* DESCRIPTION */}

        <div className="space-y-6">

          <div>
            <h3 className="text-primary text-sm uppercase mb-1">
              Description
            </h3>

            <p className="whitespace-pre-wrap">
              {project.description}
            </p>
          </div>

          {/* TECH STACK */}

          <div>
            <h3 className="text-primary text-sm uppercase mb-1">
              Tech Stack
            </h3>

            <div className="flex flex-wrap gap-2">
              {project.tech_stack?.map((tech: string) => (
                <span key={tech} className="border px-3 py-1 text-sm">
                  {tech}
                </span>
              ))}
            </div>
          </div>

          {/* SKILLS */}

          <div>
            <h3 className="text-primary text-sm uppercase mb-1">
              Required Skills
            </h3>

            <div className="flex flex-wrap gap-2">
              {project.skills_required?.map((skill: string) => (
                <span key={skill} className="border px-3 py-1 text-sm">
                  {skill}
                </span>
              ))}
            </div>
          </div>

          {/* CONTACT */}

          <div>
            <h3 className="text-primary text-sm uppercase mb-1">
              Communication Link
            </h3>

            <div className="border p-3">
              {project.comms_link || project.contact_info}
            </div>
          </div>

        </div>

      {/* APPLY BUTTON */}

        {!isCreator && !showApply && (
          <div className="mt-8 flex justify-end gap-3">
            <button
              onClick={() => setLocation("/projects")}
              className="border border-primary/40 px-6 py-2"
            >
              Not Now
            </button>
            <button
              onClick={() => setShowApply(true)}
              className="bg-primary text-black px-6 py-2 flex items-center gap-2"
            >
              <Send className="h-4 w-4" />
              {hasApplied ? "Reapply" : "Apply"}
            </button>
          </div>
        )}

        {hasApplied && !isCreator && !showApply && (
          <div className="mt-8 text-right">
            <div className="inline-flex items-center gap-3">
              <div className="border px-4 py-2 inline-block">
                APPLICATION SENT
              </div>
              <button
                onClick={() => setShowApply(true)}
                className="border border-primary px-4 py-2"
              >
                Reapply
              </button>
            </div>
          </div>
        )}

      </div>

      {/* EDIT FORM */}

      {editing && (
        <div ref={editFormRef} className="border p-6">

          <h2 className="text-xl mb-4">Edit Project</h2>

          <form onSubmit={handleEdit} className="space-y-4">

            <input
              name="title"
              defaultValue={project.title}
              className="w-full border p-2"
            />

            <textarea
              name="description"
              defaultValue={project.description}
              className="w-full border p-2"
            />

            <input
              name="duration"
              defaultValue={project.duration}
              className="w-full border p-2"
            />

            <input
              name="comms_link"
              defaultValue={project.comms_link}
              className="w-full border p-2"
            />

            <div className="flex gap-3">

              <button
                type="button"
                onClick={() => setEditing(false)}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="bg-primary text-black px-6 py-2"
              >
                Save
              </button>

            </div>

          </form>

        </div>
      )}

      {/* APPLY FORM */}

      {showApply && (
        <div className="border p-6">

          <h2 className="text-xl mb-4">{hasApplied ? "Reapply" : "Apply"}</h2>

          <form onSubmit={handleApply} className="space-y-4">

            <input
              name="resumeUrl"
              placeholder="Resume URL"
              defaultValue={existingApplication?.resumeUrl || ""}
              className="w-full border p-2"
            />

            <textarea
              name="message"
              required
              placeholder="Why should we pick you?"
              defaultValue={existingApplication?.message || ""}
              className="w-full border p-2"
            />

            <div className="flex justify-end gap-3">

              <button type="button" onClick={() => setShowApply(false)}>
                Cancel
              </button>

              <button
                type="submit"
                className="bg-primary text-black px-6 py-2"
              >
                {hasApplied ? "Send Reapplication" : "Send"}
              </button>

            </div>

          </form>

        </div>
      )}

      {/* APPLICANTS (CREATOR ONLY) */}

      {isCreator && applications && applications?.length > 0 && (
        <div className="space-y-4">

          <h2 className="text-2xl font-bold">
            Applicants
          </h2>

          {applications.map((app: any) => (

            <div key={app.id} className="border p-4 flex justify-between">

              <div>
                <div className="font-bold">
                  {app?.applicant?.email || "Unknown"}
                </div>

                <p>{app.message}</p>

                {app.resumeUrl && (
                  <a
                    href={normalizeUrl(app.resumeUrl)}
                    target="_blank"
                    rel="noreferrer"
                    className="text-blue-500"
                  >
                    View Resume
                  </a>
                )}
              </div>

              {app.status === "pending" && (

                <div className="flex gap-2">

                  <button
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: app.id,
                        status: "accepted",
                      })
                    }
                    className="text-green-500"
                  >
                    <CheckCircle />
                  </button>

                  <button
                    onClick={() =>
                      updateStatusMutation.mutate({
                        id: app.id,
                        status: "rejected",
                      })
                    }
                    className="text-red-500"
                  >
                    <XCircle />
                  </button>

                </div>

              )}

            </div>

          ))}

        </div>
      )}

    </div>
  );
}
