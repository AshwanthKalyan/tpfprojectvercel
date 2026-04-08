import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@shared/routes";
import type { UpdateUser } from "@shared/schema";
import { useAuthedFetch } from "@/lib/authed-fetch";

export function useUserProfile(userId: string | null | undefined) {
  const authedFetch = useAuthedFetch();

  return useQuery({
    queryKey: ["/api/users", userId],
    queryFn: async () => {
      const res = await authedFetch(`/api/users/${userId}`);
      if (res.status === 404) {
        return null;
      }
      if (!res.ok) {
        throw new Error("Failed to fetch user");
      }
      return res.json();
    },
    enabled: !!userId,
  });
}

export function useUpdateProfile() {

  const queryClient = useQueryClient();

  return useMutation({

    mutationFn: async (data: Partial<UpdateUser>) => {

      const response = await fetch(api.users.updateProfile.path, {
        method: api.users.updateProfile.method,
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error("Failed to update profile");
      }

      const json = await response.json();

      return api.users.updateProfile.responses[200].parse(json);
    },

    onSuccess: () => {

      // 🔥 force refetch of user data
      queryClient.invalidateQueries({
        queryKey: [api.users.me.path],
      });

    },

  });

}
