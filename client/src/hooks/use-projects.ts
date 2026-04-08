import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthedFetch } from "@/lib/authed-fetch";

/* ---------------- GET ALL PROJECTS ---------------- */
export function useProjects() {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: ["/api/projects"],
    queryFn: async () => {
      const res = await authedFetch("/api/projects");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch projects");
      }
      return res.json();
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/* ---------------- GET MY PROJECTS ---------------- */
export function useMyProjects() {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: ["/api/my-projects"],
    queryFn: async () => {
      const res = await authedFetch("/api/my-projects");
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch your projects");
      }
      return res.json();
    },
    retry: false,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/* ---------------- GET SINGLE PROJECT ---------------- */
export function useProject(id: number) {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: ["/api/projects", id],
    queryFn: async () => {
      const res = await authedFetch(`/api/projects/${id}`);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch project");
      }
      return res.json();
    },
    enabled: !!id,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: false,
  });
}

/* ---------------- CREATE PROJECT ---------------- */
export function useCreateProject() {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await authedFetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to create project");
      return res.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/projects"] }),
  });
}

/* ---------------- UPDATE PROJECT ---------------- */
export function useUpdateProject() {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await authedFetch(`/api/projects/${data.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update project");
      return res.json();
    },
    onSuccess: (updatedProject) => {
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects", updatedProject.id] });
    },
  });
}

/* ---------------- DELETE PROJECT ---------------- */
export function useDeleteProject() {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await authedFetch(`/api/projects/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const text = await res.text();
        const message = text ? (() => {
          try {
            const parsed = JSON.parse(text);
            return parsed?.message || "Failed to delete project";
          } catch {
            return text;
          }
        })() : "Failed to delete project";
        throw new Error(message);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    },
    onSuccess: (_data, id) => {
      queryClient.setQueryData(["/api/projects"], (current: any) =>
        Array.isArray(current) ? current.filter((p) => p.id !== id) : current
      );
      queryClient.setQueryData(["/api/my-projects"], (current: any) =>
        Array.isArray(current) ? current.filter((p) => p.id !== id) : current
      );
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-projects"] });
    },
  });
}
