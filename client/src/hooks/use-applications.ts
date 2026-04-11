import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/react";
import { api } from "@shared/routes";
import type { InsertApplication } from "@shared/schema";
import { useAuthedFetch } from "@/lib/authed-fetch";

async function getApiErrorMessage(res: Response, fallback: string) {
  const contentType = res.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    try {
      const body = await res.json();
      if (body && typeof body.message === "string" && body.message.trim()) {
        return body.message;
      }
    } catch {
      return fallback;
    }
  }

  const text = (await res.text()).trim();
  if (!text) {
    return fallback;
  }

  try {
    const body = JSON.parse(text);
    if (body && typeof body.message === "string" && body.message.trim()) {
      return body.message;
    }
  } catch {
    // Fall back to plain text below.
  }

  if (text.startsWith("<!DOCTYPE") || text.startsWith("<html")) {
    return fallback;
  }

  return text;
}

export function useProjectApplications(projectId: number) {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  return useQuery({
    queryKey: [api.applications.listForProject.path, projectId, user?.id ?? null],
    queryFn: async () => {
      const url = `/api/projects/${projectId}/applications`;
      const res = await authedFetch(url);
      if (!res.ok) throw new Error("Failed to fetch applications");
      return await res.json();
    },
    enabled: isLoaded && isUserLoaded && !!isSignedIn && !!projectId,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}

export function useMyApplications() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  return useQuery({
    queryKey: [api.applications.listForUser.path, user?.id ?? null],
    queryFn: async () => {
      const res = await authedFetch(api.applications.listForUser.path);
      if (!res.ok) throw new Error("Failed to fetch your applications");
      return api.applications.listForUser.responses[200].parse(await res.json());
    },
    enabled: isLoaded && isUserLoaded && !!isSignedIn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}

export function useMyProjectApplications() {
  const authedFetch = useAuthedFetch();
  const { isLoaded, isSignedIn } = useAuth();
  const { isLoaded: isUserLoaded, user } = useUser();
  return useQuery({
    queryKey: ["/api/my-project-applications", user?.id ?? null],
    queryFn: async () => {
      const res = await authedFetch("/api/my-project-applications");
      if (!res.ok) throw new Error("Failed to fetch applications to your projects");
      return await res.json();
    },
    enabled: isLoaded && isUserLoaded && !!isSignedIn,
    retry: false,
    refetchOnWindowFocus: false,
    refetchOnMount: "always",
  });
}

export function useCreateApplication(projectId: number) {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async (data: Omit<InsertApplication, "projectId" | "applicantId" | "status">) => {
      const url = `/api/projects/${projectId}/applications`;
      const res = await authedFetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to apply"));
      }
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.applications.listForProject.path, projectId] });
      queryClient.invalidateQueries({ queryKey: [api.applications.listForUser.path] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-project-applications"] });
    },
  });
}

export function useUpdateApplicationStatus() {
  const queryClient = useQueryClient();
  const authedFetch = useAuthedFetch();
  return useMutation({
    mutationFn: async ({ id, status }: { id: number; status: "pending" | "accepted" | "rejected" }) => {
      const url = `/api/applications/${id}/status`;
      const res = await authedFetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, "Failed to update status"));
      }
      return await res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [api.applications.listForProject.path] });
      queryClient.invalidateQueries({ queryKey: [api.applications.listForUser.path] });
      queryClient.invalidateQueries({ queryKey: ["my-applications"] });
      queryClient.invalidateQueries({ queryKey: ["/api/my-project-applications"] });
    },
  });
}
