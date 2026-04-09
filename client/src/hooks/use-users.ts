import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { UpdateUser } from "@shared/schema";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useUserProfile(userId: string | null | undefined) {
  const authedFetch = useAuthedFetch();

  return useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await authedFetch(`/api/users?id=${encodeURIComponent(userId || "")}`);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Failed to fetch user");
      }
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {
  const authedFetch = useAuthedFetch();

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (data: Partial<UpdateUser>) => {
      const body = JSON.stringify(data);

      let response = await authedFetch("/api/profile", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body,
      });

      if (response.status === 404) {
        response = await authedFetch("/api/users/profile", {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body,
        });
      }

      if (!response.ok) {
        const text = await response.text();
        const message = text
          ? (() => {
              try {
                const parsed = JSON.parse(text);
                return parsed?.message || text;
              } catch {
                return text;
              }
            })()
          : "Failed to update profile";
        throw new Error(message);
      }

      return response.json();
    },

    onSuccess: (updatedUser) => {
      queryClient.setQueryData(["/api/me"], updatedUser);

      if (updatedUser?.id) {
        queryClient.setQueryData(["/api/users", updatedUser.id], updatedUser);
      }

      queryClient.invalidateQueries({
        queryKey: ["/api/me"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/users"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/projects"],
      });
      queryClient.invalidateQueries({
        queryKey: ["/api/my-projects"],
      });

    },

  });

}
