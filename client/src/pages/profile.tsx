import { useAuth } from "@/hooks/use-auth";
import { useUpdateProfile } from "@/hooks/use-users";
import { Terminal, Save } from "lucide-react";
import { useEffect, useState } from "react";

function parseSkillsString(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) {
    return [];
  }

  if (trimmed.startsWith("[") && trimmed.endsWith("]")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map((skill) => String(skill).trim())
          .filter(Boolean);
      }
    } catch {
      // Fall through to other formats.
    }
  }

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    const inner = trimmed.slice(1, -1).trim();
    if (!inner) {
      return [];
    }
    return inner
      .split(",")
      .map((part) => part.trim())
      .map((part) => part.replace(/\\"/g, "\"").replace(/^"(.*)"$/, "$1"))
      .filter(Boolean);
  }

  return trimmed
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
}

function normalizeSkillsForInput(skills: unknown): string {
  if (!skills) {
    return "";
  }
  if (Array.isArray(skills)) {
    return skills.filter(Boolean).join(", ");
  }
  if (typeof skills === "string") {
    return parseSkillsString(skills).join(", ");
  }
  return "";
}

export default function Profile() {
  const { user, isLoading } = useAuth();
  const updateProfile = useUpdateProfile();
  
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    department: "",
    year: "",
    skills: "",
    bio: "",
    resumeUrl: "",
    githubUrl: "",
  });

  useEffect(() => {
    if (user) {
      const skillsString = normalizeSkillsForInput(user.skills);

      setFormData({
        firstName: user.firstName || "",
        lastName: user.lastName || "",
        department: user.department || "",
        year: user.year ? user.year.toString() : "",
        skills: skillsString,
        bio: user.bio || "",
        resumeUrl: user.resumeUrl || "",
        githubUrl: user.githubUrl || "",
      });
    }
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Terminal className="h-12 w-12 text-primary animate-pulse" />
      </div>
    );
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile.mutate({
      firstName: formData.firstName,
      lastName: formData.lastName,
      department: formData.department,
      year: formData.year ? Number(formData.year) : null,
      skills: parseSkillsString(formData.skills),
      bio: formData.bio,
      resumeUrl: formData.resumeUrl,
      githubUrl: formData.githubUrl,
    });
  };

  return (
    <div className="max-w-3xl space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-4xl font-display text-foreground border-l-4 border-primary pl-4 uppercase">User Identity</h1>
        <p className="text-muted-foreground mt-2 pl-5 font-mono">Configure your network presence.</p>
      </div>

      <div className="border-2 border-primary/30 bg-card p-6 md:p-8">
        <form onSubmit={handleSubmit} className="space-y-6 font-mono">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <label className="text-sm text-primary uppercase tracking-widest">First Name</label>
              <input 
                value={formData.firstName}
                onChange={e => setFormData({...formData, firstName: e.target.value})}
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-primary uppercase tracking-widest">Last Name</label>
              <input 
                value={formData.lastName}
                onChange={e => setFormData({...formData, lastName: e.target.value})}
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-primary uppercase tracking-widest">Department</label>
              <input 
                value={formData.department}
                onChange={e => setFormData({...formData, department: e.target.value})}
                placeholder="e.g. Computer Science"
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-primary uppercase tracking-widest">Year of Study</label>
              <input 
                type="number"
                value={formData.year}
                onChange={e => setFormData({...formData, year: e.target.value})}
                placeholder="e.g. 3"
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-primary uppercase tracking-widest">Skills (comma separated)</label>
              <input 
                value={formData.skills}
                onChange={e => setFormData({...formData, skills: e.target.value})}
                placeholder="React, Python, UI Design"
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-sm text-primary uppercase tracking-widest">Bio</label>
              <textarea 
                value={formData.bio}
                onChange={e => setFormData({...formData, bio: e.target.value})}
                rows={4}
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-primary uppercase tracking-widest">GitHub URL</label>
              <input 
                value={formData.githubUrl}
                onChange={e => setFormData({...formData, githubUrl: e.target.value})}
                placeholder="https://github.com/..."
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-primary uppercase tracking-widest">Resume URL</label>
              <input 
                value={formData.resumeUrl}
                onChange={e => setFormData({...formData, resumeUrl: e.target.value})}
                placeholder="Drive or Notion link..."
                className="w-full bg-background border border-primary/30 p-3 text-foreground focus:outline-none focus:border-primary transition-colors" 
              />
            </div>
          </div>

          <div className="pt-6 border-t border-primary/20 flex justify-end">
            <button 
              type="submit" 
              disabled={updateProfile.isPending}
              className="bg-primary text-background px-8 py-3 font-bold brutal-shadow hover:bg-white hover:text-black transition-all flex items-center gap-2 uppercase tracking-wider disabled:opacity-50"
            >
              <Save className="h-5 w-5" /> 
              {updateProfile.isPending ? "Updating..." : "Update Identity"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
