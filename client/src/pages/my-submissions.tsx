import { useMyApplications } from "@/hooks/use-applications";
import { Terminal, ExternalLink } from "lucide-react";
import { Link } from "wouter";

export default function MySubmissions() {
  const { data: applications, isLoading } = useMyApplications();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Terminal className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* HEADER */}
      <div>
        <h1 className="text-4xl font-display border-l-4 border-primary pl-4 uppercase">
          My Submissions
        </h1>

        <p className="text-muted-foreground mt-2 pl-5 font-mono">
          Applications you have submitted.
        </p>
      </div>

      {/* APPLICATION LIST */}
      <div className="grid grid-cols-1 gap-4 font-mono">
        {applications?.map((app: any) => (
          <div
            key={app.id}
            className="border border-primary/20 bg-card p-6 flex flex-col md:flex-row justify-between gap-4"
          >
            {/* LEFT SIDE */}
            <div className="space-y-2">
              <h3 className="text-xl font-bold">
                <Link
                  href={`/projects/${app.projectId}`}
                  className="flex items-center gap-2 hover:text-primary"
                >
                  {app.projectTitle || "Unknown Project"}
                  <ExternalLink className="h-4 w-4" />
                </Link>
              </h3>

              {app.message && (
                <p className="text-muted-foreground text-sm max-w-xl truncate">
                  {app.message}
                </p>
              )}

              <div className="text-xs text-primary/60">
                Applied on:{" "}
                {app.createdAt
                  ? new Date(app.createdAt).toLocaleDateString()
                  : "Unknown"}
              </div>
            </div>

            {/* STATUS */}
            <div className="flex items-center">
              <div
                className={`px-4 py-2 border-2 text-sm uppercase font-bold ${
                  app.status === "accepted"
                    ? "border-green-500 text-green-500"
                    : app.status === "rejected"
                    ? "border-red-500 text-red-500"
                    : "border-yellow-500 text-yellow-500 animate-pulse"
                }`}
              >
                {app.status}
              </div>
            </div>
          </div>
        ))}

        {/* EMPTY STATE */}
        {applications?.length === 0 && (
          <div className="border-2 border-dashed border-primary/20 p-12 text-center text-muted-foreground">
            NO SUBMISSIONS YET
          </div>
        )}
      </div>
    </div>
  );
}
