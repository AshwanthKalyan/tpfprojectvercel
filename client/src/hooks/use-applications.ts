import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import type { InsertApplication } from "@shared/schema";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useProjectApplications(projectId: number) {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: [api.applications.listForProject.path, projectId],
    queryFn: async () => {
      const url = buildUrl(api.applications.listForProject.path, { projectId });
      const res = await authedFetch(url);
      if (!res.ok) throw new Error("Failed to fetch applications");
      return api.applications.listForProject.responses[200].parse(await res.json());
    },
    enabled: !!projectId,
  });
}

export function useMyApplications() {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: [api.applications.listForUser.path],
    queryFn: async () => {
      const res = await authedFetch(api.applications.listForUser.path);
      if (!res.ok) throw new Error("Failed to fetch your applications");
      return api.applications.listForUser.responses[200].parse(await res.json());
    },
  });
}

export function useMyProjectApplications() {
  const authedFetch = useAuthedFetch();
  return useQuery({
    queryKey: ["/api/my-project-applications"],
    queryFn: async () => {
      const res = await authedFetch("/api/my-project-applications");
      if (!res.ok) throw new Error("Failed to fetch applications to your projects");
      return await res.json();
    },
  });
}

export function useCreateApplication(projectId: number) {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async (data: Omit<InsertApplication, "projectId" | "applicantId" | "status">) => {
      const url = buildUrl(api.applications.create.path, { projectId });
      const res = await authedFetch(url, {
        method: api.applications.create.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to apply");
      return api.applications.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.applications.listForProject.path, projectId] });
      queryClient.invalidateQueries({ queryKey: [api.applications.listForUser.path] });
    },
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "pending" | "accepted" | "rejected" }) => {
      const url = buildUrl(api.applications.updateStatus.path, { id });
      const res = await authedFetch(url, {
        method: api.applications.updateStatus.method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Failed to update status");
      return api.applications.updateStatus.responses[200].parse(await res.json());
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.applications.listForProject.path] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-project-applications"] });
    },
  });
}
