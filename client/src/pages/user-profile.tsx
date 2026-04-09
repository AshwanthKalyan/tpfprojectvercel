import { useRoute, Link } from "wouter";
import { Terminal, ArrowLeft, ExternalLink } from "lucide-react";
import { useUserProfile } from "@/hooks/use-users";

export default function UserProfile() {
  const [, params] = useRoute("/users/:id");
  const userId = params?.id || "";
  const { data: user, isLoading, isError } = useUserProfile(userId);

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

  if (isError || !user) {
    return (
      <div className="text-primary font-mono text-xl">
        ERROR 404: USER NOT FOUND
      </div>
    );
  }

  const fullName =
    user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : "";
  const displayName =
    fullName || user.creatorName || user.email || "Project Creator";

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Link
        href="/projects"
        className="inline-flex items-center gap-2 text-primary hover:text-white"
      >
        <ArrowLeft className="h-4 w-4" /> Back to projects
      </Link>

      <div className="border-2 border-primary p-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">
              {displayName}
            </h1>
            <p className="text-sm text-muted-foreground">
              {user.email || "Email hidden"}
            </p>
          </div>
          {user.githubUrl ? (
            <a
              href={normalizeUrl(user.githubUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 border border-primary px-4 py-2 hover:bg-primary hover:text-black transition"
            >
              <ExternalLink className="h-4 w-4" />
              GitHub
            </a>
          ) : null}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
          <div className="space-y-2">
            <div className="text-primary uppercase text-xs">Department</div>
            <div>{user.department || "Not provided"}</div>
          </div>
          <div className="space-y-2">
            <div className="text-primary uppercase text-xs">Year</div>
            <div>{user.year || "Not provided"}</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-primary uppercase text-xs">Bio</div>
          <div className="border p-4 bg-background/20">
            {user.bio || "No bio added."}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-primary uppercase text-xs">Skills</div>
          <div className="flex flex-wrap gap-2">
            {Array.isArray(user.skills) && user.skills.length > 0 ? (
              user.skills.map((skill: string) => (
                <span
                  key={skill}
                  className="text-xs border border-primary/30 px-2 py-1 uppercase"
                >
                  {skill}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground text-sm">
                No skills listed.
              </span>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <div className="text-primary uppercase text-xs">Resume</div>
          {user.resumeUrl ? (
            <a
              href={normalizeUrl(user.resumeUrl)}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:text-white"
            >
              <ExternalLink className="h-4 w-4" />
              View Resume
            </a>
          ) : (
            <span className="text-muted-foreground text-sm">
              No resume link provided.
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
