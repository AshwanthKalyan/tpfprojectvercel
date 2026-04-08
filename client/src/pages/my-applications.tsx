import { useMyProjectApplications, useUpdateApplicationStatus } from "@/hooks/use-applications";
import { Terminal, ExternalLink, User, CheckCircle, XCircle } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";

export default function MyApplications() {
  const { data: applications, isLoading } = useMyProjectApplications();
  const [openId, setOpenId] = useState<number | null>(null);
  const updateStatus = useUpdateApplicationStatus();

  const normalizeUrl = (url: string) => {
    if (!url) return "";
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    return `https://${url}`;
  };

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
          Applications To My Projects
        </h1>

        <p className="text-muted-foreground mt-2 pl-5 font-mono">
          Review applicants and their submitted details.
        </p>
      </div>

      {/* APPLICATION LIST */}
      <div className="grid grid-cols-1 gap-4 font-mono">

        {applications?.map((app: any) => {
          const isOpen = openId === app.applicationId;
          const applicantName =
            app.applicant?.firstName || app.applicant?.lastName
              ? `${app.applicant?.firstName || ""} ${app.applicant?.lastName || ""}`.trim()
              : "Unknown";

          return (

          <div
            key={app.applicationId}
            className="border border-primary/20 bg-card p-6 flex flex-col gap-4"
          >

            {/* HEADER */}
            <div className="flex flex-col md:flex-row justify-between gap-4">
              <div className="space-y-2">

                <h3 className="text-xl font-bold">
                  <Link
                    href={`/projects/${app.projectId}`}
                    className="flex items-center gap-2 hover:text-primary"
                  >
                    {app.projectTitle || "Unknown Project"}
                    <ExternalLink className="h-4 w-4 text-muted-foreground" />
                  </Link>
                </h3>

                <div className="text-sm text-muted-foreground">
                  Applicant: <span className="text-foreground">{applicantName}</span>
                  {app.applicant?.email && (
                    <span className="ml-2 text-primary/70">({app.applicant.email})</span>
                  )}
                </div>

                <div className="text-xs text-primary/60">
                  Applied on:{" "}
                  {app.createdAt
                    ? new Date(app.createdAt).toLocaleDateString()
                    : "Unknown"}
                </div>

              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => setOpenId(isOpen ? null : app.applicationId)}
                  className="px-4 py-2 border border-primary/40 text-sm uppercase font-bold flex items-center gap-2 hover:bg-primary/10"
                >
                  <User className="h-4 w-4" />
                  {isOpen ? "Hide Profile" : "View Profile"}
                </button>

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

                {app.status === "pending" && (
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        updateStatus.mutate({ id: app.applicationId, status: "accepted" })
                      }
                      className="text-green-500 hover:scale-110 transition-transform"
                      title="Accept"
                    >
                      <CheckCircle className="h-5 w-5" />
                    </button>
                    <button
                      onClick={() =>
                        updateStatus.mutate({ id: app.applicationId, status: "rejected" })
                      }
                      className="text-red-500 hover:scale-110 transition-transform"
                      title="Reject"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* PROFILE DETAILS */}
            {isOpen && (
              <div className="border-t border-primary/20 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="text-sm text-primary uppercase">Profile</div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Department:</span>{" "}
                    {app.applicant?.department || "—"}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Year:</span>{" "}
                    {app.applicant?.year ?? "—"}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Skills:</span>{" "}
                    {Array.isArray(app.applicant?.skills)
                      ? app.applicant.skills.join(", ")
                      : app.applicant?.skills || "—"}
                  </div>
                  <div className="text-sm">
                    <span className="text-muted-foreground">Bio:</span>{" "}
                    {app.applicant?.bio || "—"}
                  </div>
                  {app.applicant?.githubUrl && (
                    <a
                      href={normalizeUrl(app.applicant.githubUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      GitHub Profile
                    </a>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="text-sm text-primary uppercase">Submission</div>
                  {app.message && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Message:</span>{" "}
                      {app.message}
                    </div>
                  )}
                  {app.resumeUrl && (
                    <a
                      href={normalizeUrl(app.resumeUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      Application Resume
                    </a>
                  )}
                  {app.applicant?.resumeUrl && (
                    <a
                      href={normalizeUrl(app.applicant.resumeUrl)}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-primary underline"
                    >
                      Profile Resume
                    </a>
                  )}
                </div>
              </div>
            )}

          </div>

        );
      })}

        {/* EMPTY STATE */}
        {applications?.length === 0 && (
          <div className="border-2 border-dashed border-primary/20 p-12 text-center text-muted-foreground">
            NO APPLICATIONS YET
          </div>
        )}

      </div>
    </div>
  );
}
